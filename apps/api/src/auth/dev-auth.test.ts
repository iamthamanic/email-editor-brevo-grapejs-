/**
 * Unit tests for fail-closed DevAuth helpers.
 * Location: apps/api/src/auth/dev-auth.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  assertSafeDevBind,
  getAuthMode,
  isDevAuthEnabled,
  isLoopbackHost,
} from "./dev-auth.js";

const originalAuth = process.env.AUTH_MODE;
const originalAllow = process.env.ALLOW_INSECURE_DEV;

afterEach(() => {
  if (originalAuth === undefined) delete process.env.AUTH_MODE;
  else process.env.AUTH_MODE = originalAuth;
  if (originalAllow === undefined) delete process.env.ALLOW_INSECURE_DEV;
  else process.env.ALLOW_INSECURE_DEV = originalAllow;
});

describe("getAuthMode fail-closed", () => {
  it("returns null when AUTH_MODE unset", () => {
    delete process.env.AUTH_MODE;
    assert.equal(getAuthMode(), null);
    assert.equal(isDevAuthEnabled(), false);
  });

  it("enables dev only for explicit AUTH_MODE=dev", () => {
    process.env.AUTH_MODE = "dev";
    assert.equal(getAuthMode(), "dev");
    assert.equal(isDevAuthEnabled(), true);
  });

  it("does not treat erp/empty as dev", () => {
    process.env.AUTH_MODE = "erp";
    assert.equal(isDevAuthEnabled(), false);
    process.env.AUTH_MODE = "  ";
    assert.equal(getAuthMode(), null);
  });
});

describe("assertSafeDevBind", () => {
  it("allows loopback with AUTH_MODE=dev", () => {
    process.env.AUTH_MODE = "dev";
    assert.doesNotThrow(() => assertSafeDevBind("127.0.0.1"));
    assert.ok(isLoopbackHost("localhost"));
  });

  it("refuses non-loopback DevAuth without override", () => {
    process.env.AUTH_MODE = "dev";
    delete process.env.ALLOW_INSECURE_DEV;
    assert.throws(() => assertSafeDevBind("0.0.0.0"), /Refusing AUTH_MODE=dev/);
  });

  it("allows non-loopback when ALLOW_INSECURE_DEV=1", () => {
    process.env.AUTH_MODE = "dev";
    process.env.ALLOW_INSECURE_DEV = "1";
    assert.doesNotThrow(() => assertSafeDevBind("0.0.0.0"));
  });
});
