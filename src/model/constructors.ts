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
import { cloneCamera3D, createInitialCamera3D } from './camera.ts'
import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import { normalizeClosedPathBoundariesForAmbientDimension } from './filledBoundaries.ts'
import {
  normalizePathSegmentsForAmbientDimension,
  normalizeTemplatePathForAmbientDimension,
} from './paths.ts'
import { cloneCurvedSheetPrimitive } from './sheets.ts'
import type {
  AmbientDimension,
  Camera,
  Camera2D,
  Camera3D,
  ClosedPathBoundary,
  ConcatenatedPathStratum,
  CurvedSheetPrimitive,
  CurvedSheetStratum,
  CoordinateInputMode,
  CubicBezierCurveStratum,
  CubicBezierControlMode,
  CurveStratum,
  CurveStyle,
  CurveStyleSegment,
  Diagram,
  EditorState,
  FilledRegion2DStratum,
  FillRule,
  LabelStyle,
  PointStratum,
  PointStyle,
  PointCurveKind,
  PolylineCurveStratum,
  PathSegment,
  PathTemplate,
  QuadSheetStratum,
  RegionStratum,
  RegionStyle,
  SheetStratum,
  SheetStyle,
  TextLabel,
  TemplatePathStratum,
  Vec2,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneFilledSheet3DStratum,
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
  importedTikzStyleReferenceId?: string
  layer?: number
}

export type CreateFilledRegion2DStratumInput = {
  id: string
  name?: string
  label?: string
  visible?: boolean
  style?: RegionStyle
  importedTikzStyleReferenceId?: string
  boundaries: ClosedPathBoundary[]
  fillRule?: FillRule
  layer?: number
}

export type CreateSheetStratumInput = {
  ambientDimension: 3
  id: string
  name?: string
  label?: string
  style?: SheetStyle
  importedTikzStyleReferenceId?: string
  corners: [Vec3, Vec3, Vec3, Vec3]
  layer?: number
}

export type CreateWorkPlaneFilledSheet3DStratumInput = {
  id: string
  name?: string
  label?: string
  style?: SheetStyle
  importedTikzStyleReferenceId?: string
  planeFrame: WorkPlaneFrameSnapshot
  boundaries: ClosedPathBoundary[]
  fillRule?: FillRule
  layer?: number
}

export type CreateCurvedSheetStratumInput = {
  id: string
  name?: string
  label?: string
  style?: SheetStyle
  importedTikzStyleReferenceId?: string
  primitive: CurvedSheetPrimitive
  layer?: number
}

export type CreateCurveStratumInput = {
  ambientDimension: AmbientDimension
  id: string
  kind?: PointCurveKind
  name?: string
  label?: string
  pathLabel?: string
  style?: CurveStyle
  importedTikzStyleReferenceId?: string
  points: Vec3[]
  bezierControls?: CubicBezierControlMode
  styleSegments?: CurveStyleSegment[]
  layer?: number
}

export type CreateConcatenatedPathStratumInput = {
  ambientDimension: AmbientDimension
  id: string
  name?: string
  label?: string
  pathLabel?: string
  style?: CurveStyle
  importedTikzStyleReferenceId?: string
  segments: PathSegment[]
  styleSegments?: CurveStyleSegment[]
  layer?: number
}

export type CreateTemplatePathStratumInput = {
  ambientDimension: AmbientDimension
  id: string
  name?: string
  label?: string
  pathLabel?: string
  style?: CurveStyle
  importedTikzStyleReferenceId?: string
  template: PathTemplate
  styleSegments?: CurveStyleSegment[]
  layer?: number
}

export type CreatePointStratumInput = {
  ambientDimension: AmbientDimension
  id: string
  name?: string
  label?: string
  style?: PointStyle
  importedTikzStyleReferenceId?: string
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
  importedTikzStyleReferenceId?: string
  layer?: number
}

export function createEmptyDiagram({
  ambientDimension,
}: CreateEmptyDiagramInput): Diagram {
  const camera = createDefaultCamera(ambientDimension)

  return {
    version: 1,
    ambientDimension,
    camera,
    ...(camera.mode === '3d' ? { view: { camera3d: cloneCamera3D(camera) } } : {}),
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
  return createInitialCamera3D()
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
  importedTikzStyleReferenceId,
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
      ...(importedTikzStyleReferenceId === undefined
        ? {}
        : { importedTikzStyleReferenceId }),
      layer,
    },
    label,
  )
}

export function createFilledRegion2DStratum({
  id,
  name = 'Filled region',
  label,
  visible = true,
  style = defaultRegionStyle,
  importedTikzStyleReferenceId,
  boundaries,
  fillRule = 'nonzero',
  layer = 0,
}: CreateFilledRegion2DStratumInput): FilledRegion2DStratum {
  return withOptionalLabel(
    {
      id,
      codim: 0,
      geometricKind: 'region',
      kind: 'filledRegion',
      name,
      visible,
      style: cloneRegionStyle(style),
      ...(importedTikzStyleReferenceId === undefined
        ? {}
        : { importedTikzStyleReferenceId }),
      boundaries: normalizeClosedPathBoundariesForAmbientDimension(boundaries, 2),
      fillRule,
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
  importedTikzStyleReferenceId,
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
    ...(importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }),
    corners: corners.map(cloneVec3) as [Vec3, Vec3, Vec3, Vec3],
    layer,
  }

  return withOptionalLabel(sheet, label)
}

