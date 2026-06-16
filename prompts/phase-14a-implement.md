# Phase 14A Implementation Prompt: Concatenated path data model and validation

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```


## Project context

You are working on the StratifiedTikZ project.

Phase 13 is complete or near complete.

The project goal includes efficiently drawing 3-dimensional stratified diagrams like the attached reference PDF: translucent colored 3D sheet-like regions, solid and dotted 1-strata, point markers, labels, coordinate axes, and readable TikZ output.

Phase 14 focuses on the 1-dimensional path infrastructure needed for those diagrams:

- concatenated paths made from line and cubic Bézier segments;
- same-plane and later cross-plane 3D paths;
- path editing and export;
- segment-level style overrides such as dotted/densely dotted portions.

Curved colored 2-dimensional surface primitives such as hemispheres and saddle patches are deferred to Phase 15.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work planes are editor/UI state unless a curve stores persistent work-plane-local metadata for faithful export.
- Selection, drafts, preview highlights, and UI-only state must not be stored in `Diagram`.
- Generated TikZ should remain readable and maintainable.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load, undo/redo, camera, work-plane, source-selection, and existing creation behavior.


## Goal

Introduce a first-class data model for concatenated paths made from line and cubic Bézier segments.

This phase should provide the persistent representation and validation needed by later creation/editing phases.

## Scope

Implement:

- concatenated path / segmented path data model;
- line and cubic Bézier segment representation;
- validation helpers;
- conversion helpers from existing polyline and cubic Bézier curves where useful;
- TikZ/SVG-neutral utilities.

Do not implement yet:

- cursor creation UI for concatenated paths;
- inspector editing UI;
- segment-level style overrides;
- cross-work-plane creation;
- 2D regions;
- 3D curved surfaces;
- live linked vertices;
- snapping;
- new dependencies.

## Data model requirements

Add a representation for a path-like 1-stratum whose boundary/path is a sequence of segments.

Suggested segment representation:

```ts
type PathSegment =
  | {
      kind: "line";
      start: Vec3;
      end: Vec3;
    }
  | {
      kind: "cubicBezier";
      start: Vec3;
      control1: Vec3;
      control2: Vec3;
      end: Vec3;
      controlMode?: CubicBezierControlMode;
    };
```

Alternative endpoint-sharing representation is acceptable if well documented.

Add a path stratum kind such as:

```ts
type ConcatenatedPathStratum = {
  id: string;
  name: string;
  geometricKind: "curve";
  codim: 1 | 2;
  kind: "concatenatedPath";
  segments: PathSegment[];
  style: CurveStyle;
  layer: number;
  pathLabel?: string;
};
```

The exact shape can differ, but it must support:

- line segments;
- cubic Bézier segments;
- 2D and 3D;
- existing style model;
- layer;
- optional path label / `spath/save` if already supported;
- future segment-level style overrides.

## Validation requirements

Add validation helpers for concatenated paths.

Required validation:

- at least one segment;
- all coordinates finite;
- line segment start/end finite;
- cubic segment start/control1/control2/end finite;
- adjacent segment endpoints match within tolerance;
- codim convention:
  - 2D concatenated paths are codim 1;
  - 3D concatenated paths are codim 2;
- in 2D, all z coordinates are `0` or normalized/rejected consistently;
- no `NaN` or infinite coordinates;
- ids and names are valid according to existing model rules.

For now, do not require the path to be closed.

Closed path validation will be used later for 2D regions and 3D curved-boundary sheets.

## Conversion helpers

Add pure helpers if useful:

- `pathSegmentsFromPolyline(points)`;
- `pathSegmentsFromCubicBezier(points)`;
- `pathEndpoints(segments)`;
- `areSegmentsComposable(segments, epsilon)`;
- `normalizePathForAmbientDimension(path, ambientDimension)`.

Do not mutate input diagrams.

## SVG and TikZ behavior

In this subphase, it is acceptable to add minimal rendering/export support for the new path kind if required for tests. However, avoid large UI work.

If rendering/export is added:

- SVG should render the concatenated path as a continuous path;
- TikZ should export it as a continuous path;
- selection/highlighting should not affect TikZ.

If rendering/export is not added yet, report clearly that later phases will add it.

## Save/load

If the model changes, update save/load validation.

Requirements:

- existing diagrams without concatenated paths still load;
- diagrams containing concatenated paths can round-trip through JSON if persistence is added;
- invalid path data is rejected on import.

## Tests

Add focused tests:

1. Valid 2D concatenated path with line + cubic segment validates.
2. Valid 3D concatenated path validates.
3. Empty segment list rejected.
4. Non-finite coordinates rejected.
5. Adjacent endpoint mismatch rejected.
6. 2D z nonzero rejected or normalized according to existing policy.
7. Polyline conversion produces line segments in order.
8. Cubic Bézier conversion preserves start/control/end order.
9. Save/load round-trip if persistence is implemented.
10. Existing polyline/cubic behavior not regressed.

## Documentation

Update docs:

- explain concatenated path data model;
- explain line/cubic segment types;
- explain endpoint-sharing / endpoint matching policy;
- explain that closed regions/surfaces come later.

## Report after implementation

Please report:

- files modified;
- chosen data model;
- validation policy;
- conversion helpers added;
- whether SVG/TikZ rendering was added or deferred;
- save/load handling;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
