# Debug Report — `editor-dnd-footer-dropzones`

**Date:** 2026-08-11  
**Project:** Email-Template-Editor (GrapeJS)  
**Shell:** web  
**Repro grade:** full (symptoms A–C full; D root cause evidenced via `float:left`, visual wrap matches user screenshot)

---

## Summary

Vier getrennte Ursachen: (1) Idle-Empty-Dropzone-CSS hängt noch an `email-section[data-layout=columns]`, Layout-Blöcke sind aber `email-layout-row` — ohne Section-Stamp keine sichtbaren Spalten-Dropzones. (2) Die Phase-6-Box erscheint nur während aktivem `sorter:drag`, idle nie. (3) Text/Überschrift absichtlich `draggable: false` (Phase 1). (4) Footer-Logo trägt HTML `align="left"` → Browser `float:left` → Text wickelt neben 229px-Logo in ~40px Restbreite („Bro/wo/Gm/bH“).  
**Confidence:** high (A,B,C,D float); medium-high for D visual wrap under loaded image (geometry after load can still stack if float clears; user screenshot confirms wrap in live session)

---

## Bug description

| | |
|--|--|
| **Expected** | Layout-Spalten zeigen dauerhaft Empty-Dropzones; Drag zeigt Box-Placeholder; Textblöcke verschiebbar; Footer Logo + „Browo GmbH“ sauber untereinander |
| **Actual** | Keine Idle-Dropzones in Layout; keine Box ohne Drag; Text nicht nativ ziehbar; Firmenname klebt/zerbricht am Logo |
| **Steps** | 1. Template mit Footer öffnen 2. Blöcke → Spalten-Layout einfügen 3. Idle Canvas betrachten 4. Textblock ziehen wollen 5. Footer prüfen |

---

## Reproduction

- **Command / URL:** `http://localhost:5173` (Playwright webServer)
- **Playwright spec:** `apps/editor/e2e/debug-repro-editor-dnd-footer.spec.ts`
- **Result:** reproduced (4/4 assertions as evidence)
- **Hard path:** no

Evidence dir: `.qa/evidence/debug-editor-dnd-footer/`

| Test | Artifact |
|------|----------|
| A layout empty | `A-layout-empty-dropzone.json`, `01-layout-empty-no-dropzone.png` |
| B text drag | `B-text-draggable.json` |
| C box timing | `C-dropzone-box-timing.json` |
| D footer float | `D-footer-geometry.json`, `02-footer-browo-wrap.png` |

---

## Evidence

### A — Layout empty dropzones

Mit Content-Section **ohne** `data-layout` (normaler Single-Canvas):

```json
{
  "contentSectionDataLayout": null,
  "measures": [
    { "domKidCount": 0, "minHeight": "0px", "afterContent": "none", "underSectionLayoutAttr": false, "underLayoutRow": true },
    { "domKidCount": 0, "minHeight": "0px", "afterContent": "none", "underSectionLayoutAttr": false, "underLayoutRow": true }
  ]
}
```

Canvas-CSS (`packages/editor-core/src/index.ts` ~265–284) selektiert nur:

```css
[data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type]))
```

Phase 3+4: `columnsSectionContent` → `layoutRowContent` → **`email-layout-row`** (`layout.ts:476–505`). Ohne zufälligen Section-Stamp greift die Idle-Dropzone nie.

### B — Text / Überschrift nicht DnD

```json
{ "type": "email-text", "modelDraggable": false, "domDraggable": null }
```

Absicht Phase 1 (`register.ts` `draggable: false`) gegen HTML5-Drag/Caret-Bug. Verschieben nur über Component-Toolbar-Move.

### C — Dropzone-Box nur mid-drag

```json
{ "idle": { "varH": "", "display": "none" }, "during": { "varH": "113px", "placement": "before", "intHeight": 113 } }
```

Phase 6 setzt `--ets-drop-h` nur auf `sorter:drag:start` / `sorter:drag`. Idle Canvas zeigt keine Box — erwartet für Between-Placeholder, aber leicht mit Idle-Empty-Dropzones verwechselt.

### D — Footer „Browo GmbH“

