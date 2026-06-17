# Phase 15E Implementation Prompt: Curved sheet primitive model and sampling utilities

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

Phase 14 is complete or near complete.

The project goal includes efficiently drawing 2D and 3D stratified diagrams with:

- closed paths;
- filled regions/sheets;
- translucent colored 2-dimensional strata;
- solid and dotted 1-strata;
- point markers;
- labels;
- coordinate axes;
- readable TikZ output.

Phase 15 now prioritizes closed-path filling in both 2D and 3D before more specialized curved surface primitives.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- In 2D:
  - codim 0 strata are regions;
  - codim 1 strata are curves;
  - codim 2 strata are points.
- In 3D:
  - codim 1 strata are sheets;
  - codim 2 strata are curves;
  - codim 3 strata are points.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work planes are model-space editing aids.
- A 3D closed-path filled sheet in this phase should be planar and work-plane-local.
- Preview-only UI state should not be stored in `Diagram`.
- Generated TikZ must remain readable and should preserve style/layer semantics.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load, undo/redo, camera, work-plane, concatenated path, and existing creation/editing behavior.


## Goal

Introduce a model and geometry utilities for 3D curved sheet primitives such as hemispheres and saddle patches.

Closed-path filling is already handled by earlier Phase 15 subphases. This subphase starts specialized curved surface primitives.

## Scope

Implement:

- curved sheet primitive model;
- surface parameter domain model;
- frame/orientation model;
- mesh/sample generation helpers;
- validation helpers;
- save/load validation if model is persisted.

Do not implement yet:

- UI creation for hemisphere/saddle patches;
- SVG/TikZ rendering beyond minimal test support;
- advanced surface editing;
- hidden-surface sorting;
- boolean operations;
- new dependencies.

## Data model

Add a 3D sheet stratum kind for curved surfaces.

Suggested:

```ts
type SurfaceFrame = {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  normal: Vec3;
};

type SurfaceSampling = {
  uSegments: number;
  vSegments: number;
};

type CurvedSheetPrimitive =
  | {
      kind: "hemisphere";
      center: Vec3;
      radius: number;
      frame: SurfaceFrame;
      hemisphereSide: "positive" | "negative";
      sampling: SurfaceSampling;
    }
  | {
      kind: "saddle";
      frame: SurfaceFrame;
      width: number;
      depth: number;
      height: number;
      sampling: SurfaceSampling;
    };

type CurvedSheetStratum = {
  id: string;
  name: string;
  geometricKind: "sheet";
  codim: 1;
  kind: "curvedSheet";
  primitive: CurvedSheetPrimitive;
  style: SheetStyle;
  layer: number;
};
```

## Validation and sampling

Required:

- finite parameters;
- frame finite and orthonormal;
- radius positive;
- width/depth positive;
- sampling positive integer and capped;
- sampled vertices finite;
- no NaN/Infinity.

Add helpers:

- `sampleHemisphere`;
- `sampleSaddle`;
- `sampleCurvedSheetPrimitive`;
- `surfaceBoundaryPolylines` if useful.

## Tests

Add tests:

1. Valid hemisphere validates.
2. Invalid radius rejected.
3. Hemisphere sampling finite.
4. Valid saddle validates.
5. Invalid width/depth/sampling rejected.
6. Saddle sampling finite.
7. Frame validation.
8. Sampling cap.
9. Curved sheet stratum codim/geometricKind.
10. Save/load if model persisted.

## Documentation

Document primitive model and sampling limitations.

## Report after implementation

Please report files modified, model shape, sampling helpers, tests, and limitations.
