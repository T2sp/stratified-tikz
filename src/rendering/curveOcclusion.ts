import { projectVec3 } from '../geometry/projection.ts'
import { sampleCurvedSheetPrimitive } from '../geometry/curvedSheets.ts'
import { gridPreviewSegments } from '../model/grids.ts'
import {
  pathSegmentPointAt,
  resolvePathSegmentStyle,
  sampleTemplatePathPoints,
} from '../model/paths.ts'
import { sheetVertices } from '../model/sheets.ts'
import { curveStylesEqual } from '../model/styles.ts'
import {
  curveOcclusionEnabled,
  normalizeVisibilityMaxCurveSamples,
  normalizeVisibilityMaxSurfaceFacesForSorting,
  resolveVisibilityOptions,
} from '../model/visibility.ts'
import type {
  AmbientDimension,
  Camera,
  Camera3D,
  ClosedPathBoundary,
  CurveStratum,
  CurveStyle,
  Diagram,
  PathSegment,
  SheetStratum,
  Vec2,
  Vec3,
  VisibilityOptions,
  VisibilitySortMode,
} from '../model/types.ts'
import {
  compareProjectedSurfaceFaces,
} from './surfaceDepthSort.ts'
import {
  projectedDepth,
  projectedDepthStats,
  type ProjectedSurfaceFace,
} from './projectedPrimitives.ts'

export type CurveVisibility = 'visible' | 'hidden'
export type CurveOcclusionFallbackReason =
  | 'sampleCapExceeded'
  | 'surfaceFaceCapExceeded'

export type CurveOcclusionSegment = {
  curveId: string
  layer: number
  segmentIndex: number
  visibility: CurveVisibility
  start: Vec3
  end: Vec3
  projectedStart: Vec2
  projectedEnd: Vec2
  midpoint: Vec3
  projectedMidpoint: Vec2
  curveDepth: number
  style: CurveStyle
  occludingFace?: ProjectedSurfaceFace
}

export type CurveOcclusionResult = {
  curveId: string
  curve: CurveStratum
  segments: CurveOcclusionSegment[]
  sampledSegmentCount: number
  capped: boolean
  fallbackReason?: CurveOcclusionFallbackReason
}

export type CurveOcclusionOptions = {
  camera?: Camera
  visibility?: VisibilityOptions
  curveSegmentSamples?: number
  templatePathSamples?: number
  maxCurveSegmentsPerCurve?: number
  occludingSurfaceIds?: ReadonlySet<string>
  curveIds?: ReadonlySet<string>
}

type SurfaceFaceSample = {
  vertices3D: Vec3[]
  faceIndex: number
}

type StyledCurveSegmentSample = {
  start: Vec3
  end: Vec3
  style: CurveStyle
  mergeKey?: string
}

type MergeableCurveOcclusionSegment = CurveOcclusionSegment & {
  mergeKey?: string
}

type StyledCurveSegmentAccumulator = {
  segments: StyledCurveSegmentSample[]
  capped: boolean
  maxSegments: number
}

const defaultCurveSegmentSamples = 24
const defaultTemplatePathSamples = 64
export const defaultMaxCurveOcclusionSegmentsPerCurve = 512
export const maxCurveOcclusionSegmentSamples = 64
export const maxCurveOcclusionTemplatePathSamples = 128
const pointComparisonEpsilon = 1e-9

