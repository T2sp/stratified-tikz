# StratifiedTikZ specification

## Goal

StratifiedTikZ is a browser-based editor for drawing stratified diagrams used in graphical calculus.

The app supports two ambient modes:

- 2D mode: diagrams in R^2
- 3D mode: diagrams in R^3

The app should allow users to create diagrams consisting of strata, preview them in a canvas, edit their coordinates either numerically or graphically, and export readable TikZ code.

The toolbar also supports diagram-level symbolic variables. In the Phase 19B
MVP, variable names are letter-only TeX macro names such as `R` and `q`; their
expressions are validated scalar expressions, evaluated for SVG preview values,
and exported as `\pgfmathsetmacro`.

## Core mathematical convention

The term **n-stratum** means **codimension n**, not geometric dimension n.

In 2D mode:

| Codimension | Geometric object | Typical categorical role |
|------------|------------------|---------------------------|
| codim 0 | 2-dimensional region | object |
| codim 1 | curve / wire | 1-morphism |
| codim 2 | point / vertex / coupon | 2-morphism |

In 3D mode:

| Codimension | Geometric object | Typical categorical role |
|------------|------------------|---------------------------|
| codim 0 | 3-dimensional region | object |
| codim 1 | surface / sheet | 1-morphism |
| codim 2 | curve / line defect | 2-morphism |
| codim 3 | point / junction | 3-morphism |

The internal data model must use `codim`.

Every diagram must specify its ambient dimension:

```ts
ambientDimension: 2 | 3
```

A stratum is valid only if:

```ts
0 <= codim && codim <= ambientDimension
```

## Initial scope

The first version is not a full CAD system.

It is a diagram editor optimized for mathematical graphical calculus and readable TikZ export.

The MVP should support:

- 2D and 3D ambient modes
- codim 0 filled regions in 2D mode
- codim 1 curves in 2D mode
- codim 2 points in 2D mode
- codim 1 sheets in 3D mode
- codim 2 curves in 3D mode
- codim 3 points in 3D mode
- labels
- layer ordering
- layer names as diagram metadata
- coordinate editing by direct input
- coordinate editing by cursor input
- solid / dashed / dotted line styles
- opacity for sheets
- JSON save/load
- readable TikZ export

## Non-goals for MVP

The MVP does not need:

- full 3D mesh editing
- automatic topological validation
- automatic occlusion computation
- arbitrary smooth stratified spaces
- live LaTeX compilation
- complete category-theoretic source/target checking
- automatic conversion between 2D and 3D diagrams

## Mode switching

The user may choose either 2D mode or 3D mode when creating a new diagram.

For the MVP, switching between 2D and 3D modes is allowed only when the diagram is empty.

If the diagram is non-empty, the user should create a new diagram to switch ambient dimension.

Later versions may support:

- embedding a 2D diagram into a plane in 3D
- projecting a 3D diagram to a 2D diagram
- converting codimensions when mathematically meaningful

## UI layout

The app should roughly have:

```text
+---------------------------------------------------------------+
| Toolbar                                                       |
| Mode: [2D] [3D]  Input: [Cursor] [Direct]                     |
+-------------------------------+-------------------------------+
| Canvas / preview              | Inspector                     |
|                               | selected stratum properties    |
+-------------------------------+-------------------------------+
| Generated TikZ source                                         |
+---------------------------------------------------------------+
```

## Coordinate input modes

The app supports two coordinate input methods.

### Direct input mode

In direct input mode, the user edits coordinates numerically in the inspector.

For example, a selected point should expose fields such as:

```text
x: 0.0
y: 1.0
z: 0.0
```

In 2D mode, the z field should either be hidden or locked to 0.

In 3D mode, direct creation forms support a coordinate mode selector. Global
mode keeps ordinary `(x, y, z)` input. Active work-plane local mode takes
2-coordinate input `(a, b)` in the active plane basis:

```text
P = origin + a u + b v
```

The created point is committed as an ordinary model-space `Vec3`. The active
work plane remains editor/UI state and is not saved as diagram data.

