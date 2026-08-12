/**
 * Unit tests for Brevo sender allowlist helpers.
 * Location: apps/api/src/brevo/senderAllowlist.test.ts
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  assertVerifiedSenderEmail,
  clearSenderAllowlistCache,
  isActiveVerifiedSender,
  SenderAllowlistError,
} from "./senderAllowlist.js";

describe("senderAllowlist", () => {
  beforeEach(() => clearSenderAllowlistCache());

  it("accepts active verified emails", () => {
    assert.equal(
      isActiveVerifiedSender("a@x.de", [
        { id: 1, name: "A", email: "a@x.de", active: true },
      ]),
      true,
    );
  });

  it("rejects inactive or unknown", () => {
    assert.equal(
      isActiveVerifiedSender("a@x.de", [
        { id: 1, name: "A", email: "a@x.de", active: false },
      ]),
      false,
    );
    assert.equal(isActiveVerifiedSender("b@x.de", []), false);
  });

  it("assertVerifiedSenderEmail throws for unknown", async () => {
    await assert.rejects(
      () =>
        assertVerifiedSenderEmail("evil@x.de", {
          fetchList: async () => [
            { id: 1, name: "Ok", email: "ok@x.de", active: true },
          ],
        }),
      (err: unknown) =>
        err instanceof SenderAllowlistError && err.httpStatus === 400,
    );
  });

  it("assertVerifiedSenderEmail passes for listed active", async () => {
    await assertVerifiedSenderEmail("ok@x.de", {
      fetchList: async () => [
        { id: 1, name: "Ok", email: "ok@x.de", active: true },
      ],
    });
  });
});