export function classifyCurveOcclusion(
  diagram: Diagram,
  options: CurveOcclusionOptions = {},
): CurveOcclusionResult[] {
  const visibility = resolveVisibilityOptions(diagram, options.visibility)
  const camera = resolveOcclusionCamera(diagram, options.camera)

  if (
    diagram.ambientDimension !== 3 ||
    camera.mode !== '3d' ||
    !curveOcclusionEnabled(visibility)
  ) {
    return []
  }

  const curveSegmentSamples = normalizedSampleCount(
    options.curveSegmentSamples,
    defaultCurveSegmentSamples,
    maxCurveOcclusionSegmentSamples,
  )
  const templatePathSamples = normalizedSampleCount(
    options.templatePathSamples,
    defaultTemplatePathSamples,
    maxCurveOcclusionTemplatePathSamples,
  )
  const maxCurveSegmentsPerCurve = normalizeVisibilityMaxCurveSamples(
    options.maxCurveSegmentsPerCurve ?? visibility.maxCurveSamples,
  )
  const faces = projectedSurfaceFacesForDiagram(
    diagram,
    camera,
    curveSegmentSamples,
    options.occludingSurfaceIds,
  ).sort((left, right) =>
    compareProjectedSurfaceFaces(left, right, visibility),
  )

  if (faces.length === 0) {
    return []
  }

  const maxSurfaceFacesForSorting =
    normalizeVisibilityMaxSurfaceFacesForSorting(
      visibility.maxSurfaceFacesForSorting,
    )

  if (faces.length > maxSurfaceFacesForSorting) {
    return diagram.strata.flatMap((stratum): CurveOcclusionResult[] => {
      if (
        stratum.geometricKind !== 'curve' ||
        stratum.codim !== 2 ||
        (options.curveIds !== undefined && !options.curveIds.has(stratum.id))
      ) {
        return []
      }

      return [
        {
          curveId: stratum.id,
          curve: stratum,
          segments: [],
          sampledSegmentCount: 0,
          capped: true,
          fallbackReason: 'surfaceFaceCapExceeded',
        },
      ]
    })
  }

  return diagram.strata.flatMap((stratum): CurveOcclusionResult[] => {
    if (
      stratum.geometricKind !== 'curve' ||
      stratum.codim !== 2 ||
      (options.curveIds !== undefined && !options.curveIds.has(stratum.id))
    ) {
      return []
    }

    const sampled = styledCurveSegmentsForStratum(
      stratum,
      diagram.ambientDimension,
      curveSegmentSamples,
      templatePathSamples,
      maxCurveSegmentsPerCurve,
    )

    if (sampled.capped) {
      return [
        {
          curveId: stratum.id,
          curve: stratum,
          segments: [],
          sampledSegmentCount: sampled.segments.length,
          capped: true,
          fallbackReason: 'sampleCapExceeded',
        },
      ]
    }

    const classifiedSegments = sampled.segments.flatMap(
      (segment, segmentIndex): MergeableCurveOcclusionSegment[] => {
        const classified = classifyCurveSegment(
          stratum,
          segment,
          segmentIndex,
          faces,
          camera,
          visibility,
        )

        return classified === null ? [] : [classified]
      },
    )
    const segments = mergeClassifiedCurveSegments(
      classifiedSegments,
      camera,
    )

    return [
      {
        curveId: stratum.id,
        curve: stratum,
        segments,
        sampledSegmentCount: sampled.segments.length,
        capped: sampled.capped,
      },
    ]
  })
}

export function projectedPointInPolygon(
  point: Vec2,
  polygon: readonly Vec2[],
  epsilon = pointComparisonEpsilon,
): boolean {
  if (polygon.length < 3) {
    return false
  }

  let inside = false

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const start = polygon[previousIndex]
    const end = polygon[index]

    if (pointOnSegment(point, start, end, epsilon)) {
      return true
    }

    const crossesHorizontalRay =
      start.y > point.y !== end.y > point.y &&
      point.x <
        ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) +
          start.x

    if (crossesHorizontalRay) {
      inside = !inside
    }
  }

  return inside
}

export function estimateProjectedFaceDepthAtPoint(
  face: ProjectedSurfaceFace,
  point: Vec2,
  camera: Camera3D,
  epsilon = pointComparisonEpsilon,
): number {
  if (face.projectedPolygon.length < 3 || face.vertices3D.length < 3) {
    return face.depth.avg
  }

  const firstProjected = face.projectedPolygon[0]
  const firstVertex = face.vertices3D[0]

  for (let index = 1; index < face.projectedPolygon.length - 1; index += 1) {
    const secondProjected = face.projectedPolygon[index]
    const thirdProjected = face.projectedPolygon[index + 1]
    const barycentric = barycentricCoordinates(
      point,
      firstProjected,
      secondProjected,
      thirdProjected,
      epsilon,
    )

    if (barycentric === null) {
      continue
    }

    return (
      barycentric.first * projectedDepth(camera, firstVertex) +
      barycentric.second * projectedDepth(camera, face.vertices3D[index]) +
      barycentric.third * projectedDepth(camera, face.vertices3D[index + 1])
    )
  }

  return face.depth.avg
}

function resolveOcclusionCamera(diagram: Diagram, camera: Camera | undefined): Camera {
  return (
    camera ??
    (diagram.camera.mode === '3d'
      ? diagram.camera
      : diagram.view?.camera3d ?? diagram.camera)
  )
}

