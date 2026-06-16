# Data model

## Convention

The word **n-stratum** means **codimension n**, not geometric dimension n.

The app supports two ambient dimensions:

```ts
ambientDimension: 2 | 3
```

A stratum is valid only if:

```ts
0 <= codim && codim <= ambientDimension
```

## Coordinates

Internally, all coordinates are represented as `Vec3`.

```ts
export type Vec3 = {
  x: number;
  y: number;
  z: number;
};
```

In 2D mode, all geometry is interpreted as lying in the plane z = 0.

This simplifies implementation because the renderer, TikZ generator, and editor can share a single coordinate representation.

For screen coordinates:

```ts
export type Vec2 = {
  x: number;
  y: number;
};
```

## Top-level diagram

```ts
export type AmbientDimension = 2 | 3;

export type Diagram = {
  version: 1;
  ambientDimension: AmbientDimension;
  camera: Camera;
  strata: Stratum[];
  labels: Label[];
};
```

An empty canvas is represented by the same `Diagram` shape with `strata: []`
and `labels: []`. Empty 2D and empty 3D diagrams are valid ordinary diagrams,
not a separate null or draft state.

## Saved diagram file

Phase 8A saves and loads diagrams using a small versioned JSON wrapper:

```ts
export type SavedDiagramFile = {
  format: "stratified-tikz-diagram";
  version: 1;
  diagram: Diagram;
};
```

Only `diagram` data is persisted. UI/editor state such as the selected element,
active creation tool, coordinate input mode, active work plane, draft geometry,
layer filter, copy status, undo/redo history, and temporary preview state is not
saved.

Loading a file must check the `format` discriminator, supported `version`, and
validate the contained `diagram` before replacing the current editable diagram.

## Camera

```ts
export type Camera = Camera2D | Camera3D;

export type Camera2D = {
  mode: "2d";
  scale: number;
  origin: Vec2;
};

export type Camera3D = {
  mode: "3d";
  projection: "orthographic";
  xVector: [number, number];
  yVector: [number, number];
  zVector: [number, number];
  scale: number;
  origin: Vec2;
};
```

A valid diagram must satisfy:

```text
diagram.ambientDimension === 2 implies diagram.camera.mode === "2d"
diagram.ambientDimension === 3 implies diagram.camera.mode === "3d"
```

## Editor state

The editor state is separate from the diagram data.

The diagram data represents the mathematical and geometric content.

The editor state represents temporary UI choices such as selection, coordinate
input mode, active work plane, and the current layer used for newly created
elements.

```ts
export type CoordinateInputMode = "direct" | "cursor";

export type LayerFilter =
  | { kind: "all" }
  | { kind: "layer"; layer: number };

export type EditorState = {
  selectedId: string | null;
  coordinateInputMode: CoordinateInputMode;
  activeWorkPlane: WorkPlane;
  layerFilter: LayerFilter;
  snapToGrid: boolean;
  gridSize: number;
};
```

The layer filter is derived from numeric `layer` values on strata and free text
labels. It controls preview visibility and click selectability only. It is not
part of `Diagram`, is reset to all layers when examples or JSON files are
loaded, and does not affect TikZ generation.

The current "new element layer" control is also UI state. Cursor and direct
creation use it when committing new strata or free text labels, but the control
itself is not saved. Once an element is created, its numeric `layer` is ordinary
diagram data.

Undo/redo history is editor state rather than diagram data. It is represented as
bounded committed diagram snapshots with `past`, `present`, and `future`, with a
limit of 100 past states. Undo moves backward through committed diagrams; redo
cancels undo by moving forward through the future stack. Selection, layer
filter, coordinate input mode, active work plane, direct form values, and draft
geometry are not stored in history, and history is never saved to JSON.

## Work planes

Work planes are used for cursor input.

In 2D mode, cursor input always uses the xy-plane with z = 0.

In 3D mode, cursor input requires an explicitly selected work plane.

```ts
export type WorkPlane =
  | { kind: "xy"; z: number }
  | { kind: "xz"; y: number }
  | { kind: "yz"; x: number }
  | { kind: "axisAligned"; plane: "xy" | "xz" | "yz"; offset: number }
  | {
      kind: "custom";
      id: string;
      name: string;
      origin: Vec3;
      u: Vec3;
      v: Vec3;
      normal: Vec3;
      source:
        | { kind: "originNormal" }
        | { kind: "threePoints" }
        | { kind: "existingPointStrata"; pointIds: [string, string, string] };
    };
```

