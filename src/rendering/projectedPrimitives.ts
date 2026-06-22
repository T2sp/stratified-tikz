import {
  cameraBasisFromTikz3dplotAngles,
  projectVec3,
} from '../geometry/projection.ts'
import { sampleCurvedSheetPrimitive } from '../geometry/curvedSheets.ts'
import { gridPreviewSegments } from '../model/grids.ts'
import {
  pathSegmentPointAt,
  sampleTemplatePathPoints,
} from '../model/paths.ts'
import { sheetVertices } from '../model/sheets.ts'
import type {
  AmbientDimension,
  Camera,
  Camera3D,
  ClosedPathBoundary,
  CurveStratum,
  Diagram,
  PathSegment,
  PointStratum,
  SheetStratum,
  Vec2,
  Vec3,
} from '../model/types.ts'

export type DepthStats = {
  min: number
  max: number
  avg: number
}

export type ProjectedDepthConvention = 'smallerDepthIsCloser'

export const PROJECTED_DEPTH_CONVENTION: ProjectedDepthConvention =
  'smallerDepthIsCloser'

export type ProjectedSurfaceFace = {
  kind: 'surfaceFace'
  sourceId: string
  layer: number
  projectedPolygon: Vec2[]
  vertices3D: Vec3[]
  depth: DepthStats
  faceIndex: number
  originalIndex: number
}

export type ProjectedCurveSegment = {
  kind: 'curveSegment'
  sourceId: string
  layer: number
  projectedStart: Vec2
  projectedEnd: Vec2
  endpoints3D: [Vec3, Vec3]
  depth: DepthStats
  segmentIndex: number
  originalIndex: number
}

export type ProjectedPoint = {
  kind: 'point'
  sourceId: string
  layer: number
  projectedPosition: Vec2
  position3D: Vec3
  depth: DepthStats
  originalIndex: number
}

export type ProjectedRenderPrimitive =
  | ProjectedSurfaceFace
  | ProjectedCurveSegment
  | ProjectedPoint

export type ProjectedRenderPrimitiveOptions = {
  camera?: Camera
  curveSegmentSamples?: number
  templatePathSamples?: number
}

export type ProjectedSurfaceFaceCollectionOptions = {
  camera?: Camera
  curveSegmentSamples?: number
  maxSurfaceFacesForSorting: number
  sourceIds?: ReadonlySet<string>
}

export type ProjectedSurfaceFaceCollectionResult =
  | {
      kind: 'ok'
      faces: ProjectedSurfaceFace[]
      observedCount: number
    }
  | {
      kind: 'capExceeded'
      cap: number
      observedCount: number
    }

type SurfaceFaceSample = {
  vertices3D: Vec3[]
  faceIndex: number
}

type CurveSegmentSample = {
  start: Vec3
  end: Vec3
}

const defaultCurveSegmentSamples = 24
const defaultTemplatePathSamples = 64
const pointComparisonEpsilon = 1e-9

// Depth is measured along the orthographic camera's model-space forward vector.
// Smaller values are closer to the camera; larger values are farther into the
// view direction. Future sorting and occlusion code should use this convention.
export function projectedDepth(camera: Camera3D, point: Vec3): number {
  const forward = cameraViewDirection(camera)
  const depth =
    point.x * forward.x + point.y * forward.y + point.z * forward.z

  if (!Number.isFinite(depth)) {
    throw new Error('Projected depth must be finite.')
  }

  return depth
}

export function projectedDepthStats(
  camera: Camera3D,
  points: readonly Vec3[],
): DepthStats {
  if (points.length === 0) {
    throw new Error('Depth stats require at least one point.')
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let sum = 0

  for (const point of points) {
    const depth = projectedDepth(camera, point)

    min = Math.min(min, depth)
    max = Math.max(max, depth)
    sum += depth
  }

  const avg = sum / points.length

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(avg)) {
    throw new Error('Depth stats must be finite.')
  }

  return { min, max, avg }
}

