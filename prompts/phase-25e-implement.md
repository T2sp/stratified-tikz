# Phase 25E Implementation Prompt: Editing integration and translation policy for local symbolic coordinates

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

Integrate work-plane-local symbolic coordinates with editing operations, especially translation.

Important user decision:

- During global translation, move each object's stored frame origin by the global translation vector.
- Do not expand local expressions to global expressions.
- Do not mutate a shared active/global work plane.
- Move each object's own frame snapshot origin.

## Prerequisites

Phases 25A-25D and Phase 24D are complete.

## Scope

Implement:

- translation integration;
- cursor snap relation;
- path concatenation relation;
- multi-selection/layer translation behavior;
- tests.

Do not implement:

- rotation;
- scale;
- shear;
- general affine transform;
- global symbolic expansion of local coordinates.

## Global translation policy

For an object containing work-plane-local coordinates:

```text
P = frame.origin + a*u + b*v
```

A global translation by `d` should produce:

```text
frame.origin' = frame.origin + d
a' = a
b' = b
u' = u
v' = v
normal' = normal
```

Requirements:

- object-specific frame snapshot origin moves;
- basis vectors unchanged;
- local symbolic expressions unchanged;
- preview global point moves by `d`;
- source/global active work plane not mutated;
- works for multi-selection translation and layer translation;
- undo/redo works.

If an object has several local coordinates sharing copied frame snapshots, update all relevant snapshot origins consistently within that object. If frame snapshots are duplicated per coordinate, move each snapshot origin by `d`.

## Work-plane-local translation policy

If the UI performs translation in the same work-plane-local coordinate system:

```text
a' = a + da
b' = b + db
frame unchanged
```

This can be optional for MVP.

If implemented:

- build symbolic addition expressions safely;
- update previews.

If not implemented:

- global translation policy above is required.

## Cursor snap relation

Cursor snap affects cursor/drag placement only.

Requirements:

- direct local symbolic input is not snapped;
- Inspector symbolic edits are not snapped;
- cursor placement on work plane may still snap local numeric coordinates according to Phase 24A;
- no conflict between snap and local symbolic sources.

## Path concatenation

When concatenating paths with local coordinates:

- if all coordinates share compatible frame, preserve local coordinate sources in the new path;
- if frames differ, reject or fallback according to documented policy;
- do not silently convert local symbolic coordinates to preview numbers;
- style policy from Phase 24E remains simple.

## Multi-selection/layer translation

Use shared translation helper.

Requirements:

- selected objects with local coordinates translate by moving frame origins;
- layer translation does the same;
- symbolic local expressions unchanged;
- crossings cleaned as existing translation requires;
- no partial mutation on unsupported cases.

## Tests

Add tests:

1. Global translation moves local frame origin by `d`.
2. Global translation leaves local `a,b` expressions unchanged.
3. Global translation leaves frame basis vectors unchanged.
4. Preview point moves by `d`.
5. Active work plane not mutated.
6. Multi-selection translation works for local coordinates.
7. Layer translation works for local coordinates.
8. Undo/redo translation restores frame origin.
9. Direct local symbolic input not snapped.
10. Path concatenation preserves same-frame local coordinates.
11. Mixed-frame concatenation rejected or fallback tested.
12. TikZ output after translation uses moved frame and same local expressions.

## Documentation

Document global translation policy explicitly.

## Report after implementation

Please report:

- files modified;
- global translation behavior;
- local translation behavior if implemented;
- frame-origin movement details;
- snap relation;
- path concatenation behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
