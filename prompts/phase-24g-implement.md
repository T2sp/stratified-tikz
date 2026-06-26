# Phase 24G Implementation Prompt: Editing polish, docs, and regression hardening

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

Polish and harden Phase 24 editing improvements.

Focus on documentation, UI consistency, performance, and combined workflow tests.

## Scope

Implement:

- docs;
- UI polish;
- combined workflow tests;
- performance guards;
- save/load/undo/redo regression hardening.

Do not implement:

- affine transforms beyond translation;
- 3D general transforms;
- new geometry types.

## Polish topics

- Snap UI help and presets.
- Multi-selection Inspector messaging.
- Bulk operations confirmation/status.
- Translation error messages for unsupported/symbolic cases.
- Path concatenation status messages.
- Layer merge warnings.

## Combined tests

Add tests:

1. Snap + cursor path creation.
2. Multi-select + bulk style + TikZ export.
3. Multi-select + duplicate + delete + undo/redo.
4. Multi-select + symbolic translation + save/load.
5. Path concatenation + arrows/braiding cleanup.
6. Layer merge + layer translation + TikZ export.
7. Inline output still no blank lines after edited diagrams.
8. Selection states not saved.

## Documentation

Update docs:

- cursor snap;
- multi-selection;
- bulk editing;
- symbolic translation;
- path concatenation;
- layer merge;
- affine transform deferred.

## Report after implementation

Please report:

- files modified;
- docs updated;
- UI polish changes;
- combined tests;
- test results;
- build results;
- remaining limitations.
