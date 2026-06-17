# Phase 15H Implementation Prompt: Reference-diagram presets and export hardening

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

Add examples, presets, and export hardening so users can efficiently create diagrams like the reference PDF.

## Scope

Implement:

- reference-style example diagrams;
- lightweight style presets;
- TikZ readability improvements;
- performance/default sampling checks.

Do not implement:

- new surface math models;
- symbolic TikZ programming;
- full hidden-surface algorithm;
- broad layer manager;
- multi-selection.

## Examples

Add examples/templates:

1. translucent colored filled regions/sheets with solid/dotted curves;
2. hemisphere patch with paths/points/labels;
3. saddle patch with paths/points/labels;
4. even-odd filled boundary example.

Examples should validate and be editable.

## Presets

Add lightweight presets:

- blue translucent sheet;
- red translucent sheet;
- black solid curve;
- black densely dotted curve;
- common point styles.

## TikZ hardening

Improve comments/grouping for filled regions/sheets and curved primitives.

Ensure:

- no NaN/Infinity;
- output size reasonable;
- default sampling modest;
- layer/style readable.

## Tests

Add tests for example validation, SVG/TikZ generation, finite output, output size, presets, and existing example regression.

## Documentation

Document examples and limitations.

## Report after implementation

Report examples, presets, output hardening, tests, limitations.
