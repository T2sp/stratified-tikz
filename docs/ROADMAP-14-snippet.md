# ROADMAP update snippet for Phase 14

Replace the current Phase 14 section with the following.

## Phase 14: Concatenated paths

Phase 14 provides the 1-dimensional path infrastructure needed for complex 2D/3D stratified diagrams.

The final target includes diagrams with solid and dotted 1-strata running along or between translucent colored surfaces, as in the reference 3D stratified PDF. Curved colored 2-dimensional surface primitives are deferred to Phase 15.

Recommended `phaseSlugs` entries:

```js
"14A": "concatenated-path-model",
"14B": "same-plane-concatenated-path-creation",
"14C": "concatenated-path-editing",
"14D": "segment-style-overrides",
"14E": "cross-workplane-concatenated-paths",
```

### Phase 14A: Concatenated path data model and validation

- Add first-class concatenated paths made from line and cubic Bézier segments.
- Support 2D and 3D.
- Validate finite coordinates and adjacent endpoint compatibility.
- Preserve codimension conventions:
  - 2D paths are codim 1;
  - 3D paths are codim 2.

### Phase 14B: Same-work-plane concatenated path creation

- Add a creation tool for paths made from sequential line and cubic Bézier segments.
- Support 2D and 3D on one active work plane.
- Add draft preview, finish, and cancel.
- Export committed paths to SVG/TikZ.
- Cursor workflow: first click starts the path, line mode clicks one endpoint,
  and cubic Bézier mode clicks control 1, control 2, then endpoint.
- In 3D, a path draft captures the active work plane at start and blocks
  work-plane changes until Finish or Cancel.

### Phase 14C: Concatenated path editing

- Inspector editing of segments.
- Drag editing of endpoints and cubic controls.
- Preserve adjacent endpoint consistency.
- Support relative/polar Bézier editing where applicable.

### Phase 14D: Segment-level style overrides

- Add per-segment style overrides.
- Required line styles:
  - solid;
  - dashed;
  - dotted;
  - densely dotted.
- Export mixed-style paths readably, splitting TikZ draw commands if needed.

### Phase 14E: Cross-work-plane and free 3D concatenated paths

- Allow paths whose segments are not restricted to a single work plane.
- Work planes become editing aids rather than global path constraints.
- Preserve same-work-plane mode for safety.
- Export as ordinary 3D path geometry.
