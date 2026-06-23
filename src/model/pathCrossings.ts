import {
  is2DPathLikeCurveForIntersections,
  pathIntersectionDetectionForDiagram,
} from '../geometry/pathIntersections.ts'
import { crossingKinds } from './types.ts'
import type {
  CrossingKind,
  Diagram,
  PathCrossingState,
  PathIntersectionCandidate,
  Vec3,
} from './types.ts'

export type TogglePathCrossingResult =
  | {
      ok: true
      diagram: Diagram
      kind: CrossingKind
      state: PathCrossingState
    }
  | {
      ok: false
      diagram: Diagram
      reason: 'unsupportedAmbientDimension' | 'staleCandidate'
    }

export type LoadedPathCrossingNormalization = {
  pathCrossings?: PathCrossingState[]
  warnings: string[]
}

export type PathCrossingStateCleanupOptions = {
  reconcileStalePathPairs?: boolean
}

const pathCrossingReconcileDistanceEpsilon = 1e-6

export function isCrossingKind(value: unknown): value is CrossingKind {
  return crossingKinds.some((kind) => kind === value)
}

export function nextCrossingKind(kind: CrossingKind = 'none'): CrossingKind {
  switch (kind) {
    case 'none':
      return 'braiding'
    case 'braiding':
      return 'antiBraiding'
    case 'antiBraiding':
      return 'none'
  }
}

export function pathCrossingStateFromCandidate(
  candidate: PathIntersectionCandidate,
  kind: CrossingKind,
): PathCrossingState {
  return {
    id: candidate.id,
    pathAId: candidate.pathAId,
    pathBId: candidate.pathBId,
    point: cloneVec3(candidate.point),
    parameterA: candidate.parameterA,
    parameterB: candidate.parameterB,
    kind,
  }
}

export function pathCrossingKindForCandidate(
  diagram: Diagram,
  candidate: PathIntersectionCandidate,
): CrossingKind {
  return (
    diagram.pathCrossings?.find(
      (state) =>
        state.id === candidate.id &&
        state.pathAId === candidate.pathAId &&
        state.pathBId === candidate.pathBId,
    )?.kind ?? 'none'
  )
}

export function togglePathCrossingStateForCandidate(
  diagram: Diagram,
  candidate: PathIntersectionCandidate,
): TogglePathCrossingResult {
  const cleanedDiagram = cleanPathCrossingStates(diagram)

  if (cleanedDiagram.ambientDimension !== 2) {
    return {
      ok: false,
      diagram: cleanedDiagram,
      reason: 'unsupportedAmbientDimension',
    }
  }

  const detection = pathIntersectionDetectionForDiagram(cleanedDiagram)
  const candidates = detection.candidates
  const currentCandidate = candidates.find(
    (candidateForDiagram) =>
      candidateForDiagram.id === candidate.id &&
      candidateForDiagram.pathAId === candidate.pathAId &&
      candidateForDiagram.pathBId === candidate.pathBId,
  )

  if (currentCandidate === undefined) {
    return {
      ok: false,
      diagram: cleanedDiagram,
      reason: 'staleCandidate',
    }
  }

  const kind = nextCrossingKind(
    pathCrossingKindForCandidate(cleanedDiagram, currentCandidate),
  )
  const state = pathCrossingStateFromCandidate(currentCandidate, kind)
  const statesById = new Map(
    (cleanedDiagram.pathCrossings ?? []).map((storedState) => [
      storedState.id,
      storedState,
    ]),
  )
  statesById.set(state.id, state)

  const pathCrossings = detection.status.capped
    ? filterPathCrossingStatesForExisting2DCurves(
        [...statesById.values()],
        cleanedDiagram,
      )
    : candidates.flatMap((candidateForDiagram) => {
        const storedState = statesById.get(candidateForDiagram.id)

        return storedState === undefined ? [] : [storedState]
      })

  return {
    ok: true,
    diagram: withPathCrossingStates(cleanedDiagram, pathCrossings),
    kind,
    state,
  }
}

export function cleanPathCrossingStates(
  diagram: Diagram,
  options: PathCrossingStateCleanupOptions = {},
): Diagram {
  if (diagram.pathCrossings === undefined) {
    return diagram
  }

  const pathCrossings = normalizePathCrossingStatesForDiagram(
    diagram,
    diagram.pathCrossings,
    options,
  )

  if (pathCrossingStateArraysEqual(diagram.pathCrossings, pathCrossings)) {
    return diagram
  }

  return withPathCrossingStates(diagram, pathCrossings)
}

