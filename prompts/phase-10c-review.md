# Phase 10C Review Prompt: Direct-input creation for paths and sheets

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

## Review instructions

Review Phase 10C only.

Do not modify files.

Your job is to determine whether Phase 10C is complete, safe, and scoped.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and `REVIEW_JSON_END`.

If there are any Critical or Medium issues, set:

```json
"ready_to_commit": false
```

If only Low-priority issues remain, set:

```json
"ready_to_commit": true
```

## Phase 10C goal

Phase 10C should implement direct-input creation for:

- polyline curves;
- cubic Bézier curves;
- 3D polygon sheets.

Direct creation must include user-controlled layer selection, not only coordinate fields.

Newly created direct elements must remain visible and selected, including when a specific layer filter is active.

## Existing project conventions

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
- Do not report cross-kind same-layer section ordering as a Phase 10C issue unless Phase 10C changed it.

Phase 10B direct creation convention:

- Direct-created elements should remain visible and selected after creation.
- If a specific layer filter is active, direct-created elements should either be created on a visible/active layer or the UI filter should update so the created element is visible.
- Selection/filter/direct form state must remain outside `Diagram`.

## Scope review

Confirm Phase 10C did not implement unrelated features.

It should not add:

- remove/delete;
- drag editing;
- undo/redo;
- custom work planes;
- arbitrary work planes;
- concatenated paths;
- 2D filled regions;
- curved-boundary sheets;
- `spath/save`;
- TikZ import;
- new dependencies;
- broad UI redesign.

If any of these were added, classify according to severity.

## Functional review checklist

### 1. Direct creation UI

Check that there is direct-input UI for:

- polyline curves;
- cubic Bézier curves;
- 3D polygon sheets.

Check that the UI includes layer selection/control.

The user should be able to choose the layer for direct-created paths/sheets.

A direct creation form that only accepts coordinates and silently uses a default next-layer policy is not sufficient.

### 2. Direct polyline creation

Check:

- direct polyline creation requires at least two vertices;
- invalid numeric values are rejected;
- blank, `NaN`, and infinite values are rejected;
- 2D mode exposes or accepts only x/y and normalizes z to `0`;
- 3D mode requires finite x/y/z;
- created curve has `geometricKind: "curve"`;
- created curve has the existing polyline kind/model;
- codim is 1 in 2D and 2 in 3D;
- default style/name/layer behavior is consistent with cursor-created polylines except for explicit layer selection;
- created curve is selected after creation;
- created curve remains visible after creation under active layer filters.

### 3. Direct cubic Bézier creation

Check:

- direct cubic Bézier creation requires exactly four points:
  - start;
  - control point 1;
  - control point 2;
  - end;
- invalid numeric values are rejected;
- blank, `NaN`, and infinite values are rejected;
- 2D mode normalizes z to `0`;
- 3D mode requires finite x/y/z;
- created curve has `geometricKind: "curve"`;
- created curve has the existing cubic Bézier kind/model;
- codim is 1 in 2D and 2 in 3D;
- point order is preserved;
- default style/name/layer behavior is consistent with cursor-created cubic Bézier curves except for explicit layer selection;
- created curve is selected after creation;
- created curve remains visible after creation under active layer filters.

Do not require relative/polar control editing in Phase 10C.

### 4. Direct 3D polygon sheet creation

Check:

- direct polygon sheet creation is available only in 3D diagrams;
- it requires at least three vertices;
- invalid numeric values are rejected;
- blank, `NaN`, and infinite values are rejected;
- created stratum has `geometricKind: "sheet"`;
- created stratum uses the existing polygon sheet model;
- codim is 1;
- default style/name/layer behavior is consistent with cursor-created polygon sheets except for explicit layer selection;
- created sheet is selected after creation;
- created sheet remains visible after creation under active layer filters.

Direct 2D sheet creation should not be added.

2D codim-0 region creation should not be added.

### 5. Layer selection and filter interaction

This is a key review point.

Check that each direct-created path/sheet uses a user-controlled layer value.

Check behavior when a specific layer filter is active.

Acceptable behavior:

- direct creation defaults to the active filtered layer;
- or direct creation uses an explicit chosen layer and updates the filter so the element is visible;
- or direct creation sets the filter to `all` after successful creation.

Unacceptable behavior:

- element is created on a hidden layer;
- new selection is immediately cleared by `clearSelectionForLayerFilter(...)`;
- UI reports success while the created path/sheet is invisible and not selected;
- layer/filter/selection state is stored in `Diagram`.

If this issue appears, classify it as Medium unless it corrupts data.

### 6. UI/editor state separation

Confirm:

- direct coordinate form state is not stored in `Diagram`;
- direct layer form state is not stored in `Diagram`;
- direct creation status is not stored in `Diagram`;
- selection is not stored in `Diagram`;
- layer filter is not stored in `Diagram`;
- drafts are not stored in `Diagram`.

Committed created elements should be ordinary diagram data.

### 7. TikZ and SVG behavior

Check:

- direct-created curves/sheets render in SVG as ordinary committed elements;
- direct-created curves/sheets export to TikZ as ordinary diagram data;
- selection/highlighting/filter/direct form status do not affect TikZ output;
- Phase 9A coordinate naming is not regressed;
- Phase 9B layer-aware TikZ output is not regressed;
- Phase 9B codimension/element-kind section ordering convention is not unnecessarily changed.

### 8. Tests

Check that tests cover:

- direct polyline creation;
- direct cubic Bézier creation;
- direct 3D polygon sheet creation;
- explicit direct layer selection;
- active layer filter interaction;
- selected/visible newly created elements;
- invalid numeric input;
- 2D z normalization;
- 3D finite coordinate validation;
- no 2D sheet creation;
- regressions for direct point/label creation from Phase 10B.

A missing active-layer-filter test for direct-created paths/sheets should usually be Medium because it risks repeating the Phase 10B issue.

A missing explicit-layer test should usually be Medium because explicit layer selection is part of the Phase 10C requirement.

### 9. Documentation

Check relevant docs if updated.

Docs should not claim that direct paths/sheets are stored as drafts in `Diagram`.

Docs should mention, if applicable:

- direct creation layer is user-controlled;
- direct-created elements remain visible and selected under active filters;
- direct form/filter/selection state is UI-only;
- TikZ output is unaffected by active filter/selection.

Missing docs are usually Low unless the implementation changes a documented behavior.

## Run verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Report the results.

## Output format

Use this structure:

```markdown
**Summary:** pass / needs changes

**Critical Issues**
- ...

**Medium Issues**
- ...

**Low-Priority Issues**
- ...

**What Looks Correct**
- ...

**Test Results**
...

**Build Results**
...

**Ready To Call Phase 10C Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
If needed, provide a concise fix prompt.
```

Then output:

```text
REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END
```

Rules for JSON:

- `critical_count`, `medium_count`, and `low_count` must be numbers.
- `ready_to_commit` must be false if `critical_count > 0` or `medium_count > 0`.
- `suggested_fix_prompt` should be a short targeted prompt if fixes are needed.
