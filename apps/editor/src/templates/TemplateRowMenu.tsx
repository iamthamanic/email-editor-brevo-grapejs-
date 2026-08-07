/**
 * Row overflow menu (⋯): Bearbeiten, Informationen, Löschen.
 * Renders the dropdown via portal + fixed coords so table overflow cannot clip it.
 * Location: apps/editor/src/templates/TemplateRowMenu.tsx
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import type { EmailTemplateListItem } from "@email-template/email-schema";
import { IconDots, IconEdit, IconInfo, IconTrash } from "./icons";

const MENU_WIDTH = 180;
const MENU_EST_HEIGHT = 140;

interface TemplateRowMenuProps {
  item: EmailTemplateListItem;
  deleting: boolean;
  onDelete: (item: EmailTemplateListItem) => void;
  onOpenInfo: (item: EmailTemplateListItem) => void;
}

interface MenuCoords {
  top: number;
  left: number;
}

function placeMenu(trigger: HTMLElement): MenuCoords {
  const r = trigger.getBoundingClientRect();
  let left = r.right - MENU_WIDTH;
  let top = r.bottom + 4;
  const maxLeft = window.innerWidth - MENU_WIDTH - 8;
  if (left > maxLeft) left = Math.max(8, maxLeft);
  if (left < 8) left = 8;
  if (top + MENU_EST_HEIGHT > window.innerHeight - 8) {
    top = Math.max(8, r.top - MENU_EST_HEIGHT - 4);
  }
  return { top, left };
}

export function TemplateRowMenu({
  item,
  deleting,
  onDelete,
  onOpenInfo,
}: TemplateRowMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return;
    }
    function update() {
      if (!triggerRef.current) return;
      setCoords(placeMenu(triggerRef.current));
    }
    update();
    window.addEventListener("resize", update);
    // capture scroll from table wrap / ancestors
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
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

  return (
    <div className="tpl-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`tpl-menu-trigger${open ? " is-open" : ""}`}
        aria-label={`Aktionen für ${item.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="template-row-menu"
        disabled={deleting}
        onClick={() => setOpen((v) => !v)}
      >
        <IconDots />
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            className="tpl-menu-dropdown"
            role="menu"
            data-testid="template-row-menu-panel"
            style={{ top: coords.top, left: coords.left }}
          >
            <button
              type="button"
              role="menuitem"
              className="tpl-menu-item"
              data-testid="template-row-edit"
              onClick={() => {
                setOpen(false);
                navigate(`/templates/${item.id}`);
              }}
            >
              <IconEdit />
              Bearbeiten
            </button>
            <button
              type="button"
              role="menuitem"
              className="tpl-menu-item"
              data-testid="template-row-info"
              onClick={() => {
                setOpen(false);
                onOpenInfo(item);
              }}
            >
              <IconInfo />
              Informationen
            </button>
            <button
              type="button"
              role="menuitem"
              className="tpl-menu-item is-danger"
              data-testid="template-row-delete"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                onDelete(item);
              }}
            >
              <IconTrash />
              Löschen
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