Importer emittiert Logo mit `align: "left"` (`toGrapesJs` image mapping). HTML-`align` auf `<img>` = legacy float.

Gemessen:

```json
{
  "logoBox": { "width": 229, "float": "left", "display": "block" },
  "model": { "alignAttr": "left", "widthAttr": "229" }
}
```

229px float + ~270px Spalte → ~40px Rest → Zeichenumbruch neben dem Logo (User-Screenshot).

User screenshot: `.cursor/.../assets/browser-screenshot-5c87f115-92b1-4aa6-a197-9ca60bc63049.png`

### Console / Network

Keine app-error für diese Symptome (Layout/CSS/HTML-Attr). Logo-CDN ggf. langsam → height 0 bis Load verstärkt Float-Wrap.

---

## Prior art

- [x] Repo grep: `packages/editor-core/src/index.ts:265` — Empty dropzones only inside layout blocks (section selector)
- [x] Repo: `packages/email-components/src/layout.ts:503` — `columnsSectionContent` → `layoutRowContent` (email-layout-row)
- [x] Repo: `.qa/acceptance/layout-empty-dropzones.md` — ursprüngliche Idle-Dropzone-Anforderung für Layout
- [x] Repo: `.qa/design/content-canvas-and-editor-core.md` Phase 1 — `draggable: false` für Text
- [x] Repo: `.qa/runs/debug-editor-core-interactions-2026-08-11.md` — Dropzone-als-Strich / Phase-6 Intent
- [ ] GitHub / LightRAG: n/a

---

## Root cause

| # | Symptom | Layer | Cause |
|---|---------|-------|-------|
| 1 | Keine Idle-Dropzones in Spalten-Layout | Canvas CSS | Selektor veraltet nach Canvas-Migration: section-only, nicht `email-layout-row` |
| 2 | Keine Box-Dropzone „einfach so“ | UX / Phase 6 | Box nur während Grapes-Sorter-Drag; idle Placeholder `display:none` |
| 3 | Text/Überschrift nicht ziehbar | By design | `draggable: false` (Caret-Schutz Phase 1) |
| 4 | Footer Browo zerbricht | HTML attr / CSS | `align="left"` auf Logo → `float:left` + breites Logo in schmaler Footer-Spalte |

**Hypotheses tested:** 1. CSS miss on layout-row — confirmed. 2. Phase-6 idle — confirmed. 3. Intentional drag lock — confirmed. 4. float from align attr — confirmed.  
**Fix attempts this bug:** 0  

---

## Suggested fix (minimal)

1. **Idle layout dropzones:** In `packages/editor-core/src/index.ts` Canvas-CSS Selektoren erweitern auf  
   `[data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type]))`  
   (analog zu den bestehenden section-Regeln). Optional section-`data-layout`-Stamp für Nested nicht mehr verlangen.
2. **Footer float:** In `toGrapesJs` / `email-image` kein HTML-`align` auf `<img>` setzen (nur `imageAlign` + margins); oder explizit `float: none` / `align` Attribut entfernen beim Mount. Regression: Footer-Geometrie `stackedBelow === true`, `float !== left`.
3. **Text-DnD:** Kein Fix nötig wenn Move-Icon reicht — sonst UX-Copy („Verschieben über Anfasser“). Nicht native `draggable=true` zurück ohne neuen Caret-Plan.
4. **Box mid-drag:** Optional UX: beim Öffnen von Blöcke kurz Tooltip; Code ok. Echte Idle-Slots = Fix (1).

**Regression tests:** Promote `debug-repro-editor-dnd-footer.spec.ts` → verify (A erwartet dann `afterContent` mit „Klicken“; D erwartet `float: none` / stacked).

**Next step:** `@implement` (user hat nur `/debug` angefordert)

---

## Notes

- Assumptions: User-Screenshot = Produktions-Footer nach Import; „keine Dropzones“ = Idle-Slots in Layout, nicht mid-drag Phase-6-Box.
- Out of scope: ERP-Embed, Sync-Hash, RTE-Framework-Wechsel.
- Temporary spec: `e2e/debug-repro-editor-dnd-footer.spec.ts` — nach Fix behalten oder nach `verify-*` umbenennen.
