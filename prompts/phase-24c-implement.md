# Phase 24C Implementation Prompt: Bulk style/layer/delete/duplicate editing

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

Phase 23 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- paths, arrows, braiding crossings, grids/lattices, sheets, ruled surfaces, Coons patches, filled regions/sheets, curved surfaces;
- symbolic variables and coordinate expressions;
- custom work planes and camera controls;
- layer palette/window;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 24 improves editing fundamentals:

1. Cursor snapping / coordinate quantization.
2. Multi-selection.
3. Bulk style/layer/delete/duplicate editing.
4. Bulk translation, including symbolic coordinates.
5. Path concatenation.
6. Layer merge and layer translation hardening.
7. Editing polish/docs/regression hardening.

Important phase decision:

- General affine transformations are **deferred to a later phase**.
- In Phase 24, the only geometric transform is translation.
- Translation must work for objects containing symbolic coordinates.
- Path concatenation does **not** need to preserve original per-path styles. The concatenated path can use a simple style policy, preferably the first selected path's style or current default curve style.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Direct/symbolic input should not be silently snapped.
- UI-only selection/draft/palette state should not be stored in `Diagram`.
- Multi-selection and operation data that affects geometry should be undoable.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Add core bulk operations for multi-selection:

- simultaneous style editing;
- bulk layer change;
- bulk delete;
- bulk duplicate.

No geometric transforms yet; translation is Phase 24D.

## Prerequisites

Phase 24B is complete.

## Scope

Implement:

- multi-selection Inspector bulk style editor;
- mixed-value display;
- bulk layer change;
- bulk delete;
- bulk duplicate;
- undo/redo integration;
- tests.

Do not implement:

- translation;
- affine transforms;
- path concatenation;
- layer merge;
- mixed-kind full editing beyond safe common fields.

## Bulk style editing

For multi-selected objects of the same `geometricKind`, show common style fields.

Examples:

### Curves

- stroke color;
- line width;
- line style;
- opacity;
- arrow options where applicable.

### Sheets/regions

- fill color;
- fill opacity;
- stroke color;
- stroke opacity;
- line width.

### Points

- color;
- size;
- shape if supported.

### Labels

- text style fields if supported.

Mixed values:

- if all selected objects share a field value, show the value;
- if not, show `Mixed` or placeholder;
- editing a field applies only that field to all selected objects.

Requirements:

- bulk style edits are undoable;
- ids/geometry/layers preserved unless editing layer;
- TikZ/SVG update.

## Bulk layer change

Allow changing layer for all selected objects.

Requirements:

- selected objects move to chosen layer;
- layer metadata updated if needed;
- layer filter/visibility selection cleanup follows existing policy;
- undo/redo works.

## Bulk delete

Delete all selected objects.

Requirements:

- all selected ids removed;
- dependent crossing states cleaned;
- selection cleared;
- undo/redo works.

## Bulk duplicate

Duplicate all selected objects.

Requirements:

- new ids generated;
- geometry/style/symbolic expressions copied;
- layer values preserved unless user chooses target layer later;
- path labels/spath-save labels disambiguated or cleared according to existing duplicate policy;
- crossing states are not duplicated in MVP, unless existing helper safely supports it;
- created duplicates selected as a multi-selection;
- undo/redo works.

## Tests

Add tests:

1. Multi-selected curves show common style editor.
2. Mixed style value displayed as mixed.
3. Editing stroke color applies to all selected curves.
4. Bulk layer change applies to all selected objects.
5. Bulk delete removes all selected objects and clears selection.
6. Bulk duplicate creates new ids.
7. Bulk duplicate preserves geometry/style/symbolic expressions.
8. Bulk duplicate does not duplicate crossing states unless explicitly implemented.
9. Undo/redo works for bulk delete.
10. Undo/redo works for bulk duplicate.
11. TikZ output reflects bulk style/layer edits.
12. Selection not saved.

## Documentation

Document supported bulk operations and mixed-value behavior.

## Report after implementation

Please report:

- files modified;
- bulk style fields by kind;
- mixed value policy;
- layer bulk change behavior;
- duplicate/delete behavior;
- crossing cleanup policy;
- tests added/updated;
- test results;
- build results;
- limitations.
