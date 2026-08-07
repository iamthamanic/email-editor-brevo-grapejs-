/**
 * Canvas toolbar: formatting + Blöcke/Variablen (HVAI-like icon chrome).
 * Rich-text actions go only through RichTextController → GrapesJS RTE.
 * Location: apps/editor/src/templates/EditorToolbar.tsx
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  EMAIL_COMPONENTS,
  footerSectionContent,
  headerSectionContent,
  socialSectionContent,
  type EmailComponentDef,
} from "@email-template/email-components";
import {
  getRichTextController,
  IDLE_RICH_TEXT_STATE,
  type Editor,
  type RichTextFormatState,
} from "@email-template/editor-core";
import { VariablePicker } from "../variables/VariablePicker";
import { SavedSectionsMenu } from "./SavedSectionsMenu";
import {
  IconAlignCenter,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignRight,
  IconBlocks,
  IconBold,
  IconChevronDown,
  IconClearFormat,
  IconCode,
  IconColorText,
  IconDesktop,
  IconImage,
  IconItalic,
  IconLink,
  IconList,
  IconListOrdered,
  IconMobile,
  IconPencil,
  IconQuote,
  IconRedo,
  IconStrike,
  IconUnderline,
  IconUndo,
  IconVariable,
} from "./icons";

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleCode: () => void;
  codeOpen: boolean;
}

type OpenMenu = "blocks" | "variables" | "saved" | null;
type Device = "Desktop" | "Mobile";

const CATEGORY_ORDER = ["content", "sections", "layout", "corporate"] as const;

type BlockGroup = {
  category: (typeof CATEGORY_ORDER)[number];
  label: string;
  items: EmailComponentDef[];
};

function filterBlocks(query: string): BlockGroup[] {
  const q = query.trim().toLowerCase();
  const groups: BlockGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = EMAIL_COMPONENTS.filter((c) => {
      if (c.category !== category) return false;
      if (!q) return true;
      const hay = `${c.label} ${c.categoryLabel} ${c.type}`.toLowerCase();
      return hay.includes(q);
    });
    if (items.length === 0) continue;
    groups.push({
      category,
      label: items[0]?.categoryLabel ?? category,
      items: [...items],
    });
  }
  return groups;
}

function insertImage(editor: Editor) {
  const url = window.prompt("Bild-URL", "https://");
  if (!url?.trim()) return;
  editor.addComponents({
    type: "email-image",
    attributes: { src: url.trim(), alt: "Bild" },
  });
}

function blockContent(type: string): object {
  if (type === "email-section-header") return headerSectionContent();
  if (type === "email-section-footer") return footerSectionContent();
  if (type === "email-section-social") return socialSectionContent();
  if (type === "email-section") {
    return {
      type: "email-section",
      sectionRole: "content",
      attributes: { "data-role": "content", "data-section-role": "content" },
    };
  }
  if (type === "email-columns-1") {
    return {
      type: "email-section",
      sectionRole: "content",
      components: [
        {
          type: "email-row",
          components: [
            {
              type: "email-column",
              components: [{ type: "email-text", content: "Spalte" }],
            },
          ],
        },
      ],
    };
  }
  if (type === "email-columns-2" || type === "email-columns-3") {
    const n = type === "email-columns-2" ? 2 : 3;
    const w = Math.floor(100 / n);
    return {
      type: "email-section",
      sectionRole: "content",
      components: [
        {
          type: "email-row",
          components: Array.from({ length: n }, () => ({
            type: "email-column",
            columnWidth: w,
            attributes: { width: `${w}%` },
            components: [{ type: "email-text", content: "Spalte" }],
          })),
        },
      ],
    };
  }
  return { type };
}

function insertBlock(editor: Editor, type: string) {
  const content = blockContent(type);
  const selected = editor.getSelected();
  let target = selected;
  while (target && !target.get("droppable")) {
    target = target.parent();
  }
  // Sections always go to root
  const isSection =
    type.startsWith("email-section") ||
    type.startsWith("email-columns");
  if (isSection || !target?.get("droppable")) {
    editor.addComponents(content);
    return;
  }
  target.append(content);
}

/** Keep canvas selection when clicking host-chrome toolbar controls. */
function preserveSelection(e: {
  preventDefault: () => void;
  stopPropagation: () => void;
}) {
  // preventDefault: do not move focus out of the canvas iframe selection
  // stopPropagation: GrapesJS treats host mousedown as "click outside" → rte:disable
  e.preventDefault();
  e.stopPropagation();
}

