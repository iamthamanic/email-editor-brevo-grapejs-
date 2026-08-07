# Issue draft: Phase 4 — Variables

**Epic:** `.qa/design/phase-4-variables.md`  
**Status:** DRAFT — nicht auf GitHub angelegt  
**Locale:** de  
**MVP cut (deferred):** ERP GrapesJS-Blöcke, Brevo Render Preview, Live-ERP-Fetch, contact.* Tags, Publish, Variable-Admin-CRUD, Drop-in Host

---

## 1. [P0] email-variables registry + sample map

**featureSlug:** `phase-4-variables-registry`  
**dependsOn:** []

### Intent
Shared Package mit voller Customer/Order/Invoice-Param-Liste (HVAI `EmailParams` + Mahnung), Expression-Helfer und Sample-Map — eine Registry für API und Editor.

### User Journey
1. Entwickler importiert `@email-template/email-variables` (o.ä. Workspace-Name).
2. System liefert defs + `{{ params.x }}` + Sample-Werte.
3. Kein UI in diesem Slice.

### Problem
Keine zentrale Variable Registry (AGENTS Regel 4).

### Solution
Neues Package `packages/email-variables`: `registry`, `expression`, `sample`, `substitute`; Unit-Tests; Katalog laut Design-Tabelle. Typed-strict, keine Escape Hatches.

### Runtime
| Axis | This slice |
|------|------------|
| Local | yes |
| Cloud session | n/a |
| Appwrite Functions | skip |

### Edge Cases
- Unbekannter Key → `toExpression` / validate reject
- Whitespace in `{{ params.x }}` beim Parse tolerieren (wie HVAI Regex)
- Sample ohne PII (Musterfirma / Max Mustermann)

### Acceptance
- [ ] Alle Design-Katalog-Keys vorhanden, gruppiert customer|order|invoice|meta
- [ ] `toExpression('vorname')` → `{{ params.vorname }}`
- [ ] `substitute(html, sample)` ersetzt bekannte Tags, lässt unbekannte stehen
- [ ] Unit tests green; Touched files: zero type escape hatches

### Design
Epic: `.qa/design/phase-4-variables.md`

### Runner
Labels: P0  
Feature slug: `phase-4-variables-registry`

---

## 2. [P0] API GET variables + preview sample

**featureSlug:** `phase-4-variables-api`  
**dependsOn:** [email-variables registry + sample map]

### Intent
Auth-geschützte Endpoints liefern Katalog und Sample-Daten im `{ data, error }`-Format.

### User Journey
1. Editor (AUTH_MODE=dev) ruft `GET /api/variables` und `GET /api/preview/sample`.
2. System antwortet mit Registry + Sample-Map.
3. Ohne Auth → 401 (bestehendes DevAuth).

### Problem
User verlangt Sample bereits über API; Catalog nicht nur Client-Bundle.

### Solution
`apps/api/src/variables/routes.ts`; Register in `index.ts`; Import Package; CORS unverändert. Keine Mutation-Endpoints.

### Runtime
| Axis | This slice |
|------|------------|
| Local | yes |
| Cloud session | same routes later with JWT |
| Appwrite Functions | skip |

### Edge Cases
- AUTH_MODE unset → 401
- Response shape `{ data, error: null }`
- Rate limit: reuse existing patterns if any; else document follow-up

### Acceptance
- [ ] `GET /api/variables` returns grouped defs (key, label, group, expression)
- [ ] `GET /api/preview/sample` returns sample map for all keys
- [ ] Unauthenticated rejected
- [ ] Checks/tests; Touched files: zero type escape hatches

### Design
Epic: `.qa/design/phase-4-variables.md`

### Runner
Labels: P0  
Feature slug: `phase-4-variables-api`

---

## 3. [P0] Variable picker + insert into canvas

**featureSlug:** `phase-4-variables-picker`  
**dependsOn:** [API GET variables + preview sample]

### Intent
DE Variable-Picker im Editor: Klick fügt `{{ params.<key> }}` in selektierten Text/Button (oder Trait) ein.

### User Journey
1. Nutzer öffnet Template-Editor.
2. Öffnet „Variablen“, wählt z. B. „Vorname“.
3. Sieht `{{ params.vorname }}` im Canvas; Autosave speichert Project JSON.

### Problem
Kein UI zum Einfügen von Merge-Tags.

### Solution
`apps/editor/src/variables/VariablePicker.tsx` (+ API client); Integration in `TemplateEditorPage`; nur Keys aus API; keine freie Text-Eingabe für Expressions. GrapesJS selection insert (text component / content).

### Runtime
| Axis | This slice |
|------|------------|
| Local | yes |
| Cloud session | later |
| Appwrite Functions | skip |

### Edge Cases
- Keine Selection → Hinweis „Bitte Text oder Button wählen“
- API fail → Error-State + Retry
- Loading / Empty (leere Gruppe nicht zeigen)

### Acceptance
- [ ] Picker zeigt Gruppen Kunde / Auftrag / Rechnung (DE)
- [ ] Insert schreibt exakte Expression; persistiert nach Reload
- [ ] E2E happy path; Touched files: zero type escape hatches

### Design
Epic: `.qa/design/phase-4-variables.md`

### Runner
Labels: P0  
Feature slug: `phase-4-variables-picker`

---

## 4. [P1] Preview with sample substitution

**featureSlug:** `phase-4-variables-preview`  
**dependsOn:** [Variable picker + insert into canvas]

### Intent
Toggle „Beispieldaten“: Preview zeigt substituierten HTML aus Sample-API (nicht Live-Brevo).

### User Journey
1. Nutzer hat Variablen im Template.
2. Aktiviert Beispieldaten-Preview.
3. Sieht „Max“ statt `{{ params.vorname }}` (o.ä.).

### Problem
PRD Preview mit Sample Data fehlt.

### Solution
Preview-Pfad: render current HTML (GrapesJS) → `substitute` mit Sample von API; sandboxed iframe (bestehend/neu minimal). Toggle aus; Original-Tags bleiben in Project JSON unberührt.

### Runtime
| Axis | This slice |
|------|------------|
| Local | yes |
| Cloud session | later |
| Appwrite Functions | skip |

### Edge Cases
- Toggle off → raw expressions visible in preview
- Unknown tags remain as-is
- Sample fetch fail → Error + kein stiller Fallback auf leere Map ohne Hinweis

### Acceptance
- [ ] Toggle ersetzt bekannte params in Preview only
- [ ] Project JSON / Autosave unverändert (keine Sample-Werte persistiert)
- [ ] E2E; Touched files: zero type escape hatches

### Design
Epic: `.qa/design/phase-4-variables.md`

### Runner
Labels: P1  
Feature slug: `phase-4-variables-preview`