export function extractProjectedRenderPrimitives(
  diagram: Diagram,
  options: ProjectedRenderPrimitiveOptions = {},
): ProjectedRenderPrimitive[] {
  const camera = resolvePrimitiveCamera(diagram, options.camera)

  if (camera.mode !== '3d') {
    return []
  }

  const curveSegmentSamples = normalizedSampleCount(
    options.curveSegmentSamples,
    defaultCurveSegmentSamples,
  )
  const templatePathSamples = normalizedSampleCount(
    options.templatePathSamples,
    defaultTemplatePathSamples,
  )
  const primitives: ProjectedRenderPrimitive[] = []
  let nextOriginalIndex = 0

  for (const stratum of diagram.strata) {
    if (stratum.geometricKind === 'sheet') {
      for (const face of surfaceFacesForSheet(
        stratum,
        diagram.ambientDimension,
        curveSegmentSamples,
      )) {
        const primitive = projectedSurfaceFace(
          camera,
          stratum,
          face,
          nextOriginalIndex,
        )

        if (primitive !== null) {
          primitives.push(primitive)
          nextOriginalIndex += 1
        }
      }
      continue
    }

    if (stratum.geometricKind === 'curve') {
      curveSegmentsForStratum(
        stratum,
        diagram.ambientDimension,
        curveSegmentSamples,
        templatePathSamples,
      ).forEach((segment, segmentIndex) => {
        const primitive = projectedCurveSegment(
          camera,
          stratum,
          segment,
          segmentIndex,
          nextOriginalIndex,
        )

        if (primitive !== null) {
          primitives.push(primitive)
          nextOriginalIndex += 1
        }
      })
      continue
    }

    if (stratum.geometricKind === 'point') {
      const primitive = projectedPoint(camera, stratum, nextOriginalIndex)

      if (primitive !== null) {
        primitives.push(primitive)
        nextOriginalIndex += 1
      }
    }
  }

  return primitives
}

export function collectProjectedSurfaceFacesForSorting(
  diagram: Diagram,
  options: ProjectedSurfaceFaceCollectionOptions,
): ProjectedSurfaceFaceCollectionResult {
  const camera = resolvePrimitiveCamera(diagram, options.camera)

  if (camera.mode !== '3d') {
    return {
      kind: 'ok',
      faces: [],
      observedCount: 0,
    }
  }

  const curveSegmentSamples = normalizedSampleCount(
    options.curveSegmentSamples,
    defaultCurveSegmentSamples,
  )
  const maxSurfaceFacesForSorting = normalizedCollectionCap(
    options.maxSurfaceFacesForSorting,
  )
  const faces: ProjectedSurfaceFace[] = []
  let nextOriginalIndex = 0

  for (const stratum of diagram.strata) {
    if (
      stratum.geometricKind !== 'sheet' ||
      (options.sourceIds !== undefined && !options.sourceIds.has(stratum.id))
    ) {
      continue
    }

    for (const face of surfaceFacesForSheet(
      stratum,
      diagram.ambientDimension,
      curveSegmentSamples,
    )) {
      const primitive = projectedSurfaceFace(
        camera,
        stratum,
        face,
        nextOriginalIndex,
      )

      if (primitive === null) {
        continue
      }

      faces.push(primitive)
      nextOriginalIndex += 1

      if (faces.length > maxSurfaceFacesForSorting) {
        return {
          kind: 'capExceeded',
          cap: maxSurfaceFacesForSorting,
          observedCount: faces.length,
        }
      }
    }
  }

  return {
    kind: 'ok',
    faces,
    observedCount: faces.length,
  }
}

function resolvePrimitiveCamera(diagram: Diagram, camera: Camera | undefined): Camera {
  return (
    camera ??
    (diagram.camera.mode === '3d'
      ? diagram.camera
      : diagram.view?.camera3d ?? diagram.camera)
  )
}

function cameraViewDirection(camera: Camera3D): Vec3 {
  if (camera.kind !== 'orthographic') {
    throw new Error(
      'Projected render primitives support only orthographic 3D cameras.',
    )
  }

  return cameraBasisFromTikz3dplotAngles(
    camera.thetaDeg,
    camera.phiDeg,
  ).forward
}

