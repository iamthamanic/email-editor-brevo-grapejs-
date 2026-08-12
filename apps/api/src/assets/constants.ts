/**
 * Shared asset constants + errors.
 * Location: apps/api/src/assets/constants.ts
 */

/** Stored asset hard cap after compress. */
export const MAX_ASSET_BYTES = 2 * 1024 * 1024; // 2 MiB

/** Incoming multipart may be larger; we shrink before store. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MiB

export class AssetError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "AssetError";
  }
}
