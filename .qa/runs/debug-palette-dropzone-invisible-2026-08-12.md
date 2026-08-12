# Debug Report — `palette-dropzone-invisible`

**Date:** 2026-08-12  
**Project:** Email-Template-Editor (GrapeJS)  
**Shell:** web  
**Repro grade:** full  

---

## Summary

Die Mid-Drag-Dropzone (gestrichelte Box / „Hier ablegen“) bleibt unsichtbar, weil `armHostDragBridge()` Pointer-Events mit **Parent-Viewport-`clientX/Y`** auf das Canvas-iframe schickt, GrapesJS `customTarget` diese Koordinaten aber per `iframe.contentDocument.elementFromPoint()` aufliest — dort liefert der Hit-Test **`null`**, der Sorter findet kein Ziel, und `.gjs-placeholder` bleibt auf `display: none`. Bestehende E2E-Tests prüfen nur CSS am inneren Element, nicht die Sichtbarkeit des Wrappers → **False Positive**.  
**Confidence:** high

---

## Bug description

| | |
|--|--|
| **Expected** | Beim Ziehen von Text/Überschrift aus „Blöcke“ über den leeren Inhalts-Canvas erscheint eine gestrichelte Dropzone („Hier ablegen“ / „Hier einfügen“) |
| **Actual** | Keine sichtbare Dropzone während des Drags; Canvas bleibt statisch (User-Screenshot `/email-editor`) |
| **Steps** | 1. `/email-editor` öffnen 2. Blöcke → Überschrift/Text greifen 3. Über leeren Inhaltsbereich / Layout-Spalte ziehen 4. Keine gestrichelte Mid-Drag-Box |

**Environment:** macOS, local Vite `http://localhost:5173`, Branch: aktueller Workspace

---

## Reproduction

- **Command / URL:** `npm run test:e2e --workspace=apps/editor -- e2e/debug-repro-palette-dropzone-visible.spec.ts`
- **Playwright spec:** `apps/editor/e2e/debug-repro-palette-dropzone-visible.spec.ts` (real `page.mouse` drag, nicht nur synthetische Events)
- **Result:** reproduced — Sorter aktiv, Placeholder DOM vorhanden, aber `display: none`
- **Hard path:** no

Evidence:

| Artifact | Path |
|----------|------|
| Mid-drag state | `.qa/evidence/debug-palette-dropzone-visible/mid-drag-state.json` |
| Screenshot | `.qa/evidence/debug-palette-dropzone-visible/mid-drag.png` |
| False-positive E2E | `.qa/evidence/host-canvas-dnd-spacing/E-dragover-placeholder.json` |

### Mid-drag state (real mouse drag)

```json
{
  "sorterActive": true,
  "sorterOver": true,
  "dragKind": "leaf",
  "hint": 56,
  "hitTest": { "rawHit": null, "adjHit": "TABLE", "adjHitType": "email-section" },
  "phStyle": { "display": "none", "top": "", "left": "", "placement": "", "varH": "112px" },
  "intStyle": { "borderTopStyle": "dashed", "height": "112px" }
}
```

**Interpretation:** Mit Parent-Koordinaten trifft `elementFromPoint` im iframe **nichts** (`rawHit: null`). Mit Frame-Offset (`clientX - frame.left`) trifft es die Section (`adjHitType: email-section`). Grapes nutzt die ungekorrigierten Koordinaten → kein `targetNode` → `onTargetChange(_, undefined)` → `placeholder.hide()`.

---

## Evidence

### Console / Network

Keine relevanten App-Errors oder 4xx/5xx während Repro.

### GrapesJS Droppable + customTarget

`node_modules/grapesjs/dist/grapes.mjs` (~33347–33358):

```js
customTarget: function ({ event }) {
  return doc.elementFromPoint(event.clientX, event.clientY);
},
```

`doc` = iframe-`contentDocument`. `clientX/Y` müssen relativ zum **iframe-Viewport** sein.

### Host-Bridge (aktuell)

`apps/editor/src/templates/canvasInsert.ts` `forwardPointer()` dispatcht `PointerEvent` auf `frame` mit **ungeänderten** `ev.clientX/Y` vom `window`-`dragover` (Parent-Viewport).

### dropIndicators setzt CSS auf verstecktes Element

`packages/editor-core/src/dropIndicators.ts` setzt `--ets-drop-h` und `data-ets-placement` auf `.gjs-placeholder` schon bei `sorter:drag:start`. Das innere `.gjs-placeholder-int` bekommt per CSS `border: dashed`, aber der Wrapper bleibt `display: none` → **für den User unsichtbar**.

