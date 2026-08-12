# Project status

**Phase:** post-phase-4 (product features live locally)  
**As of:** `20b2cb8` (2026-08-12) — Editor + API with Brevo sync/publish, legacy import, text snippets, compose, assets, variables.

## Summary

Standalone email template service (GrapesJS + Fastify). Source of truth is GrapesJS project JSON; Brevo receives published HTML. Living docs viewer: [memory-live-doc](https://iamthamanic.github.io/email-editor-brevo-grapejs-/memory-live-doc/viewer/).

## Recently completed

- Brevo sync (pull) + publish with versioning
- Legacy HTML import + saved sections / text snippets (param pills, categories)
- Compose page, preview modal, asset upload
- ERP JWT / sender allowlist / embed contract (docs)
- GitHub Pages viewer (light ERP theme)

## Open / next

1. Production deploy pipeline
2. Full ERP embedding (iframe / microfrontend) in the target system
3. Catch up memory claims (`needs-review`) and missing screenshots
4. Asset storage S3/R2 provider

See also: [FEATURES.md](FEATURES.md) · [CHANGELOG.md](CHANGELOG.md) · [DECISIONS.md](DECISIONS.md)
