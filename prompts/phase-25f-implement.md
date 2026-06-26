# Phase 25F Implementation Prompt: Work-plane-local symbolic polish, docs, and regression hardening

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

Phase 24 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- symbolic variables and symbolic global coordinate expressions;
- direct input and cursor input;
- cursor snapping;
- multi-selection and bulk editing;
- symbolic-aware translation;
- path concatenation;
- layer merge/translation;
- custom work planes;
- camera controls;
- grids/lattices;
- arrows and 2D braiding controls;
- paths, sheets, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches;
- preview-centered UI;
- layer/style/variable managers;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 25 adds symbolic work-plane-local coordinates.

Main idea:

- In 3D direct input and Inspector coordinate editing, users can enter coordinates in the active/stored work-plane-local 2D coordinate system.
- The local coordinates accept symbolic scalar expressions just like global coordinates.
- SVG preview uses finite numeric preview values.
- TikZ export should preserve local symbolic expressions where practical by emitting compatible paths/sheets inside `canvas is plane` scopes.
- Direct/symbolic input should not be snapped by cursor snapping.

Important user decision:

- During **global translation** of an object that contains work-plane-local symbolic coordinates, move that object's own frame origin by the global translation vector.
- Do **not** expand local symbolic expressions into global symbolic coordinates during global translation.
- Do **not** mutate a shared global work plane; move each object's stored frame snapshot origin.
- During **work-plane-local translation** of such coordinates, update local scalar expressions `a`, `b` by adding local deltas.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work-plane-local symbolic coordinate data affects geometry/export and must be saved.
- UI-only draft/open state should not be stored in `Diagram`.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Polish and harden Phase 25 work-plane-local symbolic coordinate support.

## Scope

Implement:

- docs;
- examples;
- combined workflow tests;
- UI polish;
- save/load/TikZ regression hardening.

Do not implement:

- affine transforms;
- symbolic mesh formulas;
- 3D perspective changes.

## Docs

Update docs with:

- what work-plane-local symbolic coordinates are;
- direct input workflow;
- Inspector editing;
- variable resolution;
- TikZ canvas scope export;
- global translation policy:
  - object frame origin moves;
  - local expressions unchanged;
- snap relation:
  - cursor snap does not affect direct symbolic input;
- limitations:
  - mixed-frame paths;
  - sampled mesh numeric fallback;
  - symbolic frame export limitations if any.

## Examples

Add a small example if appropriate:

- point/path on active work plane with:
  - `a = R*cos(q)`;
  - `b = R*sin(q)`.
- TikZ output preserves local expressions.

## Combined tests

Add tests:

1. Create local symbolic point.
2. Save/load.
3. Resolve variables.
4. Translate globally.
5. Export TikZ.
6. Confirm frame origin moved and local expressions preserved.
7. Inline output no blank lines.
8. Path with local symbolic coordinates and arrows exports correctly.
9. Local symbolic coordinates with layer translation.
10. Numeric/global diagrams unaffected.

## Report after implementation

Please report:

- files modified;
- docs updated;
- examples added;
- UI polish;
- combined tests;
- test results;
- build results;
- remaining limitations.
