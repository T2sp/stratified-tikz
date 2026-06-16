import type { Diagram, Vec3 } from '../model/types.ts'
import {
  existingCoordinateSourceKey,
  resolveExistingCoordinateSource,
  type ExistingCoordinateSource,
} from './coordinateSources.ts'
import type { WorkPlanePointPickingState } from './workPlaneControls.ts'

export type DirectCoordinateSourceHighlightInput = {
  source: ExistingCoordinateSource | null | undefined
  label?: string
}

export type CoordinateSourceHighlight =
  | {
      kind: 'directSource'
      id: string
      position: Vec3
      source: ExistingCoordinateSource
      label?: string
    }
  | {
      kind: 'workPlanePick'
      id: string
      position: Vec3
      pointId: string
      pickedIndex: number
      label: string
    }

export function createDirectCoordinateSourceHighlights(
  diagram: Diagram,
  inputs: readonly DirectCoordinateSourceHighlightInput[],
): CoordinateSourceHighlight[] {
  const highlightsBySource = new Map<string, CoordinateSourceHighlight>()

  for (const input of inputs) {
    if (input.source === null || input.source === undefined) {
      continue
    }

    const position = resolveExistingCoordinateSource(diagram, input.source)

    if (position === null) {
      continue
    }

    const sourceKey = existingCoordinateSourceKey(input.source)
    const existing = highlightsBySource.get(sourceKey)

    if (existing === undefined) {
      highlightsBySource.set(sourceKey, {
        kind: 'directSource',
        id: `direct-source:${sourceKey}`,
        position,
        source: input.source,
        label: input.label,
      })
      continue
    }

    if (existing.kind !== 'directSource' || input.label === undefined) {
      continue
    }

    existing.label = mergeHighlightLabels(existing.label, input.label)
  }

  return [...highlightsBySource.values()]
}

export function createWorkPlanePointPickingHighlights(
  diagram: Diagram,
  state: WorkPlanePointPickingState,
): CoordinateSourceHighlight[] {
  if (!state.active) {
    return []
  }

  return state.pickedPointIds.flatMap((pointId, index) => {
    const source: ExistingCoordinateSource = {
      kind: 'pointStratum',
      stratumId: pointId,
    }
    const position = resolveExistingCoordinateSource(diagram, source)

    if (position === null) {
      return []
    }

    const pickedIndex = index + 1

    return [
      {
        kind: 'workPlanePick',
        id: `work-plane-pick:${pointId}:${pickedIndex}`,
        position,
        pointId,
        pickedIndex,
        label: String(pickedIndex),
      },
    ]
  })
}

function mergeHighlightLabels(
  existing: string | undefined,
  next: string,
): string {
  if (existing === undefined || existing.length === 0) {
    return next
  }

  if (existing.split(', ').includes(next)) {
    return existing
  }

  return `${existing}, ${next}`
}