function* surfaceFacesForSheet(
  sheet: SheetStratum,
  ambientDimension: AmbientDimension,
  curveSegmentSamples: number,
): Generator<SurfaceFaceSample> {
  switch (sheet.kind) {
    case 'quadSheet':
    case 'polygonSheet':
      yield {
        vertices3D: sheetVertices(sheet).map(cloneVec3),
        faceIndex: 0,
      }
      return
    case 'workPlaneFilledSheet':
      for (let index = 0; index < sheet.boundaries.length; index += 1) {
        const boundary = sheet.boundaries[index]

        if (boundary === undefined) {
          continue
        }

        const vertices3D = closedBoundaryPolygon(
          boundary,
          ambientDimension,
          curveSegmentSamples,
        )

        if (vertices3D.length >= 3) {
          yield {
            vertices3D,
            faceIndex: index,
          }
        }
      }
      return
    case 'curvedSheet': {
      const mesh = sampleCurvedSheetPrimitive(sheet.primitive)

      for (let index = 0; index < mesh.faces.length; index += 1) {
        const face = mesh.faces[index]

        if (face === undefined) {
          continue
        }

        yield {
          vertices3D: face.map((vertexIndex) =>
            cloneVec3(mesh.vertices[vertexIndex]),
          ),
          faceIndex: index,
        }
      }
    }
  }
}

function projectedSurfaceFace(
  camera: Camera3D,
  sheet: SheetStratum,
  face: SurfaceFaceSample,
  originalIndex: number,
): ProjectedSurfaceFace | null {
  if (face.vertices3D.length < 3 || !face.vertices3D.every(isFiniteVec3)) {
    return null
  }

  const projectedPolygon = face.vertices3D.map((vertex) =>
    cloneVec2(projectVec3(camera, vertex)),
  )

  if (!projectedPolygon.every(isFiniteVec2)) {
    return null
  }

  return {
    kind: 'surfaceFace',
    sourceId: sheet.id,
    layer: sheet.layer,
    projectedPolygon,
    vertices3D: face.vertices3D.map(cloneVec3),
    depth: projectedDepthStats(camera, face.vertices3D),
    faceIndex: face.faceIndex,
    originalIndex,
  }
}

function curveSegmentsForStratum(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
  curveSegmentSamples: number,
  templatePathSamples: number,
): CurveSegmentSample[] {
  switch (curve.kind) {
    case 'polyline':
      return pointPairs(curve.points)
    case 'cubicBezier':
      return cubicBezierCurveSegments(
        curve.points,
        ambientDimension,
        curveSegmentSamples,
      )
    case 'concatenatedPath':
      return curve.segments.flatMap((segment) =>
        pathSegmentCurveSegments(segment, ambientDimension, curveSegmentSamples),
      )
    case 'templatePath':
      return pointPairs(
        sampleTemplatePathPoints(
          curve.template,
          ambientDimension,
          templatePathSamples,
        ),
      )
    case 'grid': {
      const preview = gridPreviewSegments(curve, ambientDimension)

      return preview.ok
        ? preview.segments.map((segment) => ({
            start: cloneVec3(segment.start),
            end: cloneVec3(segment.end),
          }))
        : []
    }
  }
}

function cubicBezierCurveSegments(
  points: readonly Vec3[],
  ambientDimension: AmbientDimension,
  sampleCount: number,
): CurveSegmentSample[] {
  if (points.length !== 4) {
    return []
  }

  return pathSegmentCurveSegments(
    {
      kind: 'cubicBezier',
      start: points[0],
      control1: points[1],
      control2: points[2],
      end: points[3],
    },
    ambientDimension,
    sampleCount,
  )
}

function pathSegmentCurveSegments(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
  sampleCount: number,
): CurveSegmentSample[] {
  return pointPairs(pathSegmentPolyline(segment, ambientDimension, sampleCount))
}

