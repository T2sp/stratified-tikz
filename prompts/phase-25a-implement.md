# Phase 25A Implementation Prompt: Work-plane-local symbolic coordinate model and validation

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

Phase 24 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- symbolic variables and symbolic global coordinate expressions;
- direct input and cursor input;
- cursor snapping;
- multi-selection and bulk editing;
- symbolic-aware translation;
- path concatenation;
- layer merge/translation;
- custom work planes;
- camera controls;
- grids/lattices;
- arrows and 2D braiding controls;
- paths, sheets, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches;
- preview-centered UI;
- layer/style/variable managers;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 25 adds symbolic work-plane-local coordinates.

Main idea:

- In 3D direct input and Inspector coordinate editing, users can enter coordinates in the active/stored work-plane-local 2D coordinate system.
- The local coordinates accept symbolic scalar expressions just like global coordinates.
- SVG preview uses finite numeric preview values.
- TikZ export should preserve local symbolic expressions where practical by emitting compatible paths/sheets inside `canvas is plane` scopes.
- Direct/symbolic input should not be snapped by cursor snapping.

Important user decision:

- During **global translation** of an object that contains work-plane-local symbolic coordinates, move that object's own frame origin by the global translation vector.
- Do **not** expand local symbolic expressions into global symbolic coordinates during global translation.
- Do **not** mutate a shared global work plane; move each object's stored frame snapshot origin.
- During **work-plane-local translation** of such coordinates, update local scalar expressions `a`, `b` by adding local deltas.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work-plane-local symbolic coordinate data affects geometry/export and must be saved.
- UI-only draft/open state should not be stored in `Diagram`.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Add a persistent coordinate model for work-plane-local symbolic coordinates.

This subphase should introduce the model, validation, preview evaluation helpers, and save/load support, without broad UI integration yet.

## Core concept

A work-plane-local coordinate stores:

```text
P = frame.origin + a * frame.u + b * frame.v
```

where:

- `frame` is a stored work-plane frame snapshot;
- `a` and `b` are scalar inputs that may be numeric or symbolic expressions;
- `P` is the finite global preview point used for SVG preview and geometry computations.

Example:

Variables:

```text
R = 2
q = 30
```

Local input:

```text
a = R*cos(q)
b = R*sin(q)
```

Preview:

```text
P = origin + preview(a) * u + preview(b) * v
```

## Scope

Implement:

- work-plane-local coordinate data model;
- validation helpers;
- preview evaluation helpers;
- variable detection helpers;
- save/load normalization;
- tests.

Do not implement yet:

- direct input UI;
- Inspector UI;
- broad geometry integration;
- TikZ `canvas is plane` export;
- translation/editing integration;
- new work-plane construction UI.

## Suggested data model

Choose a model that avoids losing local symbolic intent.

Preferred:

```ts
type CoordinateSource =
  | {
      kind: "global";
      value: SymbolicVec3;
    }
  | {
      kind: "workPlaneLocal";
      frame: WorkPlaneFrameSnapshot;
      local: {
        a: ScalarInputValue;
        b: ScalarInputValue;
      };
      preview: Vec3;
    };
```

If a large refactor is too risky, an alternative metadata model is acceptable:

```ts
type SymbolicVec3 = {
  x: CoordinateComponent;
  y: CoordinateComponent;
  z: CoordinateComponent;
  source?: {
    kind: "workPlaneLocal";
    frame: WorkPlaneFrameSnapshot;
    a: ScalarInputValue;
    b: ScalarInputValue;
  };
};
```

But if using optional metadata, ensure `x/y/z` and local source data cannot become silently inconsistent.

Requirements:

- original local expressions are preserved;
- finite global preview point is available;
- work-plane frame snapshot is saved;
- old diagrams without work-plane-local sources still load;
- invalid coordinate source values are rejected.

## Frame validation

Work-plane-local coordinates require a valid frame.

Validate:

- frame origin has finite preview coordinates;
- frame `u` and `v` have finite preview components;
- frame `normal` has finite preview components;
- `u` and `v` are nonzero;
- `u` and `v` are orthogonal within existing tolerance;
- `cross(u, v)` is consistent with `normal` according to existing handedness policy;
- if frame components are symbolic, they must be resolved to finite previews.

Reuse existing work-plane validation helpers when possible.

## Local scalar validation

Validate `a` and `b` using existing Phase 19 scalar expression helpers.

Requirements:

- numeric scalar accepted;
- symbolic scalar accepted if variables exist and preview finite;
- unknown variables rejected;
- unsafe tokens rejected;
- non-finite preview rejected;
- stale previews rejected or refreshed according to existing Phase 19 policy.

## Preview computation

Add helper:

```ts
evaluateWorkPlaneLocalCoordinate(source, variableContext): Result<Vec3>
```

or equivalent.

It should compute:

```text
preview = origin + aPreview*u + bPreview*v
```

Requirements:

- returns finite Vec3;
- does not mutate unless explicitly part of a refresh helper;
- handles symbolic frame and local scalars;
- 2D z policy preserved if used in 2D fallback;
- no NaN/Infinity.

## Variable detection

Detect variables used in:

- local `a`;
- local `b`;
- frame origin;
- frame u/v/normal;
- nested symbolic scalar/coordinate fields.

Integrate with existing JSON import variable-resolution detection.

Function names like `sin`, `cos`, `sqrt` must not be treated as variables.

## Save/load

Requirements:

- saved work-plane-local coordinate source round-trips;
- old diagrams load;
- malformed source rejected cleanly;
- missing frame/local fields rejected;
- unresolved variables lead to import variable-resolution flow when loading JSON;
- no raw TypeError.

## Tests

Add tests:

1. Numeric local coordinate evaluates to finite global preview.
2. Symbolic local coordinate `R*cos(q), R*sin(q)` evaluates with variables.
3. Variable detection finds `R` and `q`.
4. Unknown variable rejected.
5. Symbolic frame origin evaluates.
6. Invalid frame rejected.
7. Non-finite local scalar rejected.
8. Save/load round-trip preserves local expressions.
9. Old global-coordinate diagram still loads.
10. Malformed work-plane-local source returns clean validation error.
11. Function names are not treated as variables.

## Documentation

Add a short model/validation doc note if docs exist.

## Report after implementation

Please report:

- files modified;
- chosen coordinate source model;
- validation behavior;
- preview computation;
- variable detection;
- save/load behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
