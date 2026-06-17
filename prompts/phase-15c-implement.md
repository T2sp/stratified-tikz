# Phase 15C Implementation Prompt: SVG and TikZ fill output with even-odd rule

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

Render and export filled regions/sheets created from closed paths.

This phase should support:

- 2D filled regions;
- 3D work-plane-local filled sheets;
- multiple closed boundaries;
- `evenOdd` fill rule.

## Prerequisites

Phases 15A and 15B are complete.

## Scope

Implement:

- SVG rendering for filled regions/sheets;
- TikZ export for filled regions/sheets;
- even-odd fill rule output;
- style/layer handling;
- tests.

Do not implement:

- editing UI;
- curved surface primitives;
- non-planar surface filling;
- boolean operations;
- holes beyond even-odd multiple boundaries.

## SVG rendering

For 2D regions:

- render boundaries as one SVG path;
- use `fill-rule="evenodd"` when fillRule is `evenOdd`;
- use nonzero/default rule when fillRule is `nonzero`;
- respect fill/stroke/opacity;
- respect layer;
- selected highlight works.

For 3D work-plane-filled sheets:

- project boundary points using current camera/projection;
- render as filled projected path;
- use SVG `fill-rule="evenodd"` for evenOdd;
- respect style/layer;
- selected highlight works.

Note:

- For 3D, this is a projected planar filled path.
- Do not implement non-planar triangulated filling here.

## TikZ export

For 2D:

- export a closed filled path;
- for multiple boundaries and evenOdd, use TikZ option `even odd rule`;
- preserve style/layer;
- line segments as `--`;
- cubic segments as `.. controls ... ..`;
- close each boundary.

For 3D work-plane-local sheets:

Preferred:

- if a plane frame is available, export inside a TikZ `3d` library `canvas is plane` scope;
- write local 2D path coordinates inside the scope;
- use `even odd rule` when needed.

Fallback:

- if local scope cannot be used safely, export absolute 3D coordinates with readable comments, but ensure output is valid.

Required:

- no source path references;
- no editor-only state;
- finite coordinates;
- readable comments;
- layer output preserved.

## Tests

Add tests:

1. 2D filled region SVG path uses evenodd fill rule for evenOdd.
2. 2D filled region TikZ includes `even odd rule` for evenOdd.
3. 2D nonzero fill omits or uses nonzero rule appropriately.
4. Multiple boundaries are exported.
5. Cubic boundary segment exported correctly.
6. 3D work-plane-filled sheet SVG renders projected filled path.
7. 3D evenOdd sheet TikZ includes `even odd rule`.
8. 3D local scope export uses `canvas is plane` if implemented.
9. Style/layer preserved.
10. No NaN/Infinity in SVG/TikZ output.
11. Existing polygon sheets and paths not regressed.

## Documentation

Update `docs/TIKZ_OUTPUT.md`:

- filled regions/sheets;
- `even odd rule`;
- 3D work-plane-local fill scope;
- fallback limitations.

## Report after implementation

Please report:

- files modified;
- SVG strategy;
- TikZ strategy;
- evenOdd implementation;
- 3D local-scope behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
