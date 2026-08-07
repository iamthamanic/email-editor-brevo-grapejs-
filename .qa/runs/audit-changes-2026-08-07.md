# Audit Changes — 2026-08-07

Scope: uncommitted (working tree on `main`)  
Feature: legacy-html-importer  
Depth: standard

## Exit: WARN

Phase A test-gate **PASS**. Phase B: one Important authz gap (`raw_html`). Not CLEAN; not BLOCK (no Critical RG hits, checks green).

## Phase A — Test Gate

See session report: `npm run checks` exit 0; typed-strict 0 matches; secure RG probes clean.

## Phase B — Security

| Severity | ID | Finding |
|----------|-----|---------|
| Important | B-02 / B-07 | `POST /convert` + HTML mode only require `edit`, not `raw_html` (PRD advanced HTML) |

Sanitize / sandbox / Prisma / no secrets: OK.

## Phase C — Review lite

Importer package boundary OK (`parnas`). Auto-convert on open + paste path share API (`DRY`). `__etsImport` interim format is intentional (`ponytail` / migrate on autosave).

## Next

Fix `raw_html` gate → re-run `@review-ticket` → `@ecc-check` before PR.