Axis-aligned planes remain available for the current 3D cursor workflow.
Custom work planes are represented by an origin and an orthonormal right-handed
basis: `u` and `v` span the plane, and `normal = cross(u, v)`. The active work
plane is editor/UI state, not part of `Diagram`; work-plane guides, previews,
and source metadata are drawing aids and are not exported to TikZ.

The current editor UI can apply a 3D-only custom plane from numeric origin and
normal inputs, or from three numeric points. Origin and normal inputs must be
finite, and the normal must be nonzero. Three-point inputs must be finite,
distinct, and non-collinear; `P0` becomes the origin and `P1 - P0` determines
the preferred `u` direction. Invalid input leaves the previous active work
plane unchanged. When the editable diagram enters 2D mode, the active work
plane is normalized back to `{ kind: "xy", z: 0 }`, and the custom work-plane
controls are hidden.

The editor can also enter a 3D-only point-picking mode for custom work-plane
construction. The picker stores up to three existing point stratum IDs in UI
state, rejects duplicate IDs, validates that the picked strata still exist, and
uses their current `Vec3` positions to construct the active custom plane. The
constructed plane may carry `source.kind: "existingPointStrata"` metadata in
editor state, but neither the active work plane nor the picker state is part of
`Diagram` serialization or TikZ export.

## Strata

```ts
export type Stratum =
  | RegionStratum
  | SheetStratum
  | CurveStratum
  | PointStratum;
```

Not every stratum type is valid in every ambient dimension.

In 2D mode:

- `RegionStratum` with `codim: 0`
- `CurveStratum` with `codim: 1`
- `PointStratum` with `codim: 2`

are valid.

In 3D mode:

- `RegionStratum` with `codim: 0`
- `SheetStratum` with `codim: 1`
- `CurveStratum` with `codim: 2`
- `PointStratum` with `codim: 3`

are valid.

## Codimension 0 stratum

A codim 0 stratum represents a region.

```ts
export type RegionStratum = {
  id: string;
  codim: 0;
  geometricKind: "region";
  name: string;
  label?: string;
  visible: boolean;
  layer: number;
};
```

In 2D mode this is a 2-dimensional region.

In 3D mode this is a 3-dimensional region.

## Sheet stratum

A sheet stratum is valid only in 3D mode.

It represents codim 1 geometry in R^3.

```ts
export type SheetStratum = QuadSheetStratum | PolygonSheetStratum;

export type QuadSheetStratum = {
  id: string;
  codim: 1;
  geometricKind: "sheet";
  kind: "quadSheet";
  name: string;
  label?: string;
  style: SheetStyle;
  corners: [Vec3, Vec3, Vec3, Vec3];
  layer: number;
};

export type PolygonSheetStratum = {
  id: string;
  codim: 1;
  geometricKind: "sheet";
  kind: "polygonSheet";
  name: string;
  label?: string;
  pathLabel?: string;
  style: SheetStyle;
  vertices: Vec3[];
  layer: number;
};
```

Quad sheets use four cyclically ordered `corners`.

Polygon sheets use cyclically ordered `vertices` and represent filled closed
polygonal regions. A polygon sheet must have at least three vertices.

Curved-boundary sheets and Bézier-boundary sheets are not implemented yet.

## Saved path labels

Path-like strata may store an optional `pathLabel` string. This is not a visual
or mathematical text label. It is a TikZ saved-path name used by the exporter to
emit `spath/save=<name>` for eligible path-like output.

Currently, `pathLabel` applies to:

- `CurveStratum` for both `polyline` and `cubicBezier`
- `PolygonSheetStratum` for the exported polygon sheet path

It does not apply to `PointStratum`, and it is independent from free text labels
stored in `diagram.labels`.

Missing `pathLabel` fields are valid for backward compatibility. Empty or
whitespace-only values mean no `spath/save` option should be emitted. When
exporting, the raw string is trimmed and sanitized to a deterministic TikZ-safe
name by keeping ASCII letters and digits, folding separators such as spaces or
hyphens into camel-case word boundaries, and falling back to `savedPath` if the
result would be empty. If the sanitized name starts with a digit, `savedPath` is
prefixed before the digit.

## Curve stratum

A curve stratum is used in both modes.

In 2D mode:

- it has `codim: 1`
- it represents a 1-morphism wire

In 3D mode:

- it has `codim: 2`
- it represents a 2-morphism line defect

```ts
export type CurveStratum = {
  id: string;
  codim: 1 | 2;
  geometricKind: "curve";
  kind: "polyline" | "cubicBezier";
  name: string;
  label?: string;
  pathLabel?: string;
  style: CurveStyle;
  points: Vec3[];
  bezierControls?: CubicBezierControlMode;
  styleSegments: CurveStyleSegment[];
  layer: number;
};
```

