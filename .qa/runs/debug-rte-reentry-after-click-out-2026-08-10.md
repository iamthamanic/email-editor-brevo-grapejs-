# Debug Report — `rte-reentry-after-click-out`

**Date:** 2026-08-10  
**Project:** Email-Template-Editor (GrapeJS)  
**Shell:** web  
**Repro grade:** full  

---

## Summary

Nach Leave→Re-Enter setzt `placeCaretInHost` den Caret korrekt (Offset ~15), aber `ComponentTextView.syncContent` → `resetFromString` zerstört danach die Text-Nodes (`innerHTML=""`) — Selection fällt auf Offset 0. Tippen landet nur am Anfang; der User erlebt „rausgeklickt → nicht mehr richtig editierbar“. Bisherige E2E waren **false-green** (prüfen nur `toContain("ZZZ")`).  
**Confidence:** high

---

## Bug description

| | |
|--|--|
| **Expected** | Nach Rausklicken und erneutem Klick mittig im Text: Caret an Klickposition, Weiter tippen dort. |
| **Actual** | Text oft noch auswählbar / CE=`true`, aber Caret steckt bei 0; Tippen hängt Zeichen vorne an. |
| **Steps** | 1. Template öffnen 2. In `email-text` tippen 3. Außerhalb klicken (Canvas/Header) 4. Wieder mittig in den Text klicken 5. Tippen |

---

## Reproduction

- **Command / URL:** `http://localhost:5173` + Playwright
- **Playwright spec:** `apps/editor/e2e/debug-repro-rte-reentry.spec.ts` (geschärft: `caret > 0`, `!startsWith("ZZZ")`)
- **Result:** reproduced (8/8 Stress-Loops: `failCaretAt0: 8`, `insertAtStartOnly: 8`)
- **Hard path:** yes → red command:

```bash
npm run test:e2e --workspace=@email-template/editor -- e2e/debug-repro-rte-reentry.spec.ts -g "leave via canvas"
```

Prior soft e2e `text-selection.spec.ts` „leave then re-enter“ blieb grün trotz Bug (nur Substring-Assert).

---

## Evidence

### Instrumented timeline (re-enter mid-click)

1. `placeCaretInHost` → `addRange` → **caret 15** (matches `caretRangeFromPoint`)
2. `mouseup` / `click` still caret 15  
3. ~ms later: `ComponentsView.resetChildren` → `innerHTML=""` → **selectionchange caret 0**
4. Caller: `Components.resetFromString` ← `ComponentTextView.syncContent` (`parseContent: true`)

### Autosave mid-edit (same session)

Stack during first edit:

`TemplateEditorPage.tsx` → `getSyncedProjectData` → `syncActiveRteToModel` → `syncHostFromDom({ force: true })` → `syncContent` → `resetFromString("<br>")` **while `editing: true`**

Das erklärt auch Scrambled Typing (`"pha BravolA"`).

### Console

Keine App-Exceptions nötig — DOM/Selection-Instrumentation ausreichend.

### Screenshot / probe artifacts

- `.qa/evidence/debug-rte-reentry/caret-loop.json` — 8/8 caret@0  
- `.qa/evidence/debug-rte-reentry/deep-probe.json`  
- `.qa/evidence/debug-rte-reentry/deep-01-after-leave.png`  

---

## Prior art

- [x] Repo: `packages/editor-core/src/rteSync.ts` (`syncHostFromDom` + `wireLiveRteModelSync` on `rte:disable`)  
- [x] Repo: `apps/editor/src/templates/TemplateEditorPage.tsx` (`getSyncedProjectData` on autosave/patch)  
- [x] GrapesJS source: `ComponentTextView.syncContent` → `comps.resetFromString` when `customRte.parseContent`  
- [x] Prior research `.qa/runs/debug-rte-reentry-research-2026-08-10.md` — CE-wipe via `removeAttributes` war **Teilursache**, nicht die aktuelle Leave→Caret-0-Kette  
- [ ] GitHub MCP auth failed earlier; Grapes docs/CKEditor guide already correlated  

---

## Root cause

**Layer:** editor-core RTE sync + Grapes `parseContent` + autosave.

Mit `setCustomRte({ parseContent: true })` baut jedes `syncContent({ force: true })` den Host-DOM neu (`resetFromString`). Das invalidiert die Range von `placeCaretInHost`.

Trigger:

1. **Autosave / `getSyncedProjectData`** während live RTE  
2. **`wireLiveRteModelSync` on `rte:disable`** → erneutes `syncContent` (zusätzlich zu Grapes’ eigenem Disable-Sync)  
3. Async-Fortsetzungen von `syncContent` können noch **nach** Re-Enable feuern und den Caret erneut killen  

Vorherige Fixes (CE restamp nach `removeAttributes`) greifen hier nicht: `contenteditable` bleibt `"true"`, aber der Caret ist tot bei 0.

**Hypotheses tested:**  
1. CE fehlt nach Leave — **falsified** (attr true, isCE true)  
2. `placeCaretInHost` / iframe-Koordinaten kaputt — **falsified** (setzt kurz 15)  
3. `syncContent`/`resetFromString` zerstört Nodes nach placeCaret — **confirmed**  
4. Autosave synct mid-edit — **confirmed**  

**Fix attempts this bug:** ≥3 (prior session) → architecture: stop fighting CE stamps; stop `syncContent` while editing / on disable race.

---

## Suggested fix (minimal)

1. **`getSyncedProjectData` / autosave:** Canvas/Project ohne `view.syncContent` lesen (wie `htmlFromCanvasDom` / model snapshot), nie `force: true` sync während `editor.getEditing()`.  
2. **`wireLiveRteModelSync`:** auf Disable **kein** `syncContent`; Grapes sync reicht, oder nur `model.set('content', html)` ohne `resetFromString`.  
3. **Regression:** `debug-repro-rte-reentry.spec.ts` Asserts `caret > 0` + `!text.startsWith("ZZZ")` nach Mid-Click; promote nach Fix in `text-selection.spec.ts`.  

**Next step:** `@implement` (Debug liefert absichtlich keinen Code-Fix)

---

## Notes

- Assumptions: User-Symptom = „nach Rausklicken nicht mehr sinnvoll tippen / Caret springt“ (nicht nur CE=false).  
- Out of scope: Brevo publish, HVAI-123.  
- Temp spec behalten bis Fix; danach promote oder löschen.  
