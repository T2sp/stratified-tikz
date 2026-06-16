# Phase 12B Implementation Prompt: Custom work plane from origin + normal

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

Add 3D-only UI/state support for applying a custom work plane from numeric origin and normal vector, using the Phase 12A helpers.

## Prerequisite

Phase 12A is complete.

## Scope

Implement only the origin+normal UI/workflow.

Do not implement:

- three numeric points UI;
- existing point-strata picking;
- custom plane preview beyond any existing minimal indicator;
- TikZ `3d` scope export;
- full camera controls.

## Required implementation

Add a 3D-only UI for defining a custom plane by origin and normal:

```text
Custom plane by origin + normal
Origin: x, y, z
Normal: nx, ny, nz
Apply
```

Requirements:

- finite numeric values only;
- zero normal is rejected;
- invalid input shows concise error/status and does not corrupt current work-plane state;
- successful apply sets active work plane to a constructed custom plane;
- active work-plane state remains UI/editor state only;
- hide/disable this UI in 2D diagrams;
- switching to 2D should reset or validate active work-plane state;
- existing `xy`, `xz`, `yz` controls remain available.

The created custom plane should have a readable name, such as `Custom plane`.

## Tests

Add tests where practical for:

- valid origin+normal UI application;
- zero normal rejection;
- non-finite input rejection;
- invalid input leaves previous active work plane unchanged;
- UI hidden/disabled in 2D if testable.

## Documentation

Update UI/editor docs briefly.

## Report

Report files modified, UI location, validation behavior, state reset/validation on dimension switch, tests, test results, build results, and limitations.
