# Verify UI Report — rte-reentry-after-click-out

Datum: 2026-08-10

## Ergebnis
PARTIAL

## Projekt
- Workspace: `Email-Template-Editor (GrapeJS)`
- App root: `apps/editor`
- Stack: Vite + React + GrapesJS
- Playwright: existing (`apps/editor/playwright.config.ts`, `testDir: ./e2e`)
- Dev URL: `http://localhost:5173`

## Technische Basis
- Checks command: `npm run checks`
- Checks result: PASS (log `/tmp/verify-ui-checks.log`)
- E2E command: `npx playwright test e2e/verify-rte-reentry-after-click-out.spec.ts e2e/text-selection.spec.ts e2e/debug-repro-rte-reentry.spec.ts e2e/rich-text-toolbar.spec.ts e2e/paste-overflow.spec.ts`
- E2E result: PARTIAL — final full suite had 1 intermittent fail (`debug-repro` initial type scramble once); verify evidence run + `debug-repro --repeat-each=3` (9/9) + regression specs green on re-runs

## Kontext-Quellen
- [x] `.qa/acceptance/rte-reentry-after-click-out.md` (from /implement — primary)
- [x] `.qa/project.yaml`
- [x] AGENTS.md
- [x] Styleguide: `docs/UI_STYLEGUIDE.md`
- [ ] Fallback: n/a

## Akzeptanzkriterien
| # | Kriterium | Ergebnis | Evidence |
|---|-----------|----------|----------|
| HP1 | Tippen „Hello selection world“ ohne Scramble | OK | `.qa/evidence/rte-reentry-after-click-out/01-typed-text.png` |
| HP2 | Leave via Canvas-Chrome → CE off | OK | `02-after-leave.png` |
| HP3 | Mid re-enter → caret > 0 | OK | `03-reenter-mid-caret.png` |
| HP4 | „ZZZ“ mid-string (`!startsWith`) | OK | `04-typed-after-reenter.png` („Hello selectionZZZ world“) |
| HP5 | Zweites Leave→Re-Enter→Tippen | OK | `05-second-cycle.png` (poll for caret; rare race at t=0 noted) |
| E1 | Header leave → mid tip | OK | `debug-repro` header leave + verify header branch |
| E2 | Autosave ohne live `syncContent` | OK | Code: `persistHostDomSilent` / `installRteSyncContentGuard` (nicht live im Browser instrumentiert) |
| E3 | Preview/Publish DOM-first | SKIPPED | nicht in diesem Run |
| R1 | Toolbar bold/heading/align | OK | `rich-text-toolbar.spec.ts` (1× flaky bold, Re-run PASS) |
| R2 | Paste overflow | OK | `paste-overflow.spec.ts` |
| R3 | ⌘/Ctrl+A Canvas + Betreff | OK | `text-selection.spec.ts` (Betreff 1× flaky empty, Re-run PASS) |

## Edge Cases (Matrix subset)
| ID | Case | Ergebnis | Anmerkung |
|----|------|----------|-----------|
| E01 | App loads | OK | Create-template → editor |
| E02 | Console clean | OK | verify spec asserts no critical `pageerror` |
| E08 | Mobile | SKIPPED | Desktop-Editor-Flow |
| E09 | Desktop | OK | Playwright Desktop Chrome |
| E10 | Keyboard typing | PARTIAL | 1× Scramble `oAlpha Brav` in debug-repro; 3× Stress danach PASS |
| A01–A02 | Auth | SKIPPED | n/a |
| F01–F03 | Forms | SKIPPED | n/a for this bugfix |

## UX-Bewertung
- Entspricht Iteration/Ticket: ja (Kern: Leave→Re-Enter tippt mittig, Evidence zeigt mid-`ZZZ`)
- Styleguide-Konformität: DE UI Labels unverändert; kein neues Layout
- Verständlichkeit: Caret/Editing-Feedback wie erwartet
- Console/Network: keine kritischen Fehler im Evidence-Run

## Kritische Probleme
Keine blockernden Happy-Path-Fails in Evidence.

## Verbesserungen (non-blocking)
1. **Intermittent initial-type scramble** — einmal `oAlpha Brav` statt `Alpha Bravo` in `debug-repro` leave-via-chrome (vor Leave). Stress 3× danach grün. Wenn reproduzierbar: enable-race / first keystroke vor Caret-Settle.
2. **Second-cycle caret=0 race** — sofort nach Re-Enter kurz Offset 0; `clickToEdit` restore + `expect.poll` fängt es. Optional settle-await in Product vor „editing ready“.
3. **Playwright testDir** — Skill-Pfad `.qa/runs/*.spec.ts` läuft nicht unter `testDir: ./e2e`. Executable: `apps/editor/e2e/verify-rte-reentry-after-click-out.spec.ts`; Pointer in `.qa/runs/2026-08-10-rte-reentry-after-click-out.spec.ts`.
4. Preview/Publish-Export (AC E3) noch nicht browser-verifiziert.

## Playwright Bootstrap
N/A — existing setup.

## Empfehlung
Kern-Bugfix (Caret mid nach Leave→Re-Enter) ist browserseitig belegt → weiter zu `@review-ticket` möglich. PARTIAL wegen seltener Type-Order-/Caret-Settle-Flakes und offenem Preview/Publish-Check. Bei Bedarf Flake mit `@debug` nachziehen, nicht sofort `@implement` ohne Repro.
