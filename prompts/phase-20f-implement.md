# Phase 20F Implementation Prompt: Curve occlusion and hidden segment styling

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

Implement approximate curve occlusion against surfaces.

Curves behind visible surface faces should be split or sampled into hidden segments and rendered with a hidden style, e.g. dotted/lower opacity.

This is approximate and sampling-based.

## Prerequisites

Phases 20D and 20E are complete.

## Scope

Implement:

- curve sampling for occlusion;
- screen-space point-in-face checks;
- face-depth interpolation;
- visible/hidden segment classification;
- SVG rendering of hidden segments;
- TikZ export of hidden segments;
- UI/options for hidden style;
- tests.

Do not implement:

- exact analytic curve/surface intersection;
- full clipping/BSP algorithm;
- point/label occlusion;
- dependency on external TikZ packages.

## Algorithm

For each sampled curve segment:

1. compute midpoint in 3D;
2. project midpoint to screen;
3. find surface faces whose projected polygon contains that point;
4. interpolate or estimate face depth at that projected point;
5. compare curve depth vs face depth using epsilon;
6. classify segment as visible or hidden.

If hidden:

- render with hidden curve style.

MVP can classify entire sampled subsegments rather than exact split points.

## Geometry coverage

Support:

- ordinary curves;
- concatenated paths;
- line/cubic/arc segments;
- circle/ellipse templates sampled to segments;
- grid lines if practical.

Do not change original curve geometry.

Visibility result is render/export state.

## Hidden style

Add options:

```ts
hiddenCurveStyle: {
  lineStyle: "dotted" | "denselyDotted" | "dashed";
  opacity: number;
}
```

or reuse `CurveStyle`.

Default hidden style:

- densely dotted;
- reduced opacity.

User option may come later; MVP can use fixed defaults if documented.

## SVG/TikZ output

SVG:

- visible segments use normal curve style;
- hidden segments use hidden style;
- segment order stable.

TikZ:

- emit visible/hidden draw commands;
- hidden commands use hidden style;
- include comments if helpful;
- no source geometry mutation;
- inline no blank lines;
- 4-space indentation.

## Tests

Add tests:

1. Curve in front of surface classified visible.
2. Curve behind surface classified hidden.
3. Curve partly behind surface produces visible and hidden segments.
4. Hidden style applied in SVG helper/output.
5. Hidden style applied in TikZ.
6. Original curve geometry unchanged.
7. Layer/depth options respected.
8. Inline output no blank lines.
9. Sampling cap prevents excessive work.
10. Disabled visibility mode preserves normal output.

## Documentation

Document sampling-based occlusion and limitations.

## Report after implementation

Please report:

- files modified;
- occlusion algorithm;
- supported curve kinds;
- hidden style;
- SVG/TikZ behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
