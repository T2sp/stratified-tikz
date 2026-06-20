# Phase 19E Implementation Prompt: Grid generation data model and SVG preview

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

Phase 18 is complete.

The editor now supports:

- 2D and 3D diagrams;
- points, labels, curves, paths, path templates, sheets, filled regions/sheets, curved surfaces;
- custom work planes;
- camera controls;
- layer manager;
- style manager and external TikZ style references;
- standalone and inline math TikZ export modes;
- save/load;
- undo/redo;
- SVG preview;
- layer-aware TikZ output.

Phase 19 adds symbolic input and grid generation.

Core requirements:

1. Users can define variables in the toolbar.
   - TikZ output corresponds to `\pgfmathsetmacro`.
   - Invalid/dangerous inputs should be rejected before they can generate broken TikZ.

2. Coordinate inputs can accept expressions using variables and elementary functions.
   - Example:
     - variables: `R`, `q`
     - coordinate input: `(R*cos(q), R*sin(q))`
     - generated TikZ coordinate: `({\R * cos(\q)}, {\R * sin(\q)})`
   - SVG preview still needs numeric values, so expressions must be evaluated using variable preview values.

3. Add a grid-generation mode.
   - The grid should be represented compactly in TikZ using `\foreach`.
   - Range/clip controls should make grid boundaries concise.
   - In 3D, grids should be generated in a work-plane-local 2D frame when applicable.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all numeric preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Symbolic data that affects generated TikZ should be persisted in diagram/export data, not only UI state.
- UI-only draft state should not be stored in `Diagram`.
- TikZ export must remain readable and must respect standalone vs inline math export mode.
- Inline math export must still contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve camera, work-plane, layer manager, style manager, save/load, undo/redo, SVG preview, and all existing geometry behavior.


## Goal

Add a grid generation mode and data model.

The grid should support efficient construction of regularly spaced lines in 2D or in a 3D work-plane-local frame.

This subphase focuses on:

- grid data model;
- UI creation/editing;
- SVG preview;
- numeric preview validation.

TikZ `\foreach` / clip export is implemented in Phase 19F.

## Scope

Implement:

- GridStratum or equivalent diagram object;
- grid creation UI;
- numeric range/step controls;
- optional symbolic range fields if safe;
- clip/range domain model;
- SVG preview rendering;
- style/layer support;
- save/load;
- tests.

Do not implement yet:

- TikZ `\foreach` export;
- symbolic `\foreach` ranges;
- arbitrary clip paths;
- non-rectangular clipping;
- new dependencies.

## Grid model

A grid is a collection of line curves generated from parameters.

Suggested model:

```ts
type GridStratum = {
  id: string;
  name: string;
  geometricKind: "curve";
  codim: 1 | 2;
  kind: "grid";
  frame: GridFrame;
  uRange: { min: ScalarInputValue; max: ScalarInputValue; step: ScalarInputValue };
  vRange: { min: ScalarInputValue; max: ScalarInputValue; step: ScalarInputValue };
  clip: {
    kind: "rectangle";
    uMin: ScalarInputValue;
    uMax: ScalarInputValue;
    vMin: ScalarInputValue;
    vMax: ScalarInputValue;
  };
  style: CurveStyle;
  layer: number;
};
```

Exact shape can differ.

For 2D:

- frame is xy with z=0.

For 3D:

- frame should be active work-plane frame snapshot at creation time.

## UI

Add grid generation mode/tool.

Suggested inputs:

```text
Grid
  Frame: 2D xy / active work plane
  u min, u max, u step
  v min, v max, v step
  clip u min, u max, v min, v max
  layer
  style
```

MVP can use numeric inputs only.

If symbolic input is already stable, allow symbolic scalar fields with preview values.

## SVG preview

Render grid lines from numeric preview values.

Requirements:

- finite preview values only;
- step > 0;
- reasonable max line count;
- clip/range rectangle respected;
- 2D z=0;
- 3D projected with camera;
- selectable/reselectable;
- style/layer respected.

Add a cap such as max 200 or max 500 lines to prevent freezing.

## Validation

Reject:

- non-finite ranges;
- step <= 0;
- max < min;
- line count too large;
- invalid frame;
- non-finite generated points.

## Tests

Add tests:

1. Valid 2D grid validates.
2. Invalid step rejected.
3. Invalid range rejected.
4. Excessive line count rejected.
5. 2D grid preview produces finite line segments.
6. 3D work-plane grid preview produces finite projected lines.
7. Grid layer/style preserved.
8. Save/load round-trip.
9. Old diagrams load.
10. Existing geometry rendering not regressed.

## Documentation

Document grid generation model and preview limitations.

## Report after implementation

Please report:

- files modified;
- grid data model;
- UI behavior;
- line count cap;
- clipping/range behavior;
- SVG preview behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
