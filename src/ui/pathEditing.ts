import {
  absoluteCubicBezierPointsFromControlMode,
  cubicBezierControlModeLabel,
  relativeCartesianControlModeFromPoints,
  relativePolarControlModeFromPoints,
} from '../geometry/bezierControls.ts'
import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import { pathSegmentEnd } from '../model/paths.ts'
import {
  isHexColor,
  isLineStyle,
  isOpacity,
  isPositiveFiniteNumber,
} from '../model/styles.ts'
import type {
  AmbientDimension,
  ConcatenatedPathStratum,
  CubicBezierControlMode,
  CubicBezierPathSegment,
  HexColor,
  LineStyle,
  PathInlineNode,
  PathSegment,
  PathSegmentStyleOverride,
  Vec3,
  CoordinateComponent,
} from '../model/types.ts'
import { updateVec3Coordinate, type CoordinateAxis } from './diagramUpdates.ts'

export type ConcatenatedPathPointRole =
  | 'start'
  | 'control1'
  | 'control2'
  | 'end'

export type ConcatenatedPathPointTarget = {
  segmentIndex: number
  role: ConcatenatedPathPointRole
}

export type InspectorBezierControlMode =
  | 'absolute'
  | 'relativeCartesian'
  | 'relativePolar'

export type PathSegmentStyleOverrideField =
  | 'strokeColor'
  | 'strokeOpacity'
  | 'lineWidth'
  | 'lineStyle'

type PathSegmentStyleOverrideValue = HexColor | number | LineStyle

export type ConcatenatedPathPointDescription = {
  target: ConcatenatedPathPointTarget
  label: string
  point: Vec3
}

export type ConcatenatedPathSegmentDescription = {
  segmentIndex: number
  segmentNumber: number
  kind: PathSegment['kind']
  kindLabel: string
  points: ConcatenatedPathPointDescription[]
  bezierControlMode: InspectorBezierControlMode | null
  bezierControlModeLabel: string | null
}

const defaultAppendLength = 1
const firstCubicControlFraction = 1 / 3
const secondCubicControlFraction = 2 / 3

export function describeConcatenatedPathSegments(
  path: ConcatenatedPathStratum,
): ConcatenatedPathSegmentDescription[] {
  return path.segments.map((segment, segmentIndex) => ({
    segmentIndex,
    segmentNumber: segmentIndex + 1,
    kind: segment.kind,
    kindLabel: pathSegmentKindLabel(segment.kind),
    points: describePathSegmentPoints(segment, segmentIndex),
    bezierControlMode:
      segment.kind === 'cubicBezier'
        ? editableInspectorBezierControlMode(segment.controlMode)
        : null,
    bezierControlModeLabel:
      segment.kind === 'cubicBezier'
        ? cubicBezierControlModeLabel(segment.controlMode)
        : null,
  }))
}

export function updateConcatenatedPathCoordinate(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
  target: ConcatenatedPathPointTarget,
  axis: CoordinateAxis,
  value: number | CoordinateComponent,
): ConcatenatedPathStratum {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return path
  }

  const segment = path.segments[target.segmentIndex]

  if (segment === undefined) {
    return path
  }

  const point = pointForRole(segment, target.role)

  if (point === null) {
    return path
  }

  return updateConcatenatedPathPoint(
    path,
    ambientDimension,
    target,
    updateVec3Coordinate(point, axis, value, ambientDimension),
  )
}

export function updateConcatenatedPathPoint(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
  target: ConcatenatedPathPointTarget,
  point: Vec3,
): ConcatenatedPathStratum {
  if (
    !Number.isInteger(target.segmentIndex) ||
    target.segmentIndex < 0 ||
    target.segmentIndex >= path.segments.length ||
    !isFiniteVec3(point)
  ) {
    return path
  }

  const normalizedPoint = normalizePointForAmbientDimension(
    ambientDimension,
    point,
  )

  if (!isFiniteVec3(normalizedPoint)) {
    return path
  }

  const updatedSegments = updatePathSegmentsPoint(
    path.segments,
    ambientDimension,
    target,
    normalizedPoint,
  )

  return updatedSegments === null ? path : { ...path, segments: updatedSegments }
}

