/**
 * Inline compose preview: Von/Betreff + Desktop/Mobil + iframe (no modal, no customer picker).
 * Params come from host customer context later; locally getSampleData().
 * Location: apps/editor/src/compose/ComposeInlinePreview.tsx
 */

import { useEffect, useMemo, useState } from "react";
import { getSyncedHtml, type Editor } from "@email-template/editor-core";
import {
  getSampleData,
  substituteParams,
  type SampleData,
} from "@email-template/email-variables";
import { IconDesktop, IconMobile } from "../templates/icons";
import {
  buildPreviewDoc,
  type PreviewDevice,
} from "../variables/previewDoc";

interface ComposeInlinePreviewProps {
  editor: Editor | null;
  subject: string;
  senderName?: string | null;
  senderEmail?: string | null;
  /** Host/ERP customer params; falls back to sample map. */
  params?: SampleData | null;
}

export function ComposeInlinePreview({
  editor,
  subject,
  senderName,
  senderEmail,
  params,
}: ComposeInlinePreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [html, setHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState(subject);
  const [error, setError] = useState<string | null>(null);

  const sample = useMemo(() => params ?? getSampleData(), [params]);

  useEffect(() => {
    if (!editor) {
      setError("Editor ist noch nicht bereit.");
      setHtml("");
      return;
    }

    let cancelled = false;

    async function render() {
      if (cancelled || !editor) return;
      try {
        setPreviewSubject(
          substituteParams(subject || "", sample) || "(kein Betreff)",
        );
        const rawHtml = await getSyncedHtml(editor);
        if (cancelled) return;
        setHtml(
          buildPreviewDoc(rawHtml, editor.getCss() ?? "", sample, device),
        );
        setError(null);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Vorschau konnte nicht erzeugt werden",
        );
        setHtml("");
      }
    }

    void render();
    const onUpdate = () => {
      void render();
    };
    editor.on("update", onUpdate);
    return () => {
      cancelled = true;
      editor.off("update", onUpdate);
    };
  }, [editor, subject, sample, device]);

  const fromLabel =
    [senderName?.trim(), senderEmail?.trim()].filter(Boolean).join(" · ") ||
    "—";

  return (
    <section className="compose-inline-preview" aria-label="Vorschau">
      <div className="ed-preview-main compose-inline-preview-main">
        <div className="ed-preview-meta-row">
          <dl className="ed-preview-meta">
            <div>
              <dt>Von</dt>
              <dd>{fromLabel}</dd>
            </div>
            <div>
              <dt>Betreff</dt>
              <dd data-testid="compose-preview-subject">{previewSubject}</dd>
            </div>
          </dl>
          <div className="ed-preview-device-bar" role="group" aria-label="Gerät">
            <button
              type="button"
              className={device === "desktop" ? "is-active" : undefined}
              aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
            >
              <IconDesktop size={14} />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              className={device === "mobile" ? "is-active" : undefined}
              aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
            >
              <IconMobile size={14} />
              <span>Mobil</span>
            </button>
          </div>
        </div>

        <div
          className={`ed-preview-frame-wrap${device === "mobile" ? " is-mobile" : " is-desktop"}`}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!error && html && (
            <iframe
              className="ed-preview-frame"
              title="E-Mail-Vorschau"
              sandbox=""
              srcDoc={html}
              data-testid="compose-preview-frame"
            />
          )}
        </div>
      </div>
    </section>
  );
}
