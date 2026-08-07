/**
 * Fastify API entry — Email Template Service.
 * Location: apps/api/src/index.ts
 */

import "dotenv/config";
import Fastify from "fastify";
import {
  assertSafeDevBind,
  authHook,
  getAuthMode,
} from "./auth/dev-auth.js";
import { registerTemplateRoutes } from "./templates/routes.js";

const PORT = Number(process.env.API_PORT ?? 3001);
const HOST = process.env.API_HOST ?? "127.0.0.1";
const EDITOR_ORIGIN = process.env.EDITOR_ORIGIN ?? "http://localhost:5173";

async function main(): Promise<void> {
  assertSafeDevBind(HOST);

  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", EDITOR_ORIGIN);
    reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.addHook("preHandler", authHook);

  app.get("/api/health", async () => ({
    data: {
      ok: true,
      authMode: getAuthMode() ?? "unset",
    },
    error: null,
  }));

  await registerTemplateRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  console.info(
    `[api] listening on http://${HOST}:${PORT} (AUTH_MODE=${getAuthMode() ?? "unset"})`,
  );
}

main().catch((error: unknown) => {
  console.error("[api] failed to start", error);
  process.exit(1);
});
