import { pathIntersectionDetectionForDiagram } from '../geometry/pathIntersections.ts'
import {
  arcSegmentToCubicBezierSegments,
  pathSegmentEnd,
  pathSegmentStart,
  sampleTemplatePathPoints,
} from '../model/paths.ts'
import { sheetVertices } from '../model/sheets.ts'
import { coordinateAnchorPositionPreview } from '../model/coordinateAnchors.ts'
import { gridPreviewSegments } from '../model/grids.ts'
import type {
  ClosedPathBoundary,
  CurveStratum,
  Diagram,
  PathIntersectionCandidate,
  PathSegment,
  PointStratum,
  Stratum,
  TextLabel,
  Vec2,
  Vec3,
} from '../model/types.ts'
import {
  allLayersFilter,
  isLayerSelectableByLayerFilter,
  layerFilterIncludesLayer,
  type LayerFilter,
} from '../ui/layerFilter.ts'
import type { SingleSelectedElement } from '../ui/selection.ts'
import { curvedSheetToSvgMesh } from './curvedSheetMesh.ts'
import { projectToSvgPoint } from './svgProjection.ts'
import {
  shouldRenderStratumInSvgPreview,
  shouldRenderTextLabelInSvgPreview,
} from './svgPreviewPolicy.ts'
import { svgLabelAnchorPlacement } from './svgStyle.ts'

export type SvgPreviewHitTestTargetKind =
  | 'geometryHandle'
  | 'coordinateAnchor'
  | 'pathIntersectionCandidate'
  | 'label'
  | 'point'
  | 'pointOrLabel'
  | 'pathInlineNode'
  | 'curve'
  | 'sheetOrRegion'
  | 'background'

export type SvgPreviewHitTestCandidate = {
  kind: SvgPreviewHitTestTargetKind
  id?: string
  hit: boolean
}

export type SvgPreviewSelectionCandidateKind = Exclude<
  SvgPreviewHitTestTargetKind,
  'background' | 'pointOrLabel'
>

export type SvgPreviewSelectionCandidate = {
  kind: SvgPreviewSelectionCandidateKind
  id: string
  hit: true
  distance: number
  stableId: string
  description: string
  selection?: SingleSelectedElement
}

export type CollectSvgPreviewSelectionCandidatesOptions = {
  diagram: Diagram
  camera: Diagram['camera']
  viewportHeight: number
  point: Vec2
  layerFilter?: LayerFilter
  showCoordinateAnchors?: boolean
  pathIntersectionCandidates?: readonly PathIntersectionCandidate[]
  tolerance?: number
}

export type SvgPreviewSelectionCyclingState = {
  point: Vec2
  candidateKeys: string[]
  selectedIndex: number
}

export type SvgPreviewSelectionCycleResult = {
  state: SvgPreviewSelectionCyclingState | null
  candidate: SvgPreviewSelectionCandidate | null
  index: number
  count: number
  reset: boolean
}

const defaultHitTolerance = 8
const pointRadiusScale = 1.8
const labelHorizontalPadding = 6
const labelVerticalPadding = 4
const curveSampleCount = 24
const templatePathHitSamples = 96
const pathIntersectionCandidateHitRadius = 9

export const svgPreviewSelectionCycleResetDistance = 12

export const svgPreviewHitTestPriority: readonly SvgPreviewHitTestTargetKind[] = [
  'geometryHandle',
  'coordinateAnchor',
  'pathIntersectionCandidate',
  'label',
  'point',
  'pointOrLabel',
  'pathInlineNode',
  'curve',
  'sheetOrRegion',
  'background',
]

export function svgPreviewHitTestPriorityRank(
  kind: SvgPreviewHitTestTargetKind,
): number {
  const rank = svgPreviewHitTestPriority.indexOf(kind)

  return rank >= 0 ? rank : svgPreviewHitTestPriority.length
}

export function pickSvgPreviewHitTestCandidate(
  candidates: readonly SvgPreviewHitTestCandidate[],
): SvgPreviewHitTestCandidate {
  let best: { candidate: SvgPreviewHitTestCandidate; rank: number; index: number } =
    {
      candidate: { kind: 'background', hit: true },
      rank: svgPreviewHitTestPriorityRank('background'),
      index: -1,
    }

  candidates.forEach((candidate, index) => {
    if (!candidate.hit) {
      return
    }

    const rank = svgPreviewHitTestPriorityRank(candidate.kind)

    if (rank < best.rank || (rank === best.rank && index > best.index)) {
      best = { candidate, rank, index }
    }
  })

  return best.candidate
}

