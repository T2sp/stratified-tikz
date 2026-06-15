# Phase 10C Implementation Prompt: Direct-input creation for paths and sheets

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

when running npm commands.

Verification commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## Context

You are working on the StratifiedTikZ project.

Phase 10C adds direct-input creation for paths and sheets.

Previous relevant phases:

- Phase 7B: cursor creation for polyline curves.
- Phase 7C: cursor creation for cubic Bézier curves.
- Phase 7E: cursor creation for 3D polygon sheets.
- Phase 9B: layer-aware TikZ output.
- Phase 9C: layer-based selection/filtering.
- Phase 10B: direct-input creation for points and labels.

Important convention:

- An n-stratum means codimension n, not dimension.
- Internally coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Coordinate input mode belongs to UI/editor state, not `Diagram`.
- Selection, layer filter, drafts, and direct form state are UI/editor state only.
- Generated TikZ must depend on committed diagram data only.

Phase 9B ordering convention:

- TikZ output uses numeric layer order.
- Within each layer, codimension / element-kind section order is preferred for readability.
- Within each section, original diagram order is preserved.
- Do not change this in Phase 10C.

Phase 10B direct creation convention:

- Direct-created elements should remain visible and selected after creation.
- If a specific layer filter is active, direct-created elements should not be created into a hidden layer unless the UI also updates the filter.
- Prefer giving the direct creation form an explicit layer input/selector, and ensure the selected layer is visible after creation.

## Goal

Implement direct-input creation for:

1. polyline curves;
2. cubic Bézier curves;
3. 3D polygon sheets.

The user should be able to create these elements by entering coordinates directly instead of clicking in the SVG preview.

Direct creation must include a layer control, not only coordinate fields.

## Scope

This is Phase 10C only.

Do not implement:

- delete/remove selected elements;
- drag editing;
- undo/redo;
- custom work planes;
- arbitrary work planes;
- concatenated paths;
- 2D filled regions;
- curved-boundary sheets;
- `spath/save`;
- new TikZ import;
- new dependencies;
- broad UI redesign.

Do not change:

- existing cursor creation behavior except for small shared helper refactors;
- save/load format unless absolutely necessary;
- TikZ geometry semantics;
- SVG rendering semantics;
- Phase 9B layer output ordering convention;
- Phase 9C layer filter persistence behavior;
- Phase 10B point/label direct creation behavior except for shared layer selector consistency.

## Requirements

### 1. Direct creation UI

Add direct creation UI controls for:

- polyline curve;
- cubic Bézier curve;
- 3D polygon sheet.

The UI may be placed near the existing direct creation controls or in a compact direct-input panel.

The UI should be reasonably simple and clear.

For each direct-created element, the user must be able to specify:

- coordinates;
- layer.

Layer should not be silently assigned only by the default next-layer policy.

Acceptable layer UI options:

- a numeric layer input field;
- a dropdown of existing layers plus a numeric custom input;
- a compact field such as `Layer: [0]`.

The simplest acceptable implementation is a finite numeric layer input shared by direct creation tools.

### 2. Layer behavior under active layer filter

Direct-created paths/sheets must remain visible and selected after creation.

Implement one clear policy.

Preferred policy:

- The direct creation form has an explicit layer field.
- By default, if a specific layer filter is active, initialize/sync the direct creation layer to that active layer.
- If the user chooses a different layer that is hidden by the current filter, then after creation either:
  - update the layer filter to the created element’s layer; or
  - set the layer filter to `all`; or
  - otherwise ensure the created element is visible and selected.
- If the layer filter is `all`, use the direct form layer as-is.

The important UX requirement is:

- after a successful direct creation, the newly created curve/sheet is visible and selected.

Do not pass the new selection through a helper in a way that immediately clears it.

Selection and layer filter must remain UI state only and must not be stored in `Diagram`.

### 3. Direct polyline curve creation

Add direct-input creation for polyline curves.

Requirements:

- user can enter at least two vertices;
- invalid numeric values are rejected safely;
- blank or non-finite coordinates are rejected;
- 2D mode exposes x/y only and normalizes z to `0`;
- 3D mode exposes x/y/z;
- created stratum has:
  - `geometricKind: "curve"`;
  - `kind: "polyline"` or the existing model equivalent;
  - codim 1 in 2D;
  - codim 2 in 3D;
  - default curve style consistent with cursor polyline creation;
  - non-empty default name;
  - explicit selected layer from the direct form;
- created curve is selected after creation;
- created curve is visible after creation, even under an active layer filter.

Do not add direct-input concatenated paths.

### 4. Direct cubic Bézier curve creation

Add direct-input creation for cubic Bézier curves.

Requirements:

- user can enter exactly four points:
  - start;
  - control point 1;
  - control point 2;
  - end;