For cubic Bézier direct creation, absolute controls are ordinary point rows.
Relative Cartesian controls use start, end, first offset, and second offset
rows, with the second offset relative to the end point. Relative polar controls
use start, end, first angle/radius, and second angle/radius rows. Global 3D
relative polar creation is not supported; in 3D, polar relative controls are
available only in active work-plane local mode. In that mode, the committed
curve still stores absolute `Vec3` Bézier points for rendering and editing, and
also stores curve-level work-plane frame metadata for later local TikZ export.

Direct input is the canonical precise input method.

Coordinate text fields may also contain validated scalar expressions using
diagram variables and elementary functions:

```text
R = 2
q = 30
x = R*cos(q)
y = R*sin(q)
```

The editor evaluates expressions with current variable preview values for SVG
preview, but TikZ export preserves symbolic components as PGFMath expressions,
for example `({\R * cos(\q)}, {\R * sin(\q)})`. Trigonometric functions use
degrees, matching PGFMath/TikZ. Label text is not automatically wrapped in math
mode; users type `$...$` themselves when desired.

Expressions reject unknown variables, raw TeX/backslashes, braces, semicolons,
newlines, unsupported functions, invalid syntax, division by zero, and
non-finite preview values. In 2D diagrams z remains numeric 0. In the Phase 19C
MVP, symbolic input is supported for global coordinate fields; active
work-plane-local direct input, 3D template centers, curved sheet anchors, and
sampled boundary-surface path snapshots remain numeric-only and reject symbolic
values.

Direct input also supports generated grid strata. A grid stores a lattice
pattern, numeric or symbolic scalar fields for `uRange`, `vRange`, and a
rectangular clip. Supported patterns are rectangular, triangular, and
honeycomb. SVG preview uses finite preview values and rejects invalid steps,
reversed ranges, non-finite values, and grids above the line/edge-count cap.
TikZ export uses compact `\foreach` loops with `\clip`; in 3D, the grid is
emitted in the saved work-plane-local frame with `canvas is plane`. MVP
rectangular `\foreach` range triplets must be numeric, while rectangular
symbolic clip endpoints are allowed when they parse and evaluate safely.
Triangular spacing and honeycomb edge length use `uRange.step`; their compact
TikZ loops currently require numeric ranges and clip bounds.

### Cursor input mode

In cursor input mode, the user places or moves points using the mouse or trackpad.

In 2D mode, a screen position is converted to a model coordinate `(x, y, 0)`.

In 3D mode, a screen position alone does not determine a unique 3D point. Therefore, the user must choose an active work plane.

The initial 3D MVP should support these work planes:

- xy-plane at fixed z
- xz-plane at fixed y
- yz-plane at fixed x

For example:

```ts
workPlane = { kind: "xy", z: 0 }
```

means that cursor input creates or moves points in the plane z = 0.

The inspector should show the active work plane and its fixed coordinate.

The 3D toolbar also supports a custom work plane by numeric origin and normal
vector, and by three numeric points:

```text
Custom plane by origin + normal
Origin: x, y, z
Normal: nx, ny, nz
Apply

Custom plane by 3 points
P0: x, y, z
P1: x, y, z
P2: x, y, z
Apply

Pick 3 points for work plane
Picked 0/3 points
Reset / Cancel / Apply
```

The inputs must be finite numbers, and the normal vector must be nonzero. A
successful apply creates an active custom work plane named "Custom plane" from
the origin and normalized normal. For the three-point form, the points must be
finite, distinct, and non-collinear; `P0` is the origin and `P1 - P0` determines
the preferred `u` direction. Invalid input reports a concise status and leaves
the previous active work plane unchanged.

The existing-point workflow is also 3D-only. Activating it starts an editor-only
point-picking mode: clicking visible point strata records their IDs without
changing ordinary selection and without creating geometry. The picker requires
three distinct point strata, rejects duplicate picks, and applies a custom plane
from the current point positions. If picked point strata disappear while picking,
the unavailable IDs are removed from the picker state. Work-plane picking state
and previews are not part of the diagram and are not exported to TikZ.