export function collectSvgPreviewSelectionCandidates({
  diagram,
  camera,
  viewportHeight,
  point,
  layerFilter = allLayersFilter,
  showCoordinateAnchors = true,
  pathIntersectionCandidates,
  tolerance = defaultHitTolerance,
}: CollectSvgPreviewSelectionCandidatesOptions): SvgPreviewSelectionCandidate[] {
  const candidates: SvgPreviewSelectionCandidate[] = [
    ...(showCoordinateAnchors
      ? collectCoordinateAnchorCandidates(diagram, camera, viewportHeight, point)
      : []),
    ...collectPathIntersectionCandidateHits(
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
      pathIntersectionCandidates,
    ),
    ...collectLabelCandidates(
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
      tolerance,
    ),
    ...collectStratumCandidates(
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
      tolerance,
    ),
  ]

  return candidates.sort(compareSvgPreviewSelectionCandidates)
}

export function compareSvgPreviewSelectionCandidates(
  left: SvgPreviewSelectionCandidate,
  right: SvgPreviewSelectionCandidate,
): number {
  return (
    compareNumbers(
      svgPreviewHitTestPriorityRank(left.kind),
      svgPreviewHitTestPriorityRank(right.kind),
    ) ||
    compareNumbers(left.distance, right.distance) ||
    left.stableId.localeCompare(right.stableId)
  )
}

export function nextSvgPreviewSelectionCycle(
  currentState: SvgPreviewSelectionCyclingState | null,
  point: Vec2,
  candidates: readonly SvgPreviewSelectionCandidate[],
  resetDistance = svgPreviewSelectionCycleResetDistance,
): SvgPreviewSelectionCycleResult {
  if (candidates.length === 0) {
    return {
      state: null,
      candidate: null,
      index: -1,
      count: 0,
      reset: true,
    }
  }

  const candidateKeys = candidates.map((candidate) => candidate.stableId)
  const canContinue =
    currentState !== null &&
    squaredDistance(currentState.point, point) <= resetDistance * resetDistance &&
    sameStringArray(currentState.candidateKeys, candidateKeys)
  const selectedIndex = canContinue
    ? (currentState.selectedIndex + 1) % candidates.length
    : initialCycleIndex(candidates.length)
  const state = {
    point: { ...point },
    candidateKeys,
    selectedIndex,
  }

  return {
    state,
    candidate: candidates[selectedIndex] ?? null,
    index: selectedIndex,
    count: candidates.length,
    reset: !canContinue,
  }
}

export function formatSvgPreviewSelectionCycleStatus(
  candidate: SvgPreviewSelectionCandidate,
  index: number,
  count: number,
): string {
  return `Selected ${index + 1}/${count}: ${candidate.description}`
}

function collectCoordinateAnchorCandidates(
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
): SvgPreviewSelectionCandidate[] {
  return (diagram.coordinateAnchors ?? []).flatMap((anchor) => {
    try {
      const modelPoint = coordinateAnchorPositionPreview(
        anchor.position,
        diagram.ambientDimension,
      )
      const center = projectToSvgPoint(camera, modelPoint, viewportHeight)

      if (!isFiniteVec2(center)) {
        return []
      }

      const distance = distanceVec2(center, point)

      if (distance > 11) {
        return []
      }

      return [
        {
          kind: 'coordinateAnchor',
          id: anchor.id,
          hit: true,
          distance,
          stableId: `coordinateAnchor:${anchor.id}`,
          description: `coordinate "${anchor.name}"`,
          selection: { kind: 'coordinate', id: anchor.id },
        },
      ]
    } catch {
      return []
    }
  })
}

function collectPathIntersectionCandidateHits(
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
  pathIntersectionCandidates: readonly PathIntersectionCandidate[] | undefined,
): SvgPreviewSelectionCandidate[] {
  const candidates =
    pathIntersectionCandidates ??
    pathIntersectionDetectionForDiagram(diagram, {
      includeCurve: (curve) =>
        shouldRenderStratumInSvgPreview(diagram, curve) &&
        layerFilterIncludesLayer(layerFilter, curve.layer),
    }).candidates

  if (diagram.ambientDimension !== 2) {
    return []
  }

  return candidates.flatMap((candidate) => {
    if (!pathIntersectionCandidateIsSelectable(diagram, candidate, layerFilter)) {
      return []
    }

    const center = projectToSvgPoint(camera, candidate.point, viewportHeight)

    if (!isFiniteVec2(center)) {
      return []
    }

    const distance = distanceVec2(center, point)

    if (distance > pathIntersectionCandidateHitRadius) {
      return []
    }

    return [
      {
        kind: 'pathIntersectionCandidate',
        id: candidate.id,
        hit: true,
        distance,
        stableId: `pathIntersectionCandidate:${candidate.id}`,
        description: `crossing "${candidate.pathAId} with ${candidate.pathBId}"`,
      },
    ]
  })
}

