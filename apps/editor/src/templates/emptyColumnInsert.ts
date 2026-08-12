/**
 * Empty layout-column helpers: detect + insert Text/Bild on click.
 * Location: apps/editor/src/templates/emptyColumnInsert.ts
 */

import type { Component, Editor } from "grapesjs";
import {
  emptyEmailImageBlock,
  emptyEmailTextBlock,
} from "@email-template/email-components";

function sectionRole(comp: Component): string {
  return String(
    comp.get("sectionRole") ??
      comp.getAttributes()?.["data-section-role"] ??
      comp.getAttributes()?.["data-role"] ??
      "",
  );
}

function isProtectedChrome(comp: Component): boolean {
  let c: Component | undefined = comp;
  while (c) {
    if (String(c.get("type") ?? "") === "email-section") {
      const role = sectionRole(c);
      return role === "header" || role === "footer" || role === "social";
    }
    c = c.parent() as Component | undefined;
  }
  return false;
}

function childComponents(comp: Component): Component[] {
  const col = comp.components() as {
    models?: Component[];
    forEach?: (cb: (c: Component) => void) => void;
  };
  if (Array.isArray(col.models)) return [...col.models];
  const out: Component[] = [];
  if (typeof col.forEach === "function") {
    col.forEach((c) => out.push(c));
  }
  return out;
}

/** True when column is a content dropzone with no email leafs yet. */
export function isEmptyContentColumn(comp: Component | null | undefined): boolean {
  if (!comp) return false;
  if (String(comp.get("type") ?? "") !== "email-column") return false;
  if (isProtectedChrome(comp)) return false;

  return !childComponents(comp).some((child) => {
    const t = String(child.get("type") ?? "");
    if (!t || t === "textnode") return false;
    return (
      t.startsWith("email-") ||
      t.startsWith("company-") ||
      t === "text" ||
      t === "link" ||
      t === "image"
    );
  });
}

export type EmptyColumnInsertKind = "text" | "image";

export function insertIntoEmptyColumn(
  editor: Editor,
  column: Component,
  kind: EmptyColumnInsertKind,
): Component | null {
  if (!isEmptyContentColumn(column)) return null;
  const def =
    kind === "text" ? emptyEmailTextBlock() : emptyEmailImageBlock();
  const added = column.append(def);
  const list = Array.isArray(added) ? added : [added];
  const first = (list[0] as Component | undefined) ?? null;
  if (first) {
    editor.select(first);
  }
  return first;
}

/**
 * Open insert chooser when an empty content column is selected.
 * Returns unsubscribe.
 */
export function wireEmptyColumnInsert(
  editor: Editor,
  onEmptySelect: (column: Component) => void,
): () => void {
  const onSelect = (component: Component) => {
    if (!isEmptyContentColumn(component)) return;
    onEmptySelect(component);
  };
  editor.on("component:select", onSelect);
  return () => {
    editor.off("component:select", onSelect);
  };
}
