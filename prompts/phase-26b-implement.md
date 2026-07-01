# Phase 26B Implementation Prompt: Add coordinate cursor/direct input and basic Preview marker

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

Add user-facing coordinate anchor creation through cursor input and direct input, plus a basic Preview marker and selection behavior.

Fine-grained marker polish and show/hide toggle are Phase 26G.

## Prerequisites

Phase 26A is complete.

## Scope

Implement:

- Add coordinate tool/palette item;
- cursor creation;
- direct creation;
- basic SVG/PGF Preview marker;
- coordinate selection;
- Inspector summary placeholder if needed;
- undo/redo;
- tests.

Do not implement yet:

- coordinate references in path/sheet inputs;
- dotted-circle final marker polish;
- show/hide toggle;
- delete/detach behavior;
- reference usage count.

## UI

Add coordinate creation as a distinct tool from Add point.

Suggested toolbar item:

```text
Add coordinate
```

It should have:

- cursor input;
- direct input.

Do not overload Add point.

## Cursor creation

2D:

- click creates coordinate anchor at `(x,y,0)`;
- cursor snap applies according to Phase 24A;
- no layer assignment;
- new anchor selected.

3D:

- click creates coordinate anchor on active work plane;
- cursor snap applies to work-plane-local/numeric cursor placement;
- stores global or work-plane-local source according to existing cursor placement policy;
- no layer assignment;
- new anchor selected.

## Direct creation

Direct input form:

```text
Name
Coordinate mode:
  Global xyz
  Active work-plane local

Global:
  x
  y
  z

Work-plane local:
  a
  b
```

Requirements:

- accepts symbolic expressions using existing Phase 19/25 helpers;
- validates finite previews;
- active work-plane frame snapshot stored for local mode;
- direct input is not affected by cursor snap;
- new anchor selected.

## Preview marker

Add a basic marker for coordinate anchors.

Requirements:

- preview-only;
- visually distinguishable from point strata even if final polish comes later;
- selectable;
- high-ish hit target;
- no TikZ effect;
- not layer-bound.

Final marker design is Phase 26G, but do not use an invisible marker.

## Selection

Coordinate anchors should be selectable.

Requirements:

- coordinate selection is UI/editor state;
- not saved to Diagram;
- Inspector or status shows coordinate name;
- Delete behavior can be basic for unused anchors for now;
- selected coordinate highlight visible.

## Tests

Add tests:

1. Add coordinate cursor creates coordinate anchor, not point stratum.
2. 2D cursor creation keeps z=0.
3. Cursor snap applies to coordinate cursor creation.
4. Direct global coordinate creation supports symbolic expression.
5. Direct work-plane-local coordinate creation stores frame snapshot and local expressions.
6. Direct input ignores cursor snap.
7. Created coordinate has unique TikZ name.
8. Created coordinate selected.
9. Undo/redo coordinate creation.
10. Coordinate marker rendered.
11. Selecting coordinate does not change layer/New layer.
12. TikZ export includes created coordinate.

## Report after implementation

Please report:

- files modified;
- Add coordinate UI location;
- cursor/direct behavior;
- snap behavior;
- basic marker behavior;
- selection behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