function projectedSurfaceFacesForDiagram(
  diagram: Diagram,
  camera: Camera3D,
  curveSegmentSamples: number,
  occludingSurfaceIds: ReadonlySet<string> | undefined,
): ProjectedSurfaceFace[] {
  const faces: ProjectedSurfaceFace[] = []
  let nextOriginalIndex = 0

  for (const stratum of diagram.strata) {
    if (
      stratum.geometricKind !== 'sheet' ||
      stratum.codim !== 1 ||
      (occludingSurfaceIds !== undefined && !occludingSurfaceIds.has(stratum.id))
    ) {
      continue
    }

    for (const face of surfaceFacesForSheet(
      stratum,
      diagram.ambientDimension,
      curveSegmentSamples,
    )) {
      const projected = projectedSurfaceFace(
        camera,
        stratum,
        face,
        nextOriginalIndex,
      )

      if (projected !== null) {
        faces.push(projected)
        nextOriginalIndex += 1
      }
    }
  }

  return faces
}

function surfaceFacesForSheet(
  sheet: SheetStratum,
  ambientDimension: AmbientDimension,
  curveSegmentSamples: number,
): SurfaceFaceSample[] {
  switch (sheet.kind) {
    case 'quadSheet':
    case 'polygonSheet':
      return [
        {
          vertices3D: sheetVertices(sheet).map(cloneVec3),
          faceIndex: 0,
        },
      ]
    case 'workPlaneFilledSheet':
      return sheet.boundaries
        .map((boundary, index) => ({
          vertices3D: closedBoundaryPolygon(
            boundary,
            ambientDimension,
            curveSegmentSamples,
          ),
          faceIndex: index,
        }))
        .filter((face) => face.vertices3D.length >= 3)
    case 'curvedSheet': {
      const mesh = sampleCurvedSheetPrimitive(sheet.primitive)

      return mesh.faces.map((face, index) => ({
        vertices3D: face.map((vertexIndex) => cloneVec3(mesh.vertices[vertexIndex])),
        faceIndex: index,
      }))
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

function styledCurveSegmentsForStratum(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
  curveSegmentSamples: number,
  templatePathSamples: number,
  maxSegments: number,
): { segments: StyledCurveSegmentSample[]; capped: boolean } {
  const accumulator: StyledCurveSegmentAccumulator = {
    segments: [],
    capped: false,
    maxSegments,
  }

  switch (curve.kind) {
    case 'polyline':
      appendSubdividedPointPairSamples(
        accumulator,
        curve.points,
        curve.style,
        curveSegmentSamples,
        'polyline',
      )
      break
    case 'cubicBezier':
      if (curve.points.length !== 4) {
        break
      }

      appendPathSegmentSamples(
        accumulator,
        {
          kind: 'cubicBezier',
          start: curve.points[0],
          control1: curve.points[1],
          control2: curve.points[2],
          end: curve.points[3],
        },
        curve.style,
        ambientDimension,
        curveSegmentSamples,
      )
      break
    case 'concatenatedPath':
      curve.segments.forEach((segment, index) => {
        appendPathSegmentSamples(
          accumulator,
          segment,
          resolvePathSegmentStyle(curve.style, segment),
          ambientDimension,
          curveSegmentSamples,
          `path:${index}`,
        )
      })
      break
    case 'templatePath':
      appendPointPairSamples(
        accumulator,
        sampleTemplatePathPoints(
          curve.template,
          ambientDimension,
          templatePathSamples,
        ),
        curve.style,
      )
      break
    case 'grid': {
      const preview = gridPreviewSegments(curve, ambientDimension)

      if (preview.ok) {
        for (const segment of preview.segments) {
          appendStyledSegment(
            accumulator,
            segment.start,
            segment.end,
            curve.style,
          )
        }
      }
      break
    }
  }

  return {
    segments: accumulator.segments,
    capped: accumulator.capped,
  }
}

function appendPathSegmentSamples(
  accumulator: StyledCurveSegmentAccumulator,
  segment: PathSegment,
  style: CurveStyle,
  ambientDimension: AmbientDimension,
  sampleCount: number,
  mergeKey?: string,
): void {
  if (segment.kind === 'line') {
    appendSubdividedLineSamples(
      accumulator,
      segment.start,
      segment.end,
      style,
      sampleCount,
      mergeKey,
    )
    return
  }

  appendPointPairSamples(
    accumulator,
    pathSegmentPolyline(segment, ambientDimension, sampleCount),
    style,
  )
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

function appendSubdividedPointPairSamples(
  accumulator: StyledCurveSegmentAccumulator,
  points: readonly Vec3[],
  style: CurveStyle,
  sampleCount: number,
  mergeKeyPrefix: string,
): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    if (accumulator.capped) {
      return
    }

    appendSubdividedLineSamples(
      accumulator,
      points[index],
      points[index + 1],
      style,
      sampleCount,
      `${mergeKeyPrefix}:${index}`,
    )
  }
}

function appendSubdividedLineSamples(
  accumulator: StyledCurveSegmentAccumulator,
  start: Vec3,
  end: Vec3,
  style: CurveStyle,
  sampleCount: number,
  mergeKey: string | undefined,
): void {
  if (!isFiniteVec3(start) || !isFiniteVec3(end)) {
    return
  }

  if (vec3ApproximatelyEqual(start, end)) {
    return
  }

  let previous = cloneVec3(start)

  // Straight segments must be subdivided for midpoint occlusion to detect
  // partial hiding. Sampling is bounded by curveSegmentSamples and the
  // accumulator max segment cap; capped curves fall back to original rendering
  // rather than emitting a truncated sampled prefix.
  for (let index = 1; index <= sampleCount; index += 1) {
    if (accumulator.capped) {
      return
    }

    const next =
      index === sampleCount
        ? cloneVec3(end)
        : interpolateVec3(start, end, index / sampleCount)

    appendStyledSegment(accumulator, previous, next, style, mergeKey)

    if (
      accumulator.segments.length >= accumulator.maxSegments &&
      index < sampleCount
    ) {
      accumulator.capped = true
      return
    }

    previous = next
  }
}

function appendPointPairSamples(
  accumulator: StyledCurveSegmentAccumulator,
  points: readonly Vec3[],
  style: CurveStyle,
): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    if (accumulator.capped) {
      return
    }

    appendStyledSegment(accumulator, points[index], points[index + 1], style)
  }
}

