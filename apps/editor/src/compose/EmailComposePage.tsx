/**
 * HVAI Communication–style compose: locked brand chrome + editable content.
 * Location: apps/editor/src/compose/EmailComposePage.tsx
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  applyDefaultStarter,
  createEmailEditor,
  getSyncedHtml,
  migrateCanvasLayout,
  migrateLegacyLayout,
  type Editor,
} from "@email-template/editor-core";
import type { EmailTemplateListItem } from "@email-template/email-schema";
import type { Component } from "grapesjs";
import { sendComposeEmail } from "../api/composeApi";
import {
  convertTemplate,
  createTemplate,
  fetchTemplate,
  fetchTemplates,
  syncBrevoTemplates,
} from "../api/templatesApi";
import { EditorToolbar } from "../templates/EditorToolbar";
import { IconDuplicate } from "../templates/icons";
import {
  insertIntoEmptyColumn,
  wireEmptyColumnInsert,
} from "../templates/emptyColumnInsert";
import { EmptyColumnInsertModal } from "../templates/EmptyColumnInsertModal";
import { wireOpenTraitsModal } from "../templates/openTraitsOnSelect";
import { TraitsModal } from "../templates/TraitsModal";
import { installCaretBookmarkTracking } from "../variables/insertVariable";
import { ComposeEmailChipsField } from "./ComposeEmailChipsField";
import { ComposeInlinePreview } from "./ComposeInlinePreview";
import { ComposeSubjectField } from "./ComposeSubjectField";
import { ComposeTemplateMenu } from "./ComposeTemplateMenu";
import { TemplateSearchSelect } from "./TemplateSearchSelect";

type ViewMode = "edit" | "preview";
type SendState = "idle" | "sending" | "sent" | "failed";

const EMAIL_SPLIT = /[,;\s]+/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_TEMPLATE = "";
const DEFAULT_TEMPLATE_NAME = "Unbenanntes Template";

function parseEmailList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(EMAIL_SPLIT)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function isEmptyEditorData(data: Record<string, unknown> | null | undefined) {
  return !data || Object.keys(data).length === 0;
}

function applyEditorData(editor: Editor, data: Record<string, unknown>) {
  if (
    data.__etsImport === 1 &&
    Array.isArray(data.components)
  ) {
    editor.setComponents(data.components as object[]);
  } else if (Object.keys(data).length > 0) {
    editor.loadProjectData(data);
  } else {
    applyDefaultStarter(editor);
    return;
  }
  migrateLegacyLayout(editor);
  migrateCanvasLayout(editor);
}

export function EmailComposePage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const traitsRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const [editorReady, setEditorReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [templates, setTemplates] = useState<EmailTemplateListItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [brevoSyncing, setBrevoSyncing] = useState(false);
  const [brevoSyncInfo, setBrevoSyncInfo] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(EMPTY_TEMPLATE);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeHtml, setCodeHtml] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [emptyColumn, setEmptyColumn] = useState<Component | null>(null);

  const isEmbed =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-embed") === "1";

  useEffect(() => {
    if (!canvasRef.current || !traitsRef.current) return;

    const editor = createEmailEditor({
      container: canvasRef.current,
      traitsContainer: traitsRef.current,
      height: "100%",
    });
    editorRef.current = editor;
    (window as Window & { __emailEditor?: Editor }).__emailEditor = editor;
    applyDefaultStarter(editor);
    setEditorReady(true);

    const unwireCaretBookmark = installCaretBookmarkTracking(editor);
    const unwireTraits = wireOpenTraitsModal(editor, () => setTraitsOpen(true));
    const unwireEmptyCol = wireEmptyColumnInsert(editor, (col) => {
      setEmptyColumn(col);
    });

    return () => {
      unwireCaretBookmark();
      unwireEmptyCol();
      unwireTraits();
      editor.destroy();
      editorRef.current = null;
      delete (window as Window & { __emailEditor?: Editor }).__emailEditor;
      setEditorReady(false);
    };
  }, []);

  async function reloadBrevoTemplates() {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const list = await fetchTemplates();
      setTemplates(list.filter((t) => Boolean(t.brevoTemplateId)));
    } catch (err: unknown) {
      setTemplates([]);
      setTemplatesError(
        err instanceof Error
          ? err.message
          : "Templates konnten nicht geladen werden",
      );
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const list = await fetchTemplates();
        if (cancelled) return;
        setTemplates(list.filter((t) => Boolean(t.brevoTemplateId)));
      } catch (err: unknown) {
        if (!cancelled) {
          setTemplates([]);
          setTemplatesError(
            err instanceof Error
              ? err.message
              : "Templates konnten nicht geladen werden",
          );
        }
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleBrevoSync() {
    setBrevoSyncing(true);
    setTemplatesError(null);
    setBrevoSyncInfo(null);
    try {
      const result = await syncBrevoTemplates();
      await reloadBrevoTemplates();
      const loaded =
        result.fetched === 1
          ? "1 Template von Brevo geladen"
          : `${result.fetched} Templates von Brevo geladen`;
      const added =
        result.created === 0
          ? "keine neuen seit dem letzten Laden"
          : result.created === 1
            ? "1 neu seit dem letzten Laden"
            : `${result.created} neu seit dem letzten Laden`;
      setBrevoSyncInfo(`${loaded} · ${added}`);
    } catch (err: unknown) {
      setTemplatesError(
        err instanceof Error
          ? err.message
          : "Brevo-Templates konnten nicht geladen werden",
      );
    } finally {
      setBrevoSyncing(false);
    }
  }

  useEffect(() => {
    if (!brevoSyncInfo) return;
    const t = window.setTimeout(() => setBrevoSyncInfo(null), 5500);
    return () => window.clearTimeout(t);
  }, [brevoSyncInfo]);

  async function handleCreateTemplate() {
    if (creatingTemplate) return;
    setCreatingTemplate(true);
    setTemplatesError(null);
    try {
      const created = await createTemplate({
        name: DEFAULT_TEMPLATE_NAME,
        subject: null,
      });
      navigate(`/templates/${created.id}`);
    } catch (err: unknown) {
      setTemplatesError(
        err instanceof Error ? err.message : "Anlegen fehlgeschlagen",
      );
      setCreatingTemplate(false);
    }
  }

  async function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    setSendError(null);
    setSendOk(null);
    const ed = editorRef.current;
    if (!ed) return;

    if (!templateId) {
      applyDefaultStarter(ed);
      setSubject("");
      return;
    }

    setTemplateLoading(true);
    try {
      let data = await fetchTemplate(templateId);
      const shouldConvert =
        data.conversionStatus === "NOT_IMPORTED" ||
        (isEmptyEditorData(data.editorData) &&
          Boolean(data.legacyHtml?.trim()));
      if (shouldConvert) {
        const converted = await convertTemplate(templateId);
        data = converted.template;
      }
      applyEditorData(ed, data.editorData);
      setSubject(data.subject?.trim() || data.name || "");
    } catch (err: unknown) {
      setSendError(
        err instanceof Error
          ? err.message
          : "Template konnte nicht geladen werden",
      );
    } finally {
      setTemplateLoading(false);
    }
  }

  async function handleSend() {
    setSendError(null);
    setSendOk(null);

    const recipients = parseEmailList(to);
    if (recipients.length === 0) {
      setSendError("Mindestens eine Empfänger-E-Mail angeben.");
      setSendState("failed");
      return;
    }
    for (const email of recipients) {
      if (!EMAIL_RE.test(email)) {
        setSendError(`Ungültige E-Mail: ${email}`);
        setSendState("failed");
        return;
      }
    }
    const subjectTrim = subject.trim();
    if (!subjectTrim) {
      setSendError("Betreff fehlt.");
      setSendState("failed");
      return;
    }

    const ed = editorRef.current;
    const html = ed ? await getSyncedHtml(ed) : "";
    if (!html.trim()) {
      setSendError("Kein E-Mail-Inhalt.");
      setSendState("failed");
      return;
    }

    const ccList = parseEmailList(cc);
    const bccList = parseEmailList(bcc);
    setSendState("sending");
    try {
      const result = await sendComposeEmail({
        to: recipients,
        cc: ccList.length ? ccList : undefined,
        bcc: bccList.length ? bccList : undefined,
        subject: subjectTrim,
        html,
      });
      setSendState("sent");
      setSendOk(
        `Gesendet an ${result.recipientCount} Empfänger${
          result.messageId ? ` (${result.messageId})` : ""
        }.`,
      );
    } catch (err: unknown) {
      setSendState("failed");
      setSendError(
        err instanceof Error ? err.message : "Versand fehlgeschlagen",
      );
    }
  }

  return (
    <div className={`ed-form-page compose-page${isEmbed ? " is-embed" : ""}`}>
      <div className="ed-form compose-form">
        <header className="ed-form-header">
          <div className="ed-form-header-left">
            {!isEmbed && (
              <Link className="ed-back" to="/">
                ← Templates
              </Link>
            )}
            <h1 className="ed-form-title">E-Mail schreiben</h1>
          </div>
          <div className="ed-form-header-right">
            <button
              type="button"
              className="ed-btn-primary"
              onClick={() => void handleSend()}
              disabled={sendState === "sending" || !editorReady}
            >
              {sendState === "sending" ? "Senden…" : "Senden"}
            </button>
          </div>
        </header>

        {(sendError || sendOk) && (
          <p
            className={sendError ? "error ed-banner" : "ed-banner compose-ok"}
            role="status"
          >
            {sendError ?? sendOk}
          </p>
        )}

        <div
          className="compose-meta"
          onKeyDown={(e) => {
            if (
              (e.metaKey || e.ctrlKey) &&
              ["a", "z", "y"].includes(e.key.toLowerCase())
            ) {
              // Don't let GrapesJS keymaster (document bubble) steal form shortcuts.
              e.stopPropagation();
            }
          }}
        >
          <div className="field">
            <span className="field-label">Template auswählen (via Brevo)</span>
            <div className="compose-template-row">
              <div className="compose-template-row-search">
                <TemplateSearchSelect
                  templates={templates}
                  value={selectedTemplateId}
                  onChange={(id) => void handleTemplateChange(id)}
                  disabled={
                    templatesLoading ||
                    templateLoading ||
                    brevoSyncing ||
                    creatingTemplate ||
                    sendState === "sending"
                  }
                  loading={
                    templatesLoading || templateLoading || brevoSyncing
                  }
                  statusHint={brevoSyncInfo}
                />
              </div>
              <ComposeTemplateMenu
                disabled={sendState === "sending"}
                syncing={brevoSyncing}
                creating={creatingTemplate}
                onBrevoLoad={() => void handleBrevoSync()}
                onCreateTemplate={() => void handleCreateTemplate()}
              />
            </div>
            {templatesError && (
              <span className="field-hint error">{templatesError}</span>
            )}
            {templateLoading && (
              <span className="field-hint">Template wird geladen…</span>
            )}
          </div>
          <div className="field">
            <span className="field-label">An (Empfänger)</span>
            <ComposeEmailChipsField
              value={to}
              onChange={setTo}
              placeholder="empfaenger@example.com"
              aria-label="Empfänger"
              disabled={sendState === "sending"}
            />
          </div>
          <div className="compose-ccbcc">
            <div className="field compose-ccbcc-field">
              <span className="field-label">
                CC
                <span className="compose-ccbcc-hint">
                  Adressen mit Komma trennen
                </span>
              </span>
              <ComposeEmailChipsField
                value={cc}
                onChange={setCc}
                placeholder="cc@example.com"
                aria-label="CC"
                dense
                disabled={sendState === "sending"}
              />
            </div>
            <div className="field compose-ccbcc-field">
              <span className="field-label">
                BCC
                <span className="compose-ccbcc-hint">
                  Adressen mit Komma trennen
                </span>
              </span>
              <ComposeEmailChipsField
                value={bcc}
                onChange={setBcc}
                placeholder="bcc@example.com"
                aria-label="BCC"
                dense
                disabled={sendState === "sending"}
              />
            </div>
          </div>
          <div className="field">
            <span className="field-label">Betreff</span>
            <ComposeSubjectField
              value={subject}
              onChange={setSubject}
              mode={viewMode === "preview" ? "preview" : "edit"}
              disabled={sendState === "sending"}
              placeholder="Betreff eingeben"
            />
          </div>
        </div>

        <div className="compose-view-toggle" role="tablist" aria-label="Ansicht">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "edit"}
            className={viewMode === "edit" ? "is-active" : ""}
            onClick={() => setViewMode("edit")}
          >
            Bearbeiten
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "preview"}
            className={viewMode === "preview" ? "is-active" : ""}
            onClick={() => setViewMode("preview")}
            disabled={!editorReady}
          >
            Vorschau
          </button>
        </div>

        <div className="ed-form-body">
          <section
            className={`ed-form-content${viewMode !== "edit" ? " is-hidden" : ""}`}
            aria-label="E-Mail Inhalt"
            hidden={viewMode !== "edit"}
          >
            <EditorToolbar
              editor={editorReady ? editorRef.current : null}
              codeOpen={codeOpen}
              blockPalette="compose"
              onToggleCode={() => {
                const ed = editorRef.current;
                if (!ed) {
                  setCodeOpen((v) => !v);
                  return;
                }
                if (!codeOpen) {
                  void getSyncedHtml(ed).then((html) => {
                    setCodeHtml(html);
                    setCodeOpen(true);
                  });
                  return;
                }
                if (!codeHtml.trim()) {
                  applyDefaultStarter(ed);
                  setCodeOpen(false);
                  return;
                }
                ed.setComponents(codeHtml);
                setCodeOpen(false);
              }}
            />
            <div className="ed-form-canvas-wrap">
              <div ref={canvasRef} className="gjs-host" hidden={codeOpen} />
              {codeOpen && (
                <div className="ed-code-wrap">
                  <div className="ed-code-toolbar">
                    <button
                      type="button"
                      className="ed-code-copy-btn"
                      data-testid="compose-code-copy"
                      disabled={!codeHtml}
                      aria-label="HTML kopieren"
                      onClick={() => {
                        void (async () => {
                          try {
                            await navigator.clipboard.writeText(codeHtml);
                            setCodeCopied(true);
                            window.setTimeout(() => setCodeCopied(false), 1600);
                          } catch {
                            setCodeCopied(false);
                          }
                        })();
                      }}
                    >
                      <IconDuplicate />
                      <span>{codeCopied ? "Kopiert" : "Kopieren"}</span>
                    </button>
                  </div>
                  <textarea
                    className="ed-code-view"
                    value={codeHtml}
                    onChange={(e) => setCodeHtml(e.target.value)}
                    spellCheck={false}
                    aria-label="HTML-Quellcode bearbeiten"
                  />
                </div>
              )}
            </div>
          </section>

          {viewMode === "preview" && (
            <ComposeInlinePreview
              editor={editorReady ? editorRef.current : null}
              subject={subject}
              senderName="Halteverbot123"
              senderEmail="browo.verkehrssicherung@gmail.com"
            />
          )}
        </div>

        <TraitsModal
          open={traitsOpen}
          onClose={() => setTraitsOpen(false)}
          traitsRef={traitsRef}
        />
        <EmptyColumnInsertModal
          open={Boolean(emptyColumn)}
          onClose={() => setEmptyColumn(null)}
          onPick={(kind) => {
            const ed = editorRef.current;
            const col = emptyColumn;
            setEmptyColumn(null);
            if (!ed || !col) return;
            const inserted = insertIntoEmptyColumn(ed, col, kind);
            if (kind === "image" && inserted) setTraitsOpen(true);
          }}
        />
      </div>
    </div>
  );
}
