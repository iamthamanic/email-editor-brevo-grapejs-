/**
 * Template list as Brevo-style cards: search, status filter, pagination, bulk delete.
 * Location: apps/editor/src/templates/TemplateListPage.tsx
 */

import { useEffect, useState, type SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router";
import type {
  EmailTemplateListItem,
  TemplateStatus,
} from "@email-template/email-schema";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  fetchTemplate,
  fetchTemplates,
  publishTemplate,
  resolveSyncConflict,
  syncBrevoTemplates,
} from "../api/templatesApi";
import { IconEdit } from "./icons";
import { renderEditorDataToPublishHtml } from "./renderEditorDataHtml";
import { TemplateInfoModal } from "./TemplateInfoModal";
import { TemplateRowMenu } from "./TemplateRowMenu";

const DEFAULT_TEMPLATE_NAME = "Unbenanntes Template";
const PAGE_SIZE = 25;

const STATUS_OPTIONS: TemplateStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "REMOTE_CHANGED",
  "CONFLICT",
  "IMPORT_FAILED",
];

type StatusFilter = "ALL" | TemplateStatus;

function matchesQuery(item: EmailTemplateListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.name,
    item.label ?? "",
    item.subject ?? "",
    item.brevoTemplateId ?? "",
    item.status,
    item.source,
    `rev ${item.revision}`,
    String(item.revision),
    item.id,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Exact copy time incl. seconds (de-DE). */
function formatCopiedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isCopyName(name: string): boolean {
  const trimmed = name.trim();
  return /^\(Kopie\b/i.test(trimmed) || /\(Kopie\)\s*$/i.test(trimmed);
}

/** Copies pinned to top (newest first); others by updatedAt. */
function sortListItems(
  a: EmailTemplateListItem,
  b: EmailTemplateListItem,
): number {
  const aCopy = isCopyName(a.name);
  const bCopy = isCopyName(b.name);
  if (aCopy !== bCopy) return aCopy ? -1 : 1;
  if (aCopy && bCopy) {
    return b.createdAt.localeCompare(a.createdAt);
  }
  return b.updatedAt.localeCompare(a.updatedAt);
}

function stopRowNav(e: SyntheticEvent): void {
  e.stopPropagation();
}

function statusDotClass(status: TemplateStatus): string {
  switch (status) {
    case "PUBLISHED":
      return "tpl-card-dot--published";
    case "DRAFT":
      return "tpl-card-dot--draft";
    case "REMOTE_CHANGED":
      return "tpl-card-dot--remote";
    case "CONFLICT":
      return "tpl-card-dot--conflict";
    case "IMPORT_FAILED":
      return "tpl-card-dot--failed";
    default:
      return "tpl-card-dot--draft";
  }
}

export function TemplateListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<EmailTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [infoItem, setInfoItem] = useState<EmailTemplateListItem | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTemplates()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
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
  }, []);

  const filtered = items
    .filter((item) => {
      if (!matchesQuery(item, search)) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      return true;
    })
    .sort(sortListItems);
  const filteredIds = filtered.map((item) => item.id);
  const selectedInView = selectedIds.filter((id) => filteredIds.includes(id));
  const allFilteredSelected =
    filteredIds.length > 0 && selectedInView.length === filteredIds.length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeTo = Math.min(pageStart + PAGE_SIZE, filtered.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function setSearchAndReset(value: string): void {
    setSearch(value);
    setPage(1);
  }

  function setStatusAndReset(value: StatusFilter): void {
    setStatusFilter(value);
    setPage(1);
  }

  function toggleSelect(id: string): void {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAll(): void {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) next.add(id);
      return [...next];
    });
  }

  async function reloadList(): Promise<void> {
    const data = await fetchTemplates();
    setItems(data);
    setSelectedIds((prev) => prev.filter((id) => data.some((t) => t.id === id)));
  }

  async function handleBrevoSync(): Promise<void> {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    setSyncInfo(null);
    try {
      const result = await syncBrevoTemplates();
      await reloadList();
      const errHint =
        result.errors.length > 0
          ? ` · ${result.errors.length} Hinweis(e)`
          : "";
      const tb =
        typeof result.textbausteineCreated === "number" &&
        result.textbausteineCreated > 0
          ? ` · ${result.textbausteineCreated} Textbausteine`
          : "";
      const conflictHint =
        typeof result.conflicts === "number" && result.conflicts > 0
          ? ` · ${result.conflicts} Konflikt(e)`
          : "";
      setSyncInfo(
        `Brevo: ${result.fetched} geladen · ${result.created} neu · ${result.updated} aktualisiert · ${result.converted} konvertiert · ${result.skipped} übersprungen${tb}${conflictHint}${errHint}`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Brevo-Sync fehlgeschlagen",
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleResolveSync(
    item: EmailTemplateListItem,
    action: "accept_remote" | "keep_local",
  ): Promise<void> {
    if (deleting || duplicating || publishing) return;
    const label =
      action === "accept_remote"
        ? "Remote-Version aus Brevo übernehmen und lokale Änderungen verwerfen?"
        : "Lokale Version behalten und Remote-Konflikt verwerfen? (Publish nötig, um Brevo zu aktualisieren)";
    if (!window.confirm(label)) return;
    setPublishing(true);
    setError(null);
    setActionInfo(null);
    try {
      const updated = await resolveSyncConflict(item.id, {
        action,
        expectedRevision: item.revision,
      });
      await reloadList();
      setActionInfo(
        action === "accept_remote"
          ? `„${updated.name}“: Remote übernommen.`
          : `„${updated.name}“: Lokal behalten (Status DRAFT).`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Konflikt lösen fehlgeschlagen",
      );
    } finally {
      setPublishing(false);
    }
  }

  async function openEditor() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createTemplate({
        name: DEFAULT_TEMPLATE_NAME,
        subject: null,
      });
      navigate(`/templates/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
      setCreating(false);
    }
  }

  async function handleDeleteOne(item: EmailTemplateListItem): Promise<void> {
    if (deleting || duplicating || publishing) return;
    const okConfirm = window.confirm(
      `Template „${item.name}“ wirklich löschen?`,
    );
    if (!okConfirm) return;

    setDeleting(true);
    setError(null);
    setActionInfo(null);
    try {
      await deleteTemplate(item.id);
      await reloadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDuplicate(item: EmailTemplateListItem): Promise<void> {
    if (deleting || duplicating || publishing) return;
    setDuplicating(true);
    setError(null);
    setActionInfo(null);
    try {
      await duplicateTemplate(item.id);
      await reloadList();
      setPage(1);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Duplizieren fehlgeschlagen",
      );
    } finally {
      setDuplicating(false);
    }
  }

  async function handlePublish(item: EmailTemplateListItem): Promise<void> {
    if (deleting || duplicating || publishing) return;
    const okConfirm = window.confirm(
      `Template „${item.name}“ jetzt nach Brevo veröffentlichen?`,
    );
    if (!okConfirm) return;

    setPublishing(true);
    setError(null);
    setActionInfo(null);
    try {
      const full = await fetchTemplate(item.id);
      if (!full.subject?.trim()) {
        throw new Error(
          "Betreff fehlt — bitte im Editor setzen und erneut veröffentlichen.",
        );
      }
      const html = await renderEditorDataToPublishHtml(full.editorData);
      const result = await publishTemplate(full.id, {
        expectedRevision: full.revision,
        html,
        editorData: full.editorData,
        subject: full.subject,
        name: full.name,
      });
      await reloadList();
      setActionInfo(
        result.created
          ? `„${full.name}“ in Brevo angelegt (#${result.brevoTemplateId}).`
          : `„${full.name}“ in Brevo aktualisiert (#${result.brevoTemplateId}).`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Veröffentlichen fehlgeschlagen",
      );
    } finally {
      setPublishing(false);
    }
  }

  async function handleBulkDelete(): Promise<void> {
    if (deleting || duplicating || publishing || selectedInView.length === 0) {
      return;
    }
    const count = selectedInView.length;
    const okConfirm = window.confirm(
      count === 1
        ? "1 ausgewähltes Template wirklich löschen?"
        : `${count} ausgewählte Templates wirklich löschen?`,
    );
    if (!okConfirm) return;

    setDeleting(true);
    setError(null);
    try {
      for (const id of selectedInView) {
        await deleteTemplate(id);
      }
      await reloadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      try {
        await reloadList();
      } catch {
        /* keep prior list if refresh also fails */
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page tpl-list-page">
      <header className="page-header">
        <div>
          <h1>E-Mail Templates</h1>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" to="/email-editor">
            E-Mail schreiben
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void handleBrevoSync()}
            disabled={syncing || creating}
            data-testid="brevo-sync-btn"
          >
            {syncing ? "Brevo wird geladen…" : "Von Brevo laden"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void openEditor()}
            disabled={creating || syncing}
          >
            {creating ? "Wird angelegt…" : "Neues Template"}
          </button>
        </div>
      </header>

      {loading && (
        <p className="muted" aria-busy="true">
          Templates werden geladen…
        </p>
      )}
      {syncInfo && !error && (
        <p className="muted" role="status" data-testid="brevo-sync-status">
          {syncInfo}
        </p>
      )}
      {actionInfo && !error && (
        <p
          className="muted"
          role="status"
          data-testid="template-list-action-info"
        >
          {actionInfo}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty">
          <h2>Noch keine Templates</h2>
          <p className="muted">
            Lege das erste Template an — der visuelle Editor öffnet sich danach.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void openEditor()}
            disabled={creating}
          >
            {creating ? "Wird angelegt…" : "Erstes Template anlegen"}
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="tpl-list-panel" data-testid="template-list">
          <div className="tpl-card-toolbar">
            <label className="tpl-card-check">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                aria-label="Alle Treffer auswählen"
                data-testid="template-select-all"
              />
            </label>
            <label className="tpl-search">
              <span className="sr-only">Templates durchsuchen</span>
              <input
                type="search"
                className="field-input tpl-search-input"
                value={search}
                onChange={(e) => setSearchAndReset(e.target.value)}
                placeholder="Vorlagen suchen…"
                autoComplete="off"
                data-testid="template-list-search"
              />
            </label>
            <label className="tpl-status-filter">
              <span className="sr-only">Status filtern</span>
              <select
                className="field-input tpl-status-select"
                value={statusFilter}
                onChange={(e) =>
                  setStatusAndReset(e.target.value as StatusFilter)
                }
                data-testid="template-status-filter"
              >
                <option value="ALL">Alle Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="tpl-card-pagination"
              aria-label="Seitennavigation"
            >
              <span className="muted tpl-page-range" aria-live="polite">
                {rangeFrom}–{rangeTo} von {filtered.length}
              </span>
              <label className="tpl-page-select-wrap">
                <span className="sr-only">Seite</span>
                <select
                  className="field-input tpl-page-select"
                  value={safePage}
                  onChange={(e) => setPage(Number(e.target.value))}
                  disabled={totalPages <= 1}
                  data-testid="template-page-select"
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n} von {totalPages} Seiten
                      </option>
                    ),
                  )}
                </select>
              </label>
              <button
                type="button"
                className="tpl-page-btn"
                aria-label="Vorherige Seite"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="template-page-prev"
              >
                ‹
              </button>
              <button
                type="button"
                className="tpl-page-btn"
                aria-label="Nächste Seite"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                data-testid="template-page-next"
              >
                ›
              </button>
            </div>
          </div>

          {selectedInView.length > 0 && (
            <div
              className="tpl-bulk-bar"
              data-testid="template-bulk-bar"
              role="toolbar"
              aria-label="Auswahlaktionen"
            >
              <span className="tpl-bulk-count">
                {selectedInView.length} ausgewählt
              </span>
              <button
                type="button"
                className="btn-secondary tpl-bulk-delete"
                onClick={() => void handleBulkDelete()}
                disabled={deleting}
                data-testid="template-bulk-delete"
              >
                {deleting ? "Wird gelöscht…" : "Löschen"}
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="muted tpl-list-empty">
              Keine Treffer
              {search.trim() ? ` für „${search.trim()}“` : ""}
              {statusFilter !== "ALL" ? ` (Status ${statusFilter})` : ""}.
            </p>
          ) : (
            <ul className="tpl-card-list" data-testid="template-card-list">
              {paged.map((item) => {
                const selected = selectedIds.includes(item.id);
                const brevoId = item.brevoTemplateId?.trim() ?? "";
                const updatedText = formatUpdatedAt(item.updatedAt);
                const copy = isCopyName(item.name);
                const metaParts = [
                  brevoId ? `#${brevoId}` : null,
                  copy
                    ? `Kopiert am ${formatCopiedAt(item.createdAt)}`
                    : `Zuletzt bearbeitet am ${updatedText}`,
                ].filter(Boolean);
                return (
                  <li
                    key={item.id}
                    className={`tpl-card${selected ? " is-selected" : ""}`}
                    data-testid="template-list-row"
                  >
                    <label className="tpl-card-check" onClick={stopRowNav}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Auswählen: ${item.name}`}
                        data-testid="template-row-select"
                      />
                    </label>
                    <div className="tpl-card-body">
                      <Link
                        className="tpl-card-title"
                        to={`/templates/${item.id}`}
                        title={item.name || undefined}
                      >
                        {item.name}
                      </Link>
                      <p className="tpl-card-meta muted">
                        {metaParts.join(" · ")}
                      </p>
                      <p
                        className="tpl-card-status"
                        title={`${item.status} · Rev ${item.revision}`}
                      >
                        <span
                          className={`tpl-card-dot ${statusDotClass(item.status)}`}
                          aria-hidden
                        />
                        <span>{item.status}</span>
                        <span className="muted tpl-card-rev">
                          Rev {item.revision}
                        </span>
                      </p>
                    </div>
                    <div className="tpl-card-actions" onClick={stopRowNav}>
                      <Link
                        className="tpl-card-edit"
                        to={`/templates/${item.id}`}
                        aria-label={`Bearbeiten: ${item.name}`}
                        title="Bearbeiten"
                        data-testid="template-card-edit"
                      >
                        <IconEdit />
                      </Link>
                      <TemplateRowMenu
                        item={item}
                        busy={deleting || duplicating || publishing}
                        onDelete={(row) => void handleDeleteOne(row)}
                        onDuplicate={(row) => void handleDuplicate(row)}
                        onPublish={(row) => void handlePublish(row)}
                        onResolveRemote={(row) =>
                          void handleResolveSync(row, "accept_remote")
                        }
                        onResolveKeepLocal={(row) =>
                          void handleResolveSync(row, "keep_local")
                        }
                        onOpenInfo={setInfoItem}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <TemplateInfoModal item={infoItem} onClose={() => setInfoItem(null)} />
    </div>
  );
}
