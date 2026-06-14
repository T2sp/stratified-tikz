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

export type Camera3D = {
  mode: '3d'
  projection: 'orthographic'
  xVector: [number, number]
  yVector: [number, number]
  zVector: [number, number]
  scale: number
  origin: Vec2
}

export type Camera = Camera2D | Camera3D

export type CoordinateInputMode = 'direct' | 'cursor'

export type WorkPlane =
  | { kind: 'xy'; z: number }
  | { kind: 'xz'; y: number }
  | { kind: 'yz'; x: number }

export type EditorState = {
  selectedId: string | null
  coordinateInputMode: CoordinateInputMode
  activeWorkPlane: WorkPlane
  snapToGrid: boolean
  gridSize: number
}

export type HexColor = `#${string}`

export type Opacity = number

export const lineStyles = ['solid', 'dashed', 'dotted'] as const
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

export type SheetStratum = {
  id: string
  codim: 1
  geometricKind: 'sheet'
  kind: 'quadSheet'
  name: string
  label?: string
  style: SheetStyle
  corners: [Vec3, Vec3, Vec3, Vec3]
  layer: number
}

export type CurveKind = 'polyline' | 'cubicBezier'

export type CurveStratum = {
  id: string
  codim: 1 | 2
  geometricKind: 'curve'
  kind: CurveKind
  name: string
  label?: string
  style: CurveStyle
  points: Vec3[]
  styleSegments: CurveStyleSegment[]
  layer: number
}

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
