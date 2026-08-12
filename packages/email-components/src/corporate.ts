/**
 * Corporate (Firma) GrapesJS component types — locked shells + traits.
 * Location: packages/email-components/src/corporate.ts
 * Hides: company-* DomComponents wiring.
 */

import type { Component, Editor } from "grapesjs";
import { BRAND_DEFAULTS, EMAIL_COLORS, EMAIL_FONT_STACK } from "./brandDefaults.js";
import { escapeHtml, sanitizeAltText, toPlainText } from "./text.js";
import { sanitizeImageUrl, sanitizeLinkUrl } from "./urls.js";

const FONT = EMAIL_FONT_STACK;

function ensureDefaultVariant(model: Component): void {
  const v = String(model.get("variant") ?? BRAND_DEFAULTS.variant);
  if (v !== "default") {
    model.set("variant", "default");
  }
}

function normalizeMailto(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (/^mailto:/i.test(trimmed)) return sanitizeLinkUrl(trimmed, fallback);
  if (trimmed.includes("@")) return sanitizeLinkUrl(`mailto:${trimmed}`, fallback);
  return sanitizeLinkUrl(trimmed, fallback);
}

function normalizeTel(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (/^tel:/i.test(trimmed)) return sanitizeLinkUrl(trimmed, fallback);
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits) return sanitizeLinkUrl(`tel:${digits}`, fallback);
  return sanitizeLinkUrl(trimmed, fallback);
}

function headerHtml(logoSrc: string, logoAlt: string, companyName: string): string {
  const src = escapeHtml(logoSrc);
  const alt = escapeHtml(logoAlt);
  const name = escapeHtml(companyName);
  return `
    <tr>
      <td style="padding:16px;background-color:${EMAIL_COLORS.surface};border-bottom:1px solid ${EMAIL_COLORS.border};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;">
              <img src="${src}" alt="${alt}" width="160" style="display:block;max-width:160px;height:auto;border:0;" />
            </td>
            <td style="vertical-align:middle;text-align:right;font-family:${FONT};font-size:16px;font-weight:bold;color:${EMAIL_COLORS.primary};">
              ${name}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function footerHtml(companyName: string, addressLine: string): string {
  return `
    <tr>
      <td style="padding:16px;background-color:${EMAIL_COLORS.surface};border-top:1px solid ${EMAIL_COLORS.border};font-family:${FONT};font-size:13px;color:${EMAIL_COLORS.textMuted};line-height:1.5;">
        <strong style="color:${EMAIL_COLORS.text};">${escapeHtml(companyName)}</strong><br/>
        ${escapeHtml(addressLine)}
      </td>
    </tr>
  `;
}

function legalHtml(legalText: string): string {
  return `
    <tr>
      <td style="padding:12px 16px;font-family:${FONT};font-size:11px;color:${EMAIL_COLORS.textMuted};line-height:1.4;">
        ${escapeHtml(legalText)}
      </td>
    </tr>
  `;
}

function contactHtml(
  emailHref: string,
  emailLabel: string,
  phoneHref: string,
  phoneLabel: string,
  website: string,
  logoSrc?: string,
  companyName?: string,
  addressLine?: string,
): string {
  const logo =
    logoSrc && logoSrc.trim()
      ? `<img src="${escapeHtml(sanitizeImageUrl(logoSrc, ""))}" alt="${escapeHtml(companyName || "Logo")}" width="64" style="display:block;max-width:64px;height:auto;border:0;margin:0 0 12px 0;" /><br/>`
      : "";
  const name =
    companyName && companyName.trim()
      ? `<strong style="color:${EMAIL_COLORS.text};">${escapeHtml(companyName)}</strong><br/>`
      : "";
  const address =
    addressLine && addressLine.trim()
      ? `${escapeHtml(addressLine)}<br/>`
      : "";
  return `
    <tr>
      <td style="padding:16px;font-family:${FONT};font-size:14px;color:${EMAIL_COLORS.text};line-height:1.6;">
        ${logo}${name}${address}
        <a href="${escapeHtml(emailHref)}" style="color:${EMAIL_COLORS.primary};text-decoration:none;">${escapeHtml(emailLabel)}</a><br/>
        <a href="${escapeHtml(phoneHref)}" style="color:${EMAIL_COLORS.primary};text-decoration:none;">${escapeHtml(phoneLabel)}</a><br/>
        <a href="${escapeHtml(website)}" style="color:${EMAIL_COLORS.primary};text-decoration:underline;">${escapeHtml(website)}</a>
      </td>
    </tr>
  `;
}

function socialHtml(linkedin: string, xUrl: string, website: string): string {
  const linkStyle = `color:${EMAIL_COLORS.primary};text-decoration:underline;font-family:${FONT};font-size:14px;`;
  return `
    <tr>
      <td align="center" style="padding:16px;text-align:center;">
        <a href="${escapeHtml(linkedin)}" style="${linkStyle}">LinkedIn</a>
        &nbsp;|&nbsp;
        <a href="${escapeHtml(xUrl)}" style="${linkStyle}">X</a>
        &nbsp;|&nbsp;
        <a href="${escapeHtml(website)}" style="${linkStyle}">Web</a>
      </td>
    </tr>
  `;
}

type SocialIconItem = {
  network?: string;
  href: string;
  imageSrc?: string;
  label?: string;
};

function socialIconsHtml(items: SocialIconItem[]): string {
  const icons = items
    .map((item) => {
      const href = sanitizeLinkUrl(item.href, "#");
      const label = escapeHtml(item.label || item.network || "Social");
      const img = item.imageSrc
        ? `<img src="${escapeHtml(sanitizeImageUrl(item.imageSrc, ""))}" alt="${label}" width="32" height="32" style="display:inline-block;border:0;" />`
        : label;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px;vertical-align:middle;">${img}</a>`;
    })
    .join("");
  return `
    <tr>
      <td align="center" style="padding:16px;text-align:center;">
        ${icons}
      </td>
    </tr>
  `;
}

