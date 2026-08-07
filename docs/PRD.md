# PRD — Email Template Service (GrapesJS + Brevo)

<!-- scaffolded by /project-setup from Technisches Konzept — draft: confirm with user -->

## 1. Problem / Motivation

Brevos eigener Drag-and-Drop-Editor ist für den ERP-Betrieb unzureichend bzw. nicht verfügbar für Templates, deren Inhalt über `htmlContent` gesetzt wurde. Das ERP braucht eine kontrollierte, eigene visuelle Bearbeitung von E-Mail-Templates, ohne Versand, Tracking oder Zustellung selbst zu betreiben.

Bestehende HTML-only-Templates in Brevo müssen migriert und danach als GrapesJS Project Data gepflegt werden — nicht bei jedem Öffnen aus HTML rekonstruiert.

## 2. Zielbild / Goals

- **ERP / Email Template Service** = Source of Truth für editierbare Templates (GrapesJS Project JSON).
- **Brevo** bleibt Runtime: transaktionaler Versand, Absender, Zustellung, Tracking, Bounces, Template-IDs, Parameter beim Versand.
- Standalone-Service (`email-template-service`), später per iframe / Microfrontend / React-Package ins ERP integrierbar.
- Mitarbeiter bearbeiten Blöcke (Text, Bild, Button, Header/Footer, Variablen) — keine E-Mail-Tabellen-/Outlook-Technik.
- Sync, Publish, Konflikte, Versionierung und Legacy-Import sind deterministisch und serverseitig abgesichert.

### Architektur (Ziel)

```text
ERP → Email Editor UI (GrapesJS) → Email Template API
         → Template DB / Legacy Importer / Asset Storage
         → Renderer → Brevo Adapter → Brevo → Versand
```

**Source of Truth:** GrapesJS Project JSON → Editor + Renderer → HTML → Brevo (nicht reverse: Brevo HTML bei jedem Öffnen parsen).

## 3. Non-Goals (v1)

- Realtime Collaboration
- AI Editor im Production-Pfad (KI nur Entwicklungshilfe für Importer-Regeln)
- Eigene Mailing Engine / Campaign Builder / Newsletter Automation
- Template Marketplace / 20 Themes
- Komplexer Workflow-State-Machine-Overkill
- MJML als Pflicht-Rendering-Schicht (optional später evaluieren)
- Serverseitiger URL-Import von Bildern (SSRF-Risiko; v1: kein Remote-Fetch)
- Fest verdrahtetes ERP-Corporate-Design im Editor (Theme Contract statt)
- Brevo Drag-and-Drop-Format nachbauen

## 4. Nutzer / Rollen

Der Service kennt **Permissions**, nicht ERP-Rollen.

| Rolle (ERP-seitig) | Typische Permissions | Beschreibung |
|--------------------|----------------------|--------------|
| Editor / Marketing | read, create, edit | Templates bearbeiten, Autosave |
| Publisher | + publish | Validieren und nach Brevo veröffentlichen |
| Admin / Komponenten | + manage_components, raw_html | Corporate Blocks, HTML-Block |
| Nur Lesen | read | Preview / Liste |

Permissions (API):

- `email_templates.read` / `create` / `edit` / `publish` / `delete`
- `email_templates.manage_components` / `raw_html`

## 5. Kern-Scope (v1)

### A) Foundation

Repository, Postgres, Template API, GrapesJS, Project-Data speichern/laden (erstellen, bearbeiten, Autosave, Reload).

### B) Email Components & Blocks

Content: Text, Überschrift, Bild, Button, Divider, Spacer.  
Layout: 1/2/3 Spalten, Section.  
Corporate: Header, Footer, Legal, Kontakt, Social.  
ERP: Auftrag/Rechnung CTA, Kundeninfo, Ansprechpartner.  
Advanced: HTML Block (rechtepflichtig).

### C) Component Registry & Corporate Components