### E2E False Positive

`verify-host-canvas-dnd-spacing.spec.ts` Test „dragover bridge shows dashed placeholder“:

- Prüft `getComputedStyle(intEl).borderTopStyle === "dashed"`
- Prüft **nicht** `getComputedStyle(ph).display`
- Ergebnis: `E-dragover-placeholder.json` → `borderStyle: "dashed"` bei unsichtbarem Wrapper

### Idle vs Mid-Drag (UX-Klarstellung)

| Phase | Was User erwartet | Was Code liefert |
|-------|-------------------|------------------|
| **Idle** | Gestrichelte Spalten mit „Inhalt hinzufügen“ | `CANVAS_BASE_CSS` in `packages/editor-core/src/index.ts` — nur für leere `email-column` unter `data-layout="columns"` / content-section; `/email-editor` kann andere Struktur zeigen |
| **Mid-Drag** | Phase-6-Box „Hier ablegen“ | Nur sichtbar wenn Grapes Placeholder `display: block` + positioniert — **aktuell blockiert durch Koordinaten-Bug** |

User-Screenshot betrifft primär **Mid-Drag** (Block wird aktiv gezogen).

---

## Prior art

- [x] `.qa/runs/debug-palette-leaf-dnd-startcustom-2026-08-12.md` — fehlendes `startCustom` (behoben); Sorter armt jetzt korrekt
- [x] `.qa/runs/debug-editor-dnd-footer-dropzones-2026-08-11.md` — Placeholder idle `display:none` by design; Mid-Drag braucht aktiven Sorter
- [x] Repo: `apps/editor/src/templates/canvasInsert.ts` — `armHostDragBridge`
- [x] Repo: `packages/editor-core/src/dropIndicators.ts` — CSS vars / placement attrs
- [ ] GitHub / LightRAG: n/a

---

## Root cause

**Primär:** Koordinaten-Mismatch in der Host→iframe-Drag-Bridge. `armHostDragBridge` leitet Parent-`clientX/Y` unverändert weiter; Grapes `Droppable` `customTarget` ruft `iframe.contentDocument.elementFromPoint(clientX, clientY)` auf → **Hit-Test schlägt fehl** (`null`) → Sorter `handleMove` findet kein `targetNode` → Placeholder wird nie gezeigt/positioniert (`display: none`, leere `top`/`left`).

**Sekundär:** E2E-Assertion prüft Styling am Kind-Element statt Sichtbarkeit des Wrappers → grüner Test trotz User-sichtbarem Bug.

**Nicht die Ursache (falsifiziert):** `allowNesting: false` — Canvas-`ComponentSorter` nutzt `nested: true` (grapes.mjs ~33458). `startCustom` ist aktiv (`sorterActive: true`).

**Hypotheses tested:**  
1. Sorter nicht armed → **falsified** (`sorterActive: true`)  
2. CSS nicht geladen → **falsified** (`intStyle.borderTopStyle: dashed`)  
3. Parent `display:none` trotz CSS → **confirmed**  
4. iframe `elementFromPoint` mit falschen Koordinaten → **confirmed** (`rawHit: null`, `adjHit: TABLE`)

**Fix attempts this bug (sichtbare Dropzone):** 2 (dashed CSS + startCustom/bridge); diese Root Cause ist **Schicht 3** (Koordinaten-Translation), nicht wiederholtes Pflastern derselben Hypothese.

---

## Suggested fix (minimal) — IMPLEMENTED 2026-08-12

Host-owned mid-drag cue in `armHostDragBridge` (`showHostDropCue`):
- Transform parent `clientX/Y` → iframe-local for `elementFromPoint`
- Position Grapes placer over the hit `email-column`
- rAF pulse re-asserts `display:block` because Grapes `placeholder.hide()` races the cue
- Misses (highlighter covering slot) no longer clear the last good cue

**Next step:** `@verify-ui` in browser (Hard-Refresh, drag Überschrift over empty canvas)


---

## Notes

- Temporäre Repro-Spec: `e2e/debug-repro-palette-dropzone-visible.spec.ts` — nach Fix in Verify-Spec mergen oder löschen (im Report vermerkt).
- Click-Insert (`insertBlock`) funktioniert unabhängig davon.
- Out of scope: Leaf-Reorder im Canvas (`draggable: false` Phase 1).
