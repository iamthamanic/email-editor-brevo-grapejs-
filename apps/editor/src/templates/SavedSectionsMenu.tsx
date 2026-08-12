/**
 * Saved Textbausteine library — snippets drop into columns, not new sections.
 * Location: apps/editor/src/templates/SavedSectionsMenu.tsx
 */

import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { Editor } from "@email-template/editor-core";
import type { Component } from "grapesjs";
import type { SavedEmailSectionDto } from "@email-template/email-schema";
import {
  createSavedSection,
  deleteSavedSection,
  fetchSavedSections,
  harvestTextbausteine,
  patchSavedSection,
} from "../api/savedSectionsApi";
import {
  findContentColumnTarget,
  endEditorDrag,
  startEditorDrag,
} from "./canvasInsert";
import { DeleteTextbausteinModal } from "./DeleteTextbausteinModal";
import { IconChevronDown, IconEdit, IconTrash } from "./icons";
import {
  NewTextbausteinModal,
  rewriteCategoryPrefix,
  type TextbausteinFormInput,
} from "./NewTextbausteinModal";
import {
  ParamTextPreview,
  firstSentenceOf,
  hasMoreAfterFirstSentence,
} from "./ParamTextPreview";
import {
  plainTextFromSectionData,
  textToEmailHtml,
} from "./textbausteinHtml";

interface SavedSectionsMenuProps {
  editor: Editor | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** Prevent Grapes treating toolbar mousedown as click-outside → rte:disable */
  preserveSelection?: (e: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => void;
}

const SNIPPET_TYPES = new Set([
  "email-text",
  "email-heading",
  "email-image",
  "email-button",
  "email-divider",
  "email-spacer",
  "email-legacy-html",
]);

/** Store as email-text snippet (drops into a column). */
function buildTextbausteinData(
  title: string,
  text: string,
): Record<string, unknown> {
  return {
    type: "email-text",
    name: title,
    attributes: {
      "data-email-type": "email-text",
      "data-textbaustein-title": title,
    },
    content: textToEmailHtml(text),
  };
}

function retitleSectionData(
  data: Record<string, unknown>,
  title: string,
): Record<string, unknown> {
  const attrs = {
    ...((data.attributes as Record<string, unknown>) ?? {}),
    "data-textbaustein-title": title,
  };
  return { ...data, name: title, attributes: attrs };
}

/** Flatten name + nested text/content for full-text search. */
function searchableBlob(section: SavedEmailSectionDto): string {
  const parts: string[] = [section.name, section.role];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    const o = node as Record<string, unknown>;
    if (typeof o.content === "string") parts.push(o.content);
    if (typeof o.name === "string") parts.push(o.name);
    for (const v of Object.values(o)) walk(v);
  };
  walk(section.sectionData);
  return parts.join("\n").toLowerCase();
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
  return {
    ...data,
    attributes: attrs,
    name: data.name ?? section.name,
  };
}

/**
 * Normalize stored snapshot → content block(s) for column insert.
 * Legacy full email-section masters are unwrapped to their leaf content blocks.
 */
function toInsertableBlocks(
  data: Record<string, unknown>,
): Record<string, unknown>[] {
  const type = String(data.type ?? "");
  if (SNIPPET_TYPES.has(type)) return [data];

  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    const o = node as Record<string, unknown>;
    const t = String(o.type ?? "");
    if (SNIPPET_TYPES.has(t)) {
      found.push(o);
      return;
    }
    walk(o.components);
  };
  walk(data);
  return found.length > 0 ? found : [data];
}

function findColumnTarget(editor: Editor): Component | null {
  return findContentColumnTarget(editor);
}

