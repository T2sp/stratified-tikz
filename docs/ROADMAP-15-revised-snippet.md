# ROADMAP update snippet for Phase 15

Replace or expand the Phase 15 section with the following.

## Phase 15: Filled closed boundaries and 3D curved surface strata

Phase 15 focuses on filling closed paths in 2D and 3D, then adding curved 3D sheet primitives.

The target includes diagrams with translucent colored regions/sheets, solid/dotted 1-strata, point markers, labels, coordinate axes, and readable TikZ output.

Recommended `phaseSlugs` entries:

```js
"15A": "closed-boundary-fill-model",
"15B": "create-fill-from-closed-paths",
"15C": "fill-svg-tikz-evenodd",
"15D": "filled-region-sheet-editing",
"15E": "curved-sheet-model-sampling",
"15F": "curved-sheet-render-export",
"15G": "hemisphere-saddle-creation",
"15H": "reference-diagram-presets-export",
```

### Phase 15A: Closed-boundary fill data model

- Add 2D codim-0 filled regions.
- Add 3D codim-1 work-plane-local filled sheets.
- Support multiple closed boundaries.
- Support fill rules:
  - nonzero;
  - evenOdd.

### Phase 15B: Create filled regions/sheets from selected closed paths

- Select one or more closed paths.
- Create a 2D filled region in 2D.
- Create a 3D planar/work-plane-local filled sheet in 3D.
- Copy boundary geometry at creation time.
- Support even-odd fill rule for multiple boundaries.

### Phase 15C: SVG and TikZ fill output with even-odd rule

- Render filled regions/sheets in SVG.
- Export to TikZ.
- Use SVG `fill-rule="evenodd"` and TikZ `even odd rule` where appropriate.
- For 3D work-plane-local sheets, prefer TikZ `canvas is plane` scope when available.

### Phase 15D: Filled region/sheet editing

- Inspector editing for fill rule, style, layer, and boundary summary.
- Optional boundary coordinate editing or boundary replacement workflow.
- Preserve save/load and undo/redo.

### Phase 15E: Curved sheet primitive model and sampling utilities

- Add 3D curved sheet primitives:
  - hemisphere / spherical-cap patches;
  - saddle patches.
- Add sampling/mesh helpers and validation.

### Phase 15F: SVG and TikZ export for curved sheet primitives

- Render curved sheets as sampled meshes.
- Export curved sheets to TikZ as sampled filled faces.
- Preserve style, opacity, layer, and readability.

### Phase 15G: Hemisphere and saddle creation/editing

- Add user-facing creation/editing for hemisphere and saddle patches.
- Use active work-plane/frame orientation where appropriate.
- Support style/layer/sampling controls.

### Phase 15H: Reference-diagram presets and export hardening

- Add reference-style examples/templates.
- Add lightweight style presets for translucent sheets and solid/dotted curves.
- Harden TikZ output readability and default sampling.
