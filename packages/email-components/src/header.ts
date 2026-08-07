/**
 * GrapesJS email-header — centered brand logo section for imported emails.
 * Location: packages/email-components/src/header.ts
 */

import type { Editor } from "grapesjs";
import { BRAND_DEFAULTS, EMAIL_COLORS } from "./brandDefaults.js";
import { escapeHtml, sanitizeAltText, toPlainText } from "./text.js";
import { sanitizeImageUrl } from "./urls.js";

function headerInnerHtml(
  logoSrc: string,
  logoAlt: string,
  width: number,
  align: string,
  padding: string,
): string {
  const src = escapeHtml(logoSrc);
  const alt = escapeHtml(logoAlt);
  const w = Math.max(40, Math.min(600, width || 160));
  const textAlign =
    align === "left" || align === "right" ? align : "center";
  return `
    <tr>
      <td align="${textAlign}" style="padding:${escapeHtml(padding)};text-align:${textAlign};background-color:${EMAIL_COLORS.surface};">
        <img src="${src}" alt="${alt}" width="${w}" style="display:inline-block;max-width:100%;height:auto;border:0;" />
      </td>
    </tr>
  `;
}

export function registerEmailHeaderComponent(editor: Editor): void {
  const domc = editor.DomComponents;

  domc.addType("email-header", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-header",
    model: {
      defaults: {
        tagName: "table",
        droppable: false,
        editable: false,
        attributes: {
          "data-email-type": "email-header",
          "data-role": "header",
          width: "100%",
          cellpadding: "0",
          cellspacing: "0",
          border: "0",
        },
        style: {
          width: "100%",
          "border-collapse": "collapse",
        },
        logoSrc: BRAND_DEFAULTS.logoSrc,
        logoAlt: BRAND_DEFAULTS.logoAlt,
        logoWidth: 160,
        alignment: "center",
        padding: "16px 16px 24px 16px",
        traits: [
          { type: "text", name: "logoSrc", label: "Logo-URL", changeProp: true },
          { type: "text", name: "logoAlt", label: "Alt-Text", changeProp: true },
          { type: "number", name: "logoWidth", label: "Breite", changeProp: true },
          {
            type: "select",
            name: "alignment",
            label: "Ausrichtung",
            changeProp: true,
            options: [
              { id: "left", label: "Links" },
              { id: "center", label: "Zentriert" },
              { id: "right", label: "Rechts" },
            ],
          },
          { type: "text", name: "padding", label: "Padding", changeProp: true },
        ],
      },
      init() {
        const rebuild = () => {
          const logoSrc = sanitizeImageUrl(
            String(this.get("logoSrc") ?? ""),
            BRAND_DEFAULTS.logoSrc,
          );
          const logoAlt = sanitizeAltText(
            toPlainText(String(this.get("logoAlt") ?? ""), BRAND_DEFAULTS.logoAlt),
            BRAND_DEFAULTS.logoAlt,
          );
          const logoWidth = Number(this.get("logoWidth") ?? 160) || 160;
          const alignment = String(this.get("alignment") ?? "center");
          const padding = toPlainText(
            String(this.get("padding") ?? "16px 16px 24px 16px"),
            "16px 16px 24px 16px",
          );
          this.set("logoSrc", logoSrc, { silent: true });
          this.set("logoAlt", logoAlt, { silent: true });
          this.components(
            `<tbody>${headerInnerHtml(logoSrc, logoAlt, logoWidth, alignment, padding)}</tbody>`,
          );
        };
        rebuild();
        this.on(
          "change:logoSrc change:logoAlt change:logoWidth change:alignment change:padding",
          rebuild,
        );
      },
    },
  });
}
