# Debug Report — compose-block-dropzone

**Date:** 2026-08-09  
**Project:** Email-Template-Editor (GrapeJS)  
**Shell:** web  
**Repro grade:** full  

---

## Summary

Toolbar/Textbaustein-DnD setzt `em.dragContent`, GrapesJS erwartet aber `em.dragSource` / `canvas.startDrag({ content })` — dadurch fehlt der ComponentSorter-Placer (keine Dropzone), und Layout-Sections werden beim Drop auf die sichtbare Inhalts-Spalte abgelehnt.  
**Confidence:** high

---

## Bug description

| | |
|--|--|
| **Expected** | Block (bes. Layout „1/2/3 Spalten“) per Drag als eigener Inhalts-/Layout-Block einfügen; sichtbare Dropzone / Placeholder im Canvas |
| **Actual** | Keine Dropzone; Drop von „1 Spalte“ ändert die Canvas-Struktur nicht (weiterhin 4 Sections) |
| **Steps** | 1. `/email-editor` öffnen 2. Blöcke → Layout „1 Spalte“ ziehen 3. Über Inhaltsfläche / Canvas droppen 4. Kein neuer Inhaltsblock, kein Highlight |

---

## Reproduction

- **Command / URL:** `http://localhost:5173/email-editor` (Vite 200)
- **Playwright spec:** keines (Browser MCP + CDP)
- **Result:** reproduced
- **Hard path:** no

### CDP / DOM evidence

- Nach Drag „1 Spalte“ → Region Canvas: `sectionCount` bleibt **4** (header/content/footer/social); kein neuer `email-section`.
- `__emailEditor.Canvas.startDrag` vorhanden; `em.set('dragContent', …)` setzt **nicht** `dragSource`.
- Droppable-Regeln live:
  - `wrapper` akzeptiert `email-section`: **true**, `email-text`: **false**
  - `email-column` akzeptiert `email-section`: **false**, `email-text`: **true**
- Ohne `dragSource` fällt GrapesJS-`getContentByData` auf `text/plain` Label zurück → z.B. `<div>1 Spalte</div>` (nicht `email-section`).

### Console

Keine app-spezifischen Errors zum Drop (Log.enable); Symptom ist stilles No-op / falscher Payload, kein Throw.

### Screenshot

Browser MCP nach Drag „1 Spalte“ → Canvas: leere Inhaltsfläche ohne Drop-Highlight; Palette noch offen.

---

## Prior art

- [x] Repo grep: `apps/editor/src/templates/canvasInsert.ts:80` — `em?.set("dragContent", content)` (einzige Stelle)
- [x] GrapesJS source: `CanvasModule.startDrag` → `em.set('dragSource', …)`; `BlockManager.__startDrag` setzt ebenfalls `dragSource`; `Droppable.handleDragEnter` liest `em.get('dragSource')`, Fallback-Content `'<br>'` wenn `allowExternalDrop`
- [ ] GitHub issue: n/a (kein Treffer im lokalen Issue-Search-Setup)
- [ ] LightRAG: n/a
- [x] `.qa/edge-cases.md`: kein DnD-Eintrag
- [x] Ledger: leer (nur README)

---

## Root cause

Zwei gekoppelte Schichten:

1. **Falsches GrapesJS-Drag-API (primär):** `setEditorDragContent` schreibt `dragContent`. Offizieller Host→Canvas-Pfad ist `editor.Canvas.startDrag({ content })` / `em.set('dragSource', { content })` und `endDrag()` beim `dragend`. Ohne `dragSource` startet der Droppable-Sorter mit Dummy-`<br>` und der Drop liest höchstens `text/plain` — **kein** `email-section`-Tree, **kein** typkorrekter Placer. Deshalb sieht der User keine Dropzone und Layout-Drag fügt nichts Sinnvolles ein.

2. **Drop-Target-Mismatch für Layout (sekundär, UX):** Layout-Blöcke sind volle `email-section`-Trees. Wrapper akzeptiert nur Sections; die sichtbare leere Box ist `email-column` und **lehnt Sections ab**. Selbst nach API-Fix muss Layout auf den Wrapper (zwischen Chrome-Bändern) landen — Hover über der Inhalts-Spalte zeigt weiter keine gültige Zone. Click-Insert umgeht das via `editor.addComponents` am Root (`insertBlock`).

**Hypotheses tested:** wrong key `dragContent` (confirmed via CDP); column rejects section (confirmed); drag no-op for layout (confirmed sectionCount).  
**Fix attempts this bug:** 0  

---

## Suggested fix (minimal)

1. **Files:** `apps/editor/src/templates/canvasInsert.ts`; callers `EditorToolbar.tsx`, `SavedSectionsMenu.tsx`
2. **Change:**
   - `setEditorDragContent` → `editor.Canvas.startDrag({ content })` / clear via `endDrag()` (nicht `dragContent`).
   - Optional: Layout-Typen beim Drag wie Click behandeln (sofort `addComponents` / Drag deaktivieren) **oder** Drop-End-Handler: wenn `dragSource` Section und Drop fehlschlägt/leer → Root-Insert wie `insertBlock`.
   - Optional UX: leere Content-Column mit sichtbarem Empty-State („Hier ablegen“) — nur Content-Leaves; Layout klar als neuer Bereich am Root.
3. **Regression:** e2e/debug oder Vitest: nach `startDrag` ist `em.get('dragSource').content` gesetzt; Layout-Click/Drag erhöht `email-section` count mit `sectionRole=content`.

**Next step:** `@implement` (dieser Report shippt keinen Fix)

---

## Notes

- Compose-Palette zeigt Layout (Spalten), versteckt Bereiche/Header — User erwartet deshalb „neuer Inhaltsblock“.
- iframe: Host-DnD braucht korrektes `dragSource`; Grapes warnt, dass Drop außerhalb iframe fehlschlagen kann.
- Assumptions: User meint Compose `/email-editor`; gleiches `setEditorDragContent` gilt auch Template-Editor.
- Out of scope: Brevo-Dropzone-Pixel-Parität, neue Empty-State-UI außer minimalem API-Fix.
