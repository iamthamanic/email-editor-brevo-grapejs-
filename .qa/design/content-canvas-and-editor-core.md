# Design — Inhaltscanvas + Editor-Kern stabilisieren

**Datum:** 2026-08-11
**Status:** Vorschlag zur Freigabe
**Vorlauf:** `.qa/runs/debug-editor-core-interactions-2026-08-11.md` (Root-Cause-Analyse)
**Prior Art:** `~/.cursor/prior-art/grapesjs-caret-selection-dragdrop.md`

---

## 1. Zielbild

Ein E-Mail-Template besteht aus **fester Chrome** (Header / Footer / Social, gesperrt)
und **genau einem Inhaltscanvas** dazwischen. Alles, was der Nutzer baut, landet als
geordnete Liste von Blöcken in diesem einen Canvas — per Drag & Drop, mit eindeutigen
Drop-Zielen.

```
wrapper
├── email-section role=header    (gesperrt, optional)
├── email-section role=content   ← DAS CANVAS, genau eines
│   └── email-row → email-column
│        ├── email-text
│        ├── email-image
│        ├── email-button
│        ├── email-divider / email-spacer
│        └── email-layout-row   (mehrspaltig, verschachtelt statt top-level)
├── email-section role=footer    (gesperrt, optional)
└── email-section role=social    (gesperrt, optional)
```

**Was sich ändert:** Mehrspaltige Layouts sind kein Top-Level-Abschnitt mehr, sondern
ein Block *im* Canvas. Es gibt nie mehr als eine `content`-Section.

**Was gleich bleibt:** Die Ausgabe ist weiterhin tabellenbasiertes E-Mail-HTML
(`section`→`<table>`, `row`→`<tr>`, `column`→`<td>`). GrapesJS bleibt Layout-Engine.
Die `data-email-type`-Marker bleiben — sie tragen den Brevo-Rundlauf.

### Brevo-Rolle (Geschäftskontext)

Brevo ist Versand-Runtime, nicht Editier-Oberfläche. Sobald wir `htmlContent` per API
schreiben, ist Brevos eigener D&D-Editor für dieses Template weg — das ist akzeptiert.
Unsere Source of Truth ist `editorData` in Postgres. Der Import-Pfad muss deshalb
dauerhaft funktionieren, weil Templates weiterhin **in Brevo oder per MCP entstehen**
und dann bei uns editierbar sein müssen.

Daraus folgt eine harte Anforderung an das Canvas:

> **R1 — Round-Trip-Idempotenz:** Brevo-HTML → Import → Canvas → Publish-HTML →
> Re-Import muss denselben Komponentenbaum ergeben. Zweimal durchlaufen darf das
> Template nicht verändern.

---

## 2. Warum diese Reihenfolge

Der Cursor-Bug und das Canvas sind **unabhängige** Probleme. Der Cursor stirbt
*innerhalb* einer einzelnen Textbox, weil GrapesJS deren Subtree neu baut, während
unsere Schicht den Cursor hält (Beleg: `childList removed=4/added=4` auf dem Host,
danach Cursor auf 0). Das passiert bei einer Inhaltsbox genauso wie bei fünf.

Deshalb: **erst den Editier-Kern stabil machen, dann das Schema umbauen.** Wer beides
gleichzeitig anfasst, debuggt Cursor-Rennen und Schema-Fehler in derselben Sitzung und
hat kein verlässliches Testsignal.

Zweite Regel: **Regressionsnetz vor allem anderen.** Die bestehenden Specs sind
falsch-grün, weil sie gegen frische Starter-Templates laufen. Ohne Fixture mit
Param-/Link-Kindern kommt der Bug zum fünften Mal zurück.

---

## 3. Phasen

Jede Phase = ein `@implement`-Lauf mit eigener Acceptance-Datei und eigenem PR.

### Phase 0 — Regressionsnetz (blockiert alles Weitere)

**Problem:** `text-selection.spec.ts`, `debug-repro-rte-reentry.spec.ts` und
`verify-rte-reentry-after-click-out.spec.ts` sind falsch-grün. Sie testen
Starter-Templates ohne strukturelle Kinder — genau den Fall, der funktioniert.

**Umfang**

- Fixture `apps/editor/e2e/fixtures/structural-template.json`: ein `editorData` mit
  Text-Hosts, die `email-param`- und Link-Kinder haben. Committet, damit Tests nicht
  von der Dev-DB abhängen.
