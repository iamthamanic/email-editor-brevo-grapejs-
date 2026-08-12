/**
 * Confirm edit/delete of a Textbaustein title category ("Bist du sicher?").
 * Location: apps/editor/src/templates/ConfirmCategoryModal.tsx
 */

import { useEffect, useRef, useState } from "react";

export type CategoryConfirmAction =
  | { kind: "delete"; name: string }
  | { kind: "edit"; name: string };

interface ConfirmCategoryModalProps {
  action: CategoryConfirmAction | null;
  maxNameLength?: number;
  onClose: () => void;
  onConfirmDelete: (name: string) => Promise<void>;
  onConfirmEdit: (from: string, to: string) => Promise<void>;
}

export function ConfirmCategoryModal({
  action,
  maxNameLength = 40,
  onClose,
  onConfirmDelete,
  onConfirmEdit,
}: ConfirmCategoryModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!action) return;
    setBusy(false);
    setError(null);
    setDraft(action.kind === "edit" ? action.name : "");
    const t = window.setTimeout(() => {
      if (action.kind === "edit") inputRef.current?.focus();
      else confirmRef.current?.focus();
    }, 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [action, onClose, busy]);

  if (!action) return null;

  const isEdit = action.kind === "edit";
  const heading = isEdit ? "Kategorie umbenennen?" : "Kategorie entfernen?";

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      if (action!.kind === "delete") {
        await onConfirmDelete(action!.name);
      } else {
        const next = draft.trim().replace(/\s+/g, " ");
        if (!next) {
          setError("Bitte einen neuen Namen eingeben.");
          setBusy(false);
          return;
        }
        if (next.length > maxNameLength) {
          setError(`Max. ${maxNameLength} Zeichen.`);
          setBusy(false);
          return;
        }
        if (/[–-]/.test(next)) {
          setError("Name darf keinen Gedankenstrich enthalten.");
          setBusy(false);
          return;
        }
        if (next.toLowerCase() === action!.name.toLowerCase()) {
          onClose();
          return;
        }
        await onConfirmEdit(action!.name, next);
      }
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Aktion fehlgeschlagen",
      );
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop ed-cat-confirm-backdrop"
      role="presentation"
      data-testid="confirm-category-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal ed-textbaustein-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-confirm-category-title"
        data-testid="confirm-category-modal"
      >
        <header className="modal-header">
          <h2 id="ed-confirm-category-title">{heading}</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Schließen"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="modal-body ed-textbaustein-form">
          {isEdit ? (
            <>
              <p className="ed-delete-textbaustein-copy">
                Bist du sicher? „{action.name}“ wird umbenannt. Titel von
                Textbausteinen mit diesem Präfix werden angepasst.
              </p>
              <label className="ed-field">
                <span>Neuer Name</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  maxLength={maxNameLength}
                  disabled={busy}
                  data-testid="confirm-category-name"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleConfirm();
                    }
                  }}
                />
              </label>
            </>
          ) : (
            <p className="ed-delete-textbaustein-copy">
              Bist du sicher? Die Kategorie „{action.name}“ wird entfernt. Bei
              Textbausteinen wird das Präfix aus dem Titel gestrichen.
            </p>
          )}
          {error && (
            <p className="ed-textbaustein-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn-primary${isEdit ? "" : " ed-btn-danger"}`}
            disabled={busy}
            data-testid="confirm-category-submit"
            onClick={() => void handleConfirm()}
          >
            {busy
              ? isEdit
                ? "Umbenennen…"
                : "Entfernen…"
              : isEdit
                ? "Umbenennen"
                : "Entfernen"}
          </button>
        </footer>
      </div>
    </div>
  );
}
