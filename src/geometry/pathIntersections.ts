import {
  pathSegmentPointAt,
  sampleTemplatePathPoints,
} from '../model/paths.ts'
import type {
  AmbientDimension,
  CurveStratum,
  Diagram,
  PathIntersectionCandidate,
  PathSegment,
  Vec2,
  Vec3,
} from '../model/types.ts'

export type PathIntersectionDetectionOptions = {
  cubicSamples?: number
  arcSamples?: number
  templateSamples?: number
  epsilon?: number
  endpointEpsilon?: number
  mergeDistanceEpsilon?: number
  maxPaths?: number
  maxSegmentsPerPath?: number
  maxPathPairs?: number
  maxCandidates?: number
  includeCurve?: (curve: CurveStratum) => boolean
}

export type NormalizedPathIntersectionDetectionOptions = {
  cubicSamples: number
  arcSamples: number
  templateSamples: number
  epsilon: number
  endpointEpsilon: number
  mergeDistanceEpsilon: number
  maxPaths: number
  maxSegmentsPerPath: number
  maxPathPairs: number
  maxCandidates: number
  includeCurve?: (curve: CurveStratum) => boolean
}

export type FlattenedPathSegment2D = {
  pathId: string
  segmentIndex: number
  start: Vec2
  end: Vec2
  startParameter: number
  endParameter: number
  tangent: Vec2
}

export type FlattenedCurvePath2D = {
  pathId: string
  closed: boolean
  segments: FlattenedPathSegment2D[]
  segmentsCapped?: boolean
}

export type PathIntersectionDetectionCapReason =
  | 'tooManyPaths'
  | 'tooManySegments'
  | 'tooManyPathPairs'
  | 'tooManyCandidates'

export type PathIntersectionDetectionStats = {
  inputPathCount: number
  consideredPathCount: number
  skippedPathCount: number
  pathPairCount: number
  skippedPathPairCount: number
  candidateCount: number
  ambiguousOverlapCount: number
  segmentCappedPathCount: number
  maxPaths: number
  maxSegmentsPerPath: number
  maxPathPairs: number
  maxCandidates: number
}

export type PathIntersectionDetectionStatus = {
  capped: boolean
  capReason?: PathIntersectionDetectionCapReason
  message: string
  stats: PathIntersectionDetectionStats
}

export type PathIntersectionDetectionResult = {
  candidates: PathIntersectionCandidate[]
  status: PathIntersectionDetectionStatus
}

type SegmentIntersection2D =
  | {
      kind: 'point'
      segmentAParameter: number
      segmentBParameter: number
      point: Vec2
    }
  | { kind: 'collinearOverlap' }

export const DEFAULT_INTERSECTION_CUBIC_SAMPLES = 32
export const DEFAULT_INTERSECTION_ARC_SAMPLES = 32
export const DEFAULT_INTERSECTION_TEMPLATE_SAMPLES = 96

// Intersection detection runs in SVG preview. Caller-provided sampling counts
// are capped so accidental external values cannot create unbounded preview work.
export const MAX_INTERSECTION_CUBIC_SAMPLES = 128
export const MAX_INTERSECTION_ARC_SAMPLES = 128
export const MAX_INTERSECTION_TEMPLATE_SAMPLES = 256

export const DEFAULT_MAX_INTERSECTION_PATHS = 48
export const DEFAULT_MAX_INTERSECTION_SEGMENTS_PER_PATH = 128
export const DEFAULT_MAX_INTERSECTION_PATH_PAIRS = 384
export const DEFAULT_MAX_INTERSECTION_CANDIDATES = 256

export const HARD_MAX_INTERSECTION_PATHS = 256
export const HARD_MAX_INTERSECTION_SEGMENTS_PER_PATH = 512
export const HARD_MAX_INTERSECTION_PATH_PAIRS = 2048
export const HARD_MAX_INTERSECTION_CANDIDATES = 1024

const defaultIntersectionEpsilon = 1e-9
const defaultEndpointEpsilon = 1e-7
const defaultMergeDistanceEpsilon = 1e-6
const idParameterPrecision = 6

export function pathIntersectionCandidatesForDiagram(
  diagram: Diagram,
  options: PathIntersectionDetectionOptions = {},
): PathIntersectionCandidate[] {
  return pathIntersectionDetectionForDiagram(diagram, options).candidates
}