export function normalizeLoadedPathCrossingStates(
  diagram: Diagram,
  savedPathCrossings: unknown,
): LoadedPathCrossingNormalization {
  if (savedPathCrossings === undefined) {
    return {
      warnings: [],
    }
  }

  if (!Array.isArray(savedPathCrossings)) {
    return {
      warnings: ['Saved path crossing states were ignored because they are not an array.'],
    }
  }

  if (diagram.ambientDimension !== 2) {
    return {
      warnings:
        savedPathCrossings.length === 0
          ? []
          : ['Saved path crossing states were ignored because braiding is 2D-only.'],
    }
  }

  const warnings: string[] = []
  const structurallyValidStates = savedPathCrossings.flatMap((value, index) => {
    const state = pathCrossingStateFromUnknown(value)

    if (state === null) {
      warnings.push(`Saved path crossing state ${index + 1} was ignored because it is malformed.`)
      return []
    }

    return [state]
  })
  const pathCrossings = normalizePathCrossingStatesForDiagram(
    diagram,
    structurallyValidStates,
  )

  if (pathCrossings.length < structurallyValidStates.length) {
    warnings.push('Saved stale path crossing states were removed.')
  }

  return {
    ...(pathCrossings.length === 0 ? {} : { pathCrossings }),
    warnings,
  }
}

export function normalizePathCrossingStatesForDiagram(
  diagram: Diagram,
  states: readonly PathCrossingState[],
  options: PathCrossingStateCleanupOptions = {},
): PathCrossingState[] {
  if (diagram.ambientDimension !== 2 || states.length === 0) {
    return []
  }

  const detection = pathIntersectionDetectionForDiagram(diagram)
  const candidates = detection.candidates
  const referenceValidStates = filterPathCrossingStatesForExisting2DCurves(
    states,
    diagram,
  )

  if (detection.status.capped) {
    return referenceValidStates
  }

  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  )
  const candidatesByPathPair = new Map<string, PathIntersectionCandidate[]>()

  candidates.forEach((candidate) => {
    const key = pathCrossingPairKey(candidate.pathAId, candidate.pathBId)
    const candidatesForPair = candidatesByPathPair.get(key)

    if (candidatesForPair === undefined) {
      candidatesByPathPair.set(key, [candidate])
      return
    }

    candidatesForPair.push(candidate)
  })

  const statesById = new Map<string, PathCrossingState>()
  const usedCandidateIds = new Set<string>()

  referenceValidStates.forEach((state) => {
    const candidate = candidatesById.get(state.id)

    if (
      candidate === undefined ||
      candidate.pathAId !== state.pathAId ||
      candidate.pathBId !== state.pathBId
    ) {
      if (!options.reconcileStalePathPairs) {
        return
      }

      const reconciledCandidate = reconcileStalePathCrossingCandidate(
        state,
        candidatesByPathPair,
        usedCandidateIds,
      )

      if (reconciledCandidate === null) {
        return
      }

      statesById.set(
        reconciledCandidate.id,
        pathCrossingStateFromCandidate(reconciledCandidate, state.kind),
      )
      usedCandidateIds.add(reconciledCandidate.id)
      return
    }

    statesById.set(
      state.id,
      pathCrossingStateFromCandidate(candidate, state.kind),
    )
    usedCandidateIds.add(candidate.id)
  })

  return candidates.flatMap((candidate) => {
    const state = statesById.get(candidate.id)

    return state === undefined ? [] : [state]
  })
}

export function filterPathCrossingStatesForExisting2DCurves(
  states: readonly PathCrossingState[],
  diagram: Diagram,
): PathCrossingState[] {
  if (diagram.ambientDimension !== 2) {
    return []
  }

  const eligibleCurveIds = new Set(
    diagram.strata.flatMap((stratum) =>
      stratum.geometricKind === 'curve' &&
      is2DPathLikeCurveForIntersections(stratum, diagram.ambientDimension)
        ? [stratum.id]
        : [],
    ),
  )

  return structurallyValidPathCrossingStates(states).filter(
    (state) =>
      state.pathAId !== state.pathBId &&
      eligibleCurveIds.has(state.pathAId) &&
      eligibleCurveIds.has(state.pathBId),
  )
}

function structurallyValidPathCrossingStates(
  states: readonly PathCrossingState[],
): PathCrossingState[] {
  return states.flatMap((state) =>
    isValidPathCrossingStateShape(state)
      ? [
          {
            id: state.id,
            pathAId: state.pathAId,
            pathBId: state.pathBId,
            point: cloneVec3(state.point),
            parameterA: state.parameterA,
            parameterB: state.parameterB,
            kind: state.kind,
          },
        ]
      : [],
  )
}

