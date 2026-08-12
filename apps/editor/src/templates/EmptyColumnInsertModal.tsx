/**
 * Choose Text or Bild when clicking an empty layout dropzone.
 * Location: apps/editor/src/templates/EmptyColumnInsertModal.tsx
 */

import { useEffect } from "react";
import type { EmptyColumnInsertKind } from "./emptyColumnInsert";

interface EmptyColumnInsertModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (kind: EmptyColumnInsertKind) => void;
}

export function EmptyColumnInsertModal({
  open,
  onClose,
  onPick,
}: EmptyColumnInsertModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop is-open"
      role="presentation"
      data-testid="empty-column-insert-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal ed-empty-col-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-empty-col-title"
        data-testid="empty-column-insert-modal"
      >
        <header className="modal-header">
          <h2 id="ed-empty-col-title">Inhalt einfügen</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Schließen"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="modal-body">
          <p className="ed-empty-col-hint">
            Was soll in diese Spalte? Du kannst später weitere Blöcke per Drag &amp;
            Drop ergänzen.
          </p>
          <div className="ed-empty-col-choices">
            <button
              type="button"
              className="ed-empty-col-choice"
              data-testid="empty-column-insert-text"
              onClick={() => onPick("text")}
            >
              <span className="ed-empty-col-choice-label">Text</span>
              <span className="ed-empty-col-choice-sub">Absatz einfügen</span>
            </button>
            <button
              type="button"
              className="ed-empty-col-choice"
              data-testid="empty-column-insert-image"
              onClick={() => onPick("image")}
            >
              <span className="ed-empty-col-choice-label">Bild</span>
              <span className="ed-empty-col-choice-sub">Bildblock einfügen</span>
            </button>
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
        </footer>
      </div>
    </div>
  );
}
