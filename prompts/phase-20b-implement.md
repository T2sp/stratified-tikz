# Phase 20B Implementation Prompt: Ruled surface creation, SVG preview, and TikZ export

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

Add user-facing creation, SVG preview, and TikZ export for ruled surfaces from two boundary paths.

A ruled surface connects two boundary curves by straight rulings:

```text
S(u, v) = (1 - v) C0(u) + v C1(u)
```

## Prerequisites

Phase 20A is complete.

## Scope

Implement:

- UI workflow to create ruled surface from two selected/picked boundary paths;
- copy-on-create behavior;
- SVG mesh preview;
- TikZ mesh export;
- inspector basics;
- tests.

Do not implement:

- Coons patch UI/export; that is Phase 20C;
- automatic visibility/depth sorting; later subphases;
- advanced surface editing;
- boolean operations;
- live linked boundaries.

## Creation workflow

Preferred MVP:

```text
Create ruled surface
Pick boundary path 1
Pick boundary path 2
Sampling segments
Create
```

Requirements:

- two valid boundary paths required;
- copied boundary geometry stored in new surface;
- source paths remain unchanged;
- no live linking;
- created object selected;
- creation undoable;
- invalid source selection rejected safely.

If general multi-selection exists, use selected paths. Otherwise, add local picking workflow.

## SVG preview

Render sampled mesh/quads.

Requirements:

- fill/stroke/opacity style respected;
- layer respected;
- selected highlight works;
- mesh faces finite;
- default sampling modest;
- no preview-only state saved.

## TikZ export

Export ruled surface as sampled mesh faces.

Requirements:

- layer-aware output;
- finite coordinates;
- style preserved;
- comments identify ruled surface and sampling;
- deterministic output;
- inline math no blank lines;
- 4-space indentation.

Optional future-friendly comment:

```tex
% Ruled surface generated from two boundary paths.
```

Do not depend on `tikz-3dtools`.

## Inspector

MVP inspector:

- name;
- layer;
- style;
- sampling segments;
- read-only boundary summary.

Optional:

- boundary replacement.

## Tests

Add tests:

1. Create ruled surface from two valid paths.
2. Source paths unchanged.
3. Boundaries copied.
4. Invalid boundary selection rejected.
5. SVG mesh produced.
6. TikZ mesh output produced.
7. Style/layer preserved.
8. Sampling edit updates mesh if implemented.
9. Undo/redo creation if testable.
10. Save/load round-trip.
11. Inline output no blank lines.

## Documentation

Document ruled surface creation and limitations.

## Report after implementation

Please report:

- files modified;
- creation workflow;
- rendering strategy;
- TikZ export strategy;
- copy-on-create behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
