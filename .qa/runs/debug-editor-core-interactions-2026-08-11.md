# Debug Report — `editor-core-interactions`

**Date:** 2026-08-11
**Project:** Email-Template-Editor (GrapesJS)
**Shell:** web (Vite `apps/editor` :5173 + Fastify `apps/api` :3001)
**Repro grade:** full (4 of 6 reported symptoms), not-reproduced (1), by-design/CSS (1)

---

## Summary

Der Editor hat **zwei unabhängige Besitzer desselben DOM**: GrapesJS rendert den
Text-Host aus dem Model (`resetFromString` → kompletter Subtree-Neuaufbau) und
unsere Schicht (`clickToEdit.ts` / `rteSync.ts`) setzt Cursor und
`contenteditable` imperativ. Es gibt keine Reihenfolge-Garantie zwischen beiden.
Der Cursor wird nachweislich **korrekt** gesetzt und ~30 ms später durch einen
Model-getriebenen Neuaufbau des Host-Subtrees vernichtet. Alle bisherigen Fixes
waren Kompensatoren gegen dieses Rennen, nicht dessen Beseitigung — deshalb kommt
der Bug in wechselnder Form zurück.

**Confidence:** high
**Fix-Versuche an diesem Bug (dokumentiert):** ≥ 3 → **Architektur-Stopp nach
`hard-bugs.md` Regel C.** Kein vierter Kompensator.

---

## Bug description

| Nr | Symptom (User) | Status |
|----|----------------|--------|
| 1 | Klick mitten in den Text → Cursor springt an den Anfang | **reproduziert (deterministisch)** |
| 2 | Neu eingefügte Textbox bleibt dauerhaft ausgewählt | **nicht reproduzierbar** in Automation |
| 3 | Klick-halten startet Drag statt Textauswahl | **reproduziert (Ursache belegt)** |
| 4 | Dropzone ist ein Strich, soll eine Box in Inhaltsgröße sein | **kein Bug — CSS/Design so gebaut** |
| 5 | Params landen am Anfang statt am Cursor | **reproduziert (deterministisch)** |
| 6 | Textbausteine lassen sich nicht in ein Textfeld ziehen, keine Dropzone | **reproduziert (deterministisch)** |

---

## Reproduction

- **URL:** `http://localhost:5173/templates/9cd044a5-3db9-4fd6-8374-50e2fcfc20a1`
  (echtes Brevo-Import-Template, Revision 202 — *nicht* das Starter-Template)
- **Specs (temporär, löschen oder zu Regression promoten):**
  - `apps/editor/e2e/debug-repro-real-template.spec.ts`
  - `apps/editor/e2e/debug-repro-caret-race.spec.ts`
  - `apps/editor/e2e/debug-repro-dom-rebuild.spec.ts`
  - `apps/editor/e2e/debug-repro-editor-core-interactions.spec.ts`

**Wichtig:** Auf einem frisch erzeugten Starter-Template sind Symptom 1 und 3
**grün**. Sie treten nur bei Templates auf, deren Text-Hosts echte
Kind-Komponenten haben (`email-param`, Links) — also bei allen aus Brevo
importierten. Genau deshalb waren die bestehenden E2E-Specs falsch-grün.

### Rote Kommandos (je einmal gelaufen)

```
npx playwright test e2e/debug-repro-caret-race.spec.ts
→ [RACE] broken 15/16
```

```
npx playwright test e2e/debug-repro-real-template.spec.ts
→ caret at/below 0 in 4/5 probes
→ text hosts must not carry native draggable=true — Received: true
```

---

## Evidence

### 1. Cursor wird korrekt gesetzt und danach zerstört

`MutationObserver` auf dem Text-Host + Patch auf `Selection.addRange`,
zweiter Eintritt in denselben Block (`debug-repro-dom-rebuild.spec.ts`):

```
=== cycle 1  finalCaret=458  (OK) ===
 t=16  addRange off=458   by placeCaretInHost << forceEnableTextRte
 t=17  addRange off=458   by placeCaretInHost << (click path)
 t=59  selectionchange caret=458        ← bleibt korrekt

=== cycle 2  finalCaret=0  (BROKEN) ===
 t=7   addRange off=458   by placeCaretInHost << forceEnableTextRte
 t=7   addRange off=458   by placeCaretInHost << (click path)
 t=8   mutation attributes contenteditable  caretAfter=458   ← noch korrekt
 t=33..38  gjs:component:mount  × ~40
 t=38  mutation childList target=HOST  removed=4
 t=38  mutation childList target=HOST  added=1 ×4          ← Subtree neu gebaut
 t=41  selectionchange caret=0                              ← Cursor tot
```

