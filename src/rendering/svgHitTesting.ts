import { pathIntersectionDetectionForDiagram } from '../geometry/pathIntersections.ts'
import { sampleCurvedSheetPrimitive } from '../geometry/curvedSheets.ts'
import {
  arcSegmentToCubicBezierSegments,
  pathSegmentEnd,
  pathSegmentStart,
  sampleTemplatePathPoints,
} from '../model/paths.ts'
import { pathInlineNodePoint } from '../model/pathInlineNodes.ts'
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
  VisibilityOptions,
} from '../model/types.ts'
import {
  allLayersFilter,
  isLayerSelectableByLayerFilter,
  layerFilterIncludesLayer,
  type LayerFilter,
} from '../ui/layerFilter.ts'
import type { SingleSelectedElement } from '../ui/selection.ts'
import { projectToSvgPoint } from './svgProjection.ts'
import {
  shouldRenderStratumInSvgPreview,
  shouldRenderTextLabelInSvgPreview,
} from './svgPreviewPolicy.ts'
import { svgLabelAnchorPlacement } from './svgStyle.ts'
import { maxSvgPathInlineNodePreviews } from './svgPathInlineNodes.ts'

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

export type SvgSelectionCandidateVisibility = {
  hiddenPointIds?: ReadonlySet<string>
  hiddenLabelIds?: ReadonlySet<string>
}

type SvgSelectionCandidateOcclusion = {
  visibility: 'visible' | 'hidden'
}

export type CollectSvgPreviewSelectionCandidatesOptions = {
  diagram: Diagram
  camera: Diagram['camera']
  viewportHeight: number
  point: Vec2
  layerFilter?: LayerFilter
  visibility?: SvgSelectionCandidateVisibility
  showCoordinateAnchors?: boolean
  pathIntersectionCandidates?: readonly PathIntersectionCandidate[]
  tolerance?: number
  maxCandidates?: number
  maxProjectedPoints?: number
  maxInlineNodePreviews?: number
  maxStrataScans?: number
  includeDiagnostics?: false
}

export type CollectSvgPreviewSelectionCandidatesWithDiagnosticsOptions =
  Omit<CollectSvgPreviewSelectionCandidatesOptions, 'includeDiagnostics'> & {
    includeDiagnostics: true
  }

export type SvgPreviewSelectionCandidateCollectionDiagnostics = {
  candidatesCreated: number
  projectedPoints: number
  inlineNodePreviews: number
  strataScans: number
  truncated: boolean
  candidateBudgetExhausted: boolean
  projectionBudgetExhausted: boolean
  inlineNodePreviewBudgetExhausted: boolean
  strataScanBudgetExhausted: boolean
}

export type SvgPreviewSelectionCandidateCollectionResult = {
  candidates: SvgPreviewSelectionCandidate[]
  diagnostics: SvgPreviewSelectionCandidateCollectionDiagnostics
}

