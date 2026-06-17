# Phase 15F Implementation Prompt: SVG and TikZ export for curved sheet primitives

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

Render and export curved sheet primitives introduced in Phase 15E.

Initial implementation may use sampled mesh/quads.

## Scope

Implement:

- SVG rendering for curved sheet meshes;
- TikZ export for sampled curved sheets;
- style/layer handling;
- selection/highlight support;
- tests.

Do not implement:

- UI creation for hemisphere/saddle;
- advanced hidden-surface sorting;
- true smooth vector surface export;
- external dependencies.

## SVG rendering

Render each sampled quad/polygon.

Requirements:

- fill/stroke/opacity respected;
- layer respected;
- selected highlight works;
- deterministic rendering;
- default sampling not too heavy.

## TikZ export

Export sampled mesh faces as readable `\filldraw` polygons or equivalent.

Requirements:

- finite coordinates;
- layer-aware output;
- style preserved;
- comments identify primitive and sampling;
- no excessive output by default.

## Tests

Add tests for hemisphere/saddle SVG/TikZ, style/layer, finite output, output size, existing sheet regression.

## Documentation

Document sampled mesh export and limitations.

## Report after implementation

Report rendering/export strategy, tests, limitations.
