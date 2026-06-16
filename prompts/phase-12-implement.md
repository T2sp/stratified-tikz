# Phase 12 Implementation Prompt: Custom work planes and work-plane-local TikZ export

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

## Context

You are working on the StratifiedTikZ project.

The app already supports 2D/3D diagrams, axis-aligned 3D work planes (`xy`, `xz`, `yz`), cursor/direct creation, layer filtering, SVG preview, TikZ export, Bézier editing, and relative Cartesian / relative polar Bézier controls from Phase 11.

Important conventions:

- An n-stratum means codimension n, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Active work-plane state is editor/UI state, not `Diagram`.
- Work planes are drawing aids, not committed diagram elements.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Work-plane guides/previews must not be exported to TikZ.
- Existing axis-aligned work planes must keep working.

## Phase 12 goal

Implement custom 3D work planes and use them as the foundation for work-plane-local 3D Bézier relative-control TikZ export.

The user should be able to define and use an arbitrary 3D work plane in these ways:

1. by specifying an origin and a normal vector;
2. by specifying three numeric points;
3. by selecting/picking three existing point strata already on the canvas.

At the end of Phase 12, if a 3D cubic Bézier curve has relative Cartesian or relative polar controls in a known work-plane-local frame, generated TikZ should emit that curve in a `scope` using TikZ's `3d` library `canvas is plane` mechanism. Inside that scope, the path should be written in 2D-style relative syntax:

```tex
\begin{scope}[
  plane origin={(Ox,Oy,Oz)},
  plane x={(Px,Py,Pz)},
  plane y={(Qx,Qy,Qz)},
  canvas is plane
]
  \draw (sx,sy) .. controls +(q1:r1) and +(q2:r2) .. (ex,ey);
\end{scope}
```

This scoped TikZ export should be implemented near the end of Phase 12, after custom work-plane data and local coordinates are reliable.

## Revised Phase 12 subphases

Implement Phase 12 according to these subphases:

- **12A: WorkPlane model and geometry utilities.**
- **12B: Custom plane from origin + normal.**
- **12C: Custom plane from three numeric points.**
- **12D: Custom plane from three existing point strata.**
- **12E: Custom work-plane preview and creation integration.**
- **12F: Camera-ready projection/export separation.**
- **12G: Work-plane-local cubic Bézier metadata.**
- **12H: TikZ `3d` library scope export for work-plane-local Béziers.**

## Scope

Do not implement:

- full 3D camera orbit/pan/zoom UI;
- perspective projection;
- TikZ import;
- snapping;
- region strata;
- curved-boundary sheets;
- new dependencies;
- broad UI redesign.

Do not change:

- diagram data model except where needed for persistent Bézier export metadata;
- saved JSON format except where needed for persistent Bézier export metadata;
- TikZ generator semantics for non-Bézier existing geometry;
- SVG rendering semantics for committed geometry;
- layer-aware TikZ output;
- layer filter semantics;
- existing creation semantics except to support custom work planes.

## 12A. WorkPlane model and geometry utilities

Introduce a robust internal representation for custom work planes.

Recommended shape:

```ts
type AxisAlignedWorkPlane = {
  kind: "axisAligned";
  plane: "xy" | "xz" | "yz";
  offset: number;
};

type CustomWorkPlane = {
  kind: "custom";
  id: string;
  name: string;
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  normal: Vec3;
  source:
    | { kind: "originNormal" }
    | { kind: "threePoints" }
    | { kind: "existingPointStrata"; pointIds: [string, string, string] };
};

type WorkPlane = AxisAlignedWorkPlane | CustomWorkPlane;
```

The exact type may differ, but custom planes must have `origin`, normalized `u`, normalized `v`, and normalized `normal`. The active work plane must remain editor/UI state only.

Add pure helpers, preferably under `src/geometry/`:

- `dot`, `cross`, `norm`, `normalizeVector`;
- finite `Vec3` checks;
- `constructWorkPlaneFromOriginNormal(origin, normal, options?)`;
- `constructWorkPlaneFromThreePoints(p0, p1, p2, options?)`;
- `validateWorkPlane`;
- `pointOnWorkPlane(plane, a, b)` or equivalent `origin + a u + b v`;
- `projectPointToWorkPlaneCoordinates(point, plane)`;
- custom-plane support for screen-to-model placement.

Validation requirements:

- reject non-finite origin/normal/points;
- reject zero normal vector;
- reject coincident or nearly coincident points where needed;
- reject collinear three-point input;
- use an epsilon tolerance;
- never produce `NaN` or infinite coordinates.

For origin + normal, choose a deterministic stable auxiliary axis to construct `u`. For three points, use `p0` as origin, `p1 - p0` for `u`, and `cross(p1 - p0, p2 - p0)` for `normal`.

## 12B. UI: origin + normal

