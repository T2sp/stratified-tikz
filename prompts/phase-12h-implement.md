# Phase 12H Implementation Prompt: Existing coordinate sources for direct creation

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
- Work-plane state is editor/UI state, not `Diagram`.
- Work planes are drawing aids, not committed diagram elements.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Work-plane guides/previews must not be exported to TikZ.
- Existing axis-aligned 3D work planes `xy`, `xz`, and `yz` must keep working.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load and undo/redo behavior.

## Goal

Implement existing coordinate sources for direct creation.

When directly creating polyline, cubic Bézier, or polygon sheet geometry, users should be able to choose existing coordinates already present in the diagram as sources for starts, ends, breakpoints, vertices, or point-like control inputs.

Supported coordinate sources should include:

- point stratum positions;
- existing polyline vertices, in both 2D and 3D;
- existing polygon sheet vertices, in 3D.

If easy and consistent with the current model, cubic Bézier points may also be offered as coordinate sources:

- start;
- control point 1;
- control point 2;
- end.

However, the required sources for this phase are:

- point strata;
- polyline vertices;
- polygon sheet vertices.

Initial policy: **copy-on-create, not live linking**.

That means:

- selecting an existing coordinate source copies its current coordinate into the newly created geometry;
- the new curve/sheet does not remain linked to the source;
- moving or deleting the original point/polyline/sheet later does not automatically update the newly created geometry.

Do not implement linked/anchored vertices in this phase.

## Prerequisites

Phases 12A-12G are complete.

Plane-local direct creation exists and direct creation forms can use either:

- global coordinates;
- active work-plane local coordinates.

## Scope

Do not implement:

- live point references;
- anchored vertices;
- automatic updates when source points move;
- curve/sheet vertex dependencies;
- TikZ reference-based export;
- general multi-selection;
- new curve types;
- broad UI redesign;
- new dependencies.

Do not change:

- coordinate-based direct creation behavior;
- plane-local direct creation behavior;
- cursor creation behavior;
- TikZ export semantics;
- save/load file format;
- diagram data model unless absolutely necessary.

## Coordinate source model

Add a small UI/editor-level representation for coordinate sources.

Suggested shape:

```ts
type ExistingCoordinateSource =
  | {
      kind: "pointStratum";
      stratumId: string;
    }
  | {
      kind: "polylineVertex";
      curveId: string;
      vertexIndex: number;
    }
  | {
      kind: "sheetVertex";
      sheetId: string;
      vertexIndex: number;
    }
  | {
      kind: "cubicBezierPoint";
      curveId: string;
      pointRole: "start" | "control1" | "control2" | "end";
    };
```

The `cubicBezierPoint` case is optional if it would make the implementation too large.

Coordinate source state belongs to UI/editor state, not to `Diagram`.

Do not store coordinate-source references inside created geometry.

Created geometry should store copied `Vec3` coordinates only.

## Source labels in the UI

The direct creation UI should show human-readable source labels.

Examples:

```text
Point: P
Polyline: Boundary / Vertex 1
Polyline: Boundary / Vertex 2
Sheet: Surface / Vertex 1
Sheet: Surface / Vertex 2
```

If cubic Bézier points are supported:

```text
Bézier: FLine / Start
Bézier: FLine / Control point 1
Bézier: FLine / Control point 2
Bézier: FLine / End
```

Use one-based labels for user-facing vertex numbers.

Internal indices may remain zero-based.

## Required UI behavior

For point-like fields in direct creation forms, allow the user to choose either:

```text
Input source:
  - Coordinates
  - Existing coordinate
```

Equivalent UI is fine.

Required direct creation targets:

In 2D diagrams:

- polyline vertices;
- cubic Bézier start point;
- cubic Bézier end point;
- cubic Bézier control points, if the direct UI treats them as absolute point-like controls.

In 3D diagrams:

- polyline vertices;
- cubic Bézier start point;
- cubic Bézier end point;
- cubic Bézier control points, if the direct UI treats them as absolute point-like controls;
- polygon sheet vertices.

For relative Cartesian/polar cubic Bézier controls, existing coordinate sources are optional and may be restricted to start/end in the first implementation.

## 2D behavior

This feature must work in 2D diagrams.

In 2D mode, existing coordinate sources should be available for direct creation of:

- polyline vertices;
- cubic Bézier start point;
- cubic Bézier end point;
- cubic Bézier control points, if the direct UI treats them as point-like absolute controls.

When an existing coordinate source is selected in 2D:

- copy its `x` and `y` coordinates;
- normalize or preserve `z = 0`;
- do not expose 3D work-plane-local controls;
- do not create 3D sheet geometry.

The created curve should be ordinary 2D curve data:

- polyline curves have codim 1;
- cubic Bézier curves have codim 1;
- all internal points remain `Vec3`;
- all internal `z` values should be `0`.

If an existing 2D source somehow has nonzero `z`, normalize it to `0` or reject it consistently with existing 2D validation behavior.

## Copy-on-create behavior