- Helper `openFixtureTemplate(page, fixture)`: legt das Template per API an und öffnet es.
- Die vier Debug-Specs zu Regression-Specs promoten, gegen das Fixture:
  - Cursor-Position nach kaltem Klick (30 Zyklen, `failCaret=0`)
  - kein `draggable="true"` auf Text-Hosts
  - Param-Pille landet an der Cursorposition
  - Textbaustein-Drop landet im Text-Host
- Die drei falsch-grünen Specs auf das Fixture umstellen.

**Fertig, wenn:** Die neuen Specs sind **rot** und beschreiben exakt die gemeldeten
Symptome. Ein grünes Ergebnis in dieser Phase wäre ein Fehler im Test.

**Aufräumen:** `apps/editor/e2e/debug-repro-*.spec.ts` löschen (vier Dateien).

---

### Phase 1 — Drei isolierte Fixes

Unabhängig von Architektur und Canvas, jeder für sich klein.

| Fix | Datei | Änderung |
|-----|-------|----------|
| Drag beim Klick-Halten | `packages/email-components/src/register.ts` (`email-text` ~289, `email-heading` ~468) | `draggable: false` in die Defaults. GrapesJS-Default `true` landet sonst als `draggable="true"` im DOM und startet nativen HTML5-Drag. Verschieben bleibt über das Move-Icon der Component-Toolbar. |
| Param an Cursorposition | `apps/editor/src/variables/insertVariable.ts` | Aktuell: `exitRte()` (zerstört Selection) → `host.append(badge)`. Neu: Range **vor** dem Öffnen des Menüs sichern (Toolbar nutzt bereits `preserveSelection`), Badge per `range.insertNode` einsetzen, Cursor hinter die Pille. Muster: atomarer Inline-Node in die Selection (Dify). |
| Textbaustein-Drop in Textfeld | `packages/email-components/src/param.ts:536`, `register.ts:299` | `isInlineParamDrop` erlaubt nur `email-param`/`textnode`/`text`/`link` und gibt pauschal `false` zurück, sobald die Quelle eine Definition ohne `.get()` ist — das trifft `Canvas.startDrag({content})` aus `canvasInsert.ts`. Neu: Typ aus der Definition lesen; `email-text` als Inline-Merge ins Ziel zulassen. Ein abgelehntes Ziel zeigt in GrapesJS keinen Placeholder — deshalb fehlt heute auch die Dropzone. |

**Fertig, wenn:** Drei Specs aus Phase 0 werden grün, der Cursor-Spec bleibt rot.

---

### Phase 2 — DOM-Ownership für den Text-Host (der eigentliche Cursor-Fix)

**Root Cause:** Zwei Besitzer desselben DOM-Knotens. GrapesJS rendert den Host aus dem
Model (`syncContent` → `resetFromString`), unsere Schicht setzt Cursor und
`contenteditable` imperativ. Keine Reihenfolge-Garantie. `hasStructuralChildren()`
(`rteSync.ts:76`) schickt genau die importierten Hosts in den `syncContent`-Pfad.

**Architektur-Stopp beachten:** Es gab bereits ≥ 3 Fix-Versuche
(`clickToEdit.ts` enthält sieben Kompensatoren: `reapplyIfStuckAtStart`,
`clickOwnsEnableUntil`, `leaveChain`, CE-Re-Stamping …). Kein vierter Kompensator.
Diese Phase **entfernt** Kompensatoren, statt einen hinzuzufügen.

**Regel, die durchgesetzt wird**

> Solange ein Host aktiv editiert wird, darf **nichts** sein DOM aus dem Model neu
> bauen. Persistenz läuft ausschließlich still über das Model. Rebuild erst nach
> echtem Blur.

**Umfang**

- `rteSync.ts`: `persistStructuralHost` für den aktiv editierten Host sperren —
  auch strukturelle Hosts laufen mid-session über den stillen Pfad. Die
  Sonderbehandlung `hasStructuralChildren` verschwindet aus dem Autosave-Pfad.
- `persistHostDomSilent` muss Hosts mit Param-/Link-Kindern korrekt persistieren
  (heute steigt sie bei `hasStructuralChildren` aus). Kinder als Komponenten erhalten,
  nicht zu einem HTML-String plattmachen.
- `clickToEdit.ts`: `leaveChain` so umbauen, dass der Wiedereintritt erst **nach** der
  GrapesJS-Renderrunde läuft (das Promise von `disableEditing()` löst zu früh auf —
  Beleg: ~40 `component:mount` nach dem Cursor-Setzen). Danach die Kompensatoren
  entfernen, die dann nachweislich überflüssig sind.
- Ein `// ponytail:`-Kommentar dokumentiert, welche Kompensatoren bewusst bleiben.

