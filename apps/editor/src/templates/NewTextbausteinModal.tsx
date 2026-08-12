/**
 * Modal to create or edit a Textbaustein (title + plain text body).
 * Title: searchable categories (create/edit/delete + confirm); Text: param pills.
 * Location: apps/editor/src/templates/NewTextbausteinModal.tsx
 */

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  fetchVariables,
  type VariableDto,
} from "../api/variablesApi";
import { IconChevronDown, IconEdit, IconTrash } from "./icons";
import {
  ParamPillEditor,
  type ParamPillEditorHandle,
} from "./ParamPillEditor";
import {
  ConfirmCategoryModal,
  type CategoryConfirmAction,
} from "./ConfirmCategoryModal";

export interface TextbausteinFormInput {
  title: string;
  text: string;
}

interface NewTextbausteinModalProps {
  open: boolean;
  mode?: "create" | "edit";
  initial?: TextbausteinFormInput | null;
  /** Existing Textbaustein titles — used to harvest category prefixes. */
  knownTitles?: string[];
  /** Rename category prefix on all matching Textbausteine. */
  onRenameCategory?: (from: string, to: string) => Promise<void>;
  /** Strip category prefix from all matching Textbaustein titles. */
  onRemoveCategory?: (name: string) => Promise<void>;
  onClose: () => void;
  onSubmit: (input: TextbausteinFormInput) => Promise<void>;
}

/** Built-in title prefixes — selectable, then editable in the text field. */
const DEFAULT_CATEGORIES = [
  "Anrede",
  "Gruß",
  "Auftrag",
  "Genehmigung",
  "Aufstellung",
  "Rechnung",
  "Mahnung",
  "Storno",
  "Wartung",
  "Bewertung",
  "Hinweis",
  "AGB",
  "Kontakt",
  "Preis",
  "Angebot",
  "Antrag",
  "Zahlung",
  "CTA",
  "Variable",
  "Danke",
  "Willkommen",
] as const;

const CUSTOM_CATEGORIES_KEY = "ed-textbaustein-categories";
const HIDDEN_CATEGORIES_KEY = "ed-textbaustein-hidden-categories";
const MAX_CATEGORY_LEN = 40;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadStringList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= MAX_CATEGORY_LEN);
  } catch {
    return [];
  }
}

function saveStringList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore quota / private mode
  }
}

function loadCustomCategories(): string[] {
  return loadStringList(CUSTOM_CATEGORIES_KEY);
}

function saveCustomCategories(list: string[]): void {
  saveStringList(CUSTOM_CATEGORIES_KEY, list);
}

function loadHiddenCategories(): string[] {
  return loadStringList(HIDDEN_CATEGORIES_KEY);
}

function saveHiddenCategories(list: string[]): void {
  saveStringList(HIDDEN_CATEGORIES_KEY, list);
}

/** Harvest `Kategorie – …` prefixes from existing titles. */
export function harvestCategoryPrefixes(titles: string[]): string[] {
  const out = new Set<string>();
  for (const title of titles) {
    const m = /^(.+?)\s*[–-]\s+\S/.exec(title.trim());
    const prefix = m?.[1]?.trim() ?? "";
    if (prefix && prefix.length <= MAX_CATEGORY_LEN) out.add(prefix);
  }
  return [...out];
}

/** Rewrite or strip a category prefix on a title. */
export function rewriteCategoryPrefix(
  title: string,
  from: string,
  to: string | null,
): string {
  const re = new RegExp(
    `^${escapeRegExp(from)}\\s*[–-]\\s*(.*)$`,
    "i",
  );
  const m = re.exec(title.trim());
  if (!m) return title;
  const rest = (m[1] ?? "").trim();
  if (to === null) return rest;
  return rest ? `${to} – ${rest}` : `${to} – `;
}

function isHidden(name: string, hidden: string[]): boolean {
  const key = name.toLowerCase();
  return hidden.some((h) => h.toLowerCase() === key);
}

