/**
 * GrapesJS editor factory — hides GrapesJS wiring from app pages.
 * Location: packages/editor-core
 */

import grapesjs, { type Editor, type EditorConfig } from "grapesjs";
import type { EditorProjectData } from "@email-template/email-schema";

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
    canvas: {
      styles: [],
    },
  };

  const editor = grapesjs.init(config);

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
