# AGENTS.md — Email Template Service

Dieses Dokument ist die **verbindliche Projektkarte** für Menschen und KI-Agenten.
Lies es zuerst, bevor du Code änderst.

## Was ist dieses Projekt?

Standalone **Email Template Service** für ein ERP: visuelle Bearbeitung von Brevo-E-Mail-Templates mit **GrapesJS**. Das ERP (bzw. dieser Service) ist Source of Truth für Editor-Projekte (GrapesJS Project JSON). **Brevo** bleibt Versand-/Runtime (Templates via `htmlContent`, Tracking, Bounces). Spätere Integration als iframe / Microfrontend / React-Package.

**PRD:** [docs/PRD.md](docs/PRD.md)

### Was dieses Repo **ist**

- Monorepo: `apps/editor` (Vite + React + GrapesJS), `apps/api` (Fastify + Postgres), shared `packages/*`
- Template-Verwaltung, Blöcke, Variablen, Versionierung, Publish → Brevo, Sync, Legacy-HTML-Import
- Theme Contract für ERP-Einbettung (keine feste Corporate-CSS-Kopplung)

### Was dieses Repo **nicht** ist

- Kein Brevo-Klon / keine Campaign-/Newsletter-Engine
- Kein direkter Browser→Brevo-Zugriff (API-Key nur Backend)
- Keine ERP-Rollenverwaltung (nur Permissions)

---

## ERP-Zielsystem (HVAI-123) — verbindliche Integrationsregeln

