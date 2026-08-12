# Debug Report — rte-dead-after-variables-menu

**Date:** 2026-08-10  
**Project:** Email-Template-Editor (GrapeJS)  
**Shell:** web  
**Repro grade:** full (Playwright)

---

## Summary

Opening **Variablen** steals focus (`autoFocus` on search) and disables canvas RTE; a follow-up click that hits the dropdown list inserts a param and can leave the host **not typeable** (`contenteditable` false / typing no-op). Menu buttons also lack `preserveSelection` `mousedown` guards used by format buttons.  
**Confidence:** high

---

## Bug description

| | |
|--|--|
| **Expected** | Nach Klick auf Variablen (oder anderes Chrome) wieder in `email-text` tippen können |
| **Actual** | „Danach geht nix mehr“ — Inhalt wirkt tot / Tippen landet nicht im Canvas |
| **Steps** | 1. Textblock editieren 2. Toolbar **Variablen** öffnen 3. Zurück in den Inhalt klicken/tippen |

---

## Reproduction

- **URL:** `http://localhost:5173`
- **Playwright specs:**
  - `e2e/debug-repro-rte-after-variables-menu.spec.ts`
  - `e2e/debug-repro-rte-toolbar-focus.spec.ts`
- **Result:** reproduced (critical path) + several happy paths still green
- **Hard path:** yes — prior leave→re-enter fixes; this is toolbar/focus + param-insert interaction

### Critical failing path (first run)

1. Type `BeforeVars` in `email-text` → CE true  
2. Click **Variablen** → menu open → host CE **false** (expected blur)  
3. Click coordinates over the text host **while menu still open**  
4. Result: text became `{{ params.name }}×BeforeVars` (accidental **param insert** via overlay hit), `isCE: false`, typing `AAA` **no-op**  
5. Even after canvas-chrome leave + re-enter (`isCE: true`), typing `ZZZ` still **missing** in one run (caret→0)

Evidence log: `/tmp/debug-vars-direct.log`  
Screenshots: `.qa/evidence/debug-rte-after-variables-menu/`

### Paths that still work (narrow)

| Case | Result |
|------|--------|
| A Escape → re-enter → type | PASS (caret often starts at 0) |
| B Pick variable → re-enter → type `MID` | PASS |
| C Blöcke Escape → re-enter | PASS |
| D Menu open, click lower host (miss list) | PASS |
| E Search → Betreff → text | PASS |
| F 8× open/close vars | PASS |

---

## Evidence

### Probes (failing direct path)

```json
"afterVarsMenu": { "isCE": false, "attr": "false" }
"afterDirectReenter": {
  "isCE": false,
  "text": "{{ params.name }}×BeforeVars",
  "pills": implied
}
"afterDirectType": { "isCE": false, "text": "{{ params.name }}×BeforeVars" }
```

### Console

No pageerrors required for repro.

### Screenshot / trace

- `.qa/evidence/debug-rte-after-variables-menu/`
- Playwright failure attachment under `.qa/test-results/debug-repro-rte-after-vari-*`

---

## Prior art

- [x] Repo: `EditorToolbar.tsx` — format buttons use `preserveSelection` (`preventDefault`+`stopPropagation`); **Variablen/Blöcke menu buttons do not**
- [x] Repo: variables menu search `autoFocus` (`EditorToolbar.tsx` ~743)
- [x] Repo: `insertVariable.ts` calls `exitRte` then appends param — leaves host non-editing
- [x] Repo: prior debug `.qa/runs/debug-rte-reentry-after-click-out-2026-08-10.md` (caret/syncContent)
- [x] GrapesJS #1296 / docs — toolbar `mousedown` must `stopPropagation` or RTE blurs

---

## Root cause

Three cooperating mechanisms:

1. **Focus steal:** Opening Variablen focuses the search input (`autoFocus`). Keyboard goes to the filter, not the canvas — feels like “editing broken”.
2. **Overlay hit-testing:** Dropdown sits above the canvas (`z-index: 40`). A click “into the text” often hits a **variable list button** → `insertVariableExpression` → `exitRte` → param pill. Host stays non-CE until a clean re-enable.
3. **Missing mousedown guard on menu chrome:** Unlike Bold/etc., Variablen/Blöcke buttons don’t call `preserveSelection`, so Grapes treats the click as outside → `rte:disable`. Combined with (2) and leave/enable races (param host + recent structural `syncContent`), re-entry can leave a **selectable but dead** host.

**Hypotheses tested:**  
1. Escape-only close → OK  
2. Intentional pick + re-enter → usually OK  
3. Click while menu open toward text → **FAIL** (accidental insert + dead type)  
4. Stress open/close → OK  

**Fix attempts this bug:** 0 (debug only)

---

## Suggested fix (minimal)

1. **`EditorToolbar.tsx`**
   - `onMouseDown={preserveSelection}` (or at least `stopPropagation`) on Blöcke / Variablen / Textbausteine menu buttons
   - Remove `autoFocus` on variables search **or** focus only when menu opened without a live RTE selection; optionally restore canvas focus on Escape/close when a text host is selected
2. **`insertVariable.ts` / picker**
   - After successful insert: `forceEnableTextRte` on the host and place caret **after** the new pill (so “pick → continue typing” works without hunting clicks)
3. **Regression:** promote `debug-repro-rte-after-variables-menu` case “menu open → click host region / pick → type” into permanent e2e

**Next step:** `@implement` (user should invoke — debug does not ship the fix by default)

---

## Notes

- Assumptions: User “Variablen dann nichts geht” matches focus-steal and/or accidental list click; may also appear with Textbausteine/Blöcke overlays.
- Out of scope: unrelated full-suite e2e flakes (template-list, corporate).
- Related recent change: structural-host `syncContent` on autosave — watch during fix that it doesn’t worsen mid-re-entry with pills.
