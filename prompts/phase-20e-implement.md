# Phase 20E Implementation Prompt: Surface face depth sorting

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

Implement optional approximate surface face depth sorting for SVG preview and TikZ export.

This is a painter's algorithm approach:

- split surfaces into faces/quads/triangles;
- compute depth;
- sort by layer and depth;
- draw farther faces before closer faces.

## Prerequisites

Phase 20D is complete.

## Scope

Implement:

- visibility options model;
- surface face sorting;
- SVG preview sorted rendering;
- TikZ sorted face output;
- tests.

Do not implement yet:

- curve occlusion;
- point/label occlusion;
- BSP splitting;
- exact hidden-surface algorithm;
- dependency on tikz-3dtools/LuaLaTeX.

## Visibility options

Add export/preview option:

```ts
type VisibilityOptions = {
  enabled: boolean;
  surfaceDepthSort: boolean;
  sortMode: "layerThenDepth" | "depthThenLayer";
  depthEpsilon: number;
};
```

Exact shape can differ.

Default:

- keep current behavior unless user enables auto visibility/sorting.
- If you choose to enable surface sorting by default, document and test it carefully.

Preferred MVP:

- option available;
- default off or conservative.

## Sorting behavior

Sort surface faces by:

1. layer;
2. depth;
3. original index.

For `layerThenDepth`:

- primary sort by layer order;
- depth sort inside each layer.

For depth convention, use Phase 20D convention.

Transparent surfaces should look better when sorted.

## TikZ export

When surface depth sort is enabled:

- emit surface face commands in sorted order;
- keep layer-aware output coherent;
- include comments explaining auto depth sort if helpful;
- no NaN/Infinity;
- inline mode no blank lines and 4-space indentation.

Do not change geometry coordinates.

## Limitations

Document painter's algorithm limitations:

- intersecting surfaces may still sort incorrectly;
- large faces may need finer sampling;
- manual layer manager remains important.

## Tests

Add tests:

1. Surface faces sorted by depth inside layer.
2. LayerThenDepth respects layer order.
3. DepthThenLayer if implemented.
4. Stable tie-breaker by original index.
5. SVG render order changes only when option enabled.
6. TikZ face output sorted when option enabled.
7. Inline output no blank lines.
8. Existing output unchanged when disabled.

## Documentation

Document approximate surface sorting.

## Report after implementation

Please report:

- files modified;
- visibility options;
- sorting algorithm;
- default behavior;
- SVG/TikZ behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
