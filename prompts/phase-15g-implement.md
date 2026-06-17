# Phase 15G Implementation Prompt: Hemisphere and saddle creation/editing

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

Add user-facing creation and editing for curved surface primitives:

- hemisphere / spherical cap patches;
- saddle / hyperbolic paraboloid patches.

## Prerequisites

Phases 15E and 15F are complete.

## Scope

Implement:

- creation UI for hemisphere;
- creation UI for saddle;
- inspector editing for parameters;
- style/layer editing;
- SVG/TikZ updates;
- save/load and undo/redo integration.

Do not implement:

- arbitrary symbolic parametric surfaces;
- boolean operations;
- advanced mesh sculpting;
- new dependencies.

## Hemisphere creation

Inputs:

- center;
- radius;
- orientation frame or active work-plane frame;
- side positive/negative;
- sampling;
- layer/style.

MVP:

- use active work-plane frame as equator plane;
- normal from active work plane;
- side selects which half is shown.

## Saddle creation

Inputs:

- origin/frame;
- width;
- depth;
- height;
- sampling;
- layer/style.

Use documented formula from Phase 15E.

## Inspector editing

Allow editing:

- name;
- layer;
- style;
- primitive parameters;
- sampling resolution within bounds.

Invalid input rejected.

## Tests

Add tests for creation/editing of hemisphere and saddle, validation, save/load, undo/redo, style/layer, SVG/TikZ update.

## Documentation

Document workflows and limitations.

## Report after implementation

Report UI, parameters, tests, limitations.
