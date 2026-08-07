/**
 * GrapesJS editor factory — hides GrapesJS wiring from app pages.
 * Location: packages/editor-core
 */

import grapesjs, { type Editor, type EditorConfig } from "grapesjs";
import {
  registerEmailComponents,
  sanitizeEmailHtml,
} from "@email-template/email-components";
import type { EditorProjectData } from "@email-template/email-schema";

/** Re-export for future publish/renderer pipeline (F-02 HTML allowlist). */
export { sanitizeEmailHtml };

export interface CreateEditorOptions {
  container: HTMLElement;
  projectData?: EditorProjectData | null;
  height?: string;
}

export function createEmailEditor(options: CreateEditorOptions): Editor {
  const config: EditorConfig = {
    container: options.container,
    height: options.height ?? "100%",
    width: "auto",
    fromElement: false,
    storageManager: false,
    noticeOnUnload: false,
    // Stock blocks cleared in registerEmailComponents
    blockManager: {
      appendTo: undefined,
    },
    canvas: {
      styles: [],
    },
  };

  const editor = grapesjs.init(config);
  registerEmailComponents(editor);

  if (options.projectData && Object.keys(options.projectData).length > 0) {
    editor.loadProjectData(options.projectData);
  }

  return editor;
}

export function getProjectData(editor: Editor): EditorProjectData {
  return editor.getProjectData() as EditorProjectData;
}

export function loadProjectData(editor: Editor, data: EditorProjectData): void {
  editor.loadProjectData(data);
}

export type { Editor };
