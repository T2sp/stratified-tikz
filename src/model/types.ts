export type AmbientDimension = 2 | 3

export type Vec2 = {
  x: number
  y: number
}

export type Vec3 = {
  x: number
  y: number
  z: number
}

export type Camera2D = {
  mode: '2d'
  scale: number
  origin: Vec2
}

export type Camera3DProjectionBasis = {
  xVector: [number, number]
  yVector: [number, number]
  zVector: [number, number]
}

export type OrthographicCamera3D = {
  mode: '3d'
  kind: 'orthographic'
  thetaDeg: number
  phiDeg: number
  zoom: number
  pan: Vec2
  projectionBasis?: Camera3DProjectionBasis
}

export type PerspectiveCamera3D = {
  mode: '3d'
  kind: 'perspective'
  thetaDeg: number
  phiDeg: number
  zoom: number
  pan: Vec2
  target: Vec3
  distance: number
  fieldOfViewDeg: number
  projectionBasis?: never
}

export type Camera3D = OrthographicCamera3D | PerspectiveCamera3D

export type Camera = Camera2D | Camera3D

export type DiagramViewOptions = {
  camera3d?: Camera3D
  showCoordinateAxesInTikz?: boolean
}

export type CoordinateInputMode = 'direct' | 'cursor'

export type AxisAlignedWorkPlaneName = 'xy' | 'xz' | 'yz'

export type LegacyAxisAlignedWorkPlane =
  | { kind: 'xy'; z: number }
  | { kind: 'xz'; y: number }
  | { kind: 'yz'; x: number }

export type AxisAlignedWorkPlane = {
  kind: 'axisAligned'
  plane: AxisAlignedWorkPlaneName
  offset: number
}

export type CustomWorkPlaneSource =
  | { kind: 'originNormal' }
  | { kind: 'threePoints' }
  | { kind: 'existingPointStrata'; pointIds: [string, string, string] }

export type CustomWorkPlane = {
  kind: 'custom'
  id: string
  name: string
  origin: Vec3
  u: Vec3
  v: Vec3
  normal: Vec3
  source: CustomWorkPlaneSource
}

export type WorkPlane =
  | LegacyAxisAlignedWorkPlane
  | AxisAlignedWorkPlane
  | CustomWorkPlane

export type EditorState = {
  selectedId: string | null
  coordinateInputMode: CoordinateInputMode
  activeWorkPlane: WorkPlane
  snapToGrid: boolean
  gridSize: number
}

export type HexColor = `#${string}`

export type Opacity = number

export const lineStyles = ['solid', 'dashed', 'dotted', 'denselyDotted'] as const
export type LineStyle = (typeof lineStyles)[number]

export const pointShapes = ['circle', 'square', 'triangle', 'star'] as const
export type PointShape = (typeof pointShapes)[number]

export const pointFills = ['filled', 'hollow'] as const
export type PointFill = (typeof pointFills)[number]

export const labelAnchors = [
  'center',
  'north',
  'south',
  'east',
  'west',
  'north east',
  'north west',
  'south east',
  'south west',
] as const
export type LabelAnchor = (typeof labelAnchors)[number]

export type RegionStyle = {
  kind: 'regionStyle'
  fillColor: HexColor
  fillOpacity: Opacity
  strokeColor: HexColor
  strokeOpacity: Opacity
}

export type SheetStyle = {
  kind: 'sheetStyle'
  fillColor: HexColor
  fillOpacity: Opacity
  strokeColor: HexColor
  strokeOpacity: Opacity
}

export type CurveStyle = {
  kind: 'curveStyle'
  strokeColor: HexColor
  strokeOpacity: Opacity
  lineWidth: number
  lineStyle: LineStyle
}

export type PartialCurveStyle = Partial<CurveStyle>

export type CurveStyleSegment = {
  id: string
  from: number
  to: number
  style: PartialCurveStyle
}

export type PathSegmentStyleOverride = Partial<CurveStyle>

export type CubicBezierPolarControl = {
  angleDegrees: number
  radius: number
}

export type WorkPlaneFrameSnapshot = {
  origin: Vec3
  u: Vec3
  v: Vec3
  normal: Vec3
}

export type WorkPlaneLocalCoordinate = {
  a: number
  b: number
}

export type WorkPlaneLocalOffset = {
  dx: number
  dy: number
}

