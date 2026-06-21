import type { VisibilityOptions } from '../model/types.ts'
import {
  defaultVisibilityOptions,
  surfaceDepthSortEnabled,
} from '../model/visibility.ts'
import type { ProjectedSurfaceFace } from './projectedPrimitives.ts'

export function sortProjectedSurfaceFaces(
  faces: readonly ProjectedSurfaceFace[],
  options: VisibilityOptions = defaultVisibilityOptions,
): ProjectedSurfaceFace[] {
  const normalizedOptions = normalizedSurfaceDepthSortOptions(options)

  if (!surfaceDepthSortEnabled(normalizedOptions)) {
    return [...faces]
  }

  return [...faces].sort((left, right) =>
    compareProjectedSurfaceFaces(left, right, normalizedOptions),
  )
}

export function compareProjectedSurfaceFaces(
  left: ProjectedSurfaceFace,
  right: ProjectedSurfaceFace,
  options: VisibilityOptions = defaultVisibilityOptions,
): number {
  const normalizedOptions = normalizedSurfaceDepthSortOptions(options)
  const layerComparison = normalizedLayer(left.layer) - normalizedLayer(right.layer)

  if (normalizedOptions.sortMode === 'layerThenDepth' && layerComparison !== 0) {
    return layerComparison
  }

  const depthComparison = compareDepthFartherFirst(
    left.depth.avg,
    right.depth.avg,
    normalizedOptions.depthEpsilon,
  )

  if (depthComparison !== 0) {
    return depthComparison
  }

  if (normalizedOptions.sortMode === 'depthThenLayer' && layerComparison !== 0) {
    return layerComparison
  }

  return (
    left.originalIndex - right.originalIndex ||
    left.faceIndex - right.faceIndex ||
    left.sourceId.localeCompare(right.sourceId)
  )
}

function compareDepthFartherFirst(
  leftDepth: number,
  rightDepth: number,
  depthEpsilon: number,
): number {
  const delta = rightDepth - leftDepth

  return Math.abs(delta) <= depthEpsilon ? 0 : delta
}

function normalizedSurfaceDepthSortOptions(
  options: VisibilityOptions,
): VisibilityOptions {
  return {
    ...options,
    depthEpsilon:
      Number.isFinite(options.depthEpsilon) && options.depthEpsilon >= 0
        ? options.depthEpsilon
        : defaultVisibilityOptions.depthEpsilon,
  }
}

function normalizedLayer(layer: number): number {
  if (!Number.isFinite(layer)) {
    return 0
  }

  return Object.is(layer, -0) ? 0 : layer
}
