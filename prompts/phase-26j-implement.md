# Phase 26J Implementation Prompt: Layer translation detach for coordinate references

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

Layer translation should detach coordinate references inside translated layer elements before translating them.

Coordinate anchors are global and should not move with layers.

## Prerequisites

Phases 26H and 26I are complete.

## Behavior

Before translating a layer:

1. find coordinate refs in elements on that layer;
2. detach those refs to concrete coordinates;
3. translate those concrete coordinates with the layer;
4. leave coordinate anchors unchanged;
5. leave refs in elements on other layers linked.

Example:

```text
Coordinate A at (0,0)
Path on layer 2: A -> B
Translate layer 2 by (1,0)

After:
  A remains at (0,0)
  former A endpoint in path becomes concrete (1,0)
```

Symbolic example:

```text
A.x = R
dx = 1
=> detached path endpoint x = (R)+1
A.x remains R
```

Work-plane-local example:

- detach to copied local source;
- global translation moves copied frame origin;
- local `a,b` unchanged;
- coordinate anchor unchanged.

## Requirements

- operation atomic;
- no dangling refs;
- no coordinate anchor movement;
- undo/redo works;
- crossing/braiding cleanup runs as existing translation requires;
- existing layer translation for non-ref objects unchanged.

## Tests

Add tests:

1. coordinate anchor not moved;
2. translated layer refs detach and move;
3. other-layer refs remain linked;
4. symbolic refs translate expression;
5. work-plane-local refs move copied frame origin;
6. no dangling refs;
7. undo/redo;
8. TikZ output uses detached coords;
9. existing layer translation unchanged.

## Report after implementation

Report detach flow, symbolic/local behavior, atomic policy, tests, results, limitations.
