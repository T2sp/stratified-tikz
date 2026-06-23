import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import { curveStylesEqual, resolveCurveStyle } from './styles.ts'
import type { ScalarInputValue } from './scalarExpressions.ts'
import type {
  AmbientDimension,
  ArcDirection,
  ArcPathSegment,
  BoundaryPathSnapshot,
  CircleTemplatePath,
  ConcatenatedPathStratum,
  CurveStyle,
  CurveStratum,
  CubicBezierControlMode,
  CubicBezierPathSegment,
  CurveStyleSegment,
  EllipseTemplatePath,
  LinePathSegment,
  PathTemplate,
  PathSegment,
  PathSegmentStyleOverride,
  Vec3,
  WorkPlaneFrameSnapshot,
} from './types.ts'

export const pathEndpointEpsilon = 1e-9
const minTemplatePathSamples = 8
// Template path sampling feeds preview and geometry helpers. Keep the exported
// sampler bounded even when a caller does not provide a feature-specific cap.
export const MAX_TEMPLATE_PATH_SAMPLES = 1024
const fullTurnDegrees = 360
const maxArcCubicSweepDegrees = 90

export type ArcScalarInputValue = number | ScalarInputValue

export type TemplatePathSamplingOptions = {
  maxSamples?: number
}

export type PathEndpointPair = {
  start: Vec3
  end: Vec3
}

export type PathSegmentStyleRun = {
  startIndex: number
  segments: PathSegment[]
  style: CurveStyle
}

export type ReversibleCurveStratum = Extract<
  CurveStratum,
  { kind: 'polyline' | 'cubicBezier' | 'concatenatedPath' }
>

export function pathSegmentsFromPolyline(
  points: readonly Vec3[],
): LinePathSegment[] {
  if (points.length < 2) {
    return []
  }

  return points.slice(0, -1).map((point, index) => ({
    kind: 'line',
    start: cloneVec3(point),
    end: cloneVec3(points[index + 1]),
  }))
}

export function pathSegmentsFromCubicBezier(
  points: readonly Vec3[],
  controlMode?: CubicBezierControlMode,
): CubicBezierPathSegment[] {
  if (points.length !== 4) {
    return []
  }

  return [
    {
      kind: 'cubicBezier',
      start: cloneVec3(points[0]),
      control1: cloneVec3(points[1]),
      control2: cloneVec3(points[2]),
      end: cloneVec3(points[3]),
      ...(controlMode === undefined
        ? {}
        : { controlMode: cloneCubicBezierControlMode(controlMode) }),
    },
  ]
}

export function cloneBoundaryPathSnapshot(
  snapshot: BoundaryPathSnapshot,
): BoundaryPathSnapshot {
  return {
    ...(snapshot.id === undefined ? {} : { id: snapshot.id }),
    ...(snapshot.name === undefined ? {} : { name: snapshot.name }),
    segments: snapshot.segments.map(clonePathSegment),
  }
}

export function reverseBoundaryPathSnapshot(
  boundary: BoundaryPathSnapshot,
): BoundaryPathSnapshot {
  return {
    ...(boundary.id === undefined ? {} : { id: boundary.id }),
    ...(boundary.name === undefined ? {} : { name: boundary.name }),
    segments: [...boundary.segments].reverse().map(reversePathSegment),
  }
}

export function clonePathSegment(segment: PathSegment): PathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        start: cloneVec3(segment.start),
        end: cloneVec3(segment.end),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: clonePathSegmentStyleOverride(segment.styleOverride) }),
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        start: cloneVec3(segment.start),
        control1: cloneVec3(segment.control1),
        control2: cloneVec3(segment.control2),
        end: cloneVec3(segment.end),
        ...(segment.controlMode === undefined
          ? {}
          : { controlMode: cloneCubicBezierControlMode(segment.controlMode) }),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: clonePathSegmentStyleOverride(segment.styleOverride) }),
      }
    case 'arc':
      return {
        kind: 'arc',
        start: cloneVec3(segment.start),
        end: cloneVec3(segment.end),
        center: cloneVec3(segment.center),
        radius: cloneArcScalarInputValue(segment.radius),
        startAngleDeg: cloneArcScalarInputValue(segment.startAngleDeg),
        endAngleDeg: cloneArcScalarInputValue(segment.endAngleDeg),
        direction: segment.direction,
        ...(segment.frame === undefined
          ? {}
          : { frame: cloneWorkPlaneFrameSnapshot(segment.frame) }),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: clonePathSegmentStyleOverride(segment.styleOverride) }),
      }
  }
}

