import type { ScalarInputValue } from './scalarExpressions.ts'

export type AmbientDimension = 2 | 3

export type Vec2 = {
  x: number
  y: number
}

export type CoordinateComponent =
  | {
      kind: 'numeric'
      value: number
    }
  | {
      kind: 'symbolic'
      expression: string
      previewValue: number
    }

export type SymbolicVec3 = {
  x: CoordinateComponent
  y: CoordinateComponent
  z: CoordinateComponent
}

export type Vec3 = {
  x: number
  y: number
  z: number
  symbolic?: SymbolicVec3
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
  exportMode?: TikzExportMode
}

export const tikzExportModes = ['standalone', 'inlineMath'] as const
export type TikzExportMode = (typeof tikzExportModes)[number]

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

export const fillRules = ['nonzero', 'evenOdd'] as const
export type FillRule = (typeof fillRules)[number]

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

export type SurfaceFrame = WorkPlaneFrameSnapshot

export type SurfaceSampling = {
  uSegments: number
  vSegments: number
}

export type HemisphereSide = 'positive' | 'negative'

export type HemisphereCurvedSheetPrimitive = {
  kind: 'hemisphere'
  center: Vec3
  radius: number
  frame: SurfaceFrame
  hemisphereSide: HemisphereSide
  sampling: SurfaceSampling
}

export type SaddleCurvedSheetPrimitive = {
  kind: 'saddle'
  frame: SurfaceFrame
  width: number
  depth: number
  height: number
  sampling: SurfaceSampling
}

export type CurvedSheetPrimitive =
  | HemisphereCurvedSheetPrimitive
  | SaddleCurvedSheetPrimitive

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

export type StylePresetKind =
  | 'region'
  | 'sheet'
  | 'curve'
  | 'point'
  | 'label'

export const tikzStyleTargets = [
  'draw',
  'filldraw',
  'node',
  'curve',
  'sheet',
  'point',
  'label',
  'region',
] as const
export type TikzStyleTarget = (typeof tikzStyleTargets)[number]

export type ExternalTikzStyleSource = {
  id: string
  name: string
  loadHint: string
}

export type ImportedTikzStyleReference = {
  id: string
  key: string
  sourceId: string
  displayName: string
  targets: TikzStyleTarget[]
  options?: string
}

export type UserRegionStylePreset = {
  id: string
  name: string
  kind: 'region'
  style: RegionStyle
  tikzStyleName: string
  importedTikzStyleReferenceId?: string
}

export type UserSheetStylePreset = {
  id: string
  name: string
  kind: 'sheet'
  style: SheetStyle
  tikzStyleName: string
  importedTikzStyleReferenceId?: string
}

export type UserCurveStylePreset = {
  id: string
  name: string
  kind: 'curve'
  style: CurveStyle
  tikzStyleName: string
  importedTikzStyleReferenceId?: string
}

export type UserPointStylePreset = {
  id: string
  name: string
  kind: 'point'
  style: PointStyle
  tikzStyleName: string
  importedTikzStyleReferenceId?: string
}

export type UserLabelStylePreset = {
  id: string
  name: string
  kind: 'label'
  style: LabelStyle
  tikzStyleName: string
  importedTikzStyleReferenceId?: string
}

export type UserStylePreset =
  | UserRegionStylePreset
  | UserSheetStylePreset
  | UserCurveStylePreset
  | UserPointStylePreset
  | UserLabelStylePreset

type RegionStratumBase = {
  id: string
  codim: 0
  geometricKind: 'region'
  name: string
  label?: string
  stylePresetId?: string
  importedTikzStyleReferenceId?: string
  visible: boolean
  style: RegionStyle
  layer: number
}

export type AmbientRegionStratum = RegionStratumBase & {
  kind?: 'ambientRegion'
}

export type FilledRegion2DStratum = RegionStratumBase & {
  kind: 'filledRegion'
  boundaries: ClosedPathBoundary[]
  fillRule: FillRule
}

export type RegionStratum = AmbientRegionStratum | FilledRegion2DStratum

