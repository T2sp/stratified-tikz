# Phase 16E Implementation Prompt: Layer visibility, locking, and filter integration

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

Add layer-level visibility and optional locking controls to the Layer Manager.

This improves editing dense 3D diagrams without changing geometry.

## Prerequisites

Phases 16A-16D are complete.

## Scope

Implement:

- layer visibility toggle;
- optional layer lock toggle;
- integration with SVG preview and selection;
- integration with current layer filter;
- tests.

Do not implement:

- layer opacity overrides;
- style overrides by layer;
- multi-selection;
- geometry transforms.

## Visibility

Add metadata/UI state for layer visibility.

Design choice:

- If visibility is intended to persist with the diagram, store in layer metadata.
- If visibility is purely temporary editor state, store as UI state.

Preferred:

- store layer visibility in diagram view/editor options or layer metadata if users expect save/load.
- Do not affect TikZ export unless an explicit export option exists.

Behavior:

- hidden layer elements are not shown in SVG preview;
- hidden layer elements are not selectable;
- hidden layer elements still exist in diagram data;
- TikZ output should still include hidden layers by default unless user explicitly chooses export-visible-only.

MVP:

- preview/editor visibility only;
- TikZ unaffected.

## Locking

Optional but useful.

Layer lock behavior:

- locked layer elements remain visible;
- locked layer elements are not selectable/editable by canvas or inspector operations;
- layer-level operations can still unlock/modify them if explicit.

If locking is too large, implement visibility only and document limitation.

## Filter integration

Existing layer filter should remain coherent.

Rules:

- active filter and visibility should combine sensibly;
- if a selected element becomes hidden, clear selection;
- creation layer should not silently create into hidden layer unless filter/visibility is updated.

## Tests

Add tests:

1. Hidden layer not rendered in SVG.
2. Hidden layer not selectable.
3. Hidden layer still exported to TikZ by default.
4. Selection cleared when selected layer hidden.
5. Visibility save/load if persisted.
6. Locked layer not editable/selectable if implemented.
7. Layer filter and visibility combine predictably.
8. Undo/redo policy tested if visibility is diagram state.

## Documentation

Document visibility/lock semantics and TikZ export policy.

## Preserve existing behavior

Do not regress:

- layer filter;
- creation layer;
- layer manager operations;
- SVG/TikZ output;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- visibility state persistence policy;
- TikZ export policy;
- locking implemented or deferred;
- filter integration;
- tests added/updated;
- test results;
- build results;
- limitations.
