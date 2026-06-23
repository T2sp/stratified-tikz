# Phase 22F Implementation Prompt: Arrow/braiding polish, docs, and regression hardening

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

Polish and harden Phase 22 arrow and braiding features.

## Scope

Implement:

- UI polish;
- documentation;
- examples;
- regression tests;
- performance caps for intersection detection;
- save/load hardening.

Do not implement:

- full knot theory engine;
- 3D braiding;
- exact symbolic crossing solving;
- knot package output.

## UI polish

Improve:

- arrow controls compactness;
- direction reverse feedback;
- crossing marker visibility;
- braiding state tooltips/status;
- warning for ambiguous/overlapping intersections;
- performance status if too many path pairs.

## Performance

Intersection detection should be bounded.

Add or verify caps:

- max paths considered;
- max sampled segments per path;
- max crossing candidates;
- skip/notify when too many.

Do not freeze editor on dense diagrams.

## Examples

Add examples if appropriate:

1. 2D string diagram with arrows.
2. Mid-arrow decoration at 0.5.
3. Braiding and anti-braiding crossings.
4. Harpoon arrowheads.

## Documentation

Update docs:

- arrow options;
- mid-arrow position;
- arrowhead choices;
- path reversal;
- braiding toggle convention;
- no-knot package export;
- limitations.

## Tests

Add combined tests:

1. Arrow-decorated path with braiding exports.
2. Mid-arrow plus braiding does not use knot package.
3. Save/load with arrows and crossings round-trips.
4. Inline output no blank lines.
5. 4-space indentation.
6. 3D arrows work; 3D braiding not allowed.
7. Dense intersection detection capped.

## Report after implementation

Please report:

- files modified;
- UI polish;
- performance caps;
- docs/examples;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
