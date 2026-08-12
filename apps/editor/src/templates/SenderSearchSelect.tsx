/**
 * Searchable Brevo Absender picker: email dropdown + separate name field.
 * Location: apps/editor/src/templates/SenderSearchSelect.tsx
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BrevoSenderDto } from "@email-template/email-schema";
import { IconChevronDown, IconRefresh } from "./icons";

function matchesQuery(s: BrevoSenderDto, query: string): boolean {
  const raw = query.trim().toLowerCase();
  if (!raw) return true;
  const hay = [s.name, s.email, String(s.id), s.active ? "aktiv" : "inaktiv"]
    .join(" ")
    .toLowerCase();
  return raw.split(/\s+/).filter(Boolean).every((token) => hay.includes(token));
}

export interface SenderSearchSelectProps {
  senders: BrevoSenderDto[];
  /** Selected sender email (lowercase). Empty = none. */
  valueEmail: string;
  valueName?: string | null;
  onChange: (sender: BrevoSenderDto | null) => void;
  /** Persist edited display name for the selected email. */
  onNameChange: (name: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  statusHint?: string | null;
}

export function SenderSearchSelect({
  senders,
  valueEmail,
  valueName,
  onChange,
  onNameChange,
  onRefresh,
  disabled = false,
  loading = false,
  refreshing = false,
  error = null,
  statusHint = null,
}: SenderSearchSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const emailNorm = valueEmail.trim().toLowerCase();
  const selected =
    senders.find((s) => s.email.toLowerCase() === emailNorm) ?? null;

  const orphan: BrevoSenderDto | null =
    !selected && emailNorm
      ? {
          id: -1,
          email: emailNorm,
          name: (valueName ?? "").trim(),
          active: true,
        }
      : null;

  const displayEmail = selected?.email ?? orphan?.email ?? "";
  const nameValue = valueName ?? "";

  const triggerLabel = displayEmail || "E-Mail wählen…";

  const labelText = loading
    ? "Absender werden geladen…"
    : refreshing
      ? "Absender werden aktualisiert…"
      : statusHint
        ? statusHint
        : triggerLabel;

  const filtered = useMemo(() => {
    const activeFirst = [...senders].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.email.localeCompare(b.email);
    });
    return activeFirst.filter((s) => matchesQuery(s, query));
  }, [senders, query]);

  useEffect(() => {
    if (loading || refreshing) {
      setOpen(false);
      setQuery("");
    }
  }, [loading, refreshing]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(sender: BrevoSenderDto | null) {
    onChange(sender);
    setOpen(false);
    setQuery("");
  }

  function toggleOpen() {
    if (disabled || loading || refreshing) return;
    setOpen((prev) => {
      if (prev) {
        setQuery("");
        return false;
      }
      setQuery("");
      return true;
    });
  }

  const busy = loading || refreshing;

  return (
    <div className="ed-sender-block">
      <div className="ed-sender-row">
        <div className="ed-sender-email-field">
          <span className="ed-sender-sublabel">E-Mail</span>
          <div
            className={`compose-template-search ed-sender-search${open ? " is-open" : ""}`}
            ref={rootRef}
          >
            <button
              type="button"
              className={`field-input compose-template-search-trigger${busy ? " is-loading" : ""}${statusHint && !busy ? " has-status" : ""}`}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-busy={busy}
              disabled={disabled || busy}
              onClick={toggleOpen}
              data-testid="template-sender-select"
            >
              <span className="compose-template-search-trigger-label">
                {labelText}
              </span>
              {busy ? (
                <span
                  className="compose-template-search-spinner"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="compose-template-search-chevron"
                  aria-hidden="true"
                >
                  <IconChevronDown />
                </span>
              )}
            </button>
            {open && !disabled && !busy && (
              <ul
                id={listId}
                className="compose-template-search-list"
                role="listbox"
                aria-label="Absender-E-Mail"
              >
                <li
                  className="compose-template-search-query"
                  role="presentation"
                >
                  <input
                    ref={searchRef}
                    className="field-input compose-template-search-query-input"
                    type="search"
                    value={query}
                    placeholder="E-Mail oder Name suchen…"
                    aria-label="Absender suchen"
                    aria-controls={listId}
                    aria-autocomplete="list"
                    onChange={(e) => setQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </li>
                {orphan && (
                  <li role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected
                      className="is-selected"
                      onClick={() => pick(orphan)}
                    >
                      <span className="compose-template-search-title">
                        {orphan.email}
                      </span>
                      <span className="compose-template-search-sub">
                        {(orphan.name || "—") +
                          " · aktuell gespeichert (nicht in Brevo-Liste)"}
                      </span>
                    </button>
                  </li>
                )}
                {filtered.length === 0 ? (
                  <li
                    className="compose-template-search-empty"
                    role="presentation"
                  >
                    Keine Treffer
                  </li>
                ) : (
                  filtered.map((s) => (
                    <li key={s.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={s.email.toLowerCase() === emailNorm}
                        className={
                          s.email.toLowerCase() === emailNorm
                            ? "is-selected"
                            : ""
                        }
                        onClick={() => pick(s)}
                      >
                        <span className="compose-template-search-title">
                          {s.email}
                        </span>
                        <span className="compose-template-search-sub">
                          {s.name.trim() || "—"}
                          {!s.active ? " · inaktiv" : ""}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        <label className="ed-sender-name-field">
          <span className="ed-sender-sublabel">Name</span>
          <input
            className="field-input"
            type="text"
            value={nameValue}
            disabled={disabled || busy || !emailNorm}
            placeholder={
              emailNorm ? "Absendername eingeben" : "Zuerst E-Mail wählen"
            }
            title="Absendername (editierbar, wird mit dem Template gespeichert)"
            data-testid="template-sender-name"
            aria-label="Absendername"
            maxLength={120}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="ed-btn-ghost ed-sender-refresh"
          onClick={onRefresh}
          disabled={disabled || busy}
          title="Absender von Brevo aktualisieren"
          aria-label="Absender von Brevo aktualisieren"
          data-testid="template-sender-refresh"
        >
          <IconRefresh size={16} />
          <span>Aktualisieren</span>
        </button>
      </div>
      {error && <span className="field-hint error">{error}</span>}
    </div>
  );
}
