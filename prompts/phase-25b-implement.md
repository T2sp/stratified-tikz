# Phase 25B Implementation Prompt: Direct input and Inspector UI for work-plane-local symbolic coordinates

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

Expose work-plane-local symbolic coordinate input in Direct input and Inspector editing.

Users should be able to choose between global coordinates and active work-plane-local coordinates in 3D.

## Prerequisites

Phase 25A is complete.

## Scope

Implement:

- coordinate mode UI:
  - Global xyz;
  - Active work-plane local;
- direct input support for local `a,b` symbolic expressions;
- Inspector display/editing for work-plane-local coordinates;
- preview value display;
- tests.

Do not implement yet:

- TikZ `canvas is plane` export;
- broad geometry coverage if helpers are not ready;
- translation integration;
- automatic conversion of all existing global points to local coordinates unless requested.

## Direct input UI

In 3D direct input forms, add:

```text
Coordinate mode:
  Global xyz
  Active work-plane local
```

When `Active work-plane local` is selected, show:

```text
Plane x / a: [ expression ]
Plane y / b: [ expression ]
```

or:

```text
u-coordinate: [ expression ]
v-coordinate: [ expression ]
```

Requirements:

- accepts numeric and symbolic scalar expressions;
- uses active work-plane frame snapshot at creation time;
- stores the snapshot;
- shows numeric preview values;
- shows global preview point;
- invalid expressions do not commit;
- cursor snap does not affect direct/symbolic input.

## Inspector UI

For selected objects with work-plane-local coordinate sources, show:

```text
Coordinate source: Work-plane local
Plane x: R*cos(q)
Plane y: R*sin(q)
Global preview: (...)
```

Allow editing `a` and `b`.

Requirements:

- editing local expressions updates global preview;
- invalid edits rejected;
- does not silently convert to global coordinates;
- shows frame summary if useful;
- optional button:
  - `Convert to global`
  - `Convert to active work-plane local`
  may be deferred.

## Initial geometry coverage

At minimum support:

- direct point creation;
- direct label creation;
- point Inspector position editing;
- label Inspector position editing.

Preferred if manageable:

- direct path vertices/controls;
- direct sheet vertices;
- direct grid/lattice anchor or frame origin.

If not all geometry fields are supported, document limitations clearly.

## Tests

Add tests:

1. Direct point creation with local symbolic `a=R*cos(q)`, `b=R*sin(q)`.
2. Direct label creation with local symbolic coordinates.
3. Inspector displays local expressions for local point.
4. Editing local `a` updates preview.
5. Invalid local expression rejected.
6. Active work-plane frame snapshot stored at creation time.
7. Changing active work plane later does not move existing local coordinate.
8. Cursor snap does not alter direct local symbolic input.
9. 2D diagrams do not show confusing 3D work-plane-local mode.
10. Save/load of UI-created local coordinate works.

## Documentation

Document direct/Inspector local coordinate mode.

## Report after implementation

Please report:

- files modified;
- direct input UI behavior;
- Inspector UI behavior;
- supported geometry fields;
- preview display;
- frame snapshot behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
