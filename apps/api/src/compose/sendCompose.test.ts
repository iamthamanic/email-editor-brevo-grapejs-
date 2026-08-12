/**
 * Unit tests for compose send validation (no Brevo network).
 * Location: apps/api/src/compose/sendCompose.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ComposeSendError, sendComposeEmail } from "./sendCompose.js";

const originalSender = process.env.BREVO_DEFAULT_SENDER_EMAIL;

afterEach(() => {
  if (originalSender === undefined) {
    delete process.env.BREVO_DEFAULT_SENDER_EMAIL;
  } else {
    process.env.BREVO_DEFAULT_SENDER_EMAIL = originalSender;
  }
});

describe("sendComposeEmail validation", () => {
  it("rejects empty to", async () => {
    await assert.rejects(
      () =>
        sendComposeEmail({
          to: [],
          subject: "Hi",
          html: "<p>x</p>",
        }),
      (err: unknown) =>
        err instanceof ComposeSendError && err.httpStatus === 400,
    );
  });

  it("rejects missing subject", async () => {
    await assert.rejects(
      () =>
        sendComposeEmail({
          to: ["a@b.co"],
          subject: "  ",
          html: "<p>x</p>",
        }),
      (err: unknown) =>
        err instanceof ComposeSendError && /Betreff/i.test((err as Error).message),
    );
  });

  it("rejects invalid email", async () => {
    await assert.rejects(
      () =>
        sendComposeEmail({
          to: ["not-an-email"],
          subject: "Hi",
          html: "<p>x</p>",
        }),
      (err: unknown) =>
        err instanceof ComposeSendError &&
        /Ungültige/i.test((err as Error).message),
    );
  });

  it("rejects missing sender env", async () => {
    delete process.env.BREVO_DEFAULT_SENDER_EMAIL;
    await assert.rejects(
      () =>
        sendComposeEmail({
          to: ["a@b.co"],
          subject: "Hi",
          html: "<p>x</p>",
        }),
      (err: unknown) =>
        err instanceof ComposeSendError &&
        /BREVO_DEFAULT_SENDER_EMAIL/i.test((err as Error).message),
    );
  });
});
