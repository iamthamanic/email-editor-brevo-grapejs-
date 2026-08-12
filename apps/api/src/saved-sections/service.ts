/**
 * Saved email section masters + linked template sync.
 * Location: apps/api/src/saved-sections/service.ts
 */

import { Prisma } from "@prisma/client";
import {
  ERROR_CODES,
  type CreateSavedSectionBody,
  type PatchSavedSectionBody,
  type SavedEmailSectionDto,
  type SavedSectionRole,
} from "@email-template/email-schema";
import { prisma } from "../db.js";
import { ServiceError } from "../templates/service.js";
import {
  buildHarvestSectionData,
  extractHarvestCandidates,
  hashFromSectionData,
  type HarvestCandidate,
} from "./harvest.js";

export interface HarvestResult {
  scannedTemplates: number;
  candidates: number;
  created: number;
  skippedExisting: number;
}

const ROLES = new Set(["header", "footer", "content", "social"]);

function assertRole(role: string): asserts role is SavedSectionRole {
  if (!ROLES.has(role)) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      `Invalid section role: ${role}`,
      400,
    );
  }
}

function assertSectionData(data: unknown): asserts data is Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "sectionData must be a JSON object.",
      400,
    );
  }
  const raw = JSON.stringify(data);
  // Event handlers need a boundary so "contenteditable=" is not a false positive.
  if (/javascript:|<\s*script\b|\son[a-z]+\s*=/i.test(raw)) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "sectionData contains disallowed content.",
      400,
    );
  }
}

