#!/usr/bin/env bash
# Quality gate entrypoint for @test-gate / npm run checks
# Scaffolded by /project-setup — expand when apps/editor and apps/api exist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> email-template-service checks"

MISSING=0

if [[ ! -f apps/editor/package.json ]]; then
  echo "WARN: apps/editor not bootstrapped yet (Phase 1 Foundation)"
  MISSING=1
fi

if [[ ! -f apps/api/package.json ]]; then
  echo "WARN: apps/api not bootstrapped yet (Phase 1 Foundation)"
  MISSING=1
fi

if [[ "$MISSING" -eq 1 ]]; then
  echo "OK (scaffold): docs/QA present; app packages pending. See docs/PRD.md Phase 1."
  echo "Recommend after bootstrap: lint + typecheck + build per workspace + npm audit --audit-level=high"
  exit 0
fi

# When workspaces exist:
# npm run lint --workspaces --if-present
# npm run typecheck --workspaces --if-present
# npm run build --workspaces --if-present
# npm audit --audit-level=high

echo "ERROR: run-checks.sh reached unexpected state"
exit 1