function parseSocialItems(raw: unknown): SocialIconItem[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const items: SocialIconItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const href = String((row as { href?: unknown }).href ?? "").trim();
      if (!href) continue;
      items.push({
        network: String((row as { network?: unknown }).network ?? ""),
        href,
        imageSrc: String((row as { imageSrc?: unknown }).imageSrc ?? "") || undefined,
        label: String((row as { label?: unknown }).label ?? "") || undefined,
      });
    }
    return items.length ? items : null;
  } catch {
    return null;
  }
}

function tableShell(
  type: string,
  inner: string,
): { tagName: string; attributes: Record<string, string>; components: string; style: Record<string, string> } {
  return {
    tagName: "table",
    attributes: {
      "data-email-type": type,
      variant: BRAND_DEFAULTS.variant,
      width: "100%",
      cellpadding: "0",
      cellspacing: "0",
      border: "0",
    },
    style: {
      width: "100%",
      "border-collapse": "collapse",
    },
    components: `<tbody>${inner}</tbody>`,
  };
}

/** After HTML parse, freeze nested nodes so only parent traits control content (F-02). */
function lockDescendants(model: Component): void {
  const lock = (node: Component) => {
    node.set({
      editable: false,
      selectable: false,
      hoverable: false,
      draggable: false,
      droppable: false,
      highlightable: false,
      badgable: false,
      copyable: false,
      removable: false,
      layerable: false,
    });
    const col = node.components() as {
      forEach?: (cb: (c: Component) => void) => void;
      models?: Component[];
    };
    if (typeof col.forEach === "function") {
      col.forEach((child) => lock(child));
      return;
    }
    for (const child of col.models ?? []) {
      lock(child);
    }
  };

  const root = model.components() as {
    forEach?: (cb: (c: Component) => void) => void;
    models?: Component[];
  };
  if (typeof root.forEach === "function") {
    root.forEach((child) => lock(child));
    return;
  }
  for (const child of root.models ?? []) {
    lock(child);
  }
}

function setShellHtml(model: Component, html: string): void {
  model.components(html);
  lockDescendants(model);
}