export function pathIntersectionDetectionForDiagram(
  diagram: Diagram,
  options: PathIntersectionDetectionOptions = {},
): PathIntersectionDetectionResult {
  const resolvedOptions = normalizePathIntersectionOptions(options)

  if (diagram.ambientDimension !== 2) {
    return createPathIntersectionDetectionResult(
      [],
      {
        inputPathCount: 0,
        consideredPathCount: 0,
        skippedPathCount: 0,
        pathPairCount: 0,
        skippedPathPairCount: 0,
        candidateCount: 0,
        ambiguousOverlapCount: 0,
        segmentCappedPathCount: 0,
      },
      resolvedOptions,
    )
  }

  const pathCurves = diagram.strata
    .filter(
      (stratum): stratum is CurveStratum =>
        stratum.geometricKind === 'curve' && stratum.codim === 1,
    )
    .filter((curve) => resolvedOptions.includeCurve?.(curve) ?? true)
    .sort((first, second) => first.id.localeCompare(second.id))
  const skippedPathCount = Math.max(
    0,
    pathCurves.length - resolvedOptions.maxPaths,
  )
  const flattenedPaths = pathCurves
    .slice(0, resolvedOptions.maxPaths)
    .flatMap((curve) => {
      const path = flattenCurveFor2DIntersections(
        curve,
        diagram.ambientDimension,
        resolvedOptions,
      )

      return path === null || path.segments.length === 0 ? [] : [path]
    })
    .sort((first, second) => first.pathId.localeCompare(second.pathId))

  const candidates: PathIntersectionCandidate[] = []
  let pathPairCount = 0
  let skippedPathPairCount = 0
  let ambiguousOverlapCount = 0
  let capReason: PathIntersectionDetectionCapReason | undefined =
    skippedPathCount > 0 ? 'tooManyPaths' : undefined

  pathLoop: for (
    let firstIndex = 0;
    firstIndex < flattenedPaths.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < flattenedPaths.length;
      secondIndex += 1
    ) {
      const remainingPairs =
        totalPairCount(flattenedPaths.length) - pathPairCount

      if (pathPairCount >= resolvedOptions.maxPathPairs) {
        skippedPathPairCount = remainingPairs
        capReason = capReason ?? 'tooManyPathPairs'
        break pathLoop
      }

      pathPairCount += 1

      const pairResult = pathIntersectionsBetweenFlattenedPathsWithStats(
        flattenedPaths[firstIndex],
        flattenedPaths[secondIndex],
        resolvedOptions,
      )
      ambiguousOverlapCount += pairResult.ambiguousOverlapCount

      for (const candidate of pairResult.candidates) {
        mergeCandidate(candidates, candidate, resolvedOptions)

        if (candidates.length >= resolvedOptions.maxCandidates) {
          capReason = capReason ?? 'tooManyCandidates'
          break pathLoop
        }
      }
    }
  }

  const sortedCandidates = candidates.sort(comparePathIntersectionCandidates)

  return createPathIntersectionDetectionResult(
    sortedCandidates,
    {
      inputPathCount: pathCurves.length,
      consideredPathCount: Math.min(pathCurves.length, resolvedOptions.maxPaths),
      skippedPathCount,
      pathPairCount,
      skippedPathPairCount,
      candidateCount: sortedCandidates.length,
      ambiguousOverlapCount,
      segmentCappedPathCount: flattenedPaths.filter(
        (path) => path.segmentsCapped === true,
      ).length,
    },
    resolvedOptions,
    capReason,
  )
}

