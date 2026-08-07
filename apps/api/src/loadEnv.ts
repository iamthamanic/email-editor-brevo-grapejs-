/**
 * Load env before other app modules (path anchored to this file, not cwd).
 * Location: apps/api/src/loadEnv.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// apps/api/src → apps/api/.env
const apiEnv = resolve(here, "../.env");
// monorepo root .env
const rootEnv = resolve(here, "../../../.env");

if (existsSync(apiEnv)) {
  // Prefer API package env; override empty/stale values from parent shells
  loadEnv({ path: apiEnv, override: true });
}
if (existsSync(rootEnv)) {
  // Fill gaps only — do not wipe BREVO_API_KEY from apps/api/.env
  loadEnv({ path: rootEnv, override: false });
}
