# ROADMAP update snippet for Phase 20

Add or replace the Phase 20 section with the following.

## Phase 20: Boundary surfaces and approximate 3D visibility

Phase 20 adds ruled surfaces, Coons patches, and approximate automatic 3D visibility/depth handling.

The visibility algorithm is inspired by screen-depth and z-sorting ideas from TikZ/PGF 3D tooling, but the MVP computes visibility inside StratifiedTikZ rather than depending on external TikZ packages.

Recommended `phaseSlugs` entries:

```js
"20A": "ruled-coons-model-sampling",
"20B": "ruled-surface-create-render-export",
"20C": "coons-patch-create-render-export",
"20D": "projected-render-depth-model",
"20E": "surface-depth-sorting",
"20F": "curve-occlusion-hidden-style",
"20G": "point-label-visibility-ui",
"20H": "auto-visibility-export-hardening",
```

### Phase 20A: Ruled surface and Coons patch model/sampling utilities

- Add data models for ruled surfaces and Coons patches.
- Add boundary path sampling.
- Add mesh generation and validation.

### Phase 20B: Ruled surface creation, SVG preview, and TikZ export

- Create a ruled surface from two boundary paths.
- Copy boundary geometry.
- Render/export sampled mesh.

### Phase 20C: Coons patch creation, SVG preview, and TikZ export

- Create a Coons patch from four boundary paths.
- Validate corner compatibility.
- Render/export sampled mesh.

### Phase 20D: Projected render primitive and depth model

- Decompose diagrams into projected render primitives.
- Compute depth values from current camera.
- Preserve source/layer metadata.

### Phase 20E: Surface face depth sorting

- Optionally depth-sort surface faces.
- Preserve manual layer order through a layer/depth sort mode.
- Apply to SVG and TikZ output.

### Phase 20F: Curve occlusion and hidden segment styling

- Approximate curve/surface occlusion.
- Split sampled curves into visible/hidden segments.
- Render hidden segments as dotted/dimmed.

### Phase 20G: Point/label visibility options and auto-visibility UI

- Add UI options for auto visibility.
- Add hidden point behavior.
- Keep labels foreground by default.

### Phase 20H: Auto-visibility TikZ export hardening and docs

- Harden TikZ export and performance.
- Add docs/examples.
- Document approximation limitations.
