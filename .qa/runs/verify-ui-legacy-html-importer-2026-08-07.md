# Verify UI — legacy-html-importer — 2026-08-07

## Verdict: PASS

## Acceptance
`.qa/acceptance/legacy-html-importer.md`

## Checks
`npm run checks` — exit 0

## E2E
`npm run test:e2e --workspace=@email-template/editor -- e2e/legacy-html-importer.spec.ts` — **1 passed**

## Evidence
| Step | File |
|------|------|
| 1 HTML paste | `.qa/evidence/legacy-html-importer/01-html-paste.png` |
| 2 Converted canvas | `.qa/evidence/legacy-html-importer/02-converted-canvas.png` |
| 3 After reload | `.qa/evidence/legacy-html-importer/03-after-reload.png` |

## Happy Path
- HTML paste → Edit converts blocks: OK
- Params preserved in getHtml: OK
- Reload without re-preparing: OK

## Edge / Security note
`raw_html` permission not enforced in UI/API for convert — tracked in review (does not break UX happy path under DevAuth).

## Spec
`apps/editor/e2e/legacy-html-importer.spec.ts`
