/**
 * GrapesJS trait: image URL + local file upload via /api/assets.
 * Location: packages/email-components/src/imageSrcTrait.ts
 */

import type { Component, Editor, Trait } from "grapesjs";
import {
  EMAIL_IMAGE_PLACEHOLDER_SRC,
  isEmailImagePlaceholderSrc,
} from "./imagePlaceholder.js";
import { sanitizeImageUrl } from "./urls.js";

type TraitViewCtx = {
  elInput: HTMLElement;
  component: Component;
  trait: Trait;
  event?: Event;
};

const PLACEHOLDER = EMAIL_IMAGE_PLACEHOLDER_SRC;

async function uploadImageFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file, file.name || "image");
  const response = await fetch("/api/assets", {
    method: "POST",
    body,
  });
  const raw = await response.text();
  let parsed: {
    data?: { url?: string } | null;
    error?: { message?: string } | null;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error(
      response.status === 502 || response.status === 0
        ? "API nicht erreichbar. Starte `npm run dev:api`."
        : "Ungültige Server-Antwort beim Upload.",
    );
  }
  if (!response.ok || !parsed.data?.url) {
    throw new Error(
      parsed.error?.message ?? `Upload fehlgeschlagen (HTTP ${response.status}).`,
    );
  }
  return parsed.data.url;
}

function readSrc(component: Component): string {
  return String(component.getAttributes()?.src ?? "");
}

function writeSrc(component: Component, raw: string): void {
  const safe = sanitizeImageUrl(raw, PLACEHOLDER);
  if (isEmailImagePlaceholderSrc(safe)) {
    component.addAttributes({ src: safe, "data-placeholder": "1" });
    component.addStyle({ "border-radius": "12px" });
  } else {
    component.addAttributes({ src: safe });
    component.removeAttributes("data-placeholder");
    component.addStyle({ "border-radius": "0" });
  }
}

function syncPreview(wrap: HTMLElement, value: string): void {
  const preview = wrap.querySelector(
    ".ed-trait-image-src__preview",
  ) as HTMLElement | null;
  const img = wrap.querySelector(
    ".ed-trait-image-src__thumb",
  ) as HTMLImageElement | null;
  if (!preview || !img) return;

  const src = value.trim();
  if (!src) {
    preview.hidden = true;
    img.removeAttribute("src");
    img.alt = "";
    return;
  }

  preview.hidden = false;
  if (img.getAttribute("src") !== src) {
    img.src = src;
  }
  img.alt = "Vorschaubild";
}

function syncUi(wrap: HTMLElement, value: string): void {
  const url = wrap.querySelector(
    ".ed-trait-image-src__url",
  ) as HTMLInputElement | null;
  if (url && url.value !== value) url.value = value;
  syncPreview(wrap, value);
}

/** Register TraitManager type `image-src`. */
export function registerImageSrcTrait(editor: Editor): void {
  const tm = editor.TraitManager;

  tm.addType("image-src", {
    createInput({ component }) {
      const wrap = document.createElement("div");
      wrap.className = "ed-trait-image-src";

      const preview = document.createElement("div");
      preview.className = "ed-trait-image-src__preview";
      preview.setAttribute("aria-hidden", "true");

      const thumb = document.createElement("img");
      thumb.className = "ed-trait-image-src__thumb";
      thumb.decoding = "async";
      thumb.loading = "lazy";
      thumb.alt = "";
      thumb.addEventListener("error", () => {
        preview.classList.add("is-broken");
      });
      thumb.addEventListener("load", () => {
        preview.classList.remove("is-broken");
      });
      preview.append(thumb);

      const url = document.createElement("input");
      url.type = "text";
      url.className = "ed-trait-image-src__url";
      url.placeholder = "https://… oder Upload";
      url.autocomplete = "off";
      url.spellcheck = false;
      url.setAttribute("aria-label", "Bild-URL");
      url.value = readSrc(component);

      const actions = document.createElement("div");
      actions.className = "ed-trait-image-src__actions";

      const file = document.createElement("input");
      file.type = "file";
      file.accept =
        "image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp";
      file.className = "ed-trait-image-src__file";
      file.setAttribute("aria-label", "Bild vom Computer");

      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "ed-trait-image-src__pick";
      pick.textContent = "Vom Computer hochladen";

      const status = document.createElement("p");
      status.className = "ed-trait-image-src__status";
      status.setAttribute("aria-live", "polite");
      status.hidden = true;

      pick.addEventListener("click", () => file.click());

      file.addEventListener("change", () => {
        const chosen = file.files?.[0];
        file.value = "";
        if (!chosen) return;

        status.hidden = false;
        status.textContent = "Hochladen…";
        status.classList.remove("is-error");
        pick.disabled = true;

        void uploadImageFile(chosen)
          .then((uploadedUrl) => {
            writeSrc(component, uploadedUrl);
            syncUi(wrap, uploadedUrl);
            status.textContent = "Hochgeladen (max. 2 MB)";
            wrap.dispatchEvent(new Event("change", { bubbles: true }));
          })
          .catch((err: unknown) => {
            status.classList.add("is-error");
            status.textContent =
              err instanceof Error ? err.message : "Upload fehlgeschlagen.";
          })
          .finally(() => {
            pick.disabled = false;
          });
      });

      url.addEventListener("change", () => {
        wrap.dispatchEvent(new Event("change", { bubbles: true }));
      });
      url.addEventListener("input", () => {
        syncPreview(wrap, url.value.trim());
      });
      url.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          wrap.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      actions.append(pick, file);
      wrap.append(preview, url, actions, status);
      syncPreview(wrap, url.value);
      return wrap;
    },

    onUpdate({ elInput, component }: TraitViewCtx) {
      syncUi(elInput, readSrc(component));
    },

    onEvent({ elInput, component }: TraitViewCtx) {
      const urlInput = elInput.querySelector(
        ".ed-trait-image-src__url",
      ) as HTMLInputElement | null;
      if (!urlInput) return;
      writeSrc(component, urlInput.value.trim());
      syncUi(elInput, readSrc(component));
    },
  });
}