export function updateConcatenatedPathCubicControlMode(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
  segmentIndex: number,
  mode: InspectorBezierControlMode,
): ConcatenatedPathStratum {
  const segment = path.segments[segmentIndex]

  if (segment?.kind !== 'cubicBezier') {
    return path
  }

  const controlMode = cubicControlModeFromSegment(
    segment,
    ambientDimension,
    mode,
  )

  if (controlMode === null) {
    return path
  }

  return updatePathSegment(path, segmentIndex, {
    ...segment,
    controlMode,
  })
}

export function updateConcatenatedPathRelativeCartesianOffset(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
  segmentIndex: number,
  offsetKey: 'firstControlOffset' | 'secondControlOffset',
  axis: CoordinateAxis,
  value: number | CoordinateComponent,
): ConcatenatedPathStratum {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return path
  }

  const segment = path.segments[segmentIndex]

  if (
    segment?.kind !== 'cubicBezier' ||
    segment.controlMode?.kind !== 'relativeCartesian'
  ) {
    return path
  }

  const controlMode: CubicBezierControlMode = {
    ...segment.controlMode,
    [offsetKey]: updateVec3Coordinate(
      segment.controlMode[offsetKey],
      axis,
      value,
      ambientDimension,
    ),
  }

  return updateCubicSegmentFromControlMode(
    path,
    ambientDimension,
    segmentIndex,
    segment,
    controlMode,
  )
}

export function updateConcatenatedPathRelativePolarControl(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
  segmentIndex: number,
  controlKey: 'firstControl' | 'secondControl',
  valueKey: 'angleDegrees' | 'radius',
  value: number,
): ConcatenatedPathStratum {
  if (!Number.isFinite(value)) {
    return path
  }

  const segment = path.segments[segmentIndex]

  if (
    segment?.kind !== 'cubicBezier' ||
    segment.controlMode?.kind !== 'relativePolar'
  ) {
    return path
  }

  const controlMode: CubicBezierControlMode = {
    ...segment.controlMode,
    [controlKey]: {
      ...segment.controlMode[controlKey],
      [valueKey]: value,
    },
  }

  return updateCubicSegmentFromControlMode(
    path,
    ambientDimension,
    segmentIndex,
    segment,
    controlMode,
  )
}

export function updateConcatenatedPathSegmentStyleOverrideField(
  path: ConcatenatedPathStratum,
  segmentIndex: number,
  field: PathSegmentStyleOverrideField,
  value: PathSegmentStyleOverrideValue,
): ConcatenatedPathStratum {
  const segment = path.segments[segmentIndex]

  if (
    segment === undefined ||
    !isValidPathSegmentStyleOverrideValue(field, value)
  ) {
    return path
  }

  const styleOverride: PathSegmentStyleOverride = {
    ...(segment.styleOverride ?? {}),
    [field]: value,
  }

  return updatePathSegment(
    path,
    segmentIndex,
    withPathSegmentStyleOverride(segment, styleOverride),
  )
}

export function clearConcatenatedPathSegmentStyleOverride(
  path: ConcatenatedPathStratum,
  segmentIndex: number,
): ConcatenatedPathStratum {
  const segment = path.segments[segmentIndex]

  if (segment === undefined || segment.styleOverride === undefined) {
    return path
  }

  return updatePathSegment(
    path,
    segmentIndex,
    withoutPathSegmentStyleOverride(segment),
  )
}

export function appendLineSegmentToConcatenatedPath(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
): ConcatenatedPathStratum {
  const appendStart = appendStartPoint(path)

  if (appendStart === null) {
    return path
  }

  const segment: PathSegment = {
    kind: 'line',
    start: appendStart,
    end: normalizePointForAmbientDimension(ambientDimension, {
      x: appendStart.x + defaultAppendLength,
      y: appendStart.y,
      z: appendStart.z,
    }),
  }

  return {
    ...path,
    segments: [...path.segments, segment],
  }
}