function projectedCurveSegment(
  camera: Camera3D,
  curve: CurveStratum,
  segment: CurveSegmentSample,
  segmentIndex: number,
  originalIndex: number,
): ProjectedCurveSegment | null {
  const start = cloneVec3(segment.start)
  const end = cloneVec3(segment.end)

  if (!isFiniteVec3(start) || !isFiniteVec3(end)) {
    return null
  }

  const projectedStart = cloneVec2(projectVec3(camera, start))
  const projectedEnd = cloneVec2(projectVec3(camera, end))

  if (!isFiniteVec2(projectedStart) || !isFiniteVec2(projectedEnd)) {
    return null
  }

  return {
    kind: 'curveSegment',
    sourceId: curve.id,
    layer: curve.layer,
    projectedStart,
    projectedEnd,
    endpoints3D: [start, end],
    depth: projectedDepthStats(camera, [start, end]),
    segmentIndex,
    originalIndex,
  }
}

function projectedPoint(
  camera: Camera3D,
  point: PointStratum,
  originalIndex: number,
): ProjectedPoint | null {
  const position = cloneVec3(point.position)

  if (!isFiniteVec3(position)) {
    return null
  }

  const projectedPosition = cloneVec2(projectVec3(camera, position))

  if (!isFiniteVec2(projectedPosition)) {
    return null
  }

  return {
    kind: 'point',
    sourceId: point.id,
    layer: point.layer,
    projectedPosition,
    position3D: position,
    depth: projectedDepthStats(camera, [position]),
    originalIndex,
  }
}

function closedBoundaryPolygon(
  boundary: ClosedPathBoundary,
  ambientDimension: AmbientDimension,
  sampleCount: number,
): Vec3[] {
  return removeDuplicateClosingPoint(
    pathSegmentsPolyline(boundary.segments, ambientDimension, sampleCount),
  )
}

function pathSegmentsPolyline(
  segments: readonly PathSegment[],
  ambientDimension: AmbientDimension,
  sampleCount: number,
): Vec3[] {
  const points: Vec3[] = []

  for (const segment of segments) {
    const segmentPoints = pathSegmentPolyline(
      segment,
      ambientDimension,
      sampleCount,
    )

    if (segmentPoints.length === 0) {
      return []
    }

    appendPolylinePoints(points, segmentPoints)
  }

  return points
}

function pathSegmentPolyline(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
  sampleCount: number,
): Vec3[] {
  if (segment.kind === 'line') {
    return [cloneVec3(segment.start), cloneVec3(segment.end)]
  }

  const points: Vec3[] = []

  for (let index = 0; index <= sampleCount; index += 1) {
    const point = pathSegmentPointAt(
      segment,
      index / sampleCount,
      ambientDimension,
    )

    if (point === null || !isFiniteVec3(point)) {
      return []
    }

    points.push(cloneVec3(point))
  }

  return points
}

function pointPairs(points: readonly Vec3[]): CurveSegmentSample[] {
  const segments: CurveSegmentSample[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({
      start: cloneVec3(points[index]),
      end: cloneVec3(points[index + 1]),
    })
  }

  return segments
}

function appendPolylinePoints(points: Vec3[], nextPoints: readonly Vec3[]): void {
  const firstPoint = nextPoints[0]

  if (
    points.length > 0 &&
    firstPoint !== undefined &&
    vec3ApproximatelyEqual(points[points.length - 1], firstPoint)
  ) {
    points.push(...nextPoints.slice(1).map(cloneVec3))
    return
  }

  points.push(...nextPoints.map(cloneVec3))
}

function removeDuplicateClosingPoint(points: Vec3[]): Vec3[] {
  if (
    points.length > 1 &&
    vec3ApproximatelyEqual(points[0], points[points.length - 1])
  ) {
    return points.slice(0, -1)
  }

  return points
}

function normalizedSampleCount(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.floor(value))
}

function normalizedCollectionCap(value: number): number {
  if (!Number.isFinite(value)) {
    return Number.POSITIVE_INFINITY
  }

  return Math.max(0, Math.floor(value))
}

function vec3ApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  return (
    Math.abs(first.x - second.x) <= pointComparisonEpsilon &&
    Math.abs(first.y - second.y) <= pointComparisonEpsilon &&
    Math.abs(first.z - second.z) <= pointComparisonEpsilon
  )
}

function cloneVec2(point: Vec2): Vec2 {
  return {
    x: point.x,
    y: point.y,
  }
}

function cloneVec3(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}
