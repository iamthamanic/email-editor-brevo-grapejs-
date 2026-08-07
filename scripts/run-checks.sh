#!/usr/bin/env bash
# Quality gate entrypoint for @test-gate / npm run checks
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> email-template-service checks"

echo "→ typecheck email-schema"
npm run typecheck --workspace=@email-template/email-schema

echo "→ typecheck email-components"
npm run typecheck --workspace=@email-template/email-components

echo "→ typecheck editor-core"
npm run typecheck --workspace=@email-template/editor-core

echo "→ typecheck api"
npm run typecheck --workspace=@email-template/api

echo "→ typecheck editor"
npm run typecheck --workspace=@email-template/editor

echo "→ unit tests api"
npm run test --workspace=@email-template/api

echo "→ unit tests email-components"
npm run test --workspace=@email-template/email-components

echo "→ build editor"
npm run build --workspace=@email-template/editor

echo "→ npm audit (high+)"
npm audit --audit-level=high

echo "OK: checks finished"
