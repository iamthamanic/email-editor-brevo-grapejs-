# Email Template Service

Visueller E-Mail-Template-Editor (GrapesJS) mit Brevo-Sync für ERP — Source of Truth ist GrapesJS Project JSON; Brevo bleibt Versand-Runtime.

Siehe [docs/PRD.md](docs/PRD.md) und [AGENTS.md](AGENTS.md).

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

Zwei Terminals:

```bash
npm run dev:api      # http://localhost:3001
npm run dev:editor   # http://localhost:5173 (proxy /api → API)
```

`AUTH_MODE=dev` muss **explizit** gesetzt sein (Fail-closed: ohne Wert → 401).
API und Postgres binden standardmäßig auf `127.0.0.1`.

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

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (Docker: `localhost:5433`, user/pass/db `email` / `email` / `email_templates`) |
| `AUTH_MODE` | Muss explizit `dev` sein für DevAuth; unset → 401 |
| `API_HOST` | default `127.0.0.1` (DevAuth blockt Non-Loopback) |
| `API_PORT` | default 3001 |
| `EDITOR_ORIGIN` | CORS allowlist (default http://localhost:5173) |
| `ALLOW_INSECURE_DEV` | `1` erlaubt DevAuth auf Non-Loopback (nicht empfohlen) |

Brevo-Key nie im Frontend.

## Agent workflow

1. `@project-setup` ✅
2. `@pingpong-solution` ✅ Phase 1
3. `@implement` — Phase 1 Foundation
4. `@verify-ui` — Browser-Roundtrip prüfen
