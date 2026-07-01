# Phase 26D Implementation Prompt: Coordinate Inspector, rename, move, and unused delete

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

Add a proper Inspector/editor experience for coordinate anchors:

- rename;
- edit TikZ name;
- edit position;
- move by drag/direct fields;
- delete unused coordinate anchors.

Referenced-coordinate detach behavior comes later.

## Prerequisites

Phases 26A-26C are complete.

## Scope

Implement:

- Coordinate Inspector panel;
- rename/name/tikzName editing;
- position editing;
- coordinate drag/move if not already implemented;
- delete unused coordinates;
- validation and undo/redo;
- tests.

Do not implement yet:

- delete referenced coordinate with detach;
- usage count;
- layer translation detach.

## Inspector fields

When a coordinate anchor is selected, show:

```text
Coordinate
  Name
  TikZ name
  Source: Global xyz / Work-plane local
  x/y/z or plane a/b
  Preview
  Delete coordinate
```

Do not show:

- layer;
- codimension;
- point style;
- fill/stroke style.

## Rename / TikZ name

Requirements:

- validate unique TikZ name;
- update references automatically because refs use coordinate id, not name;
- TikZ output uses new TikZ name;
- undo/redo works.

## Position edit / move

Requirements:

- global and work-plane-local positions editable;
- symbolic expressions supported;
- preview updates;
- moving coordinate updates all coordinateRef previews;
- dragging coordinate marker moves coordinate if existing drag pattern supports it;
- cursor snap applies to drag/move if it is cursor-based;
- direct Inspector symbolic edits are not snapped.

## Delete unused

If coordinate has no references:

- delete it.

If coordinate has references:

- for this subphase, either:
  - disable delete and show "used by references"; or
  - show that detach-delete comes later.
- Actual detach-delete is Phase 26I.

## Tests

Add tests:

1. Inspector shows coordinate fields, no layer/style fields.
2. Rename updates name.
3. TikZ name update changes export.
4. Duplicate TikZ name rejected.
5. Global position edit updates preview.
6. Work-plane-local position edit updates preview.
7. Moving coordinate updates referenced path preview.
8. Delete unused coordinate removes it.
9. Delete referenced coordinate blocked or deferred according to policy.
10. Undo/redo rename/move/delete.
11. Selection cleaned after delete.

## Report after implementation

Please report:

- files modified;
- Inspector fields;
- rename/tikzName behavior;
- position edit behavior;
- drag/move behavior;
- unused delete policy;
- tests added/updated;
- test results;
- build results;
- limitations.
