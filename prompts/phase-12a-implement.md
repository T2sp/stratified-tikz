# Phase 12A Implementation Prompt: WorkPlane model and geometry utilities

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

- An n-stratum means codimension n, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Active work-plane state is editor/UI state, not `Diagram`.
- Work planes are drawing aids, not committed diagram elements.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Work-plane guides/previews must not be exported to TikZ.
- Generated TikZ should not depend on transient active UI state.
- Existing axis-aligned 3D work planes (`xy`, `xz`, `yz`) must keep working.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.


## Goal

Add the internal WorkPlane model and pure geometry utilities needed for arbitrary custom 3D work planes.

This subphase should not add broad UI. It may add small exports/imports and tests. It should make later UI and creation subphases straightforward.

## Scope

Implement only the foundational model/helpers.

Do not implement:

- origin+normal UI;
- three-point UI;
- point-picking UI;
- custom work-plane preview;
- custom-plane cursor creation;
- TikZ `3d` scope export;
- full camera controls.

## Required implementation

Introduce or refine a `WorkPlane` representation.

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

The exact type can differ, but custom planes must have:

- `origin`;
- normalized `u`;
- normalized `v`;
- normalized `normal`.

Add pure helpers, preferably in `src/geometry/`:

- `dot`;
- `cross`;
- `norm`;
- `normalizeVector`;
- `addVec3`;
- `subtractVec3`;
- `scaleVec3`;
- `isFiniteVec3`;
- `constructWorkPlaneFromOriginNormal(origin, normal, options?)`;
- `constructWorkPlaneFromThreePoints(p0, p1, p2, options?)`;
- `validateWorkPlane`;
- `pointOnWorkPlane(plane, a, b)` or equivalent `origin + a u + b v`;
- `projectPointToWorkPlaneCoordinates(point, plane)`;
- conversion helpers for axis-aligned planes if useful.

Validation requirements:

- reject non-finite origin/normal/points;
- reject zero normal vector;
- reject coincident or nearly coincident points where needed;
- reject collinear three-point input;
- use an epsilon tolerance;
- never produce `NaN` or infinite coordinates.

For origin + normal:

- normal alone does not determine in-plane axes;
- choose a deterministic stable auxiliary axis to construct `u`;
- compute `v` consistently;
- document handedness.

For three points:

- use `p0` as origin;
- use `p1 - p0` to determine `u`;
- use `cross(p1 - p0, p2 - p0)` to determine `normal`;
- reject collinear input.

## Tests

Add focused tests for:

- origin+normal construction;
- zero normal rejection;
- non-finite input rejection;
- three-point construction;
- collinear/coincident rejection;
- approximate orthonormal basis;
- axis-aligned compatibility;
- local-to-global and global-to-local coordinate conversion.

## Documentation

Update docs minimally to record that arbitrary work planes are represented by `origin`, `u`, `v`, and `normal`, and that active work-plane state is editor/UI state.

## Report

Report files modified, helpers added, validation policy, tests, test results, build results, and limitations.
