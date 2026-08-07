/**
 * Variable picker panel — groups Kunde/Auftrag/Rechnung, inserts params expressions.
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
}

export function VariablePicker({ editor }: VariablePickerProps) {
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
    const ok = insertVariableExpression(editor, variable.expression);
    if (!ok) {
      setHint("Bitte Text oder Button wählen");
    }
  }

  if (loading) {
    return (
      <aside className="variables-panel" aria-busy="true">
        <h2 className="variables-title">Variablen</h2>
        <p className="muted">Laden…</p>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="variables-panel" role="alert">
        <h2 className="variables-title">Variablen</h2>
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
      </aside>
    );
  }

  return (
    <aside className="variables-panel" data-testid="variable-picker">
      <h2 className="variables-title">Variablen</h2>
      <p className="muted variables-help">
        Klick fügt <code>{"{{ params.* }}"}</code> ein
      </p>
      {hint && (
        <p className="error" role="status">
          {hint}
        </p>
      )}
      <div className="variables-groups">
        {GROUP_ORDER.map((group) => {
          const items = variables.filter((v) => v.group === group);
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
                      {v.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
