# Phase 16C Implementation Prompt: Layer duplicate and layer delete

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

Implement Layer Manager operations:

- duplicate a layer and all elements on it;
- delete a layer and all elements on it.

## Prerequisites

Phases 16A and 16B are complete.

## Scope

Implement:

- duplicate layer;
- delete layer;
- id regeneration for duplicated elements;
- metadata updates;
- selection/filter safety;
- undo/redo integration;
- tests.

Do not implement yet:

- layer translation;
- visibility/lock;
- multi-selection;
- linked/anchored references.

## Duplicate layer

Add UI operation:

```text
Duplicate layer
```

Behavior:

- choose source layer A;
- choose or auto-create target layer B;
- copy all elements on A to B;
- copied elements get new IDs;
- copied elements have `layer = B`;
- source elements remain unchanged;
- metadata for target layer created:
  - name can be `<source name> copy`;
  - value should be a finite unused layer value unless user chooses one.

Must include:

- all strata kinds currently supported;
- free text labels.

Element kinds to handle:

- point strata;
- ordinary curves;
- concatenated paths;
- arc/circle/ellipse template paths;
- polygon sheets;
- filled regions;
- work-plane-filled sheets;
- curved sheet primitives;
- future-compatible fallback for unknown strata should fail safely.

Copy semantics:

- deep clone geometry/style/metadata;
- regenerate IDs;
- do not keep source object IDs;
- if path labels / spath-save labels may collide, choose a safe policy:
  - append suffix;
  - clear copied path labels;
  - or disambiguate deterministically.
- report chosen policy.

## Delete layer

Add UI operation:

```text
Delete layer and elements
```

Behavior:

- remove all strata on that layer;
- remove all labels on that layer;
- remove layer metadata;
- clear selection if selected element was deleted;
- clear/validate drafts/source selections that reference deleted elements;
- validate layer filter if it was filtering deleted layer;
- undo/redo restores deleted elements and metadata.

Safety:

- require confirmation or a clear UI affordance if feasible;
- deletion is a diagram edit and must be undoable.

## Tests

Add tests:

1. Duplicate layer copies point strata with new IDs.
2. Duplicate layer copies labels with new IDs.
3. Duplicate layer copies curves/paths with deep geometry.
4. Duplicate layer copies sheets/filled objects/curved sheets if present.
5. Duplicated elements are on target layer.
6. Source layer unchanged.
7. Path label collision policy tested if applicable.
8. Delete layer removes all strata and labels on that layer.
9. Delete layer leaves other layers unchanged.
10. Delete clears stale selection.
11. Delete/duplicate metadata updates.
12. Undo/redo duplicate if testable.
13. Undo/redo delete if testable.
14. TikZ output reflects duplicate/delete.

## Documentation

Update docs for duplicate/delete behavior and path label policy.

## Preserve existing behavior

Do not regress:

- rename/swap;
- save/load;
- undo/redo;
- layer filter;
- TikZ output;
- SVG preview.

## Report after implementation

Please report:

- files modified;
- duplicate behavior;
- target layer selection/default policy;
- id regeneration strategy;
- path label collision policy;
- delete behavior;
- stale selection/filter handling;
- tests added/updated;
- test results;
- build results;
- limitations.
