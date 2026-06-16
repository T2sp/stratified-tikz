# Phase 14C Implementation Prompt: Concatenated path editing

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

Allow existing concatenated paths to be inspected and edited.

Editing should support:

- inspector editing of segment endpoints and controls;
- drag-handle editing of endpoints and controls;
- relative/polar control editing for cubic segments where existing Bézier infrastructure supports it;
- layer/style/name editing;
- SVG/TikZ updates.

## Prerequisites

Phases 14A and 14B are complete.

## Scope

Implement editing for existing concatenated paths.

Do not implement:

- segment-level style overrides; that is Phase 14D;
- cross-work-plane paths; that is Phase 14E;
- filled regions/surfaces;
- live linked vertices;
- broad multi-selection.

## Inspector editing

Inspector should display the path segments in order.

Suggested UI:

```text
Segment 1: Line
  Start
  End

Segment 2: Cubic Bézier
  Start
  Control point 1
  Control point 2
  End
```

Requirements:

- user-facing segment/vertex indices are one-based;
- internal indices may remain zero-based;
- invalid numeric input rejected;
- 2D z hidden/locked;
- 3D x/y/z editable;
- adjacent endpoint consistency is preserved.

Endpoint consistency policy:

- preferred: shared adjacent endpoints update together;
- acceptable: if representation duplicates endpoints, editing one endpoint should update adjacent matching endpoint or validation should prevent mismatch.

Do not silently create broken paths.

## Drag editing

Show handles for selected concatenated path.

Requirements:

- endpoints draggable;
- cubic control points draggable;
- 2D drags keep z = 0;
- 3D drags use active work plane or the path's stored work plane when applicable;
- one drag gesture should be one undoable change if undo/redo exists;
- handles are UI state only and not exported.

## Segment operations

MVP segment operations:

- append line segment;
- append cubic segment;
- remove last segment.

Optional:

- insert segment;
- delete arbitrary segment;
- convert line <-> cubic.

Keep MVP small.

## Tests

Add tests:

1. Inspector helper lists segments in order.
2. Coordinate edit updates correct segment point.
3. Adjacent endpoint consistency preserved.
4. Invalid coordinate input rejected.
5. Drag endpoint updates path.
6. Drag cubic control updates path.
7. 2D drag keeps z = 0.
8. TikZ updates after edit.
9. SVG updates after edit if testable.
10. Undo/redo works if testable.

## Documentation

Update docs for path editing and endpoint consistency policy.

## Report after implementation

Please report:

- files modified;
- inspector behavior;
- endpoint consistency policy;
- drag handle behavior;
- segment operations implemented;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
