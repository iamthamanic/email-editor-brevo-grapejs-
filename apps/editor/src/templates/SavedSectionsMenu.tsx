/**
 * Saved sections library dropdown — insert linked snapshots into the canvas.
 * Location: apps/editor/src/templates/SavedSectionsMenu.tsx
 */

import { useEffect, useState } from "react";
import type { Editor } from "@email-template/editor-core";
import type {
  SavedEmailSectionDto,
  SavedSectionRole,
} from "@email-template/email-schema";
import {
  createSavedSection,
  fetchSavedSections,
} from "../api/savedSectionsApi";
import { IconChevronDown } from "./icons";

interface SavedSectionsMenuProps {
  editor: Editor | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function stampLinked(
  data: Record<string, unknown>,
  section: SavedEmailSectionDto,
): Record<string, unknown> {
  const attrs = {
    ...((data.attributes as Record<string, unknown>) ?? {}),
    "data-saved-section-id": section.id,
    "data-saved-section-version": String(section.version),
    "data-saved-section-mode": "linked",
  };
  return { ...data, attributes: attrs };
}

function detachSelectedSection(editor: Editor): void {
  const selected = editor.getSelected();
  if (!selected || selected.get("type") !== "email-section") return;
  const attrs = selected.getAttributes() ?? {};
  if (attrs["data-saved-section-mode"] !== "linked") return;
  selected.addAttributes({ "data-saved-section-mode": "detached" });
}

function sectionJsonFromSelected(editor: Editor): {
  role: SavedSectionRole;
  data: Record<string, unknown>;
} | null {
  const selected = editor.getSelected();
  if (!selected || selected.get("type") !== "email-section") return null;
  const role = String(
    selected.get("sectionRole") ??
      selected.getAttributes()?.["data-role"] ??
      "content",
  ) as SavedSectionRole;
  const raw = selected.toJSON() as Record<string, unknown>;
  return { role, data: raw };
}

export function SavedSectionsMenu({
  editor,
  open,
  onToggle,
  onClose,
}: SavedSectionsMenuProps) {
  const [items, setItems] = useState<SavedEmailSectionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSavedSections()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Laden fehlgeschlagen");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function saveCurrent() {
    if (!editor) return;
    const picked = sectionJsonFromSelected(editor);
    if (!picked) {
      window.alert("Bitte zuerst eine Section (Header/Footer/Bereich) auswählen.");
      return;
    }
    const name = window.prompt("Name für gespeicherten Bereich", "Standard Bereich");
    if (!name?.trim()) return;
    try {
      const created = await createSavedSection({
        name: name.trim(),
        role: picked.role,
        sectionData: picked.data,
      });
      // Link current instance
      editor.getSelected()?.addAttributes({
        "data-saved-section-id": created.id,
        "data-saved-section-version": String(created.version),
        "data-saved-section-mode": "linked",
      });
      setItems((prev) => [...prev, created]);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
  }

  function insert(section: SavedEmailSectionDto) {
    if (!editor) return;
    editor.addComponents(stampLinked(section.sectionData, section));
    onClose();
  }

  const byRole = (role: string) => items.filter((i) => i.role === role);

  return (
    <div className="ed-tb-menu">
      <button
        type="button"
        className={`ed-tb-menu-btn${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!editor}
        data-testid="toolbar-saved-btn"
        onClick={onToggle}
      >
        <span>Textblöcke</span>
        <IconChevronDown />
      </button>
      {open && (
        <div
          className="ed-tb-dropdown"
          role="dialog"
          aria-label="Textblöcke"
          data-testid="toolbar-saved-menu"
        >
          <div className="ed-tb-dropdown-body">
            <div className="ed-tb-group-panel">
              <button
                type="button"
                className="ed-tb-item"
                data-testid="saved-section-save-current"
                onClick={() => void saveCurrent()}
              >
                Auswahl als Bereich speichern…
              </button>
              <button
                type="button"
                className="ed-tb-item"
                data-testid="saved-section-detach"
                onClick={() => {
                  if (editor) detachSelectedSection(editor);
                  onClose();
                }}
              >
                Unabhängig bearbeiten (Link lösen)
              </button>
            </div>
            {loading && <p className="muted ed-tb-empty">Laden…</p>}
            {error && <p className="muted ed-tb-empty">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <p className="muted ed-tb-empty">Noch keine gespeicherten Bereiche</p>
            )}
            {(["header", "footer", "content", "social"] as const).map((role) => {
              const group = byRole(role);
              if (group.length === 0) return null;
              const title =
                role === "header"
                  ? "Header"
                  : role === "footer"
                    ? "Footer"
                    : role === "social"
                      ? "Social Media"
                      : "Bereiche";
              return (
                <section key={role} className="ed-tb-group-panel">
                  <h3 className="ed-tb-group-label">{title}</h3>
                  <ul className="ed-tb-list">
                    {group.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="ed-tb-item"
                          data-testid={`saved-section-${item.id}`}
                          onClick={() => insert(item)}
                        >
                          {item.name} (v{item.version})
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
