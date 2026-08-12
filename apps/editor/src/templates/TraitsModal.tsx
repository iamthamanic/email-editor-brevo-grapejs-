/**
 * Traits (Eigenschaften) as modal — GrapesJS Trait Manager mount point.
 * Location: apps/editor/src/templates/TraitsModal.tsx
 */

import { useEffect, type RefObject } from "react";

interface TraitsModalProps {
  open: boolean;
  onClose: () => void;
  traitsRef: RefObject<HTMLDivElement | null>;
}

export function TraitsModal({ open, onClose, traitsRef }: TraitsModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`modal-backdrop${open ? " is-open" : ""}`}
      role="presentation"
      aria-hidden={!open}
      // Keep mounted for GrapesJS TraitManager; hide with CSS (not [hidden])
      // so custom trait views still update while closed.
      style={{ display: open ? undefined : "none" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal ed-traits-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-traits-title"
        data-testid="traits-modal"
      >
        <header className="modal-header">
          <h2 id="ed-traits-title">Eigenschaften</h2>
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
          <div
            ref={traitsRef}
            className="ed-traits"
            data-testid="traits-panel"
          />
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Schließen
          </button>
        </footer>
      </div>
    </div>
  );
}