export function createWorkPlaneFilledSheet3DStratum({
  id,
  name = 'Filled sheet',
  label,
  style = defaultSheetStyle,
  importedTikzStyleReferenceId,
  planeFrame,
  boundaries,
  fillRule = 'nonzero',
  layer = 0,
}: CreateWorkPlaneFilledSheet3DStratumInput): WorkPlaneFilledSheet3DStratum {
  const sheet: Omit<WorkPlaneFilledSheet3DStratum, 'label'> = {
    id,
    codim: 1,
    geometricKind: 'sheet',
    kind: 'workPlaneFilledSheet',
    name,
    style: cloneSheetStyle(style),
    ...(importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }),
    planeFrame: cloneWorkPlaneFrameSnapshot(planeFrame),
    boundaries: normalizeClosedPathBoundariesForAmbientDimension(boundaries, 3),
    fillRule,
    layer,
  }

  return withOptionalLabel(sheet, label)
}

export function createCurvedSheetStratum({
  id,
  name = 'Curved sheet',
  label,
  style = defaultSheetStyle,
  importedTikzStyleReferenceId,
  primitive,
  layer = 0,
}: CreateCurvedSheetStratumInput): CurvedSheetStratum {
  const sheet: Omit<CurvedSheetStratum, 'label'> = {
    id,
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name,
    style: cloneSheetStyle(style),
    ...(importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }),
    primitive: cloneCurvedSheetPrimitive(primitive),
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
  importedTikzStyleReferenceId,
  points,
  bezierControls,
  styleSegments = [],
  layer = 0,
}: CreateCurveStratumInput): CurveStratum {
  if (kind === 'cubicBezier') {
    const curve: Omit<CubicBezierCurveStratum, 'label'> = {
      id,
      codim: ambientDimension === 2 ? 1 : 2,
      geometricKind: 'curve',
      kind,
      name,
      style: cloneCurveStyle(style),
      ...(importedTikzStyleReferenceId === undefined
        ? {}
        : { importedTikzStyleReferenceId }),
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

  const curve: Omit<PolylineCurveStratum, 'label'> = {
    id,
    codim: ambientDimension === 2 ? 1 : 2,
    geometricKind: 'curve',
    kind,
    name,
    style: cloneCurveStyle(style),
    ...(importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }),
    points: points.map((point) =>
      normalizePointForAmbientDimension(ambientDimension, point),
    ),
    styleSegments: styleSegments.map(cloneCurveStyleSegment),
    layer,
  }

  if (pathLabel !== undefined) {
    curve.pathLabel = pathLabel
  }

  return withOptionalLabel(curve, label)
}

export function createConcatenatedPathStratum({
  ambientDimension,
  id,
  name = 'Path',
  label,
  pathLabel,
  style = defaultCurveStyle,
  importedTikzStyleReferenceId,
  segments,
  styleSegments = [],
  layer = 0,
}: CreateConcatenatedPathStratumInput): ConcatenatedPathStratum {
  const path: Omit<ConcatenatedPathStratum, 'label'> = {
    id,
    codim: ambientDimension === 2 ? 1 : 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    name,
    style: cloneCurveStyle(style),
    ...(importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }),
    segments: normalizePathSegmentsForAmbientDimension(
      segments,
      ambientDimension,
    ),
    styleSegments: styleSegments.map(cloneCurveStyleSegment),
    layer,
  }

  if (pathLabel !== undefined) {
    path.pathLabel = pathLabel
  }

  return withOptionalLabel(path, label)
}

export function createTemplatePathStratum({
  ambientDimension,
  id,
  name = 'Path template',
  label,
  pathLabel,
  style = defaultCurveStyle,
  importedTikzStyleReferenceId,
  template,
  styleSegments = [],
  layer = 0,
}: CreateTemplatePathStratumInput): TemplatePathStratum {
  const path: Omit<TemplatePathStratum, 'label'> = {
    id,
    codim: ambientDimension === 2 ? 1 : 2,
    geometricKind: 'curve',
    kind: 'templatePath',
    name,
    style: cloneCurveStyle(style),
    ...(importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }),
    template: normalizeTemplatePathForAmbientDimension(
      template,
      ambientDimension,
    ),
    styleSegments: styleSegments.map(cloneCurveStyleSegment),
    layer,
  }

  if (pathLabel !== undefined) {
    path.pathLabel = pathLabel
  }

  return withOptionalLabel(path, label)
}

export function createPointStratum({
  ambientDimension,
  id,
  name = 'Point',
  label,
  style = defaultPointStyle,
  importedTikzStyleReferenceId,
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
      ...(importedTikzStyleReferenceId === undefined
        ? {}
        : { importedTikzStyleReferenceId }),
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
  importedTikzStyleReferenceId,
  layer = 0,
}: CreateTextLabelInput): TextLabel {
  return {
    id,
    geometricKind: 'label',
    name,
    text,
    position: normalizePointForAmbientDimension(ambientDimension, position),
    ...(importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }),
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
