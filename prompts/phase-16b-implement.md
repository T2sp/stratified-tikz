# Phase 16B Implementation Prompt: Layer rename and layer swap/reorder

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

Implement basic Layer Manager editing operations:

- rename layer;
- swap two layers;
- optionally reorder layer metadata display.

This subphase should not duplicate/delete/translate layer contents yet.

## Prerequisites

Phase 16A is complete.

## Scope

Implement:

- layer rename;
- layer swap;
- deterministic layer manager ordering/display;
- undo/redo integration for diagram-changing operations;
- tests.

Do not implement yet:

- layer duplicate;
- layer delete;
- layer translation;
- visibility/lock controls;
- multi-selection.

## Rename layer

Add UI to rename a layer.

Requirements:

- layer value remains unchanged;
- only metadata name changes;
- blank names rejected or replaced with safe default;
- duplicate names allowed or rejected according to a clear policy.
  - Preferred: allow duplicate names but always show numeric value for disambiguation.
- undo/redo works;
- save/load preserves renamed layer;
- TikZ output may optionally use layer names in comments, but do not change TikZ layer identifiers unless already designed.

## Swap layers

Add UI to swap two numeric layers.

Interpretation:

Swapping layer A and layer B should exchange the layer membership of all elements on those layers.

For all strata and labels:

```text
if layer === A, set layer = B
if layer === B, set layer = A
```

Metadata should remain coherent.

Preferred behavior:

- swap metadata names along with values, so the visual layer identities appear swapped;
- or keep names tied to numeric values, but clearly document behavior.

Choose one consistent policy and test it.

Requirements:

- all strata on A/B updated;
- all labels on A/B updated;
- no other layers changed;
- selected element remains selected if it still exists;
- layer filter is validated or updated if needed;
- undo/redo treats swap as one operation;
- TikZ layer output changes accordingly.

## Reorder display

Layer list should be deterministic.

Preferred default:

- sort by numeric layer value ascending.

If manual display order is implemented:

- it should not change element layer values unless explicitly swapping;
- do not confuse display order with TikZ numeric layer order unless designed.

MVP can keep numeric order only.

## Tests

Add tests:

1. Rename layer updates metadata only.
2. Rename rejects blank name or defaults safely.
3. Rename persists through save/load.
4. Swap updates strata on both layers.
5. Swap updates labels on both layers.
6. Swap leaves other layers unchanged.
7. Swap updates/maintains metadata according to chosen policy.
8. Swap is undoable/redone as one operation if testable.
9. TikZ output layer membership reflects swapped layers.
10. Layer list ordering deterministic.

## Documentation

Update docs:

- rename behavior;
- swap behavior;
- whether names follow numeric values or visual layer identity.

## Preserve existing behavior

Do not regress:

- layer metadata foundation;
- layer filter;
- creation layer;
- inspector layer editing;
- save/load;
- undo/redo;
- TikZ output.

## Report after implementation

Please report:

- files modified;
- rename behavior;
- duplicate-name policy;
- swap behavior;
- metadata-name policy during swap;
- tests added/updated;
- test results;
- build results;
- limitations.
