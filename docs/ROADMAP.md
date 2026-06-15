# Roadmap

## Phase 0: Project setup

Status: in progress

Tasks:

- Create Vite + React + TypeScript app
- Initialize Git repository
- Add project documentation
- Push to GitHub

# Completed phases

## Phase 1: Data model

Implemented the core diagram model.

Main points:

* Diagram stores persistent diagram data.
* ambientDimension: 2 | 3 is part of the diagram.
* All internal coordinates are Vec3.
* In 2D, z is hidden/locked/ignored and should remain 0.
* Strata use codimension conventions:
    * 2D:
        * codim 0: region
        * codim 1: curve
        * codim 2: point
    * 3D:
        * codim 0: region
        * codim 1: sheet
        * codim 2: curve
        * codim 3: point
* geometricKind and codim are distinct.
* Free text labels are first-class objects in diagram.labels.
* Style data is stored explicitly on strata and labels.
* Editor-only state is not stored in Diagram.

⸻

## Phase 2: Geometry and projection

Implemented geometry and projection helpers.

Main points:

* Projection from model coordinates to screen coordinates.
* Conversion from screen coordinates to model coordinates.
* 2D coordinate conversion.
* 3D active work-plane coordinate conversion.
* Supported work planes:
    * xy
    * xz
    * yz

⸻

## Phase 3: TikZ generation

Implemented readable TikZ output.

Main points:

* 2D and 3D TikZ output.
* Coordinates are emitted explicitly.
* Styles and colors are emitted in a readable way.
* Points, curves, sheets, and labels are exported.
* Selection/highlighting does not affect TikZ output.
* Labels are exported as TikZ nodes.

⸻

## Phase 4: Static SVG preview

Implemented SVG preview.

Main points:

* Static rendering of diagrams.
* 2D and 3D projection.
* Correct coordinate orientation.
* Basic rendering of sheets, curves, points, and labels.
* Preview-only highlighting remains outside TikZ output.

⸻

## Phase 5: Basic UI

Implemented the main UI shell.

Main points:

* Header and toolbar.
* Example selector.
* SVG preview.
* TikZ source display.
* Copy TikZ button.
* Coordinate input mode selector:
    * cursor
    * direct

At this phase, direct input mode may not yet have full creation behavior.

⸻

## Phase 6: Inspector, editing, and styles

Implemented selection and inspector editing.

Main points:

* Select strata and free text labels.
* Read-only inspector.
* Editable inspector.
* Coordinate editing.
* Name and layer editing.
* Style editing.
* 2D coordinate display hides z.
* 3D coordinate display shows x, y, and z.
* Invalid numeric input is guarded.
* Blank stratum names are rejected or replaced safely.
* Cubic Bézier control points are displayed as:
    * Start
    * Control point 1
    * Control point 2
    * End

⸻

## Phase 7: Cursor-based creation tools

Implemented cursor-based creation.

Main points:

* Add point.
* Add free text label.
* Add polyline curve.
* Add cubic Bézier curve.
* Add 3D polygon sheet.
* Draft previews for curves and sheets.
* Finish/cancel behavior for drafts.
* Created objects are selected.
* Drafts remain UI/editor state.
* Drafts are not exported to TikZ.

Additional Phase 7 features:

* Correct click-to-viewBox mapping.
* 3D work-plane visualization.
* Work-plane preview is preview-only.
* Work-plane preview is not selectable.
* Work-plane preview is not exported to TikZ.
* 3D polygon sheets are created from closed polygon drafts.
* Polygon sheets are codim 1 strata.

⸻

## Phase 8: Save and load

Implemented JSON save/load.

Main points:

* Export current diagram as JSON.
* Import saved JSON diagram files.
* Versioned saved file format.
* Validation on import.
* Invalid files are rejected safely.
* UI/editor state is not saved.
* Selection and drafts are cleared or made safe after load.
* Download filename can be edited by the user.
* Sheet fill color editing includes a convenience for matching stroke color.

