# Phase 21E Implementation Prompt: Ibis Paint-style Layer window

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

Phase 20 is complete.

The editor now supports:

- 2D and 3D diagrams;
- custom work planes;
- camera controls;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- symbolic variables and coordinate expressions;
- grids;
- paths, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches, and auto visibility;
- save/load;
- undo/redo;
- SVG preview;
- TikZ source generation.

Phase 21 is a major UI overhaul.

The attached reference mockup has the overall idea:

- compact top panels for Example/File/TikZ style/Variable editor/Work plane selector;
- a large SVG Preview area;
- a floating toolbar inside the top of SVG Preview;
- Undo/Redo as translucent preview-overlay buttons;
- compact Inspector/Layer/Camera buttons around the preview;
- TikZ Source below the preview area.

Important constraints:

- This is UI/layout work unless explicitly stated.
- Do not change diagram data model unless a UI state field truly must persist.
- Do not change TikZ generation semantics.
- Do not change SVG rendering geometry semantics.
- UI overlay state is editor/UI state, not `Diagram`.
- Preserve save/load, undo/redo, camera, work-plane, layer manager, style manager, symbolic input, grid, auto-visibility, and all geometry behavior.


## Goal

Replace the current Layer Manager presentation with a compact Ibis Paint-style layer window launched from the SVG Preview.

## Requirements

- Current toolbar `Layer` and `New element layer` controls must be integrated into the Layer Manager.
- SVG Preview lower-right shows a compact Layer button.
- Before expansion, the Layer button displays:

```text
new element layer / total layer count
```

Example:

```text
2 / 7
```

- Clicking the Layer button expands a layer window.
- The layer window contains small layer previews.
- New element layer selection is done graphically in the layer window.
- Layer swap/reorder is done by cursor dragging in the layer window.
- Rename / duplicate / translation are available only for the selected layer, via expandable buttons at the edge of the layer window.
- Delete and visibility/lock controls remain accessible according to existing layer manager behavior.
- Existing layer operations semantics must not change.

## Scope

Implement:

- compact preview Layer button;
- floating Layer window inside/over SVG Preview;
- layer thumbnails/previews;
- graphical new element layer selection;
- drag-to-swap/reorder layer rows;
- selected-layer action toolbar;
- integration/removal of old toolbar Layer/New element layer controls.

Do not implement:

- full raster layer previews;
- pixel-level thumbnails;
- multi-selection;
- new layer operation semantics;
- new geometry features;
- new dependencies.

## Layer button

Location:

- lower-right of SVG Preview, compact.

Display:

```text
<newElementLayer>/<totalLayerCount>
```

If layer value and layer index differ, choose a clear display:

- value/count; or
- index/count with layer value/name in tooltip.

Preferred:

- show new element layer value and total count:

```text
L2 / 7
```

or compact equivalent.

Clicking toggles layer window.

The button must not interfere with camera button; if both are lower-right, stack them.

## Layer window

Visual style:

- floating panel;
- semi-transparent or solid light background;
- compact;
- scrollable if many layers;
- resembles a drawing app layer palette.

Contents per layer row:

- thumbnail/preview;
- layer name;
- layer value;
- element count;
- visibility/lock indicators;
- selection highlight if it is the new element layer;
- maybe currently filtered/active indicator.

## Layer thumbnails

Implement small layer previews.

MVP acceptable:

- render a tiny simplified SVG snapshot of elements on that layer;
- or show colored/style swatch plus element count if true thumbnail is too large.

Preferred:

- use existing projection/helpers to render simplified layer-only thumbnail;
- cap complexity for performance;
- do not create large nested full SVGs if expensive.

Requirements:

- thumbnails are preview-only;
- no interaction inside thumbnail except selecting row;
- no TikZ/export effect.

## Graphical new element layer selection

Clicking a layer row should set `newElementLayer`.

Requirements:

- current new element layer visually highlighted;
- creation tools use that layer;
- old toolbar `New element layer` control removed or hidden;
- layer filter behavior remains separate unless intentionally combined;
- existing inspector layer editing still works.

## Drag-to-swap/reorder

Implement drag reorder in the layer window.

Interpretation:

- dragging one layer row over another triggers existing layer swap/reorder operation.
- Preserve existing `swapDiagramLayers` semantics from Phase 16:
  - all elements on the two layers swap layer values;
  - metadata stays coherent according to existing policy;
  - undo/redo works.

MVP:

- drag start row;
- drop on target row;
- perform swap.

Do not implement complex animated reorder if not needed.

Requirements:

- drag operation does not corrupt diagram;
- cannot drop on invalid target;
- undo/redo one operation;
- layer window updates;
- TikZ/SVG update.

If implementing HTML5 drag/drop is too flaky, use up/down buttons as fallback but still keep prompt goal. Report limitation.

## Selected-layer action toolbar

Layer window should have edge buttons for operations on selected layer.

Operations:

- rename;
- duplicate;
- translate;
- delete;
- visibility/lock if implemented.

Requirement:

- actions apply only to currently selected layer row;
- action controls are hidden/collapsed until user expands them;
- avoid showing huge forms for every layer row;
- reuse existing operation forms where possible;
- old Layer Manager functionality preserved.

## Tests

Add tests where practical:

1. Layer button displays new layer / total count.
2. Clicking layer row changes new element layer.
3. New element layer control no longer required in toolbar.
4. Drag/drop swap calls existing swap helper with correct values if helper-testable.
5. Selected-layer actions operate on selected layer only.
6. Duplicate/delete/rename/translate existing helper tests still pass.
7. Layer window open state is UI-only.
8. TikZ output unaffected by window open/closed state.
9. Thumbnail helper handles empty layer and many elements safely.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Old toolbar Layer/New element layer controls are gone or minimized.
2. Layer button appears lower-right in Preview.
3. Button shows current new layer / total layers.
4. Click button opens Layer window.
5. Click a layer row.
6. New element layer changes.
7. Create a point/path; confirm it appears on selected layer.
8. Drag one layer row onto another.
9. Confirm layers swap/reorder.
10. Undo/redo swap.
11. Select a layer and expand action buttons.
12. Rename/duplicate/translate/delete in test diagram.
13. Confirm thumbnails/previews remain responsive.

## Preserve existing behavior

Do not regress:

- Layer Manager operations;
- layer filtering;
- visibility/locking;
- creation layer semantics;
- inspector layer editing;
- TikZ layer output;
- save/load;
- undo/redo;
- SVG preview;
- pointer interactions.

## Report after implementation

Please report:

- files modified;
- Layer button behavior;
- layer window layout;
- thumbnail strategy;
- new element layer selection behavior;
- drag-to-swap implementation;
- selected-layer action behavior;
- removed/hidden old toolbar controls;
- tests added/updated;
- test results;
- build results;
- limitations.