export function flattenCurveFor2DIntersections(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
  options: PathIntersectionDetectionOptions = {},
): FlattenedCurvePath2D | null {
  if (ambientDimension !== 2 || curve.codim !== 1 || curve.kind === 'grid') {
    return null
  }

  const resolvedOptions = normalizePathIntersectionOptions(options)

  switch (curve.kind) {
    case 'polyline':
      return flattenPointPath(curve.id, curve.points, false, resolvedOptions)
    case 'cubicBezier': {
      if (curve.points.length !== 4) {
        return null
      }

      return flattenPathSegments(
        curve.id,
        [
          {
            kind: 'cubicBezier',
            start: curve.points[0],
            control1: curve.points[1],
            control2: curve.points[2],
            end: curve.points[3],
          },
        ],
        resolvedOptions,
      )
    }
    case 'concatenatedPath':
      return flattenPathSegments(curve.id, curve.segments, resolvedOptions)
    case 'templatePath':
      return flattenPointPath(
        curve.id,
        sampleTemplatePathPoints(
          curve.template,
          ambientDimension,
          resolvedOptions.templateSamples,
          { maxSamples: MAX_INTERSECTION_TEMPLATE_SAMPLES },
        ),
        true,
        resolvedOptions,
      )
  }
}

export function pathIntersectionsBetweenFlattenedPaths(
  pathA: FlattenedCurvePath2D,
  pathB: FlattenedCurvePath2D,
  options: PathIntersectionDetectionOptions = {},
): PathIntersectionCandidate[] {
  const resolvedOptions = normalizePathIntersectionOptions(options)

  return pathIntersectionsBetweenFlattenedPathsWithStats(
    pathA,
    pathB,
    resolvedOptions,
  ).candidates.sort(comparePathIntersectionCandidates)
}

type PathIntersectionPairResult = {
  candidates: PathIntersectionCandidate[]
  ambiguousOverlapCount: number
}

function pathIntersectionsBetweenFlattenedPathsWithStats(
  pathA: FlattenedCurvePath2D,
  pathB: FlattenedCurvePath2D,
  options: NormalizedPathIntersectionDetectionOptions,
): PathIntersectionPairResult {
  const candidates: PathIntersectionCandidate[] = []
  let ambiguousOverlapCount = 0

  for (const segmentA of pathA.segments) {
    for (const segmentB of pathB.segments) {
      if (candidates.length >= options.maxCandidates) {
        return {
          candidates: candidates.sort(comparePathIntersectionCandidates),
          ambiguousOverlapCount,
        }
      }

      const intersection = segmentIntersection2D(
        segmentA.start,
        segmentA.end,
        segmentB.start,
        segmentB.end,
        options.epsilon,
      )

      if (intersection === null) {
        continue
      }

      if (intersection.kind === 'collinearOverlap') {
        ambiguousOverlapCount += 1
        continue
      }

      const rawParameterA = interpolateParameter(
        segmentA.startParameter,
        segmentA.endParameter,
        intersection.segmentAParameter,
      )
      const rawParameterB = interpolateParameter(
        segmentB.startParameter,
        segmentB.endParameter,
        intersection.segmentBParameter,
      )
      const parameterA = canonicalPathParameter(
        pathA,
        rawParameterA,
        options.endpointEpsilon,
      )
      const parameterB = canonicalPathParameter(
        pathB,
        rawParameterB,
        options.endpointEpsilon,
      )

      if (
        isOpenPathEndpointParameter(pathA, parameterA, options) ||
        isOpenPathEndpointParameter(pathB, parameterB, options)
      ) {
        continue
      }

      const tangentDeterminant = crossVec2(segmentA.tangent, segmentB.tangent)

      if (Math.abs(tangentDeterminant) <= options.epsilon) {
        continue
      }

      const candidate = createPathIntersectionCandidate({
        pathAId: pathA.pathId,
        pathBId: pathB.pathId,
        point: intersection.point,
        parameterA,
        parameterB,
        tangentA: segmentA.tangent,
        tangentB: segmentB.tangent,
        crossingSign: tangentDeterminant > 0 ? 'positive' : 'negative',
      })

      if (isFinitePathIntersectionCandidate(candidate)) {
        mergeCandidate(candidates, candidate, options)
      }
    }
  }

  return {
    candidates: candidates.sort(comparePathIntersectionCandidates),
    ambiguousOverlapCount,
  }
}

