/**
 * ⋯ menu next to template search: Brevo sync + create template.
 * Location: apps/editor/src/compose/ComposeTemplateMenu.tsx
 */

import { useEffect, useRef, useState } from "react";
import { IconDots } from "../templates/icons";

interface ComposeTemplateMenuProps {
  disabled?: boolean;
  syncing?: boolean;
  creating?: boolean;
  onBrevoLoad: () => void;
  onCreateTemplate: () => void;
}

export function ComposeTemplateMenu({
  disabled = false,
  syncing = false,
  creating = false,
  onBrevoLoad,
  onCreateTemplate,
}: ComposeTemplateMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const busy = disabled || syncing || creating;

  return (
    <div className="compose-template-menu" ref={rootRef}>
      <button
        type="button"
        className="compose-template-menu-trigger"
        aria-label="Template-Aktionen"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        <IconDots />
      </button>
      {open && (
        <ul className="compose-template-menu-list" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onBrevoLoad();
              }}
            >
              {syncing ? "Brevo wird geladen…" : "Von Brevo laden"}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onCreateTemplate();
              }}
            >
              {creating ? "Wird angelegt…" : "Neues Template anlegen"}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
