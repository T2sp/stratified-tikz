# Phase 26N Implementation Prompt: Coordinate multi-translation UI and undo/redo

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

Also run:

```bash
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```
## Project context

You are working on the StratifiedTikZ project.

Phase 26 adds global TikZ coordinate anchors, distinct from visible point strata.

Coordinate anchors are global, not layer-bound, exported as `\coordinate`, and can be referenced by paths/sheets/labels/points through `coordinateRef` sources.

Current expected coordinate-anchor behavior after Phase 26A-26K:

- coordinate anchors are stored separately from strata/labels;
- coordinate anchors have no layer, codimension, or style;
- coordinate anchors can be created by cursor/direct input;
- coordinate anchors can be referenced by supported geometry fields;
- supported coordinate refs export as `(tikzName)`;
- unsupported coordinate refs are rejected instead of silently numericized;
- coordinate anchor deletion detaches references;
- layer translation detaches coordinate refs in layer-bound objects before moving them;
- coordinate markers can be shown/hidden;
- coordinate markers are preview-only;
- coordinate anchors are not affected by layer View filter or New layer;
- save/load, undo/redo, TikZ export, inline no-blank-line behavior, and 4-space indentation must be preserved.

Phase 26 follow-up adds coordinate-anchor multi-selection and coordinate-anchor translation.

Important design decisions:

- Coordinate anchors support coordinate-only multi-selection.
- Mixed multi-selection of coordinate anchors and layer-bound objects is not supported in the MVP.
- Coordinate translation moves the coordinate anchors themselves.
- Geometry referencing translated coordinate anchors remains live and therefore follows the moved anchors.
- Unlike layer translation, coordinate translation does not detach references in layer-bound objects.
- If a selected coordinate anchor's own position contains `coordinateRef` sources, detach those internal refs before translating that coordinate anchor.
- Global coordinate positions translate by adding the delta to components, preserving symbolic expressions when possible.
- Work-plane-local coordinate positions translate by moving their stored frame origin; local `a,b` expressions and frame basis vectors remain unchanged.
- Drag-based coordinate translation uses cursor snap.
- Numeric/direct translation does not use cursor snap.
- Translation is atomic and undoable.
- Selection state is UI/editor state and is not stored in `Diagram`.


## Goal

Add user-facing coordinate multi-translation using the helper from Phase 26M.

This subphase implements Inspector numeric/direct translation controls and history integration.

Drag translation is Phase 26O.

## Prerequisites

Phases 26L and 26M are complete.

## Scope

Implement:

- Inspector panel for coordinate multi-selection translation;
- numeric/symbolic delta input if supported by existing helpers;
- apply translation action;
- undo/redo integration;
- status/error messages;
- tests.

Do not implement yet:

- drag group translation;
- mixed selection translation;
- affine transforms.

## Inspector UI

When multiple coordinate anchors are selected, show:

```text
N coordinates selected

Translate selected coordinates
  dx:
  dy:
  dz:
  [Apply]
```

For 2D diagrams:

- hide or disable `dz`;
- keep z=0 policy clear.

If symbolic delta expressions are supported by existing translation helpers, allow them. Otherwise numeric deltas are acceptable. Report policy.

## Behavior

When Apply is clicked:

1. call `translateCoordinateAnchors(...)`;
2. commit result as one undoable history entry;
3. keep translated coordinates selected if possible;
4. show status:

```text
Translated 3 coordinates.
```

If failure:

- show clear error;
- no diagram mutation;
- selection preserved.

## References remain live

When coordinate anchors move:

- paths/sheets/labels/points referencing them should move through reference resolution;
- those layer-bound objects should not be detached;
- TikZ output should update coordinate definitions, not referencing draw commands.

## Tests

Add tests:

1. Inspector appears for coordinate multi-selection.
2. Applying dx/dy translates all selected coordinates.
3. 2D translation keeps z=0.
4. Work-plane-local coordinate translates by frame-origin movement.
5. Symbolic coordinate translates preserving expression.
6. Layer-bound referencing path remains coordinateRef.
7. Referencing path preview moves after coordinate translation.
8. TikZ coordinate definition updates.
9. `\draw (A) -- (B)` remains unchanged when A/B translated.
10. Undo restores previous coordinate positions.
11. Redo reapplies translation.
12. Failed translation shows error and does not mutate.
13. Selection remains coordinate multi-selection after success.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Create coordinates A/B.
2. Create path `(A) -- (B)`.
3. Multi-select A/B.
4. Apply dx=1, dy=0.
5. Confirm A/B markers move.
6. Confirm path moves with A/B.
7. Confirm TikZ only coordinate definitions changed; path still uses `(A) -- (B)`.
8. Undo/redo.

## Preserve existing behavior

Do not regress:

- coordinate selection;
- Inspector single-coordinate editing;
- coordinate delete detach;
- layer translation detach;
- layer-bound multi-selection translation;
- TikZ export;
- save/load.

## Report after implementation

Please report:

- files modified;
- UI behavior;
- delta input policy;
- history behavior;
- reference-live behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