**Fertig, wenn:** Der 30-Zyklen-Cursor-Spec ist grün, und mindestens vier
Kompensatoren aus `clickToEdit.ts` sind gelöscht — nicht nur ergänzt.

**Eskalation, falls das nicht hält:** Rich-Text-Framework (TipTap oder Lexical) über
`setCustomRte` in den Text-Host — der von GrapesJS dokumentierte Erweiterungspunkt, den
auch die offiziellen CKEditor-/TinyMCE-Plugins nutzen. Dann besitzt genau eine Instanz
das Text-DOM. Kostet mehr, löst Cursor, Param-Insert und Drop-in-Text in einem Zug.
**Trigger:** Wenn nach Phase 2 der Cursor-Spec über 30 Zyklen nicht stabil grün ist,
nicht nachbessern, sondern eskalieren.

---

### Phase 3 — Canvas-Schema + Migration

**Ab hier ist der Editor stabil** — das ist die Voraussetzung, um das Schema anzufassen.

**Umfang**

- Schemaversion `editorSchemaVersion = 1` (Feld existiert bereits auf der DB-Zeile und
  überlebt Grapes-Autosave, anders als `__etsImport` im Project JSON).
- `packages/editor-core/src/migrateCanvasLayout.ts`, analog zu `migrateLegacyLayout`
  und am selben Hook eingehängt (nach `loadProjectData` **und** nach `setComponents`,
  `index.ts:493`):
  - Alle `email-section[role=content]` zu einer zusammenführen, Blockreihenfolge erhalten.
  - Mehrspaltige Content-Sections → `email-layout-row` als Block *im* Canvas.
  - Fehlt ein Canvas, eines anlegen (leeres Template).
  - **Idempotent** — zweimaliger Lauf verändert nichts.
- `wireSectionSlotOrder` vereinfachen: die „content*"-Bandlogik entfällt, es gibt genau
  einen Slot.
- `findContentColumnTarget` (`canvasInsert.ts:69`) entfällt weitgehend — das Ziel ist
  ab jetzt eindeutig statt geraten.
- Wrapper-`droppable` bleibt auf `email-section` beschränkt; die Canvas-Column bekommt
  eine explizite Drop-Regel für Leaf-Blöcke.

**Migrationssicherheit:** Vor dem ersten Schreiben einer migrierten Version einen
`TemplateVersion`-Snapshot mit `reason: "schema-migration"` anlegen — das Muster gibt
es beim Publish schon.

**Fertig, wenn:** Ein Bestandstemplate (`9cd044a5…`, Revision 202, heute fünf Sections)
lädt als genau ein Canvas, ohne Inhaltsverlust, und ein zweiter Ladevorgang ändert nichts.

---

### Phase 4 — Importer erzeugt das Canvas

**Muss gemeinsam mit Phase 3 ausgeliefert werden** — sonst erzeugt der Importer ein
Schema, das der Editor nicht mehr erwartet.

**Umfang**

- `packages/legacy-importer/src/recognition/sections.ts`: Rollenerkennung
  (header/footer/social) bleibt. Neu: alle als `content` erkannten Sections werden zu
  **einem** Canvas zusammengefasst; mehrspaltige Content-Zeilen werden zu
  `email-layout-row`-Blöcken darin.
- `packages/legacy-importer/src/mapper/toGrapesJs.ts`: emittiert die Canvas-Struktur.
- `packages/legacy-importer/src/parser/parseEditorNativeHtml.ts`: liest die
  Canvas-Marker zurück (nativer Round-Trip-Pfad für unser eigenes Publish-HTML).
- Testerwartung anpassen:
  `production-brevo-template-4.test.ts:23` — heute `[header, content, content, footer, social]`,
  neu `[header, content, footer, social]`. **Das ist der Beleg für dein Problem
  „manchmal legt er mehrere Inhaltsboxen an" — es ist heute festgeschrieben.**

**Fertig, wenn:** Die Fixtures in `packages/legacy-importer/src/*.test.ts` erzeugen
genau eine Content-Section, ohne Inhaltsverlust gegenüber der bisherigen Ausgabe.

---

### Phase 5 — Round-Trip-Härtung (R1)

Die Absicherung des Brevo-Geschäftsmodells. Ohne sie ist das Canvas ein Risiko.

**Umfang**

- Golden-File-Test: `Brevo-HTML → convertBrevoHtml → Canvas → buildPublishHtml →
  convertBrevoHtml` ergibt denselben Komponentenbaum. Läuft über die echten
  Produktionsfixtures, die es schon gibt (`production-brevo-*.test.ts`).
