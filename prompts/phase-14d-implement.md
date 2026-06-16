# Phase 14D Implementation Prompt: Segment-level style overrides for concatenated paths

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

Add segment-level style overrides for concatenated paths.

This is important for diagrams like the reference PDF, where some 1-strata are solid and others are dotted/densely dotted, and where a single conceptual path may need visually distinct portions.

## Prerequisites

Phases 14A-14C are complete.

## Scope

Implement segment-level style overrides for concatenated paths.

Do not implement:

- filled regions/surfaces;
- cross-work-plane paths unless already implemented;
- live linked vertices;
- general multi-selection.

## Data model

Add optional per-segment style override.

Suggested shape:

```ts
type PathSegmentStyleOverride = Partial<CurveStyle>;

type PathSegment = {
  ...
  styleOverride?: PathSegmentStyleOverride;
};
```

Rules:

- path-level style remains default;
- segment-level override applies only to that segment;
- absent override means inherit path style;
- validation rejects invalid style values.

Required style fields:

- line style:
  - solid;
  - dashed;
  - dotted;
  - denselyDotted;
- stroke color;
- stroke opacity;
- line width.

Implement fewer fields only if justified, but line style is required.

## UI

Inspector should allow editing segment-level style.

MVP:

- select path;
- expand segment;
- edit segment style override;
- clear override / inherit from path.

For mixed/empty values, keep UI simple.

## SVG rendering

Render segment-level styles correctly.

If a path has different segment styles, rendering may need to split into multiple SVG path elements.

Requirements:

- segment order preserved;
- visual continuity preserved;
- selected path highlight still works;
- path-level style used for inherited segments.

## TikZ export

TikZ export must preserve segment style overrides readably.

If all segments share same style:

- export as one continuous path.

If segment styles differ:

- export as separate draw commands or scoped segments;
- preserve coordinate continuity;
- add readable comments if helpful;
- preserve Phase 9B layer output.

Required:

- dotted/densely dotted segments export correctly;
- no dangling coordinates;
- output remains readable.

## Tests

Add tests:

1. Segment without override inherits path style.
2. Segment override changes SVG style.
3. Segment override changes TikZ style.
4. Dotted/densely dotted segment exports correctly.
5. Mixed-style path exports as multiple commands or equivalent readable output.
6. Segment order preserved.
7. Clearing override restores inheritance.
8. Invalid style override rejected.

## Documentation

Document segment-level style overrides and TikZ splitting behavior.

## Report after implementation

Please report:

- files modified;
- data model changes;
- UI behavior;
- SVG rendering behavior;
- TikZ export strategy;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
