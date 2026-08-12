/**
 * Open Eigenschaften modal for trait-heavy blocks (image/button/param).
 * Uses component:select (fires on re-click) — component:selected does not.
 * Location: apps/editor/src/templates/openTraitsOnSelect.ts
 */

import type { Component, Editor } from "grapesjs";

const TRAIT_BLOCK_TYPES = new Set([
  "email-image",
  "email-button",
  "email-param",
]);

type ComponentLike = {
  get?: (k: string) => unknown;
  findType?: (type: string) => ComponentLike[];
};

/** Prefer the block that owns traits; promote single image/button in a column box. */
export function resolveTraitsComponent(
  component: ComponentLike | null | undefined,
): Component | null {
  if (!component?.get) return null;
  const type = String(component.get("type") ?? "");
  if (TRAIT_BLOCK_TYPES.has(type)) {
    return component as Component;
  }

  // Clicks on padding / "Inhalt"-box often select column/row, not the img.
  if (type === "email-column" || type === "email-row") {
    const images = component.findType?.("email-image") ?? [];
    if (images.length === 1) return (images[0] as Component) ?? null;
    const buttons = component.findType?.("email-button") ?? [];
    if (images.length === 0 && buttons.length === 1) {
      return (buttons[0] as Component) ?? null;
    }
  }

  return null;
}

/**
 * Wire canvas selection → open traits modal. Returns unsubscribe.
 * Selecting a column that wraps one image selects that image first.
 */
export function wireOpenTraitsModal(
  editor: Editor,
  openModal: () => void,
): () => void {
  const onSelect = (component: Component) => {
    const target = resolveTraitsComponent(component);
    if (!target) return;

    if (target !== component) {
      // Sync re-entry via component:select on the child opens the modal.
      editor.select(target);
      return;
    }

    openModal();
    // Re-bind TraitManager after the modal becomes visible (custom traits)
    queueMicrotask(() => {
      try {
        const selected = editor.getSelected();
        if (selected) editor.TraitManager.select(selected);
      } catch {
        // ignore
      }
    });
  };

  // selected = first selection; select = also re-clicks of the same block
  editor.on("component:selected", onSelect);
  editor.on("component:select", onSelect);
  return () => {
    editor.off("component:selected", onSelect);
    editor.off("component:select", onSelect);
  };
}