⸻

# TODO

## Phase 9: Foundational TikZ semantics

Phase 9 makes existing diagram metadata meaningful in TikZ output.

This should be done before more advanced geometry features, because later phases depend on readable coordinate names, layer-aware output, and path labels.

⸻

### Phase 9A: User-controlled coordinate-name stems

Current issue:

Generated TikZ coordinate names use patterns such as:

point + point + #1 + 0
curve + Poly + curve + #1 + #2
curve + Bezier + curve + #1 + #2
sheet + Poly + sheet + #1 + #2

That is, coordinate names effectively have the form:

geometricKind + optionalType + geometricKind + elementIndex + coordinateIndex

The repeated geometricKind part is not useful.

Also, each stratum already has an editable Name field in the inspector, but changing the Name currently does not affect TikZ coordinate names.

Goal:

Use the stratum Name as a user-controlled TikZ coordinate-name stem.

Suggested new pattern:

geometricKind + optionalType + sanitizedName + elementIndex + coordinateIndex

Examples:

pointParticle0p0
curvePolyBoundary1p0
curvePolyBoundary1p1
curveBezierFLine2p0
curveBezierFLine2p1
curveBezierFLine2p2
curveBezierFLine2p3
sheetPolySurface0p0
sheetPolySurface0p1
sheetPolySurface0p2

Requirements:

* The default Name remains the geometric kind, such as point, curve, or sheet.
* Editing Name in the inspector changes generated TikZ coordinate names.
* Names must be sanitized for TikZ coordinate safety.
* Blank or invalid names must fall back to safe defaults.
* Coordinate names must remain unique even when multiple elements have the same Name.
* Geometry and drawing semantics must not change.
* Selection/highlighting must not affect TikZ output.

Out of scope:

* Displayed free text labels.
* TikZ macro export.
* Import from TikZ.

⸻

### Phase 9B: Layer-aware TikZ output

Current issue:

The inspector can edit layer, but generated TikZ does not reflect layer information.

Goal:

Make layer values meaningful in generated TikZ.

Requirements:

* Group draw commands by layer.
* Use pgfonlayer or an equivalent TikZ mechanism.
* Preserve element ordering within each layer.
* Emit deterministic layer names.
* Keep generated TikZ readable.
* Keep selection/highlighting out of TikZ.

Possible output structure:

\pgfdeclarelayer{stratifiedLayer0}
\pgfdeclarelayer{stratifiedLayer1}
\pgfsetlayers{stratifiedLayer0,stratifiedLayer1,main}
\begin{pgfonlayer}{stratifiedLayer0}
  ...
\end{pgfonlayer}
\begin{pgfonlayer}{stratifiedLayer1}
  ...
\end{pgfonlayer}

Notes:

* The exact layer naming convention may differ.
* Layer names must be TikZ-safe.
* Negative layer values should be handled deterministically if supported.

Out of scope:

* Undo/redo.
* Advanced layer manager UI.
* Layer opacity.
* Per-layer visibility persistence.

⸻

### Phase 9C: Layer-based selection and filtering

Motivation:

In 3D diagrams, elements can overlap and become difficult to select.

Goal:

Add a UI option for selecting/filtering elements by layer.

MVP behavior:

* Add a layer filter control.
* Options include:
    * all layers
    * one specific layer value
* When a specific layer is selected:
    * only elements on that layer are selectable, or
    * other layers are visually de-emphasized and not selectable.

Requirements:

* Layer filter is UI/editor state.
* Layer filter is not stored in Diagram.
* Layer filter is not exported to TikZ.
* Layer filter should not affect generated TikZ.
* Remove/delete operations should only act on the actual selected element.

Out of scope:

* Persistent layer visibility settings.
* Per-layer locking.
* Per-layer style overrides.
* Complex layer panel UI.

⸻

### Phase 9D: spath/save integration for path labels

Current issue:

The inspector has a Path labels field, but it is not meaningfully connected to TikZ output.

Goal:

Connect optional path labels to TikZ spath/save.

Requirements:

* Path labels default to empty.
* If empty, do not emit spath/save.
* If non-empty, sanitize the path label for TikZ safety.
* Emit spath/save=<name> or equivalent syntax for path-like strata.
* Apply to:
    * polyline curves
    * cubic Bézier curves
    * polygon sheet boundaries if appropriate
    * future concatenated paths
    * future region boundaries
* Do not apply to point strata.
* Do not confuse path labels with free text labels.

Possible TikZ output:

\draw[<style>, spath/save=myPath] ...;

Notes:

* If spath/save requires a TikZ library or package, generated TikZ should include a clear comment.
* Advanced spath3 operations are not part of this phase.

Out of scope:

* Path intersection operations.
* Path splitting.
* Path reuse UI.
* Importing paths from TikZ.

⸻

## Phase 10: Basic editing completeness

Phase 10 fills the most important practical editing gaps.

⸻

### Phase 10A: Remove selected elements

Current issue:

Elements can be created, but not removed.

Goal:

Implement deletion/removal of selected diagram elements.

Requirements:

* Remove selected strata.
* Remove selected free text labels.
* Clear selection after removal.
* Keep SVG preview and TikZ output in sync.
* Preserve diagram validity.
* Add a toolbar button such as Remove selected.
* Add keyboard support for Delete or Backspace if simple.

Out of scope:

* Undo/redo.
* Bulk deletion.
* Delete confirmation dialog.
* Deleting non-selected elements.

Notes:

* Removal is a diagram edit.
* Selection remains UI/editor state.
* If layer filtering is active, remove only the actual selected element.

⸻

### Phase 10B: Direct-input creation MVP

Current issue:

The toolbar has Input: cursor/direct, but creation is currently cursor-based.

Goal:

Make Input: direct meaningful for basic objects.

MVP scope:

* Directly create point strata.
* Directly create free text labels.

UI direction:

When a creation tool is active and Input: direct is selected, show direct-input fields in the inspector or side panel.

For points:

* Name.
* Coordinates.
* Style may use defaults initially.

For free text labels:

* Name if applicable.
* Text.
* Coordinates.
* Style may use defaults initially.

Requirements:

* Use 2D coordinate fields in 2D mode.
* Use 3D coordinate fields in 3D mode.
* In 2D, z remains hidden/locked at 0.
* Direct-input creation should reuse the same model helpers as cursor creation.
* Invalid numeric input must not write NaN.
* Blank names should be rejected or replaced with safe defaults.
* Direct-input creation state is UI/editor state, not Diagram.

Out of scope:

* Direct creation of complex paths.
* Direct creation of sheets.
* Custom work planes.
* Undo/redo.

⸻

### Phase 10C: Direct-input creation for paths and sheets

Goal:

Extend direct-input creation to complex objects.

Scope:

* Create polylines by entering a list of vertices.
* Create cubic Bézier curves by entering:
    * Start
    * Control point 1
    * Control point 2
    * End
* Create 3D polygon sheets by entering a list of vertices.

Requirements:

* Add/remove coordinate rows.
* Validate minimum point counts:
    * polyline: at least 2 vertices
    * cubic Bézier: exactly 4 points
    * polygon sheet: at least 3 vertices
* Preserve existing cursor creation behavior.
* Respect ambient dimension:
    * 2D: z hidden/locked at 0
    * 3D: x, y, and z editable
* Reject non-finite coordinates.

Out of scope:

* Direct creation of concatenated paths.
* Direct creation of curved-boundary sheets.
* Custom local work-plane coordinates.

⸻

### Phase 10D: Cursor drag editing MVP

Current issue:

Existing path geometry can be edited manually in the inspector, but not by dragging in the SVG preview.

Goal:

Allow selected geometry to be edited by dragging visible handles.