export function appendCubicSegmentToConcatenatedPath(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
): ConcatenatedPathStratum {
  const appendStart = appendStartPoint(path)

  if (appendStart === null) {
    return path
  }

  const segment: PathSegment = {
    kind: 'cubicBezier',
    start: appendStart,
    control1: normalizePointForAmbientDimension(ambientDimension, {
      x: appendStart.x + defaultAppendLength * firstCubicControlFraction,
      y: appendStart.y,
      z: appendStart.z,
    }),
    control2: normalizePointForAmbientDimension(ambientDimension, {
      x: appendStart.x + defaultAppendLength * secondCubicControlFraction,
      y: appendStart.y,
      z: appendStart.z,
    }),
    end: normalizePointForAmbientDimension(ambientDimension, {
      x: appendStart.x + defaultAppendLength,
      y: appendStart.y,
      z: appendStart.z,
    }),
    controlMode: { kind: 'absolute' },
  }

  return {
    ...path,
    segments: [...path.segments, segment],
  }
}

export function removeLastSegmentFromConcatenatedPath(
  path: ConcatenatedPathStratum,
): ConcatenatedPathStratum {
  return removeSegmentFromConcatenatedPath(path, path.segments.length - 1)
}

export function removeSegmentFromConcatenatedPath(
  path: ConcatenatedPathStratum,
  segmentIndex: number,
): ConcatenatedPathStratum {
  if (path.segments.length <= 1) {
    return path
  }

  if (
    !Number.isInteger(segmentIndex) ||
    segmentIndex < 0 ||
    segmentIndex >= path.segments.length
  ) {
    return path
  }

  const segments = pathSegmentsAfterSegmentRemoval(path, segmentIndex)

  if (segments === null) {
    return path
  }

  const nextPath: ConcatenatedPathStratum = {
    ...path,
    segments,
  }

  const inlineNodes = inlineNodesAfterSegmentRemoval(
    path.inlineNodes,
    segmentIndex,
  )

  if (path.inlineNodes === undefined) {
    return nextPath
  }

  if (inlineNodes === undefined) {
    delete nextPath.inlineNodes
  } else {
    nextPath.inlineNodes = inlineNodes
  }

  return nextPath
}

export function bezierControlModeOptions(
  ambientDimension: AmbientDimension,
): readonly InspectorBezierControlMode[] {
  return ambientDimension === 2
    ? ['absolute', 'relativeCartesian', 'relativePolar']
    : ['absolute', 'relativeCartesian']
}

function describePathSegmentPoints(
  segment: PathSegment,
  segmentIndex: number,
): ConcatenatedPathPointDescription[] {
  if (segment.kind === 'line') {
    return [
      pointDescription(segmentIndex, 'start', 'Start', segment.start),
      pointDescription(segmentIndex, 'end', 'End', segment.end),
    ]
  }

  if (segment.kind === 'arc') {
    return []
  }

  return [
    pointDescription(segmentIndex, 'start', 'Start', segment.start),
    pointDescription(
      segmentIndex,
      'control1',
      'Control point 1',
      segment.control1,
    ),
    pointDescription(
      segmentIndex,
      'control2',
      'Control point 2',
      segment.control2,
    ),
    pointDescription(segmentIndex, 'end', 'End', segment.end),
  ]
}

function pointDescription(
  segmentIndex: number,
  role: ConcatenatedPathPointRole,
  label: string,
  point: Vec3,
): ConcatenatedPathPointDescription {
  return {
    target: { segmentIndex, role },
    label,
    point,
  }
}

function pathSegmentKindLabel(kind: PathSegment['kind']): string {
  switch (kind) {
    case 'line':
      return 'Line'
    case 'cubicBezier':
      return 'Cubic Bezier'
    case 'arc':
      return 'Arc'
  }
}

function pointForRole(
  segment: PathSegment,
  role: ConcatenatedPathPointRole,
): Vec3 | null {
  switch (role) {
    case 'start':
      return segment.start
    case 'end':
      return segment.end
    case 'control1':
      return segment.kind === 'cubicBezier' ? segment.control1 : null
    case 'control2':
      return segment.kind === 'cubicBezier' ? segment.control2 : null
  }
}

function inlineNodesAfterSegmentRemoval(
  inlineNodes: readonly PathInlineNode[] | undefined,
  removedSegmentIndex: number,
): PathInlineNode[] | undefined {
  if (inlineNodes === undefined) {
    return undefined
  }

  const nextNodes = inlineNodes.flatMap((node): PathInlineNode[] => {
    const segmentIndex = node.position.segmentIndex

    if (segmentIndex === removedSegmentIndex) {
      return []
    }

    return [
      {
        ...node,
        position: {
          ...node.position,
          segmentIndex:
            segmentIndex > removedSegmentIndex
              ? segmentIndex - 1
              : segmentIndex,
        },
      },
    ]
  })

  return nextNodes.length === 0 ? undefined : nextNodes
}

