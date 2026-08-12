/**
 * ERP JWT HS256 unit tests.
 * Location: apps/api/src/auth/erpJwt.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signErpHs256Jwt, verifyErpHs256Jwt } from "./erpJwt.js";

describe("erpJwt", () => {
  const secret = "test-secret-for-jwt";

  it("round-trips permissions claim", () => {
    const token = signErpHs256Jwt(
      {
        sub: "u1",
        displayName: "Ada",
        permissions: ["email_templates.read", "email_templates.edit", "nope"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secret,
    );
    const user = verifyErpHs256Jwt(token, secret);
    assert.equal(user.id, "u1");
    assert.equal(user.displayName, "Ada");
    assert.deepEqual(user.permissions, [
      "email_templates.read",
      "email_templates.edit",
    ]);
  });

  it("maps Authorized_Works alias", () => {
    const token = signErpHs256Jwt(
      {
        sub: "u2",
        Authorized_Works: ["email_templates.publish"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secret,
    );
    const user = verifyErpHs256Jwt(token, secret);
    assert.deepEqual(user.permissions, ["email_templates.publish"]);
  });

  it("rejects bad signature", () => {
    const token = signErpHs256Jwt(
      { sub: "u3", exp: Math.floor(Date.now() / 1000) + 3600 },
      secret,
    );
    assert.throws(() => verifyErpHs256Jwt(token, "other-secret"));
  });

  it("rejects missing exp", () => {
    const token = signErpHs256Jwt({ sub: "u4", permissions: [] }, secret);
    assert.throws(() => verifyErpHs256Jwt(token, secret), /missing exp/);
  });

  it("rejects expired exp", () => {
    const token = signErpHs256Jwt(
      { sub: "u5", exp: Math.floor(Date.now() / 1000) - 60 },
      secret,
    );
    assert.throws(() => verifyErpHs256Jwt(token, secret), /expired/);
  });
});
