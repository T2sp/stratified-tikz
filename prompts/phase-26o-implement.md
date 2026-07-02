# Phase 26O Implementation Prompt: Drag translation for multi-selected coordinate anchors with snap support

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

Allow dragging one selected coordinate marker to translate all selected coordinate anchors by the same delta.

Drag-based coordinate translation should use cursor snap when enabled.

## Prerequisites

Phases 26L-26N are complete.

## Scope

Implement:

- coordinate group drag start/move/end;
- delta calculation;
- cursor snap integration for drag;
- history integration;
- tests.

Do not implement:

- mixed coordinate + layer-bound drag;
- marquee selection;
- affine transforms.

## Drag behavior

When multiple coordinate anchors are selected:

- drag any selected coordinate marker;
- all selected coordinate anchors move by the same preview delta;
- layer-bound referencing geometry follows through live refs;
- on drag end, commit one undo history entry.

If only one coordinate is selected, existing coordinate drag behavior should remain.

## Snap behavior

Drag-based coordinate translation uses cursor snap.

Required policy:

```text
mouse drag:
  snap applies if enabled

Inspector numeric translation:
  snap does not apply
```

Implementation choices:

- snap the dragged coordinate's target position, then compute delta;
- or snap the delta in the coordinate/work-plane-local frame.

Choose the approach consistent with existing coordinate drag snap.

Requirements:

- no jitter or cumulative rounding drift during drag;
- final committed coordinates validate;
- 2D z stays 0;
- 3D drag respects existing work-plane/camera coordinate mapping.

## Preview during drag

Preferred:

- update preview live during drag using transient editor state;
- commit on drag end.

MVP acceptable:

- update diagram state during drag if existing drag system does so, but history should contain one operation.

## Tests

Add tests:

1. Drag one of multiple selected coordinates moves all selected coordinates.
2. Non-selected coordinate does not move.
3. Referencing path preview follows moved anchors.
4. References remain coordinateRefs.
5. Drag with snap enabled lands on snapped position.
6. Drag with snap disabled preserves raw delta.
7. Undo/redo drag group translation.
8. Drag selected coordinate with work-plane-local position moves frame origin.
9. Drag selected coordinate with internal coordinateRef detaches before translation via helper.
10. Hidden coordinates cannot be dragged.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Create coordinates A/B/C.
2. Multi-select A/B.
3. Drag A.
4. Confirm A and B move; C does not.
5. Path referencing A/B follows.
6. Enable snap and drag again.
7. Confirm snapped final positions.
8. Undo/redo.

## Preserve existing behavior

Do not regress:

- single coordinate drag;
- layer-bound object drag;
- geometry handles;
- coordinate hit-test priority;
- show/hide coordinates;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- drag behavior;
- snap policy;
- history behavior;
- preview behavior during drag;
- tests added/updated;
- test results;
- build results;
- limitations.
