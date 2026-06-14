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

The editor state represents temporary UI choices such as selection, coordinate input mode, and active work plane.

```ts
export type CoordinateInputMode = "direct" | "cursor";

export type EditorState = {
  selectedId: string | null;
  coordinateInputMode: CoordinateInputMode;
  activeWorkPlane: WorkPlane;
  snapToGrid: boolean;
  gridSize: number;
};
```

## Work planes

Work planes are used for cursor input.

In 2D mode, cursor input always uses the xy-plane with z = 0.

In 3D mode, cursor input requires an explicitly selected work plane.

```ts
export type WorkPlane =
  | { kind: "xy"; z: number }
  | { kind: "xz"; y: number }
  | { kind: "yz"; x: number };
```

For MVP, arbitrary oblique work planes are not required.

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
export type SheetStratum = {
  id: string;
  codim: 1;
  geometricKind: "sheet";
  kind: "quadSheet";
  name: string;
  label?: string;
  styleId: SheetStyleId;
  corners: [Vec3, Vec3, Vec3, Vec3];
  layer: number;
};
```

The four corners should be ordered cyclically.

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
  styleId: CurveStyleId;
  points: Vec3[];
  visibilitySegments: VisibilitySegment[];
  layer: number;
};
```

For `kind: "polyline"`, `points` is a list of vertices.

For `kind: "cubicBezier"`, `points` should contain four points:

```ts
[start, control1, control2, end]
```

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
export type SheetStratum = {
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
```

### Curve stratum

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
  visibilitySegments: VisibilitySegment[];
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