function flattenPointPath(
  pathId: string,
  points: readonly Vec3[],
  closed: boolean,
  options: NormalizedPathIntersectionDetectionOptions,
): FlattenedCurvePath2D | null {
  if (points.length < 2) {
    return null
  }

  const segmentCount = points.length - 1
  const maxSegmentCount = Math.min(
    segmentCount,
    options.maxSegmentsPerPath,
  )
  const segments: FlattenedPathSegment2D[] = []

  for (let index = 0; index < maxSegmentCount; index += 1) {
    segments.push(...flattenedSegmentFromPoints({
      pathId,
      segmentIndex: index,
      start: points[index],
      end: points[index + 1],
      startParameter: index / segmentCount,
      endParameter: (index + 1) / segmentCount,
      epsilon: options.epsilon,
    }))
  }

  return {
    pathId,
    closed: closed || isClosedPointPath(points, options.endpointEpsilon),
    segments,
    ...(segmentCount > maxSegmentCount ? { segmentsCapped: true } : {}),
  }
}

function flattenPathSegments(
  pathId: string,
  sourceSegments: readonly PathSegment[],
  options: NormalizedPathIntersectionDetectionOptions,
): FlattenedCurvePath2D | null {
  if (sourceSegments.length === 0) {
    return null
  }

  const segmentCount = sourceSegments.length
  const segments: FlattenedPathSegment2D[] = []

  for (const [segmentIndex, segment] of sourceSegments.entries()) {
    if (segments.length >= options.maxSegmentsPerPath) {
      break
    }

    const startParameter = segmentIndex / segmentCount
    const endParameter = (segmentIndex + 1) / segmentCount

    if (segment.kind === 'line') {
      segments.push(...flattenedSegmentFromPoints({
        pathId,
        segmentIndex,
        start: segment.start,
        end: segment.end,
        startParameter,
        endParameter,
        epsilon: options.epsilon,
      }))
      continue
    }

    segments.push(...flattenSampledPathSegment({
      pathId,
      segment,
      segmentIndex,
      startParameter,
      endParameter,
      sampleCount:
        segment.kind === 'arc' ? options.arcSamples : options.cubicSamples,
      maxSegments: options.maxSegmentsPerPath - segments.length,
      epsilon: options.epsilon,
    }))
  }

  return {
    pathId,
    closed: isClosedSegmentPath(sourceSegments, options.endpointEpsilon),
    segments,
    ...(sourceSegments.length > 0 &&
    (segments.length >= options.maxSegmentsPerPath ||
      estimatedFlattenedPathSegmentCount(sourceSegments, options) >
        options.maxSegmentsPerPath)
      ? { segmentsCapped: true }
      : {}),
  }
}

function flattenSampledPathSegment({
  pathId,
  segment,
  segmentIndex,
  startParameter,
  endParameter,
  sampleCount,
  maxSegments,
  epsilon,
}: {
  pathId: string
  segment: PathSegment
  segmentIndex: number
  startParameter: number
  endParameter: number
  sampleCount: number
  maxSegments: number
  epsilon: number
}): FlattenedPathSegment2D[] {
  if (maxSegments <= 0) {
    return []
  }

  const count = Math.min(maxSegments, Math.max(1, Math.floor(sampleCount)))
  const samples: Array<{ point: Vec3; parameter: number }> = []

  for (let index = 0; index <= count; index += 1) {
    const localParameter = index / count
    const point = pathSegmentPointAt(segment, localParameter, 2)

    if (point !== null) {
      samples.push({
        point,
        parameter: interpolateParameter(
          startParameter,
          endParameter,
          localParameter,
        ),
      })
    }
  }

  return samples.slice(0, -1).flatMap((sample, index) =>
    flattenedSegmentFromPoints({
      pathId,
      segmentIndex,
      start: sample.point,
      end: samples[index + 1].point,
      startParameter: sample.parameter,
      endParameter: samples[index + 1].parameter,
      epsilon,
    }),
  )
}

function estimatedFlattenedPathSegmentCount(
  sourceSegments: readonly PathSegment[],
  options: NormalizedPathIntersectionDetectionOptions,
): number {
  return sourceSegments.reduce((total, segment) => {
    if (segment.kind === 'line') {
      return total + 1
    }

    return total + (segment.kind === 'arc'
      ? options.arcSamples
      : options.cubicSamples)
  }, 0)
}

