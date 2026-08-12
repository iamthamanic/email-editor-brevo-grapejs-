/**
 * Compress/resize uploads so stored assets stay ≤ MAX_ASSET_BYTES.
 * Location: apps/api/src/assets/compressImage.ts
 */

import sharp from "sharp";
import {
  AssetError,
  MAX_ASSET_BYTES,
  MAX_UPLOAD_BYTES,
} from "./constants.js";
import { detectImageKind, type ImageKind } from "./detectImage.js";

export { MAX_ASSET_BYTES, MAX_UPLOAD_BYTES };

const QUALITY_STEPS = [85, 75, 65, 55, 45, 35] as const;
const MIN_WIDTH = 320;
const START_MAX_WIDTH = 2400;

export type CompressedImage = {
  buf: Buffer;
  kind: ImageKind;
  /** True when bytes or format changed vs input. */
  compressed: boolean;
  originalBytes: number;
};

/**
 * Ensure image fits under maxBytes. Oversized inputs are resized/re-encoded
 * (JPEG preferred for email size; PNG kept only when alpha and it still fits).
 */
export async function compressImageToMax(
  input: Buffer,
  maxBytes: number = MAX_ASSET_BYTES,
): Promise<CompressedImage> {
  if (input.length === 0) {
    throw new AssetError("VALIDATION", "Leere Datei.", 400);
  }
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new AssetError(
      "VALIDATION",
      `Datei zu groß zum Hochladen (max. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`,
      400,
    );
  }

  const sourceKind = detectImageKind(input);
  if (!sourceKind) {
    throw new AssetError(
      "VALIDATION",
      "Ungültiges Bild. Erlaubt: JPEG, PNG, GIF, WebP.",
      400,
    );
  }

  // Already within limit — keep original bytes/format
  if (input.length <= maxBytes) {
    return {
      buf: input,
      kind: sourceKind,
      compressed: false,
      originalBytes: input.length,
    };
  }

  const meta = await sharp(input, { animated: false, failOn: "none" })
    .rotate()
    .metadata();
  const hasAlpha = Boolean(meta.hasAlpha);
  let targetWidth = Math.min(meta.width && meta.width > 0 ? meta.width : START_MAX_WIDTH, START_MAX_WIDTH);

  let best: { buf: Buffer; kind: ImageKind } | null = null;

  for (let scalePass = 0; scalePass < 12; scalePass++) {
    const pipeline = sharp(input, { animated: false, failOn: "none" })
      .rotate()
      .resize({
        width: Math.max(MIN_WIDTH, targetWidth),
        withoutEnlargement: true,
        fit: "inside",
      });

    if (hasAlpha) {
      try {
        const png = await pipeline
          .clone()
          .png({ compressionLevel: 9, palette: true })
          .toBuffer();
        if (!best || png.length < best.buf.length) {
          best = { buf: png, kind: "png" };
        }
        if (png.length <= maxBytes) {
          return {
            buf: png,
            kind: "png",
            compressed: true,
            originalBytes: input.length,
          };
        }
      } catch {
        // fall through to lossy formats
      }
    }

    for (const quality of QUALITY_STEPS) {
      const jpeg = await pipeline
        .clone()
        .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
        .toBuffer();
      if (!best || jpeg.length < best.buf.length) {
        best = { buf: jpeg, kind: "jpeg" };
      }
      if (jpeg.length <= maxBytes) {
        return {
          buf: jpeg,
          kind: "jpeg",
          compressed: true,
          originalBytes: input.length,
        };
      }

      const webp = await pipeline.clone().webp({ quality }).toBuffer();
      if (!best || webp.length < best.buf.length) {
        best = { buf: webp, kind: "webp" };
      }
      if (webp.length <= maxBytes) {
        return {
          buf: webp,
          kind: "webp",
          compressed: true,
          originalBytes: input.length,
        };
      }
    }

    targetWidth = Math.round(targetWidth * 0.75);
    if (targetWidth < MIN_WIDTH) break;
  }

  if (best && best.buf.length <= maxBytes) {
    return {
      buf: best.buf,
      kind: best.kind,
      compressed: true,
      originalBytes: input.length,
    };
  }

  throw new AssetError(
    "VALIDATION",
    "Bild konnte nicht auf max. 2 MB komprimiert werden.",
    400,
  );
}
