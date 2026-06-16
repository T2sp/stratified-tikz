# Phase 12G Implementation Prompt: Plane-local direct creation

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

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Active work-plane state is editor/UI state, not `Diagram`.
- Work planes are drawing aids, not committed diagram elements.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Work-plane guides/previews must not be exported to TikZ.
- Existing axis-aligned 3D work planes `xy`, `xz`, and `yz` must keep working.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load and undo/redo behavior.


## Goal

Implement plane-local direct creation input for 3D diagrams.

Clarification:

This is **not** “take a global 3D point and project/clip it to the active work plane.”

Instead, when plane-local direct input is enabled, the user enters 2D-like coordinates in the active work plane's normalized orthonormal basis.

If the active work plane has:

```ts
origin: Vec3
u: Vec3
v: Vec3
normal: Vec3
```

where `u` and `v` are normalized orthogonal basis vectors, then a plane-local input `(a, b)` means:

```ts
P = origin + a * u + b * v
```

The committed diagram still stores ordinary model-space `Vec3` coordinates.

## Prerequisites

Phases 12A-12F are complete.

That means:

- the `WorkPlane` model and geometry helpers exist;
- custom work planes can be defined;
- custom work-plane preview and cursor creation work;
- active work-plane state remains UI/editor state only;
- save/load and TikZ output do not persist/export active work-plane UI state.

## Scope

Do not implement:

- existing-point coordinate sources; that is Phase 12H;
- work-plane-local Bézier metadata; that is Phase 12I;
- TikZ `3d` library scope export; that is Phase 12J;
- live linked/anchored vertices;
- new curve types;
- broad UI redesign;
- new dependencies.

Do not change:

- global direct coordinate behavior;
- cursor creation behavior;
- TikZ export semantics;
- save/load file format;
- diagram data model unless absolutely necessary.

## Required UI behavior

For 3D direct creation forms, add a coordinate mode selector:

```text
Coordinate mode:
  - Global 3D coordinates
  - Active work-plane local coordinates
```

Equivalent wording is fine.

When `Global 3D coordinates` is selected:

- existing direct creation behavior remains unchanged;
- users enter `(x, y, z)`;
- existing validation remains unchanged.

When `Active work-plane local coordinates` is selected:

- users enter `(a, b)` for each point-like input;
- the app converts `(a, b)` to model-space `Vec3` using the active work plane;
- created geometry is committed as ordinary `Vec3` diagram data;
- SVG and TikZ use the resulting committed geometry normally;
- the active work plane itself is not stored as diagram data.

## Supported direct creation targets

Plane-local direct input should support:

- direct-created point;
- direct-created label position;
- direct-created polyline vertices;
- direct-created cubic Bézier start/end/control points when absolute controls are entered;
- direct-created polygon sheet vertices.

For cubic Bézier relative Cartesian/polar controls:

- if the direct form already supports relative control modes, keep those modes coherent;
- do not force Phase 12I metadata work into this subphase;
- absolute point-like fields in the form should support plane-local `(a,b)` input.

## 2D behavior

In 2D diagrams, keep the existing direct `(x,y)` behavior.

Do not expose confusing 3D work-plane controls in 2D.

## Axis-aligned work planes

For axis-aligned work planes, plane-local coordinates should behave according to the existing WorkPlane basis helpers:

- `xy` at fixed `z`: `(a,b)` maps to the `xy` plane with fixed `z`;
- `xz` at fixed `y`: `(a,b)` maps to the `xz` plane with fixed `y`;
- `yz` at fixed `x`: `(a,b)` maps to the `yz` plane with fixed `x`.

Use existing WorkPlane basis conversion helpers.

Do not duplicate axis-specific logic unless unavoidable.

## Custom work planes

For custom work planes, use:

```ts
P = origin + a * u + b * v
```

Validate that:

- the active work plane is valid;
- `origin`, `u`, and `v` are finite;
- `u`, `v` are normalized/orthogonal according to existing validation;
- input `a,b` are finite;
- the resulting `P` is finite.

Invalid input must not create geometry.

## Layer, selection, undo/redo

Preserve existing direct creation behavior:

- selected layer / creation layer is respected;
- layer filter does not hide the newly created element unexpectedly;
- created element is selected according to existing behavior;
- committed creation is undoable if undo/redo exists;
- changing coordinate mode or editing form fields should not create undo history entries.

## Tests

Add focused tests:

1. Plane-local point direct creation:
   - active custom work plane with known `origin,u,v`;
   - input `(a,b)`;
   - resulting point equals `origin + a u + b v`.

2. Plane-local label direct creation:
   - label position is converted correctly.

3. Plane-local polyline direct creation:
   - all vertices are converted correctly.

4. Plane-local cubic Bézier direct creation:
   - start/end/control points are converted correctly in absolute-control direct mode.

5. Plane-local sheet direct creation:
   - vertices are converted correctly and lie on the plane.

6. Axis-aligned work-plane local input:
   - `xy`, `xz`, `yz` mappings are correct.

7. Invalid input:
   - non-finite `a,b` rejected;
   - invalid active work plane rejected;
   - resulting non-finite `Vec3` rejected.

8. Existing global direct creation behavior remains unchanged.

## Documentation

Update docs briefly:

- plane-local direct input means coefficients in the active work-plane basis;
- formula `P = origin + a u + b v`;
- committed geometry remains ordinary `Vec3`;
- active work-plane UI state is not saved.

## Preserve existing behavior

Do not regress:

- cursor creation;
- direct global coordinate creation;
- custom work-plane preview;
- layer filtering;
- inspector editing;
- save/load;
- undo/redo;
- SVG preview;
- TikZ generation.

## Report after implementation

Please report:

- files modified;
- UI location of coordinate mode selector;
- conversion helper used for `(a,b) -> Vec3`;
- how axis-aligned and custom planes are handled;
- validation behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
