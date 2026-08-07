# Email Template Service — project-specific edge cases for verify-ui

Extends the universal matrix in the verify-ui skill.
Add rows as features ship.

## Global

| ID | Case | Fail if |
|----|------|---------|
| G-01 | App loads | Blank screen, uncaught console errors |
| G-02 | Locale | UI language does not match AGENTS.md (de) |

## Security (Secure-by-Default Seeds)

Seed-Edge-Cases aus der Secure-by-Default-Checkliste (siehe AGENTS.md §Security). Pro Feature ergänzen, sobald zutreffend.

| ID | Case | Fail if |
|----|------|---------|
| S-01 | Secret im Client | `localStorage`/Client-Bundle enthält Token/Secret/Password |
| S-02 | XSS über User-Input | Unvalidierter User-Input wird gerendert (dangerouslySetInnerHTML o.ä.) |
| S-03 | IDOR / fehlende Authz | Sensitive Ressource ohne Owner-/Rollen-Check erreichbar |
| S-04 | SQL-Injection | Raw-SQL mit User-Input via String-Konkatenation |
| S-05 | Insecure Cookie | Session-Cookie ohne HttpOnly+Secure+SameSite in Prod |
| S-06 | Upload ohne Validierung | File-Upload akzeptiert beliebigen Typ/Größe |
| S-07 | Auth-Endpoint ohne Rate-Limit | Login/Register ohne Rate-Limiting |
| S-08 | Secrets in Logs | `console.log`/Error enthält Password/Token/API-Key |

## Templates / Editor

| ID | Case | Fail if |
|----|------|---------|
| T-01 | Reload after autosave | Editor state differs from last saved Project JSON |
| T-02 | Publish without permission | Publish succeeds without `email_templates.publish` |
| T-03 | Conflict overwrite | Remote Brevo change silently overwrites local draft |

## Brevo / Sync

| ID | Case | Fail if |
|----|------|---------|
| B-01 | Brevo key exposure | API key reachable from browser or client env |
| B-02 | Concurrent sync | Two syncs mutate same templates without lock |
| B-03 | Publish failure | Local draft rolled back or deleted when Brevo fails |

## Legacy Import

| ID | Case | Fail if |
|----|------|---------|
| I-01 | Unknown HTML dropped | Unrecognized markup deleted instead of `legacy-html` |
| I-02 | Script execution | Import pipeline executes scripts or remote content |