function flattenedSegmentFromPoints({
  pathId,
  segmentIndex,
  start,
  end,
  startParameter,
  endParameter,
  epsilon,
}: {
  pathId: string
  segmentIndex: number
  start: Vec3
  end: Vec3
  startParameter: number
  endParameter: number
  epsilon: number
}): FlattenedPathSegment2D[] {
  const start2 = vec3ToVec2(start)
  const end2 = vec3ToVec2(end)

  if (
    !isFiniteVec2(start2) ||
    !isFiniteVec2(end2) ||
    !Number.isFinite(startParameter) ||
    !Number.isFinite(endParameter)
  ) {
    return []
  }

  const tangent = normalizedDirection(start2, end2, epsilon)

  if (tangent === null) {
    return []
  }

  return [
    {
      pathId,
      segmentIndex,
      start: start2,
      end: end2,
      startParameter,
      endParameter,
      tangent,
    },
  ]
}

function segmentIntersection2D(
  startA: Vec2,
  endA: Vec2,
  startB: Vec2,
  endB: Vec2,
  epsilon: number,
): SegmentIntersection2D | null {
  const directionA = subtractVec2(endA, startA)
  const directionB = subtractVec2(endB, startB)
  const startDelta = subtractVec2(startB, startA)
  const denominator = crossVec2(directionA, directionB)

  if (Math.abs(denominator) <= epsilon) {
    return Math.abs(crossVec2(startDelta, directionA)) <= epsilon
      ? { kind: 'collinearOverlap' }
      : null
  }

  const segmentAParameter = crossVec2(startDelta, directionB) / denominator
  const segmentBParameter = crossVec2(startDelta, directionA) / denominator

  if (
    segmentAParameter < -epsilon ||
    segmentAParameter > 1 + epsilon ||
    segmentBParameter < -epsilon ||
    segmentBParameter > 1 + epsilon
  ) {
    return null
  }

  const clampedAParameter = clampUnit(segmentAParameter)

  return {
    kind: 'point',
    segmentAParameter: clampedAParameter,
    segmentBParameter: clampUnit(segmentBParameter),
    point: {
      x: startA.x + directionA.x * clampedAParameter,
      y: startA.y + directionA.y * clampedAParameter,
    },
  }
}

function createPathIntersectionCandidate({
  pathAId,
  pathBId,
  point,
  parameterA,
  parameterB,
  tangentA,
  tangentB,
  crossingSign,
}: {
  pathAId: string
  pathBId: string
  point: Vec2
  parameterA: number
  parameterB: number
  tangentA: Vec2
  tangentB: Vec2
  crossingSign: PathIntersectionCandidate['crossingSign']
}): PathIntersectionCandidate {
  return {
    id: pathIntersectionCandidateId(pathAId, pathBId, parameterA, parameterB),
    pathAId,
    pathBId,
    point: { x: point.x, y: point.y, z: 0 },
    parameterA,
    parameterB,
    tangentA,
    tangentB,
    crossingSign,
  }
}

function mergeCandidate(
  candidates: PathIntersectionCandidate[],
  candidate: PathIntersectionCandidate,
  options: NormalizedPathIntersectionDetectionOptions,
): void {
  const existingIndex = candidates.findIndex(
    (existing) =>
      existing.pathAId === candidate.pathAId &&
      existing.pathBId === candidate.pathBId &&
      distanceSquaredVec3(existing.point, candidate.point) <=
        options.mergeDistanceEpsilon * options.mergeDistanceEpsilon,
  )

  if (existingIndex === -1) {
    candidates.push(candidate)
    return
  }

  if (
    comparePathIntersectionCandidates(candidate, candidates[existingIndex]) < 0
  ) {
    candidates[existingIndex] = candidate
  }
}

function pathIntersectionCandidateId(
  pathAId: string,
  pathBId: string,
  parameterA: number,
  parameterB: number,
): string {
  return [
    'crossing',
    encodeURIComponent(pathAId),
    encodeURIComponent(pathBId),
    parameterIdPart(parameterA),
    parameterIdPart(parameterB),
  ].join(':')
}

function parameterIdPart(parameter: number): string {
  return clampUnit(parameter).toFixed(idParameterPrecision).replace('.', 'p')
}

function comparePathIntersectionCandidates(
  first: PathIntersectionCandidate,
  second: PathIntersectionCandidate,
): number {
  return (
    first.pathAId.localeCompare(second.pathAId) ||
    first.pathBId.localeCompare(second.pathBId) ||
    first.parameterA - second.parameterA ||
    first.parameterB - second.parameterB ||
    first.point.x - second.point.x ||
    first.point.y - second.point.y
  )
}

