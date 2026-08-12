/**
 * Multi-email input: completed addresses become editable pills.
 * Location: apps/editor/src/compose/ComposeEmailChipsField.tsx
 *
 * ⌘A selects all chips (+ draft); ⌘Z / ⌘⇧Z undo/redo chip commits.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

const EMAIL_SPLIT = /[,;\s]+/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const HISTORY_MAX = 100;

function parseEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(EMAIL_SPLIT)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e)),
    ),
  ];
}

function serializeEmails(emails: string[]): string {
  return emails.join(", ");
}

function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}

function isMod(e: ReactKeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

interface Snapshot {
  emails: string[];
  draft: string;
}

interface ComposeEmailChipsFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  dense?: boolean;
  "aria-label"?: string;
}

export function ComposeEmailChipsField({
  value,
  onChange,
  placeholder = "email@example.com",
  disabled = false,
  dense = false,
  "aria-label": ariaLabel,
}: ComposeEmailChipsFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [emails, setEmails] = useState(() => parseEmails(value));
  const [draft, setDraft] = useState("");
  const [allSelected, setAllSelected] = useState(false);
  const historyRef = useRef<Snapshot[]>([
    { emails: parseEmails(value), draft: "" },
  ]);
  const historyIndexRef = useRef(0);
  const applyingHistory = useRef(false);
  const emailsRef = useRef(emails);
  const draftRef = useRef(draft);
  emailsRef.current = emails;
  draftRef.current = draft;

  useEffect(() => {
    if (draft !== "") return;
    const fromProp = parseEmails(value);
    setEmails((prev) =>
      serializeEmails(prev) === serializeEmails(fromProp) ? prev : fromProp,
    );
  }, [value, draft]);

  function pushHistory(nextEmails: string[], nextDraft: string) {
    if (applyingHistory.current) return;
    const cur = historyRef.current[historyIndexRef.current];
    if (
      cur &&
      serializeEmails(cur.emails) === serializeEmails(nextEmails) &&
      cur.draft === nextDraft
    ) {
      return;
    }
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push({ emails: [...nextEmails], draft: nextDraft });
    if (trimmed.length > HISTORY_MAX) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
  }

  function commit(list: string[], nextDraft = "", recordHistory = true) {
    const unique = [...new Set(list.map((e) => e.toLowerCase()))];
    setEmails(unique);
    setDraft(nextDraft);
    setAllSelected(false);
    if (recordHistory) pushHistory(unique, nextDraft);
    onChange(serializeEmails(unique));
  }

  function applySnapshot(snap: Snapshot) {
    applyingHistory.current = true;
    setEmails(snap.emails);
    setDraft(snap.draft);
    setAllSelected(false);
    onChange(serializeEmails(snap.emails));
    applyingHistory.current = false;
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /** Commit one or many emails from typed/pasted text; keep trailing incomplete token as draft. */
  function ingestRaw(raw: string) {
    const endsWithDelimiter = /[,;\s]$/.test(raw);
    const segments = raw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const found: string[] = [];
    let remainder = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const tokens = segment.split(/\s+/).filter(Boolean);
      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j]!;
        const isLastToken =
          i === segments.length - 1 &&
          j === tokens.length - 1 &&
          !endsWithDelimiter;
        if (isValidEmail(token)) {
          found.push(token.toLowerCase());
        } else if (isLastToken) {
          remainder = token;
        }
      }
    }

    if (found.length === 0) {
      setDraft(raw);
      setAllSelected(false);
      return;
    }

    const next = [...emailsRef.current];
    for (const email of found) {
      if (!next.includes(email)) next.push(email);
    }
    commit(next, remainder);
  }

  function editPill(index: number) {
    if (disabled) return;
    const target = emails[index];
    if (!target) return;
    let base = emails.filter((_, i) => i !== index);
    if (draft.trim()) {
      const fromDraft = parseEmails(draft);
      for (const email of fromDraft) {
        if (!base.includes(email)) base = [...base, email];
      }
      if (fromDraft.length === 0 && isValidEmail(draft)) {
        const normalized = draft.trim().toLowerCase();
        if (!base.includes(normalized)) base = [...base, normalized];
      }
    }
    commit(base, target);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function removePill(index: number) {
    if (disabled) return;
    commit(
      emails.filter((_, i) => i !== index),
      draft,
    );
    inputRef.current?.focus();
  }

  function handleModKey(e: ReactKeyboardEvent) {
    if (!isMod(e)) return false;
    const key = e.key.toLowerCase();
    e.stopPropagation();

    if (key === "a") {
      e.preventDefault();
      setAllSelected(emails.length > 0);
      inputRef.current?.select();
      return true;
    }

    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      if (historyIndexRef.current <= 0) return true;
      historyIndexRef.current -= 1;
      const snap = historyRef.current[historyIndexRef.current];
      if (snap) applySnapshot(snap);
      return true;
    }

    if ((key === "z" && e.shiftKey) || key === "y") {
      e.preventDefault();
      if (historyIndexRef.current >= historyRef.current.length - 1) return true;
      historyIndexRef.current += 1;
      const snap = historyRef.current[historyIndexRef.current];
      if (snap) applySnapshot(snap);
      return true;
    }

    return false;
  }

  return (
    <div
      className={`field-input compose-email-chips${dense ? " is-dense" : ""}${disabled ? " is-disabled" : ""}${allSelected ? " is-all-selected" : ""}`}
      onClick={() => {
        if (!disabled) {
          setAllSelected(false);
          inputRef.current?.focus();
        }
      }}
      onKeyDown={(e) => {
        handleModKey(e);
      }}
    >
      {emails.map((email, index) => (
        <span
          key={`${email}-${index}`}
          className={`compose-email-chip${allSelected ? " is-selected" : ""}`}
        >
          <button
            type="button"
            className="compose-email-chip-edit"
            disabled={disabled}
            title="Klicken zum Bearbeiten"
            onClick={(e) => {
              e.stopPropagation();
              setAllSelected(false);
              editPill(index);
            }}
          >
            {email}
          </button>
          <button
            type="button"
            className="compose-email-chip-remove"
            disabled={disabled}
            aria-label={`${email} entfernen`}
            onClick={(e) => {
              e.stopPropagation();
              removePill(index);
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={inputId}
        className="compose-email-chips-input"
        type="text"
        inputMode="email"
        value={draft}
        disabled={disabled}
        placeholder={emails.length === 0 ? placeholder : ""}
        aria-label={ariaLabel}
        autoComplete="email"
        onChange={(e) => {
          setAllSelected(false);
          const next = e.target.value;
          if (/[,;]/.test(next) || parseEmails(next).length > 1) {
            ingestRaw(next);
            return;
          }
          setDraft(next);
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text/plain").trim();
          if (!text) return;
          if (!/[,;\s]/.test(text) && parseEmails(text).length <= 1) return;
          e.preventDefault();
          ingestRaw(draft ? `${draft} ${text}` : text);
        }}
        onKeyDown={(e) => {
          if (handleModKey(e)) return;

          if (
            allSelected &&
            (e.key === "Backspace" || e.key === "Delete")
          ) {
            e.preventDefault();
            commit([], "");
            return;
          }

          if (e.key === "Enter") {
            if (draft.trim()) {
              e.preventDefault();
              ingestRaw(draft);
            }
            return;
          }
          if (e.key === "Backspace" && draft === "" && emails.length > 0) {
            e.preventDefault();
            editPill(emails.length - 1);
          }
        }}
        onBlur={() => {
          setAllSelected(false);
          if (draft.trim()) {
            ingestRaw(draft);
          } else if (draft !== draftRef.current) {
            pushHistory(emailsRef.current, draft);
          }
        }}
      />
    </div>
  );
}