export function reversePathSegment(segment: PathSegment): PathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        start: cloneVec3(segment.end),
        end: cloneVec3(segment.start),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: clonePathSegmentStyleOverride(segment.styleOverride) }),
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        start: cloneVec3(segment.end),
        control1: cloneVec3(segment.control2),
        control2: cloneVec3(segment.control1),
        end: cloneVec3(segment.start),
        ...(segment.controlMode === undefined
          ? {}
          : { controlMode: { kind: 'absolute' } as CubicBezierControlMode }),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: clonePathSegmentStyleOverride(segment.styleOverride) }),
      }
    case 'arc':
      return {
        kind: 'arc',
        start: cloneVec3(segment.end),
        end: cloneVec3(segment.start),
        center: cloneVec3(segment.center),
        radius: cloneArcScalarInputValue(segment.radius),
        startAngleDeg: cloneArcScalarInputValue(segment.endAngleDeg),
        endAngleDeg: cloneArcScalarInputValue(segment.startAngleDeg),
        direction: reverseArcDirection(segment.direction),
        ...(segment.frame === undefined
          ? {}
          : { frame: cloneWorkPlaneFrameSnapshot(segment.frame) }),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: clonePathSegmentStyleOverride(segment.styleOverride) }),
      }
  }
}

export function canReverseCurvePathDirection(
  curve: CurveStratum,
): curve is ReversibleCurveStratum {
  return (
    curve.kind === 'polyline' ||
    curve.kind === 'cubicBezier' ||
    curve.kind === 'concatenatedPath'
  )
}

export function reverseCurvePathDirection(
  curve: CurveStratum,
): CurveStratum | null {
  switch (curve.kind) {
    case 'polyline':
      return {
        ...curve,
        points: [...curve.points].reverse().map(cloneVec3),
        styleSegments: reverseCurveStyleSegments(curve.styleSegments),
      }
    case 'cubicBezier':
      if (curve.points.length !== 4) {
        return null
      }

      return {
        ...curve,
        points: [
          cloneVec3(curve.points[3]),
          cloneVec3(curve.points[2]),
          cloneVec3(curve.points[1]),
          cloneVec3(curve.points[0]),
        ],
        ...(curve.bezierControls === undefined
          ? {}
          : { bezierControls: { kind: 'absolute' } as CubicBezierControlMode }),
        styleSegments: reverseCurveStyleSegments(curve.styleSegments),
      }
    case 'concatenatedPath':
      return {
        ...curve,
        segments: [...curve.segments].reverse().map(reversePathSegment),
        styleSegments: reverseCurveStyleSegments(curve.styleSegments),
      }
    case 'templatePath':
    case 'grid':
      return null
  }
}

export function pathEndpoints(
  segments: readonly PathSegment[],
): PathEndpointPair | null {
  if (segments.length === 0) {
    return null
  }

  return {
    start: cloneVec3(pathSegmentStart(segments[0])),
    end: cloneVec3(pathSegmentEnd(segments[segments.length - 1])),
  }
}

export function areSegmentsComposable(
  segments: readonly PathSegment[],
  epsilon = pathEndpointEpsilon,
): boolean {
  for (let index = 1; index < segments.length; index += 1) {
    if (
      !vec3ApproximatelyEqual(
        pathSegmentEnd(segments[index - 1]),
        pathSegmentStart(segments[index]),
        epsilon,
      )
    ) {
      return false
    }
  }

  return true
}

