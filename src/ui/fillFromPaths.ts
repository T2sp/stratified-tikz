import { isValidWorkPlaneFrameSnapshot } from '../geometry/bezierControls.ts'
import {
  constructWorkPlaneFromThreePoints,
  isFiniteVec3,
  norm,
  subtractVec3,
  workPlaneToBasis,
} from '../geometry/workPlane.ts'
import {
  createFilledRegion2DStratum,
  createWorkPlaneFilledSheet3DStratum,
} from '../model/constructors.ts'
import { defaultSheetStyle } from '../model/styles.ts'
import {
  closedPathBoundaryCoordinates,
  isClosedPathBoundary,
  isFillRule,
  isPointOnWorkPlaneFrame,
} from '../model/filledBoundaries.ts'
import {
  normalizePathSegmentsForAmbientDimension,
  pathCoordinates,
  pathEndpointEpsilon,
} from '../model/paths.ts'
import type {
  ClosedPathBoundary,
  ConcatenatedPathStratum,
  Diagram,
  FillRule,
  PathSegment,
  RegionStyle,
  Vec3,
  WorkPlane,
  WorkPlaneFrameSnapshot,
} from '../model/types.ts'
import { makeUniqueId } from './diagramUpdates.ts'

export type CreateFillFromClosedPathsError =
  | 'noSourcePaths'
  | 'duplicateSourcePath'
  | 'invalidFillRule'
  | 'missingSourcePath'
  | 'sourceNotConcatenatedPath'
  | 'sourceWrongCodimension'
  | 'sourceNonFinite'
  | 'sourceNonZeroZ'
  | 'sourceOpenPath'
  | 'sourceNotCoplanar'
  | 'sourcePlaneUnreliable'

export type CreateFillFromClosedPathsOptions = {
  id?: string
  name?: string
  layer?: number
  fillRule?: FillRule
  activeWorkPlane?: WorkPlane
}

export type CreateFillFromClosedPathsResult =
  | {
      ok: true
      diagram: Diagram
      id: string
      kind: 'filledRegion' | 'workPlaneFilledSheet'
    }
  | {
      ok: false
      diagram: Diagram
      error: CreateFillFromClosedPathsError
      sourcePathId?: string
    }

type PlaneFrameResult =
  | { ok: true; frame: WorkPlaneFrameSnapshot }
  | { ok: false; error: 'sourceNotCoplanar' | 'sourcePlaneUnreliable' }

const defaultFilledRegionStyle: RegionStyle = {
  kind: 'regionStyle',
  fillColor: defaultSheetStyle.fillColor,
  fillOpacity: defaultSheetStyle.fillOpacity,
  strokeColor: defaultSheetStyle.strokeColor,
  strokeOpacity: defaultSheetStyle.strokeOpacity,
}

