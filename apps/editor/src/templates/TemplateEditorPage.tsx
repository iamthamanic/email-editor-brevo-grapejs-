/**
 * HVAI-style template form: Name/Betreff + toolbar + canvas; traits via modal.
 * Location: apps/editor/src/templates/TemplateEditorPage.tsx
 */

import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  applyDefaultStarter,
  createEmailEditor,
  getProjectData,
  migrateLegacyLayout,
  type Editor,
} from "@email-template/editor-core";
import type { EmailTemplateDto } from "@email-template/email-schema";
import {
  convertTemplate,
  fetchTemplate,
  patchTemplate,
} from "../api/templatesApi";
import { SamplePreview } from "../variables/SamplePreview";
import { EditorToolbar } from "./EditorToolbar";
import { TraitsModal } from "./TraitsModal";

type SaveState = "idle" | "saving" | "saved" | "failed";

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

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const traitsRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const templateRef = useRef<EmailTemplateDto | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [template, setTemplate] = useState<EmailTemplateDto | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeHtml, setCodeHtml] = useState("");
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let editor: Editor | null = null;

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
        setLoadError(null);

        editor = createEmailEditor({
          container: canvasRef.current,
          traitsContainer: traitsRef.current,
          projectData: data.editorData,
        });
        editorRef.current = editor;
        setEditorReady(true);
        if (import.meta.env.DEV) {
          (window as Window & { __emailEditor?: Editor }).__emailEditor = editor;
        }

        editor.on("update", () => {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            void persist();
          }, AUTOSAVE_MS);
        });

        editor.on("component:selected", (component) => {
          if (String(component?.get?.("type") ?? "") === "email-param") {
            setTraitsOpen(true);
          }
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
          editorData: getProjectData(ed),
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
      editor?.destroy();
      editorRef.current = null;
    };
  }, [id]);

  function scheduleMetaSave(nextName: string, nextSubject: string) {
    if (metaTimerRef.current) clearTimeout(metaTimerRef.current);
    metaTimerRef.current = setTimeout(() => {
      const current = templateRef.current;
      const ed = editorRef.current;
      if (!current || !ed || !id) return;
      const trimmedName = nextName.trim() || current.name;
      void (async () => {
        setSaveState("saving");
        setSaveError(null);
        try {
          const updated = await patchTemplate(id, {
            expectedRevision: current.revision,
            editorData: getProjectData(ed),
            name: trimmedName,
            subject: nextSubject.trim() || null,
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

  const saveLabel =
    saveState === "saving"
      ? "Speichern…"
      : saveState === "saved"
        ? "Gespeichert"
        : saveState === "failed"
          ? "Speichern fehlgeschlagen"
          : "Bereit";

  return (
    <div className="page ed-form-page">
      <div className="ed-form" data-testid="template-form-editor">
        <header className="ed-form-header">
          <div className="ed-form-header-left">
            <Link to="/" className="ed-back">
              ← Templates
            </Link>
            <h1 className="ed-form-title">
              {template?.name ? "Template bearbeiten" : "Neues Template"}
            </h1>
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
              onClick={() => setPreviewOpen((v) => !v)}
              aria-pressed={previewOpen}
            >
              Vorschau
            </button>
            <Link to="/" className="ed-btn-primary" aria-label="Schließen">
              Fertig
            </Link>
          </div>
        </header>

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
        {saveError && (
          <p className="error ed-banner" role="alert">
            {saveError}
          </p>
        )}

        {!loadError && (
        <>
        <div className="ed-form-fields">
          <label className="field">
            <span className="field-label">Template-Name</span>
            <input
              className="field-input"
              value={name}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                scheduleMetaSave(v, subject);
              }}
              placeholder="Template-Name eingeben"
              maxLength={120}
            />
          </label>
          <label className="field">
            <span className="field-label">E-Mail-Betreff</span>
            <input
              className="field-input"
              value={subject}
              onChange={(e) => {
                const v = e.target.value;
                setSubject(v);
                scheduleMetaSave(name, v);
              }}
              placeholder="Betreff eingeben"
              maxLength={200}
            />
          </label>
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
                  setCodeHtml(ed.getHtml());
                  setCodeOpen(true);
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
            {previewOpen && (
              <div className="ed-preview-drawer">
                <SamplePreview
                  editor={editorReady ? editorRef.current : null}
                  defaultEnabled
                />
              </div>
            )}
          </section>
        </div>

        <TraitsModal
          open={traitsOpen}
          onClose={() => setTraitsOpen(false)}
          traitsRef={traitsRef}
        />
        </>
        )}
      </div>
    </div>
  );
}
