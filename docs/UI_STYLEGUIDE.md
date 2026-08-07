# UI Styleguide — Email Template Service

<!-- Style tree: tokens → components → patterns. Scaffolded by /project-setup -->

Reference for humans and agents. `@verify-ui` uses this for visual/UX sanity checks.

**UI copy language: Deutsch (de)**

## Principles

- Editor-UI abstrahiert E-Mail-Technik (keine table/MSO für Normalnutzer)
- Styling ausschließlich über **Theme Contract** (`--erp-*`); ERP injiziert Tokens später (iframe postMessage / React props)
- Progressive Disclosure: Advanced (HTML-Block, technische Settings) nur mit Recht
- Every interactive UI: default, hover, focus, disabled, loading, error
- Preview immer isoliert (sandboxed iframe)

## Design tokens (Theme Contract)

Fallback-Werte lokal setzen; Host überschreibt. Keine ERP-CSS-Klassen im Editor.

| Token | Beispiel-Fallback | Usage |
|-------|-------------------|-------|
| `--erp-font-family` | system-ui stack | UI chrome (nicht E-Mail-Inhalt) |
| `--erp-font-size-base` | 14px | Body UI |
| `--erp-color-primary` | #1a5f4a | Primary actions (Publish, CTA) |
| `--erp-color-background` | #f4f6f5 | App background |
| `--erp-color-surface` | #ffffff | Panels, canvas chrome |
| `--erp-color-border` | #d0d7d4 | Dividers, inputs |
| `--erp-color-text` | #14201c | Primary text |
| `--erp-color-text-muted` | #5c6b66 | Secondary / Saved |
| `--erp-radius-small` | 4px | Inputs, chips |
| `--erp-radius-medium` | 8px | Panels |
| `--erp-spacing-xs` … `lg` | 4–24px | Gaps, padding |

`ThemeAdapter` liefert: colors, typography, spacing, radius, darkMode. postMessage darf nur definierte Theme-Tokens — kein beliebiges CSS.

## Typography

| Role | Font | Size | Weight |
|------|------|------|--------|
| App chrome | `--erp-font-family` | base | 400/600 |
| Panel labels | same | 12–13px | 500 |
| Canvas content | email-safe fonts via components | per block | per block |

## Layout (Desktop Editor)

```text
Top: Back | Template name | Saved | Publish
Left: Blocks (Content / Layout / Company / ERP / Advanced)
Center: Email canvas
Right: Properties (selection-scoped only)
Bottom: Desktop | Mobile | Preview Data | HTML | Versions
```

Breakpoints for chrome: mobile 390px, desktop 1280px (see `.qa/project.yaml`).

## Components (planned)

| Component | Location (planned) | Notes |
|-----------|-------------------|-------|
| Block palette | `apps/editor/src/blocks` | Drag-and-drop |
| Properties panel | `apps/editor/src/…` | Nur relevante Felder (z. B. Button: Text, URL, Alignment…) |
| Autosave indicator | chrome | Saved / Saving… / Save failed |
| Conflict dialog | templates | ERP vs Brevo Version wählen |
| Variable picker | variables | Label → Brevo expression |

## States (required)

| State | Pattern |
|-------|---------|
| Loading | skeleton or spinner + aria-busy |
| Empty | kurze DE-Copy + CTA (z. B. „Erstes Template“) |
| Error | message + retry when applicable |
| Disabled | reduced opacity + no pointer events |
| Saving | Autosave indicator |

## Accessibility

- Focus visible on all interactive elements
- Form fields: associated labels
- Color contrast WCAG AA minimum
- Keyboard: Undo/Redo (Ctrl+Z / Ctrl+Shift+Z), Delete, Duplicate

## Do / Don't

**Do**

- Theme tokens only
- Selection-scoped properties
- Sandboxed HTML preview

**Don't**

- Full CSS editor for normal users
- Brevo key / secrets in client
- Execute untrusted HTML in host DOM

## Design pipeline (later — not run by project-setup)

- Create: `@frontend-design`; mobile mockups: `@imagegen-frontend-mobile`
- Audit: `@web-design-guidelines`; browser proof: `@verify-ui`
