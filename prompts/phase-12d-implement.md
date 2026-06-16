# Phase 12D Implementation Prompt: Custom work plane from three existing point strata

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

Add a UI workflow for picking/selecting three existing point strata and constructing a custom work plane from their positions.

## Prerequisite

Phases 12A-12C are complete.

## Scope

Implement point-strata picking for work-plane construction.

Do not implement:

- general multi-selection as a broad feature unless needed;
- curve/sheet vertex picking;
- TikZ `3d` scope export;
- full camera controls.

## Required implementation

Add a workflow such as:

```text
Pick 3 points for work plane
Picked 0/3
Cancel / Reset
Apply
```

Preferred behavior:

- activate a work-plane point-picking mode;
- clicking point strata records their IDs;
- require three distinct point strata;
- show status like `Picked 2/3 points`;
- allow cancel/reset;
- construct plane from the selected point positions;
- reject duplicate picks;
- reject collinear point positions;
- picking state is UI state only;
- ordinary selection should not be corrupted;
- creation tools should not accidentally add geometry while picking mode is active.

Only point strata are required for this subphase. Labels, curve vertices, and sheet vertices may be excluded.

If selected point strata are deleted or undone while picking, validate/clear stale picks.

## Tests

Add tests where practical for:

- picking three distinct point strata creates a custom plane;
- duplicate picks rejected;
- collinear point positions rejected;
- cancel/reset clears picking state;
- picking mode does not create ordinary geometry;
- stale point IDs are cleared/validated.

## Documentation

Document the point-picking workflow briefly.

## Report

Report files modified, UI workflow, stale-state handling, tests, test results, build results, and limitations.
