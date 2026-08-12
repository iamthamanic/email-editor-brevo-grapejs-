# Debug Report — `palette-leaf-dnd-startcustom`

**Date:** 2026-08-12  
**Project:** Email-Template-Editor (GrapeJS)  
**Shell:** web  
**Repro grade:** full  

---

## Summary

Host→Canvas-Drag aus Blöcke setzt nur `Canvas.startDrag` (`dragSource`), ruft aber **nicht** `Droppable.startCustom()` auf — im Gegensatz zu `BlockManager.startDrag`. Ohne die Custom-Pointer-Bridge greift der ComponentSorter im iframe nicht; Text/Überschrift lassen sich deshalb nicht in den Inhalts-Canvas (bzw. leere Spalten) schieben. Click-Insert funktioniert.  
**Confidence:** high

---

## Bug description

| | |
|--|--|
| **Expected** | Text / Überschrift aus Blöcke in den Inhalts-Canvas bzw. leere Layout-Spalten ziehen |
| **Actual** | Drag endet ohne Insert; keine zuverlässige Dropzone; Click auf denselben Block fügt ein |
| **Steps** | 1. `/email-editor` oder Template-Editor öffnen 2. Blöcke → Text/Überschrift ziehen 3. Über INHALT / leere Spalte droppen 4. Nichts landet |

---

## Reproduction

- **Command / URL:** `http://localhost:5173/email-editor` (User-Session) + Playwright fixtures
- **Playwright specs:**
  - `e2e/debug-repro-startcustom-gap.spec.ts` — **PASS** (gap proven)
  - `e2e/debug-repro-palette-html5-dnd.spec.ts` — click insert works; failed drag has no leaf fallback
  - `e2e/debug-repro-text-drop-content.spec.ts` — column accepts text, section rejects text
- **Result:** reproduced
- **Hard path:** no

Evidence: `.qa/evidence/debug-text-drop-content/`

| File | Finding |
|------|---------|
| `H-startcustom-gap.json` | `Canvas.startDrag` → `customArmed: false`; `BlockManager.startDrag` → `customArmed: true` |
| `A-droppable-probe.json` | Section accepts `email-row` only; column accepts `email-text`/`email-heading` |
| `E-click-insert.json` | Click: texts 3→4 |
| `G-failed-drag-no-fallback.json` | Leaf drag without `dragResult` → no insert (Toolbar fallback nur für Layout-Spalten) |

---

## Evidence

### GrapesJS API gap

`BlockManager.startDrag` (grapes.mjs ~43977):

```js
this.__startDrag(block, ev);
this.__getFrameViews().forEach((fv) => fv.droppable?.startCustom());
```

`Canvas.startDrag` setzt nur `em.set('dragSource', …)` — **kein** `startCustom`.

`Droppable.startCustom` → `__customTglEff(true)` verdrahtet `pointerenter`/`pointermove` auf dem **iframe-Element**, damit Host-DnD den Sorter starten kann. Ohne das bleibt der Drop stumm (Grapes-Warnung: Drop außerhalb iframe kann fehlschlagen).

Unser Pfad (`canvasInsert.ts` `startEditorDrag` / `endEditorDrag`):

```ts
editor.Canvas.startDrag({ content });
// … dragend …
editor.Canvas.endDrag(); // kein BlockManager.endDrag / startCustom mirror
```

### Droppable rules (not the primary bug, but UX trap)

- `email-section` (content): `acceptsRow` → Text/Überschrift **abgelehnt**
- `email-column`: `acceptsContent` → Text/Überschrift **ok**
- User sieht oft die Section „INHALT“ / Empty-Slot; Treffer muss die Spalte sein — funktioniert erst, wenn Sorter via `startCustom` läuft.

### Secondary: missing leaf fallback

`EditorToolbar` `onDragEnd`: Fallback-`insertBlock` nur für `email-columns-*`, **nicht** für Text/Überschrift. Spalten-Layout wirkt „robuster“, Leaf-Drag bei Sorter-Miss → stilles No-op.

### Screenshot

User-Session `/email-editor`: leere 2-Spalten-Layout-Dropzones („Klicken: Text oder Bild…“) im INHALT — genau die Targets, die Drag erreichen soll.

---

## Prior art

- [x] `.qa/runs/debug-compose-block-dropzone-2026-08-09.md` — früher `dragContent`→`dragSource` Fix; `startCustom` damals nicht erwähnt
- [x] GrapesJS `Droppable` / `BlockManager.startDrag` source
- [x] Repo: `apps/editor/src/templates/canvasInsert.ts` `startEditorDrag`

---

## Root cause

**Primär:** Unvollständige Host→Canvas-DnD-API — `Canvas.startDrag` ohne `frame.droppable.startCustom()` / `endCustom` auf `dragend`.  
**Sekundär:** Kein Leaf-`insertBlock`-Fallback bei fehlgeschlagenem Drop; Content-Section lehnt Leaves ab (by design).

**Hypotheses tested:** 1. Column droppable rejects text — **falsified** 2. Canvas missing — **falsified** (persistent canvas) 3. Missing `startCustom` — **confirmed**  
**Fix attempts this bug:** 0  

---

## Suggested fix (minimal)

1. **Files:** `apps/editor/src/templates/canvasInsert.ts` (+ ggf. `EditorToolbar.tsx` dragend)
2. **Change:**
   - In `startEditorDrag`: nach `Canvas.startDrag` alle Frame-Views `droppable?.startCustom()` (wie BlockManager).
   - In `endEditorDrag`: `droppable?.endCustom(!result)` dann `Canvas.endDrag` / clear flags.
   - Optional hardening: Leaf-Typen bei `!result && isPointerOverCanvas` → `insertBlock` (wie Spalten-Layouts).
3. **Regression:** extend `debug-repro-startcustom-gap` → verify-spec: nach `startEditorDrag` ist `customArmed: true`; Playwright drag Text in leere Spalte erhöht `email-text` count.

**Next step:** `@implement` (dieser Report shippt keinen Fix)

---

## Notes

- Click-Pfad (`insertBlock` → `ensureContentCanvas`) ist ok — User-Problem ist spezifisch **Schieben**.
- Bestehende Canvas-Lösch-Sperre ist unrelated.
- Out of scope: native In-Canvas-Move von `email-text` (`draggable: false` Phase 1).