For `kind: "polyline"`, `points` is a list of vertices.

For `kind: "cubicBezier"`, `points` should contain four points:

```ts
[start, control1, control2, end]
```

The four `points` remain the absolute geometry used for SVG rendering, hit
testing, dragging, and validation. Cubic Bézier curves may also carry optional
control metadata for TikZ export:

```ts
type CubicBezierControlMode =
  | { kind: "absolute" }
  | {
      kind: "relativeCartesian";
      firstControlOffset: Vec3;
      secondControlOffset: Vec3;
      secondOffsetReference: "end";
    }
  | {
      kind: "relativePolar";
      firstControl: { angleDegrees: number; radius: number };
      secondControl: { angleDegrees: number; radius: number };
      secondOffsetReference: "end";
    };
```

Missing `bezierControls` is treated as `{ kind: "absolute" }` for compatibility
with existing saved diagrams. In relative Cartesian mode, the first offset is
from `start` and the second offset is from `end`, matching TikZ's
`.. controls +(dx,dy) and +(dx,dy) ..` convention. Relative polar metadata is
2D-only; angles must be finite and radii must be finite and non-negative.

Validity condition:

```text
ambientDimension === 2 implies curve.codim === 1
ambientDimension === 3 implies curve.codim === 2
```

## Visibility segments

Visibility segments are used to represent lines passing behind other strata.

```ts
export type VisibilitySegment = {
  from: number;
  to: number;
  styleId: CurveStyleId;
};
```

Here `from` and `to` are parameters in `[0,1]`.

For the MVP, this can be ignored in the preview and used only later.

## Point stratum

A point stratum is used in both modes.

In 2D mode:

- it has `codim: 2`
- it represents a 2-morphism vertex or coupon

In 3D mode:

- it has `codim: 3`
- it represents a 3-morphism junction

```ts
export type PointStratum = {
  id: string;
  codim: 2 | 3;
  geometricKind: "point";
  name: string;
  label?: string;
  styleId: PointStyleId;
  position: Vec3;
  layer: number;
};
```

Validity condition:

```text
ambientDimension === 2 implies point.codim === 2
ambientDimension === 3 implies point.codim === 3
```

## Visual style model

Every visible stratum has a user-configurable visual style.

For the MVP, colors should be stored as hex color strings.

```ts
export type HexColor = `#${string}`;

export type Opacity = number;
```

The valid range for `Opacity` is:

```ts
0 <= opacity && opacity <= 1
```

## Stratum styles

Use separate style types for regions, sheets, curves, and points.

```ts
export type StratumStyle =
  | RegionStyle
  | SheetStyle
  | CurveStyle
  | PointStyle;
```

## Region style

A region style is used for codim 0 strata.

For the MVP, regions may be represented mainly by labels, but the style type should exist for future use.

```ts
export type RegionStyle = {
  kind: "regionStyle";
  fillColor: HexColor;
  fillOpacity: Opacity;
  strokeColor: HexColor;
  strokeOpacity: Opacity;
};
```

Default:

```ts
export const defaultRegionStyle: RegionStyle = {
  kind: "regionStyle",
  fillColor: "#FFFFFF",
  fillOpacity: 0,
  strokeColor: "#000000",
  strokeOpacity: 0,
};
```

## Sheet style

A sheet style is used for geometric 2-dimensional strata.

In the current app, sheets occur only in 3D mode as codim 1 strata.

```ts
export type SheetStyle = {
  kind: "sheetStyle";
  fillColor: HexColor;
  fillOpacity: Opacity;
  strokeColor: HexColor;
  strokeOpacity: Opacity;
};
```

Default:

```ts
export const defaultSheetStyle: SheetStyle = {
  kind: "sheetStyle",
  fillColor: "#4D9DE0",
  fillOpacity: 0.35,
  strokeColor: "#4D9DE0",
  strokeOpacity: 1,
};
```

## Curve style

A curve style is used for geometric 1-dimensional strata.

In 2D mode, curves are codim 1.

In 3D mode, curves are codim 2.

```ts
export type LineStyle =
  | "solid"
  | "dashed"
  | "dotted";