function appendStyledSegment(
  accumulator: StyledCurveSegmentAccumulator,
  start: Vec3,
  end: Vec3,
  style: CurveStyle,
  mergeKey?: string,
): void {
  if (accumulator.segments.length >= accumulator.maxSegments) {
    accumulator.capped = true
    return
  }

  if (!isFiniteVec3(start) || !isFiniteVec3(end)) {
    return
  }

  accumulator.segments.push({
    start: cloneVec3(start),
    end: cloneVec3(end),
    style: cloneCurveStyle(style),
    ...(mergeKey === undefined ? {} : { mergeKey }),
  })
}

function classifyCurveSegment(
  curve: CurveStratum,
  segment: StyledCurveSegmentSample,
  segmentIndex: number,
  faces: readonly ProjectedSurfaceFace[],
  camera: Camera3D,
  visibility: VisibilityOptions,
): MergeableCurveOcclusionSegment | null {
  const midpoint = midpointVec3(segment.start, segment.end)
  const projectedStart = projectVec3(camera, segment.start)
  const projectedEnd = projectVec3(camera, segment.end)
  const projectedMidpoint = projectVec3(camera, midpoint)

  if (
    !isFiniteVec2(projectedStart) ||
    !isFiniteVec2(projectedEnd) ||
    !isFiniteVec2(projectedMidpoint)
  ) {
    return null
  }

  const curveDepth = projectedDepth(camera, midpoint)
  const occludingFace = faces.find((face) =>
    faceOccludesCurveSegmentMidpoint(
      face,
      curve.layer,
      projectedMidpoint,
      curveDepth,
      camera,
      visibility,
    ),
  )

  return {
    curveId: curve.id,
    layer: curve.layer,
    segmentIndex,
    visibility: occludingFace === undefined ? 'visible' : 'hidden',
    start: cloneVec3(segment.start),
    end: cloneVec3(segment.end),
    projectedStart: cloneVec2(projectedStart),
    projectedEnd: cloneVec2(projectedEnd),
    midpoint,
    projectedMidpoint: cloneVec2(projectedMidpoint),
    curveDepth,
    style: cloneCurveStyle(segment.style),
    ...(segment.mergeKey === undefined ? {} : { mergeKey: segment.mergeKey }),
    ...(occludingFace === undefined ? {} : { occludingFace }),
  }
}