MVP scope:

* Drag point strata.
* Drag free text labels.
* Drag polyline vertices.
* Drag cubic Bézier start/end/control points.
* Drag polygon sheet vertices if feasible.

Requirements:

* Show drag handles for the selected element.
* Drag handles are editor UI, not diagram data.
* Drag handles are not exported to TikZ.
* Dragging updates diagram data.
* SVG preview and TikZ output update after dragging.
* In 2D, dragged points remain at z = 0.
* In 3D, dragging should use a clear editing plane.
* Layer filtering should be respected.

Out of scope:

* Undo/redo.
* Snapping.
* Constraint handles.
* Multi-select drag.
* Advanced tangent-preserving Bézier edits.

⸻

## Phase 11: Bézier editing improvements

⸻

### Phase 11A: Relative and polar control-point editing

Goal:

Add alternative coordinate input modes for cubic Bézier control points.

Internal model:

* Keep cubic Bézier curves stored as absolute control points.
* Relative/polar representations are inspector editing conveniences.

Editing modes:

* Absolute coordinates.
* Relative Cartesian coordinates.
* Relative polar coordinates.

TikZ-style intuition:

(start) .. controls +(angle1:radius1) and +(angle2:radius2) .. (end)

Interpretation:

* Control point 1 is relative to the start point.
* Control point 2 is relative to the end point.
* Angles are in degrees.
* Radii are nonnegative.

2D behavior:

* Relative polar coordinates are interpreted in the xy-plane.
* z remains 0.

3D behavior:

* Initially interpret relative/polar controls in the active work plane.
* Custom work-plane support may follow later.

Out of scope:

* Changing the stored curve representation.
* Multi-segment Bézier paths.
* Relative TikZ export by default.

⸻

### Phase 11B: Optional TikZ relative-control export

Goal:

Optionally export cubic Bézier controls using relative polar syntax when possible.

Possible output:

(start) .. controls +(angle1:radius1) and +(angle2:radius2) .. (end)

Requirements:

* Absolute coordinate export remains the default.
* Relative export is an explicit TikZ output option.
* Diagram data remains unchanged.
* Output remains readable.

Out of scope:

* Changing inspector storage.
* Inferring relative controls for arbitrary non-planar 3D paths unless a plane is specified.

⸻

## Phase 12: Arbitrary work planes

⸻

### Phase 12A: Custom work-plane data and validation

Goal:

Introduce custom 3D work planes.

Suggested representation:

type CustomWorkPlane = {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
};

Requirements:

* origin, u, and v are finite.
* u and v are nonzero.
* u and v are not parallel.
* Custom work planes are UI/editor state initially.
* Existing xy, xz, and yz planes continue to work.

Out of scope:

* Persisting custom work planes in saved diagrams, unless explicitly chosen later.
* Multiple named work planes.
* Work-plane snapping.

⸻

### Phase 12B: Custom work-plane placement

Goal:

Use custom work planes for cursor placement.

Apply to:

* Point creation.
* Free text label creation.
* Polyline creation.
* Cubic Bézier creation.
* Polygon sheet creation.
* Drag editing where appropriate.

Requirements:

* Project clicks to the custom work plane.
* Show the custom work-plane preview patch.
* Preserve existing xy, xz, and yz behavior.
* Avoid invalid coordinates.

Out of scope:

* Cross-work-plane paths.
* Curved-boundary sheets.
* Work-plane persistence.

⸻

### Phase 12C: Custom work-plane direct input

Goal:

Allow creation and editing using local work-plane coordinates.

Local coordinate interpretation:

origin + a * u + b * v

Requirements:

* Allow local coordinates (a,b).
* Convert local coordinates to world coordinates.
* Coexist with absolute 3D coordinate editing.
* Validate all inputs.

Out of scope:

* Advanced basis normalization UI.
* Named work-plane presets.
* Work-plane constraints.

⸻

## Phase 13: Concatenated paths

