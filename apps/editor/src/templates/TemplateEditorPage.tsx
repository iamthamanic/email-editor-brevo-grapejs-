/**
 * GrapesJS editor page with debounced autosave and DE save states.
 * Location: apps/editor/src/templates/TemplateEditorPage.tsx
 */

import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  createEmailEditor,
  getProjectData,
  type Editor,
} from "@email-template/editor-core";
import type { EmailTemplateDto } from "@email-template/email-schema";
import { fetchTemplate, patchTemplate } from "../api/templatesApi";

type SaveState = "idle" | "saving" | "saved" | "failed";

const AUTOSAVE_MS = 1500;

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const templateRef = useRef<EmailTemplateDto | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [template, setTemplate] = useState<EmailTemplateDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let editor: Editor | null = null;

    async function boot() {
      try {
        const data = await fetchTemplate(id!);
        if (cancelled || !canvasRef.current) return;

        setTemplate(data);
        templateRef.current = data;
        setLoadError(null);

        editor = createEmailEditor({
          container: canvasRef.current,
          projectData: data.editorData,
        });
        editorRef.current = editor;
        // ponytail: Playwright hook — remove when custom blocks make RTE flows stable
        if (import.meta.env.DEV) {
          (window as Window & { __emailEditor?: Editor }).__emailEditor = editor;
        }

        editor.on("update", () => {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            void persist();
          }, AUTOSAVE_MS);
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Laden fehlgeschlagen");
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
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      editor?.destroy();
      editorRef.current = null;
    };
  }, [id]);

  const saveLabel =
    saveState === "saving"
      ? "Speichern…"
      : saveState === "saved"
        ? "Gespeichert"
        : saveState === "failed"
          ? "Speichern fehlgeschlagen"
          : "—";

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <Link to="/" className="back-link">
          ← E-Mail Templates
        </Link>
        <h1 className="editor-title">{template?.name ?? "Template"}</h1>
        <div className="save-status" aria-live="polite">
          <span className={saveState === "failed" ? "error" : "muted"}>{saveLabel}</span>
          {saveError && <span className="error"> ({saveError})</span>}
        </div>
      </header>

      {loadError && (
        <p className="error page-pad" role="alert">
          {loadError}
        </p>
      )}

      <div className="editor-canvas-wrap">
        <div ref={canvasRef} className="gjs-host" />
      </div>
    </div>
  );
}
