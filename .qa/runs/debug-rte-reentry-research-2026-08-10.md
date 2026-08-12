# Debug / research — reliable GrapesJS text re-edit

**Date:** 2026-08-10  
**Topic:** Leave text → cannot edit again (core editor feature)

## Research sources

1. [GrapesJS — Replace Rich Text Editor](https://grapesjs.com/docs/guides/Replace-Rich-Text-Editor.html)  
   Official contract: `setCustomRte({ enable, disable, focus, getContent, parseContent })`.  
   Every enable/focus must set `el.contentEditable = true`; disable sets `false`.

2. [grapesjs-plugin-ckeditor](https://github.com/GrapesJS/ckeditor)  
   Same pattern: re-entry calls `focus()` which sets `contentEditable = 'true'` again when Grapes reuses the RTE instance.

3. [GrapesJS issue #2828](https://github.com/GrapesJS/grapesjs/issues/2828) (CKEditor re-edit)  
   Community fix: move `el.contentEditable = true` to the **top** of `focus()` — CE stuck `false` blocks typing even when “editing” looks active.

4. GrapesJS `ComponentView.updateAttributes` / `__clearAttributes` (v0.22.x source)  
   On **any** `setAttributes` / `removeAttributes`, Grapes removes **all** DOM attributes and re-applies the model bag. `contenteditable` is not in the model → property becomes `inherit` / not editable. This is the silent killer after mid-edit attribute tweaks.

## Root cause (proven with MutationObserver)

1. `setCustomRte.enable` correctly set `contentEditable="true"`.
2. Our `clearEmailTextPlaceholder` (on `rte:enable`) called `comp.removeAttributes("data-placeholder")`.
3. That triggered `__clearAttributes()` → wiped `contenteditable` while `getEditing()` stayed true → **selectable, not typeable**.
4. Toolbar bold failed separately: `resolveActiveRte()` preferred stale Grapes `globalRte.el` (not CE) over `view.activeRte`.

## Fix

1. `installNativeCustomRte` — official adapter + patch `view.updateAttributes` to re-stamp CE while `rteEnabled`.
2. Placeholder clear uses `forceEditing` (event fires before `rteEnabled`) and always re-stamps CE after attribute wipe; no `components().reset()` mid-RTE.
3. `forceEnableTextRte` always stamps CE after `onActive`.
4. `RichTextController.resolveActiveRte` prefers `view.activeRte` / live host, not stale `globalRte`.

## Regression

- `e2e/text-selection.spec.ts` — leave → re-enter → type (×2) ✅  
- `e2e/rich-text-toolbar.spec.ts` — bold / heading / align ✅  
- `e2e/paste-overflow.spec.ts` ✅  