Custom 3D work planes are represented internally by ordinary `Vec3` model
coordinates: an `origin`, normalized in-plane basis vectors `u` and `v`, and a
normalized `normal` with `normal = cross(u, v)`. This active work-plane state is
a cursor-input drawing aid, not diagram content, and must not affect TikZ
generation except through committed model coordinates. Work-plane controls are
hidden in 2D mode, and entering 2D mode resets the active work plane to the
ordinary xy-plane at `z = 0`.

Projection/camera state is separate from work-plane geometry. The editor maps a
model point to screen coordinates through camera/projection data, and maps a
screen point back to model space by intersecting it with the currently active
model-space work plane. Work-plane definitions must not store camera-specific
assumptions. Saving/loading diagrams and TikZ export use committed diagram
coordinates only, never transient active work-plane or point-picking state.
Loading a diagram resets active work-plane UI state; undo/redo validates or
clears point-picking and active custom-plane source IDs when the referenced
point strata no longer exist.

When a custom work plane is active in 3D, the canvas shows a preview-only guide
with a translucent plane patch, outline, origin marker, direction indicators for
`u` and `v`, a normal indicator, and a `custom work plane` label. The guide is
not selectable, does not intercept pointer events, is not saved in the diagram,
and is not exported to TikZ. Axis-aligned work planes remain available for
cursor placement without using this custom guide.

In 3D mode, the SVG preview also shows a faint xyz coordinate axes guide by
default. This guide is centered at the model origin, is not a stratum, is not
selectable, does not intercept pointer events, and exists only as editor/display
state. It is separate from the active work-plane preview. TikZ export includes
this axes guide only when the user enables the TikZ axes export option.

Cursor creation on an active custom plane applies to points, free text labels,
polylines, cubic Bezier curves, and polygon sheets. The click position is
projected onto the active custom plane and the result is committed as ordinary
global `Vec3` diagram coordinates. Direct creation can also use active
work-plane local `(a, b)` coefficients, but the committed geometry is still
ordinary `Vec3` diagram data.

Direct creation for path-like geometry can also use existing diagram
coordinates as sources. Supported sources are point stratum positions, existing
polyline vertices in 2D and 3D, polygon sheet vertices in 3D, and cubic Bezier
start/control/end points. Source labels include the source kind, stratum name,
id disambiguator, vertex/control role when applicable, and formatted
coordinates, so duplicate default names remain distinguishable.

Cursor creation can also use existing point strata as coordinate sources for
polylines, cubic Bezier curves, and polygon sheets: clicking an existing point
while a creation tool is active copies that point's current coordinate into the
draft. This is copy-on-create only for both direct and cursor workflows: choosing
or clicking a source copies the source's current model-space `Vec3` into the new
geometry, and the created geometry stores no live reference to the original
source. Moving, editing, or deleting the source later does not update or
invalidate the created geometry. In active work-plane local mode and ordinary
3D cursor creation, an existing source must already lie on the active work plane
within tolerance; off-plane sources are rejected rather than silently projected.
The exception is cross-work-plane concatenated path creation, where an existing
point source may be copied as its finite absolute `Vec3` because the active work
plane is an editing aid rather than a path-wide constraint.

### Closed-boundary fills

The model supports filled objects whose boundary is one or more closed paths.
In 2D, a filled object is a codim 0 `filledRegion`. In 3D, a planar filled
object is a codim 1 `workPlaneFilledSheet` with a stored orthonormal work-plane
frame snapshot. A boundary is committed `PathSegment[]` geometry made from line
and cubic Bézier segments; it is copied at creation time and is not a live
reference to source paths.

Each filled object stores `fillRule: "nonzero" | "evenOdd"`. Multiple boundary
components are allowed, and `evenOdd` is supported for holes and nested
components. The saved model rejects empty boundary lists, open boundaries,
non-finite coordinates, invalid fill rules, nonzero `z` coordinates in 2D
filled regions, and 3D work-plane filled sheet boundary points that do not lie
on the stored plane. Self-intersection and boolean cleanup are intentionally
deferred.