function pathSegmentsAfterSegmentRemoval(
  path: ConcatenatedPathStratum,
  removedSegmentIndex: number,
): PathSegment[] | null {
  const segments = path.segments.filter(
    (_, index) => index !== removedSegmentIndex,
  )

  if (
    removedSegmentIndex === 0 ||
    removedSegmentIndex >= path.segments.length - 1
  ) {
    return segments
  }

  const previousSegment = path.segments[removedSegmentIndex - 1]
  const nextSegment = segments[removedSegmentIndex]

  if (previousSegment === undefined || nextSegment === undefined) {
    return null
  }

  const reconnectedSegment = reconnectSegmentStartAfterRemoval(
    nextSegment,
    ambientDimensionForPath(path),
    pathSegmentEnd(previousSegment),
  )

  if (reconnectedSegment === null) {
    return null
  }

  return segments.map((segment, index) =>
    index === removedSegmentIndex ? reconnectedSegment : segment,
  )
}

function reconnectSegmentStartAfterRemoval(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
  start: Vec3,
): PathSegment | null {
  switch (segment.kind) {
    case 'line':
    case 'cubicBezier':
      return updateSegmentEndpoint(segment, ambientDimension, 'start', start)
    case 'arc':
      return null
  }
}

function ambientDimensionForPath(path: ConcatenatedPathStratum): AmbientDimension {
  return path.codim === 1 ? 2 : 3
}

function updatePathSegmentsPoint(
  segments: readonly PathSegment[],
  ambientDimension: AmbientDimension,
  target: ConcatenatedPathPointTarget,
  point: Vec3,
): PathSegment[] | null {
  const segment = segments[target.segmentIndex]
  const updatedSegment = updateSegmentPoint(
    segment,
    ambientDimension,
    target.role,
    point,
  )

  if (updatedSegment === null) {
    return null
  }

  return segments.map((currentSegment, index) => {
    if (index === target.segmentIndex) {
      return updatedSegment
    }

    if (target.role === 'start' && index === target.segmentIndex - 1) {
      return updateSegmentEndpoint(currentSegment, ambientDimension, 'end', point)
    }

    if (target.role === 'end' && index === target.segmentIndex + 1) {
      return updateSegmentEndpoint(currentSegment, ambientDimension, 'start', point)
    }

    return currentSegment
  })
}

function updateSegmentPoint(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
  role: ConcatenatedPathPointRole,
  point: Vec3,
): PathSegment | null {
  if (role === 'start' || role === 'end') {
    return updateSegmentEndpoint(segment, ambientDimension, role, point)
  }

  if (segment.kind !== 'cubicBezier') {
    return null
  }

  return {
    ...segment,
    [role]: point,
    controlMode: { kind: 'absolute' },
  }
}

function updateSegmentEndpoint(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
  role: 'start' | 'end',
  point: Vec3,
): PathSegment {
  const updatedSegment = {
    ...segment,
    [role]: point,
  }

  return updatedSegment.kind === 'cubicBezier'
    ? recomputeCubicControlsAfterEndpointUpdate(
        updatedSegment,
        ambientDimension,
      )
    : updatedSegment
}

function recomputeCubicControlsAfterEndpointUpdate(
  segment: CubicBezierPathSegment,
  ambientDimension: AmbientDimension,
): CubicBezierPathSegment {
  const controlMode = segment.controlMode

  if (
    controlMode === undefined ||
    controlMode.kind === 'absolute' ||
    controlMode.kind === 'workPlaneRelativeCartesian' ||
    controlMode.kind === 'workPlaneRelativePolar'
  ) {
    return controlMode?.kind === 'workPlaneRelativeCartesian' ||
      controlMode?.kind === 'workPlaneRelativePolar'
      ? { ...segment, controlMode: { kind: 'absolute' } }
      : segment
  }

  const absolutePoints = absoluteCubicBezierPointsFromControlMode(
    ambientDimension,
    segment.start,
    segment.end,
    controlMode,
  )

  return absolutePoints === null
    ? { ...segment, controlMode: { kind: 'absolute' } }
    : {
        ...segment,
        start: absolutePoints[0],
        control1: absolutePoints[1],
        control2: absolutePoints[2],
        end: absolutePoints[3],
      }
}