function mergeCategories(
  custom: string[],
  harvested: string[],
  hidden: string[],
  current?: string,
): string[] {
  const byLower = new Map<string, string>();
  for (const c of DEFAULT_CATEGORIES) {
    if (!isHidden(c, hidden)) byLower.set(c.toLowerCase(), c);
  }
  for (const c of [...custom, ...harvested]) {
    if (isHidden(c, hidden)) continue;
    const key = c.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, c);
  }
  if (current?.trim() && !isHidden(current, hidden)) {
    const key = current.trim().toLowerCase();
    if (!byLower.has(key)) byLower.set(key, current.trim());
  }
  const defaults = new Set(
    DEFAULT_CATEGORIES.map((c) => c.toLowerCase()),
  );
  const extras = [...byLower.values()]
    .filter((c) => !defaults.has(c.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "de"));
  const visibleDefaults = DEFAULT_CATEGORIES.filter(
    (c) => !isHidden(c, hidden),
  );
  return [...visibleDefaults, ...extras];
}

function categoryFromTitle(title: string, categories: string[]): string {
  const trimmed = title.trim();
  const sorted = [...categories].sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    const re = new RegExp(
      `^${escapeRegExp(c)}\\s*[–-]\\s*(.*)$`,
      "i",
    );
    if (re.test(trimmed)) {
      return (
        categories.find((x) => x.toLowerCase() === c.toLowerCase()) ?? c
      );
    }
  }
  return "";
}

function applyCategory(
  current: string,
  category: string,
  categories: string[],
): string {
  const trimmed = current.trim();
  const existing = categoryFromTitle(trimmed, categories);
  let rest = trimmed;
  if (existing) {
    const m = new RegExp(
      `^${escapeRegExp(existing)}\\s*[–-]\\s*(.*)$`,
      "i",
    ).exec(trimmed);
    rest = (m?.[1] ?? "").trim();
  }
  return rest ? `${category} – ${rest}` : `${category} – `;
}

