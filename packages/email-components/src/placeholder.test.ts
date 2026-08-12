/**
 * Unit tests: email-text placeholder must not wipe real content.
 * Location: packages/email-components/src/placeholder.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMAIL_TEXT_PLACEHOLDER,
  healEmailTextPlaceholderFlag,
  isEmailTextPlaceholder,
} from "./register.js";

type Attrs = Record<string, string>;

function fakeText(opts: {
  placeholder?: string;
  content?: string;
  textContent?: string;
}) {
  let attrs: Attrs = {
    "data-email-type": "email-text",
  };
  if (opts.placeholder !== undefined) {
    attrs["data-placeholder"] = opts.placeholder;
  }
  return {
    getAttributes: () => attrs,
    removeAttributes: (key: string) => {
      delete attrs[key];
    },
    get: (k: string) => (k === "content" ? (opts.content ?? "") : undefined),
    getEl: () =>
      opts.textContent !== undefined
        ? ({ textContent: opts.textContent } as HTMLElement)
        : null,
  };
}

describe("isEmailTextPlaceholder", () => {
  it("is true for flagged empty / placeholder starters", () => {
    assert.equal(
      isEmailTextPlaceholder(
        fakeText({
          placeholder: "1",
          content: EMAIL_TEXT_PLACEHOLDER,
          textContent: EMAIL_TEXT_PLACEHOLDER,
        }) as never,
      ),
      true,
    );
    assert.equal(
      isEmailTextPlaceholder(
        fakeText({ placeholder: "1", content: "", textContent: "" }) as never,
      ),
      true,
    );
  });

  it("is false when flag is set but real copy exists", () => {
    assert.equal(
      isEmailTextPlaceholder(
        fakeText({
          placeholder: "1",
          content: "<p>Sehr geehrte/r …</p>",
          textContent: "Sehr geehrte/r …",
        }) as never,
      ),
      false,
    );
  });

  it("is false without the flag", () => {
    assert.equal(
      isEmailTextPlaceholder(
        fakeText({ content: EMAIL_TEXT_PLACEHOLDER }) as never,
      ),
      false,
    );
  });
});

describe("healEmailTextPlaceholderFlag", () => {
  it("removes stale flag from real content", () => {
    const comp = fakeText({
      placeholder: "1",
      textContent: "Hallo Kunde",
      content: "Hallo Kunde",
    });
    healEmailTextPlaceholderFlag(comp as never);
    assert.equal(comp.getAttributes()["data-placeholder"], undefined);
  });

  it("keeps flag on genuine placeholder", () => {
    const comp = fakeText({
      placeholder: "1",
      textContent: EMAIL_TEXT_PLACEHOLDER,
      content: EMAIL_TEXT_PLACEHOLDER,
    });
    healEmailTextPlaceholderFlag(comp as never);
    assert.equal(comp.getAttributes()["data-placeholder"], "1");
  });
});
