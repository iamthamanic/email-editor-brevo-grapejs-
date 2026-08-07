/**
 * Variable picker — groups Kunde/Auftrag/Rechnung; optional filter + embedded mode.
 * Location: apps/editor/src/variables/VariablePicker.tsx
 */

import { useEffect, useState } from "react";
import type { Editor } from "@email-template/editor-core";
import {
  fetchVariables,
  type VariableDto,
} from "../api/variablesApi";
import { insertVariableExpression } from "./insertVariable";

const GROUP_ORDER = ["customer", "order", "invoice", "meta"] as const;

interface VariablePickerProps {
  editor: Editor | null;
  /** Case-insensitive filter on label / key / expression */
  filterQuery?: string;
  /** Hide outer title when inside Library accordion */
  embedded?: boolean;
  /** Called after a successful insert (e.g. close toolbar dropdown) */
  onAfterPick?: () => void;
}

export function VariablePicker({
  editor,
  filterQuery = "",
  embedded = false,
  onAfterPick,
}: VariablePickerProps) {
  const [variables, setVariables] = useState<VariableDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchVariables();
        if (!cancelled) setVariables(list);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Variablen laden fehlgeschlagen",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function onPick(variable: VariableDto) {
    setHint(null);
    if (!editor) {
      setHint("Editor noch nicht bereit.");
      return;
    }
    const ok = insertVariableExpression(editor, {
      key: variable.key,
      label: variable.label,
      expression: variable.expression,
    });
    if (!ok) {
      setHint("Bitte Text-, Überschrift- oder Button-Block wählen");
      return;
    }
    onAfterPick?.();
  }

  const q = filterQuery.trim().toLowerCase();
  const filtered = q
    ? variables.filter((v) => {
        const hay = `${v.label} ${v.key} ${v.expression} ${v.groupLabel}`.toLowerCase();
        return hay.includes(q);
      })
    : variables;

  if (loading) {
    return (
      <div className="variables-panel" aria-busy="true">
        {!embedded && <h2 className="variables-title">Variablen</h2>}
        <p className="muted">Laden…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="variables-panel" role="alert">
        {!embedded && <h2 className="variables-title">Variablen</h2>}
        <p className="error">{error}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setLoading(true);
            setError(null);
            void fetchVariables()
              .then(setVariables)
              .catch((err: unknown) =>
                setError(
                  err instanceof Error
                    ? err.message
                    : "Variablen laden fehlgeschlagen",
                ),
              )
              .finally(() => setLoading(false));
          }}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="variables-panel" data-testid="variable-picker">
      {!embedded && <h2 className="variables-title">Variablen</h2>}
      <p className="muted variables-help">
        Klick fügt ein Badge ein. Block wählen, dann Variable tippen — Doppelklick
        auf Text zum Tippen.
      </p>
      {hint && (
        <p className="error" role="status">
          {hint}
        </p>
      )}
      {filtered.length === 0 ? (
        <p className="muted">Keine Treffer</p>
      ) : (
        <div className="variables-groups">
          {GROUP_ORDER.map((group) => {
            const items = filtered.filter((v) => v.group === group);
            if (items.length === 0) return null;
            const groupLabel = items[0]?.groupLabel ?? group;
            return (
              <section key={group} className="variables-group">
                <h3 className="variables-group-label">{groupLabel}</h3>
                <ul className="variables-list">
                  {items.map((v) => (
                    <li key={v.key}>
                      <button
                        type="button"
                        className="variables-item"
                        data-variable-key={v.key}
                        onClick={() => onPick(v)}
                      >
                        <span className="variables-item-main">
                          <span className="variables-badge-preview">
                            {v.expression}
                          </span>
                        </span>
                        <span className="variables-expr">{v.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