export function normalizePathForAmbientDimension(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
): ConcatenatedPathStratum {
  return {
    ...path,
    codim: ambientDimension === 2 ? 1 : 2,
    segments: normalizePathSegmentsForAmbientDimension(
      path.segments,
      ambientDimension,
    ),
  }
}

export function normalizePathSegmentsForAmbientDimension(
  segments: readonly PathSegment[],
  ambientDimension: AmbientDimension,
): PathSegment[] {
  return segments.map((segment) => normalizePathSegment(segment, ambientDimension))
}

export function pathSegmentStart(segment: PathSegment): Vec3 {
  return segment.start
}

export function pathSegmentEnd(segment: PathSegment): Vec3 {
  return segment.end
}

export function pathSegmentPointAt(
  segment: PathSegment,
  parameter: number,
  ambientDimension: AmbientDimension,
): Vec3 | null {
  const t = normalizedUnitParameter(parameter)

  if (t === null) {
    return null
  }

  let point: Vec3 | null

  switch (segment.kind) {
    case 'line':
      point = lerpVec3(segment.start, segment.end, t)
      break
    case 'cubicBezier':
      point = cubicBezierPointAt(segment, t)
      break
    case 'arc': {
      const sweepDegrees = arcSweepDegrees(segment)
      const startAngleDeg = arcScalarPreviewValue(segment.startAngleDeg)

      point =
        sweepDegrees === null || !Number.isFinite(startAngleDeg)
          ? null
          : arcPointAtAngle(
              segment,
              startAngleDeg + sweepDegrees * t,
              ambientDimension,
            )
      break
    }
  }

  return point !== null && isFiniteVec3(point) ? point : null
}

export function pathPointAt(
  segments: readonly PathSegment[],
  parameter: number,
  ambientDimension: AmbientDimension,
): Vec3 | null {
  const t = normalizedUnitParameter(parameter)

  if (t === null || segments.length === 0) {
    return null
  }

  if (t === 1) {
    return pathSegmentPointAt(
      segments[segments.length - 1],
      1,
      ambientDimension,
    )
  }

  const scaledParameter = t * segments.length
  const segmentIndex = Math.floor(scaledParameter)
  const localParameter = scaledParameter - segmentIndex

  return pathSegmentPointAt(
    segments[segmentIndex],
    localParameter,
    ambientDimension,
  )
}

export function pathSegmentCoordinates(segment: PathSegment): Vec3[] {
  switch (segment.kind) {
    case 'line':
      return [segment.start, segment.end]
    case 'cubicBezier':
      return [segment.start, segment.control1, segment.control2, segment.end]
    case 'arc':
      return [segment.start, segment.center, segment.end]
  }
}

export function pathCoordinates(segments: readonly PathSegment[]): Vec3[] {
  return segments.flatMap(pathSegmentCoordinates)
}

export function resolvePathSegmentStyle(
  pathStyle: CurveStyle,
  segment: PathSegment,
): CurveStyle {
  return resolveCurveStyle(pathStyle, segment.styleOverride)
}

export function pathSegmentStyleRuns(
  segments: readonly PathSegment[],
  pathStyle: CurveStyle,
): PathSegmentStyleRun[] {
  const runs: PathSegmentStyleRun[] = []

  segments.forEach((segment, index) => {
    const style = resolvePathSegmentStyle(pathStyle, segment)
    const currentRun = runs[runs.length - 1]

    if (currentRun !== undefined && curveStylesEqual(currentRun.style, style)) {
      currentRun.segments.push(segment)
      return
    }

    runs.push({
      startIndex: index,
      segments: [segment],
      style,
    })
  })

  return runs
}

