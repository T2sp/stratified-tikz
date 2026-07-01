# Phase 26H Implementation Prompt: Coordinate reference inventory and detach helpers

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

Current public repository:

```text
https://github.com/T2sp/stratified-tikz
```

The repository is a React/TypeScript/Vite GUI for 3-dimensional graphical calculus. It has the expected project structure including `src`, `tests`, `docs`, `prompts`, and automation scripts.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- symbolic variables and symbolic global/work-plane-local coordinate expressions;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- custom work planes and camera controls;
- layer palette/window;
- style manager and imported TikZ style references;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 26 adds TikZ coordinate anchors, distinct from visible point strata.

Core distinction:

```text
Add point:
  visible diagram object
  layer-bound
  styled point
  exported as visible mark/node/drawing command

Add coordinate:
  global reference anchor
  not layer-bound
  exported as \coordinate
  usable by paths/sheets/labels/points as a coordinate reference
  preview-only marker in SVG/PGF Preview
```

Important design requirements:

- Coordinate anchors are global and not layer-bound.
- Coordinate anchors are exported before layer drawing commands.
- Coordinate anchors are not affected by layer View filter or New layer.
- Coordinate anchors can be created by cursor input and direct input.
- Direct input supports both global xyz and work-plane-local symbolic coordinates.
- Coordinate references should be preserved in TikZ when used by paths/sheets/labels/points.
- In SVG Preview, coordinate anchors should eventually appear as a small dot surrounded by a small dotted circle.
- Users need a Show/Hide Coordinates toggle.
- When shown, coordinate anchors should have high hit-test priority over layer-bound geometry.
- Deleting a referenced coordinate should detach references rather than leaving dangling refs.
- During layer translation, layer-bound elements that reference global coordinates should detach first, because coordinate anchors are global and do not move with layers.
- Detach should preserve symbolic/global/work-plane-local coordinate information where supported.
- UI-only state such as show/hide and selection is not stored in `Diagram`.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Implement pure helpers for finding and detaching coordinate-anchor references.

## Scope

Implement:

- reference inventory helper;
- detach helper;
- symbolic/global/work-plane-local preservation policy;
- tests.

Do not implement yet:

- delete-coordinate workflow;
- layer-translation detach integration.

## Reference inventory

Add:

```ts
findCoordinateAnchorReferences(diagram, coordinateId): CoordinateReferenceLocation[]
```

Detect supported references in:

- path vertices/controls;
- sheet vertices;
- label/point positions;
- filled boundaries;
- grid anchors/frames where supported;
- ruled/Coons boundary snapshots;
- other coordinate-ref-enabled fields.

## Detach semantics

Replace `coordinateRef(A)` with a concrete coordinate source copied from coordinate A's current position.

Preferred:

- preserve global symbolic source if target field supports it;
- preserve work-plane-local symbolic source if target field supports it;
- otherwise fallback to finite global preview coordinate.

Requirements:

- no source coordinate mutation;
- immutable diagram update;
- no dangling refs;
- return detached count;
- atomic failure if unsupported without fallback.

## Tests

Add tests for reference discovery, detach global numeric, detach global symbolic, detach work-plane-local, fallback behavior, no dangling refs, no source mutation, and existing export unchanged without detach.

## Report after implementation

Report reference coverage, detach API, preservation/fallback policy, tests, results, and limitations.