function reconcileStalePathCrossingCandidate(
  state: PathCrossingState,
  candidatesByPathPair: ReadonlyMap<string, readonly PathIntersectionCandidate[]>,
  usedCandidateIds: ReadonlySet<string>,
): PathIntersectionCandidate | null {
  const candidates = (
    candidatesByPathPair.get(pathCrossingPairKey(state.pathAId, state.pathBId)) ??
    []
  ).filter((candidate) => !usedCandidateIds.has(candidate.id))

  if (candidates.length === 0) {
    return null
  }

  if (candidates.length === 1) {
    return candidates[0] ?? null
  }

  const epsilonSquared =
    pathCrossingReconcileDistanceEpsilon *
    pathCrossingReconcileDistanceEpsilon
  const nearbyCandidates = candidates
    .map((candidate) => ({
      candidate,
      distanceSquared: distanceSquaredVec3(candidate.point, state.point),
    }))
    .filter(({ distanceSquared }) => distanceSquared <= epsilonSquared)
    .sort((first, second) => first.distanceSquared - second.distanceSquared)

  if (nearbyCandidates.length === 1) {
    return nearbyCandidates[0]?.candidate ?? null
  }

  return null
}

function pathCrossingPairKey(pathAId: string, pathBId: string): string {
  return `${pathAId}\u0000${pathBId}`
}

export function pathCrossingStatusMessage(
  state: PathCrossingState,
): string {
  switch (state.kind) {
    case 'none':
      return `Crossing ${state.pathAId} with ${state.pathBId}: no braiding.`
    case 'braiding':
      return `Crossing ${state.pathAId} with ${state.pathBId}: braiding, ${state.pathAId} over ${state.pathBId}.`
    case 'antiBraiding':
      return `Crossing ${state.pathAId} with ${state.pathBId}: anti-braiding, ${state.pathBId} over ${state.pathAId}.`
  }
}

function pathCrossingStateFromUnknown(
  value: unknown,
): PathCrossingState | null {
  if (!isRecord(value)) {
    return null
  }

  const { id, pathAId, pathBId, point, parameterA, parameterB, kind } = value

  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    typeof pathAId !== 'string' ||
    pathAId.trim().length === 0 ||
    typeof pathBId !== 'string' ||
    pathBId.trim().length === 0 ||
    !isFiniteVec3Record(point) ||
    typeof parameterA !== 'number' ||
    !Number.isFinite(parameterA) ||
    typeof parameterB !== 'number' ||
    !Number.isFinite(parameterB) ||
    !isCrossingKind(kind)
  ) {
    return null
  }

  return {
    id,
    pathAId,
    pathBId,
    point: cloneVec3(point),
    parameterA,
    parameterB,
    kind,
  }
}

function isValidPathCrossingStateShape(
  state: PathCrossingState,
): boolean {
  return (
    typeof state.id === 'string' &&
    state.id.trim().length > 0 &&
    typeof state.pathAId === 'string' &&
    state.pathAId.trim().length > 0 &&
    typeof state.pathBId === 'string' &&
    state.pathBId.trim().length > 0 &&
    isFiniteVec3Record(state.point) &&
    state.point.z === 0 &&
    Number.isFinite(state.parameterA) &&
    Number.isFinite(state.parameterB) &&
    isCrossingKind(state.kind)
  )
}

function withPathCrossingStates(
  diagram: Diagram,
  pathCrossings: PathCrossingState[],
): Diagram {
  const { pathCrossings: _pathCrossings, ...diagramWithoutPathCrossings } = diagram

  return pathCrossings.length === 0
    ? diagramWithoutPathCrossings
    : {
        ...diagramWithoutPathCrossings,
        pathCrossings,
      }
}

function pathCrossingStateArraysEqual(
  first: readonly PathCrossingState[] | undefined,
  second: readonly PathCrossingState[],
): boolean {
  if (first === undefined) {
    return second.length === 0
  }

  return JSON.stringify(first) === JSON.stringify(second)
}

function cloneVec3(point: Vec3): Vec3 {
  return { x: point.x, y: point.y, z: point.z }
}

function distanceSquaredVec3(first: Vec3, second: Vec3): number {
  const dx = first.x - second.x
  const dy = first.y - second.y
  const dz = first.z - second.z

  return dx * dx + dy * dy + dz * dz
}

function isFiniteVec3Record(value: unknown): value is Vec3 {
  return (
    isRecord(value) &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