function updateCubicSegmentFromControlMode(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
  segmentIndex: number,
  segment: CubicBezierPathSegment,
  controlMode: CubicBezierControlMode,
): ConcatenatedPathStratum {
  const absolutePoints = absoluteCubicBezierPointsFromControlMode(
    ambientDimension,
    segment.start,
    segment.end,
    controlMode,
  )

  if (absolutePoints === null) {
    return path
  }

  return updatePathSegment(path, segmentIndex, {
    ...segment,
    start: absolutePoints[0],
    control1: absolutePoints[1],
    control2: absolutePoints[2],
    end: absolutePoints[3],
    controlMode,
  })
}

function updatePathSegment(
  path: ConcatenatedPathStratum,
  segmentIndex: number,
  segment: PathSegment,
): ConcatenatedPathStratum {
  if (
    !Number.isInteger(segmentIndex) ||
    segmentIndex < 0 ||
    segmentIndex >= path.segments.length
  ) {
    return path
  }

  return {
    ...path,
    segments: path.segments.map((currentSegment, index) =>
      index === segmentIndex ? segment : currentSegment,
    ),
  }
}

function withPathSegmentStyleOverride(
  segment: PathSegment,
  styleOverride: PathSegmentStyleOverride,
): PathSegment {
  return {
    ...segment,
    styleOverride,
  }
}

function withoutPathSegmentStyleOverride(segment: PathSegment): PathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        start: segment.start,
        end: segment.end,
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        start: segment.start,
        control1: segment.control1,
        control2: segment.control2,
        end: segment.end,
        ...(segment.controlMode === undefined
          ? {}
          : { controlMode: segment.controlMode }),
      }
    case 'arc':
      return {
        kind: 'arc',
        start: segment.start,
        end: segment.end,
        center: segment.center,
        radius: segment.radius,
        startAngleDeg: segment.startAngleDeg,
        endAngleDeg: segment.endAngleDeg,
        direction: segment.direction,
        ...(segment.frame === undefined ? {} : { frame: segment.frame }),
      }
  }
}

function isValidPathSegmentStyleOverrideValue(
  field: PathSegmentStyleOverrideField,
  value: PathSegmentStyleOverrideValue,
): boolean {
  switch (field) {
    case 'strokeColor':
      return typeof value === 'string' && isHexColor(value)
    case 'strokeOpacity':
      return typeof value === 'number' && isOpacity(value)
    case 'lineWidth':
      return typeof value === 'number' && isPositiveFiniteNumber(value)
    case 'lineStyle':
      return typeof value === 'string' && isLineStyle(value)
  }
}

function cubicControlModeFromSegment(
  segment: CubicBezierPathSegment,
  ambientDimension: AmbientDimension,
  mode: InspectorBezierControlMode,
): CubicBezierControlMode | null {
  if (mode === 'absolute') {
    return { kind: 'absolute' }
  }

  const points: [Vec3, Vec3, Vec3, Vec3] = [
    segment.start,
    segment.control1,
    segment.control2,
    segment.end,
  ]

  return mode === 'relativeCartesian'
    ? relativeCartesianControlModeFromPoints(ambientDimension, points)
    : relativePolarControlModeFromPoints(ambientDimension, points)
}

function editableInspectorBezierControlMode(
  controlMode: CubicBezierControlMode | undefined,
): InspectorBezierControlMode | null {
  switch (controlMode?.kind ?? 'absolute') {
    case 'absolute':
      return 'absolute'
    case 'relativeCartesian':
      return 'relativeCartesian'
    case 'relativePolar':
      return 'relativePolar'
    case 'workPlaneRelativeCartesian':
    case 'workPlaneRelativePolar':
      return null
  }
}

function appendStartPoint(path: ConcatenatedPathStratum): Vec3 | null {
  if (path.segments.length === 0) {
    return null
  }

  return cloneVec3(pathSegmentEnd(path.segments[path.segments.length - 1]))
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function cloneVec3(point: Vec3): Vec3 {
  return { ...point }
}
