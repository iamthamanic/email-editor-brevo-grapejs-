/**
 * GrapesJS trait: brand swatches + HEX + native color (no Spectrum-only UI).
 * Location: packages/email-components/src/brandColorTrait.ts
 */

import type { Component, Editor, Trait } from "grapesjs";
import { BRAND_PALETTE, EMAIL_COLORS } from "./brandDefaults.js";
import { normalizeHexColor } from "./colors.js";

type TraitViewCtx = {
  elInput: HTMLElement;
  component: Component;
  trait: Trait;
  event?: Event;
};

const EXTRA_SWATCHES = [
  { hex: EMAIL_COLORS.primary, label: "Primär" },
  { hex: "#ffffff", label: "Weiß" },
  { hex: EMAIL_COLORS.text, label: "Text" },
] as const;

function readTraitValue(component: Component, trait: Trait): string {
  const name = String(trait.get("name") ?? "");
  if (trait.get("changeProp")) {
    return String(component.get(name) ?? "");
  }
  const attrs = component.getAttributes?.() ?? {};
  if (attrs[name] != null && String(attrs[name]).trim() !== "") {
    return String(attrs[name]);
  }
  // Common style fallbacks for color-ish props
  const style = component.getStyle?.() ?? {};
  if (name === "backgroundColor" || name === "background-color") {
    return String(style["background-color"] ?? "");
  }
  if (name === "color") {
    return String(style.color ?? "");
  }
  return "";
}

function writeTraitValue(
  component: Component,
  trait: Trait,
  raw: string,
): void {
  const normalized = normalizeHexColor(raw);
  if (!normalized) return;
  const name = String(trait.get("name") ?? "");
  if (trait.get("changeProp")) {
    component.set(name, normalized);
  } else {
    component.addAttributes({ [name]: normalized });
  }
}

function syncUi(wrap: HTMLElement, value: string): void {
  const hex = wrap.querySelector(
    ".ed-trait-brand-color__hex",
  ) as HTMLInputElement | null;
  const native = wrap.querySelector(
    ".ed-trait-brand-color__native",
  ) as HTMLInputElement | null;
  const normalized = normalizeHexColor(value) ?? value;
  if (hex && hex.value !== normalized) hex.value = normalized || "";
  if (native && normalized && /^#[0-9a-fA-F]{6}$/.test(normalized)) {
    native.value = normalized;
  }
  wrap.querySelectorAll(".ed-trait-brand-color__swatch").forEach((node) => {
    const btn = node as HTMLButtonElement;
    const active =
      normalizeHexColor(btn.dataset.hex ?? "") ===
      (normalizeHexColor(normalized) ?? "").toLowerCase();
    btn.classList.toggle("is-active", active);
  });
}

/** Register TraitManager type `brand-color`. */
export function registerBrandColorTrait(editor: Editor): void {
  const tm = editor.TraitManager;

  tm.addType("brand-color", {
    createInput({ trait }) {
      const wrap = document.createElement("div");
      wrap.className = "ed-trait-brand-color";
      wrap.dataset.traitName = String(trait.get("name") ?? "");

      const swatches = document.createElement("div");
      swatches.className = "ed-trait-brand-color__swatches";
      swatches.setAttribute("role", "list");

      const all = [
        ...BRAND_PALETTE.map((c) => ({
          hex: c.hex,
          label: `${c.label} (${c.ral})`,
        })),
        ...EXTRA_SWATCHES,
      ];

      for (const c of all) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ed-trait-brand-color__swatch";
        btn.style.backgroundColor = c.hex;
        btn.dataset.hex = c.hex;
        btn.title = `${c.label} · ${c.hex}`;
        btn.setAttribute("aria-label", `${c.label}, ${c.hex}`);
        btn.setAttribute("role", "listitem");
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const hexInput = wrap.querySelector(
            ".ed-trait-brand-color__hex",
          ) as HTMLInputElement | null;
          if (hexInput) hexInput.value = c.hex;
          const native = wrap.querySelector(
            ".ed-trait-brand-color__native",
          ) as HTMLInputElement | null;
          if (native) native.value = c.hex;
          wrap.dispatchEvent(new Event("change", { bubbles: true }));
        });
        swatches.appendChild(btn);
      }
      wrap.appendChild(swatches);

      const row = document.createElement("div");
      row.className = "ed-trait-brand-color__row";

      const hex = document.createElement("input");
      hex.type = "text";
      hex.className = "ed-trait-brand-color__hex";
      hex.spellcheck = false;
      hex.autocomplete = "off";
      hex.placeholder = "#4eb2e5";
      hex.setAttribute("aria-label", "HEX-Farbe");
      hex.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          wrap.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      hex.addEventListener("change", () => {
        wrap.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const native = document.createElement("input");
      native.type = "color";
      native.className = "ed-trait-brand-color__native";
      native.title = "Farbwähler";
      native.setAttribute("aria-label", "Farbwähler");
      native.addEventListener("input", () => {
        hex.value = native.value;
        wrap.dispatchEvent(new Event("change", { bubbles: true }));
      });

      row.append(hex, native);
      wrap.appendChild(row);
      return wrap;
    },

    onUpdate({ elInput, component, trait }: TraitViewCtx) {
      syncUi(elInput, readTraitValue(component, trait));
    },

    onEvent({ elInput, component, trait }: TraitViewCtx) {
      const hexInput = elInput.querySelector(
        ".ed-trait-brand-color__hex",
      ) as HTMLInputElement | null;
      if (!hexInput) return;
      writeTraitValue(component, trait, hexInput.value);
      syncUi(elInput, readTraitValue(component, trait));
    },
  });
}
