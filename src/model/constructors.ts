import {
  cloneCurveStyle,
  cloneLabelStyle,
  clonePointStyle,
  cloneRegionStyle,
  cloneSheetStyle,
  defaultCurveStyle,
  defaultLabelStyle,
  defaultPointStyle,
  defaultRegionStyle,
  defaultSheetStyle,
} from './styles.ts'
import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import type {
  AmbientDimension,
  Camera,
  Camera2D,
  Camera3D,
  CoordinateInputMode,
  CubicBezierControlMode,
  CurveKind,
  CurveStratum,
  CurveStyle,
  CurveStyleSegment,
  Diagram,
  EditorState,
  LabelStyle,
  PointStratum,
  PointStyle,
  QuadSheetStratum,
  RegionStratum,
  RegionStyle,
  SheetStratum,
  SheetStyle,
  TextLabel,
  Vec2,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinate,
  WorkPlaneLocalOffset,
  WorkPlane,
} from './types.ts'

export { normalizePointForAmbientDimension } from '../geometry/projection.ts'

export type CreateEmptyDiagramInput = {
  ambientDimension: AmbientDimension
}

export type CreateEditorStateInput = {
  selectedId?: string | null
  coordinateInputMode?: CoordinateInputMode
  activeWorkPlane?: WorkPlane
  snapToGrid?: boolean
  gridSize?: number
}

export type CreateRegionStratumInput = {
  ambientDimension: AmbientDimension
  id: string
  name?: string
  label?: string
  visible?: boolean
  style?: RegionStyle
  layer?: number
}

export type CreateSheetStratumInput = {
  ambientDimension: 3
  id: string
  name?: string
  label?: string
  style?: SheetStyle
  corners: [Vec3, Vec3, Vec3, Vec3]
  layer?: number
}

export type CreateCurveStratumInput = {
  ambientDimension: AmbientDimension
  id: string
  kind?: CurveKind
  name?: string
  label?: string
  pathLabel?: string
  style?: CurveStyle
  points: Vec3[]
  bezierControls?: CubicBezierControlMode
  styleSegments?: CurveStyleSegment[]
  layer?: number
}

export type CreatePointStratumInput = {
  ambientDimension: AmbientDimension
  id: string
  name?: string
  label?: string
  style?: PointStyle
  position: Vec3
  layer?: number
}

export type CreateTextLabelInput = {
  ambientDimension: AmbientDimension
  id: string
  name?: string
  text: string
  position: Vec3
  style?: LabelStyle
  layer?: number
}

export function createEmptyDiagram({
  ambientDimension,
}: CreateEmptyDiagramInput): Diagram {
  return {
    version: 1,
    ambientDimension,
    camera: createDefaultCamera(ambientDimension),
    strata: [],
    labels: [],
  }
}

export function createDefaultEditorState({
  selectedId = null,
  coordinateInputMode = 'direct',
  activeWorkPlane = { kind: 'xy', z: 0 },
  snapToGrid = false,
  gridSize = 1,
}: CreateEditorStateInput = {}): EditorState {
  return {
    selectedId,
    coordinateInputMode,
    activeWorkPlane,
    snapToGrid,
    gridSize,
  }
}

export function createDefaultCamera(
  ambientDimension: AmbientDimension,
): Camera {
  return ambientDimension === 2 ? createDefaultCamera2D() : createDefaultCamera3D()
}

export function createDefaultCamera2D(): Camera2D {
  return {
    mode: '2d',
    scale: 1,
    origin: createVec2(0, 0),
  }
}

export function createDefaultCamera3D(): Camera3D {
  return {
    mode: '3d',
    projection: 'orthographic',
    xVector: [1, 0],
    yVector: [0.45, 0.25],
    zVector: [0, 1],
    scale: 1,
    origin: createVec2(0, 0),
  }
}

export function createVec2(x: number, y: number): Vec2 {
  return { x, y }
}