function mergeClassifiedCurveSegments(
  segments: MergeableCurveOcclusionSegment[],
  camera: Camera3D,
): CurveOcclusionSegment[] {
  const mergedSegments: MergeableCurveOcclusionSegment[] = []

  for (const segment of segments) {
    const previous = mergedSegments[mergedSegments.length - 1]

    if (
      previous !== undefined &&
      canMergeClassifiedCurveSegments(previous, segment)
    ) {
      mergedSegments[mergedSegments.length - 1] = mergedCurveOcclusionSegment(
        previous,
        segment,
        camera,
      )
      continue
    }

    mergedSegments.push(segment)
  }

  return mergedSegments.map(stripMergeKey)
}

function canMergeClassifiedCurveSegments(
  first: MergeableCurveOcclusionSegment,
  second: MergeableCurveOcclusionSegment,
): boolean {
  // Collinear merge is only safe for same-direction monotonic extensions.
  // Backtracking paths such as A -> B -> A are valid geometry and must not
  // collapse into a zero-length A -> A run.
  return (
    first.mergeKey !== undefined &&
    second.mergeKey !== undefined &&
    first.mergeKey === second.mergeKey &&
    first.visibility === second.visibility &&
    curveStylesEqual(first.style, second.style) &&
    occludingFacesCompatible(first.occludingFace, second.occludingFace) &&
    sameDirectionMonotonicExtension(first, second)
  )
}

function occludingFacesCompatible(
  first: ProjectedSurfaceFace | undefined,
  second: ProjectedSurfaceFace | undefined,
): boolean {
  if (first === undefined || second === undefined) {
    return first === second
  }

  return (
    first.sourceId === second.sourceId &&
    first.faceIndex === second.faceIndex
  )
}

function sameDirectionMonotonicExtension(
  first: MergeableCurveOcclusionSegment,
  second: MergeableCurveOcclusionSegment,
): boolean {
  if (
    !isFiniteVec3(first.start) ||
    !isFiniteVec3(first.end) ||
    !isFiniteVec3(second.start) ||
    !isFiniteVec3(second.end) ||
    !vec3ApproximatelyEqual(first.end, second.start)
  ) {
    return false
  }

  const firstVector = subtractVec3(first.end, first.start)
  const secondVector = subtractVec3(second.end, second.start)
  const mergedVector = subtractVec3(second.end, first.start)
  const firstLength = vec3Length(firstVector)
  const secondLength = vec3Length(secondVector)
  const mergedLength = vec3Length(mergedVector)

  if (
    firstLength <= pointComparisonEpsilon ||
    secondLength <= pointComparisonEpsilon ||
    mergedLength <= pointComparisonEpsilon
  ) {
    return false
  }

  const lengthProduct = firstLength * secondLength
  const directionTolerance = pointComparisonEpsilon * Math.max(1, lengthProduct)

  if (dotVec3(firstVector, secondVector) <= directionTolerance) {
    return false
  }

  if (
    crossMagnitudeVec3(firstVector, secondVector) >
    pointComparisonEpsilon * Math.max(1, lengthProduct)
  ) {
    return false
  }

  const lengthTolerance =
    pointComparisonEpsilon *
    Math.max(1, firstLength, secondLength, mergedLength)

  return (
    mergedLength + lengthTolerance >= firstLength &&
    mergedLength + lengthTolerance >= secondLength
  )
}

function mergedCurveOcclusionSegment(
  first: MergeableCurveOcclusionSegment,
  second: MergeableCurveOcclusionSegment,
  camera: Camera3D,
): MergeableCurveOcclusionSegment {
  const midpoint = midpointVec3(first.start, second.end)
  const projectedMidpoint = projectVec3(camera, midpoint)

  return {
    ...first,
    end: cloneVec3(second.end),
    projectedEnd: cloneVec2(second.projectedEnd),
    midpoint,
    projectedMidpoint: cloneVec2(projectedMidpoint),
    curveDepth: projectedDepth(camera, midpoint),
    ...(first.occludingFace === undefined
      ? {}
      : { occludingFace: first.occludingFace }),
  }
}

function stripMergeKey(segment: MergeableCurveOcclusionSegment): CurveOcclusionSegment {
  return {
    curveId: segment.curveId,
    layer: segment.layer,
    segmentIndex: segment.segmentIndex,
    visibility: segment.visibility,
    start: cloneVec3(segment.start),
    end: cloneVec3(segment.end),
    projectedStart: cloneVec2(segment.projectedStart),
    projectedEnd: cloneVec2(segment.projectedEnd),
    midpoint: cloneVec3(segment.midpoint),
    projectedMidpoint: cloneVec2(segment.projectedMidpoint),
    curveDepth: segment.curveDepth,
    style: cloneCurveStyle(segment.style),
    ...(segment.occludingFace === undefined
      ? {}
      : { occludingFace: segment.occludingFace }),
  }
}

