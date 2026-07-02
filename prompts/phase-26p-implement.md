# Phase 26P Implementation Prompt: Coordinate multi-selection translation polish, docs, and regression hardening

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

Polish and harden coordinate-anchor multi-selection and translation.

## Prerequisites

Phases 26L-26O are complete.

## Scope

Implement:

- docs;
- examples;
- combined workflow tests;
- performance/atomicity hardening;
- UI status polish.

Do not implement:

- mixed selection translation;
- affine transforms;
- new coordinate reference fields.

## Docs

Update docs with:

- coordinate-only multi-selection;
- why mixed coordinate + layer-bound selection is not MVP;
- Inspector coordinate translation;
- drag group translation;
- snap relation;
- references remain live when coordinates move;
- layer translation still detaches refs.

## Combined tests

Add tests:

1. Multi-select coordinates, translate via Inspector, save/load, export TikZ.
2. Multi-select coordinates, drag translate with snap, undo/redo.
3. Referenced paths remain coordinateRefs and follow moved anchors.
4. Layer translation still detaches refs instead of moving anchors.
5. Coordinate translation with symbolic global positions.
6. Coordinate translation with work-plane-local positions.
7. Coordinate with internal coordinateRef detaches before coordinate translation.
8. Mixed selection rejection remains clear.
9. Inline output no blank lines.
10. 4-space indentation.

## UI polish

- clear status: `Translated 3 coordinates.`;
- clear error for invalid mixed selection;
- coordinate multi-selection Inspector copy is concise;
- disabled states make sense.

## Report after implementation

Please report:

- files modified;
- docs updated;
- combined tests;
- UI polish;
- test results;
- build results;
- remaining limitations.
