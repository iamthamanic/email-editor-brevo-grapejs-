/**
 * Insert Brevo params as clickable email-param badges into the selection.
 * Location: apps/editor/src/variables/insertVariable.ts
 */

import type { Editor } from "@email-template/editor-core";
import { buildEmailParamComponent } from "@email-template/email-components";

const HOST_TYPES = new Set([
  "email-text",
  "email-heading",
  "email-button",
]);

type Comp = {
  get: (k: string) => unknown;
  parent: () => Comp | undefined;
  append: (c: unknown) => unknown;
  replaceWith: (c: unknown) => unknown;
  getView?: () => { disableEditing?: () => void } | undefined;
};

function findHost(component: Comp): Comp | null {
  let cur: Comp | undefined = component;
  while (cur) {
    const type = String(cur.get("type") ?? "");
    if (HOST_TYPES.has(type)) return cur;
    cur = cur.parent?.();
  }
  return null;
}

function exitRte(editor: Editor) {
  const editing = editor.getEditing() as Comp | undefined;
  if (!editing) return;
  editing.getView?.()?.disableEditing?.();
}

export interface InsertVariableInput {
  key: string;
  label: string;
  expression: string;
}

function parseInput(
  expressionOrVar: string | InsertVariableInput,
  labelMaybe?: string,
): InsertVariableInput {
  if (typeof expressionOrVar !== "string") return expressionOrVar;
  const m = /^\{\{\s*params\.(\w+)\s*\}\}$/.exec(expressionOrVar.trim());
  const key = m?.[1] ?? expressionOrVar.trim();
  return {
    key,
    label: labelMaybe ?? key,
    expression: expressionOrVar,
  };
}

/**
 * Appends (or replaces) a param badge on the selected text/heading/button.
 * @returns false when nothing suitable is selected
 */
export function insertVariableExpression(
  editor: Editor,
  expressionOrVar: string | InsertVariableInput,
  labelMaybe?: string,
): boolean {
  const input = parseInput(expressionOrVar, labelMaybe);
  const badge = buildEmailParamComponent(input.key, input.label);
  if (!badge.attributes["data-param-key"]) return false;

  const selected = editor.getSelected() as Comp | undefined;
  if (!selected) return false;

  exitRte(editor);

  const type = String(selected.get("type") ?? "");

  if (type === "email-param") {
    selected.replaceWith(badge);
    return true;
  }

  const host = HOST_TYPES.has(type) ? selected : findHost(selected);
  if (!host) return false;

  host.append(badge);
  return true;
}
