# Phase 13D Implementation Prompt: Coordinate source highlighting

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

Phase 12 is complete.

The app now has:

- 2D and 3D diagrams;
- cursor creation and direct creation;
- custom work planes;
- work-plane-local Bézier support;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- selection, inspector, layer filtering, and style editing.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI/editor state should not be stored in `Diagram`.
- Preview-only guides and highlights should not be exported to TikZ unless explicitly requested by an export option.
- Generated TikZ must remain readable and should not include selection/editor-only state.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load and undo/redo behavior.


## Goal

Highlight selected coordinate sources in the SVG preview.

This should make it clear which point/vertex/source is currently selected in direct creation forms and in the Pick 3 points for work plane workflow.

## Scope

Implement preview-only highlighting for coordinate sources.

Do not implement:

- live linked vertices;
- multi-selection;
- layer manager;
- snapping;
- new geometry;
- broad UI redesign;
- new dependencies.

Do not change:

- source copy-on-create semantics;
- diagram data model;
- TikZ output;
- SVG rendering of committed geometry except preview highlights;
- save/load format.

## Highlight targets

Support highlights for coordinate sources used in direct creation:

- point stratum positions;
- polyline vertices;
- polygon sheet vertices;
- optional cubic Bézier start/control/end points if supported as sources.

Support highlights for Pick 3 points for work plane:

- picked point 1;
- picked point 2;
- picked point 3;
- active hover/candidate point if easy.

## Visual behavior

Highlights should be:

- preview-only;
- not selectable;
- not exported to TikZ;
- not stored in `Diagram`;
- visually distinct from ordinary selection highlight;
- visually distinct from work-plane guides;
- visible but not overwhelming.

Suggested styles:

- halo/ring around source coordinate;
- small marker;
- numbered marker for picked work-plane points: `1`, `2`, `3`;
- subtle different color/style from selected-element handles.

## Interaction behavior

Direct creation:

- when a source is selected in a direct creation form, highlight that source in the preview;
- if multiple fields have selected sources, highlight all active sources, preferably with role labels if easy;
- if source becomes invalid/deleted, remove or mark highlight safely.

Pick 3 points workflow:

- highlight already picked points;
- show numbering if possible;
- reset/cancel clears highlights.

Layer/filter behavior:

- if the source is hidden by layer filter, either still show the highlight if the source is relevant, or make the UI clearly indicate the source is hidden.
- Prefer not to silently hide the highlight for a selected source.

## Tests

Add focused tests for pure helpers if possible.

Good tests:

- selected point source produces highlight data;
- selected polyline vertex source produces highlight data;
- selected sheet vertex source produces highlight data;
- picked work-plane points produce numbered highlight data;
- invalid/missing source produces no crash;
- highlights are not included in TikZ output;
- highlights are not serialized to JSON.

Do not add React testing dependencies solely for visual styling.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open direct creation form.
2. Choose an existing point source.
3. SVG preview highlights that point.
4. Choose a polyline vertex source.
5. SVG preview highlights that vertex.
6. Choose a sheet vertex source in 3D.
7. SVG preview highlights that vertex.
8. Pick 3 points for work plane.
9. Each picked point is highlighted, ideally numbered.
10. Reset/cancel clears highlights.
11. Generate TikZ.
12. No highlights appear in TikZ.
13. Save JSON.
14. No highlight state is saved.

## Preserve existing behavior

Do not regress:

- direct creation;
- cursor creation;
- source copy-on-create;
- work-plane picking;
- selection highlight;
- geometry handles;
- SVG preview;
- TikZ output;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- highlight data representation;
- supported source kinds;
- visual style;
- work-plane picking highlight behavior;
- how highlights avoid TikZ/save output;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