- invalid numeric values are rejected safely;
- blank or non-finite coordinates are rejected;
- 2D mode exposes x/y only and normalizes z to `0`;
- 3D mode exposes x/y/z;
- created stratum has:
  - `geometricKind: "curve"`;
  - `kind: "cubicBezier"` or the existing model equivalent;
  - codim 1 in 2D;
  - codim 2 in 3D;
  - default curve style consistent with cursor cubic Bézier creation;
  - non-empty default name;
  - explicit selected layer from the direct form;
- created curve is selected after creation;
- created curve is visible after creation, even under an active layer filter.

Do not implement relative/polar Bézier control editing in this phase.

### 5. Direct 3D polygon sheet creation

Add direct-input creation for 3D polygon sheets.

Requirements:

- available only in 3D diagrams;
- user can enter at least three vertices;
- invalid numeric values are rejected safely;
- blank or non-finite coordinates are rejected;
- created stratum has:
  - `geometricKind: "sheet"`;
  - polygon sheet kind matching the existing Phase 7E model;
  - codim 1;
  - default sheet style consistent with cursor sheet creation;
  - non-empty default name;
  - explicit selected layer from the direct form;
- created sheet is selected after creation;
- created sheet is visible after creation, even under an active layer filter.

Do not add 2D sheet creation.

Do not add 2D codim-0 region creation.

### 6. Coordinate input model

Keep direct-input state outside `Diagram`.

Direct creation form state may be React state or extracted UI helper state.

Direct creation must not store temporary drafts inside `Diagram`.

Committed elements should be ordinary diagram data:

- direct-created curves should behave like cursor-created curves;
- direct-created sheets should behave like cursor-created sheets;
- inspector editing should work;
- style editing should work;
- TikZ export should work;
- SVG preview should work;
- save/load should work if the existing model already supports the committed element type.

### 7. Helper reuse

Reuse existing helpers where possible:

- point/label direct creation helpers from Phase 10B;
- cursor polyline/cubic/sheet creation helpers;
- coordinate parsing helpers;
- layer filter helpers;
- selection helpers;
- default style helpers;
- id generation helpers.

If existing helpers do not allow explicit layer, extend them in a small backward-compatible way.

Avoid duplicating large creation logic in `App.tsx` if a simple helper extraction is available.

### 8. Validation and status messages

Provide user-visible status messages for direct creation.

Requirements:

- invalid coordinates should not create elements;
- too few polyline vertices should not create an element;
- cubic Bézier must require exactly four points;
- polygon sheet must require at least three vertices;
- invalid layer input should be rejected safely;
- successful creation should state what was created.

Keep messages concise.

### 9. Tests

Add focused tests.

Required tests:

A. Direct polyline creation

- creates a polyline curve from direct coordinates;
- assigns correct codim in 2D and/or 3D;
- normalizes z to `0` in 2D;
- uses the explicitly selected layer;
- selects the created curve;
- created curve remains visible under active layer filter.

B. Direct cubic Bézier creation

- creates a cubic Bézier curve from four direct points;
- preserves point order: start, control1, control2, end;
- uses the explicitly selected layer;
- selects the created curve;
- rejects invalid/non-finite input.

C. Direct 3D polygon sheet creation

- creates a polygon sheet from at least three vertices;
- uses the explicitly selected layer;
- selects the created sheet;
- is not available or does not commit in 2D;
- rejects invalid/non-finite input.

D. Layer filter interaction

Add at least one test where:

- a specific layer filter is active;
- direct creation creates an element on the active/selected layer or updates the filter appropriately;
- the created element remains selected and visible.

E. Regression tests

Keep existing tests passing for:

- direct points and labels from Phase 10B;
- invalid numeric input;
- 2D z normalization;
- TikZ output not depending on UI state;
- layer-aware TikZ output;
- layer filtering.

If App-level UI tests become too heavy, extract small pure helpers and test them. Still ensure the actual direct creation path uses those helpers.

### 10. Documentation

Update documentation only where relevant.

Good places:

- `docs/ROADMAP.md`, if Phase 10C status is tracked;
- a UI/direct creation doc, if one exists;
- `docs/DATA_MODEL.md`, only if any helper/model clarification is necessary.

Mention:

- direct paths/sheets are committed as ordinary diagram data;
- direct creation layer is explicitly user-controlled;
- when a layer filter is active, direct-created elements remain visible and selected;
- direct form/filter/selection state is UI state only;
- TikZ export is unaffected by active filter/selection.

Do not add large unrelated docs.

### 11. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## Report after implementation

Please report:

- files modified;
- direct creation UI added for polyline/cubic/sheet;
- how layer selection works in direct creation;
- what happens under an active layer filter;
- how created elements remain visible and selected;
- how 2D z normalization is handled;
- how invalid/non-finite input is rejected;
- how direct-created elements reuse ordinary diagram data;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