When the user chooses an existing coordinate source:

1. Resolve the source to a current model-space `Vec3`.
2. Validate that the coordinate is finite.
3. Apply the current coordinate mode policy.
4. Commit the copied coordinate into the newly created geometry.
5. Do not store a reference to the source.

After creation:

- moving the source point does not move the created curve/sheet;
- editing the source polyline vertex does not move the created curve/sheet;
- editing the source sheet vertex does not move the created curve/sheet;
- deleting the source object does not invalidate the created curve/sheet.

This is copy-on-create only.

## Coordinate mode policy

This feature must respect the direct creation coordinate mode.

### Global coordinate mode

If the direct creation form is in global coordinate mode:

- choosing an existing point stratum copies its model-space `Vec3`;
- choosing an existing polyline vertex copies that vertex’s model-space `Vec3`;
- choosing an existing sheet vertex copies that vertex’s model-space `Vec3`.

The copied coordinate is used directly.

### Active work-plane local coordinate mode

If the direct creation form is in active work-plane local mode:

Preferred initial policy:

- the selected existing coordinate source is allowed only if it lies on the active work plane within tolerance;
- the app computes the source coordinate’s local `(a,b)` coordinates in the active work-plane basis;
- creation then uses those local `(a,b)` coordinates;
- if the source coordinate is off-plane, reject it with a clear message.

Do not silently project off-plane existing coordinates.

Alternative acceptable policy:

- provide an explicit option such as `Project selected source to active work plane`;
- if enabled, off-plane sources are orthogonally projected to the active work plane;
- projection must be explicit, not silent.

For the first implementation, prefer rejecting off-plane sources.

## Source resolution helper

Add a pure helper if useful.

Suggested helper:

```ts
resolveExistingCoordinateSource(diagram, source): Vec3 | null
```

or a result-style equivalent.

It should support:

- point stratum position;
- polyline vertex;
- polygon sheet vertex;
- optionally cubic Bézier start/control/end points.

It should reject:

- missing source id;
- invalid vertex index;
- non-point source used as point stratum;
- non-polyline curve used as polyline vertex source;
- non-sheet source used as sheet vertex source;
- non-finite coordinates.

Do not throw uncaught errors from UI paths.

## Validation

Required:

- only valid existing coordinate sources may be selected;
- missing/deleted source IDs are rejected;
- out-of-range vertex indices are rejected;
- source coordinates must be finite;
- plane-local mode validates on-plane condition within tolerance;
- invalid sources do not create geometry;
- invalid sources do not partially update the diagram.

## Layer, selection, undo/redo

Preserve existing behavior:

- new geometry uses the selected creation layer;
- layer filter does not unexpectedly hide created geometry;
- created geometry is selected according to existing behavior;
- creation is undoable if undo/redo exists;
- changing coordinate-source UI fields should not create undo history entries.

## Tests

Add focused tests.

Required tests:

1. Point source:
   - direct creation using a point stratum copies that point’s position.

2. 2D polyline vertex source:
   - direct creation using an existing 2D polyline vertex copies its coordinate;
   - copied coordinate has `z = 0`.

3. 3D polyline vertex source:
   - direct creation using an existing 3D polyline vertex copies its `Vec3`.

4. 3D sheet vertex source:
   - direct creation using an existing polygon sheet vertex copies its `Vec3`.

5. Copy-on-create behavior:
   - after creation, moving the source point/polyline/sheet vertex does not change the created curve/sheet.

6. Global coordinate mode:
   - source model-space `Vec3` is copied exactly.

7. Plane-local mode:
   - source coordinate on the active work plane can be used;
   - local coordinates are computed correctly;
   - off-plane source is rejected unless explicit projection is implemented.

8. Missing/deleted source IDs are rejected.

9. Invalid vertex indices are rejected.

10. Non-finite source coordinates are rejected.

11. No live source references are stored in created geometry.

12. Non-point strata cannot be used as point-stratum sources.

13. Non-polyline curves cannot be used as polyline vertex sources.

14. Non-sheet strata cannot be used as sheet vertex sources.

If cubic Bézier points are supported as coordinate sources, add tests for:

- start;
- control point 1;
- control point 2;
- end.

## Documentation

Update docs briefly:

- direct creation can use existing coordinate sources;
- supported sources:
  - point positions;
  - polyline vertices;
  - polygon sheet vertices;
- source coordinates are copy-on-create;
- no live linking in this phase;
- plane-local mode requires source coordinates to lie on the active work plane unless explicit projection is enabled.

## Preserve existing behavior

Do not regress:

- coordinate-based direct creation;
- plane-local direct creation;
- cursor creation;
- layer/filter/selection behavior;
- inspector editing;
- save/load;
- undo/redo;
- SVG preview;
- TikZ export.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## Report after implementation

Please report:

- files modified;
- UI design for existing coordinate sources;
- supported source kinds;
- supported direct creation targets;
- copy-on-create implementation;
- plane-local mode policy;
- whether cubic Bézier points are supported as sources;
- validation behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
