# Phase 14E Implementation Prompt: Cross-work-plane and free 3D concatenated paths

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

Allow concatenated paths whose segments are not restricted to a single work plane.

This enables more flexible 3D 1-strata for complex stratified diagrams, while preserving the stable same-work-plane behavior from earlier phases.

## Prerequisites

Phases 14A-14D are complete.

## Scope

Implement cross-work-plane / free 3D concatenated paths.

Do not implement:

- filled surfaces;
- automatic surface fitting;
- live linked vertices;
- advanced snapping;
- full 3D intersection analysis.

## Data model

The same concatenated path model should support free 3D coordinates.

Requirements:

- each segment point is an absolute `Vec3`;
- work plane is a creation/editing aid, not a global path constraint;
- optional per-segment metadata may record creation work plane if useful, but export must not depend on transient active UI state.

## Creation/editing workflow

Allow users to create path segments while changing active work plane between segments.

Expected:

- finish segment on one work plane;
- switch work plane;
- continue path from previous endpoint;
- next segment points can lie on new work plane;
- path remains one concatenated path.

MVP UI:

- option/toggle:
  - `Constrain path to one work plane`
  - `Allow cross-work-plane path`
- default can remain same-work-plane for safety.

When cross-work-plane mode is enabled:

- no mixed-plane rejection;
- still validate finite coordinates;
- adjacent endpoints still match.

## TikZ/SVG export

Export as ordinary 3D path geometry.

Requirements:

- preserve segment order;
- preserve segment styles;
- preserve absolute coordinates;
- no misleading work-plane-local 2D relative syntax unless segment has valid persistent metadata;
- fallback to absolute controls when needed.

## Tests

Add tests:

1. Cross-work-plane path with segments on different planes validates.
2. Adjacent endpoints still match.
3. Finite coordinates required.
4. Same-work-plane mode still rejects mixed-plane drafts.
5. Cross-work-plane mode allows mixed-plane path.
6. SVG/TikZ export preserves segment order.
7. Segment styles preserved.
8. Work-plane switching during creation does not corrupt state.
9. Undo/redo works if testable.

## Documentation

Document distinction:

- same-work-plane paths;
- cross-work-plane/free 3D paths;
- work plane as editing aid rather than path constraint.

## Report after implementation

Please report:

- files modified;
- data model changes if any;
- UI mode/toggle;
- validation differences;
- SVG/TikZ behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
