# Phase 22C Implementation Prompt: 2D path intersection detection for string diagrams

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

Also run if available:

```bash
git diff --check
```
## Project context

You are working on the StratifiedTikZ project.

Phase 21 is complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- paths, path templates, arc/circle/ellipse, sheets, filled regions/sheets, ruled surfaces, Coons patches, curved surfaces;
- symbolic variables and coordinate expressions;
- grid/lattice generation;
- custom work planes;
- camera controls;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo;
- SVG preview and TikZ generation.

Phase 22 adds:

1. Arrow options for 2D and 3D paths.
2. Mid-segment arrow decorations, similar to TikZ `decorations.markings`.
3. Path direction reversal.
4. 2D-only braided monoidal category string-diagram crossing controls:
   - detect path intersections;
   - click an intersection to toggle:
     - no braiding;
     - braiding;
     - anti-braiding;
   - avoid relying on the TikZ `knot` package because it tends to conflict with decorations.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI overlay/draft state should not be stored in `Diagram`.
- Arrow/braiding data that affects TikZ output should be persisted.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- TikZ indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, and all existing geometry behavior.


## Goal

Implement 2D path intersection detection as the foundation for braided monoidal category string diagrams.

This subphase should detect transverse intersections between path-like curves in 2D and produce clickable crossing candidates.

No braiding state/export changes yet.

## Scope

Implement:

- 2D path sampling/flattening for intersection detection;
- pairwise path intersection detection;
- crossing candidate model;
- SVG preview markers for crossings;
- click handling plumbing for crossing candidates if practical;
- tests.

Do not implement:

- braiding/no-braiding state persistence; Phase 22D;
- TikZ gap/mask export; Phase 22E;
- 3D crossing detection;
- exact analytic Bézier intersection;
- knot package usage.

## 2D only

Intersection detection is only for 2D diagrams.

Requirements:

- disabled/hidden in 3D;
- no 3D path intersection/brading in this phase;
- 2D z remains 0.

## Supported path kinds

Detect intersections between path-like curves:

- polylines;
- concatenated paths;
- line segments;
- cubic Bézier segments via sampling;
- arcs via sampling;
- circle/ellipse templates via sampling.

Ignore or defer:

- grids;
- sheet boundaries unless represented as paths;
- labels/points;
- self-intersections unless easy.

MVP: intersections between distinct path objects.

## Intersection model

Suggested:

```ts
type PathIntersectionCandidate = {
  id: string;
  pathAId: string;
  pathBId: string;
  point: Vec3; // z=0
  parameterA: number;
  parameterB: number;
  tangentA: Vec2;
  tangentB: Vec2;
  crossingSign?: "positive" | "negative";
};
```

Requirements:

- deterministic IDs where possible;
- finite coordinates;
- stable enough across small updates;
- excludes intersections at shared endpoints unless explicitly allowed;
- excludes adjacent segments from the same path;
- collinear overlaps are marked ambiguous/skipped, not treated as a single crossing.

## SVG preview

Show small crossing markers in 2D preview.

Requirements:

- markers are preview/UI only;
- not exported to TikZ;
- do not interfere too much with selection;
- clickable if Phase 22D will use same component;
- visually distinct from points/handles.

## Tests

Add tests:

1. Two straight lines crossing produce one candidate.
2. Parallel lines produce none.
3. Shared endpoint ignored or handled according to policy.
4. Cubic/line crossing detected via sampling.
5. Arc/line crossing detected via sampling if arcs supported.
6. Circle/line crossing detected if templates supported.
7. Collinear overlap skipped/ambiguous.
8. 3D diagrams produce no braiding candidates.
9. Candidate IDs deterministic for simple case.
10. No NaN/Infinity.

## Documentation

Document intersection detection limitations.

## Report after implementation

Please report:

- files modified;
- flattening/sampling approach;
- supported path kinds;
- endpoint/overlap policy;
- SVG marker behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
