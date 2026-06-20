# Phase 20D Implementation Prompt: Projected render primitive and depth model

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

Introduce projected render primitives and depth metadata as a foundation for approximate automatic 3D visibility.

This subphase should not change visible drawing order yet, except for optional debug helpers/tests.

## Scope

Implement:

- render primitive extraction;
- projection/depth computation;
- surface face primitives;
- curve segment primitives;
- point primitives;
- stable sort metadata;
- tests.

Do not implement yet:

- surface depth sorting changes;
- curve occlusion;
- point/label occlusion;
- visibility UI;
- TikZ reordering.

## Render primitive model

Suggested:

```ts
type ProjectedRenderPrimitive =
  | ProjectedSurfaceFace
  | ProjectedCurveSegment
  | ProjectedPoint
  | ProjectedLabel;

type DepthStats = {
  min: number;
  max: number;
  avg: number;
};

type ProjectedSurfaceFace = {
  kind: "surfaceFace";
  sourceId: string;
  layer: number;
  projectedPolygon: Vec2[];
  vertices3D: Vec3[];
  depth: DepthStats;
  originalIndex: number;
};
```

Exact shape can differ.

Depth should be computed from the current camera/view direction.

Requirements:

- finite projection;
- finite depth;
- stable original index for tie-breaking;
- source id preserved;
- layer value preserved;
- no mutation of diagram.

## Primitive extraction coverage

At minimum:

- polygon sheets;
- filled sheets/regions in 3D where applicable;
- curved sheet meshes;
- ruled surfaces;
- Coons patches;
- curves/paths sampled into segments;
- points.

Labels may be included as always-front primitives later.

## Camera/depth convention

Choose one convention and document it:

- larger depth means closer to camera; or
- smaller depth means closer.

Tests must enforce this.

Depth sorting later must use the same convention.

## Tests

Add tests:

1. Surface face primitive extraction returns finite depth.
2. Curve segment primitive extraction returns finite depth.
3. Point primitive extraction returns finite depth.
4. Depth convention tested with two points along view direction.
5. Layer and source id preserved.
6. Original index stable.
7. No NaN/Infinity produced.
8. Existing SVG/TikZ output unchanged.

## Documentation

Document primitive/depth model and approximation goal.

## Report after implementation

Please report:

- files modified;
- primitive model;
- depth convention;
- coverage by geometry kind;
- tests added/updated;
- test results;
- build results;
- limitations.