export function normalizeTemplatePathForAmbientDimension(
  template: PathTemplate,
  ambientDimension: AmbientDimension,
): PathTemplate {
  switch (template.kind) {
    case 'circleTemplate':
      return {
        kind: 'circleTemplate',
        center: normalizePointForAmbientDimension(ambientDimension, template.center),
        radius: template.radius,
        ...(template.frame === undefined
          ? {}
          : {
              frame: normalizeFrameForAmbientDimension(
                template.frame,
                ambientDimension,
              ),
            }),
      }
    case 'ellipseTemplate':
      return {
        kind: 'ellipseTemplate',
        center: normalizePointForAmbientDimension(ambientDimension, template.center),
        radiusX: template.radiusX,
        radiusY: template.radiusY,
        ...(template.rotationDeg === undefined
          ? {}
          : { rotationDeg: template.rotationDeg }),
        ...(template.frame === undefined
          ? {}
          : {
              frame: normalizeFrameForAmbientDimension(
                template.frame,
                ambientDimension,
              ),
            }),
      }
  }
}

export function templatePathCoordinates(template: PathTemplate): Vec3[] {
  return [template.center]
}

export function templatePathFrame(template: PathTemplate): WorkPlaneFrameSnapshot {
  return template.frame === undefined
    ? xyTemplateFrame(template.center)
    : cloneWorkPlaneFrameSnapshot(template.frame)
}

export function circleTemplateRadiusHandlePoint(
  template: CircleTemplatePath,
  ambientDimension: AmbientDimension,
): Vec3 {
  return pointFromFrameLocal(
    template.center,
    template.radius,
    0,
    0,
    templatePathFrame(template),
    ambientDimension,
  )
}

export function ellipseTemplateRadiusHandlePoints(
  template: EllipseTemplatePath,
  ambientDimension: AmbientDimension,
): { radiusX: Vec3; radiusY: Vec3 } {
  return {
    radiusX: pointFromFrameLocal(
      template.center,
      template.radiusX,
      0,
      template.rotationDeg ?? 0,
      templatePathFrame(template),
      ambientDimension,
    ),
    radiusY: pointFromFrameLocal(
      template.center,
      0,
      template.radiusY,
      template.rotationDeg ?? 0,
      templatePathFrame(template),
      ambientDimension,
    ),
  }
}

export function updateCircleTemplateRadiusFromPoint(
  template: CircleTemplatePath,
  ambientDimension: AmbientDimension,
  point: Vec3,
): CircleTemplatePath {
  const local = localCoordinatesInFrame(
    template.center,
    point,
    templatePathFrame(template),
  )
  const radius = Math.hypot(local.x, local.y)

  if (!Number.isFinite(radius) || radius <= 0) {
    return template
  }

  return normalizeTemplatePathForAmbientDimension(
    {
      ...template,
      radius,
    },
    ambientDimension,
  ) as CircleTemplatePath
}

export function updateEllipseTemplateRadiusFromPoint(
  template: EllipseTemplatePath,
  ambientDimension: AmbientDimension,
  axis: 'radiusX' | 'radiusY',
  point: Vec3,
): EllipseTemplatePath {
  const local = localCoordinatesInFrame(
    template.center,
    point,
    templatePathFrame(template),
  )
  const rotation = degreesToRadians(template.rotationDeg ?? 0)
  const unrotatedX = local.x * Math.cos(rotation) + local.y * Math.sin(rotation)
  const unrotatedY = -local.x * Math.sin(rotation) + local.y * Math.cos(rotation)
  const radius = Math.abs(axis === 'radiusX' ? unrotatedX : unrotatedY)

  if (!Number.isFinite(radius) || radius <= 0) {
    return template
  }

  return normalizeTemplatePathForAmbientDimension(
    {
      ...template,
      [axis]: radius,
    },
    ambientDimension,
  ) as EllipseTemplatePath
}

export function sampleTemplatePathPoints(
  template: PathTemplate,
  ambientDimension: AmbientDimension,
  sampleCount = 64,
  options: TemplatePathSamplingOptions = {},
): Vec3[] {
  const count = normalizeTemplatePathSampleCount(sampleCount, options.maxSamples)
  const points: Vec3[] = []

  for (let index = 0; index <= count; index += 1) {
    const angleDeg = (index / count) * fullTurnDegrees
    points.push(templatePointAtAngle(template, angleDeg, ambientDimension))
  }

  return points
}