export function createFillFromClosedPaths(
  diagram: Diagram,
  sourcePathIds: readonly string[],
  options: CreateFillFromClosedPathsOptions = {},
): CreateFillFromClosedPathsResult {
  const fillRule = options.fillRule ?? 'nonzero'

  if (!isFillRule(fillRule)) {
    return {
      ok: false,
      diagram,
      error: 'invalidFillRule',
    }
  }

  if (sourcePathIds.length === 0) {
    return {
      ok: false,
      diagram,
      error: 'noSourcePaths',
    }
  }

  const uniqueSourcePathIds = new Set(sourcePathIds)

  if (uniqueSourcePathIds.size !== sourcePathIds.length) {
    return {
      ok: false,
      diagram,
      error: 'duplicateSourcePath',
    }
  }

  const sourcePaths: ConcatenatedPathStratum[] = []

  for (const sourcePathId of sourcePathIds) {
    const source = diagram.strata.find((stratum) => stratum.id === sourcePathId)

    if (source === undefined) {
      return {
        ok: false,
        diagram,
        error: 'missingSourcePath',
        sourcePathId,
      }
    }

    if (source.geometricKind !== 'curve' || source.kind !== 'concatenatedPath') {
      return {
        ok: false,
        diagram,
        error: 'sourceNotConcatenatedPath',
        sourcePathId,
      }
    }

    const expectedCodim = diagram.ambientDimension === 2 ? 1 : 2

    if (source.codim !== expectedCodim) {
      return {
        ok: false,
        diagram,
        error: 'sourceWrongCodimension',
        sourcePathId,
      }
    }

    const validationError = validateSourcePathForFill(diagram, source)

    if (validationError !== null) {
      return {
        ok: false,
        diagram,
        error: validationError,
        sourcePathId,
      }
    }

    sourcePaths.push(source)
  }

  const boundaries = sourcePaths.map((source) =>
    closedBoundaryFromSourcePath(diagram, source),
  )
  const layer = options.layer ?? nextLayer(diagram)

  if (diagram.ambientDimension === 2) {
    const region = createFilledRegion2DStratum({
      id: safeFillId(diagram, options.id, 'filled-region'),
      name: options.name ?? 'Filled region',
      style: defaultFilledRegionStyle,
      boundaries,
      fillRule,
      layer,
    })

    return {
      ok: true,
      diagram: {
        ...diagram,
        strata: [...diagram.strata, region],
      },
      id: region.id,
      kind: 'filledRegion',
    }
  }

  const planeResult = workPlaneFrameForBoundaries(
    boundaries,
    options.activeWorkPlane,
  )

  if (!planeResult.ok) {
    return {
      ok: false,
      diagram,
      error: planeResult.error,
    }
  }

  const sheet = createWorkPlaneFilledSheet3DStratum({
    id: safeFillId(diagram, options.id, 'filled-sheet'),
    name: options.name ?? 'Filled sheet',
    planeFrame: planeResult.frame,
    boundaries,
    fillRule,
    layer,
  })

  return {
    ok: true,
    diagram: {
      ...diagram,
      strata: [...diagram.strata, sheet],
    },
    id: sheet.id,
    kind: 'workPlaneFilledSheet',
  }
}

export function createFillFromClosedPathsErrorMessage(
  error: CreateFillFromClosedPathsError,
): string {
  switch (error) {
    case 'noSourcePaths':
      return 'Pick at least one closed path.'
    case 'duplicateSourcePath':
      return 'Each source path can be picked only once.'
    case 'invalidFillRule':
      return 'Choose a valid fill rule.'
    case 'missingSourcePath':
      return 'A picked path is no longer available.'
    case 'sourceNotConcatenatedPath':
      return 'Picked sources must be concatenated paths.'
    case 'sourceWrongCodimension':
      return 'Picked paths have the wrong codimension for this diagram.'
    case 'sourceNonFinite':
      return 'Picked paths must have finite coordinates.'
    case 'sourceNonZeroZ':
      return '2D fill boundaries must have z = 0.'
    case 'sourceOpenPath':
      return 'Every picked path must be closed.'
    case 'sourceNotCoplanar':
      return 'Picked 3D paths must lie on one common plane.'
    case 'sourcePlaneUnreliable':
      return 'Could not determine a reliable plane for the picked 3D paths.'
  }
}

function validateSourcePathForFill(
  diagram: Diagram,
  source: ConcatenatedPathStratum,
): CreateFillFromClosedPathsError | null {
  const coordinates = pathCoordinates(source.segments)

  if (!coordinates.every(isFiniteVec3)) {
    return 'sourceNonFinite'
  }

  if (
    diagram.ambientDimension === 2 &&
    coordinates.some((point) => Math.abs(point.z) > pathEndpointEpsilon)
  ) {
    return 'sourceNonZeroZ'
  }

  const boundary = closedBoundaryFromSourcePath(diagram, source)

  return isClosedPathBoundary(boundary)
    ? null
    : 'sourceOpenPath'
}

function closedBoundaryFromSourcePath(
  diagram: Diagram,
  source: ConcatenatedPathStratum,
): ClosedPathBoundary {
  return {
    id: source.id,
    name: source.name,
    segments: normalizePathSegmentsForAmbientDimension(
      source.segments,
      diagram.ambientDimension,
    ),
  }
}

