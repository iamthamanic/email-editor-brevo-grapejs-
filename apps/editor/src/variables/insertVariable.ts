/**
 * Insert Brevo params expression into the selected GrapesJS component.
 * Location: apps/editor/src/variables/insertVariable.ts
 */

import type { Editor } from "@email-template/editor-core";

const TEXT_TYPES = new Set(["email-text", "email-heading"]);

function readPlainContent(component: {
  get: (k: string) => unknown;
  getEl: () => HTMLElement | undefined;
}): string {
  const prop = component.get("content");
  if (typeof prop === "string" && prop.length > 0) return prop;
  const el = component.getEl();
  return el?.textContent ?? "";
}

/**
 * Appends expression to selected text/heading/button.
 * @returns false when nothing suitable is selected
 */
export function insertVariableExpression(
  editor: Editor,
  expression: string,
): boolean {
  const selected = editor.getSelected();
  if (!selected) return false;

  const type = String(selected.get("type") ?? "");

  if (TEXT_TYPES.has(type)) {
    const next = `${readPlainContent(selected)}${expression}`;
    selected.set("content", next);
    selected.components(next);
    return true;
  }

  if (type === "email-button") {
    const current = String(selected.get("content") ?? "");
    selected.set("content", `${current}${expression}`);
    return true;
  }

  return false;
}
