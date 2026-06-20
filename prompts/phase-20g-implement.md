# Phase 20G Implementation Prompt: Point/label visibility options and auto-visibility UI

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

Also run if available:

```bash
git diff --check
```
## Project context

You are working on the StratifiedTikZ project.

Phase 19 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- custom work planes;
- camera controls and tikz-3dplot-compatible export;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- symbolic variables and coordinate expressions;
- grids;
- paths, filled regions/sheets, curved surfaces, and path templates.

Phase 20 adds two related capabilities:

1. More flexible 3D surface construction:
   - ruled surfaces from two boundary paths;
   - Coons patches from four boundary paths.

2. Approximate automatic 3D visibility:
   - projected render primitives;
   - surface face depth sorting;
   - curve hidden/visible segmentation behind surfaces;
   - optional point/label visibility behavior;
   - TikZ export matching the SVG preview as much as practical.

This phase is inspired by ideas such as screen depth / z-sorting / occlusion found in TikZ/PGF 3D tooling. However, do not make StratifiedTikZ depend on `tikz-3dtools` or LuaLaTeX packages in the MVP. The editor should compute visibility in TypeScript so SVG preview and generated TikZ stay aligned.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- In 3D:
  - sheets are codim 1;
  - curves are codim 2;
  - points are codim 3.
- Internally all coordinates are `Vec3`.
- Work planes are model-space editing aids.
- Camera/projection and work planes are separate concerns.
- Automatic visibility should be approximate and optional.
- Manual layer order must remain available.
- Generated TikZ must remain readable.
- Inline math export must still have no blank lines.
- Indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, and all existing geometry behavior.


## Goal

Add user-facing controls for approximate 3D visibility behavior and implement point/label visibility options.

Surface sorting and curve occlusion exist from earlier subphases.

This subphase adds:

- UI for auto visibility options;
- point occlusion/dimming;
- label policy;
- integration with layer manager.

## Prerequisites

Phases 20D-20F are complete.

## Scope

Implement:

- visibility options UI;
- point hidden/dim behavior;
- label visibility policy;
- persistence policy for visibility options;
- tests.

Do not implement:

- exact hidden-surface algorithm;
- complex label layout;
- curve occlusion algorithm changes beyond integration.

## UI

Add a compact control section:

```text
3D Visibility
  [ ] Auto depth-sort surfaces
  [ ] Auto hide/dot curves behind sheets
  [ ] Dim hidden points
  Label visibility: Always foreground / Auto dim / Auto hide
  Sort mode: Layer then depth / Depth then layer
  Hidden curve style: dotted / densely dotted / dashed
  Depth epsilon
  Sampling resolution
```

MVP may expose fewer controls but should at least include:

- enable/disable auto visibility;
- surface depth sort;
- curve occlusion;
- hidden curve style;
- point dim/hide option;
- label policy.

## Persistence

Decide whether visibility options are:

- editor view state only; or
- diagram view/export options.

Preferred:

- persist as diagram view/export options if they affect generated TikZ.
- old diagrams default to disabled/conservative behavior.

## Point visibility

Approximate point occlusion:

- project point;
- compare against surface faces like curve midpoint;
- if hidden, dim or hide according to option.

MVP default:

- dim hidden points, not hide.

## Label visibility

MVP default:

- labels always foreground.

Optional user policy:

- always foreground;
- dim when hidden;
- hide when hidden.

If implementing label auto visibility, use label anchor point for occlusion.

## Layer integration

Visibility should not override manual layer semantics unexpectedly.

Default sort mode:

- layer then depth.

Layer filter/visibility/locking from Layer Manager should remain respected.

## Tests

Add tests:

1. Visibility options default disabled/conservative.
2. Enabling options changes render/export behavior.
3. Hidden point dimmed/hidden according to option.
4. Labels always foreground by default.
5. Label auto mode works if implemented.
6. Sort mode stored/validated.
7. Hidden curve style option affects output.
8. Save/load visibility options if persisted.
9. Old diagrams load.
10. Layer filter still respected.

## Documentation

Document auto visibility options and approximation limitations.

## Report after implementation

Please report:

- files modified;
- UI controls;
- persistence policy;
- point visibility behavior;
- label visibility behavior;
- layer integration;
- tests added/updated;
- test results;
- build results;
- limitations.