The editor can create a filled object from picked closed concatenated paths.
Because ordinary selection is currently single-selection, the fill workflow
keeps a UI-only list of picked path IDs: select a concatenated path, pick it as
a boundary, repeat for additional boundaries, choose `nonzero` or `evenOdd`,
then create the fill. Creating the fill copies the selected path segments into
the filled stratum; it does not store live references to the source paths, so
later source-path edits do not change the fill. In 2D this creates a codim 0
`filledRegion` with `z = 0` boundary coordinates. In 3D this creates a codim 1
`workPlaneFilledSheet` only when all picked boundaries lie on one reliable
plane, preferring the active work plane when applicable and otherwise deriving a
plane from non-collinear boundary points. Non-coplanar 3D picks are rejected.

### Boundary surface sheets

The model supports two additional 3D codim 1 sheet primitives for Phase 20A:
ruled surfaces and Coons patches. These are saved as `curvedSheet` primitives
with copied boundary path snapshots, not live references to source curve
strata. Editing, moving, or deleting an original source path after surface
creation must not mutate the surface.

Boundary snapshots are deterministic concatenated `PathSegment[]` geometry.
The boundary evaluator supports line, cubic Bezier, 3D arc, and sampled path
template geometry. Circle and ellipse templates are copied into ordinary path
segments at creation time. Boundaries must be non-empty, composable, finite, and
sample to finite points. Boundary-surface coordinates are numeric-only for now
because preview and export derive sampled mesh coordinates.

A ruled surface from boundaries `C0` and `C1` uses:

```text
S(u, v) = (1 - v) C0(u) + v C1(u)
```

Both boundaries are sampled at the same deterministic `u` values. The saved
resolution is a positive integer `{ segments }`, capped by the shared curved
sheet sampling cap. Both boundaries must have the same closure status; a
closed/open mismatch is rejected.

A Coons patch uses four oriented boundaries: bottom and top run left to right,
while left and right run bottom to top. The sampler uses:

```text
S(u, v)
= (1 - v) bottom(u) + v top(u)
+ (1 - u) left(v) + u right(v)
- bilinearCornerBlend(u, v)
```

The validator requires bottom start = left start, bottom end = right start, top
start = left end, and top end = right end. During creation, each picked Coons
boundary can be reversed in the Add sheet draft before validation; this changes
only the copied boundary snapshot, not the source path. The sampler returns the existing finite
quad mesh representation used by curved sheets: a deterministic flat vertex
array plus quad index faces and boundary polylines for later rendering,
depth-sorting, and TikZ export work. User-facing creation supports ruled
surfaces from two boundary paths and Coons patches from explicit bottom, right,
top, and left boundary roles. The workflow does not infer unordered roles
automatically. Both workflows store copied boundary geometry, not live
references.

### Concatenated path editing

Concatenated path cursor creation has two 3D modes. Same-work-plane mode keeps
the earlier safety behavior: the draft captures one work plane, rejects points
off that plane, and blocks active work-plane changes until Finish or Cancel.
Cross-work-plane mode allows the active work plane to change during path
creation, so each next point may be placed on the currently active plane while
the draft remains one concatenated path. In both modes, committed path segment
points are absolute model-space `Vec3` coordinates, and work-plane choices are
not stored in `Diagram` unless future persistent segment-local metadata is added
for a specific export feature.

Committed concatenated paths are editable after selection. The inspector shows
segments in order with one-based user-facing segment numbers:

```text
Segment 1: Line
  Start
  End

Segment 2: Cubic Bezier
  Start
  Control point 1
  Control point 2
  End
```

Inspector coordinate fields reject invalid numeric input. In 2D mode the `z`
coordinate is hidden and edited points stay on `z = 0`; in 3D mode all three
coordinates are editable. When an endpoint is shared between adjacent segments,
editing either copy updates both stored endpoints. The editor must never commit
a concatenated path whose adjacent endpoints disagree.

Selected concatenated paths show SVG drag handles for path vertices and cubic
Bézier control points. Shared joins are rendered as one draggable vertex handle;
dragging the join updates the previous segment end and next segment start
together. In 2D, drags keep `z = 0`. In 3D, drags are projected through the
active work plane unless future path-local work-plane metadata supplies a more
specific editing plane. Drag handles are UI state only and are not saved or
exported.

