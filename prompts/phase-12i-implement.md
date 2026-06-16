# Phase 12I Implementation Prompt: Work-plane-local cubic Bézier metadata

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

Persist enough curve-level metadata so 3D relative Cartesian/polar Bézier controls can later be exported in their work-plane-local 2D frame.

The curve should still store or derive absolute `Vec3` control points for SVG rendering, hit testing, handle dragging, and geometry editing.

## Prerequisites

Phases 12A-12H are complete.

Phase 11 relative Cartesian / relative polar Bézier editing is complete.

## Scope

Add/refine cubic Bézier metadata only.

Do not implement:

- TikZ `3d` scope export; that is Phase 12J;
- new curve types;
- concatenated paths;
- full camera controls;
- live point references.

## Required metadata

For eligible 3D cubic Bézier curves with relative Cartesian or relative polar controls, store enough persistent metadata for later faithful work-plane-local export.

The metadata should distinguish:

- absolute control mode;
- work-plane-local relative Cartesian mode;
- work-plane-local relative polar mode.

For work-plane-local modes, metadata should include:

- relative Cartesian offsets or polar angle/radius values;
- a snapshot of the work-plane-local frame:
  - origin;
  - `u`;
  - `v`;
  - normal;
- local start/end coordinates where needed, or enough information to compute them.

Important:

- do not rely on the current active UI work plane at export time;
- if active work plane changes, existing curve export meaning remains stable;
- storing a frame snapshot on an individual curve is allowed because it is persistent export metadata for that curve;
- this is not the same as storing active UI work-plane state globally in `Diagram`.

## Conversion formulas

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

The first control offset is relative to the start point. The second control offset is relative to the end point.

## Creation/editing integration

When a cubic Bézier is created or edited using work-plane-local relative controls:

- absolute control points are computed and stored/available;
- work-plane-local metadata is stored;
- SVG rendering uses absolute geometry;
- TikZ export can later use metadata;
- invalid angle/radius/offset/frame input is rejected.

If direct handle dragging changes relative control geometry, choose and document one policy:

Preferred:

- keep the same frame and recompute relative Cartesian/polar values where practical.

Acceptable:

- switch the curve to absolute control mode after direct handle dragging.

## Save/load compatibility

If the cubic Bézier model changes:

- existing saved diagrams without metadata still load;
- missing metadata defaults to absolute mode;
- new metadata round-trips safely;
- invalid metadata is rejected or normalized;
- undo/redo handles metadata as diagram data.

## Tests

Add focused tests:

1. Relative Cartesian metadata stores frame snapshot and offsets.
2. Relative polar metadata stores frame snapshot and angle/radius values.
3. Absolute control points are computed correctly from Cartesian metadata.
4. Absolute control points are computed correctly from polar metadata.
5. The second control is relative to the end point.
6. Local start/end coordinates are computed or stored consistently.
7. Export meaning does not depend on active work plane changing after creation.
8. Old diagrams without metadata default to absolute.
9. Metadata round-trips through save/load.
10. Invalid metadata is handled safely.
11. Handle dragging policy is tested if practical.
12. SVG rendering remains based on absolute geometry.

## Documentation

Update docs:

- data model for Bézier control mode metadata;
- frame snapshot purpose;
- difference between active UI work-plane state and persistent curve-level metadata;
- conversion formulas;
- handle dragging policy.

## Preserve existing behavior

Do not regress:

- absolute Bézier behavior;
- 2D relative Bézier behavior;
- SVG rendering;
- drag handles;
- direct creation;
- save/load existing diagrams;
- undo/redo;
- TikZ export before Phase 12J.

## Report after implementation

Please report:

- files modified;
- metadata shape;
- conversion formulas;
- handle dragging policy;
- save/load compatibility;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
