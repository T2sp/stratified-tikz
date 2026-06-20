# Phase 20H Implementation Prompt: Auto-visibility TikZ export hardening and docs

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

Harden TikZ export, performance, and documentation for Phase 20 auto-visibility and boundary surfaces.

This is the polish/regression subphase.

## Prerequisites

Phases 20A-20G are complete.

## Scope

Implement:

- TikZ export hardening for sorted surfaces and hidden curves;
- inline math formatting preservation;
- performance caps;
- docs;
- reference examples/tests.

Do not implement:

- exact occlusion algorithm;
- external dependency on tikz-3dtools;
- LuaLaTeX export mode unless clearly optional and documented.

## TikZ export requirements

When auto visibility is enabled:

- sorted surface faces output in correct order;
- hidden curve segments output with hidden style;
- visible curve segments output with normal style;
- point/label visibility follows options;
- comments explain auto visibility sections;
- no NaN/Infinity;
- layer-aware output preserved;
- 4-space indentation preserved;
- inline math no blank lines preserved;
- standalone output readable.

When disabled:

- output should remain equivalent to prior manual/layer-based output.

## Performance

Add caps/settings:

- max surface faces considered for sorting;
- max curve samples;
- depth epsilon;
- warning/status if sampling too high.

Do not freeze editor/export on large diagrams.

## Documentation

Update docs:

- ruled surfaces;
- Coons patches;
- auto depth sorting;
- curve hidden segment approximation;
- painter's algorithm limitations;
- layer/depth priority;
- no dependency on tikz-3dtools;
- possible future enhanced LuaLaTeX/lua-tikz3dtools export mode.

## Reference examples

Add examples if appropriate:

- ruled surface with curve passing behind it;
- Coons patch;
- translucent surfaces sorted by depth;
- hidden curve dotted behind sheet.

## Tests

Add combined tests:

1. Ruled surface + hidden curve exports sorted/hidden commands.
2. Coons patch exports finite mesh.
3. Auto visibility disabled preserves old output.
4. Auto visibility enabled changes output deterministically.
5. Inline output no blank lines.
6. 4-space indentation retained.
7. No NaN/Infinity in representative output.
8. Large sampling rejected or capped.
9. Layer manager output still valid.
10. Save/load visibility options and surfaces round-trip.

## Report after implementation

Please report:

- files modified;
- export hardening;
- performance caps;
- docs updated;
- examples added;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
