# Phase 14B Implementation Prompt: Same-work-plane concatenated path creation

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

Implement creation of concatenated paths made from line and cubic Bézier segments.

Initial scope:

- 2D paths;
- 3D paths constrained to a single active work plane;
- cursor creation and direct creation if practical;
- draft preview;
- finish/cancel behavior;
- SVG/TikZ export for committed paths.

## Prerequisites

Phase 14A is complete.

## Scope

Implement:

- creation tool for concatenated paths;
- add line segment;
- add cubic Bézier segment;
- finish/cancel;
- draft preview;
- committed concatenated path stratum;
- SVG preview;
- TikZ export.

Do not implement:

- cross-work-plane paths; that is Phase 14E;
- segment-level style overrides; that is Phase 14D;
- filled regions/surfaces;
- live linked vertices;
- snapping;
- broad UI redesign.

## Creation workflow

Add a creation tool such as:

```text
Add path
```

or:

```text
Add concatenated path
```

The user should be able to add segments sequentially.

MVP workflow options:

### Option A: segment mode buttons

```text
Current segment type:
  - Line
  - Cubic Bézier
```

Line segment:

- click endpoint;
- next segment starts at previous endpoint.

Cubic Bézier segment:

- click control point 1;
- click control point 2;
- click endpoint.

### Option B: explicit direct forms

The user enters segment type and coordinates.

Cursor MVP is preferred if feasible.

## Same-work-plane constraint

For 3D paths in this phase:

- all segment points must lie on the active work plane captured at draft start;
- if active work plane changes mid-draft, prevent mixed-plane drafts:
  - lock the draft work plane;
  - or reject/clear draft with clear status.
- committed path should not silently mix work planes.

For 2D:

- z remains `0`.

## Existing coordinate sources

Integrate with Phase 12H where practical:

- cursor clicking existing point strata may use copied coordinates;
- direct creation may use existing coordinate sources;
- source use remains copy-on-create.

If integration is too large, preserve existing behavior and report limitation.

## Draft preview

Show preview:

- line segments;
- cubic segments;
- segment endpoints;
- cubic control guides;
- current active segment-in-progress.

Draft preview is UI state only.

Do not export drafts to TikZ.

## Finish/cancel

Finish:

- requires at least one complete segment;
- commits one concatenated path stratum;
- selects created path;
- creates one undoable history entry if undo/redo exists;
- clears draft.

Cancel:

- clears draft;
- does not modify diagram;
- does not export.

## TikZ export

Export committed path as a readable continuous path:

```tex
\draw[<style>] (p0)
  -- (p1)
  .. controls (c1) and (c2) .. (p2)
  -- (p3);
```

Use Phase 9A coordinate naming and Phase 9B layer output.

For work-plane-local relative Bézier metadata, preserve existing Phase 12 behavior if present.

## Tests

Add tests:

1. Create 2D path with line + cubic segments.
2. Create 3D same-work-plane path.
3. Mixed-work-plane draft is prevented.
4. Finish commits one path.
5. Cancel does not commit.
6. Draft is not exported to TikZ.
7. TikZ export preserves segment order.
8. SVG path rendering works.
9. Undo/redo treats finish as one change if testable.
10. Existing creation tools are not regressed.

## Documentation

Document creation workflow and same-work-plane constraint.

## Report after implementation

Please report:

- files modified;
- creation workflow;
- draft state shape;
- same-work-plane policy;
- SVG/TikZ export behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