function ToolbarSep() {
  return <span className="ed-tb-sep" aria-hidden />;
}

function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="ed-tb-group">{children}</div>;
}

function ToolbarBtn({
  title,
  onClick,
  disabled,
  active,
  children,
  testId,
  label,
  preserveRteSelection,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
  testId?: string;
  label?: string;
  /** Format actions: prevent focus steal from canvas RTE. */
  preserveRteSelection?: boolean;
}) {
  return (
    <button
      type="button"
      className={`ed-tb-btn${active ? " is-active" : ""}${label ? " ed-tb-btn--label" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onMouseDown={preserveRteSelection ? preserveSelection : undefined}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
      {label ? <span className="ed-tb-btn-text">{label}</span> : null}
    </button>
  );
}

export function EditorToolbar({
  editor,
  onToggleCode,
  codeOpen,
}: EditorToolbarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [blockQuery, setBlockQuery] = useState("");
  const [varQuery, setVarQuery] = useState("");
  const [device, setDevice] = useState<Device>("Desktop");
  const [rt, setRt] = useState<RichTextFormatState>(IDLE_RICH_TEXT_STATE);

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const um = editor.UndoManager;
      setCanUndo(um.hasUndo());
      setCanRedo(um.hasRedo());
    };
    sync();
    editor.on("update", sync);
    editor.on("change:changesCount", sync);
    return () => {
      editor.off("update", sync);
      editor.off("change:changesCount", sync);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      setRt(IDLE_RICH_TEXT_STATE);
      return;
    }
    const ctrl = getRichTextController(editor);
    if (!ctrl) {
      setRt(IDLE_RICH_TEXT_STATE);
      return;
    }
    return ctrl.subscribe(setRt);
  }, [editor]);

  useEffect(() => {
    if (!openMenu) return;

    function onPointerDown(e: MouseEvent) {
      const root = rootRef.current;
      if (!root?.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const disabled = !editor;
  const rteOff = disabled || !rt.active;
  const blockGroups = filterBlocks(blockQuery);
  const ctrl = editor ? getRichTextController(editor) : null;

  function toggleMenu(menu: Exclude<OpenMenu, null>) {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }

  function setEditorDevice(next: Device) {
    setDevice(next);
    editor?.setDevice(next);
  }

  function runRt(arg: Parameters<NonNullable<typeof ctrl>["run"]>[0]) {
    ctrl?.run(arg);
  }

  return (
    <div
      className="ed-toolbar"
      data-testid="editor-toolbar"
      role="toolbar"
      aria-label="Editor-Aktionen"
      ref={rootRef}
    >
      <div className="ed-toolbar-row">
        <ToolbarGroup>
          <ToolbarBtn
            title="Rückgängig"
            disabled={disabled || !canUndo}
            onClick={() => editor?.runCommand("core:undo")}
          >
            <IconUndo />
          </ToolbarBtn>
          <ToolbarBtn
            title="Wiederholen"
            disabled={disabled || !canRedo}
            onClick={() => editor?.runCommand("core:redo")}
          >
            <IconRedo />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        <ToolbarGroup>
          <select
            className="ed-tb-select"
            aria-label="Absatzstil"
            data-testid="toolbar-block-type"
            disabled={rteOff}
            value={rt.blockType}
            onMouseDown={preserveSelection}
            onChange={(e) => {
              const tag = e.target.value as RichTextFormatState["blockType"];
              runRt({ type: "block", tag });
            }}
          >
            <option value="p">Absatz</option>
            <option value="h1">Überschrift 1</option>
            <option value="h2">Überschrift 2</option>
            <option value="h3">Überschrift 3</option>
            <option value="h4">Überschrift 4</option>
          </select>
        </ToolbarGroup>

        <ToolbarSep />

        <ToolbarGroup>
          <ToolbarBtn
            title="Fett"
            testId="toolbar-bold"
            disabled={rteOff}
            active={rt.bold}
            preserveRteSelection
            onClick={() => runRt("bold")}
          >
            <IconBold />
          </ToolbarBtn>
          <ToolbarBtn
            title="Kursiv"
            testId="toolbar-italic"
            disabled={rteOff}
            active={rt.italic}
            preserveRteSelection
            onClick={() => runRt("italic")}
          >
            <IconItalic />
          </ToolbarBtn>
          <ToolbarBtn
            title="Unterstrichen"
            testId="toolbar-underline"
            disabled={rteOff}
            active={rt.underline}
            preserveRteSelection
            onClick={() => runRt("underline")}
          >
            <IconUnderline />
          </ToolbarBtn>
          <ToolbarBtn
            title="Durchgestrichen"
            testId="toolbar-strike"
            disabled={rteOff}
            active={rt.strike}
            preserveRteSelection
            onClick={() => runRt("strikethrough")}
          >
            <IconStrike />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        <ToolbarGroup>
          <ToolbarBtn
            title="Aufzählung"
            testId="toolbar-ul"
            disabled={rteOff}
            active={rt.unorderedList}
            preserveRteSelection
            onClick={() => runRt("insertUnorderedList")}
          >
            <IconList />
          </ToolbarBtn>
          <ToolbarBtn
            title="Nummerierung"
            testId="toolbar-ol"
            disabled={rteOff}
            active={rt.orderedList}
            preserveRteSelection
            onClick={() => runRt("insertOrderedList")}
          >
            <IconListOrdered />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        <ToolbarGroup>
          <ToolbarBtn
            title="Linksbündig"
            testId="toolbar-align-left"
            disabled={rteOff}
            active={rt.alignment === "left"}
            preserveRteSelection
            onClick={() => runRt("justifyLeft")}
          >
            <IconAlignLeft />
          </ToolbarBtn>
          <ToolbarBtn
            title="Zentriert"
            testId="toolbar-align-center"
            disabled={rteOff}
            active={rt.alignment === "center"}
            preserveRteSelection
            onClick={() => runRt("justifyCenter")}
          >
            <IconAlignCenter />
          </ToolbarBtn>
          <ToolbarBtn
            title="Rechtsbündig"
            testId="toolbar-align-right"
            disabled={rteOff}
            active={rt.alignment === "right"}
            preserveRteSelection
            onClick={() => runRt("justifyRight")}
          >
            <IconAlignRight />
          </ToolbarBtn>
          <ToolbarBtn
            title="Blocksatz"
            testId="toolbar-align-justify"
            disabled={rteOff}
            active={rt.alignment === "justify"}
            preserveRteSelection
            onClick={() => runRt("justifyFull")}
          >
            <IconAlignJustify />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        <ToolbarGroup>
          <ToolbarBtn
            title={
              rt.linkActive
                ? "Link bearbeiten / entfernen"
                : "Link einfügen"
            }
            testId="toolbar-link"
            disabled={rteOff}
            active={rt.linkActive}
            preserveRteSelection
            onClick={() => runRt("link")}
          >
            <IconLink />
          </ToolbarBtn>
          <ToolbarBtn
            title="Bildblock einfügen"
            testId="toolbar-image"
            disabled={disabled}
            onClick={() => editor && insertImage(editor)}
          >
            <IconImage />
          </ToolbarBtn>
          <ToolbarBtn
            title="Zitat"
            testId="toolbar-quote"
            disabled={rteOff}
            preserveRteSelection
            onClick={() => runRt("quote")}
          >
            <IconQuote />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        <ToolbarGroup>
          <label
            className="ed-tb-color"
            title="Textfarbe"
            onMouseDown={preserveSelection}
          >
            <span className="ed-tb-color-icon" aria-hidden>
              <IconColorText />
            </span>
            <span className="sr-only">Textfarbe</span>
            <input
              type="color"
              defaultValue="#171717"
              disabled={rteOff}
              data-testid="toolbar-color"
              onMouseDown={preserveSelection}
              onChange={(e) => {
                runRt({ type: "foreColor", color: e.target.value });
              }}
            />
          </label>
          <ToolbarBtn
            title="Formatierung entfernen"
            testId="toolbar-clear-format"
            disabled={rteOff}
            preserveRteSelection
            onClick={() => runRt("removeFormat")}
          >
            <IconClearFormat />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        <ToolbarGroup>
          <div className="ed-tb-menu">
            <button
              type="button"
              className={`ed-tb-menu-btn${openMenu === "blocks" ? " is-open" : ""}`}
              aria-expanded={openMenu === "blocks"}
              aria-haspopup="dialog"
              disabled={disabled}
              data-testid="toolbar-blocks-btn"
              onClick={() => toggleMenu("blocks")}
            >
              <IconBlocks size={15} />
              <span>Blöcke</span>
              <IconChevronDown />
            </button>
            {openMenu === "blocks" && (
              <div
                className="ed-tb-dropdown"
                role="dialog"
                aria-label="Blöcke"
                data-testid="toolbar-blocks-menu"
              >
                <label className="ed-tb-search">
                  <span className="sr-only">Blöcke suchen</span>
                  <input
                    type="search"
                    value={blockQuery}
                    onChange={(e) => setBlockQuery(e.target.value)}
                    placeholder="Blöcke suchen…"
                    autoComplete="off"
                    autoFocus
                  />
                </label>
                <div className="ed-tb-dropdown-body">
                  {blockGroups.length === 0 ? (
                    <p className="muted ed-tb-empty">Keine Treffer</p>
                  ) : (
                    blockGroups.map((group) => (
                      <section key={group.category} className="ed-tb-group-panel">
                        <h3 className="ed-tb-group-label">{group.label}</h3>
                        <ul className="ed-tb-list">
                          {group.items.map((item) => (
                            <li key={item.type}>
                              <button
                                type="button"
                                className="ed-tb-item"
                                data-block-type={item.type}
                                onClick={() => {
                                  if (!editor) return;
                                  insertBlock(editor, item.type);
                                  setOpenMenu(null);
                                  setBlockQuery("");
                                }}
                              >
                                {item.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="ed-tb-menu">
            <button
              type="button"
              className={`ed-tb-menu-btn${openMenu === "variables" ? " is-open" : ""}`}
              aria-expanded={openMenu === "variables"}
              aria-haspopup="dialog"
              disabled={disabled}
              data-testid="toolbar-variables-btn"
              onClick={() => toggleMenu("variables")}
            >
              <IconVariable size={18} />
              <span>Variablen</span>
              <IconChevronDown />
            </button>
            {openMenu === "variables" && (
              <div
                className="ed-tb-dropdown ed-tb-dropdown--vars"
                role="dialog"
                aria-label="Variablen"
                data-testid="toolbar-variables-menu"
              >
                <label className="ed-tb-search">
                  <span className="sr-only">Variablen suchen</span>
                  <input
                    type="search"
                    value={varQuery}
                    onChange={(e) => setVarQuery(e.target.value)}
                    placeholder="Variablen suchen…"
                    autoComplete="off"
                    autoFocus
                  />
                </label>
                <div className="ed-tb-dropdown-body">
                  <VariablePicker
                    editor={editor}
                    filterQuery={varQuery}
                    embedded
                    onAfterPick={() => {
                      setOpenMenu(null);
                      setVarQuery("");
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <SavedSectionsMenu
            editor={editor}
            open={openMenu === "saved"}
            onToggle={() => toggleMenu("saved")}
            onClose={() => setOpenMenu(null)}
          />
        </ToolbarGroup>

        <ToolbarSep />

        <div className="ed-tb-segment" role="group" aria-label="Ansicht">
          <ToolbarBtn
            title="Visuell bearbeiten"
            active={!codeOpen}
            disabled={disabled}
            onClick={() => {
              if (codeOpen) onToggleCode();
            }}
            label="Visual"
          >
            <IconPencil />
          </ToolbarBtn>
          <ToolbarBtn
            title="HTML-Quellcode"
            active={codeOpen}
            disabled={disabled}
            onClick={() => {
              if (!codeOpen) onToggleCode();
            }}
            label="HTML"
          >
            <IconCode />
          </ToolbarBtn>
        </div>

        <ToolbarSep />

        <div className="ed-tb-segment" role="group" aria-label="Gerätevorschau">
          <ToolbarBtn
            title="Desktop-Ansicht"
            active={device === "Desktop"}
            disabled={disabled}
            onClick={() => setEditorDevice("Desktop")}
            label="Desktop"
          >
            <IconDesktop />
          </ToolbarBtn>
          <ToolbarBtn
            title="Mobile Ansicht"
            active={device === "Mobile"}
            disabled={disabled}
            onClick={() => setEditorDevice("Mobile")}
            label="Mobil"
          >
            <IconMobile />
          </ToolbarBtn>
        </div>
      </div>
    </div>
  );
}
