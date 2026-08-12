# Email Template Service

Visueller E-Mail-Template-Editor (GrapesJS) mit Brevo-Sync für ERP — Source of Truth ist GrapesJS Project JSON; Brevo bleibt Versand-Runtime.

Siehe [docs/PRD.md](docs/PRD.md), [docs/EMBED_CONTRACT.md](docs/EMBED_CONTRACT.md) (iframe/JWT/Theme) und [AGENTS.md](AGENTS.md).

## Prerequisites

- Node.js 20+
- npm 10+ (workspaces)
- Docker (Postgres)

## Setup

```bash
cp .env.example .env
cp .env.example apps/api/.env   # Prisma liest apps/api/.env
npm install
npm run db:up
npm run db:migrate             # interaktiv Name: init — oder: npm run db:push --workspace=@email-template/api
```

## Development

Zwei Terminals (beide nötig — sonst leere Proxy-Antwort / JSON-Fehler im Browser):

```bash
npm run db:up        # Postgres auf 5433 (einmalig / prüfen)
npm run dev:api      # http://127.0.0.1:3001  — AUTH_MODE=dev in apps/api/.env
npm run dev:editor   # http://localhost:5173 (proxy /api → API)
```

Editor + Autosave + Variablen laufen **ohne Brevo**. Brevo-Templates laden:

1. `BREVO_API_KEY=…` in `apps/api/.env` setzen
2. `BREVO_DEFAULT_SENDER_EMAIL=…` setzen (für Publish / Testversand)
3. API neu starten (`npm run dev:api`)
4. In der Template-Liste **Von Brevo laden** klicken

Das speichert Brevo-HTML lokal (`publishedHtml`); beim Öffnen greift ggf. die Auto-Konvertierung. Nie `VITE_*` für den Key.

**Veröffentlichen:** Im Template-Editor Button **Veröffentlichen** → Create/Update des SMTP-Templates in Brevo. Autosave bleibt lokal; Publish ist bewusst. Absender wählst du über dem Betreff aus der Brevo-Senderliste (Volltextsuche + Aktualisieren).

**Compose (Communication-Dev):** [http://localhost:5173/email-editor](http://localhost:5173/email-editor) — Header/Footer/Social mit HV-Brand (gesperrt), Inhalt editierbar, Versand via `POST /api/compose/send` (braucht `BREVO_DEFAULT_SENDER_EMAIL`).

Legacy-HTML: Im Editor **HTML**-Modus Brevo-Markup einfügen → **Edit** konvertiert deterministisch in Blöcke (`POST /api/templates/:id/convert`). Templates mit gespeichertem Legacy-HTML und leerem `editorData` werden beim Öffnen automatisch vorbereitet („Template wird vorbereitet…“). Legacy-Platzhalter `#TOKEN#` (z. B. `#KUNDE_NAME#`) werden beim Import und per Batch `POST /api/templates/migrate-legacy-hashes` zu `{{ params.* }}` (Permission `email_templates.edit`; kein Auto-Publish nach Brevo).

## Checks

```bash
npm run checks
```

## Project structure

```
apps/editor/     Vite + React + GrapesJS
apps/api/        Fastify + Prisma
packages/
  email-schema/
  email-components/
  email-variables/   # Brevo params.* registry + sample
  editor-core/
  theme-contract/
```

API (Auszug): `GET /api/variables`, `GET /api/preview/sample` (DevAuth).

Textbausteine: bei **Von Brevo laden** werden Absatz-Snippets aus Content-Sections geharvestet (Dedup per Hash). Einmalig/manuell: `POST /api/saved-sections/harvest` (Permission `email_templates.manage_saved_sections`).

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (Docker: `localhost:5433`, user/pass/db `email` / `email` / `email_templates`) |
| `AUTH_MODE` | `dev` (local) oder `erp` (Bearer JWT + `ERP_JWT_SECRET`); unset → 401 |
| `ERP_JWT_SECRET` | HS256 secret when `AUTH_MODE=erp` |
| `API_HOST` | default `127.0.0.1` (DevAuth blockt Non-Loopback) |
| `API_PORT` | default 3001 |
| `EDITOR_ORIGIN` | CORS + Origin-Allowlist for mutating requests |
| `CORS_ADDITIONAL_ORIGINS` | Optional comma-separated extra Origins |
| `BREVO_API_KEY` | Brevo REST key (nur Backend) — Sync: „Von Brevo laden“ |
| `BREVO_DEFAULT_SENDER_EMAIL` | Must be a **verified** Brevo sender (server allowlist) |
| `BREVO_DEFAULT_SENDER_NAME` | Optionaler Absendername |
| `ASSET_STORAGE` | `local` (default). Andere Werte fallen auf local zurück bis S3-Provider existiert |
| `ASSET_STORAGE_DIR` | Optional: lokaler Bild-Upload-Ordner (default `apps/api/.data/assets`) |
| `ALLOW_INSECURE_DEV` | `1` erlaubt DevAuth auf Non-Loopback (nicht empfohlen) |
| `VITE_EMBED_PARENT_ORIGINS` | Editor: comma-separated Parent-Origins für Theme `postMessage` |

Brevo-Key nie im Frontend.

**Sync-Konflikte:** Wenn „Von Brevo laden“ Remote-HTML ändert und lokal ungespeicherte/nach-Publish-Edits existieren, bleibt `editorData` erhalten (`CONFLICT`). Im ⋯-Menü: **Remote übernehmen** oder **Lokal behalten**.

Bild-Upload: Eigenschaften-Modal → **Vom Computer hochladen** (`POST /api/assets`). Originale bis 25 MB; Speicherung automatisch auf **max. 2 MB** komprimiert (JPEG/PNG/GIF/WebP). API muss laufen.

**Deploy:** Ziel-Hosting TBD (API + Postgres + Secrets). Embed-Contract ist spezifiziert; ERP-Host-Wiring liegt außerhalb dieses Repos.

## Recent changes

- Living Docs Catch-up: Features/Status/Changes bis HEAD; Viewer Status zeigt Publish/Sync/Compose
- Rich-Text: Mid-Click-Caret und Param-Pills; Preview-Modal, Assets, Textbausteine-Kategorien
- Brevo Sync/Publish, Legacy-Import, Compose-Seite, Embed-Contract; Pages Viewer (ERP Light Theme)

## Agent workflow

1. `@project-setup` ✅
2. `@pingpong-solution` ✅ Phase 1
3. `@implement` — Phase 1 Foundation
4. `@verify-ui` — Browser-Roundtrip prüfen
