# Debug Report — `brevo-import-rte`

**Date:** 2026-08-12  
**Project:** Email-Template-Editor (GrapesJS)  
**Shell:** web (Vite `apps/editor` :5173 + Fastify `apps/api` :3001)  
**Repro grade:** partial (vite + Playwright on real Brevo DB template; not a full “all content text dead” failure)

---

## Summary

Brevo-importierte Templates sind **nicht** pauschal „RTE tot“. Content-Hosts lassen sich aktivieren und tippen — aber drei nachweisbare Mechanismen erzeugen genau das User-Gefühl „ich komme rein, kann aber nicht bearbeiten“: (1) **Footer/Header/Social sind absichtlich gesperrt**, (2) **Klick auf Variable-Pills** lässt die Selection in `contenteditable=false` landen → Tastatur-No-Op, (3) **Mid-Click-Caret** landet auf Produktions-Brevo-HTML oft bei **Offset 0** (Tippen wirkt „falsch“ / am Anfang). Das ist die gleiche Problemklasse wie Opuss Editor-Core-Analyse (strukturelle Hosts / Dual-Ownership), nicht der Fresh-Starter-Pfad.

**Confidence:** medium-high (Footer+Param: high; Mid-Caret-0: medium-high; „komplett kaputt“: not reproduced)

---

## Bug description

| | |
|--|--|
| **Expected** | Nach Brevo-Sync/Import verhalten sich Textboxen im Inhaltscanvas wie bei einem neuen Template: Klick → Caret an Klickposition → Tippen ändert Text |
| **Actual** | User: Inhalts-Canvas / Textboxen anders als Fresh; „kann reinkommen“, dann „nicht bearbeiten“ |
| **Steps (angenommen)** | 1. Templates von Brevo laden/syncen 2. Template öffnen 3. In eine Textbox klicken und tippen |
| **First seen** | Nach Brevo-Import vs. lokalem Neu-Template (Opus Phase 0–2 Kontext: strukturelle Hosts) |
| **Environment** | local macOS, branch working tree, `9cd044a5-…` (Brevo id 4, rev 203) |

---

## Reproduction

- **URL:** `http://localhost:5173/templates/9cd044a5-3db9-4fd6-8374-50e2fcfc20a1`
- **Playwright:**
  - `apps/editor/e2e/debug-repro-brevo-import-rte.spec.ts` (Fixture convert — Content tippt OK)
  - `apps/editor/e2e/debug-repro-real-brevo-rte.spec.ts` (echtes DB-Template)
- **Evidence:** `.qa/evidence/debug-brevo-import-rte/`
- **Result:** Content-Hosts tippen oft OK; Footer nie; Param-Klick nie; Mid-Click-Caret oft 0
- **Hard path:** nein (kein Flake-Loop; klarer Differenzial-Befund)

### Matrix (real Brevo, 2026-08-12)

| Host | Rolle | Mid-Click tippt? | Caret abs | Anmerkung |
|------|-------|------------------|-----------|-----------|
| 0 | content | ja, aber `typedAt: 0` | 0 | Kinder: `default` + `email-param`×3 |
| 0 param-click | content | **nein** | inParam | `rte=true`, Tastatur verschluckt |
| 1 | content | ja, `typedAt: 0` | 0 | großer HTML-`content`-String |
| 3 | content | ja, `typedAt: 0` | 0 | HTML-content |
| 4 | **footer** | **nein** | — | `data-locked`, Hint „Footer in Brevo…“ |

---

## Evidence

### Console

```
(keine Errors/Warnings im Real-Template-Lauf — R-click-type.json consoleLogs: [])
```

### Network

Kein 4xx/5xx am Editor-Load für dieses Template (conversionStatus `AUTO_APPROVED`, editorData vorhanden).

### Struktur (API `editorData` pages-Format)

- Gespeichert als Grapes **pages**-Projekt (nach Editor-Autosave), nicht nur `{ components }`.
- Vor Migration: **zwei** `content`-Sections; nach Load + `migrateCanvasLayout`: **eine** content-Section (Inventory live).
- Footer-Text host: `editable: false` (Chrome-Lock).

### Screenshots / JSON

- `.qa/evidence/debug-brevo-import-rte/03-real-brevo-canvas.png`
- `R-inventory.json`, `R-click-type.json`, `T-fresh-vs-brevo-caret.json`
- `S-mid-param-footer.json`, `W-host-matrix.json`, `V-iframe-click-caret.json`
- `H-real-template-structure.json`

### Param-Klick (rauchend)

```json
{ "inParam": true, "rte": true, "typedOk": false }
```

Host zeigt RTE an, Selection sitzt in `[data-email-type=email-param][contenteditable=false]` → `keyboard.type` ändert den Text nicht.

### Footer (by design)

```json
{
  "selectedType": "email-section",
  "selectedRole": "footer",
  "hint": "Footer in Brevo anpassen — hier nicht bearbeitbar.",
  "editing": null
}
```

### Mid-Caret (placeCaret setzt 0)

Iframe-Trace: `Selection.addRange` aus `placeCaretInHost` mit `abs: 0` nach Mid-Click — nicht „kein Enable“, sondern falsche Caret-Position.

---

## Prior art