Add a 3D-only UI for defining a custom plane by origin and normal:

```text
Custom plane by origin + normal
Origin: x, y, z
Normal: nx, ny, nz
Apply
```

Finite numeric values only. Zero normal and invalid input must be rejected without corrupting the current work-plane state. Successful apply sets the active work plane to the constructed custom plane.

## 12C. UI: three numeric points

Add a 3D-only UI for defining a custom plane by three numeric points:

```text
Custom plane by 3 points
P0: x, y, z
P1: x, y, z
P2: x, y, z
Apply
```

Finite coordinates only. Coincident/collinear input must be rejected. Successful apply sets the active work plane, using `P0` as origin and `P1 - P0` for the preferred `u` direction.

## 12D. UI/workflow: three existing point strata

Implement a way to define a custom work plane from three existing point strata.

Preferred MVP:

- add mode/control: `Pick 3 points for work plane`;
- clicking point strata records their IDs;
- require three distinct point strata;
- show status like `Picked 2/3 points`;
- allow cancel/reset;
- construct plane from their positions;
- reject duplicate/collinear picks.

Only point strata are pickable. Picking state is UI state only. Ordinary selection should not be corrupted. Creation tools should not accidentally add geometry while work-plane picking mode is active.

## 12E. Custom work-plane preview and creation integration

Render a visible but non-exported guide for the active custom plane.

Requirements:

- preview-only;
- not selectable;
- does not intercept pointer events;
- not stored in `Diagram`;
- not exported to TikZ;
- visually distinct from real sheet strata;
- shown only in 3D when custom plane is active.

Cursor creation should work on active custom work planes in 3D:

- point;
- label;
- polyline;
- cubic Bézier;
- 3D polygon sheet.

Canvas clicks should create/draft points on the active custom plane. Committed geometry remains ordinary `Vec3` diagram data and should appear in SVG/TikZ.

Direct creation may remain global-coordinate based, but custom work-plane state must not break it.

## 12F. Camera-ready projection/export separation

Do not implement full camera controls, but structure code so future camera work is feasible.

Expected conceptual separation:

```ts
projectModelToScreen(point, cameraOrProjection)
screenToModelOnWorkPlane(screenPoint, workPlane, cameraOrProjection)
```

Requirements:

- work plane is model-space geometry;
- projection/camera is a separate mapping;
- do not encode camera assumptions into custom work-plane data;
- do not encode transient active work-plane UI state into TikZ export.

Save/load:

- active work-plane UI state should not be saved in diagram JSON;
- loading a diagram resets or validates active work-plane state.

Undo/redo, if present:

- setting active work plane should not create a diagram history entry;
- geometry created on a custom plane should be undoable like ordinary creation;
- work-plane picking state should be cleared or validated after undo/redo.

## 12G. Work-plane-local cubic Bézier metadata

For 3D relative Cartesian / relative polar controls to export faithfully, the curve needs persistent metadata describing the local 2D frame used by those controls.

Add or refine cubic Bézier metadata so eligible 3D curves can store:

- absolute `Vec3` control points for rendering/editing;
- relative Cartesian or relative polar control metadata for source maintainability;
- a snapshot of the work-plane-local 2D frame:
  - origin;
  - `u`;
  - `v`;
  - normal;
- local coordinates for start/end where needed, or enough information to compute them.

Important:

- Do not rely only on the current active work plane at export time.
- If a curve was created/edited in a custom plane and later the active work plane changes, that curve's export meaning must remain stable.
- Store the relevant work-plane frame snapshot in diagram data only when it is required for faithful export of that curve.
- This is not the same as storing active UI work-plane state in the diagram.

For work-plane-local relative polar `(angle q, radius r)`:

```text
offset = r cos(q) u + r sin(q) v
c1 = start + offset1
c2 = end + offset2
```

For work-plane-local relative Cartesian:

```text
offset = dx u + dy v
```

If direct handle dragging changes relative control geometry, choose and document one policy:

- preferred: keep the same frame and recompute relative values;
- acceptable: switch the curve to absolute control mode after direct handle dragging.

## 12H. TikZ `3d` library scope export for work-plane-local Béziers

When a 3D cubic Bézier curve has relative Cartesian or relative polar metadata in a known work-plane-local frame, export it using TikZ's `3d` library canvas-plane mechanism.

Add `\usetikzlibrary{3d}` only when needed.

Expected export form:

```tex
\begin{scope}[
  plane origin={(Ox,Oy,Oz)},
  plane x={(Ox+ux,Oy+uy,Oz+uz)},
  plane y={(Ox+vx,Oy+vy,Oz+vz)},
  canvas is plane
]
  \draw[<style>]
    (sx,sy) .. controls +(q1:r1) and +(q2:r2) .. (ex,ey);
\end{scope}
```

For relative Cartesian controls, use:

