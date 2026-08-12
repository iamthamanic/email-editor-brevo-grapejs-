/**
 * Off-DOM Grapes render of stored editorData → Brevo publish HTML.
 * Location: apps/editor/src/templates/renderEditorDataHtml.ts
 */

import type { EditorProjectData } from "@email-template/email-schema";
import { createEmailEditor, type Editor } from "@email-template/editor-core";
import { buildPublishHtml } from "../variables/previewDoc";

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const step = () => {
      left -= 1;
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * Load project into a hidden editor and export publish HTML (merge tags intact).
 */
export async function renderEditorDataToPublishHtml(
  editorData: EditorProjectData,
): Promise<string> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:600px;height:400px;" +
    "overflow:hidden;opacity:0;pointer-events:none;";
  document.body.appendChild(host);

  let editor: Editor | null = null;
  try {
    editor = createEmailEditor({
      container: host,
      projectData: editorData,
      height: "400px",
    });
    await waitFrames(2);
    const html = buildPublishHtml(
      editor.getHtml() ?? "",
      editor.getCss() ?? "",
    );
    const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (plain.length < 10) {
      throw new Error("Template hat keinen veröffentlichbaren Inhalt.");
    }
    return html;
  } finally {
    try {
      editor?.destroy();
    } catch {
      // ignore destroy races
    }
    host.remove();
  }
}
