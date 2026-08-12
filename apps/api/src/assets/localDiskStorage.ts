/**
 * Local disk AssetStorageProvider (default).
 * Location: apps/api/src/assets/localDiskStorage.ts
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { compressImageToMax } from "./compressImage.js";
import { AssetError, MAX_ASSET_BYTES } from "./constants.js";
import {
  extensionForKind,
  kindFromExtension,
  mimeForKind,
} from "./detectImage.js";
import type { AssetStorageProvider, StoredAsset } from "./provider.js";

const SAFE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;

function assetsDir(): string {
  return (
    process.env.ASSET_STORAGE_DIR?.trim() ||
    path.join(process.cwd(), ".data", "assets")
  );
}

async function ensureAssetsDir(): Promise<string> {
  const dir = assetsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export class LocalDiskAssetStorage implements AssetStorageProvider {
  async storeImageBuffer(buf: Buffer): Promise<StoredAsset> {
    const result = await compressImageToMax(buf, MAX_ASSET_BYTES);
    const id = randomUUID();
    const filename = `${id}.${extensionForKind(result.kind)}`;
    const dir = await ensureAssetsDir();
    const full = path.join(dir, filename);
    if (!full.startsWith(dir + path.sep) && full !== dir) {
      throw new AssetError("VALIDATION", "Ungültiger Speicherpfad.", 400);
    }
    await writeFile(full, result.buf);
    return {
      id,
      filename,
      url: `/api/assets/${filename}`,
      mimeType: mimeForKind(result.kind),
      bytes: result.buf.length,
      kind: result.kind,
      compressed: result.compressed,
      originalBytes: result.originalBytes,
    };
  }

  async readStoredAsset(
    filename: string,
  ): Promise<{ buf: Buffer; mimeType: string }> {
    if (!SAFE_NAME.test(filename)) {
      throw new AssetError("NOT_FOUND", "Asset nicht gefunden.", 404);
    }
    const ext = path.extname(filename);
    const kind = kindFromExtension(ext);
    if (!kind) {
      throw new AssetError("NOT_FOUND", "Asset nicht gefunden.", 404);
    }
    const dir = await ensureAssetsDir();
    const full = path.join(dir, filename);
    if (!full.startsWith(dir + path.sep)) {
      throw new AssetError("NOT_FOUND", "Asset nicht gefunden.", 404);
    }
    try {
      const out = await readFile(full);
      return { buf: out, mimeType: mimeForKind(kind) };
    } catch {
      throw new AssetError("NOT_FOUND", "Asset nicht gefunden.", 404);
    }
  }
}

let singleton: AssetStorageProvider | null = null;

/** Factory — ASSET_STORAGE=local (default). S3/R2: set driver later. */
export function getAssetStorage(): AssetStorageProvider {
  if (singleton) return singleton;
  const driver = (process.env.ASSET_STORAGE ?? "local").trim().toLowerCase();
  if (driver !== "local") {
    // ponytail: only local shipped; S3 provider when deploy needs it
    console.warn(
      `[assets] ASSET_STORAGE=${driver} not implemented; falling back to local`,
    );
  }
  singleton = new LocalDiskAssetStorage();
  return singleton;
}
