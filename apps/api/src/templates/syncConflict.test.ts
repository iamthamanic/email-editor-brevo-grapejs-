/**
 * Unit tests for sync conflict helpers.
 * Location: apps/api/src/templates/syncConflict.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EmailTemplate } from "@prisma/client";
import {
  buildPendingRemote,
  hashHtml,
  isLocallyDirty,
  mustStashRemoteOnDiff,
  parsePendingRemote,
} from "./syncConflict.js";

function row(partial: Partial<EmailTemplate>): EmailTemplate {
  const now = new Date("2026-08-10T12:00:00.000Z");
  return {
    id: "t1",
    brevoTemplateId: null,
    name: "T",
    label: null,
    subject: null,
    senderName: null,
    senderEmail: null,
    replyTo: null,
    status: "DRAFT",
    source: "LOCAL",
    editorData: {},
    publishedHtml: null,
    publishedEditorData: null,
    editorSchemaVersion: 2,
    conversionMeta: null,
    brevoModifiedAt: null,
    lastSyncedAt: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    ...partial,
  } as EmailTemplate;
}

describe("isLocallyDirty", () => {
  it("is dirty when updated after publishedAt", () => {
    const publishedAt = new Date("2026-08-10T10:00:00.000Z");
    const updatedAt = new Date("2026-08-10T11:00:00.000Z");
    assert.equal(isLocallyDirty(row({ publishedAt, updatedAt })), true);
  });

  it("is clean when updated equals publishedAt within slack", () => {
    const publishedAt = new Date("2026-08-10T10:00:00.000Z");
    assert.equal(
      isLocallyDirty(row({ publishedAt, updatedAt: publishedAt })),
      false,
    );
  });

  it("uses lastSyncedAt when never published", () => {
    const lastSyncedAt = new Date("2026-08-10T10:00:00.000Z");
    const updatedAt = new Date("2026-08-10T11:00:00.000Z");
    assert.equal(isLocallyDirty(row({ lastSyncedAt, updatedAt })), true);
    assert.equal(
      isLocallyDirty(row({ lastSyncedAt, updatedAt: lastSyncedAt })),
      false,
    );
  });
});

describe("mustStashRemoteOnDiff", () => {
  it("stashes when CONFLICT even if timestamps look clean", () => {
    const lastSyncedAt = new Date("2026-08-10T12:00:00.000Z");
    assert.equal(
      mustStashRemoteOnDiff(
        row({
          status: "CONFLICT",
          lastSyncedAt,
          updatedAt: lastSyncedAt,
          publishedHtml: "<p>old</p>",
        }),
      ),
      true,
    );
  });

  it("stashes when REMOTE_CHANGED", () => {
    assert.equal(
      mustStashRemoteOnDiff(row({ status: "REMOTE_CHANGED" })),
      true,
    );
  });

  it("does not stash clean draft with matching timestamps", () => {
    const lastSyncedAt = new Date("2026-08-10T12:00:00.000Z");
    assert.equal(
      mustStashRemoteOnDiff(
        row({
          status: "DRAFT",
          lastSyncedAt,
          updatedAt: lastSyncedAt,
          editorData: {},
        }),
      ),
      false,
    );
  });
});

describe("pending remote", () => {
  it("hashes html stably", () => {
    assert.equal(hashHtml("<p>a</p>"), hashHtml("<p>a</p>"));
    assert.notEqual(hashHtml("<p>a</p>"), hashHtml("<p>b</p>"));
  });

  it("round-trips pending payload", () => {
    const pending = buildPendingRemote({
      html: "<p>Hi</p>",
      name: "N",
      subject: "S",
      senderName: null,
      senderEmail: "a@b.c",
      replyTo: null,
      label: null,
    });
    const parsed = parsePendingRemote(pending);
    assert.ok(parsed);
    assert.equal(parsed?.html, "<p>Hi</p>");
    assert.equal(parsed?.htmlHash, hashHtml("<p>Hi</p>"));
  });
});