function isOpenPathEndpointParameter(
  path: FlattenedCurvePath2D,
  parameter: number,
  options: NormalizedPathIntersectionDetectionOptions,
): boolean {
  return (
    !path.closed &&
    (parameter <= options.endpointEpsilon ||
      parameter >= 1 - options.endpointEpsilon)
  )
}

function canonicalPathParameter(
  path: FlattenedCurvePath2D,
  parameter: number,
  endpointEpsilon: number,
): number {
  const clamped = clampUnit(parameter)

  return path.closed && clamped >= 1 - endpointEpsilon ? 0 : clamped
}

function interpolateParameter(
  startParameter: number,
  endParameter: number,
  localParameter: number,
): number {
  return startParameter + (endParameter - startParameter) * localParameter
}

function isClosedPointPath(
  points: readonly Vec3[],
  endpointEpsilon: number,
): boolean {
  return (
    points.length > 2 &&
    distanceSquaredVec2(vec3ToVec2(points[0]), vec3ToVec2(points[points.length - 1])) <=
      endpointEpsilon * endpointEpsilon
  )
}

function isClosedSegmentPath(
  segments: readonly PathSegment[],
  endpointEpsilon: number,
): boolean {
  if (segments.length === 0) {
    return false
  }

  return (
    distanceSquaredVec2(
      vec3ToVec2(segments[0].start),
      vec3ToVec2(segments[segments.length - 1].end),
    ) <= endpointEpsilon * endpointEpsilon
  )
}

function isFinitePathIntersectionCandidate(
  candidate: PathIntersectionCandidate,
): boolean {
  return (
    isFiniteVec3(candidate.point) &&
    isFiniteVec2(candidate.tangentA) &&
    isFiniteVec2(candidate.tangentB) &&
    Number.isFinite(candidate.parameterA) &&
    Number.isFinite(candidate.parameterB)
  )
}

function normalizedDirection(
  start: Vec2,
  end: Vec2,
  epsilon: number,
): Vec2 | null {
  const direction = subtractVec2(end, start)
  const length = Math.hypot(direction.x, direction.y)

  if (!Number.isFinite(length) || length <= epsilon) {
    return null
  }

  return {
    x: direction.x / length,
    y: direction.y / length,
  }
}

function vec3ToVec2(point: Vec3): Vec2 {
  return { x: point.x, y: point.y }
}

function subtractVec2(first: Vec2, second: Vec2): Vec2 {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
  }
}

function crossVec2(first: Vec2, second: Vec2): number {
  return first.x * second.y - first.y * second.x
}

function distanceSquaredVec2(first: Vec2, second: Vec2): number {
  const dx = first.x - second.x
  const dy = first.y - second.y

  return dx * dx + dy * dy
}

function distanceSquaredVec3(first: Vec3, second: Vec3): number {
  const dx = first.x - second.x
  const dy = first.y - second.y
  const dz = first.z - second.z

  return dx * dx + dy * dy + dz * dz
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

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Object.is(value, -0) ? 0 : value))
}