function plainTextFromComponent(comp: Component): string {
  const el = comp.getEl?.();
  if (el?.innerText) return el.innerText.trim();
  const json = comp.toJSON() as Record<string, unknown>;
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    const o = node as Record<string, unknown>;
    if (typeof o.content === "string") {
      parts.push(o.content.replace(/<[^>]+>/g, " "));
    }
    walk(o.components);
  };
  walk(json);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function snippetFromSelected(editor: Editor): {
  name: string;
  data: Record<string, unknown>;
} | null {
  const selected = editor.getSelected();
  if (!selected) return null;
  const type = String(selected.get("type") ?? "");

  if (type === "email-text" || type === "email-heading") {
    const raw = selected.toJSON() as Record<string, unknown>;
    const name =
      String(raw.name ?? selected.getAttributes()?.["data-textbaustein-title"] ?? "") ||
      "Textbaustein";
    return {
      name,
      data: {
        type,
        name,
        attributes: {
          "data-email-type": type,
          ...(typeof raw.attributes === "object" && raw.attributes
            ? (raw.attributes as Record<string, unknown>)
            : {}),
        },
        content:
          typeof raw.content === "string"
            ? raw.content
            : textToEmailHtml(plainTextFromComponent(selected) || " "),
      },
    };
  }

  // Section / column: take first email-text inside
  const text = selected.findType("email-text")[0];
  if (text) {
    editor.select(text);
    return snippetFromSelected(editor);
  }
  return null;
}