Der Cursor wird **nicht** von einer Selection-API auf 0 gesetzt — es gibt nach
`addRange(458)` keinen weiteren Selection-Aufruf. Er kollabiert, weil der
Browser die Selection verwirft, wenn die Kindknoten des `contenteditable`
ersetzt werden.

### 2. Warm vs. kalt

| Situation | Cursor |
|-----------|--------|
| Klick, während der Block schon editiert wird | korrekt (Browser macht es selbst) |
| Erster Eintritt nach Seitenload | meist korrekt |
| Jeder weitere Eintritt nach Verlassen | **0** (15 von 16 Messungen) |

Der Pausenlänge zwischen Verlassen und Wiedereintritt (0–900 ms) ändert nichts —
es ist kein Timing-Fenster, das man „lang genug warten“ kann.

### 3. Native Drag-Attribute auf Text-Hosts

```
[DEBUG-DRAG] hosts: [
 {"id":"ioyig","modelDraggable":true,"domDraggable":"true"},
 {"id":"i9cum","modelDraggable":true,"domDraggable":"true"},
 {"id":"i8aej","modelDraggable":true,"domDraggable":"true"},
 {"id":"ipk6n","modelDraggable":false,"domDraggable":null}
]
```

`email-text` setzt in `register.ts` **kein** `draggable: false`. GrapesJS' Default
`draggable: true` schreibt `draggable="true"` ins DOM → der Browser startet
HTML5-Drag beim Drücken-und-Ziehen, sobald der Host *nicht* contenteditable ist.
Ist RTE aktiv, gewinnt Textauswahl — daher wirkt es sporadisch.

### 4. Param-Insert ignoriert den Cursor vollständig

```
[DEBUG-D] caret before insert: 27
[DEBUG-D] pill text index:      0
[DEBUG-D] plain: "{{ params.vorname }}\nAlpha Beta Gamma Delta Epsilon…"
```

### 5. Textbaustein-Drop wird abgelehnt

```
[DEBUG-E] saved items: 3
[DEBUG-E] drop indicator: {"present":false,"rect":{"w":0,"h":0}}
[DEBUG-E] len before/after: 45 45
```

---

## Prior art

### Im Repo

- `.qa/runs/debug-rte-reentry-after-click-out-2026-08-10.md` — nennt bereits
  `syncContent` → `resetFromString` als Cursor-Killer; Fix-Versuche „≥ 3“.
- `.qa/runs/debug-rte-reentry-research-2026-08-10.md` — `__clearAttributes`
  löscht `contenteditable`; Gegenmaßnahme `installNativeCustomRte` + Re-Stamping.
- `.qa/runs/debug-rte-dead-after-variables-menu-2026-08-10.md` — Toolbar klaut Fokus.
- `.qa/runs/debug-compose-block-dropzone-2026-08-09.md` — `dragContent` → `dragSource`.
- `.qa/acceptance/compose-block-insert.md:14` — „Eingefügter Block ist selektiert“
  ist **so gewollt** (relevant für Symptom 2).
- Kompensatoren im Code: `clickToEdit.ts` Zeilen 291, 352, 420, 568–571, 575,
  624–626, 634–660, 707 — `reapplyIfStuckAtStart`, `clickOwnsEnableUntil`,
  `leaveChain`, CE-Re-Stamping. Alles Symptombehandlung.
- **`clickToEdit.ts` und `rteSync.ts` sind nie committet worden** (untracked) —
  die gesamte Fix-Historie existiert nur im Working Tree.

### Aus `@mine-stars` (213 Sterne gescannt)

Report: `~/.cursor/prior-art/grapesjs-caret-selection-dragdrop.md`