```tex
.. controls +(dx1,dy1) and +(dx2,dy2) ..
```

For relative polar controls, use:

```tex
.. controls +(q1:r1) and +(q2:r2) ..
```

Coordinate declaration policy:

- Do not emit independent `\coordinate` declarations for relative control points in this mode.
- It is acceptable to emit local start/end coordinates inline inside the scope.
- If start/end coordinates are named, ensure they are local to the scope or clearly named to avoid collisions.
- Avoid dangling references to omitted control coordinates.

Fallback rule:

If a 3D Bézier curve does not have a known work-plane-local frame, or if its start/end/control metadata cannot be represented consistently in one plane, export it using the existing absolute 3D Bézier control syntax.

Do not export arbitrary 3D work-plane-local polar controls as plain TikZ `+(q:r)` outside a `canvas is plane` scope.

## Tests

Add focused tests.

Required geometry tests:

- origin + normal construction;
- zero normal rejection;
- non-finite input rejection;
- three-point construction;
- collinear/coincident rejection;
- approximate orthonormal basis;
- axis-aligned plane regression;
- custom screen-to-model points lie on the plane.

Required creation/UI tests where practical:

- cursor-created point on a custom plane lies on the plane;
- at least one path-like creation test verifies committed vertices lie on the plane;
- origin+normal UI rejects invalid input;
- three-point UI rejects collinear input;
- existing point-strata picking supports valid picks and rejects duplicate/collinear picks.

Required TikZ/export tests:

- TikZ export excludes active work-plane guide/state;
- save JSON excludes active custom work-plane state;
- work-plane-local 3D relative polar Bézier exports with `\usetikzlibrary{3d}` and `scope[canvas is plane]`;
- work-plane-local 3D relative Cartesian Bézier exports with `scope[canvas is plane]`;
- relative control-point coordinate declarations are omitted in scoped relative export;
- absolute 3D Bézier without work-plane-local metadata still uses existing absolute 3D control syntax;
- 2D relative Cartesian / polar export remains unchanged.

## Documentation

Update relevant docs:

- `docs/ROADMAP.md`;
- `docs/DATA_MODEL.md` if editor-state/model distinctions are documented;
- `docs/TIKZ_OUTPUT.md`;
- geometry/projection docs if present.

Document:

- custom work planes are UI/editor state, not active diagram state;
- custom planes can be defined by origin+normal, three numeric points, and three existing point strata;
- internal representation uses `origin`, `u`, `v`, `normal`;
- work-plane guides are not exported to TikZ;
- camera/projection separation;
- work-plane-local Bézier export uses TikZ `3d` library `canvas is plane` scopes;
- relative Bézier controls in this scope do not need independent control-point coordinate declarations;
- fallback behavior for curves without work-plane-local metadata.

## Manual verification checklist

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open/create a 3D diagram.
2. Define custom plane by origin `(0,0,0)` and normal `(1,1,1)`.
3. Confirm custom work-plane preview appears.
4. Cursor-create a point; it appears on that plane and TikZ source changes.
5. Cursor-create a polyline; draft and committed vertices lie on the plane.
6. Define custom plane by three numeric points; valid input applies and collinear input is rejected.
7. Place three point strata and use them to define a work plane.
8. Switch back to `xy`, `xz`, `yz`; existing behavior still works.
9. Create or edit a 3D cubic Bézier with work-plane-local relative polar controls.
10. Confirm generated TikZ uses `\usetikzlibrary{3d}` and `scope[... canvas is plane]`.
11. Confirm inside that scope the curve is written with `+(q:r)` relative controls.
12. Confirm no independent control-point coordinate declarations are emitted for those relative controls.
13. Save/export JSON; active work-plane UI state is not saved.
14. Generate TikZ; work-plane guides are not exported.

## Preserve existing behavior

Do not regress:

- 2D creation;
- 3D axis-aligned work-plane creation;
- cursor point/label/polyline/cubic/sheet creation;
- direct creation;
- layer selection for new elements;
- layer filtering;
- selection behavior;
- drag handle editing;
- undo/redo;
- inspector editing;
- style editing;
- save/load;
- SVG preview;
- TikZ generation for non-Bézier elements;
- absolute Bézier export;
- 2D relative Bézier export;
- Phase 9A coordinate names;
- Phase 9B layer-aware output;
- Phase 9C layer filtering.

## Report after implementation

Please report:

- files modified;
- subphases completed;
- WorkPlane model used;
- geometry helpers added;
- how origin+normal planes are constructed;
- how three-point planes are constructed;
- whether three existing point-strata plane creation was implemented;
- how custom plane cursor creation works;
- how custom plane preview is rendered;
- how camera-ready separation was preserved;
- how work-plane-local Bézier metadata is represented;
- how TikZ `3d` scope export works;
- when fallback absolute Bézier export is used;
- how save/load avoids active work-plane state;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
