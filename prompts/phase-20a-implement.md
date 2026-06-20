# Phase 20A Implementation Prompt: Ruled surface and Coons patch model/sampling utilities

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

Phase 19 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- custom work planes;
- camera controls and tikz-3dplot-compatible export;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- symbolic variables and coordinate expressions;
- grids;
- paths, filled regions/sheets, curved surfaces, and path templates.

Phase 20 adds two related capabilities:

1. More flexible 3D surface construction:
   - ruled surfaces from two boundary paths;
   - Coons patches from four boundary paths.

2. Approximate automatic 3D visibility:
   - projected render primitives;
   - surface face depth sorting;
   - curve hidden/visible segmentation behind surfaces;
   - optional point/label visibility behavior;
   - TikZ export matching the SVG preview as much as practical.

This phase is inspired by ideas such as screen depth / z-sorting / occlusion found in TikZ/PGF 3D tooling. However, do not make StratifiedTikZ depend on `tikz-3dtools` or LuaLaTeX packages in the MVP. The editor should compute visibility in TypeScript so SVG preview and generated TikZ stay aligned.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- In 3D:
  - sheets are codim 1;
  - curves are codim 2;
  - points are codim 3.
- Internally all coordinates are `Vec3`.
- Work planes are model-space editing aids.
- Camera/projection and work planes are separate concerns.
- Automatic visibility should be approximate and optional.
- Manual layer order must remain available.
- Generated TikZ must remain readable.
- Inline math export must still have no blank lines.
- Indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, and all existing geometry behavior.


## Goal

Introduce model and pure sampling utilities for two new 3D sheet kinds:

1. Ruled surface from two boundary paths.
2. Coons patch from four boundary paths.

This subphase is foundational. It should not add large UI workflows yet.

## Scope

Implement:

- data model for ruled surfaces and Coons patches;
- validation helpers;
- boundary path sampling/evaluation helpers;
- mesh generation helpers;
- save/load validation;
- tests.

Do not implement yet:

- user-facing creation UI;
- SVG rendering/TikZ export beyond minimal helper tests;
- depth sorting;
- occlusion;
- hidden curve splitting;
- new dependencies.

## Data model

Add curved surface sheet kinds or primitives.

Suggested:

```ts
type BoundaryPathSnapshot = {
  id?: string;
  name?: string;
  segments: PathSegment[];
};

type RuledSurfacePrimitive = {
  kind: "ruledSurface";
  boundary0: BoundaryPathSnapshot;
  boundary1: BoundaryPathSnapshot;
  sampling: { segments: number };
};

type CoonsPatchPrimitive = {
  kind: "coonsPatch";
  bottom: BoundaryPathSnapshot;
  right: BoundaryPathSnapshot;
  top: BoundaryPathSnapshot;
  left: BoundaryPathSnapshot;
  sampling: { uSegments: number; vSegments: number };
};

type BoundarySurfaceStratum = {
  id: string;
  name: string;
  geometricKind: "sheet";
  codim: 1;
  kind: "boundarySurface";
  primitive: RuledSurfacePrimitive | CoonsPatchPrimitive;
  style: SheetStyle;
  layer: number;
};
```

Exact shape can differ, but it must support:

- 3D codim-1 sheet semantics;
- copied boundary geometry, not live references;
- finite sampling resolution;
- style/layer/name;
- save/load round-trip.

## Boundary path requirements

Boundary paths may be:

- concatenated paths;
- line/cubic/arc segments;
- circle/ellipse templates only if boundary evaluation helper already supports them.

MVP may restrict accepted boundaries to concatenated paths and documented supported template paths.

Validation:

- all boundary points finite;
- boundary sampling produces finite points;
- boundary paths are non-empty;
- boundary parameterization is deterministic;
- boundary start/end compatibility checked where needed.

## Ruled surface semantics

Ruled surface from two boundary curves:

```text
S(u, v) = (1 - v) * C0(u) + v * C1(u)
```

where:

- `u ∈ [0,1]` parametrizes both boundaries;
- `v ∈ [0,1]` interpolates between them.

Requirements:

- both boundaries sampled with same `u` values;
- sampling count finite, positive, and capped;
- generated mesh finite;
- boundaries may be open or closed, but both must have compatible parameterization.
- If one boundary is closed and the other open, allow only if documented or reject. Preferred: require both have same closure status.

## Coons patch semantics

Coons patch from four boundary curves:

- bottom: `C0(u)`, u from left to right;
- top: `C1(u)`, u from left to right;
- left: `D0(v)`, v from bottom to top;
- right: `D1(v)`, v from bottom to top.

Use standard Coons interpolation:

```text
S(u,v)
= (1-v) * bottom(u) + v * top(u)
+ (1-u) * left(v) + u * right(v)
- bilinearCornerBlend(u,v)
```

Corner consistency requirements:

- bottom start matches left start;
- bottom end matches right start;
- top start matches left end;
- top end matches right end.

Reject inconsistent corners unless a future repair workflow is implemented.

## Mesh representation

Add or reuse a surface mesh representation:

```ts
type SurfaceMesh = {
  vertices: Vec3[][];
  quads: SurfaceQuad[];
  boundary?: Vec3[][];
};
```

Requirements:

- deterministic vertex order;
- finite vertices;
- no NaN/Infinity;
- safe sampling cap, e.g. max 100 segments each direction;
- helper returns enough data for later SVG/TikZ rendering and depth sorting.

## Tests

Add tests:

1. Valid ruled surface model validates.
2. Ruled surface rejects empty boundaries.
3. Ruled surface rejects non-finite sampled points.
4. Ruled surface sampling returns finite mesh.
5. Ruled surface boundary closure mismatch rejected or documented.
6. Valid Coons patch validates.
7. Coons patch rejects inconsistent corners.
8. Coons patch sampling returns finite mesh.
9. Sampling caps excessive resolution.
10. Save/load round-trip if model persistence updated.
11. Existing curved sheets/fills/path validation not regressed.

## Documentation

Update docs:

- ruled surface definition;
- Coons patch definition;
- copied-boundary policy;
- sampling limits;
- limitations.

## Report after implementation

Please report:

- files modified;
- model shape;
- boundary path support;
- ruled surface formula;
- Coons patch formula;
- validation policy;
- mesh representation;
- tests added/updated;
- test results;
- build results;
- limitations.