| Projekt | Erkenntnis |
|---------|-----------|
| [CoreBunch/Instatic](https://github.com/CoreBunch/Instatic) (MIT) | Architektur-Zwilling (iframe-Canvas + dnd-kit + inline contenteditable). Regel: das Framework darf den editierbaren DOM während einer Edit-Session **nicht** besitzen. Inhalt einmal imperativ seeden, per `innerText` zurücklesen, nie neu schreiben solange der Host Fokus hat. |
| [clauderic/dnd-kit](https://github.com/clauderic/dnd-kit) (MIT) | „Only the element connected to the `handleRef` will initiate the drag“ + `preventActivation` — genau für „native Textauswahl in einem Draggable erlauben“. `feedback:'clone'` = Box-Platzhalter in Originalgröße. |
| [anyproto/anytype-ts](https://github.com/anyproto/anytype-ts) | Cursor als **Model-State**: Singleton-Service mit `{blockId, {from,to}}`, `backup()` / `restore()`. |
| [langgenius/dify](https://github.com/langgenius/dify) | `{{variable}}`-Pills als inline-atomare Nodes, eingefügt in die *Selection* nach `editor.focus()`. Toolbar-Fokusklau wird über `event.relatedTarget` im Blur-Handler ignoriert, statt Selection zu sichern/wiederherzustellen. |
| [onlook-dev/onlook](https://github.com/onlook-dev/onlook) (Apache-2.0) | Gegenentwurf: echten Editor als Overlay über dem iframe-Rect mounten, damit der neu rendernde DOM nie den Cursor hält. |

---

## Root cause (pro Symptom)

### Symptom 1 — Cursor springt an den Anfang → **Architekturproblem**

`packages/email-components/src/clickToEdit.ts` platziert den Cursor per
`placeCaretInHost` erfolgreich. Danach löst GrapesJS einen Model→View-Neuaufbau
des Host-Subtrees aus (`components().reset()` / `resetFromString`, sichtbar als
`childList removed=4 / added=4` auf dem HOST plus ~40 `component:mount`). Der
Browser verwirft dabei die Selection; der Cursor fällt auf Offset 0.

Ausgelöst wird der Neuaufbau vom **verzögerten Content-Sync der vorherigen
RTE-Session** (`disableEditing` → Grapes-Blur-Sync). `leaveChain` in
`wireCanvasTextClickToEdit` wartet nur auf das Promise von `disableEditing()`,
nicht auf Grapes' anschließende Backbone-Render-Runde. Deshalb ist der erste
Eintritt nach dem Laden meist grün und jeder weitere rot.

Verstärkend: `hasStructuralChildren()` in `rteSync.ts:76` schickt genau die
Hosts mit `email-param`/Link-Kindern — also alle importierten Templates — in den
`syncContent`-Pfad (`persistStructuralHost`), während flache Hosts still über
`persistHostDomSilent` laufen. Das erklärt exakt, warum der Bug beim
Starter-Template nicht auftritt und beim echten Template immer.

**Getestete Hypothesen:**
1. Falsche Klickkoordinaten (iframe vs. Parent) → **widerlegt**,
   `caretRangeFromPoint` liefert an den echten Event-Koordinaten korrekte Offsets
   (450/545), und `addRange` protokolliert Offset 458.
2. Klick landet auf einer Param-Pille, `usableRangeInHost` verwirft die Range →
   **teilweise** ein zweites, eigenständiges Problem (Fallback-Koordinaten in
   `pointsForHostDoc` sind Rateversuche), aber **nicht** die Hauptursache.
3. Ein späterer Aufruf setzt die Selection zurück → **widerlegt**, nach
   `addRange(458)` gibt es keinen Selection-Aufruf mehr.
4. DOM-Neuaufbau kollabiert die Selection → **bestätigt** (Evidenz oben).

### Symptom 3 — Drag beim Klick-Halten

`register.ts:289` (`email-text`) und `:468` (`email-heading`) setzen kein
`draggable: false`. GrapesJS-Default `true` → `draggable="true"` im DOM →
nativer HTML5-Drag. Verschwindet nur zufällig, wenn RTE gerade aktiv ist.
Folgefehler von Symptom 1: solange der Block nicht in RTE kommt, ist er immer
im Drag-Modus.

### Symptom 5 — Param am Anfang

`apps/editor/src/variables/insertVariable.ts:74` kennt den Cursor überhaupt
nicht. Ablauf: `exitRte(editor)` (zerstört die Selection) → `host.append(badge)`
(hängt an, ohne Position). Es gibt keinen Code-Pfad, der jemals eine Range
benutzt. Das ist kein Rennen, sondern eine fehlende Funktion.

### Symptom 6 — Textbaustein-Drop

`register.ts:299`: `droppable: (src) => isInlineParamDrop(src)`, und
`param.ts:536` erlaubt nur `email-param`, `textnode`, `text`, `link`. Ein
Textbaustein wird als `email-text`-Definition gedraggt → abgelehnt. GrapesJS
zeigt für ein abgelehntes Ziel keinen Placeholder — daher auch keine Dropzone.
Zusätzlich: `isInlineParamDrop` gibt `false` zurück, sobald die Drag-Quelle eine
reine Definition ohne `.get()` ist (Kommentar in Zeile 537) — das trifft auf
`Canvas.startDrag({content})` aus `canvasInsert.ts` zu, also auch auf Params.

### Symptom 4 — Dropzone als Strich

Kein Defekt: `apps/editor/src/styles.css:1688–1703` gestaltet `before`/`after`
bewusst als 10 px Pille mit Label „Hier einfügen“; nur `inside` ist eine Box
(Zeile 1729). Der Wunsch „Box in Größe des gezogenen Inhalts“ ist eine
Design-Änderung. `dropIndicators.ts` liefert bereits das `data-ets-placement`,
aber keine Größe der Drag-Quelle.

### Symptom 2 — Eingefügte Box bleibt ausgewählt

**Nicht reproduzierbar.** In beiden Repros wandert `getSelected()` beim Klick
korrekt auf den Zielblock (`debug-repro-editor-core-interactions.spec.ts` Test B
und `debug-repro-real-template.spec.ts` Test „insert block then click other text
host“ sind grün). Wahrscheinlich ist es die *Wahrnehmung* von Symptom 1 + 3: der
neue Block behält den Auswahlrahmen im Toolbar-Kontext (`EditorToolbar.tsx:188`
`editor.select(first)` ist laut `.qa/acceptance/compose-block-insert.md:14`
Absicht), und weil der Klick in den anderen Block keinen Cursor setzt, wirkt es,
als sei die Auswahl hängengeblieben. Für eine harte Aussage brauche ich einen
Screenshot oder die genaue Klickfolge.

---

## Suggested fix (Richtung, nicht Patch)

Wegen des Architektur-Stopps kein weiterer Kompensator. Zwei tragfähige Wege —
Entscheidung gehört dem User:

**A — Ownership trennen (kleiner Eingriff, behebt 1)**
Während einer aktiven RTE-Session darf nichts das Host-DOM aus dem Model neu
bauen. Konkret: `syncContent`/`resetFromString` für den gerade editierten Host
komplett sperren (auch für strukturelle Hosts), Persistenz ausschließlich still
über das Model, und Rebuild erst nach echtem Blur. Zusätzlich `leaveChain` so
umbauen, dass der Wiedereintritt erst nach der Grapes-Renderrunde läuft
(`editor.once('component:mount' | rAF-Doppelframe)` statt nur Promise).

**B — Cursor als Model-State (robuster, Anytype-Muster)**
Cursor nicht als DOM-Range halten, sondern als `{hostId, textOffset}` in einem
Service. Nach jedem Rebuild aus dem Model wiederherstellen. Löst 1 und 5
gleichzeitig, weil der Param-Insert dann eine definierte Einfügeposition hat.

Unabhängig davon, alle klein und isoliert:

| Symptom | Datei | Änderung |
|---------|-------|----------|
| 3 | `packages/email-components/src/register.ts` (`email-text`, `email-heading`) | `draggable: false` in den Defaults; Verschieben nur über das Move-Icon der Component-Toolbar |
| 5 | `apps/editor/src/variables/insertVariable.ts` | Range vor `exitRte` sichern und Badge per `range.insertNode` an der Cursorposition einsetzen (Dify-Muster: atomarer Inline-Node in die Selection) |
| 6 | `packages/email-components/src/param.ts:536` + `register.ts:299` | `email-text` als Drop-Quelle in Text-Hosts zulassen (Inhalt inline mergen), und Definitions-Quellen ohne `.get()` typbasiert auswerten statt pauschal `false` |
| 4 | `apps/editor/src/styles.css` + `packages/editor-core/src/dropIndicators.ts` | Größe der Drag-Quelle beim `sorter:drag:start` messen und als CSS-Variable auf den Placeholder schreiben; `before`/`after` als Box statt Pille rendern |

**Regressionsschutz (muss gegen ein Template mit Param-/Link-Kindern laufen,
nicht gegen das Starter-Template):**
`debug-repro-caret-race.spec.ts` als Dauer-Spec übernehmen (30 Zyklen,
`failCaret=0`), plus die Assertions aus `debug-repro-real-template.spec.ts`
(kein `draggable="true"`) und `debug-repro-editor-core-interactions.spec.ts`
(Pill am Cursor, Textbaustein-Drop).

**Next step:** `@implement` — nach Entscheidung A oder B.

---

## Notes

- Die bestehenden Specs `text-selection.spec.ts`,
  `debug-repro-rte-reentry.spec.ts` und
  `verify-rte-reentry-after-click-out.spec.ts` sind **falsch-grün**: sie testen
  ausschließlich frisch erzeugte Starter-Templates ohne strukturelle Kinder.
- Temporäre Specs aus diesem Lauf sind noch im Repo und müssen gelöscht oder
  promotet werden (Liste oben).
- Kein Produktionscode wurde in diesem Lauf geändert.
