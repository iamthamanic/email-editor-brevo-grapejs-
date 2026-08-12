/**
 * Asset storage port — LocalDisk now; S3/R2 later without route changes.
 * Location: apps/api/src/assets/provider.ts
 */

import type { ImageKind } from "./detectImage.js";

export type StoredAsset = {
  id: string;
  filename: string;
  /** App-relative URL (vite proxies /api → API). */
  url: string;
  mimeType: string;
  bytes: number;
  kind: ImageKind;
  compressed: boolean;
  originalBytes: number;
};

export interface AssetStorageProvider {
  storeImageBuffer(buf: Buffer): Promise<StoredAsset>;
  readStoredAsset(
    filename: string,
  ): Promise<{ buf: Buffer; mimeType: string }>;
}