- [x] Repo: `.qa/runs/debug-editor-core-interactions-2026-08-11.md` — Dual-Ownership / `syncContent` rebuild; Symptome nur auf Brevo/strukturellen Hosts, Fresh falsch-grün
- [x] Repo: `.qa/design/content-canvas-and-editor-core.md` + `.qa/acceptance/rte-dom-ownership.md` — Phase 2 Guard (`installRteSyncContentGuard`, `parseContent:false`); Chrome lock Header/Footer/Social
- [x] Repo: `packages/email-components/src/clickToEdit.ts` — `isInsideLockedChrome`, `healRteContentEditable` (lässt Param-CE=false), `placeCaretInHost` (verwirft Ranges in Params → Fallback)
- [x] Repo: `packages/email-components/src/layout.ts` — `applyProtectedLock` setzt Kinder unter Footer auf `editable: false`
- [x] Repo: `packages/legacy-importer/.../tokenizeRichText.ts` — Rich HTML als **ein** `content`-String + Param-Badges mit `contenteditable="false"`
- [ ] GitHub issues: nicht abgefragt
- [ ] LightRAG: offline / nicht genutzt
- [x] Regression harness: `e2e/structural-host-interactions.spec.ts` **5/5 grün** (Leave→Re-enter 30 Zyklen auf Fixture) — deckt Param-No-Op / Footer / Produktions-Mid-Caret-0 **nicht** ab

---

## Root cause

**Mehrfaktorisch — kein einzelner „Import kaputt“-Bug:**

1. **Chrome-Lock (produktentscheidung, wirkt wie Bug)**  
   Importierte Header/Footer/Social-Texte sehen aus wie Textboxen. `applyProtectedLock` + `isInsideLockedChrome` verhindern RTE. Klick selektiert oft die Section und zeigt Brevo-Hint — „drin“, aber nicht editierbar. Fresh-Templates haben denselben Lock, aber der User arbeitet dort typischerweise nur im leeren Inhaltscanvas.

2. **Param-Pills schlucken Tastaturinput (Bug)**  
   Importer / Runtime markieren `email-param` als `contenteditable="false"` (Pill). `healRteContentEditable` lässt das absichtlich. Klick auf die Pill lässt die Selection **in** der Pill; Host ist `rteEnabled`, aber Insert landet im Void. Fresh-Starter hat meist keine Params → Symptom nur nach Brevo.

3. **Caret-Platzierung auf Produktions-Brevo-HTML oft Offset 0 (Bug / Regression-Lücke)**  
   Opus’ Phase-2 hat den `syncContent`→Subtree-Rebuild-Race adressiert (Fixture-Harness grün). Auf dem echten Template setzt `placeCaretInHost` nach Mid-Click trotzdem `addRange` bei abs 0; Tippen hängt Zeichen vorne an. User-Erwartung „an der Stelle editieren“ scheitert, obwohl RTE „an“ ist.

**Hypothesen getestet:**

| Hypothese | Ergebnis |
|-----------|----------|
| Convert/Fixture-Pfad macht Content generell uneditierbar | **falsifiziert** (Fixture + Real Content tippen) |
| Footer/Chrome lock | **bestätigt** |
| Param-CE=false + Selection in Pill | **bestätigt** |
| DOM-Rebuild childList bei jedem Klick (Opus 2026-08-11) | **nicht** im Mid-Click-Trace gesehen (nur attributes); Phase-2 wirkt für diesen Pfad |
| Fresh vs Brevo identisch | **falsifiziert** (Params + Locked Chrome + Caret-0) |

**Fix attempts this bug:** 0 (Debug only)

---

## Suggested fix (minimal) — erst nach `@implement`

1. **Param-Klick:** In `placeCaretInHost` / `activateFromEvent`: wenn Target/Range in `email-param`, Caret **vor oder hinter** die Pill setzen (nie innen); optional nach Enable `heal` + explizites `collapse` neben Pill. Regression: E2E „click param → type inserts adjacent“.
2. **Mid-Caret auf Rich-HTML-Hosts:** `placeCaretInHost` / Koordinaten-Bridge gegen Production-Template `9cd044a5` härten; absCaret nach Mid-Click ≫ 0 asserten (nicht nur Fixture).
3. **Footer-UX (Produkt):** Entweder Hint prominenter / Klick auf Footer-Text nicht als „Textbox-Fokus“ lesen, oder Footer-Inhalte bewusst editierbar machen — das ist kein stiller Code-Fix ohne Produktentscheid.
4. **Nicht:** erneut `syncContent`-Kompensatoren stapeln ohne neuen Trace (Phase-2 / hard-bugs three-strike).

**Next step:** `@implement` (User hat explizit keinen Code in diesem Turn gewünscht)

---

## Notes

- Temporäre Specs: `debug-repro-brevo-import-rte.spec.ts`, `debug-repro-real-brevo-rte.spec.ts` — nach Fix löschen oder zu Regression promoten.
- Opus-Kontext: Dual-Ownership war die Architektur-Ursache; Import erzeugt die Hosts, an denen sie sichtbar wird. Phase 2 deckt Leave→Re-enter auf Fixture ab; User-Symptom heute = Lock + Param + Caret-0 auf Real-HTML.
- Assumptions: User meint Textbearbeitung (nicht Dropzone/DnD aus dem parallelen Thread).
- Out of scope: Brevo API sync performance; HVAI-123 push.
