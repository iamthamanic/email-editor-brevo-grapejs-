/**
 * Brevo HTML → Grapes editorData (shared by sync + conflict resolve).
 * Location: apps/api/src/templates/brevoImport.ts
 */

import {
  EMPTY_EDITOR_DATA,
  type EditorProjectData,
} from "@email-template/email-schema";
import { convertBrevoHtml } from "@email-template/legacy-importer";

export function toImportEditorData(html: string): {
  editorData: EditorProjectData;
  ok: true;
} | { ok: false; message: string } {
  try {
    const result = convertBrevoHtml(html);
    return {
      ok: true,
      editorData: {
        __etsImport: 1,
        components: result.components,
        document: result.document,
        report: result.report,
      },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Konvertierung fehlgeschlagen",
    };
  }
}

export { EMPTY_EDITOR_DATA };