Eine `ComponentRegistry` für Editor-Verhalten, Validierung, Rendering, Import-Erkennung. Corporate Blocks als typisierte Komponenten (z. B. `company-footer` + `variant`), nicht kopiertes HTML.

### D) Variablen & Preview

Variable Registry (Customer/Order/Invoice …) mit Labels und Brevo-Expressions. Preview mit Sample Data; später Brevo Render Preview.

### E) Brevo Adapter & Publish

`BrevoTemplateGateway`: list/get/create/update/delete/preview. Publish = Validate → Render → Sanitize → PUT/POST Brevo. Autosave nur lokal. Versionierung bei jedem Publish; Rollback = neuer Entwurf.

### F) Sync & Konflikte

Polling (kein Template-Webhook). Status: `DRAFT` | `PUBLISHED` | `REMOTE_CHANGED` | `CONFLICT` | `IMPORT_FAILED`. Kein Last-Write-Wins; Konflikt-UI.

### G) Legacy Importer

Deterministische Pipeline: sanitize → technische Strukturen → Semantik → Corporate Patterns → `legacy-html` Fallback. Fixtures + Confidence nur für Migration/Diagnose.

### H) Security & ERP Contract

Auth über ERP (kurzlebige Tokens); Permissions serverseitig; Brevo-Key nur Backend; HTML sanitize + sandboxed Preview; Theme Contract (CSS tokens / postMessage); Audit Log; Rate Limits.

## 6. Constraints

| Bereich | Entscheidung |
|---------|--------------|
| Stack Frontend | React, TypeScript, Vite, GrapesJS |
| Stack Backend | Node.js, TypeScript, Fastify |
| DB | PostgreSQL |
| Assets | `AssetStorageProvider` (S3/R2/… austauschbar) |
| Locale (UI) | de |
| Integration v1 | Standalone; iframe-first später |
| Repo-Form | Monorepo: `apps/editor`, `apps/api`, `packages/*` |
| Deployment | TBD (Vercel-kompatible API-Patterns wo sinnvoll; Postgres + Secrets extern) |

### Datenmodell (Kern)

`email_templates`: id, brevo_template_id, name, subject, sender_*, status, source, `editor_data` (JSONB), `published_html`, `published_editor_data`, sync timestamps, revision, …

### API (Auszug)

Templates CRUD, publish, import, resolve-conflict, duplicate; Assets; Preview; Sync (`POST /api/sync/brevo`, status). Einheitliches `{ data, error }` Format. Optimistic concurrency via `revision` / `expectedRevision`.

## 7. UX / Qualität

- Desktop-Layout: Blocks | Canvas | Properties; Bottom: Desktop/Mobile, Preview Data, HTML, Versions
- Progressive Disclosure: Advanced nur mit Recht
- Undo/Redo, Duplicate, Delete, Move
- Autosave Debounce (1–2s) + Saved/Saving/Failed
- Publish bewusst; Validation Errors blockieren, Warnings (z. B. Alt-Text) konfigurierbar
- Preview: Desktop + Mobile + Sample Data
- Tests: Unit, Integration, Brevo Contract Fixtures, Importer Fixtures, Render Snapshots, E2E Happy Path; manuelle Email-Clients vor Prod

## 8. Offene Fragen

- [ ] Konkrete ERP-Auth (Bearer vs Cookie / Token Exchange)
- [ ] Deployment-Ziel (Hosting API + Postgres + Asset Storage)
- [ ] Asset-Storage-Provider für v1 (lokal vs S3/R2)
- [ ] Welche 5–10 Pilot-Templates für ersten Import-Rollout?
- [ ] Freigabe dieses PRD-Entwurfs (aus Technischem Konzept)

---

**Verwandte Docs:** [AGENTS.md](../AGENTS.md) · [README.md](../README.md) · [UI_STYLEGUIDE.md](UI_STYLEGUIDE.md)
