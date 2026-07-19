# Preview UI

The Phase 28 editor layout treats the SVG Preview as the main workspace. The
preview expands to roughly the browser viewport height on desktop, while the
top controls stay compact so editing does not require constant scrolling. TikZ
Source stays below the preview so generated code remains visible without
competing with canvas interactions.

## Examples

The Examples control starts expanded so a new session can quickly choose a
diagram. After the user edits the current diagram, the Examples bar collapses to
a compact dropdown. The selected example is still available from the dropdown,
but the control no longer consumes editing space above the preview.

## Preview Toolbar

The creation toolbar floats at the top-left of the SVG Preview. It can be
collapsed with the arrow button and expanded again without changing the diagram
or generated TikZ. Undo and Redo sit directly below the toolbar as preview
overlay buttons.

Toolbar chrome uses translucent backgrounds for the floating toolbar and its
buttons. Text and icons keep their own opaque color, so readability does not
depend on parent opacity.

The Snap control is editor preference state, not diagram geometry. It applies
only to cursor placement and geometry-handle drag editing. Direct coordinate
input, symbolic expression input, JSON load, programmatic updates, and generated
TikZ are not snapped. In 2D mode snapping rounds cursor-derived `x` and `y`
coordinates and keeps `z = 0`; in 3D mode snapping rounds the active work-plane
local coordinates before reconstructing the model point.

See [Editing Fundamentals](./EDITING.md) for Phase 24 snap presets, bulk
editing behavior, symbolic translation, path concatenation, and deferred affine
transform scope.

## Context Quick Style Bar

Selecting an editable object shows a Context quick style bar near the preview
toolbar. It exposes frequent edits without opening the Inspector:

- curves and paths: stroke color, stroke width, and arrows;
- points: point color, radius, and fill mode;
- sheets and filled regions: fill color, fill opacity, stroke color, and stroke
  width;
- free text labels: text color and font size.

The quick bar also exposes copy, paste, and style eyedropper actions. When the
diagram has compatible saved or imported TikZ styles, the quick bar shows a
compact searchable TikZ style menu. Applying an imported style stores the style
reference on the selected object. Editing an explicit shortcut field afterward
keeps the imported TikZ style reference where possible and emits only the
explicit override in generated TikZ, avoiding duplicated options.

Stroke-width-like fields and point radius use sliders snapped to `0.1` steps
plus a text input for custom values. Numeric drafts are lenient while typing:
temporary text such as `.`, `-`, or `1e` stays in the input and shows a warning
without mutating the saved diagram. A valid draft such as `.5` commits normally.

## Export SVG

The SVG export control is a sticky preview edge action at the lower-right of
the preview frame, next to the Layer control area and protruding below the
frame. Its background selector offers `Transparent background` (the default)
and `White background` before using `Export SVG`. The Preview workspace may
remain gray on screen; that editor-only background is not inherited by the
download. White export instead adds an explicit white rectangle covering the
exported viewBox behind the diagram.

Export includes the current SVG Preview view, including visible diagram
geometry, labels, and arrow previews. Editor chrome, hit-test metadata, and
preview-only data attributes are removed from the exported SVG.

SVG export is independent from TikZ export. Using `Export SVG` never changes the
diagram model, undo history, TikZ source, or TikZ export mode. The most recently
selected SVG background remains active for the current component lifetime, but
is export-only and is not included in saved diagram JSON.

## Add Path

Path-related creation tools are consolidated under Add path:

- arbitrary path;
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

For 3D `Add coordinate` and `Add point`, active work-plane-local input also
supports a polar mode. The first field is the work-plane-local radius and the
second field is the angle in degrees. The input panel shows the active
work-plane origin and plane vectors near the local input mode control, so the
user can see which frame the local polar coordinate will use.

In 2D diagrams, direct input remains global x/y input only; no work-plane-local
coordinate mode is shown.

## Work-Plane Overlay

In 3D mode, the work-plane editor is a preview overlay near the lower-left of
the canvas. It mirrors the Layer window placement style while keeping work-plane
setup near cursor-driven 3D editing. The top toolbar routes to this preview
overlay with `Edit in preview`.

The setup methods are listed in this order:

1. Pick 3 existing points;
2. Origin + normal vector;
3. Custom 3 points.

`Pick 3 existing points` can pick point strata and visible coordinate anchors.
`Origin + normal vector` accepts an xyz origin and a normal described by theta
and phi angle fields. Theta is measured from `+z`; phi is measured in the
`xy`-plane from `+x` toward `+y`. A small normal-vector preview updates from
those two angle drafts. `Custom 3 points` builds a custom plane from three
directly entered points.

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

Coordinate-anchor multi-selection is separate from layer-bound bulk editing.
When every selected item is a coordinate anchor, the Inspector shows a concise
selected-count summary and direct translation controls. In 2D, `dz` is disabled
and kept at `0`; in 3D, all three delta fields are available. Direct coordinate
translation does not use cursor snap. Dragging one selected coordinate marker
translates the selected coordinate group and does use cursor snap. Mixed
coordinate plus layer-bound multi-selection translation is rejected for the MVP.

## Layer Window

The Layer button opens a floating bottom-right layer window. The window controls
the new-element layer, layer filter, visibility, locking, drag-swap, and layer
actions. Open/closed state and the selected action panel are UI-only state.
Layer operations that modify layer metadata or element membership remain normal
undoable diagram changes.

## Arrow Preview

SVG Preview draws path arrowheads close to the TikZ arrow syntax used on export.
Endpoint arrows use the standard `>`-style head. Mid-arrow previews distinguish
`Stealth`, `Latex`, `Stealth[harpoon]`, and `Stealth[harpoon,swap]`, and they
follow the path tangent, line width, stroke color, and stroke opacity.

The preview is an SVG approximation of TikZ `arrows.meta`, not a TeX-rendered
copy. It is intended to show direction, position, head family, harpoon side, and
relative size faithfully enough for editing. TikZ export remains the source of
truth for exact TeX rendering.

## Overlay Stacking

Preview overlays use a fixed policy inside `.preview-stage`: the SVG canvas is
the base interaction surface; coordinate highlights and geometry handles render
inside the SVG; floating toolbar/history sit above the canvas; camera and layer
panels sit at the bottom-right; the direct input drawer sits on the right; and
the inspector drawer is the top preview-local panel. Overlay controls stop
click and pointer propagation so canvas creation, selection, dragging, and
camera interactions still work when clicking outside overlays.

The JSON load variable-resolution dialog is a modal outside the preview overlay
stack. It traps focus while open, handles Escape inside the modal flow, and sits
above the toolbar, quick style bar, popovers, layer window, work-plane overlay,
direct input drawer, and inspector drawer.
