# GitHub Pages setup — memory-live-doc viewer

## Safe automation (preferred)

From the **repo root**:

```bash
# Export viewer (theme + architecture + data) after memory apply
bash ~/.claude/skills/memory-live-doc/scripts/export-viewer-snapshot.sh

# Detect: memory viewer vs other Pages site
bash ~/.claude/skills/memory-live-doc/scripts/github-pages-memory.sh status --write-config

# Enable ONLY if status is not_enabled (never overwrites other sites)
bash ~/.claude/skills/memory-live-doc/scripts/github-pages-memory.sh enable --write-config
```

Policy: skill `references/github-pages-policy.md`.  
Theme: skill `references/theme-resolution.md`.  
Viewer tabs: Status, Features, Changes, Decisions, **Architecture** (Mermaid).

### Status meanings (short)

| status | Meaning |
|--------|---------|
| `not_enabled` | Pages off → enable is allowed |
| `memory_viewer_active` | `/docs` Pages + viewer present → push updates only |
| `pages_compatible_docs` | Pages already `/docs` → add viewer files; do not change settings |
| `pages_other` | Pages serves something else → **refused** (exit 2) |

## Manual enable (same end state)

1. Push `docs/memory-live-doc/viewer/` (with `data/*.json` snapshot) to your default branch.
2. Repo → **Settings** → **Pages**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or your default) → folder **`/docs`**
3. Open: `https://<user>.github.io/<repo>/memory-live-doc/viewer/`

Do **not** change Pages to `/docs` if the repo already publishes `/` or an Actions site.

## Local smoke check

```bash
bash ~/.claude/skills/memory-live-doc/scripts/export-viewer-snapshot.sh
cd docs/memory-live-doc/viewer
python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

`file://` often blocks `fetch` of JSON — use a local static server.

## Data snapshot

`export-viewer-snapshot.sh` writes project, features, changes, current-state, decisions, **architecture**, **theme**. Keep the viewer self-contained.
