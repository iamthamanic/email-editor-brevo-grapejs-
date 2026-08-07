/**
 * Unit tests for linked saved-section snapshot replace.
 * Location: apps/api/src/saved-sections/sync.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

function stampSource(
  data: Record<string, unknown>,
  savedSectionId: string,
  version: number,
  mode: "linked" | "detached",
): Record<string, unknown> {
  const attrs = {
    ...((data.attributes as Record<string, unknown>) ?? {}),
    "data-saved-section-id": savedSectionId,
    "data-saved-section-version": String(version),
    "data-saved-section-mode": mode,
  };
  return { ...data, attributes: attrs };
}

function replaceLinkedSection(
  root: unknown,
  savedSectionId: string,
  version: number,
  snapshot: Record<string, unknown>,
): Record<string, unknown> | null {
  let changed = false;
  function walk(node: unknown): unknown {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(walk);
    const obj = node as Record<string, unknown>;
    const attrs = (obj.attributes ?? {}) as Record<string, unknown>;
    const id = String(attrs["data-saved-section-id"] ?? "");
    const mode = String(attrs["data-saved-section-mode"] ?? "");
    if (id === savedSectionId && mode === "linked") {
      changed = true;
      return stampSource(snapshot, savedSectionId, version, "linked");
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walk(v);
    return out;
  }
  const result = walk(root) as Record<string, unknown>;
  return changed ? result : null;
}

describe("saved section linked sync", () => {
  it("updates linked snapshots and leaves detached alone", () => {
    const snapV2 = {
      type: "email-section",
      name: "Footer v2",
      components: [{ type: "email-text", content: "v2" }],
    };
    const project = {
      pages: [
        {
          frames: [
            {
              component: {
                components: [
                  stampSource(
                    { type: "email-section", name: "A", components: [] },
                    "sec-1",
                    1,
                    "linked",
                  ),
                  stampSource(
                    { type: "email-section", name: "B", components: [] },
                    "sec-1",
                    1,
                    "detached",
                  ),
                ],
              },
            },
          ],
        },
      ],
    };

    const next = replaceLinkedSection(project, "sec-1", 2, snapV2);
    assert.ok(next);
    const comps = (
      (
        (next.pages as unknown[])[0] as {
          frames: Array<{ component: { components: Array<Record<string, unknown>> } }>;
        }
      ).frames[0]!.component.components
    );
    assert.equal(
      (comps[0]!.attributes as Record<string, string>)[
        "data-saved-section-version"
      ],
      "2",
    );
    assert.equal(comps[0]!.name, "Footer v2");
    assert.equal(comps[1]!.name, "B");
    assert.equal(
      (comps[1]!.attributes as Record<string, string>)[
        "data-saved-section-mode"
      ],
      "detached",
    );
  });
});