export function createVec3(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

export function createRegionStratum({
  id,
  name = 'Region',
  label,
  visible = true,
  style = defaultRegionStyle,
  layer = 0,
}: CreateRegionStratumInput): RegionStratum {
  return withOptionalLabel(
    {
      id,
      codim: 0,
      geometricKind: 'region',
      name,
      visible,
      style: cloneRegionStyle(style),
      layer,
    },
    label,
  )
}

export function createSheetStratum({
  id,
  name = 'Sheet',
  label,
  style = defaultSheetStyle,
  corners,
  layer = 0,
}: CreateSheetStratumInput): SheetStratum {
  const sheet: Omit<QuadSheetStratum, 'label'> = {
    id,
    codim: 1,
    geometricKind: 'sheet',
    kind: 'quadSheet',
    name,
    style: cloneSheetStyle(style),
    corners: corners.map(cloneVec3) as [Vec3, Vec3, Vec3, Vec3],
    layer,
  }

  return withOptionalLabel(sheet, label)
}

export function createCurveStratum({
  ambientDimension,
  id,
  kind = 'polyline',
  name = 'Curve',
  label,
  pathLabel,
  style = defaultCurveStyle,
  points,
  bezierControls,
  styleSegments = [],
  layer = 0,
}: CreateCurveStratumInput): CurveStratum {
  const curve: Omit<CurveStratum, 'label'> = {
    id,
    codim: ambientDimension === 2 ? 1 : 2,
    geometricKind: 'curve',
    kind,
    name,
    style: cloneCurveStyle(style),
    points: points.map((point) =>
      normalizePointForAmbientDimension(ambientDimension, point),
    ),
    styleSegments: styleSegments.map(cloneCurveStyleSegment),
    layer,
  }

  if (bezierControls !== undefined) {
    curve.bezierControls = cloneCubicBezierControlMode(bezierControls)
  }

  if (pathLabel !== undefined) {
    curve.pathLabel = pathLabel
  }

  return withOptionalLabel(curve, label)
}

export function createPointStratum({
  ambientDimension,
  id,
  name = 'Point',
  label,
  style = defaultPointStyle,
  position,
  layer = 0,
}: CreatePointStratumInput): PointStratum {
  return withOptionalLabel(
    {
      id,
      codim: ambientDimension === 2 ? 2 : 3,
      geometricKind: 'point',
      name,
      style: clonePointStyle(style),
      position: normalizePointForAmbientDimension(ambientDimension, position),
      layer,
    },
    label,
  )
}

export function createTextLabel({
  ambientDimension,
  id,
  name = 'Label',
  text,
  position,
  style = defaultLabelStyle,
  layer = 0,
}: CreateTextLabelInput): TextLabel {
  return {
    id,
    geometricKind: 'label',
    name,
    text,
    position: normalizePointForAmbientDimension(ambientDimension, position),
    style: cloneLabelStyle(style),
    layer,
  }
}

function cloneVec3(point: Vec3): Vec3 {
  return { ...point }
}

function cloneCurveStyleSegment(segment: CurveStyleSegment): CurveStyleSegment {
  return {
    ...segment,
    style: { ...segment.style },
  }
}

function cloneCubicBezierControlMode(
  controlMode: CubicBezierControlMode,
): CubicBezierControlMode {
  switch (controlMode.kind) {
    case 'absolute':
      return { kind: 'absolute' }
    case 'relativeCartesian':
      return {
        kind: 'relativeCartesian',
        firstControlOffset: cloneVec3(controlMode.firstControlOffset),
        secondControlOffset: cloneVec3(controlMode.secondControlOffset),
        secondOffsetReference: controlMode.secondOffsetReference,
      }
    case 'relativePolar':
      return {
        kind: 'relativePolar',
        firstControl: { ...controlMode.firstControl },
        secondControl: { ...controlMode.secondControl },
        secondOffsetReference: controlMode.secondOffsetReference,
      }
    case 'workPlaneRelativeCartesian':
      return {
        kind: 'workPlaneRelativeCartesian',
        frame: cloneWorkPlaneFrameSnapshot(controlMode.frame),
        localStart: cloneWorkPlaneLocalCoordinate(controlMode.localStart),
        localEnd: cloneWorkPlaneLocalCoordinate(controlMode.localEnd),
        firstControlOffset: cloneWorkPlaneLocalOffset(
          controlMode.firstControlOffset,
        ),
        secondControlOffset: cloneWorkPlaneLocalOffset(
          controlMode.secondControlOffset,
        ),
        secondOffsetReference: controlMode.secondOffsetReference,
      }
    case 'workPlaneRelativePolar':
      return {
        kind: 'workPlaneRelativePolar',
        frame: cloneWorkPlaneFrameSnapshot(controlMode.frame),
        localStart: cloneWorkPlaneLocalCoordinate(controlMode.localStart),
        localEnd: cloneWorkPlaneLocalCoordinate(controlMode.localEnd),
        firstControl: { ...controlMode.firstControl },
        secondControl: { ...controlMode.secondControl },
        secondOffsetReference: controlMode.secondOffsetReference,
      }
  }
}

function cloneWorkPlaneFrameSnapshot(
  frame: WorkPlaneFrameSnapshot,
): WorkPlaneFrameSnapshot {
  return {
    origin: cloneVec3(frame.origin),
    u: cloneVec3(frame.u),
    v: cloneVec3(frame.v),
    normal: cloneVec3(frame.normal),
  }
}

function cloneWorkPlaneLocalCoordinate(
  coordinate: WorkPlaneLocalCoordinate,
): WorkPlaneLocalCoordinate {
  return { ...coordinate }
}

function cloneWorkPlaneLocalOffset(
  offset: WorkPlaneLocalOffset,
): WorkPlaneLocalOffset {
  return { ...offset }
}

function withOptionalLabel<T extends { label?: string }>(
  value: Omit<T, 'label'>,
  label: string | undefined,
): T {
  return label === undefined ? (value as T) : ({ ...value, label } as T)
}