type SheetStratumBase = {
  id: string
  codim: 1
  geometricKind: 'sheet'
  name: string
  label?: string
  stylePresetId?: string
  importedTikzStyleReferenceId?: string
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

export type WorkPlaneFilledSheet3DStratum = SheetStratumBase & {
  kind: 'workPlaneFilledSheet'
  planeFrame: WorkPlaneFrameSnapshot
  boundaries: ClosedPathBoundary[]
  fillRule: FillRule
}

export type CurvedSheetStratum = SheetStratumBase & {
  kind: 'curvedSheet'
  primitive: CurvedSheetPrimitive
}

export type SheetStratum =
  | QuadSheetStratum
  | PolygonSheetStratum
  | WorkPlaneFilledSheet3DStratum
  | CurvedSheetStratum

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

export type ArcDirection = 'counterclockwise' | 'clockwise'

export type ArcPathSegment = PathSegmentBase & {
  kind: 'arc'
  start: Vec3
  end: Vec3
  center: Vec3
  radius: number
  startAngleDeg: number
  endAngleDeg: number
  direction: ArcDirection
  frame?: WorkPlaneFrameSnapshot
}

export type PathSegment =
  | LinePathSegment
  | CubicBezierPathSegment
  | ArcPathSegment

export type ClosedPathBoundary = {
  id: string
  name?: string
  segments: PathSegment[]
}

export type PointCurveKind = 'polyline' | 'cubicBezier'
export type CurveKind =
  | PointCurveKind
  | 'concatenatedPath'
  | 'templatePath'
  | 'grid'

type CurveStratumBase = {
  id: string
  codim: 1 | 2
  geometricKind: 'curve'
  name: string
  label?: string
  pathLabel?: string
  stylePresetId?: string
  importedTikzStyleReferenceId?: string
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

export type CircleTemplatePath = {
  kind: 'circleTemplate'
  center: Vec3
  radius: number
  frame?: WorkPlaneFrameSnapshot
}

export type EllipseTemplatePath = {
  kind: 'ellipseTemplate'
  center: Vec3
  radiusX: number
  radiusY: number
  rotationDeg?: number
  frame?: WorkPlaneFrameSnapshot
}

export type PathTemplate = CircleTemplatePath | EllipseTemplatePath

export type TemplatePathStratum = CurveStratumBase & {
  kind: 'templatePath'
  template: PathTemplate
}

export type GridFrame = {
  kind: 'xy' | 'workPlane'
  frame: WorkPlaneFrameSnapshot
}

export type GridParameterRange = {
  min: ScalarInputValue
  max: ScalarInputValue
  step: ScalarInputValue
}

export type GridRectangleClip = {
  kind: 'rectangle'
  uMin: ScalarInputValue
  uMax: ScalarInputValue
  vMin: ScalarInputValue
  vMax: ScalarInputValue
}

export type GridStratum = CurveStratumBase & {
  kind: 'grid'
  frame: GridFrame
  uRange: GridParameterRange
  vRange: GridParameterRange
  clip: GridRectangleClip
}

export type CurveStratum =
  | PolylineCurveStratum
  | CubicBezierCurveStratum
  | ConcatenatedPathStratum
  | TemplatePathStratum
  | GridStratum

export type PointStratum = {
  id: string
  codim: 2 | 3
  geometricKind: 'point'
  name: string
  label?: string
  stylePresetId?: string
  importedTikzStyleReferenceId?: string
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
  stylePresetId?: string
  importedTikzStyleReferenceId?: string
  style: LabelStyle
  layer: number
}

export type DiagramLayer = {
  value: number
  name: string
  visible?: boolean
  locked?: boolean
}

export type SymbolicVariable = {
  id: string
  name: string
  macroName: string
  expression: string
  previewValue: number
}

export type Diagram = {
  version: 1
  ambientDimension: AmbientDimension
  camera: Camera
  view?: DiagramViewOptions
  layers?: DiagramLayer[]
  userStylePresets?: UserStylePreset[]
  externalTikzStyleSources?: ExternalTikzStyleSource[]
  importedTikzStyleReferences?: ImportedTikzStyleReference[]
  variables?: SymbolicVariable[]
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