function workPlaneFrameForBoundaries(
  boundaries: readonly ClosedPathBoundary[],
  activeWorkPlane: WorkPlane | undefined,
): PlaneFrameResult {
  const boundaryPoints = boundaries.flatMap(closedPathBoundaryCoordinates)
  const metadataFrame = workPlaneFrameFromBoundaryMetadata(boundaries)

  if (
    metadataFrame !== null &&
    boundaryPoints.every((point) => isPointOnWorkPlaneFrame(point, metadataFrame))
  ) {
    return {
      ok: true,
      frame: metadataFrame,
    }
  }

  if (activeWorkPlane !== undefined) {
    const activeFrame = tryWorkPlaneFrameFromWorkPlane(activeWorkPlane)

    if (
      activeFrame !== null &&
      boundaryPoints.every((point) => isPointOnWorkPlaneFrame(point, activeFrame))
    ) {
      return {
        ok: true,
        frame: activeFrame,
      }
    }
  }

  const derivedFrame = deriveWorkPlaneFrameFromPoints(boundaryPoints)

  if (derivedFrame === null) {
    return {
      ok: false,
      error: 'sourcePlaneUnreliable',
    }
  }

  if (
    !boundaryPoints.every((point) => isPointOnWorkPlaneFrame(point, derivedFrame))
  ) {
    return {
      ok: false,
      error: 'sourceNotCoplanar',
    }
  }

  return {
    ok: true,
    frame: derivedFrame,
  }
}

function workPlaneFrameFromBoundaryMetadata(
  boundaries: readonly ClosedPathBoundary[],
): WorkPlaneFrameSnapshot | null {
  for (const boundary of boundaries) {
    for (const segment of boundary.segments) {
      const frame = workPlaneFrameFromSegmentMetadata(segment)

      if (frame !== null) {
        return frame
      }
    }
  }

  return null
}

function workPlaneFrameFromSegmentMetadata(
  segment: PathSegment,
): WorkPlaneFrameSnapshot | null {
  if (segment.kind !== 'cubicBezier') {
    return null
  }

  const controlMode = segment.controlMode

  if (
    controlMode === undefined ||
    (controlMode.kind !== 'workPlaneRelativeCartesian' &&
      controlMode.kind !== 'workPlaneRelativePolar') ||
    !isValidWorkPlaneFrameSnapshot(controlMode.frame)
  ) {
    return null
  }

  return cloneWorkPlaneFrame(controlMode.frame)
}

function tryWorkPlaneFrameFromWorkPlane(
  workPlane: WorkPlane,
): WorkPlaneFrameSnapshot | null {
  try {
    return cloneWorkPlaneFrame(workPlaneToBasis(workPlane))
  } catch {
    return null
  }
}

function deriveWorkPlaneFrameFromPoints(
  points: readonly Vec3[],
): WorkPlaneFrameSnapshot | null {
  const first = points[0]

  if (first === undefined) {
    return null
  }

  const second = points.find(
    (point) => norm(subtractVec3(point, first)) > pathEndpointEpsilon,
  )

  if (second === undefined) {
    return null
  }

  const third = points.find((point) => {
    const firstEdge = subtractVec3(second, first)
    const secondEdge = subtractVec3(point, first)

    return norm(crossProduct(firstEdge, secondEdge)) > pathEndpointEpsilon
  })

  if (third === undefined) {
    return null
  }

  try {
    const workPlane = constructWorkPlaneFromThreePoints(first, second, third)

    return cloneWorkPlaneFrame(workPlane)
  } catch {
    return null
  }
}

function crossProduct(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  }
}

function safeFillId(
  diagram: Diagram,
  id: string | undefined,
  fallbackPrefix: string,
): string {
  const trimmedId = id?.trim()

  if (trimmedId === undefined || trimmedId.length === 0) {
    return makeUniqueId(diagram, fallbackPrefix)
  }

  return diagram.strata.some((stratum) => stratum.id === trimmedId) ||
    diagram.labels.some((label) => label.id === trimmedId)
    ? makeUniqueId(diagram, fallbackPrefix)
    : trimmedId
}

function nextLayer(diagram: Diagram): number {
  const layers = [
    ...diagram.strata.map((stratum) => stratum.layer),
    ...diagram.labels.map((label) => label.layer),
  ]

  return layers.length === 0 ? 0 : Math.max(...layers) + 1
}

function cloneWorkPlaneFrame(
  frame: WorkPlaneFrameSnapshot,
): WorkPlaneFrameSnapshot {
  return {
    origin: { ...frame.origin },
    u: { ...frame.u },
    v: { ...frame.v },
    normal: { ...frame.normal },
  }
}