export type CurveStyle = {
  kind: "curveStyle";
  strokeColor: HexColor;
  strokeOpacity: Opacity;
  lineWidth: number;
  lineStyle: LineStyle;
};
```

The `lineWidth` value is interpreted as points in TikZ output.

Default:

```ts
export const defaultCurveStyle: CurveStyle = {
  kind: "curveStyle",
  strokeColor: "#000000",
  strokeOpacity: 1,
  lineWidth: 1.2,
  lineStyle: "solid",
};
```

## Partial curve style segments

Curves should eventually support partial style overrides along subranges.

This is useful for representing overlaps, under-crossings, and hidden portions of curves.

For the MVP, this feature may be ignored in the UI and TikZ output.

However, the data model should be compatible with it.

## Curve style segments

A curve may have optional style segments.

```ts
export type CurveStyleSegment = {
  id: string;
  from: number;
  to: number;
  style: PartialCurveStyle;
};
```

Here `from` and `to` are parameters in `[0, 1]`.

They must satisfy:

```ts
0 <= from && from < to && to <= 1
```

## Partial curve style

A partial curve style is an override of the global curve style.

```ts
export type PartialCurveStyle = Partial<CurveStyle>;
```

For example, a hidden or overlapped segment can be represented as:

```ts
{
  lineStyle: "denselyDotted"
}
```

## Extended line styles

To support overlap and hidden-line notation, extend `LineStyle` as follows:

```ts
export type LineStyle =
  | "solid"
  | "dashed"
  | "dotted"
  | "denselyDotted";
```

Later versions may add:

```ts
| "looselyDotted"
| "denselyDashed"
| "looselyDashed"
| "dashDot"
```

## Updated curve stratum

Replace `visibilitySegments` with `styleSegments`.

```ts
export type CurveStratum = {
  id: string;
  codim: 1 | 2;
  geometricKind: "curve";
  kind: "polyline" | "cubicBezier";
  name: string;
  label?: string;
  style: CurveStyle;
  points: Vec3[];
  styleSegments: CurveStyleSegment[];
  layer: number;
};
```

For MVP, `styleSegments` may simply be an empty array.

## Validation of curve style segments

The validation function should check:

- every segment has a non-empty id
- every segment satisfies `0 <= from < to <= 1`
- segment ranges are finite numbers
- segment styles are valid partial curve styles
- line style values are supported

For MVP, overlapping style segments may be disallowed.

Later versions may support priority ordering among overlapping style segments.

## Point style

A point style is used for geometric 0-dimensional strata.

In 2D mode, points are codim 2.

In 3D mode, points are codim 3.

```ts
export type PointShape =
  | "circle"
  | "square"
  | "triangle"
  | "star";

export type PointFill =
  | "filled"
  | "hollow";

export type PointStyle = {
  kind: "pointStyle";
  color: HexColor;
  opacity: Opacity;
  shape: PointShape;
  fill: PointFill;
  size: number;
};
```

The `size` value is interpreted as points in TikZ output.

Default:

```ts
export const defaultPointStyle: PointStyle = {
  kind: "pointStyle",
  color: "#000000",
  opacity: 1,
  shape: "circle",
  fill: "filled",
  size: 3,
};
```

## Updated stratum types

Strata should store explicit style objects.

Replace `styleId` fields with `style`.

### Region stratum

```ts
export type RegionStratum = {
  id: string;
  codim: 0;
  geometricKind: "region";
  name: string;
  label?: string;
  visible: boolean;
  style: RegionStyle;
  layer: number;
};
```

### Sheet stratum

```ts
export type SheetStratum = QuadSheetStratum | PolygonSheetStratum;

export type QuadSheetStratum = {
  id: string;
  codim: 1;
  geometricKind: "sheet";
  kind: "quadSheet";
  name: string;
  label?: string;
  style: SheetStyle;
  corners: [Vec3, Vec3, Vec3, Vec3];
  layer: number;
};

