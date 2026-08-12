/**
 * HVAI-style template form: Name/Betreff + toolbar + canvas; traits via modal.
 * Location: apps/editor/src/templates/TemplateEditorPage.tsx
 */

import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  applyDefaultStarter,
  createEmailEditor,
  getSyncedHtml,
  getSyncedProjectData,
  migrateCanvasLayout,
  migrateLegacyLayout,
  type Editor,
} from "@email-template/editor-core";
import type { BrevoSenderDto, EmailTemplateDto } from "@email-template/email-schema";
import type { Component } from "grapesjs";
import {
  convertTemplate,
  fetchBrevoSenders,
  fetchTemplate,
  migrateBrevoEditor,
  patchTemplate,
  publishTemplate,
  resolveSyncConflict,
} from "../api/templatesApi";
import { PreviewModal } from "../variables/PreviewModal";
import { buildPublishHtml } from "../variables/previewDoc";
import { ComposeSubjectField } from "../compose/ComposeSubjectField";
import { installCaretBookmarkTracking } from "../variables/insertVariable";
import { EditorToolbar } from "./EditorToolbar";
import {
  insertIntoEmptyColumn,
  wireEmptyColumnInsert,
} from "./emptyColumnInsert";
import { EmptyColumnInsertModal } from "./EmptyColumnInsertModal";
import { MigrationBanner } from "./MigrationBanner";
import { wireOpenTraitsModal } from "./openTraitsOnSelect";
import { SenderSearchSelect } from "./SenderSearchSelect";
import { TraitsModal } from "./TraitsModal";

type SaveState = "idle" | "saving" | "saved" | "failed";
type PublishState = "idle" | "publishing" | "published" | "failed";

const AUTOSAVE_MS = 1500;
const META_DEBOUNCE_MS = 600;

function isEmptyEditorData(data: Record<string, unknown> | null | undefined) {
  return !data || Object.keys(data).length === 0;
}

function importComponentsFrom(data: Record<string, unknown>) {
  if (data.__etsImport === 1 && Array.isArray(data.components)) {
    return data.components;
  }
  return null;
}

