# Phase 12C Implementation Prompt: Custom work plane from three numeric points

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

Add 3D-only UI/state support for applying a custom work plane from three finite non-collinear numeric points.

## Prerequisite

Phases 12A and 12B are complete.

## Scope

Implement only the three-numeric-points work-plane workflow.

Do not implement:

- existing point-strata picking;
- TikZ `3d` scope export;
- full camera controls.

## Required implementation

Add a 3D-only UI for defining a custom plane by three numeric points:

```text
Custom plane by 3 points
P0: x, y, z
P1: x, y, z
P2: x, y, z
Apply
```

Requirements:

- finite coordinates only;
- coincident input rejected;
- collinear input rejected;
- invalid input shows concise error/status and does not corrupt current work-plane state;
- successful apply sets active work plane;
- use `P0` as origin;
- use `P1 - P0` as preferred `u` direction;
- active work-plane state remains UI/editor state only;
- hide/disable this UI in 2D diagrams.

## Tests

Add tests where practical for:

- valid non-collinear points apply a custom plane;
- `P0` is origin;
- `P1 - P0` determines `u`;
- collinear input rejected;
- coincident input rejected;
- non-finite input rejected;
- invalid input leaves previous active work plane unchanged.

## Documentation

Update docs briefly.

## Report

Report files modified, UI location, validation behavior, tests, test results, build results, and limitations.