export function registerCorporateComponents(editor: Editor): void {
  const domc = editor.DomComponents;

  domc.addType("company-header", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "company-header",
    model: {
      defaults: {
        ...tableShell(
          "company-header",
          headerHtml(
            BRAND_DEFAULTS.logoSrc,
            BRAND_DEFAULTS.logoAlt,
            BRAND_DEFAULTS.companyName,
          ),
        ),
        droppable: false,
        editable: false,
        logoSrc: BRAND_DEFAULTS.logoSrc,
        companyName: BRAND_DEFAULTS.companyName,
        variant: BRAND_DEFAULTS.variant,
        traits: [
          { type: "text", name: "logoSrc", label: "Logo-URL", changeProp: true },
          { type: "text", name: "companyName", label: "Firmenname", changeProp: true },
          { type: "text", name: "variant", label: "Variante", changeProp: true },
        ],
      },
      init() {
        const rebuild = () => {
          ensureDefaultVariant(this);
          const logoSrc = sanitizeImageUrl(
            String(this.get("logoSrc") ?? ""),
            BRAND_DEFAULTS.logoSrc,
          );
          if (logoSrc !== this.get("logoSrc")) {
            this.set("logoSrc", logoSrc, { silent: true });
          }
          const companyName = toPlainText(
            String(this.get("companyName") ?? ""),
            BRAND_DEFAULTS.companyName,
          );
          if (companyName !== this.get("companyName")) {
            this.set("companyName", companyName, { silent: true });
          }
          const alt = sanitizeAltText(companyName, BRAND_DEFAULTS.logoAlt);
          setShellHtml(
            this,
            `<tbody>${headerHtml(logoSrc, alt, companyName)}</tbody>`,
          );
        };
        rebuild();
        this.on("change:logoSrc change:companyName change:variant", rebuild);
      },
    },
  });

  domc.addType("company-footer", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "company-footer",
    model: {
      defaults: {
        ...tableShell(
          "company-footer",
          footerHtml(BRAND_DEFAULTS.companyName, BRAND_DEFAULTS.addressLine),
        ),
        droppable: false,
        editable: false,
        companyName: BRAND_DEFAULTS.companyName,
        addressLine: BRAND_DEFAULTS.addressLine,
        variant: BRAND_DEFAULTS.variant,
        traits: [
          { type: "text", name: "companyName", label: "Firmenname", changeProp: true },
          { type: "text", name: "addressLine", label: "Adresse", changeProp: true },
          { type: "text", name: "variant", label: "Variante", changeProp: true },
        ],
      },
      init() {
        const rebuild = () => {
          ensureDefaultVariant(this);
          const companyName = toPlainText(
            String(this.get("companyName") ?? ""),
            BRAND_DEFAULTS.companyName,
          );
          const addressLine = toPlainText(
            String(this.get("addressLine") ?? ""),
            BRAND_DEFAULTS.addressLine,
          );
          this.set("companyName", companyName, { silent: true });
          this.set("addressLine", addressLine, { silent: true });
          setShellHtml(
            this,
            `<tbody>${footerHtml(companyName, addressLine)}</tbody>`,
          );
        };
        rebuild();
        this.on("change:companyName change:addressLine change:variant", rebuild);
      },
    },
  });

  domc.addType("company-legal", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "company-legal",
    model: {
      defaults: {
        ...tableShell("company-legal", legalHtml(BRAND_DEFAULTS.legalText)),
        droppable: false,
        editable: false,
        legalText: BRAND_DEFAULTS.legalText,
        variant: BRAND_DEFAULTS.variant,
        traits: [
          { type: "text", name: "legalText", label: "Rechtstext", changeProp: true },
          { type: "text", name: "variant", label: "Variante", changeProp: true },
        ],
      },
      init() {
        const rebuild = () => {
          ensureDefaultVariant(this);
          const legalText = toPlainText(
            String(this.get("legalText") ?? ""),
            BRAND_DEFAULTS.legalText,
          );
          this.set("legalText", legalText, { silent: true });
          setShellHtml(this, `<tbody>${legalHtml(legalText)}</tbody>`);
        };
        rebuild();
        this.on("change:legalText change:variant", rebuild);
      },
    },
  });

  domc.addType("company-contact", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "company-contact",
    model: {
      defaults: {
        ...tableShell(
          "company-contact",
          contactHtml(
            BRAND_DEFAULTS.emailHref,
            BRAND_DEFAULTS.emailLabel,
            BRAND_DEFAULTS.phoneHref,
            BRAND_DEFAULTS.phoneLabel,
            BRAND_DEFAULTS.website,
          ),
        ),
        droppable: false,
        editable: false,
        email: BRAND_DEFAULTS.emailLabel,
        phone: BRAND_DEFAULTS.phoneLabel,
        website: BRAND_DEFAULTS.website,
        // Empty by default — do NOT inject brand logo (avoids footer duplicates)
        logoSrc: "",
        companyName: "",
        addressLine: "",
        variant: BRAND_DEFAULTS.variant,
        traits: [
          { type: "text", name: "logoSrc", label: "Logo-URL", changeProp: true },
          { type: "text", name: "companyName", label: "Firmenname", changeProp: true },
          { type: "text", name: "addressLine", label: "Adresse", changeProp: true },
          { type: "text", name: "email", label: "E-Mail", changeProp: true },
          { type: "text", name: "phone", label: "Telefon", changeProp: true },
          { type: "text", name: "website", label: "Website", changeProp: true },
          { type: "text", name: "variant", label: "Variante", changeProp: true },
        ],
      },
      init() {
        const rebuild = () => {
          ensureDefaultVariant(this);
          const emailRaw = String(this.get("email") ?? "");
          const phoneRaw = String(this.get("phone") ?? "");
          const website = sanitizeLinkUrl(
            String(this.get("website") ?? ""),
            BRAND_DEFAULTS.website,
          );
          const emailHref = normalizeMailto(emailRaw, BRAND_DEFAULTS.emailHref);
          const phoneHref = normalizeTel(phoneRaw, BRAND_DEFAULTS.phoneHref);
          const emailLabel = toPlainText(
            emailRaw.replace(/^mailto:/i, ""),
            BRAND_DEFAULTS.emailLabel,
          );
          const phoneLabel = toPlainText(
            phoneRaw.replace(/^tel:/i, ""),
            BRAND_DEFAULTS.phoneLabel,
          );
          const logoRaw = String(this.get("logoSrc") ?? "").trim();
          const logoSrc = logoRaw
            ? sanitizeImageUrl(logoRaw, "")
            : "";
          const companyName = toPlainText(
            String(this.get("companyName") ?? ""),
            "",
          );
          const addressLine = toPlainText(
            String(this.get("addressLine") ?? ""),
            "",
          );
          this.set("website", website, { silent: true });
          if (logoSrc !== logoRaw) {
            this.set("logoSrc", logoSrc, { silent: true });
          }
          setShellHtml(
            this,
            `<tbody>${contactHtml(
              emailHref,
              emailLabel,
              phoneHref,
              phoneLabel,
              website,
              logoSrc || undefined,
              companyName || undefined,
              addressLine || undefined,
            )}</tbody>`,
          );
        };
        rebuild();
        this.on(
          "change:email change:phone change:website change:logoSrc change:companyName change:addressLine change:variant",
          rebuild,
        );
      },
    },
  });

  domc.addType("company-social", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "company-social",
    model: {
      defaults: {
        ...tableShell(
          "company-social",
          socialHtml(
            BRAND_DEFAULTS.linkedinUrl,
            BRAND_DEFAULTS.xUrl,
            BRAND_DEFAULTS.website,
          ),
        ),
        attributes: {
          "data-email-type": "company-social",
          variant: BRAND_DEFAULTS.variant,
          width: "100%",
          cellpadding: "0",
          cellspacing: "0",
          border: "0",
          align: "center",
        },
        style: {
          width: "100%",
          "border-collapse": "collapse",
          "text-align": "center",
          margin: "0 auto",
        },
        droppable: false,
        editable: false,
        linkedinUrl: BRAND_DEFAULTS.linkedinUrl,
        xUrl: BRAND_DEFAULTS.xUrl,
        websiteUrl: BRAND_DEFAULTS.website,
        variant: BRAND_DEFAULTS.variant,
        traits: [
          { type: "text", name: "linkedinUrl", label: "LinkedIn-URL", changeProp: true },
          { type: "text", name: "xUrl", label: "X-URL", changeProp: true },
          { type: "text", name: "websiteUrl", label: "Website-URL", changeProp: true },
          { type: "text", name: "variant", label: "Variante", changeProp: true },
        ],
      },
      init() {
        const rebuild = () => {
          ensureDefaultVariant(this);
          const attrs = this.getAttributes() as Record<string, string>;
          const iconItems = parseSocialItems(attrs["data-social-items"]);
          if (iconItems) {
            setShellHtml(this, `<tbody>${socialIconsHtml(iconItems)}</tbody>`);
            return;
          }
          const linkedinUrl = sanitizeLinkUrl(
            String(this.get("linkedinUrl") ?? ""),
            BRAND_DEFAULTS.linkedinUrl,
          );
          const xUrl = sanitizeLinkUrl(
            String(this.get("xUrl") ?? ""),
            BRAND_DEFAULTS.xUrl,
          );
          const websiteUrl = sanitizeLinkUrl(
            String(this.get("websiteUrl") ?? ""),
            BRAND_DEFAULTS.website,
          );
          this.set("linkedinUrl", linkedinUrl, { silent: true });
          this.set("xUrl", xUrl, { silent: true });
          this.set("websiteUrl", websiteUrl, { silent: true });
          setShellHtml(
            this,
            `<tbody>${socialHtml(linkedinUrl, xUrl, websiteUrl)}</tbody>`,
          );
        };
        rebuild();
        this.on(
          "change:linkedinUrl change:xUrl change:websiteUrl change:variant change:attributes:data-social-items",
          rebuild,
        );
      },
    },
  });
}