- Denselben Test über den Off-DOM-Renderpfad `renderEditorDataToPublishHtml`
  (Publish aus der Listenansicht ohne offenen Editor) — dieser Pfad wird bei einem
  Schemawechsel leicht übersehen.
- `sanitizeEmailHtml` darf die Canvas-Marker nicht strippen.

**Fertig, wenn:** Zweifacher Durchlauf verändert das Template nicht (Idempotenz).

---

### Phase 6 — Dropzone als Box

Kosmetik, bewusst zuletzt. Heute ist das kein Defekt, sondern so gebaut:
`apps/editor/src/styles.css:1688–1703` rendert `before`/`after` absichtlich als 10 px
Pille, nur `inside` (Zeile 1729) ist eine Box.

**Umfang**

- `packages/editor-core/src/dropIndicators.ts`: bei `sorter:drag:start` die Größe der
  Drag-Quelle messen und als CSS-Variablen auf den Placeholder schreiben.
- `styles.css`: `before`/`after` als Box in Quellgröße statt Pille rendern.
- Muster aus der Prior-Art-Recherche: dnd-kit `feedback: 'clone'` (Kopie in
  Originalgröße), Instatic (gestrichelter Rahmen 4 px innerhalb der Zielbox).

---

## 4. Was bewusst NICHT im Umfang ist

- **Kein RTE-Framework-Wechsel** in diesem Plan. Phase 2 versucht die günstige Lösung
  zuerst und hat einen definierten Eskalationstrigger.
- **Kein `packages/email-renderer`.** `AGENTS.md` listet ihn, es gibt ihn nicht;
  gerendert wird über GrapesJS im Browser. Das Canvas ändert daran nichts. Der
  Doku-Abgleich gehört in einen eigenen Vorgang.
- **Kein `packages/brevo-adapter`.** Das Gateway liegt real unter
  `apps/api/src/brevo/gateway.ts`. Gleiches Thema.
- **Symptom „eingefügte Box bleibt ausgewählt"** — nicht reproduzierbar; laut
  `.qa/acceptance/compose-block-insert.md:14` ist die Selektion nach dem Einfügen
  gewollt. Nach Phase 1 und 2 nochmal prüfen; die Wahrnehmung stammt vermutlich vom
  Cursor- und Drag-Bug.

---

## 5. Bekanntes Risiko außerhalb dieses Plans

Der Konfliktfall „jemand editiert das Template in Brevo, nachdem wir publiziert haben"
wird heute über einen **Zeitstempel-Heuristik** erkannt
(`syncConflict.ts:28`, 1,5 s Toleranz), nicht über einen Inhalts-Hash gegen
`publishedEditorData`. Bei eurem Zielbild — Marketing-Mails teils direkt in Brevo,
teils per MCP angelegt — wird dieser Pfad häufiger getroffen als bisher. Empfehlung als
eigener, kleiner Vorgang nach Phase 5: Dirty-Erkennung auf Hash-Vergleich umstellen.
Außerdem wird `REMOTE_CHANGED` im Typsystem und in der UI geführt, aber vom Sync nie
gesetzt — nur `CONFLICT`.

---

## 6. Ausführung mit `@implement`

Eine Phase pro Lauf, in dieser Reihenfolge. `@implement` erzeugt je Phase
`.qa/acceptance/<slug>.md` aus diesem Dokument.

| Reihenfolge | Slug | PR | Blockiert durch |
|---|---|---|---|
| 1 | `editor-regression-harness` | eigener | — |
| 2 | `editor-interaction-fixes` | eigener | Phase 0 |
| 3 | `rte-dom-ownership` | eigener | Phase 0 |
| 4 | `content-canvas-schema` | **gemeinsam mit 5** | Phase 2 |
| 5 | `importer-content-canvas` | **gemeinsam mit 4** | Phase 2 |
| 6 | `canvas-roundtrip-hardening` | eigener | Phase 3+4 |
| 7 | `dropzone-box-placeholder` | eigener | Phase 3 |

Nach jeder Phase: `@verify-ticket`, bei UI-Änderungen zusätzlich `@verify-ui`.
Vor dem PR: `@ecc-check`.

**Security (Secure-by-Default):** Für alle Phasen relevant ist **F-02**
(Legacy-HTML ist untrusted; `sanitizeEmailHtml` muss auf jedem neuen Import- und
Publish-Pfad greifen). Phase 4 und 5 fassen den Importer an — die Canvas-Marker dürfen
keinen Weg öffnen, der Sanitizing umgeht. Keine neuen Endpoints, keine Auth-Änderung,
keine Datenmigration mit Datenverlust (Snapshot in Phase 3).
