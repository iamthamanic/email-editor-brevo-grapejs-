# Debug Report — `paste-overflow`

**Date:** 2026-08-10  
**Project:** Email-Template-Editor (GrapeJS)  
**Shell:** web  
**Repro grade:** full  

---

## Summary

HTML paste kept `white-space: nowrap` (allowlisted in `sanitizeInlineStyle`), so pasted spans overflowed the email column and broke the Grapes selection box vs. visible text.  
**Confidence:** high

---

## Bug description

| | |
|--|--|
| **Expected** | Pasted text wraps inside the INHALT / email-text column; selection box matches content |
| **Actual** | Text runs as one long horizontal line past the blue selection into the canvas grey |
| **Steps** | 1. Open template editor 2. Click email-text 3. Paste HTML from chat/docs (often includes `white-space:nowrap`) |

---

## Reproduction

- **Command / URL:** `http://localhost:5173` + Playwright
- **Playwright spec:** `apps/editor/e2e/paste-overflow.spec.ts` (was `debug-repro-paste-overflow`)
- **Result:** reproduced — `scrollWidth: 1718` vs `clientWidth: 568`, computed `spanWhiteSpace: "nowrap"`
- **Hard path:** no

---

## Evidence

### Console

```
(no app errors; metrics from repro)
spanWhiteSpace: "nowrap"
scrollWidth: 1718, clientWidth: 568, scrollHeight: 40
```

### Network

| Method | URL | Status | Note |
|--------|-----|--------|------|
| — | — | — | N/A (client-only paste) |

### Screenshot / trace

- User screenshot: overflowing text past selection box in INHALT
- Playwright failure (pre-fix): `.qa/test-results/debug-repro-paste-overflow-…`

---

## Prior art

- [x] Repo grep: `packages/email-components/src/html.ts` — `white-space` in `STYLE_ALLOW`; paste scrubber in `packages/editor-core/src/richText/controller.ts`
- [x] `.qa` / paste history: prior paste work stripped colors/backgrounds only
- [ ] GitHub issue/PR: n/a
- [ ] LightRAG: n/a

---

## Root cause

Paste sanitizer (`sanitizePastedEmailHtml` → `sanitizeInlineStyle`) allowlists `white-space`. Chat/Word/HTML paste often includes `white-space: nowrap` (and fixed `width`/`min-width`). Inserted into `email-text`, that prevents wrapping; Grapes highlighter stays column-width while text paints outside.

**Hypotheses tested:** 1. Plain text paste — wraps (OK) 2. HTML with nowrap — overflows (reproduced)  
**Fix attempts this bug:** 1  

---

## Suggested fix (minimal) — applied

1. `packages/email-components/src/html.ts` — `stripPasteLayout` drops nowrap/pre, width/min-width, float, flex/grid/inline-block on paste
2. `packages/editor-core/src/index.ts` — canvas CSS safety: wrap + override nowrap inside email-text (except param pills)
3. Regression: `apps/editor/e2e/paste-overflow.spec.ts` + unit test in `html.test.ts`

**Next step:** done (user asked to fix in same turn)

---

## Notes

- Assumptions: “Text einfügen” = clipboard paste (plain typing already wrapped)
- Out of scope: full Word table unwrap; intentional nowrap outside email-text
