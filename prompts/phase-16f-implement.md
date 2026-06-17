# Phase 16F Implementation Prompt: Layer Manager polish and regression hardening

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

Polish and harden the Layer Manager after core operations are implemented.

This subphase should improve usability, documentation, tests, and edge-case behavior.

## Prerequisites

Phases 16A-16E are complete.

## Scope

Implement:

- UI polish;
- operation confirmations/status messages;
- consistency checks;
- test coverage for combined operations;
- documentation updates.

Do not implement:

- multi-selection;
- affine transforms;
- layer style overrides;
- new geometry features.

## UI polish

Improve Layer Manager usability:

- clear active layer indication;
- element counts;
- operation buttons grouped by risk:
  - safe: rename, visibility;
  - destructive: delete;
- confirmation for delete layer;
- concise status messages;
- disabled states for invalid operations;
- responsive layout.

## Combined-operation hardening

Add tests for operation sequences:

1. rename → save/load;
2. duplicate → translate duplicated layer;
3. swap → delete one layer;
4. hide → selection clear;
5. duplicate → TikZ output;
6. translate → undo → redo;
7. delete → undo → save/load.

## Validation sweep

Add helper or tests ensuring:

- no duplicate element IDs after duplicate layer;
- no stale layer metadata after delete;
- no selected deleted element;
- no hidden selected element;
- no non-finite coordinates after translation;
- TikZ generation does not throw after every layer operation.

## Documentation

Update docs:

- layer manager overview;
- rename/swap/duplicate/delete/translate/visibility semantics;
- undo/redo behavior;
- TikZ export behavior;
- save/load behavior.

## Report after implementation

Please report:

- files modified;
- UI polish changes;
- status/confirmation behavior;
- combined-operation tests;
- docs updated;
- test results;
- build results;
- remaining limitations.
