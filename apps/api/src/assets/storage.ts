/**
 * Asset storage facade — routes use getAssetStorage() (swappable provider).
 * Location: apps/api/src/assets/storage.ts
 */

export { AssetError, MAX_ASSET_BYTES } from "./constants.js";
export { MAX_UPLOAD_BYTES } from "./constants.js";
export type { StoredAsset, AssetStorageProvider } from "./provider.js";
export { getAssetStorage, LocalDiskAssetStorage } from "./localDiskStorage.js";

import { getAssetStorage } from "./localDiskStorage.js";

export async function storeImageBuffer(buf: Buffer) {
  return getAssetStorage().storeImageBuffer(buf);
}

export async function readStoredAsset(filename: string) {
  return getAssetStorage().readStoredAsset(filename);
}
