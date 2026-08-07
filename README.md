# Email Template Service

Visueller E-Mail-Template-Editor (GrapesJS) mit Brevo-Sync für ERP — Source of Truth ist GrapesJS Project JSON; Brevo bleibt Versand-Runtime.

Siehe [docs/PRD.md](docs/PRD.md) für Produktumfang und [AGENTS.md](AGENTS.md) für Agent-/Architekturregeln.

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (workspaces)
- PostgreSQL (für API, sobald `apps/api` bootstrapped ist)
- Brevo API Key (nur Backend / Secret Manager — nie Frontend)

## Setup

```bash
# From repository root
npm install
cp .env.example .env   # fill locally, never commit secrets
```

Apps werden in Phase 1 (Foundation) angelegt. Bis dahin sind Workspaces Platzhalter.

## Development

```bash
# Editor (geplant)
npm run dev --workspace=apps/editor

# API (geplant)
npm run dev --workspace=apps/api
```

Editor: [http://localhost:5173](http://localhost:5173)  
API: [http://localhost:3001](http://localhost:3001) (geplant)

## Checks (quality gate)

```bash
npm run checks
```

Siehe `scripts/run-checks.sh` und [AGENTS.md](AGENTS.md). Solange Apps leer sind, meldet das Script den Scaffold-Status.

## Tests

```bash
npm test              # unit tests, sobald konfiguriert
npm run test:e2e      # Playwright — bootstrap via @verify-ui skill
```

## Project structure

```
email-template-service/
├── apps/
│   ├── editor/       # Vite + React + GrapesJS
│   └── api/          # Fastify + Postgres
├── packages/         # schema, editor-core, components, brevo-adapter, …
├── docs/
│   ├── PRD.md
│   └── UI_STYLEGUIDE.md
├── .qa/              # design, acceptance, verify-ui config
├── scripts/
└── AGENTS.md
```

## Environment variables

Document variables in `.env.example`. Do not commit real secrets.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (API) |
| `BREVO_API_KEY` | Brevo API key — **backend only** |
| `ASSET_STORAGE_*` | Provider-specific (TBD) |
| `AUTH_*` | ERP token verification (TBD) |

## Agent workflow

1. `@project-setup` — bootstrap (once) ✅
2. `@pingpong-solution` — design before features
3. `@implement` — code + acceptance artifact
4. `@verify-ui` — browser verification

See [AGENTS.md](AGENTS.md).

## License

TBD
