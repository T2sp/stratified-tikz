# Phase 20C Implementation Prompt: Coons patch creation, SVG preview, and TikZ export

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

Add user-facing creation, SVG preview, and TikZ export for Coons patches from four boundary paths.

A Coons patch interpolates four boundary curves and is useful for cornered curved sheet regions.

## Prerequisites

Phases 20A and 20B are complete.

## Scope

Implement:

- UI workflow to create Coons patch from four boundary paths;
- corner compatibility validation;
- copy-on-create behavior;
- SVG mesh preview;
- TikZ mesh export;
- inspector basics;
- tests.

Do not implement:

- automatic visibility/depth sorting;
- advanced corner repair;
- boolean operations;
- live linked boundaries.

## Creation workflow

Preferred MVP:

```text
Create Coons patch
Pick bottom boundary
Pick right boundary
Pick top boundary
Pick left boundary
Sampling u/v
Create
```

Requirements:

- four valid boundary paths required;
- user-facing order must be clear;
- corner compatibility validated;
- copied boundary geometry stored;
- source paths unchanged;
- created object selected;
- creation undoable.

If users pick paths in arbitrary order, require manual role assignment.

## Corner validation

Required matches:

- bottom start = left start;
- bottom end = right start;
- top start = left end;
- top end = right end.

Use existing vector tolerance.

Reject inconsistent corners with clear status.

## SVG/TikZ

Use sampled mesh/quads.

Requirements:

- style/layer preserved;
- deterministic output;
- finite output;
- comments identify Coons patch;
- inline math no blank lines;
- 4-space indentation.

## Inspector

MVP:

- name;
- layer;
- style;
- u/v sampling;
- read-only boundary role summary.

## Tests

Add tests:

1. Create Coons patch from four compatible boundaries.
2. Inconsistent corners rejected.
3. Boundaries copied, not live-linked.
4. SVG mesh produced.
5. TikZ mesh output produced.
6. Style/layer preserved.
7. Sampling edit updates mesh if implemented.
8. Save/load round-trip.
9. Undo/redo if testable.
10. Inline no blank lines.

## Documentation

Document Coons patch creation, boundary order, corner requirements, and limitations.

## Report after implementation

Please report:

- files modified;
- creation workflow;
- boundary role order;
- validation policy;
- rendering/export strategy;
- tests added/updated;
- test results;
- build results;
- limitations.
