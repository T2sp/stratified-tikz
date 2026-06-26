# Phase 24F Implementation Prompt: Layer merge and layer translation symbolic hardening

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

Add layer merge and harden layer translation using the symbolic-aware translation helpers from Phase 24D.

General layer affine transforms are deferred to a later phase.

## Prerequisites

Phase 24D is complete.

## Scope

Implement:

- merge two existing layers;
- symbolic-aware layer translation using shared helpers;
- UI in Layer window/actions;
- undo/redo;
- tests.

Do not implement:

- layer rotation;
- layer scaling;
- layer shear;
- general affine transform;
- new layer model.

## Layer merge

UI:

```text
Merge layers
  Source layer
  Target layer
  [Merge]
```

Behavior:

- all elements on source layer move to target layer;
- source layer metadata removed or marked empty according to existing layer policy;
- target metadata preserved;
- source == target rejected;
- selection remains valid or cleaned;
- View filter and New layer handled predictably;
- undo/redo works.

Recommended filter/New policy:

- if New layer was source, set New layer to target.
- if View filter was source, set View filter to target or All. Choose and document.
- if selected elements remain, preserve selection.

## Layer translation hardening

Layer translation exists, but should use the symbolic-aware translation helper.

Requirements:

- numeric coordinates translate;
- symbolic coordinates update expressions safely;
- frame origins translate;
- frame basis vectors unchanged;
- all element kinds on layer handled or rejected atomically;
- 2D z remains 0;
- undo/redo works.

## Tests

Add tests:

1. Merge source into target moves all strata and labels.
2. Source metadata removed/updated.
3. Source == target rejected.
4. If New layer is source, it becomes target.
5. View filter source policy tested.
6. Selection cleanup tested.
7. Undo/redo merge.
8. Layer translation translates symbolic point expression.
9. Layer translation translates symbolic path expressions.
10. Layer translation translates Coons/Ruled boundary symbolic expressions.
11. Frame origins translated; basis unchanged.
12. 2D z remains 0.
13. TikZ output reflects merged/translated layers.

## Documentation

Document layer merge and symbolic layer translation. Clearly state that general layer affine transform is deferred.

## Report after implementation

Please report:

- files modified;
- merge behavior;
- source metadata policy;
- View/New handling;
- symbolic translation coverage;
- tests added/updated;
- test results;
- build results;
- limitations.
