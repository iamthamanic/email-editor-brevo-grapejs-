# Verify UI — Brevo card list — PASS

Date: 2026-08-07  
App: apps/editor (`http://localhost:5173`)  
Locale: de

## Checks
- `npm run checks` → PASS

## Scenarios
| Scenario | Result | Evidence |
|----------|--------|----------|
| List loads as cards | PASS | `01-card-list.png` |
| Status filter DRAFT | PASS | `02-status-filter-draft.png` |
| Pagination page 2 | PASS | `03-page-2.png` |
| ⋯ menu portal | PASS | `04-row-menu.png` |
| Regression: smoke + list actions e2e | PASS | Playwright |

## Edge cases touched
- Empty search not required (data present)
- Menu not clipped (portal) — OK
- Select-all / bulk — covered by `template-list-actions.spec.ts`

## Verdict
**PASS** — card list matches planned UX; no critical failures.