Cubic path segments may use absolute controls, relative Cartesian controls, or
2D relative polar controls where the existing Bézier control infrastructure
supports those modes. Editing endpoints preserves supported relative controls by
recomputing absolute control points from the stored offsets. Directly editing or
dragging a control point converts that cubic segment to absolute controls.

The current segment operations are append line segment, append cubic Bézier
segment, and remove last segment. Appended segments begin at the existing final
endpoint. Removing the last remaining segment is blocked to keep the path valid;
users can delete the whole selected path stratum instead.

Each concatenated path segment exposes a segment style override panel in the
inspector. The fields are stroke color, stroke opacity, line width, and line
style (`solid`, `dashed`, `dotted`, or `denselyDotted`). Empty overrides inherit
the path-level curve style. The clear action removes the segment override and
restores inheritance. Preview rendering and TikZ export both use the resolved
segment style.

### Hybrid editing

The user may create a point by cursor input and later refine it by direct input.

The user may also enter coordinates directly and then adjust them by dragging.

The data model should not distinguish permanently between points created by cursor input and points created by direct input. The distinction belongs to the editor state, not to the diagram itself.

## Rendering model

In 2D mode, the preview uses ordinary 2D coordinates.

In 3D mode, the preview uses an orthographic camera model aligned with
`tikz-3dplot` main-coordinate notation:

```tex
\tdplotsetmaincoords{theta}{phi}
```

The public/model angle fields are therefore named `thetaDeg` and `phiDeg`, not
ambiguous yaw/pitch labels. The only supported production 3D camera is
orthographic:

```ts
type OrthographicCamera3D = {
  mode: "3d";
  kind: "orthographic";
  thetaDeg: number;
  phiDeg: number;
  zoom: number;
  pan: Vec2;
  // Deprecated legacy metadata.
  projectionBasis?: Camera3DProjectionBasis;
};
```

The type model reserves a hidden scaffold for future perspective work:

```ts
type Camera3D = OrthographicCamera3D | PerspectiveCamera3D;
```

Perspective camera metadata may be structurally recognized by validation, but
it is not supported by the UI, SVG projection, work-plane picking, save/load
activation, or TikZ export in the current phase. Unsupported perspective
operations must fail clearly instead of silently falling back to an
orthographic interpretation.

Forward projection follows:

```text
model-space Vec3 -> camera projection -> SVG point
```

Inverse cursor workflows are structured as:

```text
screen/SVG point -> camera ray -> active work-plane intersection
```

For the current orthographic camera, all screen points produce parallel rays.
Future perspective picking should replace the camera-ray step with rays from
the camera origin through the screen point, while keeping work-plane geometry in
model space.

The resettable initial 3D camera is tikz-3dplot-aligned: its preview basis is
derived from the same `thetaDeg` and `phiDeg` values exported to TikZ.
Deprecated `projectionBasis` metadata may appear in old saved data, but it does
not override the angle-derived preview/export orientation. Camera/view state
remains separate from work-plane model geometry.

The persisted 3D camera is diagram-level view metadata, stored as
`diagram.view.camera3d` when present. It is not a stratum and is not work-plane
geometry. If a saved file omits camera metadata, loading uses the initial camera.
If saved camera metadata is invalid, loading falls back to the initial camera and
may surface a warning in the file-load status.

Camera controls are view operations and do not create geometry undo entries.
Geometry created or edited under the current camera is still committed as
ordinary model coordinates and remains undoable. Reset to the initial/default
display must always be available; reset to the last saved/loaded camera may be
offered when applicable.

Generated 3D TikZ aligns with the current camera orientation using
`tikz-3dplot`: the exporter emits `\tdplotsetmaincoords{theta}{phi}` from the
camera `thetaDeg` and `phiDeg`, and uses `tdplot_main_coords` on the
`tikzpicture`. Geometry remains model-space 3D coordinates; zoom and pan remain
SVG-view-only. This is an orthographic-like `tikz-3dplot` orientation, not
perspective projection. Future perspective export may require different PGF/TikZ
settings or a documented fallback. Reset to the initial/default camera remains
available.

## TikZ output principle

Generated TikZ must be readable and editable by humans.

It should be grouped into sections:

