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

The Snap control is editor preference state, not diagram geometry. It applies
only to cursor placement and geometry-handle drag editing. Direct coordinate
input, symbolic expression input, JSON load, programmatic updates, and generated
TikZ are not snapped. In 2D mode snapping rounds cursor-derived `x` and `y`
coordinates and keeps `z = 0`; in 3D mode snapping rounds the active work-plane
local coordinates before reconstructing the model point.

See [Editing Fundamentals](./EDITING.md) for Phase 24 snap presets, bulk
editing behavior, symbolic translation, path concatenation, and deferred affine
transform scope.

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

In 3D point and free-label creation, the drawer offers a coordinate mode:
`Global 3D coordinates` or `Active work-plane local coordinates`. The local mode
shows `Plane x / a` and `Plane y / b` fields. These fields accept numeric or
symbolic scalar expressions, display the evaluated local preview values, and
display the resulting global preview point. Creating the point or label stores a
snapshot of the active work-plane frame plus the local scalar expressions.
Cursor snap does not modify these direct local expressions; snapping applies
only to cursor-derived placement and drag coordinates.

In 2D diagrams, direct input remains global x/y input only; no work-plane-local
coordinate mode is shown.

## Inspector Drawer

The Inspector button opens the right-side inspector drawer. Opening, closing, or
expanding inspector sections is UI state only. Coordinates and styles change the
diagram only when the inspector fields themselves commit edits.

For selected point strata or free text labels whose position is stored as a
work-plane-local coordinate source, the Inspector shows `Coordinate source:
Work-plane local`, editable `Plane x / a` and `Plane y / b` expressions, the
evaluated global preview point, and a compact stored-frame summary. Editing a
valid local expression updates the local source and recomputes the global
preview. Invalid local expressions are rejected and do not silently convert the
position to global xyz coordinates.

See [Symbolic Input And Grids](./SYMBOLIC_INPUT_AND_GRIDS.md) for variable
resolution, translation policy, and TikZ `canvas is plane` export behavior for
work-plane-local symbolic coordinates.

For multi-selection, the inspector supports bulk style, layer, delete, and
duplicate operations for the selected objects. Style fields are shown only for
safe common fields of the selected geometric kind. If every selected object has
the same value for a field, that value is shown; otherwise the field displays
`Mixed`, and editing that field applies only the edited value to every selected
object. Curve selections expose stroke color, opacity, line width, line style,
and arrow options when every selected curve supports arrows. Sheet and region
selections expose fill color, fill opacity, stroke color, stroke opacity, and
line width. Point selections expose color, opacity, size, shape, and fill mode.
Label selections expose text color, opacity, font size, and anchor.

Bulk layer changes move every selected object to the chosen layer and update
layer metadata as needed. Bulk delete clears the selection and removes stale
crossing states that depended on deleted curves. Bulk duplicate preserves
geometry, styles, symbolic coordinate metadata, and layer values while assigning
new object ids; copied path labels are disambiguated using the same copy naming
policy as layer duplication. Crossing states are not duplicated by the MVP.

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