export function SavedSectionsMenu({
  editor,
  open,
  onToggle,
  onClose,
  preserveSelection,
}: SavedSectionsMenuProps) {
  const [items, setItems] = useState<SavedEmailSectionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SavedEmailSectionDto | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<SavedEmailSectionDto | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [harvestHint, setHarvestHint] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setQuery("");
      setExpandedIds(new Set());
      setOptionsOpen(false);
      return;
    }
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

  const filtered = useMemo(() => {
    // Client-side dedupe by content hash / searchable blob (API also cleans DB).
    const unique: SavedEmailSectionDto[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const data = item.sectionData ?? {};
      const attrs = (data.attributes ?? {}) as Record<string, unknown>;
      const hash =
        typeof attrs["data-textbaustein-hash"] === "string"
          ? attrs["data-textbaustein-hash"]
          : searchableBlob(item);
      if (seen.has(hash)) continue;
      seen.add(hash);
      unique.push(item);
    }
    const q = query.trim().toLowerCase();
    if (!q) return unique;
    return unique.filter((item) => searchableBlob(item).includes(q));
  }, [items, query]);

  async function saveCurrent() {
    if (!editor) return;
    const picked = snippetFromSelected(editor);
    if (!picked) {
      window.alert(
        "Bitte zuerst einen Textblock (oder Inhalt mit Text) auswählen.",
      );
      return;
    }
    const name = window.prompt("Name für Textbaustein", picked.name);
    if (!name?.trim()) return;
    try {
      const data = {
        ...picked.data,
        name: name.trim(),
        attributes: {
          ...((picked.data.attributes as Record<string, unknown>) ?? {}),
          "data-textbaustein-title": name.trim(),
        },
      };
      const created = await createSavedSection({
        name: name.trim(),
        role: "content",
        sectionData: data,
      });
      editor.getSelected()?.addAttributes({
        "data-saved-section-id": created.id,
        "data-saved-section-version": String(created.version),
        "data-saved-section-mode": "linked",
        "data-textbaustein-title": name.trim(),
      });
      setItems((prev) => {
        if (prev.some((i) => i.id === created.id)) return prev;
        return [...prev, created];
      });
    } catch (err: unknown) {
      window.alert(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
    }
  }

  async function createFromModal(input: TextbausteinFormInput) {
    const created = await createSavedSection({
      name: input.title,
      role: "content",
      sectionData: buildTextbausteinData(input.title, input.text),
    });
    setItems((prev) => {
      if (prev.some((i) => i.id === created.id)) return prev;
      return [...prev, created];
    });
  }

  async function saveEdit(input: TextbausteinFormInput) {
    if (!editing) return;
    const { section } = await patchSavedSection(editing.id, {
      name: input.title,
      sectionData: buildTextbausteinData(input.title, input.text),
      syncLinked: false,
    });
    setItems((prev) => prev.map((i) => (i.id === section.id ? section : i)));
    setEditing(null);
  }

  async function renameCategoryOnItems(from: string, to: string) {
    const targets = items.filter(
      (i) => rewriteCategoryPrefix(i.name, from, to) !== i.name,
    );
    if (targets.length === 0) return;
    const updated = await Promise.all(
      targets.map(async (item) => {
        const nextName =
          rewriteCategoryPrefix(item.name, from, to).trim() || to;
        const { section } = await patchSavedSection(item.id, {
          name: nextName,
          sectionData: retitleSectionData(
            (item.sectionData ?? {}) as Record<string, unknown>,
            nextName,
          ),
          syncLinked: false,
        });
        return section;
      }),
    );
    const byId = new Map(updated.map((s) => [s.id, s]));
    setItems((prev) => prev.map((i) => byId.get(i.id) ?? i));
  }

  async function removeCategoryFromItems(name: string) {
    const targets = items.filter(
      (i) => rewriteCategoryPrefix(i.name, name, null) !== i.name,
    );
    if (targets.length === 0) return;
    const updated = await Promise.all(
      targets.map(async (item) => {
        const stripped = rewriteCategoryPrefix(item.name, name, null).trim();
        // Keep a usable title if the name was only the category prefix
        const nextName = stripped || "Textbaustein";
        const { section } = await patchSavedSection(item.id, {
          name: nextName,
          sectionData: retitleSectionData(
            (item.sectionData ?? {}) as Record<string, unknown>,
            nextName,
          ),
          syncLinked: false,
        });
        return section;
      }),
    );
    const byId = new Map(updated.map((s) => [s.id, s]));
    setItems((prev) => prev.map((i) => byId.get(i.id) ?? i));
  }

  async function runHarvest() {
    setHarvesting(true);
    setHarvestHint(null);
    try {
      const result = await harvestTextbausteine();
      const rows = await fetchSavedSections();
      setItems(rows);
      setHarvestHint(
        result.created > 0
          ? `${result.created} neu hinzugefügt · ${result.skippedExisting} bereits vorhanden (unverändert)`
          : result.candidates === 0
            ? "Keine neuen Absätze in Templates gefunden"
            : `Keine neuen · ${result.skippedExisting} bereits vorhanden (nichts überschrieben)`,
      );
    } catch (err: unknown) {
      setHarvestHint(
        err instanceof Error ? err.message : "Harvest fehlgeschlagen",
      );
    } finally {
      setHarvesting(false);
    }
  }

  function insertablePayload(item: SavedEmailSectionDto): unknown {
    const blocks = toInsertableBlocks(item.sectionData).map((b) =>
      stampLinked(b, item),
    );
    return blocks.length === 1 ? blocks[0] : blocks;
  }

  function insert(item: SavedEmailSectionDto) {
    if (!editor) return;
    const payload = insertablePayload(item);

    // Prefer merging into the active text/heading host (same path as an
    // accepted canvas drop → flattenNestedTextHosts unwraps nested email-text).
    const editing = editor.getEditing?.() as
      | {
          get: (k: string) => unknown;
          append: (c: unknown) => unknown;
          components?: () => { add: (c: unknown, o?: { at?: number }) => unknown };
        }
      | undefined;
    const selected = editor.getSelected() as
      | {
          get: (k: string) => unknown;
          append: (c: unknown) => unknown;
          parent: () => unknown;
          components?: () => { add: (c: unknown, o?: { at?: number }) => unknown };
        }
      | undefined;
    const candidate = editing ?? selected;
    const candType = String(candidate?.get?.("type") ?? "");
    if (
      candidate &&
      (candType === "email-text" || candType === "email-heading")
    ) {
      const block = payload as Record<string, unknown>;
      const blockType = String(block?.type ?? "");
      // Merge snippet HTML into the host — avoid nested email-text RTE boxes.
      if (
        (blockType === "email-text" || blockType === "email-heading") &&
        typeof block.content === "string" &&
        block.content.trim() &&
        typeof candidate.components === "function"
      ) {
        candidate.components().add(block.content);
      } else {
        candidate.append(payload);
      }
      onClose();
      return;
    }

    const target = findColumnTarget(editor);
    if (!target) {
      window.alert(
        "Bitte eine Inhalt-Spalte auswählen (oder Textbaustein per Drag & Drop dort ablegen).",
      );
      return;
    }
    target.append(payload as object);
    onClose();
  }

  function onItemDragStart(e: DragEvent, item: SavedEmailSectionDto) {
    if (!editor) {
      e.preventDefault();
      return;
    }
    // Drag email-text (or content blocks) so columns accept the drop
    startEditorDrag(editor, insertablePayload(item), "leaf", {
      dropHeightHint: 80,
    });
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", item.name);
  }

  function onItemDragEnd() {
    if (editor) endEditorDrag(editor);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteSavedSection(pendingDelete.id);
    setItems((prev) => prev.filter((i) => i.id !== pendingDelete.id));
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderRow(item: SavedEmailSectionDto, dragTitle: string) {
    const plain = plainTextFromSectionData(item.sectionData);
    const first = firstSentenceOf(plain);
    const canExpand = hasMoreAfterFirstSentence(plain);
    const expanded = expandedIds.has(item.id);
    const previewText = expanded ? plain : first;

    return (
      <li
        key={item.id}
        className={`ed-tb-saved-row${expanded ? " is-expanded" : ""}`}
      >
        <div className="ed-tb-saved-main">
          <button
            type="button"
            className="ed-tb-item ed-tb-item--drag"
            draggable={Boolean(editor)}
            data-testid={`saved-section-${item.id}`}
            title={dragTitle}
            onClick={() => insert(item)}
            onDragStart={(e) => onItemDragStart(e, item)}
            onDragEnd={onItemDragEnd}
          >
            <span className="ed-tb-item-label" title={item.name}>
              {item.name}
            </span>
            {previewText ? (
              <ParamTextPreview
                text={previewText}
                className={`ed-tb-item-meta${expanded ? " is-expanded" : ""}`}
              />
            ) : null}
          </button>
          {canExpand ? (
            <button
              type="button"
              className="ed-tb-item-expand"
              data-testid={`saved-section-expand-${item.id}`}
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.id);
              }}
            >
              <IconChevronDown
                className={
                  expanded
                    ? "ed-tb-item-expand-icon is-open"
                    : "ed-tb-item-expand-icon"
                }
              />
              <span>{expanded ? "Weniger" : "Gesamten Text anzeigen"}</span>
            </button>
          ) : null}
        </div>
        <div className="ed-tb-saved-actions">
          <button
            type="button"
            className="ed-tb-item-action"
            data-testid={`saved-section-edit-${item.id}`}
            aria-label={`Textbaustein „${item.name}“ bearbeiten`}
            title="Bearbeiten"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(item);
            }}
          >
            <IconEdit />
          </button>
          <button
            type="button"
            className="ed-tb-item-action ed-tb-item-action--danger"
            data-testid={`saved-section-delete-${item.id}`}
            aria-label={`Textbaustein „${item.name}“ löschen`}
            title="Löschen"
            onClick={(e) => {
              e.stopPropagation();
              setPendingDelete(item);
            }}
          >
            <IconTrash />
          </button>
        </div>
      </li>
    );
  }

  // Prefer flat list for content snippets; keep legacy role groups if present
  const contentItems = filtered.filter((i) => i.role === "content");
  const otherRoles = (["header", "footer", "social"] as const).filter((role) =>
    filtered.some((i) => i.role === role),
  );

  return (
    <div className="ed-tb-menu">
      <button
        type="button"
        className={`ed-tb-menu-btn${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!editor}
        data-testid="toolbar-saved-btn"
        onMouseDown={preserveSelection}
        onClick={onToggle}
      >
        <span>Textbausteine</span>
        <IconChevronDown />
      </button>
      {open && (
        <div
          className="ed-tb-dropdown ed-tb-dropdown--saved"
          role="dialog"
          aria-label="Textbausteine"
          data-testid="toolbar-saved-menu"
        >
          <label className="ed-tb-search">
            <span className="sr-only">Textbausteine suchen</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Textbausteine suchen…"
              autoComplete="off"
              data-testid="textbaustein-search"
            />
          </label>
          <div className="ed-tb-dropdown-body">
            <div className="ed-tb-group-panel">
              <button
                type="button"
                className="btn-primary ed-tb-new-baustein"
                data-testid="saved-section-new"
                onClick={() => setCreateOpen(true)}
              >
                + Neuer Textbaustein
              </button>
              <div className="ed-tb-options">
                <button
                  type="button"
                  className={`ed-tb-options-btn${optionsOpen ? " is-open" : ""}`}
                  aria-expanded={optionsOpen}
                  aria-haspopup="menu"
                  data-testid="saved-section-options"
                  onClick={() => setOptionsOpen((v) => !v)}
                >
                  <span>Optionen</span>
                  <IconChevronDown />
                </button>
                {optionsOpen && (
                  <div
                    className="ed-tb-options-menu"
                    role="menu"
                    aria-label="Textbaustein-Optionen"
                    data-testid="saved-section-options-menu"
                  >
                    <button
                      type="button"
                      className="ed-tb-item"
                      role="menuitem"
                      data-testid="saved-section-save-current"
                      onClick={() => {
                        setOptionsOpen(false);
                        void saveCurrent();
                      }}
                    >
                      Auswahl als Textbaustein speichern…
                    </button>
                    <button
                      type="button"
                      className="ed-tb-item"
                      role="menuitem"
                      data-testid="saved-section-harvest"
                      disabled={harvesting}
                      title="Nur neue Absätze anlegen — bestehende Textbausteine bleiben unverändert"
                      onClick={() => void runHarvest()}
                    >
                      {harvesting
                        ? "Lade aus Templates…"
                        : "Neue aus Templates laden"}
                    </button>
                    {harvestHint && (
                      <p
                        className="muted ed-tb-empty ed-tb-options-hint"
                        data-testid="harvest-hint"
                      >
                        {harvestHint}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            {loading && <p className="muted ed-tb-empty">Laden…</p>}
            {error && <p className="muted ed-tb-empty">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <p className="muted ed-tb-empty">
                Noch keine Textbausteine. Lege einen mit „+ Neuer Textbaustein“
                an — danach in eine Inhalt-Spalte ziehen.
              </p>
            )}
            {!loading &&
              !error &&
              items.length > 0 &&
              filtered.length === 0 && (
                <p className="muted ed-tb-empty">Keine Treffer für „{query}“.</p>
              )}
            {contentItems.length > 0 && (
              <section className="ed-tb-group-panel">
                <h3 className="ed-tb-group-label">Textbausteine</h3>
                <ul className="ed-tb-list">
                  {contentItems.map((item) =>
                    renderRow(
                      item,
                      "In eine Inhalt-Spalte ziehen oder mit Klick dort einfügen",
                    ),
                  )}
                </ul>
              </section>
            )}
            {otherRoles.map((role) => {
              const group = filtered.filter((i) => i.role === role);
              if (group.length === 0) return null;
              const title =
                role === "header"
                  ? "Header (Alt)"
                  : role === "footer"
                    ? "Footer (Alt)"
                    : "Social (Alt)";
              return (
                <section key={role} className="ed-tb-group-panel">
                  <h3 className="ed-tb-group-label">{title}</h3>
                  <ul className="ed-tb-list">
                    {group.map((item) =>
                      renderRow(
                        item,
                        "Inhalt in Spalte einfügen (aus altem Bereich extrahiert)",
                      ),
                    )}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
      <NewTextbausteinModal
        open={createOpen}
        mode="create"
        knownTitles={items.map((i) => i.name)}
        onRenameCategory={renameCategoryOnItems}
        onRemoveCategory={removeCategoryFromItems}
        onClose={() => setCreateOpen(false)}
        onSubmit={createFromModal}
      />
      <NewTextbausteinModal
        open={Boolean(editing)}
        mode="edit"
        knownTitles={items.map((i) => i.name)}
        onRenameCategory={renameCategoryOnItems}
        onRemoveCategory={removeCategoryFromItems}
        initial={
          editing
            ? {
                title: editing.name,
                text: plainTextFromSectionData(editing.sectionData),
              }
            : null
        }
        onClose={() => setEditing(null)}
        onSubmit={saveEdit}
      />
      <DeleteTextbausteinModal
        open={Boolean(pendingDelete)}
        name={pendingDelete?.name ?? ""}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
