# Phase 26E Implementation Prompt: Coordinate anchors integration with editing, snapping, selection, and layer operations

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

Integrate coordinate anchors with existing editing systems before adding detach behavior.

Focus on selection cleanup, snapping, multi-selection interactions, path concatenation, and layer operations policy.

## Prerequisites

Phases 26A-26D are complete.

## Scope

Implement:

- coordinate anchor selection cleanup;
- snap relation for coordinate drag/cursor creation;
- multi-selection policy;
- path concatenation behavior with coordinate refs;
- layer operation policy for coordinate anchors;
- tests.

Do not implement yet:

- delete detach;
- layer translation detach;
- advanced reference manager.

## Policies

### Snap

- coordinate cursor creation uses cursor snap;
- coordinate drag/move uses snap if cursor/drag-based;
- direct/Inspector symbolic edits are not snapped.

### Multi-selection

Coordinates may be:

- excluded from multi-selection MVP; or
- selectable in a coordinate-only multi-selection.

Choose and document. Preferred MVP: single coordinate selection only, unless multi-select support is trivial.

### Path concatenation

If selected paths use coordinateRef endpoints:

- preserve coordinateRef in the new concatenated path when possible;
- endpoint auto-orientation should compare resolved previews;
- if source paths are removed, clean crossings as usual but coordinate anchors remain.

### Layer operations

Coordinate anchors are not layer-bound.

Requirements:

- layer filter does not hide coordinate anchors when show is on;
- layer swap/merge/delete does not move/delete coordinate anchors;
- New layer does not affect coordinate anchors;
- layer translation detach is later Phase 26J.

## Tests

Add tests:

1. Coordinate selection cleaned on load/delete.
2. Coordinate cursor creation snap works.
3. Coordinate direct edit not snapped.
4. Layer filter does not hide shown coordinates.
5. Layer delete does not delete coordinates.
6. Layer merge does not move/delete coordinates.
7. Path concatenation preserves coordinate refs when possible.
8. Path concatenation endpoint matching uses coordinate preview.
9. New layer changes do not affect coordinate creation/export.
10. TikZ output unaffected by UI-only coordinate selection.

## Report after implementation

Please report:

- files modified;
- snap integration;
- multi-selection policy;
- path concatenation behavior;
- layer operation policy;
- tests added/updated;
- test results;
- build results;
- limitations.