function collectLabelCandidates(
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
  tolerance: number,
): SvgPreviewSelectionCandidate[] {
  return diagram.labels.flatMap((label) => {
    if (
      !shouldRenderTextLabelInSvgPreview(diagram, label) ||
      !isLayerSelectableByLayerFilter(diagram, layerFilter, label.layer)
    ) {
      return []
    }

    const distance = labelHitDistance(label, camera, viewportHeight, point, tolerance)

    if (distance === null) {
      return []
    }

    return [
      {
        kind: 'label',
        id: label.id,
        hit: true,
        distance,
        stableId: `label:${label.id}`,
        description: `label "${label.name}"`,
        selection: { kind: 'label', id: label.id },
      },
    ]
  })
}

function collectStratumCandidates(
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
  tolerance: number,
): SvgPreviewSelectionCandidate[] {
  return diagram.strata.flatMap((stratum) => {
    if (
      !shouldRenderStratumInSvgPreview(diagram, stratum) ||
      !isLayerSelectableByLayerFilter(diagram, layerFilter, stratum.layer)
    ) {
      return []
    }

    switch (stratum.geometricKind) {
      case 'region':
        return collectSurfaceCandidate(
          stratum,
          surfacePolygonsForStratum(stratum, diagram, camera, viewportHeight),
          point,
          tolerance,
          'region',
        )
      case 'sheet':
        return collectSurfaceCandidate(
          stratum,
          surfacePolygonsForStratum(stratum, diagram, camera, viewportHeight),
          point,
          tolerance,
          'sheet',
        )
      case 'curve':
        return collectCurveCandidate(
          stratum,
          diagram,
          camera,
          viewportHeight,
          point,
          tolerance,
        )
      case 'point':
        return collectPointCandidate(stratum, camera, viewportHeight, point)
    }
  })
}

function collectSurfaceCandidate(
  stratum: Stratum,
  polygons: Vec2[][],
  point: Vec2,
  tolerance: number,
  label: 'region' | 'sheet',
): SvgPreviewSelectionCandidate[] {
  const finitePolygons = polygons.filter(
    (polygon) => polygon.length >= 3 && polygon.every(isFiniteVec2),
  )

  if (finitePolygons.length === 0) {
    return []
  }

  const inside = finitePolygons.some((polygon) => pointInPolygon(point, polygon))
  const distance = inside
    ? 0
    : Math.min(
        ...finitePolygons.map((polygon) =>
          distanceToClosedPolyline(point, polygon),
        ),
      )

  if (!inside && distance > tolerance) {
    return []
  }

  return [
    {
      kind: 'sheetOrRegion',
      id: stratum.id,
      hit: true,
      distance,
      stableId: `sheetOrRegion:${stratum.id}`,
      description: `${label} "${stratum.name}"`,
      selection: { kind: 'stratum', id: stratum.id },
    },
  ]
}

function collectCurveCandidate(
  curve: CurveStratum,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  tolerance: number,
): SvgPreviewSelectionCandidate[] {
  const projectedPolylines = projectedPolylinesForCurve(
    curve,
    diagram,
    camera,
    viewportHeight,
  )
  const hitTolerance = Math.max(tolerance, curve.style.lineWidth / 2 + tolerance)
  const distances = projectedPolylines
    .filter((polyline) => polyline.length >= 2 && polyline.every(isFiniteVec2))
    .map((polyline) => distanceToOpenPolyline(point, polyline))

  if (distances.length === 0) {
    return []
  }

  const distance = Math.min(...distances)

  if (distance > hitTolerance) {
    return []
  }

  return [
    {
      kind: 'curve',
      id: curve.id,
      hit: true,
      distance,
      stableId: `curve:${curve.id}`,
      description: `path "${curve.name}"`,
      selection: { kind: 'stratum', id: curve.id },
    },
  ]
}

