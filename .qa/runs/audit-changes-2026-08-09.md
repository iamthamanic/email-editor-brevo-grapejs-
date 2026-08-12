# Audit Changes — 2026-08-09

## Audit Changes — WARN

### Scope
- Mode: uncommitted (entire working tree on `main` vs HEAD `7a18512`)
- Base: `7a18512`
- Files: ~58 modified + ~70 untracked (~7k+ LOC net in tracked diff alone)
- Packages: both (api + editor + packages)
- Depth: standard (+ security review subagent)

### Phase A — Deterministic
| Check | Command | Result |
|-------|---------|--------|
| Full checks | `npm run checks` | PASS |
| typed-strict (touched migration paths) | RG `any` / `@ts-ignore` | PASS (Prisma cast only) |
| secureByDefault RG | F-03/F-05/B-04/B-09/P-02 | PASS |
| Secrets in diff / .env staged | git | PASS |
| npm audit high+ | via checks | PASS |

### Phase B — Security
| Check | Result |
|-------|--------|
| Secrets in diff | PASS |
| .env staged | PASS |
| Auth on new routes | PASS (DevAuth + permissions) |
| Verified sender allowlist server-side | WARN (medium) |
| Rate limits / CSRF / ERP JWT | WARN (known gaps) |
| AgentShield | SKIPPED (`.cursor/` not in product diff) |

Security Review subagent: no critical/high; one medium (publish/test-send sender not verified against Brevo list).

### Phase C — Review lite
- Verdict contribution: warn
- Tags: `hoare`, `brooks`, `seclv`

| Severity | Tag | File | Issue | Action |
|----------|-----|------|-------|--------|
| Important (ship/ERP) | seclv B-01 | `apps/api/src/auth/dev-auth.ts` | Nur DevAuth — kein ERP JWT | Blockt Drop-in |
| Important (ship/ERP) | seclv F-04/P-05 | API surface | Kein CSRF / kein Rate-Limit | Vor Prod |
| Medium | seclv B-07 | `publish.ts` / `sendTest.ts` | Sender-Allowlist nur UI | Vor Multi-User |
| Minor | brooks | `migrate-legacy-hashes` | Batch ohne UI; route ohne `ids` body | OK für Ops |
| Minor | hoare | acceptance checkboxes | Happy Path unchecked in MD (API verified) | verify-ticket notes |

### Phase D — Optional
| Tool | Result |
|------|--------|
| npm audit | PASS |
| @verify-ticket (hash ticket) | PASS (API evidence) |
| @verify-ui (hash ticket) | SKIPPED — API-first, no UI |
| @verify-ui (whole product) | SKIPPED this run — no full e2e suite executed now |
| @ecc-check | NOT RUN — required before PR/ship |

### Verdict: WARN

**Summary:** Product builds and tests green; last feature (hash→params) is implemented and DB-clean. Not drop-in ready for HVAI-123: missing ERP auth, iframe/theme contract wiring, CSRF/rate-limits, sender server allowlist, huge uncommitted WIP on `main`, no `@ecc-check`/PR. Safe to continue coding; do not embed in ERP yet.

### Next steps
1. Fix medium sender allowlist if multi-role soon
2. ERP auth + Authorized_Works mapping (integration ticket)
3. `@ecc-check` then branch/PR — do not ship from dirty `main`
4. Optional: re-publish migrated templates to Brevo so runtime HTML matches DB