- Styles
- Coordinates
- Codimension 1 strata
- Codimension 2 strata
- Codimension 3 strata, only in 3D mode
- Labels

The output should use semantic style names such as:

- `visible codim one line`
- `codim one sheet`
- `visible codim two line`
- `hidden codim two line`
- `codim two dot`
- `codim three dot`

## Visual style customization

The user must be able to customize the visual appearance of each visible stratum.

Every visible stratum should support:

- color
- opacity

More specific controls depend on the geometric kind of the stratum.

## Sheet style customization

For geometric 2-dimensional strata, namely sheets in 3D mode, the user should be able to edit:

- fill color
- fill opacity
- boundary color
- boundary opacity

The default sheet style is:

- fill color: light blue
- fill opacity: 0.35
- boundary color: matching blue
- boundary opacity: 1

## Curve style customization

For geometric 1-dimensional strata, namely curves, the user should be able to edit:

- stroke color
- stroke opacity
- line width
- line style

Supported line styles for the MVP:

- solid
- dashed
- dotted

Later versions may support:

- densely dashed
- loosely dashed
- dash-dot
- double line
- oriented line with arrowheads

The default curve style is:

- stroke color: black
- stroke opacity: 1
- line width: 1.2pt
- line style: solid

## Point style customization

For geometric 0-dimensional strata, namely points, the user should be able to edit:

- point color
- point opacity
- point shape
- filled or hollow style
- point size

Supported point shapes for the MVP:

- circle
- square
- triangle
- star

Each point shape should have two variants:

- filled
- hollow

The default point style is:

- shape: circle
- fill: filled
- color: black
- opacity: 1
- size: 3pt

## Style editing UI

When a stratum is selected, the inspector should show style controls appropriate to its `geometricKind`.

For a sheet:

```text
Fill color
Fill opacity
Boundary color
Boundary opacity
Layer
```

For a curve:

```text
Stroke color
Stroke opacity
Line width
Line style
Layer
```

For a point:

```text
Point color
Point opacity
Point shape
Filled / hollow
Point size
Layer
```

In the MVP, colors may be selected by a browser color picker and stored as hex colors.

Opacity should be represented as a number between 0 and 1.

Line width should be represented in points.

For example:

```text
1.2pt
```

Internally, line width may be stored as a number:

```ts
lineWidth: 1.2
```

and interpreted as points in TikZ output.

Point size should also be represented in points.

For example:

```ts
size: 3
```

means 3pt in TikZ output.

## Layer metadata

Every rendered element continues to store numeric `layer` membership. Layer
names are diagram-level metadata:

```ts
type DiagramLayer = {
  value: number;
  name: string;
  visible?: boolean;
  locked?: boolean;
};
```

Old diagrams may omit `diagram.layers`. The editor derives default metadata from
used numeric layer values and names them `Layer <value>`. The Layer Manager
foundation shows the layer name, numeric value, and count of strata plus free
text labels on that value. The current layer filter, selected creation layer,
and panel expanded/collapsed state are editor/UI state, not layer metadata.

Layer names may be edited without changing any element's numeric `layer` value.
Blank edited names are normalized to the safe default `Layer <value>`.
Duplicate layer names are allowed; the Layer Manager always shows the numeric
value beside the name for disambiguation.

Layer visibility is persisted metadata. Hidden layers are not rendered in the
SVG preview and cannot remain selected, but they are still exported to TikZ by
default. Layer locking is also persisted metadata. Locked layers remain visible
but are not selectable or editable through ordinary preview/inspector actions.
Layer Manager operations may still unlock, rename, swap, duplicate, translate,
or delete locked layers.

Swapping two layers exchanges element membership by numeric value for all strata
and free text labels:

```text
if layer === A, set layer = B
if layer === B, set layer = A
```

Layer metadata names are swapped at the same time, so the named visual layer
identity follows the moved contents. Display order remains deterministic numeric
ascending by `DiagramLayer.value`; display order alone never changes element
membership or TikZ ordering.