⸻

### Phase 13A: Concatenated path data-model design

Goal:

Design a representation for paths made from line and cubic Bézier segments.

Possible segment representation:

type PathSegment =
  | {
      kind: "line";
      start: Vec3;
      end: Vec3;
    }
  | {
      kind: "cubicBezier";
      start: Vec3;
      control1: Vec3;
      control2: Vec3;
      end: Vec3;
    };

Design questions:

* Is this a new curve kind or a new path stratum type?
* How should adjacent endpoints be shared?
* How should existing polyline and cubic Bézier curves be preserved?
* How should Name, layer, and Path labels apply?
* How should spath/save apply?
* How should 2D and 3D paths differ?

This phase should include design review before implementation.

⸻

### Phase 13B: Same-plane concatenated path creation

Goal:

Create paths made from line and cubic Bézier segments.

Scope:

* 2D paths.
* 3D paths on a single active/custom work plane.
* Sequential segment creation.
* Draft preview.
* Finish/cancel.
* TikZ export as a continuous path.
* Optional spath/save.

Requirements:

* Adjacent segments share endpoints.
* Segment order is preserved.
* Drafts remain UI/editor state.
* Drafts are not exported to TikZ.

Out of scope:

* Cross-work-plane concatenation.
* Filled regions.
* Curved-boundary sheets.

⸻

### Phase 13C: Editing concatenated paths

Goal:

Edit concatenated paths.

Scope:

* Inspector editing of segment endpoints and controls.
* Drag editing of endpoints and control points.
* Relative/polar control editing for Bézier segments.
* SVG and TikZ update correctly.
* Layer and path-label behavior is preserved.

Out of scope:

* Self-intersection analysis.
* Automatic smoothing.
* Boolean path operations.

⸻

### Phase 13D: Cross-work-plane concatenated paths

Goal:

Allow concatenated paths whose segments are not restricted to one work plane.

Requirements:

* Store absolute 3D coordinates.
* Work-plane choice becomes a creation/editing aid, not a global path constraint.
* SVG and TikZ remain readable.
* Existing same-plane paths continue to work.

Out of scope:

* Filled sheet generation from non-planar paths.
* Automatic surface fitting.

⸻

## Phase 14: 2D codim-0 regions and filled boundaries

⸻

### Phase 14A: 2D codim-0 stratum data model

Motivation:

In 2D graphical calculus, codim 0 strata are regions.

Complex filled regions should be represented as first-class codim-0 strata, not as 3D sheets.

Goal:

Introduce a first-class 2D region stratum.

Possible representation:

type RegionStratum = {
  id: string;
  name: string;
  geometricKind: "region";
  codim: 0;
  ambientDimension: 2;
  boundary: PathSegment[];
  style: RegionStyle;
  layer: number;
};

Requirements:

* 2D only at first.
* Boundary is a closed path.
* Boundary may eventually use line and cubic Bézier segments.
* Region style includes fill and stroke options.
* Name, layer, and optional path labels have clear semantics.

Out of scope:

* 3D curved-boundary sheets.
* General non-planar regions.
* Full self-intersection analysis.

⸻

### Phase 14B: 2D closed-boundary validation

Goal:

Validate 2D closed paths.

Requirements:

* Boundary has at least one segment.
* Adjacent segment endpoints match.
* Final endpoint matches initial point.
* Coordinates are finite.
* Boundary lies in 2D with z = 0.
* Reject or warn about obvious invalid cases if simple.

Out of scope:

* Full robust computational geometry.
* Boolean operations.
* Automatic repair.

⸻

### Phase 14C: 2D filled region creation

Goal:

Create 2D codim-0 regions from closed boundaries.

Possible workflows:

* Create region from an existing selected closed path.
* Create region directly using a closed-boundary creation tool.

Requirements:

* Render region in SVG as a filled closed path.
* Export region to TikZ as a filled closed path.
* Support style editing:
    * fill color
    * fill opacity
    * stroke color
    * stroke opacity
    * stroke width