function normalizeTemplatePathSampleCount(
  sampleCount: number,
  maxSamples: number | undefined,
): number {
  const finiteSampleCount =
    Number.isFinite(sampleCount) && sampleCount > 0
      ? Math.floor(sampleCount)
      : minTemplatePathSamples
  const minClampedCount = Math.max(minTemplatePathSamples, finiteSampleCount)
  const maxClampedCount =
    maxSamples !== undefined && Number.isFinite(maxSamples) && maxSamples > 0
      ? Math.min(
          MAX_TEMPLATE_PATH_SAMPLES,
          Math.max(minTemplatePathSamples, Math.floor(maxSamples)),
        )
      : MAX_TEMPLATE_PATH_SAMPLES

  return Math.min(minClampedCount, maxClampedCount)
}

export function arcSegmentExpectedStart(
  segment: ArcPathSegment,
  ambientDimension: AmbientDimension,
): Vec3 {
  return arcPointAtAngle(
    segment,
    arcScalarPreviewValue(segment.startAngleDeg),
    ambientDimension,
  )
}

export function arcSegmentExpectedEnd(
  segment: ArcPathSegment,
  ambientDimension: AmbientDimension,
): Vec3 {
  return arcPointAtAngle(
    segment,
    arcScalarPreviewValue(segment.endAngleDeg),
    ambientDimension,
  )
}

export function arcSegmentToCubicBezierSegments(
  segment: ArcPathSegment,
  ambientDimension: AmbientDimension,
): CubicBezierPathSegment[] | null {
  const radius = arcScalarPreviewValue(segment.radius)
  const startAngleDeg = arcScalarPreviewValue(segment.startAngleDeg)
  const endAngleDeg = arcScalarPreviewValue(segment.endAngleDeg)

  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(startAngleDeg) ||
    !Number.isFinite(endAngleDeg)
  ) {
    return null
  }

  const sweepDegrees = arcSweepDegrees(segment)

  if (sweepDegrees === null || sweepDegrees === 0) {
    return null
  }

  const segmentCount = Math.max(
    1,
    Math.ceil(Math.abs(sweepDegrees) / maxArcCubicSweepDegrees),
  )
  const sweepPerSegment = sweepDegrees / segmentCount
  const cubicSegments: CubicBezierPathSegment[] = []
  let start = normalizePointForAmbientDimension(ambientDimension, segment.start)

  for (let index = 0; index < segmentCount; index += 1) {
    const angle0 = startAngleDeg + sweepPerSegment * index
    const angle1 = angle0 + sweepPerSegment
    const cubic = circularArcCubicSegment(
      segment,
      angle0,
      angle1,
      start,
      ambientDimension,
    )

    if (cubic === null) {
      return null
    }

    cubicSegments.push(cubic)
    start = cubic.end
  }

  return cubicSegments
}

export function createArcPathSegmentFromAngles({
  center,
  radius,
  startAngleDeg,
  endAngleDeg,
  direction,
  frame,
  ambientDimension,
  styleOverride,
}: {
  center: Vec3
  radius: number
  startAngleDeg: number
  endAngleDeg: number
  direction: ArcDirection
  frame?: WorkPlaneFrameSnapshot
  ambientDimension: AmbientDimension
  styleOverride?: PathSegmentStyleOverride
}): ArcPathSegment | null {
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(startAngleDeg) ||
    !Number.isFinite(endAngleDeg) ||
    (direction !== 'counterclockwise' && direction !== 'clockwise')
  ) {
    return null
  }

  const arc: ArcPathSegment = {
    kind: 'arc',
    center: normalizePointForAmbientDimension(ambientDimension, center),
    radius,
    startAngleDeg,
    endAngleDeg,
    direction,
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 0 },
    ...(frame === undefined
      ? {}
      : { frame: normalizeFrameForAmbientDimension(frame, ambientDimension) }),
    ...(styleOverride === undefined ? {} : { styleOverride }),
  }
  arc.start = arcSegmentExpectedStart(arc, ambientDimension)
  arc.end = arcSegmentExpectedEnd(arc, ambientDimension)

  return arc
}

