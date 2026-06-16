# Phase 13B Implementation Prompt: Inspector layout stabilization

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

Stabilize inspector layout so selecting or creating elements does not push the SVG preview downward or cause large vertical layout jumps.

After element selection or creation, the inspector should appear in a compact/collapsed state by default.

Users should still be able to expand the inspector for coordinate/style editing.

## Scope

Implement:

- collapsed-by-default inspector behavior after selection/creation;
- compact inspector summary;
- stable preview layout;
- CSS/layout improvements for inspector panel height and scrolling.

Do not implement:

- work-plane toolbar reorganization; that is Phase 13C;
- layer manager;
- multi-selection;
- new geometry;
- broad app redesign;
- new dependencies.

Do not change:

- inspector editing semantics;
- selection semantics;
- diagram data model;
- SVG/TikZ output semantics.

## Required behavior

When an element is selected or newly created:

- inspector initially appears collapsed/compact;
- preview should not jump downward due to a huge inspector body;
- compact view should show enough summary to identify the selected element.

Example compact summary:

```text
Inspector
  Curve: Boundary [curve-3]
  Layer: 0
  [Expand]
```

or equivalent.

When expanded:

- existing coordinate editing works;
- existing style editing works;
- existing name/layer editing works;
- invalid input guards still work.

Preferred simple policy:

- on new selection or newly created element, collapse inspector;
- user can expand manually;
- if the same element remains selected and user expands it, avoid collapsing on every small edit.

Collapse/expand state is UI/editor state only.

Do not store it in `Diagram`.

## Layout stability

Improve layout so:

- SVG preview area remains visually stable;
- inspector details use internal scroll or max-height where needed;
- selecting/creating elements does not dramatically shift preview position;
- inspector layout remains usable on narrower screens.

Acceptable approaches:

- CSS grid/flex adjustments;
- max-height + overflow;
- collapsible sections;
- moving inspector to a stable side/bottom area if already compatible.

Avoid a full redesign.

## Tests

Add tests only if pure state helpers are introduced.

Good tests if applicable:

- inspector collapses on selection change;
- inspector collapses after newly created element is selected;
- expanded inspector remains usable for same selected element;
- collapse state is UI-only.

Do not add React testing dependencies solely for CSS.

## Documentation

Update UI notes if relevant.

## Preserve existing behavior

Do not regress:

- selection;
- inspector editing;
- style editing;
- direct/cursor creation;
- source highlighting;
- save/load;
- undo/redo;
- SVG preview;
- TikZ output.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Select an existing element.
2. Inspector appears compact/collapsed.
3. Preview does not jump down significantly.
4. Expand inspector.
5. Edit coordinates and style.
6. SVG/TikZ update.
7. Create a point/curve/sheet.
8. Inspector for new object appears compact/collapsed.
9. Resize browser narrower.
10. Layout remains usable.

## Report after implementation

Please report:

- files modified;
- inspector collapsed/expanded behavior;
- how preview layout stability was improved;
- whether any component/CSS was refactored;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
