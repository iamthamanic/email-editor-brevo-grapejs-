# Embed Contract — Email Template Service ↔ ERP Host

Spec for embedding this service (iframe-first) into HVAI / other hosts.
**This document lives in our repo** — the ERP adapts to it.

## Modes

| Mode | How |
|------|-----|
| Standalone | Open editor URL directly (`AUTH_MODE=dev` locally) |
| Embed | `?embed=1` → `document.documentElement[data-embed=1]` (chrome can hide host chrome) |

## Auth (`AUTH_MODE=erp`)

API expects:

```http
Authorization: Bearer <HS256 JWT>
```

Env: `ERP_JWT_SECRET` (shared with ERP signer).

### Claims (any of)

| Claim | Meaning |
|-------|---------|
| `sub` \| `userId` \| `id` | User id (required) |
| `exp` | Expiration (Unix seconds, **required** — tokens without `exp` are rejected) |
| `name` \| `displayName` | Display name |
| `permissions` \| `authorized_works` \| `Authorized_Works` | string[] of permission codes |

Unknown permission strings are ignored (deny by default).

### Permission codes

| Permission | Typical use |
|------------|-------------|
| `email_templates.read` | List/get templates, variables |
| `email_templates.create` | Create template |
| `email_templates.edit` | Patch, sync, convert, resolve-sync, assets POST |
| `email_templates.publish` | Publish to Brevo, test send |
| `email_templates.delete` | Delete |
| `email_templates.manage_saved_sections` | Textbausteine CRUD/harvest |
| `email_templates.manage_components` | Reserved |
| `email_templates.raw_html` | Reserved |

`GET /api/assets/:uuid.(jpg|png|gif|webp)` is a **public capability URL** (unguessable UUID + magic-byte upload gate). Canvas `<img>` cannot send Bearer tokens. Upload (`POST /api/assets`) still requires `email_templates.edit`.

Non-GET mutating routes must **not** be authorized with `.read` only.

## Theme (`postMessage`)

Parent → iframe:

```json
{
  "type": "ets:theme",
  "tokens": {
    "--erp-color-primary": "#275073"
  }
}
```

- Only `--erp-*` keys applied
- Values length-capped; `;` / `{}` / `url(` rejected
- Parent origin must be allowlisted (`VITE_EMBED_PARENT_ORIGINS` + localhost defaults)

## CORS / Origin

- `EDITOR_ORIGIN` — primary editor origin
- `CORS_ADDITIONAL_ORIGINS` — comma-separated extras
- Mutating requests: Origin allowlist (CSRF mitigation)

## Brevo

- Key **only** on API (`BREVO_API_KEY`) — never in iframe bundle
- Autosave = local; **Publish** = create/update Brevo SMTP template
- Sync pull = `POST /api/templates/sync-brevo` (manual); dirty locals → `CONFLICT` + resolve

## Assets

- Upload: `POST /api/assets` (needs `edit`)
- Serve: `GET /api/assets/:filename` (needs `read`)
- Storage: `ASSET_STORAGE=local` (default). Interface ready for S3/R2 (`AssetStorageProvider`)

## Out of scope here

ERP route registration, `Authorized_Works` UI, replacing HtmlEditor in HVAI-123 — host work.