function normalizePathSegment(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
): PathSegment {
  const styleOverride = clonePathSegmentStyleOverride(segment.styleOverride)

  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        start: normalizePointForAmbientDimension(ambientDimension, segment.start),
        end: normalizePointForAmbientDimension(ambientDimension, segment.end),
        ...(styleOverride === undefined ? {} : { styleOverride }),
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        start: normalizePointForAmbientDimension(ambientDimension, segment.start),
        control1: normalizePointForAmbientDimension(
          ambientDimension,
          segment.control1,
        ),
        control2: normalizePointForAmbientDimension(
          ambientDimension,
          segment.control2,
        ),
        end: normalizePointForAmbientDimension(ambientDimension, segment.end),
        ...(segment.controlMode === undefined
          ? {}
          : { controlMode: cloneCubicBezierControlMode(segment.controlMode) }),
        ...(styleOverride === undefined ? {} : { styleOverride }),
      }
    case 'arc':
      return {
        kind: 'arc',
        start: normalizePointForAmbientDimension(ambientDimension, segment.start),
        end: normalizePointForAmbientDimension(ambientDimension, segment.end),
        center: normalizePointForAmbientDimension(
          ambientDimension,
          segment.center,
        ),
        radius: cloneArcScalarInputValue(segment.radius),
        startAngleDeg: cloneArcScalarInputValue(segment.startAngleDeg),
        endAngleDeg: cloneArcScalarInputValue(segment.endAngleDeg),
        direction: segment.direction,
        ...(segment.frame === undefined
          ? {}
          : {
              frame: normalizeFrameForAmbientDimension(
                segment.frame,
                ambientDimension,
              ),
            }),
        ...(styleOverride === undefined ? {} : { styleOverride }),
      }
  }
}

