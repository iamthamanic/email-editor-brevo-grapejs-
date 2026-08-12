/**
 * Searchable template picker for compose (full-text filter).
 * Location: apps/editor/src/compose/TemplateSearchSelect.tsx
 *
 * Closed: trigger shows selection. Open: list with search as first row,
 * then "Ohne Vorlage", then filtered templates.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { EmailTemplateListItem } from "@email-template/email-schema";
import { IconChevronDown } from "../templates/icons";

const EMPTY_VALUE = "";

function templateLabel(tpl: EmailTemplateListItem): string {
  const title = tpl.label || tpl.name;
  return tpl.brevoTemplateId ? `${title} (#${tpl.brevoTemplateId})` : title;
}

function matchesQuery(tpl: EmailTemplateListItem, query: string): boolean {
  const raw = query.trim().toLowerCase();
  if (!raw) return true;

  const display = templateLabel(tpl).toLowerCase();
  const brevoId = (tpl.brevoTemplateId ?? "").toLowerCase();
  const hay = [
    display,
    tpl.name,
    tpl.label ?? "",
    tpl.subject ?? "",
    brevoId,
    brevoId ? `#${brevoId}` : "",
    tpl.status,
    tpl.id,
  ]
    .join(" ")
    .toLowerCase();

  // Every whitespace-separated token must match (order-independent).
  const tokens = raw.split(/\s+/).filter(Boolean);
  return tokens.every((token) => {
    if (hay.includes(token)) return true;
    // "#5" ↔ "5" for Brevo IDs
    const bare = token.replace(/^#/, "");
    if (bare && (brevoId === bare || brevoId.includes(bare))) return true;
    return false;
  });
}

interface TemplateSearchSelectProps {
  templates: EmailTemplateListItem[];
  value: string;
  onChange: (templateId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Brief status after sync, e.g. "12 Templates von Brevo geladen" */
  statusHint?: string | null;
  emptyLabel?: string;
}

export function TemplateSearchSelect({
  templates,
  value,
  onChange,
  disabled = false,
  loading = false,
  statusHint = null,
  emptyLabel = "Ohne Vorlage (leer)",
}: TemplateSearchSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = templates.find((t) => t.id === value) ?? null;
  const triggerLabel = selected ? templateLabel(selected) : emptyLabel;
  const labelText = loading
    ? "Templates werden geladen…"
    : statusHint
      ? statusHint
      : triggerLabel;

  const filtered = useMemo(
    () => templates.filter((t) => matchesQuery(t, query)),
    [templates, query],
  );

  useEffect(() => {
    if (loading) {
      setOpen(false);
      setQuery("");
    }
  }, [loading]);

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

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function toggleOpen() {
    if (disabled || loading) return;
    setOpen((prev) => {
      if (prev) {
        setQuery("");
        return false;
      }
      setQuery("");
      return true;
    });
  }

  return (
    <div
      className={`compose-template-search${open ? " is-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`field-input compose-template-search-trigger${loading ? " is-loading" : ""}${statusHint && !loading ? " has-status" : ""}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-busy={loading}
        disabled={disabled}
        onClick={toggleOpen}
      >
        <span className="compose-template-search-trigger-label">
          {labelText}
        </span>
        {loading ? (
          <span
            className="compose-template-search-spinner"
            aria-hidden="true"
          />
        ) : (
          <span className="compose-template-search-chevron" aria-hidden="true">
            <IconChevronDown />
          </span>
        )}
      </button>
      {open && !disabled && (
        <ul
          id={listId}
          className="compose-template-search-list"
          role="listbox"
          aria-label="Templates"
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
              placeholder="Template suchen…"
              aria-label="Template suchen"
              aria-controls={listId}
              aria-autocomplete="list"
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </li>
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={value === EMPTY_VALUE}
              className={value === EMPTY_VALUE ? "is-selected" : ""}
              onClick={() => pick(EMPTY_VALUE)}
            >
              {emptyLabel}
            </button>
          </li>
          {filtered.length === 0 && (
            <li className="compose-template-search-empty" role="presentation">
              Keine Treffer
            </li>
          )}
          {filtered.map((tpl) => (
            <li key={tpl.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === tpl.id}
                className={value === tpl.id ? "is-selected" : ""}
                onClick={() => pick(tpl.id)}
              >
                <span className="compose-template-search-title">
                  {templateLabel(tpl)}
                </span>
                {tpl.subject ? (
                  <span className="compose-template-search-sub">
                    {tpl.subject}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
