# Phase 16D Implementation Prompt: Layer translation

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

Phase 15 is complete. The editor has enough core geometry features to draw useful 2D/3D stratified diagrams.

Phase 16 focuses on a Layer Manager.

The app already has:

- layer values on strata and labels;
- layer-aware TikZ output;
- layer filtering;
- creation layer controls;
- selection;
- undo/redo;
- save/load;
- SVG preview;
- TikZ export;
- many geometric kinds:
  - points;
  - labels;
  - polylines;
  - cubic Béziers;
  - concatenated paths;
  - arc/circle/ellipse path templates if implemented;
  - polygon sheets;
  - filled regions;
  - work-plane-filled sheets;
  - curved sheet primitives such as hemispheres/saddles if implemented.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Layer metadata should be diagram data if it is part of saved/opened diagrams.
- Current selected layer filter and UI-expanded/collapsed state should remain UI/editor state.
- Layer operations that modify diagram elements must be undoable.
- Generated TikZ should preserve Phase 9B layer-aware output.
- Do not break save/load of older diagrams without explicit layer metadata.


## Goal

Implement layer-level translation.

Users should be able to translate all elements on a layer by a vector while preserving their relative positions.

## Prerequisites

Phases 16A-16C are complete.

## Scope

Implement:

- translation helper for all elements on a layer;
- UI for entering translation vector;
- undo/redo integration;
- tests.

Do not implement:

- rotation/scale/affine transform;
- multi-selection;
- snapping;
- animation.

## UI

Add Layer Manager operation:

```text
Translate layer
```

For 2D diagrams:

```text
dx
dy
```

For 3D diagrams:

```text
dx
dy
dz
```

Optional:

- active work-plane local translation `(a,b)` in 3D.
- This is nice but not required.

MVP should support global translation vector.

## Translation semantics

Translation must move all renderable elements on the selected layer.

Targets:

- point positions;
- label positions;
- ordinary curve points;
- concatenated path segment coordinates;
- arc/circle/ellipse template centers and relevant frame origins;
- polygon sheet vertices;
- filled region boundaries;
- work-plane-filled sheet boundaries and plane frame origin;
- curved sheet primitive centers/origins/frames;
- any persistent work-plane-local Bézier frame snapshots belonging to moved curves.

Rules:

- add translation vector to all absolute coordinates;
- preserve relative geometry;
- preserve style;
- preserve layer value;
- preserve ids;
- preserve names;
- preserve path labels.

Important for metadata:

- If a curve or surface stores a frame snapshot, translate the frame origin by the same vector.
- Do not rotate/scale frame basis vectors.
- Relative/local coordinates should remain unchanged when frame origin and absolute points are translated consistently.

2D:

- only dx/dy editable;
- z remains 0;
- translating by dz is not allowed.

Validation:

- dx/dy/dz finite;
- no resulting coordinate becomes non-finite;
- invalid input does not modify diagram.

## Undo/redo

Layer translation is one diagram edit.

One undo should revert the entire layer translation.

## Tests

Add tests:

1. Translate layer moves points.
2. Translate layer moves labels.
3. Translate layer moves polylines/cubic curves.
4. Translate layer moves concatenated paths including arc/circle/ellipse templates.
5. Translate layer moves polygon sheets.
6. Translate layer moves filled regions/sheets.
7. Translate layer moves curved sheet primitives if present.
8. Frame origins updated, basis vectors unchanged.
9. Elements on other layers unchanged.
10. 2D translation keeps z = 0.
11. Non-finite translation rejected.
12. Undo/redo translation if testable.
13. SVG/TikZ update after translation.

## Documentation

Document translation semantics and coverage.

## Preserve existing behavior

Do not regress:

- duplicate/delete;
- path editing;
- fill/surface geometry;
- save/load;
- undo/redo;
- SVG/TikZ output.

## Report after implementation

Please report:

- files modified;
- UI behavior;
- translation helper coverage;
- metadata/frame handling;
- tests added/updated;
- test results;
- build results;
- limitations.
