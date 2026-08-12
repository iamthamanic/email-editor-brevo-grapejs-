/**
 * Asset upload + serve routes (local disk v1).
 * Location: apps/api/src/assets/routes.ts
 */

import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { ERROR_CODES, fail, ok } from "@email-template/email-schema";
import { requirePermission } from "../auth/dev-auth.js";
import {
  AssetError,
  MAX_UPLOAD_BYTES,
  readStoredAsset,
  storeImageBuffer,
} from "./storage.js";

function handleAssetError(
  error: unknown,
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
): unknown {
  if (error instanceof AssetError) {
    return reply.code(error.httpStatus).send(fail(error.code, error.message));
  }
  console.error("[assets]", error);
  return reply
    .code(500)
    .send(fail(ERROR_CODES.INTERNAL, "Unexpected server error."));
}

export async function registerAssetRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      files: 1,
      // Accept larger originals; compressImageToMax shrinks to ≤ 2 MiB
      fileSize: MAX_UPLOAD_BYTES,
    },
  });

  app.post("/api/assets", async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.edit")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.edit."));
    }

    try {
      const file = await request.file();
      if (!file) {
        return reply
          .code(400)
          .send(fail(ERROR_CODES.VALIDATION, "Keine Datei hochgeladen."));
      }
      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      if (file.file.truncated) {
        return reply
          .code(400)
          .send(
            fail(
              ERROR_CODES.VALIDATION,
              `Datei zu groß zum Hochladen (max. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`,
            ),
          );
      }
      const buf = Buffer.concat(chunks);
      const stored = await storeImageBuffer(buf);
      return ok({
        url: stored.url,
        filename: stored.filename,
        mimeType: stored.mimeType,
        bytes: stored.bytes,
        compressed: stored.compressed,
        originalBytes: stored.originalBytes,
      });
    } catch (error) {
      return handleAssetError(error, reply);
    }
  });

  app.get<{ Params: { filename: string } }>(
    "/api/assets/:filename",
    async (request, reply) => {
      // Public capability URL: UUID filenames only (authHook allowlists GET).
      // Upload remains email_templates.edit. Optional auth still works in dev.
      try {
        const { buf, mimeType } = await readStoredAsset(request.params.filename);
        return reply
          .header("Content-Type", mimeType)
          .header("Cache-Control", "private, max-age=86400")
          .header("X-Content-Type-Options", "nosniff")
          .send(buf);
      } catch (error) {
        return handleAssetError(error, reply);
      }
    },
  );
}