function toDto(row: {
  id: string;
  name: string;
  role: string;
  sectionData: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): SavedEmailSectionDto {
  return {
    id: row.id,
    name: row.name,
    role: row.role as SavedSectionRole,
    sectionData: (row.sectionData ?? {}) as Record<string, unknown>,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSavedSections(
  role?: string,
): Promise<SavedEmailSectionDto[]> {
  const rows = await prisma.emailSavedSection.findMany({
    where: role ? { role } : undefined,
    orderBy: [{ createdAt: "asc" }],
  });
  const kept: typeof rows = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const data = (row.sectionData ?? {}) as Record<string, unknown>;
    const key = hashFromSectionData(data) ?? `id:${row.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    kept.push(row);
  }
  // Dedup is response-only — never delete on list/read.
  kept.sort((a, b) => {
    const roleCmp = a.role.localeCompare(b.role);
    if (roleCmp !== 0) return roleCmp;
    return a.name.localeCompare(b.name, "de");
  });
  return kept.map(toDto);
}

async function findSectionIdByContentHash(
  hash: string,
): Promise<string | null> {
  const rows = await prisma.emailSavedSection.findMany({
    select: { id: true, sectionData: true },
  });
  for (const row of rows) {
    const h = hashFromSectionData(
      (row.sectionData ?? {}) as Record<string, unknown>,
    );
    if (h === hash) return row.id;
  }
  return null;
}

function ensureContentHash(
  sectionData: Record<string, unknown>,
): Record<string, unknown> {
  const hash = hashFromSectionData(sectionData);
  if (!hash) return sectionData;
  const attrs = {
    ...((sectionData.attributes as Record<string, unknown>) ?? {}),
    "data-textbaustein-hash": hash,
  };
  return { ...sectionData, attributes: attrs };
}

export async function getSavedSection(id: string): Promise<SavedEmailSectionDto> {
  const row = await prisma.emailSavedSection.findUnique({ where: { id } });
  if (!row) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Saved section not found.", 404);
  }
  return toDto(row);
}

export async function createSavedSection(
  body: CreateSavedSectionBody,
): Promise<SavedEmailSectionDto> {
  const name = body.name?.trim();
  if (!name) {
    throw new ServiceError(ERROR_CODES.VALIDATION, "Name is required.", 400);
  }
  assertRole(body.role);
  assertSectionData(body.sectionData);
  const withHash = ensureContentHash(body.sectionData);
  const hash = hashFromSectionData(withHash);
  if (hash) {
    const existingId = await findSectionIdByContentHash(hash);
    if (existingId) {
      return getSavedSection(existingId);
    }
  }
  const stamped = stampSource(withHash, "new", 1, "linked");
  const row = await prisma.emailSavedSection.create({
    data: {
      name,
      role: body.role,
      sectionData: stamped as Prisma.InputJsonValue,
      version: 1,
    },
  });
  // Fix id stamp after create
  const withId = stampSource(
    row.sectionData as Record<string, unknown>,
    row.id,
    1,
    "linked",
  );
  const updated = await prisma.emailSavedSection.update({
    where: { id: row.id },
    data: { sectionData: withId as Prisma.InputJsonValue },
  });
  return toDto(updated);
}

export async function patchSavedSection(
  id: string,
  body: PatchSavedSectionBody,
): Promise<{ section: SavedEmailSectionDto; syncedTemplates: number }> {
  const existing = await prisma.emailSavedSection.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Saved section not found.", 404);
  }

  let version = existing.version;
  let sectionData = existing.sectionData as Record<string, unknown>;
  if (body.sectionData !== undefined) {
    assertSectionData(body.sectionData);
    version += 1;
    sectionData = stampSource(body.sectionData, id, version, "linked");
  }
  const name = body.name?.trim();
  const row = await prisma.emailSavedSection.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(body.sectionData !== undefined
        ? {
            sectionData: sectionData as Prisma.InputJsonValue,
            version,
          }
        : {}),
    },
  });

  let syncedTemplates = 0;
  if (body.syncLinked && body.sectionData !== undefined) {
    syncedTemplates = await syncLinkedTemplates(id, version, sectionData);
  }

  return { section: toDto(row), syncedTemplates };
}

export async function deleteSavedSection(id: string): Promise<void> {
  try {
    await prisma.emailSavedSection.delete({ where: { id } });
  } catch {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Saved section not found.", 404);
  }
}

async function existingContentHashes(): Promise<Set<string>> {
  const rows = await prisma.emailSavedSection.findMany({
    where: { role: "content" },
    select: { sectionData: true },
  });
  const hashes = new Set<string>();
  for (const row of rows) {
    const data = row.sectionData as Record<string, unknown>;
    const h = hashFromSectionData(data);
    if (h) hashes.add(h);
  }
  return hashes;
}

/** Upsert harvested snippets by content hash (create-only; never overwrite manual edits). */
export async function upsertHarvestCandidates(
  candidates: HarvestCandidate[],
): Promise<{ created: number; skippedExisting: number }> {
  const existing = await existingContentHashes();
  let created = 0;
  let skippedExisting = 0;
  for (const candidate of candidates) {
    if (existing.has(candidate.hash)) {
      skippedExisting += 1;
      continue;
    }
    await createSavedSection({
      name: candidate.name,
      role: "content",
      sectionData: buildHarvestSectionData(candidate),
    });
    existing.add(candidate.hash);
    created += 1;
  }
  return { created, skippedExisting };
}

/** Harvest from one editorData blob (e.g. after Brevo convert). */
export async function harvestFromEditorData(
  editorData: unknown,
): Promise<{ created: number; skippedExisting: number; candidates: number }> {
  const candidates = extractHarvestCandidates(editorData);
  const { created, skippedExisting } = await upsertHarvestCandidates(candidates);
  return { created, skippedExisting, candidates: candidates.length };
}

/** Scan all local templates and harvest Textbausteine. */
export async function harvestFromAllTemplates(): Promise<HarvestResult> {
  const templates = await prisma.emailTemplate.findMany({
    select: { id: true, editorData: true },
  });
  const all: HarvestCandidate[] = [];
  const seen = new Set<string>();
  for (const t of templates) {
    for (const c of extractHarvestCandidates(t.editorData)) {
      if (seen.has(c.hash)) continue;
      seen.add(c.hash);
      all.push(c);
    }
  }
  const { created, skippedExisting } = await upsertHarvestCandidates(all);
  return {
    scannedTemplates: templates.length,
    candidates: all.length,
    created,
    skippedExisting,
  };
}

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

/**
 * Replace linked section snapshots inside template editorData (controlled sync).
 */
async function syncLinkedTemplates(
  savedSectionId: string,
  version: number,
  snapshot: Record<string, unknown>,
): Promise<number> {
  const templates = await prisma.emailTemplate.findMany({
    select: { id: true, editorData: true, revision: true },
  });
  let count = 0;
  for (const t of templates) {
    const data = t.editorData as Record<string, unknown> | null;
    if (!data) continue;
    const next = replaceLinkedSection(data, savedSectionId, version, snapshot);
    if (!next) continue;
    await prisma.emailTemplate.update({
      where: { id: t.id },
      data: {
        editorData: next as Prisma.InputJsonValue,
        revision: t.revision + 1,
      },
    });
    count += 1;
  }
  return count;
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
    for (const [k, v] of Object.entries(obj)) {
      out[k] = walk(v);
    }
    return out;
  }

  const result = walk(root) as Record<string, unknown>;
  return changed ? result : null;
}