function faceOccludesCurveSegmentMidpoint(
  face: ProjectedSurfaceFace,
  curveLayer: number,
  projectedMidpoint: Vec2,
  curveDepth: number,
  camera: Camera3D,
  visibility: VisibilityOptions,
): boolean {
  if (
    !surfaceLayerCanOccludeTarget(
      face.layer,
      curveLayer,
      visibility.sortMode,
    ) ||
    !projectedPointInPolygon(projectedMidpoint, face.projectedPolygon)
  ) {
    return false
  }

  const faceDepth = estimateProjectedFaceDepthAtPoint(
    face,
    projectedMidpoint,
    camera,
  )

  return curveDepth - faceDepth > visibility.depthEpsilon
}

export function surfaceLayerCanOccludeTarget(
  surfaceLayer: number,
  targetLayer: number,
  sortMode: VisibilitySortMode,
): boolean {
  if (sortMode === 'depthThenLayer') {
    return true
  }

  return normalizeLayer(surfaceLayer) >= normalizeLayer(targetLayer)
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

function barycentricCoordinates(
  point: Vec2,
  first: Vec2,
  second: Vec2,
  third: Vec2,
  epsilon: number,
): { first: number; second: number; third: number } | null {
  const denominator =
    (second.y - third.y) * (first.x - third.x) +
    (third.x - second.x) * (first.y - third.y)

  if (!Number.isFinite(denominator) || Math.abs(denominator) <= epsilon) {
    return null
  }

  const firstWeight =
    ((second.y - third.y) * (point.x - third.x) +
      (third.x - second.x) * (point.y - third.y)) /
    denominator
  const secondWeight =
    ((third.y - first.y) * (point.x - third.x) +
      (first.x - third.x) * (point.y - third.y)) /
    denominator
  const thirdWeight = 1 - firstWeight - secondWeight

  if (
    firstWeight < -epsilon ||
    secondWeight < -epsilon ||
    thirdWeight < -epsilon ||
    firstWeight > 1 + epsilon ||
    secondWeight > 1 + epsilon ||
    thirdWeight > 1 + epsilon
  ) {
    return null
  }

  return {
    first: firstWeight,
    second: secondWeight,
    third: thirdWeight,
  }
}

function pointOnSegment(
  point: Vec2,
  start: Vec2,
  end: Vec2,
  epsilon: number,
): boolean {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y)

  if (Math.abs(cross) > epsilon) {
    return false
  }

  const dot =
    (point.x - start.x) * (end.x - start.x) +
    (point.y - start.y) * (end.y - start.y)

  if (dot < -epsilon) {
    return false
  }

  const squaredLength =
    (end.x - start.x) * (end.x - start.x) +
    (end.y - start.y) * (end.y - start.y)

  return dot <= squaredLength + epsilon
}

function normalizedSampleCount(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(maximum, Math.max(1, Math.floor(value)))
}

function midpointVec3(start: Vec3, end: Vec3): Vec3 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    z: (start.z + end.z) / 2,
  }
}

function interpolateVec3(start: Vec3, end: Vec3, parameter: number): Vec3 {
  return {
    x: start.x + (end.x - start.x) * parameter,
    y: start.y + (end.y - start.y) * parameter,
    z: start.z + (end.z - start.z) * parameter,
  }
}

function normalizeLayer(layer: number): number {
  if (!Number.isFinite(layer)) {
    return 0
  }

  return Object.is(layer, -0) ? 0 : layer
}

function vec3ApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  return (
    Math.abs(first.x - second.x) <= pointComparisonEpsilon &&
    Math.abs(first.y - second.y) <= pointComparisonEpsilon &&
    Math.abs(first.z - second.z) <= pointComparisonEpsilon
  )
}

function subtractVec3(end: Vec3, start: Vec3): Vec3 {
  return {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z,
  }
}

function dotVec3(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function crossMagnitudeVec3(first: Vec3, second: Vec3): number {
  const cross = {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  }

  return vec3Length(cross)
}

function vec3Length(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function cloneCurveStyle(style: CurveStyle): CurveStyle {
  return { ...style }
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
