# ROADMAP update snippet for Phase 21

Add or replace the Phase 21 section with the following.

## Phase 21: Preview-centered UI overhaul

Phase 21 implements the full UI redesign based on the reference mockup.

Recommended `phaseSlugs` entries:

```js
"21A": "preview-centered-ui-shell",
"21B": "floating-toolbar-tool-model",
"21C": "direct-input-drawer",
"21D": "inspector-preview-drawer",
"21E": "ibis-style-layer-window",
"21F": "ui-overhaul-polish",
```

### Phase 21A: Preview-centered UI shell and layout foundation

- Make SVG Preview the central workspace.
- Move TikZ Source below the Preview.
- Keep top controls compact.

### Phase 21B: Floating SVG Preview toolbar and tool model cleanup

- Move toolbar into SVG Preview top.
- Add collapse/expand control.
- Overlay Undo/Redo.
- Put Remove selected at toolbar right as trash button.
- Default to cursor input.
- Consolidate Add polyline and Add cubic Bézier into Add path.
- Show Fill paths only in Select/Add path.

### Phase 21C: Direct input drawer inside SVG Preview

- Direct input becomes per-Add-mode option.
- Direct forms open in a right-side Preview drawer.
- Cursor input remains default.

### Phase 21D: Inspector drawer from SVG Preview button

- Inspector opens only from Preview upper-right button.
- Inspector appears as right-side drawer matching Preview height.
- Inspector scrolls internally.

### Phase 21E: Ibis Paint-style Layer window

- Integrate toolbar Layer and New element layer controls into Layer window.
- Add compact Preview lower-right Layer button showing new layer / total layers.
- Add layer thumbnails/previews.
- Select new element layer graphically.
- Swap layers by dragging rows.
- Show selected-layer action buttons for rename/duplicate/translate/delete.

### Phase 21F: UI overhaul polish, accessibility, and regression hardening

- Fix overlay stacking and pointer events.
- Harden responsive behavior.
- Add accessibility labels and docs.
- Run end-to-end regression checks.
