/**
 * Sample-data preview toggle + sandboxed iframe.
 * Location: apps/editor/src/variables/SamplePreview.tsx
 */

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@email-template/editor-core";
import {
  substituteParams,
  type SampleData,
} from "@email-template/email-variables";
import { fetchSampleData } from "../api/variablesApi";

interface SamplePreviewProps {
  editor: Editor | null;
}

export function SamplePreview({ editor }: SamplePreviewProps) {
  const [enabled, setEnabled] = useState(false);
  const sampleRef = useRef<SampleData | null>(null);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !editor) {
      setHtml("");
      if (!enabled) setError(null);
      return;
    }

    let cancelled = false;

    async function renderPreview() {
      try {
        if (!sampleRef.current) {
          sampleRef.current = await fetchSampleData();
        }
        if (cancelled || !editor) return;
        const raw = editor.getHtml();
        const css = editor.getCss();
        const body = substituteParams(raw, sampleRef.current);
        setHtml(
          `<!DOCTYPE html><html><head><style>${css}</style></head><body>${body}</body></html>`,
        );
        setError(null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Beispieldaten laden fehlgeschlagen",
          );
          setHtml("");
        }
      }
    }

    void renderPreview();
    const onUpdate = () => {
      void renderPreview();
    };
    editor.on("update", onUpdate);

    return () => {
      cancelled = true;
      editor.off("update", onUpdate);
    };
  }, [enabled, editor]);

  return (
    <div className="sample-preview" data-testid="sample-preview">
      <label className="sample-preview-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Beispieldaten
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {enabled && !error && html && (
        <iframe
          className="sample-preview-frame"
          title="Vorschau Beispieldaten"
          sandbox=""
          srcDoc={html}
        />
      )}
    </div>
  );
}
