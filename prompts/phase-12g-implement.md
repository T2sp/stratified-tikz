# Phase 12G Implementation Prompt: Work-plane-local cubic Bézier metadata

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

Persist enough curve-level metadata so 3D relative Cartesian/polar Bézier controls can be exported in their work-plane-local 2D frame later.

## Prerequisite

Phases 12A-12F and Phase 11 relative Bézier controls are complete.

## Scope

Add/refine cubic Bézier metadata only.

Do not implement:

- TikZ `3d` scope export yet;
- new curve types;
- concatenated paths;
- full camera controls.

## Required implementation

For eligible 3D cubic Bézier curves with relative Cartesian or relative polar controls, store enough persistent metadata for later faithful work-plane-local export.

The curve should still store or derive absolute `Vec3` control points for rendering/editing.

Metadata should include:

- control mode:
  - absolute;
  - work-plane-local relative Cartesian;
  - work-plane-local relative polar;
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
- do not store transient active work-plane UI state globally in `Diagram`.

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

Handle dragging policy:

Choose and document one:

- preferred: keep the same frame and recompute relative values;
- acceptable: switch the curve to absolute mode after direct handle dragging.

Save/load:

- existing saved diagrams without metadata still load;
- missing metadata defaults to absolute mode;
- new metadata round-trips safely;
- invalid metadata is rejected or normalized.

## Tests

Add tests for:

- relative Cartesian metadata stores frame snapshot and offsets;
- relative polar metadata stores frame snapshot and angle/radius values;
- absolute control points are computed correctly;
- local start/end coordinates are computed or stored consistently;
- export meaning does not depend on active work plane;
- old diagrams without metadata default to absolute;
- metadata round-trips through save/load;
- invalid metadata is handled safely;
- handle dragging policy if practical.

## Documentation

Document the metadata model and distinction between curve-level export metadata and active UI work-plane state.

## Report

Report files modified, metadata shape, conversion formulas, handle dragging policy, save/load compatibility, tests, test results, build results, and limitations.