export type PolygonSheetStratum = {
  id: string;
  codim: 1;
  geometricKind: "sheet";
  kind: "polygonSheet";
  name: string;
  label?: string;
  pathLabel?: string;
  style: SheetStyle;
  vertices: Vec3[];
  layer: number;
};
```

In 3D mode, sheets are codimension 1. `quadSheet` remains supported for
four-corner examples and templates. `polygonSheet` stores a filled closed
polygonal region as cyclically ordered `vertices` and requires at least three
vertices. Curved-boundary sheets are deferred to a later phase.

### Curve stratum

```ts
export type CurveStratum = {
  id: string;
  codim: 1 | 2;
  geometricKind: "curve";
  kind: "polyline" | "cubicBezier";
  name: string;
  label?: string;
  pathLabel?: string;
  style: CurveStyle;
  points: Vec3[];
  styleSegments: CurveStyleSegment[];
  layer: number;
};
```

### Point stratum

```ts
export type PointStratum = {
  id: string;
  codim: 2 | 3;
  geometricKind: "point";
  name: string;
  label?: string;
  style: PointStyle;
  position: Vec3;
  layer: number;
};
```

## Validation of styles

The validation function should also check:

- all colors are valid hex color strings
- all opacity values are between 0 and 1
- curve line width is positive
- point size is positive
- point shape is one of the supported shapes
- point fill is either `"filled"` or `"hollow"`
- line style is one of the supported line styles

The validation function should not require styles to match predefined presets.


## Labels

The app supports free text labels.

A free text label represents a TikZ node of the form:

```tex
\node at (#1) {#2};
```

Here:

- `#1` is the label position
- `#2` is the label content

The label content is arbitrary user-provided text.

Free text labels are separate from optional `pathLabel` saved-path names on
path-like strata. A free text label is exported as node content and never as an
`spath/save` option.

Mathematical labels should be entered by the user using LaTeX math delimiters.

For example:

```text
$F$
$F^{(1)}L$
$\alpha \colon f \Rightarrow g$
```

The app must not automatically wrap label text in `$...$`.

## Label type

```ts
export type TextLabel = {
  id: string;
  geometricKind: "label";
  name: string;
  text: string;
  position: Vec3;
  style: LabelStyle;
  layer: number;
};
```

The top-level diagram stores labels separately from strata:

```ts
export type Diagram = {
  version: 1;
  ambientDimension: AmbientDimension;
  camera: Camera;
  strata: Stratum[];
  labels: TextLabel[];
};
```

## Label style

For the MVP, a label style should support at least:

- text color
- opacity
- font size
- anchor

```ts
export type LabelAnchor =
  | "center"
  | "north"
  | "south"
  | "east"
  | "west"
  | "north east"
  | "north west"
  | "south east"
  | "south west";

export type LabelStyle = {
  kind: "labelStyle";
  color: HexColor;
  opacity: Opacity;
  fontSize: number;
  anchor: LabelAnchor;
};
```

The `fontSize` value is interpreted as points in TikZ output.

Default:

```ts
export const defaultLabelStyle: LabelStyle = {
  kind: "labelStyle",
  color: "#000000",
  opacity: 1,
  fontSize: 10,
  anchor: "center",
};
```

## Label coordinates

Labels use the same coordinate representation as strata.

```ts
position: Vec3
```

In 2D mode, label positions are interpreted as lying in the plane z = 0.

In 3D mode, label positions may use all three coordinates.

## Label input

Label positions can be specified by:

- direct numeric input
- cursor-based graphical input

Coordinate input mode belongs to `EditorState`, not to the label object itself.

The label object stores only the resulting position.

## Label validation

The validation function should check:

- label id is non-empty
- label name is non-empty
- label position has finite coordinates
- in 2D mode, label position has `z = 0` or is interpreted as `z = 0`
- label color is a valid hex color
- label opacity is between 0 and 1
- label font size is positive
- label anchor is one of the supported anchors

The validation function should not reject label text merely because it contains LaTeX commands.

The app should treat label text as user-provided LaTeX/TikZ content.

## Style IDs

```ts
export type SheetStyleId =
  | "blueSheet"
  | "redSheet"
  | "graySheet";

export type CurveStyleId =
  | "visibleLine"
  | "hiddenLine"
  | "dottedLine"
  | "orientedLine";

export type PointStyleId =
  | "filledDot"
  | "openDot"
  | "smallCoupon"
  | "rectangleCoupon";
```

## Validation

Implement a validation function:

```ts
export function validateDiagram(diagram: Diagram): DiagramValidationResult;
```

It should check:

- camera mode matches ambient dimension
- every stratum satisfies `0 <= codim <= ambientDimension`
- no sheet appears in 2D mode
- curves have correct codimension for the ambient dimension
- points have correct codimension for the ambient dimension
- all coordinates are finite numbers
- in 2D mode, all z-coordinates are zero or interpreted as zero

## Coordinate helpers

Implement helpers for cursor input and direct input.

```ts
export function normalizePointForAmbientDimension(
  ambientDimension: AmbientDimension,
  point: Vec3
): Vec3;
```

In 2D mode this should return a point with `z = 0`.

In 3D mode this should return the original point.

```ts
export function screenToModelOnWorkPlane(
  camera: Camera,
  screenPoint: Vec2,
  workPlane: WorkPlane
): Vec3;
```

In 2D mode, this maps screen coordinates to `(x, y, 0)`.

In 3D mode, this maps screen coordinates to the chosen work plane.

For MVP, this function may initially support only simple orthographic cameras.