export function NewTextbausteinModal({
  open,
  mode = "create",
  initial = null,
  knownTitles = [],
  onRenameCategory,
  onRemoveCategory,
  onClose,
  onSubmit,
}: NewTextbausteinModalProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>(() =>
    loadCustomCategories(),
  );
  const [hiddenCategories, setHiddenCategories] = useState<string[]>(() =>
    loadHiddenCategories(),
  );
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [catConfirm, setCatConfirm] = useState<CategoryConfirmAction | null>(
    null,
  );
  const [paramsOpen, setParamsOpen] = useState(false);
  const [variables, setVariables] = useState<VariableDto[]>([]);
  const [varsLoading, setVarsLoading] = useState(false);
  const [varFilter, setVarFilter] = useState("");
  const titleRef = useRef<HTMLInputElement | null>(null);
  const newCatRef = useRef<HTMLInputElement | null>(null);
  const catSearchRef = useRef<HTMLInputElement | null>(null);
  const textEditorRef = useRef<ParamPillEditorHandle | null>(null);

  const categories = mergeCategories(
    customCategories,
    harvestCategoryPrefixes(knownTitles),
    hiddenCategories,
    category,
  );

  useEffect(() => {
    if (!open) return;
    const initialTitle = initial?.title ?? "";
    const custom = loadCustomCategories();
    const hidden = loadHiddenCategories();
    const cats = mergeCategories(
      custom,
      harvestCategoryPrefixes(knownTitles),
      hidden,
    );
    setCustomCategories(custom);
    setHiddenCategories(hidden);
    setTitle(initialTitle);
    setCategory(categoryFromTitle(initialTitle, cats));
    setText(initial?.text ?? "");
    setError(null);
    setSaving(false);
    setParamsOpen(false);
    setVarFilter("");
    setAddingCategory(false);
    setNewCategoryDraft("");
    setCatMenuOpen(false);
    setCatFilter("");
    setCatConfirm(null);
    const t = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
    };
    // Reset only when modal opens / initial changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || saving) return;
      if (catConfirm) return; // handled by ConfirmCategoryModal
      if (addingCategory) {
        setAddingCategory(false);
        setNewCategoryDraft("");
        return;
      }
      if (catMenuOpen) {
        setCatMenuOpen(false);
        setCatFilter("");
        return;
      }
      if (paramsOpen) {
        setParamsOpen(false);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    onClose,
    saving,
    paramsOpen,
    addingCategory,
    catMenuOpen,
    catConfirm,
  ]);

  useEffect(() => {
    if (!open || !addingCategory) return;
    const t = window.setTimeout(() => newCatRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, addingCategory]);

  useEffect(() => {
    if (!open || !catMenuOpen) return;
    const t = window.setTimeout(() => catSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, catMenuOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setVarsLoading(true);
    fetchVariables()
      .then((list) => {
        if (!cancelled) setVariables(list);
      })
      .catch(() => {
        if (!cancelled) setVariables([]);
      })
      .finally(() => {
        if (!cancelled) setVarsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  function focusTitleEnd() {
    window.requestAnimationFrame(() => {
      const el = titleRef.current;
      if (!el) return;
      el.focus();
      const pos = el.value.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function selectCategory(next: string) {
    setCategory(next);
    setCatMenuOpen(false);
    setCatFilter("");
    if (!next) return;
    setTitle(applyCategory(title, next, categories));
    focusTitleEnd();
  }

  function startNewCategory() {
    setCatMenuOpen(false);
    setCatFilter("");
    setAddingCategory(true);
    setNewCategoryDraft("");
  }

  function cancelNewCategory() {
    setAddingCategory(false);
    setNewCategoryDraft("");
  }

  function commitNewCategory() {
    const name = newCategoryDraft.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Bitte einen Kategorienamen eingeben.");
      return;
    }
    if (name.length > MAX_CATEGORY_LEN) {
      setError(`Kategorie max. ${MAX_CATEGORY_LEN} Zeichen.`);
      return;
    }
    if (/[–-]/.test(name)) {
      setError("Kategorie darf keinen Gedankenstrich enthalten.");
      return;
    }
    const existing = categories.find(
      (c) => c.toLowerCase() === name.toLowerCase(),
    );
    const resolved = existing ?? name;
    if (!existing) {
      const nextCustom = [...customCategories, name];
      setCustomCategories(nextCustom);
      saveCustomCategories(nextCustom);
    }
    setAddingCategory(false);
    setNewCategoryDraft("");
    setError(null);
    const nextCats = mergeCategories(
      existing ? customCategories : [...customCategories, name],
      harvestCategoryPrefixes(knownTitles),
      hiddenCategories.filter(
        (h) => h.toLowerCase() !== resolved.toLowerCase(),
      ),
      resolved,
    );
    // Re-show if previously hidden
    if (isHidden(resolved, hiddenCategories)) {
      const nextHidden = hiddenCategories.filter(
        (h) => h.toLowerCase() !== resolved.toLowerCase(),
      );
      setHiddenCategories(nextHidden);
      saveHiddenCategories(nextHidden);
    }
    setCategory(resolved);
    setTitle(applyCategory(title, resolved, nextCats));
    focusTitleEnd();
  }

  async function applyConfirmDelete(name: string) {
    const nextCustom = customCategories.filter(
      (c) => c.toLowerCase() !== name.toLowerCase(),
    );
    setCustomCategories(nextCustom);
    saveCustomCategories(nextCustom);
    if (!isHidden(name, hiddenCategories)) {
      const nextHidden = [...hiddenCategories, name];
      setHiddenCategories(nextHidden);
      saveHiddenCategories(nextHidden);
    }
    if (category.toLowerCase() === name.toLowerCase()) {
      setCategory("");
    }
    const nextTitle = rewriteCategoryPrefix(title, name, null);
    if (nextTitle !== title) setTitle(nextTitle);
    await onRemoveCategory?.(name);
    setCatMenuOpen(true);
  }

  async function applyConfirmEdit(from: string, to: string) {
    const clash = categories.find(
      (c) =>
        c.toLowerCase() === to.toLowerCase() &&
        c.toLowerCase() !== from.toLowerCase(),
    );
    if (clash) {
      throw new Error(`Kategorie „${clash}“ existiert bereits.`);
    }
    const nextCustom = [
      ...customCategories.filter((c) => c.toLowerCase() !== from.toLowerCase()),
      to,
    ];
    setCustomCategories(nextCustom);
    saveCustomCategories(nextCustom);
    // Hide old name (incl. defaults) so it disappears from the list
    const nextHidden = [
      ...hiddenCategories.filter(
        (h) =>
          h.toLowerCase() !== from.toLowerCase() &&
          h.toLowerCase() !== to.toLowerCase(),
      ),
      from,
    ];
    setHiddenCategories(nextHidden);
    saveHiddenCategories(nextHidden);
    if (category.toLowerCase() === from.toLowerCase()) {
      setCategory(to);
    }
    const nextTitle = rewriteCategoryPrefix(title, from, to);
    if (nextTitle !== title) setTitle(nextTitle);
    await onRenameCategory?.(from, to);
    setCatMenuOpen(true);
  }

  function insertParam(variable: VariableDto) {
    const expr = variable.expression || `{{ params.${variable.key} }}`;
    textEditorRef.current?.insertExpression(expr, variable.key);
    setParamsOpen(false);
    setVarFilter("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (addingCategory) {
      commitNewCategory();
      return;
    }
    const t = title.trim();
    const body = text.trim();
    if (!t) {
      setError("Bitte einen Titel eingeben.");
      return;
    }
    if (!body) {
      setError("Bitte einen Text eingeben.");
      return;
    }
    // Persist category from title if user typed a new prefix
    const fromTitle = categoryFromTitle(t, categories);
    if (fromTitle) {
      const isDefault = (DEFAULT_CATEGORIES as readonly string[]).some(
        (c) => c.toLowerCase() === fromTitle.toLowerCase(),
      );
      const isCustom = customCategories.some(
        (c) => c.toLowerCase() === fromTitle.toLowerCase(),
      );
      if (!isDefault && !isCustom) {
        const nextCustom = [...customCategories, fromTitle];
        setCustomCategories(nextCustom);
        saveCustomCategories(nextCustom);
      }
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ title: t, text: body });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
      setSaving(false);
    }
  }

  const heading =
    mode === "edit" ? "Textbaustein bearbeiten" : "Neuer Textbaustein";
  const saveLabel =
    mode === "edit"
      ? saving
        ? "Speichern…"
        : "Änderungen speichern"
      : saving
        ? "Speichern…"
        : "Speichern";

  const q = varFilter.trim().toLowerCase();
  const filteredVars = q
    ? variables.filter((v) =>
        `${v.label} ${v.key} ${v.expression} ${v.groupLabel}`
          .toLowerCase()
          .includes(q),
      )
    : variables;

  const catQ = catFilter.trim().toLowerCase();
  const filteredCategories = catQ
    ? categories.filter((c) => c.toLowerCase().includes(catQ))
    : categories;

  return (
    <>
    <div
      className="modal-backdrop"
      role="presentation"
      data-testid="new-textbaustein-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving && !catConfirm) onClose();
      }}
    >
      <div
        className="modal ed-textbaustein-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-textbaustein-title"
        data-testid="new-textbaustein-modal"
      >
        <header className="modal-header">
          <h2 id="ed-textbaustein-title">{heading}</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Schließen"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body ed-textbaustein-form">
            <div className="ed-field">
              <span>Titel</span>
              <div
                className={`ed-title-combo${addingCategory ? " is-adding-cat" : ""}`}
              >
                {addingCategory ? (
                  <div className="ed-title-combo-new-cat">
                    <label className="sr-only" htmlFor="ed-textbaustein-new-cat">
                      Neue Kategorie
                    </label>
                    <input
                      id="ed-textbaustein-new-cat"
                      ref={newCatRef}
                      type="text"
                      value={newCategoryDraft}
                      maxLength={MAX_CATEGORY_LEN}
                      placeholder="Neue Kategorie…"
                      disabled={saving}
                      data-testid="textbaustein-category-new"
                      onChange={(e) => setNewCategoryDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitNewCategory();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ed-title-combo-new-ok"
                      disabled={saving}
                      data-testid="textbaustein-category-new-ok"
                      aria-label="Kategorie übernehmen"
                      onClick={commitNewCategory}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      className="ed-title-combo-new-cancel"
                      disabled={saving}
                      data-testid="textbaustein-category-new-cancel"
                      aria-label="Abbrechen"
                      onClick={cancelNewCategory}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="ed-title-combo-cat">
                    <button
                      type="button"
                      className={`ed-cat-trigger${catMenuOpen ? " is-open" : ""}`}
                      disabled={saving}
                      aria-expanded={catMenuOpen}
                      aria-haspopup="listbox"
                      aria-label="Titel-Kategorie"
                      data-testid="textbaustein-category"
                      onClick={() => {
                        setCatMenuOpen((v) => !v);
                        setCatFilter("");
                      }}
                    >
                      <span className={category ? undefined : "is-placeholder"}>
                        {category || "Kategorie…"}
                      </span>
                      <IconChevronDown />
                    </button>
                    {catMenuOpen && (
                      <div
                        className="ed-cat-menu"
                        role="listbox"
                        aria-label="Kategorien"
                        data-testid="textbaustein-category-menu"
                      >
                        <button
                          type="button"
                          className="ed-cat-new-btn"
                          data-testid="textbaustein-category-new-btn"
                          onClick={startNewCategory}
                        >
                          Neue Kategorie
                        </button>
                        <input
                          ref={catSearchRef}
                          type="search"
                          className="ed-cat-search"
                          value={catFilter}
                          onChange={(e) => setCatFilter(e.target.value)}
                          placeholder="Kategorie suchen…"
                          autoComplete="off"
                          data-testid="textbaustein-category-search"
                        />
                        {filteredCategories.length === 0 ? (
                          <p className="muted ed-cat-empty">Keine Treffer</p>
                        ) : (
                          <ul className="ed-cat-list">
                            {filteredCategories.map((c) => (
                              <li key={c} className="ed-cat-row">
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={c === category}
                                  className={`ed-cat-item${c === category ? " is-selected" : ""}`}
                                  data-testid={`textbaustein-category-${c}`}
                                  onClick={() => selectCategory(c)}
                                >
                                  {c}
                                </button>
                                <div className="ed-cat-actions">
                                  <button
                                    type="button"
                                    className="ed-cat-action"
                                    aria-label={`Kategorie ${c} bearbeiten`}
                                    data-testid={`textbaustein-category-edit-${c}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCatConfirm({ kind: "edit", name: c });
                                    }}
                                  >
                                    <IconEdit />
                                  </button>
                                  <button
                                    type="button"
                                    className="ed-cat-action is-danger"
                                    aria-label={`Kategorie ${c} entfernen`}
                                    data-testid={`textbaustein-category-delete-${c}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCatConfirm({
                                        kind: "delete",
                                        name: c,
                                      });
                                    }}
                                  >
                                    <IconTrash />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTitle(v);
                    setCategory(categoryFromTitle(v, categories));
                  }}
                  maxLength={120}
                  placeholder="z. B. Gruß – Standard Browo"
                  disabled={saving}
                  data-testid="textbaustein-title"
                />
              </div>
            </div>

            <div className="ed-field">
              <div className="ed-field-head">
                <span>Text</span>
                <div className="ed-param-insert">
                  <button
                    type="button"
                    className={`ed-param-insert-btn${paramsOpen ? " is-open" : ""}`}
                    disabled={saving}
                    aria-expanded={paramsOpen}
                    aria-haspopup="listbox"
                    data-testid="textbaustein-params-btn"
                    onMouseDown={(e) => {
                      // keep contenteditable selection / caret
                      e.preventDefault();
                    }}
                    onClick={() => {
                      setParamsOpen((v) => !v);
                    }}
                  >
                    <span>Param einfügen</span>
                    <IconChevronDown />
                  </button>
                  {paramsOpen && (
                    <div
                      className="ed-param-insert-menu"
                      role="listbox"
                      aria-label="Parameter"
                      data-testid="textbaustein-params-menu"
                    >
                      <input
                        type="search"
                        className="ed-param-insert-search"
                        value={varFilter}
                        onChange={(e) => setVarFilter(e.target.value)}
                        placeholder="Suchen…"
                        autoComplete="off"
                        data-testid="textbaustein-params-search"
                      />
                      {varsLoading && (
                        <p className="muted ed-param-insert-empty">Laden…</p>
                      )}
                      {!varsLoading && filteredVars.length === 0 && (
                        <p className="muted ed-param-insert-empty">
                          Keine Parameter
                        </p>
                      )}
                      <ul className="ed-param-insert-list">
                        {filteredVars.map((v) => (
                          <li key={v.key}>
                            <button
                              type="button"
                              role="option"
                              className="ed-param-insert-item"
                              data-testid={`textbaustein-param-${v.key}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => insertParam(v)}
                            >
                              <span className="ed-param-insert-label">
                                {v.label}
                              </span>
                              <code className="ed-param-insert-expr">
                                {v.expression}
                              </code>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <ParamPillEditor
                ref={textEditorRef}
                value={text}
                onChange={setText}
                disabled={saving}
                placeholder="Textbaustein-Inhalt…"
                data-testid="textbaustein-text"
              />
            </div>
            <p className="muted ed-textbaustein-hint">
              Kategorie wählen oder neu anlegen, Titel ergänzen. Params
              erscheinen als Pills — https://-URLs werden verlinkt.
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
              disabled={saving}
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              data-testid="textbaustein-save"
            >
              {saveLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
    <ConfirmCategoryModal
      action={catConfirm}
      maxNameLength={MAX_CATEGORY_LEN}
      onClose={() => setCatConfirm(null)}
      onConfirmDelete={applyConfirmDelete}
      onConfirmEdit={applyConfirmEdit}
    />
    </>
  );
}