Duplicating a layer copies every stratum and free text label on the source
numeric layer to a target numeric layer. The default target is the nearest
finite unused value above the source, and the default target metadata name is
`<source name> copy`. The user may provide a finite target value; if that value
already has metadata, its existing name is preserved. Copied top-level elements
receive deterministic new ids by appending `-copy`, `-copy-1`, and so on. Nested
boundary ids and curve style segment ids are regenerated too. Non-empty copied
path labels append ` copy`, then ` copy 2`, etc. until the sanitized TikZ
`spath/save` name is unused.

Deleting a layer removes all strata and free text labels on that layer and
removes the layer metadata entry. Other layers, including empty metadata-only
layers, are unchanged. The operation is undoable; the editor clears stale
selection, layer filters, drafts, and coordinate-source selections that refer to
deleted elements.

Translating a layer moves all absolute coordinates stored by strata and free
text labels on that numeric layer. In 2D, only `dx` and `dy` are accepted and
coordinates remain at `z = 0`. In 3D, `dx`, `dy`, and `dz` are accepted. The
operation is one undoable diagram edit and must reject non-finite inputs or
results.

See [Layer Manager](./LAYER_MANAGER.md) for the user-facing operation summary.

## Style presets

The app may provide style presets for convenience, but the user must not be
restricted to presets.

Built-in presets are read-only shortcuts. Applying a built-in preset copies
explicit structured style values into the selected element.

User presets are editable diagram-level data stored in `diagram.userStylePresets`.
They have stable ids, user-visible names, compatible style kinds, explicit
structured style values, and sanitized `tikzStyleName` values. Applying a user
preset copies explicit style values and records `stylePresetId` on the selected
compatible element. Manual style edits clear that reference.

The Inspector should group presets by origin: built-in, user, and imported.
Built-in presets are shown as read-only shortcut controls. User presets expose
clear apply, rename, delete, and style-edit controls. Imported presets expose the
imported key, source name, load hint, parsed preview options when available, and
editable target tags. Long imported preset lists must remain scrollable and
filterable so a large `.sty` file does not overflow the Inspector.

The actual element style object remains the model source of truth. Generated
TikZ may reference a local user preset style only when the element style still
matches that preset; otherwise it should emit inline structured style options.
Phase 17A user preset definitions are emitted as local options of
`\begin{tikzpicture}[...]`, not as a pre-picture `\tikzset{...}` block.

Imported TikZ styles are external references. Diagram data may store
`externalTikzStyleSources`, `importedTikzStyleReferences`, and optional
`importedTikzStyleReferenceId` values on elements or user presets. Imported keys
are emitted as TikZ option keys in deterministic command option order. When a
matching local user preset style name is used, it comes first and the applicable
imported external style key follows it; structured inline fallback options are
not emitted for that element style. When no matching local preset is used, the
applicable imported external style key is emitted before any structured inline
fallback options. Thus imported keys follow matching local preset style names
but precede structured fallback options in fallback commands. The generator must
not inline full external `\tikzset{...}` definitions and must not emit an active
`\input{...}` by default; it only emits comments that list the external style
files/load hints the user should include in the LaTeX preamble or before the
picture.

Imported `.sty` / `.tex` files are parsed with a limited `\tikzset` extractor,
not a full TeX parser. The supported subset is multiple braced `\tikzset{...}`
blocks, `.cd` prefixes, top-level comma-separated entries, and
`key/.style={...}` entries with simple nested braces in the option body.
Unsupported entries are skipped with warnings. The importer does not expand
macros, resolve `\input`, evaluate TeX conditionals, or execute TeX. Parsed
option bodies may be saved as metadata on imported style references, but export
continues to use external-load comments rather than inlining the original
`\tikzset`.

The importer heuristically detects useful preset candidates from style keys and
option bodies. Keys containing `/color/` or simple color/opacity options produce
editable color presets for curves, sheets, regions, labels, and points. Keys
containing `/shape/` or simple node-shape options produce editable point/label
presets. The SVG preview approximation intentionally handles only common
options such as named colors, `red!60`-style xcolor mixes, opacity, fill/draw
opacity, dashed/dotted/densely dotted, `thick`, `thin`, and simple
`line width=<...>` values. Unsupported options are ignored for preview, but the
imported key and source metadata remain saved so TikZ export can use the
external definition.

