# Projektstatus

**Phase:** post-phase-4 (Produkt-Features live lokal)  
**Stand:** `20b2cb8` (2026-08-12) — Editor + API mit Brevo Sync/Publish, Legacy-Import, Textbausteine, Compose, Assets, Variables.

## Kurz

Standalone Email Template Service (GrapesJS + Fastify). Source of Truth ist GrapesJS Project JSON; Brevo erhält publiziertes HTML. Living Docs Viewer: [memory-live-doc](https://iamthamanic.github.io/email-editor-brevo-grapejs-/memory-live-doc/viewer/).

## Erledigt (kürzlich)

- Brevo Sync (Pull) + Publish inkl. Versionierung
- Legacy-HTML-Import + Saved Sections / Textbausteine (Param-Pills, Kategorien)
- Compose-Seite, Preview-Modal, Asset-Upload
- ERP JWT / Sender-Allowlist / Embed-Contract (Doku)
- GitHub Pages Viewer (Light ERP Theme)

## Offen / nächste Schritte

1. Production-Deploy-Pipeline
2. Vollständige ERP-Einbettung (iframe / Microfrontend) im Zielsystem
3. Memory-Claims (`needs-review`) und fehlende Screenshots nachziehen
4. Asset-Storage S3/R2 Provider

Siehe auch: [FEATURES.md](FEATURES.md) · [CHANGELOG.md](CHANGELOG.md) · [DECISIONS.md](DECISIONS.md)