function collectPointCandidate(
  pointStratum: PointStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
): SvgPreviewSelectionCandidate[] {
  const center = projectToSvgPoint(camera, pointStratum.position, viewportHeight)

  if (!isFiniteVec2(center)) {
    return []
  }

  const distance = distanceVec2(center, point)
  const hitRadius = Math.max(pointStratum.style.size * pointRadiusScale, 1) + 6

  if (distance > hitRadius) {
    return []
  }

  return [
    {
      kind: 'point',
      id: pointStratum.id,
      hit: true,
      distance,
      stableId: `point:${pointStratum.id}`,
      description: `point "${pointStratum.name}"`,
      selection: { kind: 'stratum', id: pointStratum.id },
    },
  ]
}

function surfacePolygonsForStratum(
  stratum: Stratum,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
): Vec2[][] {
  if (stratum.geometricKind === 'region') {
    return stratum.kind === 'filledRegion'
      ? stratum.boundaries.map((boundary) =>
          projectedBoundaryPolyline(boundary, diagram, camera, viewportHeight),
        )
      : []
  }

  if (stratum.geometricKind !== 'sheet') {
    return []
  }

  switch (stratum.kind) {
    case 'quadSheet':
    case 'polygonSheet':
      return [
        sheetVertices(stratum).map((vertex) =>
          projectToSvgPoint(camera, vertex, viewportHeight),
        ),
      ]
    case 'workPlaneFilledSheet':
      return stratum.boundaries.map((boundary) =>
        projectedBoundaryPolyline(boundary, diagram, camera, viewportHeight),
      )
    case 'curvedSheet':
      try {
        return curvedSheetToSvgMesh(stratum, camera, viewportHeight).faces.map(
          (face) => parseSvgPointList(face.points),
        )
      } catch {
        return []
      }
  }
}

function projectedPolylinesForCurve(
  curve: CurveStratum,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
): Vec2[][] {
  if (curve.kind === 'grid') {
    const preview = gridPreviewSegments(curve, diagram.ambientDimension)

    return preview.ok
      ? preview.segments.map((segment) => [
          projectToSvgPoint(camera, segment.start, viewportHeight),
          projectToSvgPoint(camera, segment.end, viewportHeight),
        ])
      : []
  }

  if (curve.kind === 'templatePath') {
    return [
      sampleTemplatePathPoints(
        curve.template,
        diagram.ambientDimension,
        templatePathHitSamples,
      ).map((sample) => projectToSvgPoint(camera, sample, viewportHeight)),
    ]
  }

  if (curve.kind === 'concatenatedPath') {
    return curve.segments.map((segment) =>
      samplePathSegment(segment, diagram.ambientDimension).map((sample) =>
        projectToSvgPoint(camera, sample, viewportHeight),
      ),
    )
  }

  if (curve.kind === 'cubicBezier') {
    return [
      sampleCubicBezierPoints(curve.points).map((sample) =>
        projectToSvgPoint(camera, sample, viewportHeight),
      ),
    ]
  }

  return [
    curve.points.map((curvePoint) =>
      projectToSvgPoint(camera, curvePoint, viewportHeight),
    ),
  ]
}

function projectedBoundaryPolyline(
  boundary: ClosedPathBoundary,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
): Vec2[] {
  const points = boundary.segments.flatMap((segment, index) => {
    const sampled = samplePathSegment(segment, diagram.ambientDimension)

    return index === 0 ? sampled : sampled.slice(1)
  })

  return points.map((sample) => projectToSvgPoint(camera, sample, viewportHeight))
}

function labelHitDistance(
  label: TextLabel,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  tolerance: number,
): number | null {
  const anchor = projectToSvgPoint(camera, label.position, viewportHeight)

  if (!isFiniteVec2(anchor)) {
    return null
  }

  const fontSize = label.style.fontSize * 1.35
  const placement = svgLabelAnchorPlacement(label.style.anchor, fontSize)
  const textCenter = {
    x: anchor.x + placement.dx,
    y: anchor.y + placement.dy,
  }
  const width = Math.max(label.text.length * fontSize * 0.58, fontSize * 0.75)
  const height = fontSize
  const horizontalRadius = width / 2 + labelHorizontalPadding
  const verticalRadius = height / 2 + labelVerticalPadding
  const dx = Math.max(Math.abs(point.x - textCenter.x) - horizontalRadius, 0)
  const dy = Math.max(Math.abs(point.y - textCenter.y) - verticalRadius, 0)
  const distance = Math.hypot(dx, dy)

  return distance <= tolerance ? distance : null
}

