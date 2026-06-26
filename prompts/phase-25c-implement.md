# Phase 25C Implementation Prompt: Preview refresh, JSON import, and geometry integration

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

Integrate work-plane-local symbolic coordinates into preview refresh, variable updates, JSON import resolution, and broader geometry fields.

## Prerequisites

Phases 25A and 25B are complete.

## Scope

Implement:

- refresh of work-plane-local coordinate previews when variables change;
- JSON import variable-resolution integration;
- broader geometry coverage;
- validation across diagram;
- tests.

Do not implement yet:

- TikZ `canvas is plane` export;
- translation integration;
- path concatenation integration.

## Variable refresh

When variables change:

- local `a,b` previews refresh;
- frame symbolic previews refresh;
- global preview point recomputes;
- SVG preview updates.

Requirements:

- no stale previews accepted;
- no NaN/Infinity;
- invalid variable changes show errors as existing symbolic workflow does.

## JSON import

When loading JSON:

- detect variables used in local `a,b`;
- detect variables used in frame fields;
- prompt through existing variable-resolution dialog;
- after confirmation, refresh local coordinate previews;
- then validate/render.

Requirements:

- cancel leaves current diagram unchanged;
- unresolved variables rejected cleanly.

## Geometry coverage

Extend support to more fields where practical:

- path vertices;
- cubic controls;
- arc centers/frames where local source is meaningful;
- polygon sheet vertices;
- filled region boundaries;
- work-plane-filled sheets;
- grid/lattice frames/anchors;
- ruled/Coons boundary snapshots;
- constant point boundaries.

If any kind is not supported, reject local coordinate use for that field before saving invalid data.

## Tests

Add tests:

1. Variable update changes local coordinate preview.
2. JSON import detects variables in local `a,b`.
3. JSON import detects variables in frame fields.
4. Import cancel leaves diagram unchanged.
5. Path vertex local coordinate refreshes.
6. Sheet vertex local coordinate refreshes.
7. Coons/Ruled boundary local coordinate refreshes if supported.
8. Malformed local source in JSON returns clean failure.
9. No NaN/Infinity in preview.
10. Existing global symbolic import still works.

## Documentation

Document import/refresh behavior.

## Report after implementation

Please report:

- files modified;
- refresh integration;
- JSON import integration;
- geometry coverage;
- unsupported cases;
- tests added/updated;
- test results;
- build results;
- limitations.