export type CreateSvgSelectionCandidateVisibilityOptions = {
  visibilityOptions: Pick<VisibilityOptions, 'pointVisibility' | 'labelVisibility'>
  pointOcclusionById?: ReadonlyMap<string, SvgSelectionCandidateOcclusion>
  labelOcclusionById?: ReadonlyMap<string, SvgSelectionCandidateOcclusion>
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

// Selection cycling runs synchronously on Alt/Option-click. These defaults keep
// ordinary overlapping diagrams exact while bounding dense preview hit-test work.
export const maxSvgPreviewSelectionCandidates = 64
export const maxSvgPreviewSelectionCandidateProjections = 512
export const maxSvgPreviewSelectionInlineNodePreviews = 128
export const maxSvgPreviewSelectionStrataScans = 2000

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

export function collectSvgPreviewSelectionCandidates(
  options: CollectSvgPreviewSelectionCandidatesWithDiagnosticsOptions,
): SvgPreviewSelectionCandidateCollectionResult
export function collectSvgPreviewSelectionCandidates(
  options: CollectSvgPreviewSelectionCandidatesOptions,
): SvgPreviewSelectionCandidate[]
export function collectSvgPreviewSelectionCandidates(
  options:
    | CollectSvgPreviewSelectionCandidatesOptions
    | CollectSvgPreviewSelectionCandidatesWithDiagnosticsOptions,
): SvgPreviewSelectionCandidate[] | SvgPreviewSelectionCandidateCollectionResult {
  const {
    diagram,
    camera,
    viewportHeight,
    point,
    layerFilter = allLayersFilter,
    visibility,
    showCoordinateAnchors = true,
    pathIntersectionCandidates,
    tolerance = defaultHitTolerance,
  } = options
  const budget = createCandidateCollectionBudget(options)
  const candidates: SvgPreviewSelectionCandidate[] = []

  if (showCoordinateAnchors && canCollectMoreCandidates(budget)) {
    collectCoordinateAnchorCandidates(
      candidates,
      budget,
      diagram,
      camera,
      viewportHeight,
      point,
    )
  }

  if (canCollectMoreCandidates(budget)) {
    collectPathIntersectionCandidateHits(
      candidates,
      budget,
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
      pathIntersectionCandidates,
    )
  }

  if (canCollectMoreCandidates(budget)) {
    collectLabelCandidates(
      candidates,
      budget,
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
      visibility,
      tolerance,
    )
  }

  if (canCollectMoreCandidates(budget)) {
    collectPointStratumCandidates(
      candidates,
      budget,
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
      visibility,
    )
  }

  if (canCollectMoreCandidates(budget)) {
    collectCurveInlineNodeCandidates(
      candidates,
      budget,
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
    )
  }

  if (canCollectMoreCandidates(budget)) {
    collectCurveStratumCandidates(
      candidates,
      budget,
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
      tolerance,
    )
  }

  if (canCollectMoreCandidates(budget)) {
    collectSurfaceStratumCandidates(
      candidates,
      budget,
      diagram,
      camera,
      viewportHeight,
      point,
      layerFilter,
      tolerance,
    )
  }

  const sortedCandidates = candidates.sort(compareSvgPreviewSelectionCandidates)
  const limitedCandidates = limitSvgPreviewSelectionCandidates(
    sortedCandidates,
    budget.maxCandidates,
  )

  if (options.includeDiagnostics === true) {
    return {
      candidates: limitedCandidates,
      diagnostics: candidateCollectionDiagnostics(budget),
    }
  }

  return limitedCandidates
}

export function createSvgSelectionCandidateVisibility({
  visibilityOptions,
  pointOcclusionById,
  labelOcclusionById,
}: CreateSvgSelectionCandidateVisibilityOptions): SvgSelectionCandidateVisibility {
  return {
    hiddenPointIds:
      visibilityOptions.pointVisibility === 'hideHidden'
        ? hiddenOcclusionIds(pointOcclusionById)
        : undefined,
    hiddenLabelIds:
      visibilityOptions.labelVisibility === 'autoHide'
        ? hiddenOcclusionIds(labelOcclusionById)
        : undefined,
  }
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
  const cycleCandidates = limitSvgPreviewSelectionCandidates(candidates)

  if (cycleCandidates.length === 0) {
    return {
      state: null,
      candidate: null,
      index: -1,
      count: 0,
      reset: true,
    }
  }

  const candidateKeys = cycleCandidates.map((candidate) => candidate.stableId)
  const canContinue =
    currentState !== null &&
    squaredDistance(currentState.point, point) <= resetDistance * resetDistance &&
    sameStringArray(currentState.candidateKeys, candidateKeys)
  const selectedIndex = canContinue
    ? (currentState.selectedIndex + 1) % cycleCandidates.length
    : initialCycleIndex(cycleCandidates.length)
  const state = {
    point: { ...point },
    candidateKeys,
    selectedIndex,
  }

  return {
    state,
    candidate: cycleCandidates[selectedIndex] ?? null,
    index: selectedIndex,
    count: cycleCandidates.length,
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

type CandidateCollectionBudget = {
  maxCandidates: number
  maxProjectedPoints: number
  maxInlineNodePreviews: number
  maxStrataScans: number
  candidatesCreated: number
  projectedPoints: number
  inlineNodePreviews: number
  strataScans: number
  candidateBudgetExhausted: boolean
  projectionBudgetExhausted: boolean
  inlineNodePreviewBudgetExhausted: boolean
  strataScanBudgetExhausted: boolean
}

function createCandidateCollectionBudget(
  options:
    | CollectSvgPreviewSelectionCandidatesOptions
    | CollectSvgPreviewSelectionCandidatesWithDiagnosticsOptions,
): CandidateCollectionBudget {
  return {
    maxCandidates: normalizePositiveIntegerLimit(
      options.maxCandidates,
      maxSvgPreviewSelectionCandidates,
    ),
    maxProjectedPoints: normalizePositiveIntegerLimit(
      options.maxProjectedPoints,
      maxSvgPreviewSelectionCandidateProjections,
    ),
    maxInlineNodePreviews: normalizePositiveIntegerLimit(
      options.maxInlineNodePreviews,
      maxSvgPreviewSelectionInlineNodePreviews,
    ),
    maxStrataScans: normalizePositiveIntegerLimit(
      options.maxStrataScans,
      maxSvgPreviewSelectionStrataScans,
    ),
    candidatesCreated: 0,
    projectedPoints: 0,
    inlineNodePreviews: 0,
    strataScans: 0,
    candidateBudgetExhausted: false,
    projectionBudgetExhausted: false,
    inlineNodePreviewBudgetExhausted: false,
    strataScanBudgetExhausted: false,
  }
}

function candidateCollectionDiagnostics(
  budget: CandidateCollectionBudget,
): SvgPreviewSelectionCandidateCollectionDiagnostics {
  const truncated =
    budget.candidateBudgetExhausted ||
    budget.projectionBudgetExhausted ||
    budget.inlineNodePreviewBudgetExhausted ||
    budget.strataScanBudgetExhausted

  return {
    candidatesCreated: budget.candidatesCreated,
    projectedPoints: budget.projectedPoints,
    inlineNodePreviews: budget.inlineNodePreviews,
    strataScans: budget.strataScans,
    truncated,
    candidateBudgetExhausted: budget.candidateBudgetExhausted,
    projectionBudgetExhausted: budget.projectionBudgetExhausted,
    inlineNodePreviewBudgetExhausted: budget.inlineNodePreviewBudgetExhausted,
    strataScanBudgetExhausted: budget.strataScanBudgetExhausted,
  }
}

function normalizePositiveIntegerLimit(
  value: number | undefined,
  fallback: number,
): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback
}

function canCollectMoreCandidates(budget: CandidateCollectionBudget): boolean {
  return budget.candidatesCreated < budget.maxCandidates
}

function pushSelectionCandidate(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  candidate: SvgPreviewSelectionCandidate,
): boolean {
  if (!canCollectMoreCandidates(budget)) {
    budget.candidateBudgetExhausted = true
    return false
  }

  candidates.push(candidate)
  budget.candidatesCreated += 1

  return true
}

function projectModelPointWithBudget(
  budget: CandidateCollectionBudget,
  camera: Diagram['camera'],
  point: Vec3,
  viewportHeight: number,
): Vec2 | null {
  if (budget.projectedPoints >= budget.maxProjectedPoints) {
    budget.projectionBudgetExhausted = true
    return null
  }

  budget.projectedPoints += 1

  return projectToSvgPoint(camera, point, viewportHeight)
}

function reserveInlineNodePreview(
  budget: CandidateCollectionBudget,
): boolean {
  if (budget.inlineNodePreviews >= budget.maxInlineNodePreviews) {
    budget.inlineNodePreviewBudgetExhausted = true
    return false
  }

  budget.inlineNodePreviews += 1

  return true
}

function reserveStratumScan(budget: CandidateCollectionBudget): boolean {
  if (budget.strataScans >= budget.maxStrataScans) {
    budget.strataScanBudgetExhausted = true
    return false
  }

  budget.strataScans += 1

  return true
}

function collectCoordinateAnchorCandidates(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
): void {
  for (const anchor of diagram.coordinateAnchors ?? []) {
    if (!canCollectMoreCandidates(budget)) {
      budget.candidateBudgetExhausted = true
      break
    }

    try {
      const modelPoint = coordinateAnchorPositionPreview(
        anchor.position,
        diagram.ambientDimension,
      )
      const center = projectModelPointWithBudget(
        budget,
        camera,
        modelPoint,
        viewportHeight,
      )

      if (center === null) {
        break
      }

      if (!isFiniteVec2(center)) {
        continue
      }

      const distance = distanceVec2(center, point)

      if (distance > 11) {
        continue
      }

      if (
        !pushSelectionCandidate(candidates, budget, {
          kind: 'coordinateAnchor',
          id: anchor.id,
          hit: true,
          distance,
          stableId: `coordinateAnchor:${anchor.id}`,
          description: `coordinate "${anchor.name}"`,
          selection: { kind: 'coordinate', id: anchor.id },
        })
      ) {
        break
      }
    } catch {
      continue
    }
  }
}

function collectPathIntersectionCandidateHits(
  selectionCandidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
  pathIntersectionCandidates: readonly PathIntersectionCandidate[] | undefined,
): void {
  if (diagram.ambientDimension !== 2) {
    return
  }

  const candidates =
    pathIntersectionCandidates ??
    pathIntersectionDetectionForDiagram(diagram, {
      maxCandidates: budget.maxCandidates,
      includeCurve: (curve) =>
        shouldRenderStratumInSvgPreview(diagram, curve) &&
        layerFilterIncludesLayer(layerFilter, curve.layer),
    }).candidates

  for (const candidate of candidates) {
    if (!canCollectMoreCandidates(budget)) {
      budget.candidateBudgetExhausted = true
      break
    }

    if (!pathIntersectionCandidateIsSelectable(diagram, candidate, layerFilter)) {
      continue
    }

    const center = projectModelPointWithBudget(
      budget,
      camera,
      candidate.point,
      viewportHeight,
    )

    if (center === null) {
      break
    }

    if (!isFiniteVec2(center)) {
      continue
    }

    const distance = distanceVec2(center, point)

    if (distance > pathIntersectionCandidateHitRadius) {
      continue
    }

    if (
      !pushSelectionCandidate(selectionCandidates, budget, {
        kind: 'pathIntersectionCandidate',
        id: candidate.id,
        hit: true,
        distance,
        stableId: `pathIntersectionCandidate:${candidate.id}`,
        description: `crossing "${candidate.pathAId} with ${candidate.pathBId}"`,
      })
    ) {
      break
    }
  }
}

function collectLabelCandidates(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
  visibility: SvgSelectionCandidateVisibility | undefined,
  tolerance: number,
): void {
  for (const label of diagram.labels) {
    if (!canCollectMoreCandidates(budget)) {
      budget.candidateBudgetExhausted = true
      break
    }

    if (
      visibility?.hiddenLabelIds?.has(label.id) === true ||
      !shouldRenderTextLabelInSvgPreview(diagram, label) ||
      !isLayerSelectableByLayerFilter(diagram, layerFilter, label.layer)
    ) {
      continue
    }

    const distance = labelHitDistance(
      label,
      budget,
      camera,
      viewportHeight,
      point,
      tolerance,
    )

    if (budget.projectionBudgetExhausted) {
      break
    }

    if (distance === null) {
      continue
    }

    if (
      !pushSelectionCandidate(candidates, budget, {
        kind: 'label',
        id: label.id,
        hit: true,
        distance,
        stableId: `label:${label.id}`,
        description: `label "${label.name}"`,
        selection: { kind: 'label', id: label.id },
      })
    ) {
      break
    }
  }
}

function collectPointStratumCandidates(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
  visibility: SvgSelectionCandidateVisibility | undefined,
): void {
  for (const stratum of diagram.strata) {
    if (!canCollectMoreCandidates(budget)) {
      budget.candidateBudgetExhausted = true
      break
    }

    if (stratum.geometricKind !== 'point') {
      continue
    }

    if (visibility?.hiddenPointIds?.has(stratum.id) === true) {
      continue
    }

    if (
      !shouldRenderStratumInSvgPreview(diagram, stratum) ||
      !isLayerSelectableByLayerFilter(diagram, layerFilter, stratum.layer)
    ) {
      continue
    }

    if (!reserveStratumScan(budget)) {
      break
    }

    if (
      collectPointCandidate(
        candidates,
        budget,
        stratum,
        camera,
        viewportHeight,
        point,
      ) === false
    ) {
      break
    }
  }
}

function collectCurveInlineNodeCandidates(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
): void {
  for (const stratum of diagram.strata) {
    if (
      !canCollectMoreCandidates(budget) ||
      budget.inlineNodePreviewBudgetExhausted
    ) {
      if (!canCollectMoreCandidates(budget)) {
        budget.candidateBudgetExhausted = true
      }
      break
    }

    if (stratum.geometricKind !== 'curve') {
      continue
    }

    if (
      !shouldRenderStratumInSvgPreview(diagram, stratum) ||
      !isLayerSelectableByLayerFilter(diagram, layerFilter, stratum.layer)
    ) {
      continue
    }

    if ((stratum.inlineNodes ?? []).length === 0) {
      continue
    }

    if (!reserveStratumScan(budget)) {
      break
    }

    if (
      collectPathInlineNodeCandidatesForCurve(
        candidates,
        budget,
        stratum,
        diagram,
        camera,
        viewportHeight,
        point,
      ) === false
    ) {
      break
    }
  }
}

function collectCurveStratumCandidates(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
  tolerance: number,
): void {
  for (const stratum of diagram.strata) {
    if (!canCollectMoreCandidates(budget)) {
      budget.candidateBudgetExhausted = true
      break
    }

    if (stratum.geometricKind !== 'curve') {
      continue
    }

    if (
      !shouldRenderStratumInSvgPreview(diagram, stratum) ||
      !isLayerSelectableByLayerFilter(diagram, layerFilter, stratum.layer)
    ) {
      continue
    }

    if (!reserveStratumScan(budget)) {
      break
    }

    if (
      collectCurveCandidate(
        candidates,
        budget,
        stratum,
        diagram,
        camera,
        viewportHeight,
        point,
        tolerance,
      ) === false
    ) {
      break
    }
  }
}

function collectSurfaceStratumCandidates(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  layerFilter: LayerFilter,
  tolerance: number,
): void {
  for (const stratum of diagram.strata) {
    if (!canCollectMoreCandidates(budget)) {
      budget.candidateBudgetExhausted = true
      break
    }

    if (stratum.geometricKind !== 'region' && stratum.geometricKind !== 'sheet') {
      continue
    }

    if (
      !shouldRenderStratumInSvgPreview(diagram, stratum) ||
      !isLayerSelectableByLayerFilter(diagram, layerFilter, stratum.layer)
    ) {
      continue
    }

    if (!reserveStratumScan(budget)) {
      break
    }

    const label = stratum.geometricKind === 'region' ? 'region' : 'sheet'

    if (
      collectSurfaceCandidate(
        candidates,
        budget,
        stratum,
        surfacePolygonsForStratum(
          stratum,
          diagram,
          camera,
          viewportHeight,
          budget,
        ),
        point,
        tolerance,
        label,
      ) === false
    ) {
      break
    }
  }
}

function collectPathInlineNodeCandidatesForCurve(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  curve: CurveStratum,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
): boolean {
  let previewsForCurve = 0

  for (const node of curve.inlineNodes ?? []) {
    if (!canCollectMoreCandidates(budget)) {
      budget.candidateBudgetExhausted = true
      return false
    }

    if (previewsForCurve >= maxSvgPathInlineNodePreviews) {
      break
    }

    if (!reserveInlineNodePreview(budget)) {
      return false
    }

    previewsForCurve += 1

    const modelPoint = pathInlineNodePoint(curve, node, diagram.ambientDimension)

    if (modelPoint === null) {
      continue
    }

    const center = projectModelPointWithBudget(
      budget,
      camera,
      modelPoint,
      viewportHeight,
    )

    if (center === null) {
      return false
    }

    if (!isFiniteVec2(center)) {
      continue
    }

    const distance = distanceVec2(center, point)

    if (distance > 10) {
      continue
    }

    if (
      !pushSelectionCandidate(candidates, budget, {
        kind: 'pathInlineNode',
        id: node.id,
        hit: true,
        distance,
        stableId: `pathInlineNode:${curve.id}:${node.id}`,
        description: `path node "${node.text.trim() || node.id}" on "${curve.name}"`,
        selection: { kind: 'stratum', id: curve.id },
      })
    ) {
      return false
    }
  }

  return true
}

function hiddenOcclusionIds(
  occlusionById: ReadonlyMap<string, SvgSelectionCandidateOcclusion> | undefined,
): ReadonlySet<string> | undefined {
  if (occlusionById === undefined || occlusionById.size === 0) {
    return undefined
  }

  const hiddenIds = new Set<string>()

  occlusionById.forEach((occlusion, id) => {
    if (occlusion.visibility === 'hidden') {
      hiddenIds.add(id)
    }
  })

  return hiddenIds.size === 0 ? undefined : hiddenIds
}

function collectSurfaceCandidate(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  stratum: Stratum,
  polygons: Vec2[][],
  point: Vec2,
  tolerance: number,
  label: 'region' | 'sheet',
): boolean {
  const finitePolygons = polygons.filter(
    (polygon) => polygon.length >= 3 && polygon.every(isFiniteVec2),
  )

  if (finitePolygons.length === 0) {
    return !budget.projectionBudgetExhausted
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
    return !budget.projectionBudgetExhausted
  }

  const added = pushSelectionCandidate(candidates, budget, {
    kind: 'sheetOrRegion',
    id: stratum.id,
    hit: true,
    distance,
    stableId: `sheetOrRegion:${stratum.id}`,
    description: `${label} "${stratum.name}"`,
    selection: { kind: 'stratum', id: stratum.id },
  })

  return added && !budget.projectionBudgetExhausted
}

function collectCurveCandidate(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  curve: CurveStratum,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  tolerance: number,
): boolean {
  const projectedPolylines = projectedPolylinesForCurve(
    curve,
    diagram,
    camera,
    viewportHeight,
    budget,
  )
  const hitTolerance = Math.max(tolerance, curve.style.lineWidth / 2 + tolerance)
  const distances = projectedPolylines
    .filter((polyline) => polyline.length >= 2 && polyline.every(isFiniteVec2))
    .map((polyline) => distanceToOpenPolyline(point, polyline))

  if (distances.length === 0) {
    return !budget.projectionBudgetExhausted
  }

  const distance = Math.min(...distances)

  if (distance > hitTolerance) {
    return !budget.projectionBudgetExhausted
  }

  const added = pushSelectionCandidate(candidates, budget, {
    kind: 'curve',
    id: curve.id,
    hit: true,
    distance,
    stableId: `curve:${curve.id}`,
    description: `path "${curve.name}"`,
    selection: { kind: 'stratum', id: curve.id },
  })

  return added && !budget.projectionBudgetExhausted
}

function collectPointCandidate(
  candidates: SvgPreviewSelectionCandidate[],
  budget: CandidateCollectionBudget,
  pointStratum: PointStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
): boolean {
  const center = projectModelPointWithBudget(
    budget,
    camera,
    pointStratum.position,
    viewportHeight,
  )

  if (center === null) {
    return false
  }

  if (!isFiniteVec2(center)) {
    return true
  }

  const distance = distanceVec2(center, point)
  const hitRadius = Math.max(pointStratum.style.size * pointRadiusScale, 1) + 6

  if (distance > hitRadius) {
    return true
  }

  return pushSelectionCandidate(candidates, budget, {
    kind: 'point',
    id: pointStratum.id,
    hit: true,
    distance,
    stableId: `point:${pointStratum.id}`,
    description: `point "${pointStratum.name}"`,
    selection: { kind: 'stratum', id: pointStratum.id },
  })
}

function surfacePolygonsForStratum(
  stratum: Stratum,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  budget: CandidateCollectionBudget,
): Vec2[][] {
  if (stratum.geometricKind === 'region') {
    if (stratum.kind !== 'filledRegion') {
      return []
    }

    return projectedBoundaryPolylines(
      stratum.boundaries,
      diagram,
      camera,
      viewportHeight,
      budget,
    )
  }

  if (stratum.geometricKind !== 'sheet') {
    return []
  }

  switch (stratum.kind) {
    case 'quadSheet':
    case 'polygonSheet':
      return [
        projectModelPolylineWithBudget(
          sheetVertices(stratum),
          camera,
          viewportHeight,
          budget,
        ),
      ]
    case 'workPlaneFilledSheet':
      return projectedBoundaryPolylines(
        stratum.boundaries,
        diagram,
        camera,
        viewportHeight,
        budget,
      )
    case 'curvedSheet':
      try {
        const mesh = sampleCurvedSheetPrimitive(stratum.primitive)
        const projectedVertices = projectModelPolylineWithBudget(
          mesh.vertices,
          camera,
          viewportHeight,
          budget,
        )
        const polygons: Vec2[][] = []

        for (const face of mesh.faces) {
          if (
            budget.projectionBudgetExhausted &&
            face.some((vertexIndex) => projectedVertices[vertexIndex] === undefined)
          ) {
            break
          }

          const polygon = face.flatMap((vertexIndex): Vec2[] => {
            const vertex = projectedVertices[vertexIndex]

            return vertex === undefined ? [] : [vertex]
          })

          if (polygon.length === face.length) {
            polygons.push(polygon)
          }
        }

        return polygons
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
  budget: CandidateCollectionBudget,
): Vec2[][] {
  if (curve.kind === 'grid') {
    const preview = gridPreviewSegments(curve, diagram.ambientDimension)

    if (!preview.ok) {
      return []
    }

    const polylines: Vec2[][] = []

    for (const segment of preview.segments) {
      if (budget.projectionBudgetExhausted) {
        break
      }

      const projected = projectModelPolylineWithBudget(
        [segment.start, segment.end],
        camera,
        viewportHeight,
        budget,
      )

      if (projected.length === 2) {
        polylines.push(projected)
      }
    }

    return polylines
  }

  if (curve.kind === 'templatePath') {
    return [
      projectModelPolylineWithBudget(
        sampleTemplatePathPoints(
          curve.template,
          diagram.ambientDimension,
          templatePathHitSamples,
        ),
        camera,
        viewportHeight,
        budget,
      ),
    ]
  }

  if (curve.kind === 'concatenatedPath') {
    const polylines: Vec2[][] = []

    for (const segment of curve.segments) {
      if (budget.projectionBudgetExhausted) {
        break
      }

      polylines.push(
        projectModelPolylineWithBudget(
          samplePathSegment(segment, diagram.ambientDimension),
          camera,
          viewportHeight,
          budget,
        ),
      )
    }

    return polylines
  }

  if (curve.kind === 'cubicBezier') {
    return [
      projectModelPolylineWithBudget(
        sampleCubicBezierPoints(curve.points),
        camera,
        viewportHeight,
        budget,
      ),
    ]
  }

  return [
    projectModelPolylineWithBudget(
      curve.points,
      camera,
      viewportHeight,
      budget,
    ),
  ]
}

function projectedBoundaryPolylines(
  boundaries: readonly ClosedPathBoundary[],
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  budget: CandidateCollectionBudget,
): Vec2[][] {
  const polylines: Vec2[][] = []

  for (const boundary of boundaries) {
    const polyline = projectedBoundaryPolyline(
      boundary,
      diagram,
      camera,
      viewportHeight,
      budget,
    )

    polylines.push(polyline)

    if (budget.projectionBudgetExhausted) {
      break
    }
  }

  return polylines
}

function projectedBoundaryPolyline(
  boundary: ClosedPathBoundary,
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  budget: CandidateCollectionBudget,
): Vec2[] {
  const points: Vec2[] = []

  for (const [index, segment] of boundary.segments.entries()) {
    const sampled = samplePathSegment(segment, diagram.ambientDimension)
    const samples = index === 0 ? sampled : sampled.slice(1)

    for (const sample of samples) {
      const projected = projectModelPointWithBudget(
        budget,
        camera,
        sample,
        viewportHeight,
      )

      if (projected === null) {
        return points
      }

      points.push(projected)
    }
  }

  return points
}

function projectModelPolylineWithBudget(
  points: readonly Vec3[],
  camera: Diagram['camera'],
  viewportHeight: number,
  budget: CandidateCollectionBudget,
): Vec2[] {
  const projectedPoints: Vec2[] = []

  for (const point of points) {
    const projected = projectModelPointWithBudget(
      budget,
      camera,
      point,
      viewportHeight,
    )

    if (projected === null) {
      break
    }

    projectedPoints.push(projected)
  }

  return projectedPoints
}

function labelHitDistance(
  label: TextLabel,
  budget: CandidateCollectionBudget,
  camera: Diagram['camera'],
  viewportHeight: number,
  point: Vec2,
  tolerance: number,
): number | null {
  const anchor = projectModelPointWithBudget(
    budget,
    camera,
    label.position,
    viewportHeight,
  )

  if (anchor === null) {
    return null
  }

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

function initialCycleIndex(candidateCount: number): number {
  return candidateCount > 1 ? 1 : 0
}

function limitSvgPreviewSelectionCandidates(
  candidates: readonly SvgPreviewSelectionCandidate[],
  maxCandidates = maxSvgPreviewSelectionCandidates,
): SvgPreviewSelectionCandidate[] {
  const limit =
    Number.isFinite(maxCandidates) && maxCandidates > 0
      ? Math.floor(maxCandidates)
      : maxSvgPreviewSelectionCandidates

  return candidates.slice(0, limit)
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