export type CubicBezierControlMode =
  | { kind: 'absolute' }
  | {
      kind: 'relativeCartesian'
      firstControlOffset: Vec3
      secondControlOffset: Vec3
      secondOffsetReference: 'end'
    }
  | {
      kind: 'relativePolar'
      firstControl: CubicBezierPolarControl
      secondControl: CubicBezierPolarControl
      secondOffsetReference: 'end'
    }
  | {
      kind: 'workPlaneRelativeCartesian'
      frame: WorkPlaneFrameSnapshot
      localStart: WorkPlaneLocalCoordinate
      localEnd: WorkPlaneLocalCoordinate
      firstControlOffset: WorkPlaneLocalOffset
      secondControlOffset: WorkPlaneLocalOffset
      secondOffsetReference: 'end'
    }
  | {
      kind: 'workPlaneRelativePolar'
      frame: WorkPlaneFrameSnapshot
      localStart: WorkPlaneLocalCoordinate
      localEnd: WorkPlaneLocalCoordinate
      firstControl: CubicBezierPolarControl
      secondControl: CubicBezierPolarControl
      secondOffsetReference: 'end'
    }

export type PointStyle = {
  kind: 'pointStyle'
  color: HexColor
  opacity: Opacity
  shape: PointShape
  fill: PointFill
  size: number
}

export type LabelStyle = {
  kind: 'labelStyle'
  color: HexColor
  opacity: Opacity
  fontSize: number
  anchor: LabelAnchor
}

export type StratumStyle =
  | RegionStyle
  | SheetStyle
  | CurveStyle
  | PointStyle

export type RegionStratum = {
  id: string
  codim: 0
  geometricKind: 'region'
  name: string
  label?: string
  visible: boolean
  style: RegionStyle
  layer: number
}

type SheetStratumBase = {
  id: string
  codim: 1
  geometricKind: 'sheet'
  name: string
  label?: string
  style: SheetStyle
  layer: number
}

export type QuadSheetStratum = SheetStratumBase & {
  kind: 'quadSheet'
  corners: [Vec3, Vec3, Vec3, Vec3]
}

export type PolygonSheetStratum = SheetStratumBase & {
  kind: 'polygonSheet'
  vertices: Vec3[]
  pathLabel?: string
}

export type SheetStratum = QuadSheetStratum | PolygonSheetStratum

type PathSegmentBase = {
  styleOverride?: PathSegmentStyleOverride
}

export type LinePathSegment = PathSegmentBase & {
  kind: 'line'
  start: Vec3
  end: Vec3
}

export type CubicBezierPathSegment = PathSegmentBase & {
  kind: 'cubicBezier'
  start: Vec3
  control1: Vec3
  control2: Vec3
  end: Vec3
  controlMode?: CubicBezierControlMode
}

export type PathSegment = LinePathSegment | CubicBezierPathSegment

export type PointCurveKind = 'polyline' | 'cubicBezier'
export type CurveKind = PointCurveKind | 'concatenatedPath'

type CurveStratumBase = {
  id: string
  codim: 1 | 2
  geometricKind: 'curve'
  name: string
  label?: string
  pathLabel?: string
  style: CurveStyle
  styleSegments: CurveStyleSegment[]
  layer: number
}

export type PolylineCurveStratum = CurveStratumBase & {
  kind: 'polyline'
  points: Vec3[]
}

export type CubicBezierCurveStratum = CurveStratumBase & {
  kind: 'cubicBezier'
  points: Vec3[]
  bezierControls?: CubicBezierControlMode
}

export type ConcatenatedPathStratum = CurveStratumBase & {
  kind: 'concatenatedPath'
  segments: PathSegment[]
}

export type CurveStratum =
  | PolylineCurveStratum
  | CubicBezierCurveStratum
  | ConcatenatedPathStratum

export type PointStratum = {
  id: string
  codim: 2 | 3
  geometricKind: 'point'
  name: string
  label?: string
  style: PointStyle
  position: Vec3
  layer: number
}

export type Stratum =
  | RegionStratum
  | SheetStratum
  | CurveStratum
  | PointStratum

export type TextLabel = {
  id: string
  geometricKind: 'label'
  name: string
  text: string
  position: Vec3
  style: LabelStyle
  layer: number
}

export type Diagram = {
  version: 1
  ambientDimension: AmbientDimension
  camera: Camera
  view?: DiagramViewOptions
  strata: Stratum[]
  labels: TextLabel[]
}

export type DiagramValidationIssue = {
  path: string
  message: string
}

export type DiagramValidationResult = {
  valid: boolean
  errors: DiagramValidationIssue[]
}
