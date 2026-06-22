# Preview UI

The Phase 21 editor layout centers the SVG Preview. The compact top panels
handle examples, file operations, imported TikZ styles, variables, and the work
plane selector. TikZ Source stays below the preview so generated code remains
visible without competing with canvas interactions.

## Preview Toolbar

The creation toolbar floats at the top-left of the SVG Preview. It can be
collapsed with the arrow button and expanded again without changing the diagram
or generated TikZ. Undo and Redo sit directly below the toolbar as preview
overlay buttons.

## Add Path

Path-related creation tools are consolidated under Add path:

- line/manual path;
- polyline;
- cubic Bezier;
- arc segment path;
- direct manual, circle, ellipse, and arc path input.

This keeps the primary toolbar compact while preserving the existing path
creation modes.

## Direct Input Drawer

Choosing a Direct input creation mode opens the right-side Direct input drawer.
The drawer edits pending creation fields only. It does not change the diagram,
saved JSON, undo history, or TikZ output until the user creates an element.
Closing the drawer returns creation to cursor input.

## Inspector Drawer

The Inspector button opens the right-side inspector drawer. Opening, closing, or
expanding inspector sections is UI state only. Coordinates and styles change the
diagram only when the inspector fields themselves commit edits.

## Layer Window

The Layer button opens a floating bottom-right layer window. The window controls
the new-element layer, layer filter, visibility, locking, drag-swap, and layer
actions. Open/closed state and the selected action panel are UI-only state.
Layer operations that modify layer metadata or element membership remain normal
undoable diagram changes.

## Overlay Stacking

Preview overlays use a fixed policy inside `.preview-stage`: the SVG canvas is
the base interaction surface; coordinate highlights and geometry handles render
inside the SVG; floating toolbar/history sit above the canvas; camera and layer
panels sit at the bottom-right; the direct input drawer sits on the right; and
the inspector drawer is the top preview-local panel. Overlay controls stop
click and pointer propagation so canvas creation, selection, dragging, and
camera interactions still work when clicking outside overlays.