export function normalizePathIntersectionOptions(
  options: PathIntersectionDetectionOptions = {},
): NormalizedPathIntersectionDetectionOptions {
  return {
    cubicSamples: normalizeIntersectionSampleCount(
      options.cubicSamples,
      DEFAULT_INTERSECTION_CUBIC_SAMPLES,
      MAX_INTERSECTION_CUBIC_SAMPLES,
    ),
    arcSamples: normalizeIntersectionSampleCount(
      options.arcSamples,
      DEFAULT_INTERSECTION_ARC_SAMPLES,
      MAX_INTERSECTION_ARC_SAMPLES,
    ),
    templateSamples: normalizeIntersectionSampleCount(
      options.templateSamples,
      DEFAULT_INTERSECTION_TEMPLATE_SAMPLES,
      MAX_INTERSECTION_TEMPLATE_SAMPLES,
    ),
    epsilon: positiveNumberOrDefault(
      options.epsilon,
      defaultIntersectionEpsilon,
    ),
    endpointEpsilon: positiveNumberOrDefault(
      options.endpointEpsilon,
      defaultEndpointEpsilon,
    ),
    mergeDistanceEpsilon: positiveNumberOrDefault(
      options.mergeDistanceEpsilon,
      defaultMergeDistanceEpsilon,
    ),
    maxPaths: normalizeIntersectionLimit(
      options.maxPaths,
      DEFAULT_MAX_INTERSECTION_PATHS,
      HARD_MAX_INTERSECTION_PATHS,
    ),
    maxSegmentsPerPath: normalizeIntersectionLimit(
      options.maxSegmentsPerPath,
      DEFAULT_MAX_INTERSECTION_SEGMENTS_PER_PATH,
      HARD_MAX_INTERSECTION_SEGMENTS_PER_PATH,
    ),
    maxPathPairs: normalizeIntersectionLimit(
      options.maxPathPairs,
      DEFAULT_MAX_INTERSECTION_PATH_PAIRS,
      HARD_MAX_INTERSECTION_PATH_PAIRS,
    ),
    maxCandidates: normalizeIntersectionLimit(
      options.maxCandidates,
      DEFAULT_MAX_INTERSECTION_CANDIDATES,
      HARD_MAX_INTERSECTION_CANDIDATES,
    ),
    ...(options.includeCurve === undefined
      ? {}
      : { includeCurve: options.includeCurve }),
  }
}

function normalizeIntersectionSampleCount(
  value: number | undefined,
  fallback: number,
  maxValue: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.min(maxValue, Math.max(1, Math.floor(value)))
}

function positiveNumberOrDefault(
  value: number | undefined,
  fallback: number,
): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function totalPairCount(count: number): number {
  return count <= 1 ? 0 : (count * (count - 1)) / 2
}

function createPathIntersectionDetectionResult(
  candidates: PathIntersectionCandidate[],
  statsInput: Omit<
    PathIntersectionDetectionStats,
    | 'maxPaths'
    | 'maxSegmentsPerPath'
    | 'maxPathPairs'
    | 'maxCandidates'
  >,
  options: NormalizedPathIntersectionDetectionOptions,
  capReason?: PathIntersectionDetectionCapReason,
): PathIntersectionDetectionResult {
  const stats: PathIntersectionDetectionStats = {
    ...statsInput,
    maxPaths: options.maxPaths,
    maxSegmentsPerPath: options.maxSegmentsPerPath,
    maxPathPairs: options.maxPathPairs,
    maxCandidates: options.maxCandidates,
  }
  const resolvedCapReason =
    capReason ??
    (stats.segmentCappedPathCount > 0 ? 'tooManySegments' : undefined)

  return {
    candidates,
    status: {
      capped: resolvedCapReason !== undefined,
      ...(resolvedCapReason === undefined
        ? {}
        : { capReason: resolvedCapReason }),
      message: pathIntersectionDetectionStatusMessage(
        stats,
        resolvedCapReason,
      ),
      stats,
    },
  }
}

function pathIntersectionDetectionStatusMessage(
  stats: PathIntersectionDetectionStats,
  capReason: PathIntersectionDetectionCapReason | undefined,
): string {
  if (capReason !== undefined) {
    switch (capReason) {
      case 'tooManyPaths':
        return `Crossing detection considered ${stats.consideredPathCount} of ${stats.inputPathCount} paths.`
      case 'tooManySegments':
        return `Crossing detection capped sampled segments on ${stats.segmentCappedPathCount} path${stats.segmentCappedPathCount === 1 ? '' : 's'}.`
      case 'tooManyPathPairs':
        return `Crossing detection checked ${stats.pathPairCount} path pairs and skipped ${stats.skippedPathPairCount}.`
      case 'tooManyCandidates':
        return `Crossing detection stopped after ${stats.candidateCount} crossing candidates.`
    }
  }

  if (stats.ambiguousOverlapCount > 0) {
    return `Skipped ${stats.ambiguousOverlapCount} ambiguous overlapping path segment${stats.ambiguousOverlapCount === 1 ? '' : 's'}.`
  }

  return ''
}

function normalizeIntersectionLimit(
  value: number | undefined,
  fallback: number,
  hardMax: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.min(hardMax, Math.max(1, Math.floor(value)))
}
