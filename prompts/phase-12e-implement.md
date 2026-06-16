# Phase 12E Implementation Prompt: Custom work-plane preview and creation integration

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

Render custom work-plane previews and ensure cursor creation works on active custom planes.

## Prerequisite

Phases 12A-12D are complete.

## Scope

Implement custom plane preview and cursor creation on custom planes.

Do not implement:

- TikZ `3d` scope export;
- full camera controls;
- plane-local direct coordinates as a large feature.

## Required implementation

Render a visible guide for the active custom plane.

Requirements:

- preview-only;
- not selectable;
- does not intercept pointer events;
- not stored in `Diagram`;
- not exported to TikZ;
- visually distinct from real sheet strata;
- shown only in 3D when custom plane is active.

Suggested preview elements:

- translucent plane patch;
- outline;
- origin marker;
- optional `u`/`v` direction indicators;
- optional normal indicator;
- label such as `custom work plane`.

Cursor creation should work on active custom work planes in 3D:

- point;
- label;
- polyline;
- cubic Bézier;
- 3D polygon sheet.

Requirements:

- canvas clicks create/draft points on the active custom plane;
- created vertices lie on the active custom plane;
- committed geometry is ordinary `Vec3` diagram data;
- created geometry appears in SVG and TikZ;
- created geometry is selected according to existing creation behavior;
- layer selection/filter behavior remains correct.

Direct creation may remain global-coordinate based, but custom work-plane state must not break it.

## Tests

Add tests for:

- custom plane guide is preview-only/not exported if testable;
- guide does not intercept pointer events if testable;
- cursor-created point lies on active custom plane;
- at least one path-like creation test verifies committed vertices lie on custom plane;
- existing axis-aligned work-plane creation still works;
- direct creation still works.

## Documentation

Update docs about custom work-plane preview and creation behavior.

## Report

Report files modified, preview behavior, cursor creation integration, tests, test results, build results, and limitations.