* Preserve layer output.
* Preserve optional path labels where appropriate.

Out of scope:

* 3D sheet creation from curved boundaries.
* Self-intersection resolution.
* Holes in regions.

⸻

### Phase 14D: 2D region editing

Goal:

Edit codim-0 region boundaries.

Scope:

* Inspector editing of boundary segments.
* Drag editing of boundary handles.
* Relative/polar editing for Bézier controls.
* SVG and TikZ update correctly.
* Layer output works for regions.

Out of scope:

* Boolean region operations.
* Region holes.
* Automatic simplification.

⸻

## Phase 15: General 3D curved-boundary sheets

⸻

### Phase 15A: 3D planar closed-boundary sheet model

Goal:

Extend 3D sheets to support closed boundaries made from line and cubic Bézier segments.

Requirements:

* The boundary is a closed path.
* Boundary segments may be lines or cubic Bézier curves.
* Boundary lies in a single plane initially.
* The sheet is a codim-1 stratum.
* Reuse path, layer, name, and spath/save conventions where appropriate.

Out of scope:

* Non-planar filled surfaces.
* Surface meshing.
* Self-intersection analysis beyond simple validation.

⸻

### Phase 15B: 3D curved-boundary sheet creation

Goal:

Create 3D planar sheets from closed paths.

Requirements:

* Use active/custom work plane.
* Create filled sheet from a closed boundary.
* Render in SVG as a projected filled path.
* Export to TikZ as a closed filled path.
* Preserve style editing.

Out of scope:

* Non-planar surfaces.
* Holes.
* Advanced triangulation.

⸻

### Phase 15C: Advanced 3D sheet boundary editing

Goal:

Edit general 3D sheet boundaries.

Scope:

* Drag endpoints and control points.
* Use custom work planes for editing.
* Support relative/polar controls in the sheet’s plane.
* Preserve validation and TikZ output.

Out of scope:

* Surface deformation.
* Non-planar filling.
* Automatic meshing.

⸻

## Later phases

Undo / redo

Add history management for diagram edits.

Should cover:

* creation
* deletion
* coordinate edits
* style edits
* direct-input edits
* drag edits
* save/load boundaries

⸻

Snapping and constraints

Add optional editing constraints.

Possible features:

* snap to existing vertices
* snap to grid
* snap to work-plane axes
* lock horizontal/vertical directions in 2D
* preserve tangent direction while changing Bézier radius

⸻

Advanced TikZ export options

Possible features:

* relative polar Bézier controls
* macro-based export
* named coordinate cleanup
* layer grouping improvements
* comments by stratum name
* standalone document export
* additional spath3 operations

⸻

Import from TikZ

Long-term exploratory feature.

Possible features:

* parse a restricted subset of generated TikZ
* reconstruct diagram data
* round-trip generated diagrams

This is not a near-term goal.

-----

Possible futher features:

- curve visibility segmentation
- hidden-line support in preview
- automatic layer suggestions
- sheet templates
- ambient box templates
- TikZ macro mode
- LaTeX/PDF preview
- basic source/target consistency checks
- movie move templates
- 2D-to-3D embedding
- 3D-to-2D projection

-----

Partial curve style segments

Goal:

Allow users to select a subrange of a curve and apply a different style to that subrange.

Primary use case:

- represent overlaps or hidden parts of curves using `densely dotted`

Tasks:

- Add `CurveStyleSegment`
- Add `styleSegments` to `CurveStratum`
- Add `denselyDotted` to `LineStyle`
- Add UI for selecting a curve subrange
- Add command: "mark selected range as densely dotted"
- Render style segments in SVG preview
- Split polyline curves by normalized arclength
- Split cubic Bézier curves by subdivision
- Export segmented curves to readable TikZ

This feature is not required for the MVP.

For the MVP, each curve may be rendered with a single global style.
