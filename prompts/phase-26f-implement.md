# Phase 26F Implementation Prompt: Coordinate anchor core docs and regression hardening

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

Polish and harden the core coordinate anchor feature before detach-specific subphases.

This subphase documents Add coordinate, coordinate references, and current limitations.

## Prerequisites

Phases 26A-26E are complete.

## Scope

Implement:

- docs;
- examples;
- regression tests;
- save/load hardening;
- TikZ export hardening;
- UI polish for core coordinate anchors.

Do not implement:

- delete detach;
- layer translation detach;
- advanced reference manager.

## Docs

Document:

- coordinate anchors vs point strata;
- Add coordinate cursor/direct creation;
- global vs work-plane-local coordinate anchors;
- coordinate references;
- TikZ export order;
- current delete policy for referenced coordinates;
- current show/hide status if already implemented or deferred to 26G.

## Combined tests

Add tests:

1. Create coordinate, reference in path, export TikZ.
2. Create work-plane-local coordinate, reference in label, export TikZ.
3. Save/load coordinate refs.
4. Rename coordinate and verify refs export new TikZ name.
5. Move coordinate and verify refs update preview.
6. Coordinate anchors not affected by layer View/New.
7. Inline output no blank lines.
8. 4-space indentation.
9. Old diagrams load.

## Report after implementation

Please report:

- files modified;
- docs/examples updated;
- regression tests added;
- save/load/TikZ hardening;
- test results;
- build results;
- remaining limitations.
