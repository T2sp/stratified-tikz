# Phase 26K Implementation Prompt: Coordinate anchor integration polish, save/load, TikZ, and docs

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

Polish and harden the complete Phase 26 coordinate-anchor feature.

## Scope

Implement:

- docs;
- examples;
- combined tests;
- save/load/TikZ hardening;
- UI/status polish;
- reference traversal performance checks.

## Docs

Document:

- coordinate anchors vs point strata;
- `\coordinate` export;
- preview marker dot + dotted circle;
- show/hide toggle;
- hit-test priority;
- coordinate references;
- delete detach;
- layer translation detach;
- symbolic/work-plane-local detach policy;
- limitations.

## Combined tests

Add tests:

1. create coordinate -> reference in path -> export TikZ;
2. show/hide does not affect save/load/TikZ;
3. delete referenced coordinate -> detach -> save/load/export;
4. layer translate referenced coordinate -> detach -> save/load/export;
5. undo/redo delete detach;
6. undo/redo layer translation detach;
7. work-plane-local coordinate ref detach preserves local expressions;
8. inline output no blank lines;
9. 4-space indentation;
10. reference traversal remains bounded on many objects.

## UI polish

- status after detach/delete;
- confirmation wording;
- usage count clarity;
- coordinate marker tooltip if tooltip system exists;
- show/hide accessibility label.

## Report after implementation

Report docs, examples, combined tests, status behavior, save/load/TikZ coverage, results, limitations.
