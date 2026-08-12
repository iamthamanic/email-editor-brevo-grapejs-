/**
 * Confirm deletion of a saved Textbaustein.
 * Location: apps/editor/src/templates/DeleteTextbausteinModal.tsx
 */

import { useEffect, useRef, useState } from "react";

interface DeleteTextbausteinModalProps {
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteTextbausteinModal({
  open,
  name,
  onClose,
  onConfirm,
}: DeleteTextbausteinModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDeleting(false);
    setError(null);
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, deleting]);

  if (!open) return null;

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen",
      );
      setDeleting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      data-testid="delete-textbaustein-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div
        className="modal ed-textbaustein-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-delete-textbaustein-title"
        data-testid="delete-textbaustein-modal"
      >
        <header className="modal-header">
          <h2 id="ed-delete-textbaustein-title">Textbaustein löschen?</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Schließen"
            disabled={deleting}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="modal-body ed-textbaustein-form">
          <p className="ed-delete-textbaustein-copy">
            „{name}“ wird dauerhaft aus der Bibliothek entfernt. In Templates
            bereits eingefügte Kopien bleiben bestehen.
          </p>
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
            disabled={deleting}
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary ed-btn-danger"
            disabled={deleting}
            data-testid="delete-textbaustein-confirm"
            onClick={() => void handleConfirm()}
          >
            {deleting ? "Löschen…" : "Löschen"}
          </button>
        </footer>
      </div>
    </div>
  );
}
