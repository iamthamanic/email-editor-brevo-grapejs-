/**
 * Social icon/link group recognition (scoped — never swallow parent mail).
 * Location: packages/legacy-importer/src/recognition/social.ts
 */

import type {
  SocialLinkItem,
  SocialLinksBlock,
  SocialNetwork,
} from "../document.js";
import { nextId } from "../ids.js";
import { textOf } from "./richText.js";

const NETWORKS: Array<{ network: SocialNetwork; test: RegExp }> = [
  { network: "tiktok", test: /tiktok\.com/i },
  { network: "linkedin", test: /linkedin\.com/i },
  { network: "instagram", test: /instagram\.com/i },
  { network: "facebook", test: /facebook\.com|fb\.com/i },
  { network: "youtube", test: /youtube\.com|youtu\.be/i },
  { network: "x", test: /(?:^|\.)x\.com|twitter\.com/i },
];

function detectNetwork(href: string, imageSrc: string): SocialNetwork {
  for (const n of NETWORKS) {
    if (n.test.test(href) || n.test.test(imageSrc)) return n.network;
  }
  if (/tiktok/i.test(imageSrc)) return "tiktok";
  if (/linkedin/i.test(imageSrc)) return "linkedin";
  if (/instagram/i.test(imageSrc)) return "instagram";
  if (/facebook|fb_/i.test(imageSrc)) return "facebook";
  if (/youtube|yt_/i.test(imageSrc)) return "youtube";
  return "other";
}

export function collectSocialItems(root: Element): SocialLinkItem[] {
  const items: SocialLinkItem[] = [];
  const seen = new Set<string>();
  for (const a of root.querySelectorAll("a[href]")) {
    const href = (a.getAttribute("href") ?? "").trim();
    if (!href || /^\s*javascript:/i.test(href)) continue;
    const img = a.querySelector("img");
    const imageSrc = img?.getAttribute("src") ?? "";
    const network = detectNetwork(href, imageSrc);
    if (network === "other" && !imageSrc) continue;
    if (
      network === "other" &&
      !/social|tiktok|linkedin|instagram|facebook|youtube|twitter/i.test(
        `${href} ${imageSrc}`,
      )
    ) {
      continue;
    }
    const key = `${network}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      network,
      href,
      imageSrc: imageSrc || undefined,
      label:
        (img?.getAttribute("alt") ?? a.textContent ?? "").trim() || undefined,
    });
  }
  return items;
}

/**
 * True only when this node is predominantly a social-icon row.
 * Must NOT match a parent that merely contains social links among other content.
 */
export function isSocialCluster(el: Element): boolean {
  const social = collectSocialItems(el).filter((i) => i.network !== "other");
  if (social.length < 2) return false;

  const socialHrefs = new Set(social.map((i) => i.href));

  // Nested multi-row tables alone do not disqualify: Brevo social icons are
  // often each wrapped in their own tiny table. Img/text/link checks below
  // still reject parent containers that mix body copy with socials.
  const nestedRows = el.querySelectorAll("table tr");
  if (nestedRows.length > 12 && social.length < 3) return false;

  // Non-social images (logo, cert, content) ⇒ not social-only
  for (const img of el.querySelectorAll("img")) {
    const anchor = img.closest("a");
    const href = anchor?.getAttribute("href") ?? "";
    if (!href || !socialHrefs.has(href)) return false;
  }

  // Strip social anchors; remaining visible text must be negligible
  const clone = el.cloneNode(true) as Element;
  for (const a of [...clone.querySelectorAll("a[href]")]) {
    const href = a.getAttribute("href") ?? "";
    if (socialHrefs.has(href)) a.remove();
  }
  const remainder = textOf(clone);
  if (remainder.length > 24) return false;

  // Non-social links still present ⇒ mixed content
  for (const a of el.querySelectorAll("a[href]")) {
    const href = (a.getAttribute("href") ?? "").trim();
    if (!href || /^\s*javascript:/i.test(href)) continue;
    if (!socialHrefs.has(href)) return false;
  }

  return true;
}

export function socialBlockFromElement(el: Element): SocialLinksBlock | null {
  if (!isSocialCluster(el)) return null;
  const items = collectSocialItems(el).filter((i) => i.network !== "other");
  if (items.length < 2) return null;
  return {
    id: nextId("social"),
    type: "social-links",
    items,
  };
}