function applyEditorData(editor: Editor, data: Record<string, unknown>) {
  const imported = importComponentsFrom(data);
  if (imported) {
    editor.setComponents(imported as object[]);
  } else if (Object.keys(data).length > 0) {
    editor.loadProjectData(data);
  }
  migrateLegacyLayout(editor);
  migrateCanvasLayout(editor);
}

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const traitsRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const templateRef = useRef<EmailTemplateDto | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const senderEmailRef = useRef("");
  const senderNameRef = useRef("");

  const [template, setTemplate] = useState<EmailTemplateDto | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senders, setSenders] = useState<BrevoSenderDto[]>([]);
  const [sendersLoading, setSendersLoading] = useState(false);
  const [sendersRefreshing, setSendersRefreshing] = useState(false);
  const [sendersError, setSendersError] = useState<string | null>(null);
  const [sendersHint, setSendersHint] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishInfo, setPublishInfo] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeHtml, setCodeHtml] = useState("");
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [emptyColumn, setEmptyColumn] = useState<Component | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    senderEmailRef.current = senderEmail;
  }, [senderEmail]);

  useEffect(() => {
    senderNameRef.current = senderName;
  }, [senderName]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let editor: Editor | null = null;
    let unwireTraits: (() => void) | undefined;
    let unwireEmptyCol: (() => void) | undefined;
    let unwireCaretBookmark: (() => void) | undefined;

    async function boot() {
      try {
        let data = await fetchTemplate(id!);

        const shouldConvert =
          data.conversionStatus === "NOT_IMPORTED" ||
          (isEmptyEditorData(data.editorData) && Boolean(data.legacyHtml?.trim()));

        if (shouldConvert) {
          setPreparing(true);
          try {
            const converted = await convertTemplate(id!);
            data = converted.template;
          } catch (err: unknown) {
            if (!cancelled) {
              setLoadError(
                err instanceof Error
                  ? err.message
                  : "Template-Vorbereitung fehlgeschlagen",
              );
            }
            return;
          } finally {
            if (!cancelled) setPreparing(false);
          }
        }

        if (cancelled || !canvasRef.current || !traitsRef.current) {
          return;
        }

        setTemplate(data);
        templateRef.current = data;
        setName(data.name);
        setSubject(data.subject ?? "");
        setSenderEmail(data.senderEmail ?? "");
        setSenderName(data.senderName ?? "");
        setLoadError(null);

        editor = createEmailEditor({
          container: canvasRef.current,
          traitsContainer: traitsRef.current,
          projectData: data.editorData,
        });
        editorRef.current = editor;
        setEditorReady(true);
        if (import.meta.env.DEV) {
          const w = window as Window & {
            __emailEditor?: Editor;
            __etsMigrateCanvasLayout?: typeof migrateCanvasLayout;
          };
          w.__emailEditor = editor;
          w.__etsMigrateCanvasLayout = migrateCanvasLayout;
        }
        unwireCaretBookmark = installCaretBookmarkTracking(editor);

        editor.on("update", () => {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            void persist();
          }, AUTOSAVE_MS);
        });

        unwireTraits = wireOpenTraitsModal(editor, () => setTraitsOpen(true));
        unwireEmptyCol = wireEmptyColumnInsert(editor, (col) => {
          setEmptyColumn(col);
        });
      } catch (err: unknown) {
        if (!cancelled) {
          const code =
            err && typeof err === "object" && "code" in err
              ? String((err as { code?: string }).code)
              : "";
          if (code === "NOT_FOUND") {
            setLoadError(
              "Template nicht gefunden. Es wurde gelöscht oder nie angelegt (z. B. weil die API kurz offline war). Zurück zur Liste und neu öffnen.",
            );
          } else {
            setLoadError(
              err instanceof Error ? err.message : "Laden fehlgeschlagen",
            );
          }
        }
      }
    }

    async function persist() {
      const current = templateRef.current;
      const ed = editorRef.current;
      if (!current || !ed || !id) return;

      setSaveState("saving");
      setSaveError(null);
      try {
        const updated = await patchTemplate(id, {
          expectedRevision: current.revision,
          editorData: await getSyncedProjectData(ed),
        });
        setTemplate(updated);
        templateRef.current = updated;
        setSaveState("saved");
      } catch (err: unknown) {
        setSaveState("failed");
        setSaveError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
      }
    }

    void boot();

    return () => {
      cancelled = true;
      setEditorReady(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (metaTimerRef.current) clearTimeout(metaTimerRef.current);
      unwireCaretBookmark?.();
      unwireEmptyCol?.();
      unwireTraits?.();
      editor?.destroy();
      editorRef.current = null;
    };
  }, [id]);

  async function loadSenders(opts?: { refresh?: boolean }) {
    const refresh = Boolean(opts?.refresh);
    if (refresh) setSendersRefreshing(true);
    else setSendersLoading(true);
    setSendersError(null);
    if (!refresh) setSendersHint(null);
    try {
      const list = await fetchBrevoSenders();
      setSenders(list);
      if (refresh) {
        setSendersHint(
          list.length === 1
            ? "1 Absender von Brevo geladen"
            : `${list.length} Absender von Brevo geladen`,
        );
      }

      // New / empty templates: default to first active Brevo sender.
      const current = templateRef.current;
      if (
        current &&
        id &&
        !current.senderEmail?.trim() &&
        list.some((s) => s.active)
      ) {
        const pick =
          list.find((s) => s.active) ?? list[0] ?? null;
        if (pick) {
          setSenderEmail(pick.email);
          setSenderName(pick.name);
          try {
            const ed = editorRef.current;
            const updated = await patchTemplate(id, {
              expectedRevision: current.revision,
              senderEmail: pick.email,
              senderName: pick.name || null,
              ...(ed ? { editorData: await getSyncedProjectData(ed) } : {}),
            });
            setTemplate(updated);
            templateRef.current = updated;
            setSaveState("saved");
          } catch {
            // Keep UI selection; user can retry via dropdown
          }
        }
      }
    } catch (err: unknown) {
      setSendersError(
        err instanceof Error
          ? err.message
          : "Absender konnten nicht geladen werden",
      );
    } finally {
      setSendersLoading(false);
      setSendersRefreshing(false);
    }
  }

  useEffect(() => {
    if (!template?.id) return;
    void loadSenders();
  }, [template?.id]);

  useEffect(() => {
    if (!sendersHint) return;
    const t = setTimeout(() => setSendersHint(null), 3500);
    return () => clearTimeout(t);
  }, [sendersHint]);

  function scheduleMetaSave(
    nextName: string,
    nextSubject: string,
    nextSenderName?: string,
  ) {
    if (metaTimerRef.current) clearTimeout(metaTimerRef.current);
    metaTimerRef.current = setTimeout(() => {
      const current = templateRef.current;
      const ed = editorRef.current;
      if (!current || !ed || !id) return;
      const trimmedName = nextName.trim() || current.name;
      const senderNameToSave =
        nextSenderName !== undefined
          ? nextSenderName.trim() || null
          : senderNameRef.current.trim() || null;
      void (async () => {
        setSaveState("saving");
        setSaveError(null);
        try {
          const updated = await patchTemplate(id, {
            expectedRevision: current.revision,
            editorData: await getSyncedProjectData(ed),
            name: trimmedName,
            subject: nextSubject.trim() || null,
            senderEmail: senderEmailRef.current.trim() || null,
            senderName: senderNameToSave,
          });
          setTemplate(updated);
          templateRef.current = updated;
          setSaveState("saved");
        } catch (err: unknown) {
          setSaveState("failed");
          setSaveError(
            err instanceof Error ? err.message : "Speichern fehlgeschlagen",
          );
        }
      })();
    }, META_DEBOUNCE_MS);
  }

  function handleSenderNameChange(next: string) {
    setSenderName(next);
    scheduleMetaSave(name, subject, next);
  }

  async function handleSenderChange(sender: BrevoSenderDto | null) {
    const current = templateRef.current;
    if (!current || !id) return;
    const nextEmail = sender?.email.trim().toLowerCase() ?? "";
    const nextName = sender?.name.trim() ?? "";
    setSenderEmail(nextEmail);
    setSenderName(nextName);
    senderEmailRef.current = nextEmail;
    senderNameRef.current = nextName;
    setSaveState("saving");
    setSaveError(null);
    try {
      const ed = editorRef.current;
      const updated = await patchTemplate(id, {
        expectedRevision: current.revision,
        senderEmail: nextEmail || null,
        senderName: nextName || null,
        ...(ed ? { editorData: await getSyncedProjectData(ed) } : {}),
      });
      setTemplate(updated);
      templateRef.current = updated;
      setSaveState("saved");
    } catch (err: unknown) {
      setSaveState("failed");
      setSaveError(
        err instanceof Error ? err.message : "Absender speichern fehlgeschlagen",
      );
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "Speichern…"
      : saveState === "saved"
        ? "Gespeichert"
        : saveState === "failed"
          ? "Speichern fehlgeschlagen"
          : "Bereit";

  async function handlePublish() {
    const current = templateRef.current;
    const ed = editorRef.current;
    if (!current || !ed || !id) return;

    const subjectTrim = subject.trim();
    if (!subjectTrim) {
      setPublishState("failed");
      setPublishError("Bitte zuerst einen Betreff eingeben.");
      setPublishInfo(null);
      return;
    }
    if (!senderEmail.trim()) {
      setPublishState("failed");
      setPublishError("Bitte zuerst einen Absender wählen.");
      setPublishInfo(null);
      return;
    }

    // Flush pending autosave timers so revision matches canvas.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (metaTimerRef.current) {
      clearTimeout(metaTimerRef.current);
      metaTimerRef.current = null;
    }

    setPublishState("publishing");
    setPublishError(null);
    setPublishInfo(null);

    try {
      // Persist latest canvas before publish (revision bump).
      const saved = await patchTemplate(id, {
        expectedRevision: current.revision,
        editorData: await getSyncedProjectData(ed),
        name: name.trim() || current.name,
        subject: subjectTrim,
        senderEmail: senderEmail.trim() || null,
        senderName: senderName.trim() || null,
      });
      setTemplate(saved);
      templateRef.current = saved;
      setSaveState("saved");

      const html = buildPublishHtml(await getSyncedHtml(ed), ed.getCss() ?? "");
      const result = await publishTemplate(id, {
        expectedRevision: saved.revision,
        html,
        editorData: await getSyncedProjectData(ed),
        subject: subjectTrim,
        name: name.trim() || saved.name,
      });

      setTemplate(result.template);
      templateRef.current = result.template;
      setPublishState("published");
      setPublishInfo(
        result.created
          ? `In Brevo angelegt (#${result.brevoTemplateId}).`
          : `In Brevo aktualisiert (#${result.brevoTemplateId}).`,
      );
    } catch (err: unknown) {
      setPublishState("failed");
      setPublishError(
        err instanceof Error ? err.message : "Veröffentlichen fehlgeschlagen",
      );
    }
  }

  const publishLabel =
    publishState === "publishing"
      ? "Veröffentlichen…"
      : publishState === "published"
        ? "Veröffentlicht"
        : "Veröffentlichen";

  return (
    <div className="page ed-form-page">
      <div className="ed-form" data-testid="template-form-editor">
        <header className="ed-form-header">
          <div
            className="ed-form-header-left"
            onKeyDown={(e) => {
              if (
                (e.metaKey || e.ctrlKey) &&
                ["a", "z", "y"].includes(e.key.toLowerCase())
              ) {
                e.stopPropagation();
              }
            }}
          >
            <Link to="/" className="ed-back">
              ← Templates
            </Link>
            <label className="ed-form-title-field">
              <span className="ed-form-title-label">Template-Name</span>
              <input
                className="ed-form-title-input"
                value={name}
                title={name.trim() || undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  scheduleMetaSave(v, subject);
                }}
                placeholder="Template-Name eingeben"
                maxLength={120}
              />
            </label>
          </div>
          <div className="ed-form-header-right">
            <span
              className={`ed-save-pill${saveState === "failed" ? " is-error" : ""}${saveState === "saving" ? " is-busy" : ""}`}
              aria-live="polite"
            >
              {saveLabel}
            </span>
            <button
              type="button"
              className={`ed-btn-ghost${previewOpen ? " is-active" : ""}`}
              onClick={() => setPreviewOpen(true)}
              aria-pressed={previewOpen}
              disabled={!editorReady}
              title={
                editorReady
                  ? "Vorschau mit Beispieldaten"
                  : "Editor wird noch geladen"
              }
            >
              Vorschau
            </button>
            <button
              type="button"
              className="ed-btn-primary"
              onClick={() => void handlePublish()}
              disabled={!editorReady || publishState === "publishing"}
              title="HTML nach Brevo veröffentlichen (Create/Update)"
              data-testid="template-publish-btn"
            >
              {publishLabel}
            </button>
            <Link to="/" className="ed-btn-ghost" aria-label="Zur Liste">
              Fertig
            </Link>
          </div>
        </header>

        {publishError && (
          <div className="ed-banner ed-banner-error" role="alert">
            <p className="error">{publishError}</p>
          </div>
        )}
        {publishInfo && !publishError && (
          <div className="ed-banner ed-banner-ok" role="status">
            <p>{publishInfo}</p>
          </div>
        )}
        {loadError && (
          <div className="ed-banner ed-banner-error" role="alert">
            <p className="error">{loadError}</p>
            <Link to="/" className="btn-primary">
              Zur Template-Liste
            </Link>
          </div>
        )}
        {preparing && (
          <div className="ed-banner ed-banner-preparing" role="status" aria-live="polite">
            <p>Template wird vorbereitet…</p>
          </div>
        )}
        {template?.migrationRequired && !loadError ? (
          <MigrationBanner
            busy={migrating}
            error={migrationError}
            onMigrate={() => {
              void (async () => {
                if (!id) return;
                setMigrating(true);
                setMigrationError(null);
                try {
                  const result = await migrateBrevoEditor(id);
                  setTemplate(result.template);
                  templateRef.current = result.template;
                  const ed = editorRef.current;
                  if (ed) {
                    applyEditorData(ed, result.template.editorData);
                  }
                } catch (err: unknown) {
                  setMigrationError(
                    err instanceof Error
                      ? err.message
                      : "Aktualisierung fehlgeschlagen",
                  );
                } finally {
                  setMigrating(false);
                }
              })();
            }}
          />
        ) : null}
        {(template?.status === "CONFLICT" ||
          template?.status === "REMOTE_CHANGED") &&
        !loadError ? (
          <div
            className="ed-banner ed-banner-migration"
            role="status"
            aria-live="polite"
            data-testid="sync-conflict-banner"
          >
            <div className="ed-banner-migration-body">
              <p>
                Sync-Konflikt: Brevo hat eine neuere Version, lokale Änderungen
                wurden nicht überschrieben.
              </p>
            </div>
            <button
              type="button"
              className="ed-btn-primary"
              data-testid="conflict-accept-remote"
              onClick={() => {
                void (async () => {
                  if (!template) return;
                  try {
                    const updated = await resolveSyncConflict(template.id, {
                      action: "accept_remote",
                      expectedRevision: template.revision,
                    });
                    setTemplate(updated);
                    templateRef.current = updated;
                    const ed = editorRef.current;
                    if (ed) applyEditorData(ed, updated.editorData);
                  } catch (err: unknown) {
                    setSaveError(
                      err instanceof Error
                        ? err.message
                        : "Remote übernehmen fehlgeschlagen",
                    );
                  }
                })();
              }}
            >
              Remote übernehmen
            </button>
            <button
              type="button"
              className="btn-secondary"
              data-testid="conflict-keep-local"
              onClick={() => {
                void (async () => {
                  if (!template) return;
                  try {
                    const updated = await resolveSyncConflict(template.id, {
                      action: "keep_local",
                      expectedRevision: template.revision,
                    });
                    setTemplate(updated);
                    templateRef.current = updated;
                  } catch (err: unknown) {
                    setSaveError(
                      err instanceof Error
                        ? err.message
                        : "Lokal behalten fehlgeschlagen",
                    );
                  }
                })();
              }}
            >
              Lokal behalten
            </button>
          </div>
        ) : null}
        {saveError && (
          <p className="error ed-banner" role="alert">
            {saveError}
          </p>
        )}

        {!loadError && (
        <>
        <div
          className="ed-form-fields ed-form-fields--single"
          onKeyDown={(e) => {
            if (
              (e.metaKey || e.ctrlKey) &&
              ["a", "z", "y"].includes(e.key.toLowerCase())
            ) {
              e.stopPropagation();
            }
          }}
        >
          <div className="field">
            <span className="field-label">Absender</span>
            <SenderSearchSelect
              senders={senders}
              valueEmail={senderEmail}
              valueName={senderName}
              onChange={(s) => void handleSenderChange(s)}
              onNameChange={handleSenderNameChange}
              onRefresh={() => void loadSenders({ refresh: true })}
              disabled={!editorReady}
              loading={sendersLoading}
              refreshing={sendersRefreshing}
              error={sendersError}
              statusHint={sendersHint}
            />
          </div>
          <div className="field">
            <span className="field-label">E-Mail-Betreff</span>
            <ComposeSubjectField
              value={subject}
              onChange={(v) => {
                setSubject(v);
                scheduleMetaSave(name, v);
              }}
              mode="edit"
              disabled={!editorReady}
              placeholder="Betreff eingeben"
            />
          </div>
        </div>

        <div className="ed-form-body">
          <section className="ed-form-content" aria-label="HTML Inhalt">
            <EditorToolbar
              editor={editorReady ? editorRef.current : null}
              codeOpen={codeOpen}
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
                // Empty HTML → default starter (header/content/footer), no convert API
                if (!codeHtml.trim()) {
                  applyDefaultStarter(ed);
                  setSaveError(null);
                  setCodeOpen(false);
                  return;
                }
                // Convert pasted/edited HTML into email blocks (server importer)
                void (async () => {
                  if (!id) return;
                  setPreparing(true);
                  try {
                    const result = await convertTemplate(id, {
                      force: true,
                      html: codeHtml,
                    });
                    setTemplate(result.template);
                    templateRef.current = result.template;
                    const comps = importComponentsFrom(result.template.editorData);
                    if (comps) {
                      ed.setComponents(comps as object[]);
                    } else {
                      ed.loadProjectData(result.template.editorData);
                    }
                    migrateLegacyLayout(ed);
                    migrateCanvasLayout(ed);
                    setSaveError(null);
                    setCodeOpen(false);
                  } catch (err: unknown) {
                    setSaveState("failed");
                    setSaveError(
                      err instanceof Error
                        ? err.message
                        : "HTML-Konvertierung fehlgeschlagen",
                    );
                  } finally {
                    setPreparing(false);
                  }
                })();
              }}
            />
            <div className="ed-form-canvas-wrap">
              <div ref={canvasRef} className="gjs-host" hidden={codeOpen} />
              {codeOpen && (
                <div className="ed-code-wrap">
                  <textarea
                    className="ed-code-view"
                    value={codeHtml}
                    onChange={(e) => setCodeHtml(e.target.value)}
                    spellCheck={false}
                    aria-label="HTML-Quellcode bearbeiten"
                  />
                  <p className="muted ed-code-hint">
                    HTML einfügen oder leer lassen. Leer → Visual mit Header,
                    Inhalt und Footer. Sonst wird HTML in Blöcke konvertiert.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <PreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          editor={editorReady ? editorRef.current : null}
          templateId={id!}
          subject={subject}
          senderName={senderName || template?.senderName}
          senderEmail={senderEmail || template?.senderEmail}
          brevoTemplateId={template?.brevoTemplateId}
        />

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
        </>
        )}
      </div>
    </div>
  );
}