Ziel-ERP: **[browo/HVAI-123](https://github.com/browo/HVAI-123)** (browo-ai-umbrella / Halteverbot123).

### Push-Verbot (absolut)

- **Niemals** nach `browo/HVAI-123` (oder dessen Submodule/Forks als Deploy-Ziel) **pushen**, force-pushen, PR mergen oder Remote-Branches anlegen — außer der User fordert das **explizit und schriftlich in derselben Nachricht**.
- Default: Analyse und Integration **nur lesend** (Clone/Fetch/Browse OK); Änderungen entstehen **in diesem Email-Template-Repo** (oder einem vom User freigegebenen Integrations-Branch in einem **anderen** Repo).
- Agents dürfen **keine** `git remote add`/`git push` gegen HVAI-123 ausführen und keine Secrets/Zertifikate aus jenem Repo committen.

### Was HVAI-123 schon hat (Kontext für Integration)

- Frontend: Vite + React + Ant Design / Tailwind, Modul `brevo_module` (Route `brevo`), Templates heute über **HtmlEditor** + Brevo REST (`/brevo/email/template_*`)
- Backend: Express + Prisma + JWT (`localStorage` `auth_token`) + `Authorized_Works`
- Microservices: `brevo_email_service` / `brevo_services` (Django) — Send + Template CRUD gegen Brevo
- Authz: neue Endpoints müssen in `Authorized_Works` landen
- Theme: Ant Design Tokens (`colorPrimary: #275073`, …) — nicht unsere `--erp-*` Fallbacks

Änderungen an unserem Service müssen diese Grenzen respektieren (Adapter statt ERP-Schema-Kopplung).

---

## Tech Stack (verbindlich)

| Bereich | Technologie | Notiz |
|---------|-------------|-------|
| Frontend | React, TypeScript, Vite, GrapesJS | App: `apps/editor` |
| Backend | Node.js, TypeScript, Fastify, **Prisma** | App: `apps/api`, eigene Postgres-DB |
| DB | PostgreSQL (+ Docker Compose) | Prisma migrations |
| Assets | `AssetStorageProvider` | S3/R2/… austauschbar |
| Styling | CSS Custom Properties (Theme Contract) | Tokens vom Host; Fallbacks lokal |
| Shared | `packages/` (schema, editor-core, components, importer, email-variables, theme-contract) | DRY Frontend/Backend |
| Brevo | `apps/api/src/brevo/` (`BrevoTemplateGateway`) | Kein separates `packages/brevo-adapter` (noch) — Gateway nur Backend |
| Render | GrapesJS im Browser (`getHtml` / `buildPublishHtml`) | Kein `packages/email-renderer` — Publish-HTML clientseitig |
| Tests | Vitest/`node:test` + Playwright via @verify-ui | Importer fixtures, structural e2e harness |
| Deployment | TBD | Secrets nur Env/Secret Manager |

**Nicht verwenden:** Brevo API Key im Frontend; HTML-Reconstruction als Editor-Source; Last-Write-Wins bei Sync-Konflikten; KI im Production-Import-Request.

---

## Architektur

```
email-template-service/
├── apps/
│   ├── editor/          # GrapesJS UI (Source of Truth: Project JSON)
│   │                    # Render/Publish-HTML: getSyncedHtml + buildPublishHtml
│   └── api/             # Template API, Sync, Authz, Assets
│       └── src/brevo/   # BrevoTemplateGateway (HTTP client + facade)
├── packages/
│   ├── email-schema/
│   ├── editor-core/
│   ├── email-components/ # GrapesJS block/component registry
│   ├── email-variables/
│   ├── legacy-importer/
│   └── theme-contract/
├── docs/
├── .qa/
└── AGENTS.md
```

> **Hinweis:** `packages/brevo-adapter` und `packages/email-renderer` stehen in älteren Skizzen —
> sie sind **nicht** im Repo. Brevo nur über `apps/api/src/brevo/`; HTML-Export über GrapesJS im Editor.

### Schichtenregeln

1. **GrapesJS Project JSON** ist die Editor-Source-of-Truth; Brevo erhält nur publiziertes HTML.
2. Businesslogik spricht **`BrevoTemplateGateway`** (`apps/api/src/brevo/gateway.ts`), nie direkt Brevo SDK/HTTP aus UI/Importer/Sync.
3. **Permissions** serverseitig prüfen; UI-Verstecken ist keine Security.
4. **ComponentRegistry** / Variable Registry / Theme Tokens existieren je einmal (packages) — nicht verdreifachen.
5. Preview-HTML nur in **sandboxed iframe**; Legacy-HTML = untrusted input (sanitize → normalize).
6. Autosave = lokal; Publish = bewusste Aktion + Version + Idempotency/`expectedRevision`.

---

## Sprache & Naming

| Bereich | Sprache |
|---------|---------|
| UI (Labels, Fehler) | Deutsch |
| Code, Commits, API codes | Englisch |

---

## Validation

- **Checks:** `npm run checks` (Root — siehe `scripts/run-checks.sh`)
- **Dev Editor:** `npm run dev --workspace=apps/editor` → http://localhost:5173
- **Dev API:** `npm run dev --workspace=apps/api` → http://localhost:3001 (geplant)
- **E2E:** `npm run test:e2e` (Playwright via @verify-ui when ready)

Run checks before push. Do not bypass hooks.

---

## UI / Design

- Styleguide: [docs/UI_STYLEGUIDE.md](docs/UI_STYLEGUIDE.md)
- Nur Theme-Contract-Tokens (`--erp-*`); kein fest verdrahtetes ERP-CD
- Required states: loading, empty, error, disabled; Autosave: Saved / Saving… / Save failed
- Progressive Disclosure für Advanced (HTML-Block, technische Settings)

---

## Security Checklist (Secure by Default)

Diese Checkliste ist **techstack-agnostisch** und für alle Agents verbindlich. Vollständige Quelle mit Severity-Mapping und RG-Probes: `~/.claude/skills/security-review/references/secure-by-default-checklist.md` (Inhalte eingebettet, keine externen Links).

Jede Feature-Implementierung muss die zutreffenden Sektionen abhaken. `@implement` dokumentiert die Coverage in der Acceptance-Datei, `@audit-changes`/`@ecc-check` führen diff-scoped Probes aus, `@review-ticket` prüft die Coverage im Verdict.

### Frontend Security

| # | Maßnahme | Fail if |
|---|----------|---------|
| F-01 | HTTPS überall | App läuft ohne TLS oder mixed content |
| F-02 | Input-Validierung & Sanitization | Unvalidierter User-Input erreicht Render-/State-Schicht |
| F-03 | Keine sensiblen Daten im Browser | `localStorage.setItem('token'\|'secret'\|'password', …)` im Diff |
| F-04 | CSRF-Schutz | State-changing Request ohne CSRF-Token oder SameSite-Cookie |
| F-05 | API-Keys nie im Frontend | Secrets in Client-Bundle, `NEXT_PUBLIC_*` für Secrets |

### Backend Security

| # | Maßnahme | Fail if |
|---|----------|---------|
| B-01 | Authentication Fundamentals | Eigenbau-Auth, Plaintext- oder schwache/unsalted Hashes |
| B-02 | Authorization Checks | Sensitive Operation ohne Rollen-/Owner-Check |
| B-03 | API-Endpoint-Schutz | Unauthentifizierter Endpoint auf geschützter Ressource |
| B-04 | SQL-Injection-Prävention | String-Konkatenation in SQL-Statement mit User-Input |
| B-05 | Basis Security Headers | Headers fehlen oder `unsafe-inline`/`unsafe-eval` ohne Removal-Plan |
| B-06 | DDoS-Schutz | Rate-Limiting deaktiviert, kein Edge-Protection-Layer |
| B-07 | Least-privilege assignment | Bundles/Rollen nur Whitelist; Actor kann mehr vergeben als er hält |
| B-08 | Deny-by-default AuthZ map | Non-GET hinter `*.view`; unbekannter Pfad → Default-Read statt deny |
| B-09 | Trust-boundary identity | User-ID/Rollen aus Client-Headern |

### Practical Security Habits

| # | Maßnahme | Fail if |
|---|----------|---------|
| P-01 | Dependencies aktuell | `npm audit --audit-level=high` zeigt offene High/Critical |
| P-02 | Korrekte Fehlerbehandlung | Error-Response enthält Stack-Trace, interne Pfade oder Secrets |
| P-03 | Secure Cookies | Session-Cookie ohne HttpOnly oder ohne Secure in Prod |
| P-04 | File-Upload-Sicherheit | Upload ohne Type/Size-Validierung, Pfad-Traversal möglich |
| P-05 | Rate Limiting | Auth-Endpoint ohne Rate-Limit oder Limit deaktiviert |

**Projekt-spezifisch (zusätzlich):** Brevo-Key nur Backend; `javascript:` URLs blockieren; Asset Magic-Bytes; Sync Lock; kein Blind-Retry auf 4xx; Audit ohne Secrets.

Critical-Verstöße (F-03, B-01, B-04, B-07, B-08, B-09, P-04) blocken PR/READY. Important-Verstöße blocken ACCEPT/READY bis fix.

---

## QA Pipeline

```
@pingpong-solution  →  @implement  →  @verify-ui
```

- Design artifacts: `.qa/design/`
- Acceptance: `.qa/acceptance/` (auto-generated by @implement)
- Project config: `.qa/project.yaml`
- Living docs: `@memory-live-doc` (see below; also via `@ecc-check` / `@commit-push-safe`)

---

## Living documentation

After material changes, run `@memory-live-doc` (or rely on `@implement` / `@ecc-check` / `@commit-push-safe` / `@project-setup` integration).

- Do not invent features in docs without evidence.
- Storage: `.project-memory/` (bilingual DE+EN JSON; human docs under `docs/` + `docs/en/`).
- Interactive viewer: `docs/memory-live-doc/viewer/` (GitHub Pages).
- First setup: `@project-setup` Step 9 or `@memory-live-doc bootstrap`.

---

## README

Keep README in sync when adding features, scripts, or env vars.
