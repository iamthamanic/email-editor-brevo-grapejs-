/**
 * Unit tests: RTE contenteditable heal.
 * Location: packages/email-components/src/clickToEdit.test.ts
 *
 * Caret placement (param-adjacent / mid-click) is covered by
 * apps/editor/e2e/verify-param-mid-caret-brevo-rte.spec.ts — linkedom has no Selection API.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { healRteContentEditable } from "./clickToEdit.js";

type FakeNode = {
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  hasAttribute: (name: string) => boolean;
  closest: (selector: string) => FakeNode | null;
  querySelectorAll: (selector: string) => FakeNode[];
};

function el(
  attrs: Record<string, string> = {},
  kids: FakeNode[] = [],
): FakeNode {
  const map = { ...attrs };
  const node: FakeNode = {
    getAttribute: (name) => map[name] ?? null,
    setAttribute: (name, value) => {
      map[name] = value;
    },
    removeAttribute: (name) => {
      delete map[name];
    },
    hasAttribute: (name) => name in map,
    closest: (selector) => {
      if (
        selector.includes("email-param") &&
        map["data-email-type"] === "email-param"
      ) {
        return node;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      const all = [
        node,
        ...kids,
        ...kids.flatMap((k) => k.querySelectorAll("*")),
      ];
      if (
        selector ===
        '[data-email-type="email-param"], [data-email-type="email-image"], [data-email-type="email-button"]'
      ) {
        return all.filter(
          (n) =>
            n.getAttribute("data-email-type") === "email-param" ||
            n.getAttribute("data-email-type") === "email-image" ||
            n.getAttribute("data-email-type") === "email-button",
        );
      }
      if (selector === '[contenteditable="false"]') {
        return all.filter((n) => n.getAttribute("contenteditable") === "false");
      }
      if (selector === "*") return kids;
      return [];
    },
  };
  return node;
}

describe("healRteContentEditable", () => {
  it("strips contenteditable=false from nested body nodes, keeps params", () => {
    const param = el({
      "data-email-type": "email-param",
      contenteditable: "false",
    });
    const p = el({ contenteditable: "false" }, [param]);
    const wrap = el({ contenteditable: "false" }, [p]);
    const host = el(
      { "data-email-type": "email-text", contenteditable: "true" },
      [wrap],
    );

    const all = [wrap, p, param];
    host.querySelectorAll = (selector: string) => {
      if (selector.startsWith("[data-email-type=")) {
        return all.filter((n) => {
          const t = n.getAttribute("data-email-type");
          return (
            t === "email-param" || t === "email-image" || t === "email-button"
          );
        });
      }
      if (selector === '[contenteditable="false"]') {
        return all.filter((n) => n.getAttribute("contenteditable") === "false");
      }
      return [];
    };

    healRteContentEditable(host as unknown as HTMLElement);

    assert.equal(host.getAttribute("contenteditable"), "true");
    assert.equal(wrap.hasAttribute("contenteditable"), false);
    assert.equal(p.hasAttribute("contenteditable"), false);
    assert.equal(param.getAttribute("contenteditable"), "false");
  });

  it("no-ops on null", () => {
    healRteContentEditable(null);
  });
});
