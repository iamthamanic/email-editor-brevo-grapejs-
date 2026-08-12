/**
 * Multiline contenteditable that renders {{ params.* }} as subject-style pills.
 * Location: apps/editor/src/templates/ParamPillEditor.tsx
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  getVariable,
  isKnownVariableKey,
  replaceLegacyHashTokens,
  splitParamExpressions,
} from "@email-template/email-variables";

export interface ParamPillEditorHandle {
  insertExpression: (expression: string, key?: string) => void;
  focus: () => void;
}

interface ParamPillEditorProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  "data-testid"?: string;
}

function pillLabel(key: string): string {
  return `{{ params.${key} }}`;
}

function keyFromExpression(expression: string): string | null {
  const m = /^\{\{\s*params\.([a-zA-Z0-9_.]+)\s*\}\}$/.exec(expression.trim());
  return m?.[1] ?? null;
}

function createPill(doc: Document, key: string): HTMLSpanElement {
  const known = isKnownVariableKey(key);
  const expression = pillLabel(key);
  const meaning = getVariable(key)?.label ?? key;
  const pill = doc.createElement("span");
  pill.className = `compose-subject-pill${known ? "" : " is-unknown"}`;
  pill.contentEditable = "false";
  pill.dataset.paramKey = key;
  pill.title = `${meaning} — ${expression}`;
  pill.setAttribute("aria-label", `${meaning}: ${expression}`);
  pill.textContent = expression;
  return pill;
}

function buildDom(doc: Document, value: string): DocumentFragment {
  const frag = doc.createDocumentFragment();
  const normalized = replaceLegacyHashTokens(value);
  const lines = normalized.split("\n");
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) frag.append(doc.createElement("br"));
    const parts = splitParamExpressions(line);
    if (parts.length === 0 && line === "" && lineIdx === 0) return;
    for (const part of parts) {
      if (part.type === "text") {
        if (part.value) frag.append(doc.createTextNode(part.value));
        continue;
      }
      frag.append(createPill(doc, part.key));
    }
  });
  return frag;
}

function serialize(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      out += "\n";
      return;
    }
    const key = node.dataset.paramKey?.trim();
    if (key) {
      out += pillLabel(key);
      return;
    }
    // Block-ish wrappers from browsers
    if (node.tagName === "DIV" || node.tagName === "P") {
      if (out.length > 0 && !out.endsWith("\n")) out += "\n";
      for (const child of Array.from(node.childNodes)) walk(child);
      return;
    }
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return out.replace(/\n{3,}/g, "\n\n");
}

function placeCaretAfter(node: Node) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = node.ownerDocument!.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export const ParamPillEditor = forwardRef<
  ParamPillEditorHandle,
  ParamPillEditorProps
>(function ParamPillEditor(
  {
    value,
    onChange,
    disabled = false,
    placeholder = "Textbaustein-Inhalt…",
    "data-testid": testId,
  },
  ref,
) {
  const editRef = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef(value);

  useEffect(() => {
    const el = editRef.current;
    if (!el) return;
    if (value === lastEmitted.current) {
      const current = serialize(el);
      if (current === value) return;
    }
    el.replaceChildren(buildDom(el.ownerDocument, value));
    lastEmitted.current = value;
  }, [value]);

  function emitFromDom(opts?: { promotePills?: boolean }) {
    const el = editRef.current;
    if (!el) return;
    // Strip lonely <br> placeholder browsers leave in empty editors
    if (
      el.childNodes.length === 1 &&
      el.firstChild instanceof HTMLBRElement
    ) {
      el.replaceChildren();
    }
    const next = serialize(el);
    if (opts?.promotePills && /\{\{\s*params\./.test(next)) {
      el.replaceChildren(buildDom(el.ownerDocument, next));
    }
    lastEmitted.current = next;
    if (next !== value) onChange(next);
  }

  useImperativeHandle(ref, () => ({
    focus() {
      editRef.current?.focus();
    },
    insertExpression(expression: string, key?: string) {
      const el = editRef.current;
      if (!el || disabled) return;
      el.focus();
      const resolvedKey = key ?? keyFromExpression(expression);
      const sel = window.getSelection();
      let range: Range | null = null;
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        range = sel.getRangeAt(0);
      } else {
        range = el.ownerDocument.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
      }
      range.deleteContents();
      if (resolvedKey) {
        const pill = createPill(el.ownerDocument, resolvedKey);
        range.insertNode(pill);
        // trailing space so typing continues after the pill
        const space = el.ownerDocument.createTextNode("\u00a0");
        pill.after(space);
        placeCaretAfter(space);
      } else {
        const text = el.ownerDocument.createTextNode(expression);
        range.insertNode(text);
        placeCaretAfter(text);
      }
      emitFromDom();
    },
  }));

  return (
    <div
      ref={editRef}
      className={`ed-param-pill-editor${disabled ? " is-disabled" : ""}`}
      contentEditable={!disabled}
      role="textbox"
      aria-multiline="true"
      aria-label="Textbaustein-Inhalt"
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      data-testid={testId}
      suppressContentEditableWarning
      onInput={() => emitFromDom()}
      onBlur={() => emitFromDom({ promotePills: true })}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
        emitFromDom({ promotePills: true });
      }}
    />
  );
});