export function cloneVec3(point: Vec3): Vec3 {
  return point.symbolic === undefined
    ? { ...point }
    : { ...point, symbolic: structuredClone(point.symbolic) }
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

function normalizeFrameForAmbientDimension(
  frame: WorkPlaneFrameSnapshot,
  ambientDimension: AmbientDimension,
): WorkPlaneFrameSnapshot {
  return ambientDimension === 2
    ? xyTemplateFrame(normalizePointForAmbientDimension(ambientDimension, frame.origin))
    : cloneWorkPlaneFrameSnapshot(frame)
}

function xyTemplateFrame(origin: Vec3): WorkPlaneFrameSnapshot {
  return {
    origin: normalizePointForAmbientDimension(2, origin),
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function templatePointAtAngle(
  template: PathTemplate,
  angleDeg: number,
  ambientDimension: AmbientDimension,
): Vec3 {
  switch (template.kind) {
    case 'circleTemplate':
      return pointFromFrameLocal(
        template.center,
        template.radius * Math.cos(degreesToRadians(angleDeg)),
        template.radius * Math.sin(degreesToRadians(angleDeg)),
        0,
        templatePathFrame(template),
        ambientDimension,
      )
    case 'ellipseTemplate':
      return pointFromFrameLocal(
        template.center,
        template.radiusX * Math.cos(degreesToRadians(angleDeg)),
        template.radiusY * Math.sin(degreesToRadians(angleDeg)),
        template.rotationDeg ?? 0,
        templatePathFrame(template),
        ambientDimension,
      )
  }
}

function arcPointAtAngle(
  segment: ArcPathSegment,
  angleDeg: number,
  ambientDimension: AmbientDimension,
): Vec3 {
  const radius = arcScalarPreviewValue(segment.radius)

  return pointFromFrameLocal(
    segment.center,
    radius * Math.cos(degreesToRadians(angleDeg)),
    radius * Math.sin(degreesToRadians(angleDeg)),
    0,
    segment.frame ?? xyTemplateFrame(segment.center),
    ambientDimension,
  )
}

function cubicBezierPointAt(
  segment: CubicBezierPathSegment,
  parameter: number,
): Vec3 {
  const inverse = 1 - parameter
  const startScale = inverse * inverse * inverse
  const control1Scale = 3 * inverse * inverse * parameter
  const control2Scale = 3 * inverse * parameter * parameter
  const endScale = parameter * parameter * parameter

  return {
    x:
      segment.start.x * startScale +
      segment.control1.x * control1Scale +
      segment.control2.x * control2Scale +
      segment.end.x * endScale,
    y:
      segment.start.y * startScale +
      segment.control1.y * control1Scale +
      segment.control2.y * control2Scale +
      segment.end.y * endScale,
    z:
      segment.start.z * startScale +
      segment.control1.z * control1Scale +
      segment.control2.z * control2Scale +
      segment.end.z * endScale,
  }
}

function lerpVec3(start: Vec3, end: Vec3, parameter: number): Vec3 {
  return {
    x: start.x + (end.x - start.x) * parameter,
    y: start.y + (end.y - start.y) * parameter,
    z: start.z + (end.z - start.z) * parameter,
  }
}

function normalizedUnitParameter(parameter: number): number | null {
  if (
    typeof parameter !== 'number' ||
    !Number.isFinite(parameter) ||
    parameter < 0 ||
    parameter > 1
  ) {
    return null
  }

  return Object.is(parameter, -0) ? 0 : parameter
}

function circularArcCubicSegment(
  segment: ArcPathSegment,
  startAngleDeg: number,
  endAngleDeg: number,
  start: Vec3,
  ambientDimension: AmbientDimension,
): CubicBezierPathSegment | null {
  const radius = arcScalarPreviewValue(segment.radius)
  const startAngle = degreesToRadians(startAngleDeg)
  const endAngle = degreesToRadians(endAngleDeg)
  const sweep = endAngle - startAngle
  const controlScale = (4 / 3) * Math.tan(sweep / 4)
  const end = arcPointAtAngle(segment, endAngleDeg, ambientDimension)
  const frame = segment.frame ?? xyTemplateFrame(segment.center)
  const control1 = pointFromFrameLocal(
    segment.center,
    radius * (Math.cos(startAngle) - controlScale * Math.sin(startAngle)),
    radius * (Math.sin(startAngle) + controlScale * Math.cos(startAngle)),
    0,
    frame,
    ambientDimension,
  )
  const control2 = pointFromFrameLocal(
    segment.center,
    radius * (Math.cos(endAngle) + controlScale * Math.sin(endAngle)),
    radius * (Math.sin(endAngle) - controlScale * Math.cos(endAngle)),
    0,
    frame,
    ambientDimension,
  )

  if (
    !isFiniteVec3(start) ||
    !isFiniteVec3(control1) ||
    !isFiniteVec3(control2) ||
    !isFiniteVec3(end)
  ) {
    return null
  }

  return {
    kind: 'cubicBezier',
    start,
    control1,
    control2,
    end,
    ...(segment.styleOverride === undefined
      ? {}
      : { styleOverride: clonePathSegmentStyleOverride(segment.styleOverride) }),
  }
}

function arcSweepDegrees(segment: ArcPathSegment): number | null {
  if (
    segment.direction !== 'counterclockwise' &&
    segment.direction !== 'clockwise'
  ) {
    return null
  }

  const startAngleDeg = arcScalarPreviewValue(segment.startAngleDeg)
  const endAngleDeg = arcScalarPreviewValue(segment.endAngleDeg)

  if (!Number.isFinite(startAngleDeg) || !Number.isFinite(endAngleDeg)) {
    return null
  }

  const rawSweep =
    segment.direction === 'counterclockwise'
      ? endAngleDeg - startAngleDeg
      : startAngleDeg - endAngleDeg
  const normalizedSweep = positiveModulo(rawSweep, fullTurnDegrees)

  if (normalizedSweep === 0) {
    return null
  }

  return segment.direction === 'counterclockwise'
    ? normalizedSweep
    : -normalizedSweep
}

function pointFromFrameLocal(
  center: Vec3,
  localX: number,
  localY: number,
  rotationDeg: number,
  frame: WorkPlaneFrameSnapshot,
  ambientDimension: AmbientDimension,
): Vec3 {
  const rotation = degreesToRadians(rotationDeg)
  const rotatedX = localX * Math.cos(rotation) - localY * Math.sin(rotation)
  const rotatedY = localX * Math.sin(rotation) + localY * Math.cos(rotation)

  return normalizePointForAmbientDimension(
    ambientDimension,
    addVec3(center, addVec3(scaleVec3(frame.u, rotatedX), scaleVec3(frame.v, rotatedY))),
  )
}

function localCoordinatesInFrame(
  center: Vec3,
  point: Vec3,
  frame: WorkPlaneFrameSnapshot,
): { x: number; y: number } {
  const delta = subtractVec3(point, center)

  return {
    x: dotVec3(delta, frame.u),
    y: dotVec3(delta, frame.v),
  }
}

function addVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

function subtractVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  }
}

function scaleVec3(point: Vec3, scalar: number): Vec3 {
  return {
    x: point.x * scalar,
    y: point.y * scalar,
    z: point.z * scalar,
  }
}

function dotVec3(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function reverseCurveStyleSegments(
  segments: readonly CurveStyleSegment[],
): CurveStyleSegment[] {
  return [...segments].reverse().map((segment) => ({
    ...segment,
    from: 1 - segment.to,
    to: 1 - segment.from,
    style: { ...segment.style },
  }))
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function clonePathSegmentStyleOverride(
  styleOverride: PathSegmentStyleOverride | undefined,
): PathSegmentStyleOverride | undefined {
  return styleOverride === undefined ? undefined : { ...styleOverride }
}

export function arcScalarPreviewValue(value: ArcScalarInputValue): number {
  if (typeof value === 'number') {
    return value
  }

  if (value.kind === 'numeric') {
    return value.value
  }

  if (value.kind === 'symbolic') {
    return value.previewValue
  }

  return Number.NaN
}

export function hasSymbolicArcScalarInputValue(
  value: ArcScalarInputValue,
): boolean {
  return typeof value !== 'number' && value.kind === 'symbolic'
}

function cloneArcScalarInputValue(value: ArcScalarInputValue): ArcScalarInputValue {
  if (typeof value === 'number') {
    return value
  }

  return value.kind === 'numeric'
    ? {
        kind: 'numeric',
        value: value.value,
      }
    : {
        kind: 'symbolic',
        expression: value.expression,
        previewValue: value.previewValue,
      }
}

function reverseArcDirection(direction: ArcDirection): ArcDirection {
  return direction === 'counterclockwise' ? 'clockwise' : 'counterclockwise'
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
        frame: {
          origin: cloneVec3(controlMode.frame.origin),
          u: cloneVec3(controlMode.frame.u),
          v: cloneVec3(controlMode.frame.v),
          normal: cloneVec3(controlMode.frame.normal),
        },
        localStart: { ...controlMode.localStart },
        localEnd: { ...controlMode.localEnd },
        firstControlOffset: { ...controlMode.firstControlOffset },
        secondControlOffset: { ...controlMode.secondControlOffset },
        secondOffsetReference: controlMode.secondOffsetReference,
      }
    case 'workPlaneRelativePolar':
      return {
        kind: 'workPlaneRelativePolar',
        frame: {
          origin: cloneVec3(controlMode.frame.origin),
          u: cloneVec3(controlMode.frame.u),
          v: cloneVec3(controlMode.frame.v),
          normal: cloneVec3(controlMode.frame.normal),
        },
        localStart: { ...controlMode.localStart },
        localEnd: { ...controlMode.localEnd },
        firstControl: { ...controlMode.firstControl },
        secondControl: { ...controlMode.secondControl },
        secondOffsetReference: controlMode.secondOffsetReference,
      }
  }
}

function vec3ApproximatelyEqual(
  first: Vec3,
  second: Vec3,
  epsilon: number,
): boolean {
  return (
    Math.abs(first.x - second.x) <= epsilon &&
    Math.abs(first.y - second.y) <= epsilon &&
    Math.abs(first.z - second.z) <= epsilon
  )
}