function samplePathSegment(
  segment: PathSegment,
  ambientDimension: Diagram['ambientDimension'],
): Vec3[] {
  switch (segment.kind) {
    case 'line':
      return [segment.start, segment.end]
    case 'cubicBezier':
      return sampleCubicBezierPoints([
        segment.start,
        segment.control1,
        segment.control2,
        segment.end,
      ])
    case 'arc': {
      const cubicSegments = arcSegmentToCubicBezierSegments(
        segment,
        ambientDimension,
      )

      if (cubicSegments === null) {
        return [pathSegmentStart(segment), pathSegmentEnd(segment)]
      }

      return cubicSegments.flatMap((cubicSegment, index) => {
        const samples = samplePathSegment(cubicSegment, ambientDimension)

        return index === 0 ? samples : samples.slice(1)
      })
    }
  }
}

function sampleCubicBezierPoints(points: readonly Vec3[]): Vec3[] {
  if (points.length < 4) {
    return points.map((point) => ({ ...point }))
  }

  const [p0, p1, p2, p3] = points

  if (
    p0 === undefined ||
    p1 === undefined ||
    p2 === undefined ||
    p3 === undefined
  ) {
    return []
  }

  return Array.from({ length: curveSampleCount + 1 }, (_, index) => {
    const t = index / curveSampleCount
    const omt = 1 - t
    const omt2 = omt * omt
    const t2 = t * t

    return {
      x:
        omt2 * omt * p0.x +
        3 * omt2 * t * p1.x +
        3 * omt * t2 * p2.x +
        t2 * t * p3.x,
      y:
        omt2 * omt * p0.y +
        3 * omt2 * t * p1.y +
        3 * omt * t2 * p2.y +
        t2 * t * p3.y,
      z:
        omt2 * omt * p0.z +
        3 * omt2 * t * p1.z +
        3 * omt * t2 * p2.z +
        t2 * t * p3.z,
    }
  })
}

function pathIntersectionCandidateIsSelectable(
  diagram: Diagram,
  candidate: PathIntersectionCandidate,
  layerFilter: LayerFilter,
): boolean {
  const pathA = diagram.strata.find(
    (stratum) => stratum.id === candidate.pathAId,
  )
  const pathB = diagram.strata.find(
    (stratum) => stratum.id === candidate.pathBId,
  )

  return (
    pathA !== undefined &&
    pathB !== undefined &&
    isLayerSelectableByLayerFilter(diagram, layerFilter, pathA.layer) &&
    isLayerSelectableByLayerFilter(diagram, layerFilter, pathB.layer)
  )
}

function distanceToOpenPolyline(point: Vec2, polyline: readonly Vec2[]): number {
  return Math.min(
    ...polyline.slice(1).map((end, index) => {
      const start = polyline[index]

      return start === undefined
        ? Number.POSITIVE_INFINITY
        : distanceToSegment(point, start, end)
    }),
  )
}

function distanceToClosedPolyline(point: Vec2, polyline: readonly Vec2[]): number {
  const openDistance = distanceToOpenPolyline(point, polyline)
  const first = polyline[0]
  const last = polyline[polyline.length - 1]

  if (first === undefined || last === undefined) {
    return openDistance
  }

  return Math.min(openDistance, distanceToSegment(point, last, first))
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return distanceVec2(point, start)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  )
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  }

  return distanceVec2(point, projection)
}

function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false

  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon[currentIndex]
    const previous = polygon[previousIndex]

    if (current === undefined || previous === undefined) {
      continue
    }

    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x

    if (crosses) {
      inside = !inside
    }
  }

  return inside
}

function parseSvgPointList(points: string): Vec2[] {
  return points
    .trim()
    .split(/\s+/)
    .flatMap((pair) => {
      const [rawX, rawY] = pair.split(',')
      const x = Number(rawX)
      const y = Number(rawY)

      return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y }] : []
    })
}

function initialCycleIndex(candidateCount: number): number {
  return candidateCount > 1 ? 1 : 0
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function distanceVec2(left: Vec2, right: Vec2): number {
  return Math.sqrt(squaredDistance(left, right))
}

function squaredDistance(left: Vec2, right: Vec2): number {
  const dx = left.x - right.x
  const dy = left.y - right.y

  return dx * dx + dy * dy
}

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0
}
