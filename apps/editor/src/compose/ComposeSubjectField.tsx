/**
 * Compose subject field: param pills in edit, sample-resolved text in preview.
 * Location: apps/editor/src/compose/ComposeSubjectField.tsx
 *
 * Maintains its own undo/redo stack so ⌘Z/⌘⇧Z work with pill DOM updates,
 * and ⌘A selects the whole subject.
 */

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  getSampleData,
  getVariable,
  isKnownVariableKey,
  splitParamExpressions,
  substituteParams,
} from "@email-template/email-variables";

const MAX_LEN = 200;
const HISTORY_MAX = 100;

function isMod(e: ReactKeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

function pillLabel(key: string): string {
  return `{{ params.${key} }}`;
}

function buildSubjectDom(doc: Document, value: string): DocumentFragment {
  const frag = doc.createDocumentFragment();
  const parts = splitParamExpressions(value);
  if (parts.length === 0) return frag;

  for (const part of parts) {
    if (part.type === "text") {
      frag.append(doc.createTextNode(part.value));
      continue;
    }
    const known = isKnownVariableKey(part.key);
    const expression = pillLabel(part.key);
    const meaning = getVariable(part.key)?.label ?? part.key;
    const pill = doc.createElement("span");
    pill.className = `compose-subject-pill${known ? " is-known" : " is-unknown"}`;
    pill.contentEditable = "false";
    pill.dataset.paramKey = part.key;
    pill.title = `${meaning} — ${expression}`;
    pill.setAttribute("aria-label", `${meaning}: ${expression}`);
    pill.textContent = expression;
    frag.append(pill);
  }
  return frag;
}

function serializeSubject(root: HTMLElement): string {
  let out = "";
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const key = node.dataset.paramKey?.trim();
    if (key) {
      out += `{{ params.${key} }}`;
      continue;
    }
    out += serializeSubject(node);
  }
  return out;
}

function selectAllContents(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

interface ComposeSubjectFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** edit = pills; preview = resolved sample values (read-only) */
  mode: "edit" | "preview";
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function ComposeSubjectField({
  value,
  onChange,
  mode,
  disabled = false,
  placeholder = "Betreff eingeben",
  maxLength = MAX_LEN,
}: ComposeSubjectFieldProps) {
  const editRef = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef(value);
  const historyRef = useRef<string[]>([value]);
  const historyIndexRef = useRef(0);
  const applyingHistory = useRef(false);

  function pushHistory(next: string) {
    if (applyingHistory.current) return;
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    if (stack[idx] === next) return;
    const trimmed = stack.slice(0, idx + 1);
    trimmed.push(next);
    if (trimmed.length > HISTORY_MAX) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
  }

  function applyHistoryValue(next: string) {
    const el = editRef.current;
    applyingHistory.current = true;
    lastEmitted.current = next;
    if (el) {
      el.replaceChildren(buildSubjectDom(el.ownerDocument, next));
    }
    onChange(next);
    applyingHistory.current = false;
  }

  useEffect(() => {
    if (mode !== "edit") return;
    const el = editRef.current;
    if (!el) return;
    if (value === lastEmitted.current && el.childNodes.length > 0) {
      const current = serializeSubject(el);
      if (current === value) return;
    }
    el.replaceChildren(buildSubjectDom(el.ownerDocument, value));
    lastEmitted.current = value;
    if (!applyingHistory.current) {
      pushHistory(value);
    }
  }, [value, mode]);

  if (mode === "preview") {
    const resolved =
      substituteParams(value || "", getSampleData()) || placeholder;
    return (
      <div
        className="field-input compose-subject-field is-preview"
        role="text"
        aria-readonly="true"
        aria-label="Betreff (Vorschau)"
        data-testid="compose-subject-preview"
      >
        {value.trim() ? resolved : (
          <span className="compose-subject-placeholder">{placeholder}</span>
        )}
      </div>
    );
  }

  function emitFromDom() {
    const el = editRef.current;
    if (!el) return;
    if (
      el.childNodes.length === 1 &&
      el.firstChild instanceof HTMLBRElement
    ) {
      el.replaceChildren();
    }
    let next = serializeSubject(el);
    if (next.length > maxLength) {
      next = next.slice(0, maxLength);
      el.replaceChildren(buildSubjectDom(el.ownerDocument, next));
    }
    lastEmitted.current = next;
    pushHistory(next);
    if (next !== value) onChange(next);
  }

  return (
    <div
      ref={editRef}
      className={`field-input compose-subject-field${disabled ? " is-disabled" : ""}`}
      contentEditable={!disabled}
      role="textbox"
      aria-multiline="false"
      aria-label="Betreff"
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      data-testid="compose-subject-edit"
      suppressContentEditableWarning
      onInput={emitFromDom}
      onBlur={emitFromDom}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          return;
        }
        if (!isMod(e)) return;

        const key = e.key.toLowerCase();
        // Keep GrapesJS keymaster from stealing shortcuts outside the canvas.
        e.stopPropagation();

        if (key === "a") {
          e.preventDefault();
          if (editRef.current) selectAllContents(editRef.current);
          return;
        }

        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          if (historyIndexRef.current <= 0) return;
          historyIndexRef.current -= 1;
          applyHistoryValue(historyRef.current[historyIndexRef.current] ?? "");
          return;
        }

        if ((key === "z" && e.shiftKey) || key === "y") {
          e.preventDefault();
          if (historyIndexRef.current >= historyRef.current.length - 1) return;
          historyIndexRef.current += 1;
          applyHistoryValue(historyRef.current[historyIndexRef.current] ?? "");
        }
      }}
    />
  );
}
