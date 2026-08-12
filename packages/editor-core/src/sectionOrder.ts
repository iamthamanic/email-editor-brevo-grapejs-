/**
 * Keep email-sections in slot order: header → content → footer → social.
 * Location: packages/editor-core/src/sectionOrder.ts
 *
 * After canvas migration there is exactly one content section; relative order
 * within a role band is still stable-sorted for safety.
 */

import type { Component, Editor } from "grapesjs";
import { migrateCanvasLayout } from "./migrateCanvasLayout.js";

const ROLE_RANK: Record<string, number> = {
  header: 0,
  content: 1,
  footer: 2,
  social: 3,
};

function sectionRole(comp: Component): string {
  const attrs = comp.getAttributes?.() ?? {};
  return String(
    comp.get("sectionRole") ??
      attrs["data-section-role"] ??
      attrs["data-role"] ??
      "content",
  );
}

function isEmailSection(comp: Component): boolean {
  return String(comp.get("type") ?? "") === "email-section";
}

/**
 * Stable-sort wrapper children so chrome roles stay in bands.
 */
export function enforceSectionSlotOrder(editor: Editor): void {
  const wrap = editor.getWrapper();
  if (!wrap) return;
  const collection = wrap.components();
  const models = [...collection.models] as Component[];
  const sections = models.filter(isEmailSection);
  if (sections.length < 2) return;

  const ranked = sections.map((comp, index) => ({
    comp,
    index,
    rank: ROLE_RANK[sectionRole(comp)] ?? 1,
  }));
  const sorted = [...ranked].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.index - b.index;
  });

  let changed = false;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.comp !== sections[i]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;

  const nonSections = models.filter((m) => !isEmailSection(m));
  collection.reset(
    [...sorted.map((s) => s.comp), ...nonSections] as object[],
    { silent: false },
  );
}

export function wireSectionSlotOrder(editor: Editor): void {
  let enforcing = false;
  const run = () => {
    if (enforcing) return;
    enforcing = true;
    try {
      // Collapse accidental extra content sections before sorting slots.
      migrateCanvasLayout(editor);
      enforceSectionSlotOrder(editor);
    } finally {
      enforcing = false;
    }
  };
  editor.on("component:drag:end", run);
  editor.on("component:add", (comp: Component) => {
    if (isEmailSection(comp)) run();
  });
  // Initial normalize after load
  run();
}