Import/status messages should be concise and explicit for failed import,
unsupported TikZ syntax skipped, duplicate imported keys, invalid preset names,
incompatible imported preset targets, and missing external sources. Imported
style UI must warn that the SVG preview is approximate and that external style
files must be loaded by the user; generated TikZ comments load instructions but
does not inline external `\tikzset`.

## Free text labels

The user must be able to place arbitrary text or mathematical labels at arbitrary positions.

A free text label is exported to TikZ in the form:

```tex
\node at (#1) {#2};
```

Here `#1` is the label coordinate and `#2` is the label content.

The coordinate `#1` can be specified either by:

- direct numeric input
- cursor-based graphical input

The label content `#2` is entered as general text data.

If the user wants to display a mathematical formula, the user should explicitly include LaTeX math delimiters.

Examples:

```text
C
$F$
$F^{(1)}L$
$\alpha \colon f \Rightarrow g$
```

The app must not automatically wrap label content in `$...$`.

The app should preserve the label content exactly, except for minimal escaping needed to keep the generated TikZ syntactically valid.

## Label placement

In 2D mode, a label position is stored internally as a `Vec3` with `z = 0`.

For example, the model coordinate:

```ts
{ x: 1.2, y: 0.5, z: 0 }
```

is exported as:

```tex
\node at (1.2,0.5) {$F$};
```

In 3D mode, a label position may use all three coordinates.

For example:

```ts
{ x: 1.2, y: 0.5, z: 2.0 }
```

is exported as:

```tex
\node at (1.2,0.5,2.0) {$F$};
```

## Label input modes

Free text labels support the same coordinate input modes as other diagram elements.

### Direct input for labels

In direct input mode, the inspector should expose:

```text
Text content
x
y
z, only in 3D mode
Layer
```

In 2D mode, the z coordinate should be hidden or locked to 0.

### Cursor input for labels

In cursor input mode, the user can select the label tool and click on the canvas to place a label.

After placement, the inspector should allow editing the label content.

In 3D mode, cursor placement of labels uses the active work plane.

For example:

```ts
workPlane = { kind: "xy", z: 0 }
```

means that clicking on the canvas creates labels on the plane z = 0.

## Label independence

Free text labels are independent diagram objects.

They are different from optional labels attached to strata.

For example, a curve stratum may have a label field, but the user should also be able to place additional standalone text labels anywhere in the diagram.

## Partial style changes along curves

Ideally, the editor should support partial style changes along geometric 1-dimensional strata.

This is useful for representing overlaps, under-crossings, or hidden parts of a curve.

For example, a user may want one portion of a curve to be drawn as a solid line and another portion to be drawn as a densely dotted line.

The intended user workflow is:

1. Select a curve.
2. Select a subrange along the curve.
3. Choose a style override for that subrange.
4. The preview updates to show the selected range with the overridden style.
5. The TikZ output emits the curve as multiple path segments with different styles.

For example, conceptually:

```tex
\draw[visible curve style]
  (p0) .. controls (c1) and (c2) .. (q0);

\draw[densely dotted curve style]
  (q0) .. controls (d1) and (d2) .. (q1);

\draw[visible curve style]
  (q1) .. controls (e1) and (e2) .. (p1);
```

This feature is useful but not required for the MVP.

For the MVP, each curve may have a single global style.

The data model should nevertheless avoid assumptions that make partial style segments impossible later.

## Curve range selection

A partial style segment should be represented by a parameter range along the curve.

For example:

```ts
from: 0.35
to: 0.55
```

where `from` and `to` lie in `[0, 1]`.

For a polyline, the parameter may be interpreted by normalized arclength.

For a cubic Bézier curve, the parameter may initially be interpreted as the Bézier parameter.

Later versions may use arclength parameterization for more predictable UI behavior.

## Densely dotted hidden segments

The main initial use case is to mark a subrange of a curve as hidden or overlapped.

The preferred visual style for such a subrange is:

```tex
densely dotted
```

The UI may expose this as:

```text
Mark selected range as hidden / densely dotted
```

or:

```text
Segment style: densely dotted
```
