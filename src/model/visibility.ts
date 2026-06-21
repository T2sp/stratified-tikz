import { visibilitySortModes } from './types.ts'
import type {
  Diagram,
  VisibilityOptions,
  VisibilitySortMode,
} from './types.ts'

export const defaultVisibilityOptions: VisibilityOptions = {
  enabled: false,
  surfaceDepthSort: true,
  sortMode: 'layerThenDepth',
  depthEpsilon: 1e-9,
}

export function cloneVisibilityOptions(
  options: VisibilityOptions,
): VisibilityOptions {
  return {
    enabled: options.enabled,
    surfaceDepthSort: options.surfaceDepthSort,
    sortMode: options.sortMode,
    depthEpsilon: options.depthEpsilon,
  }
}

export function resolveVisibilityOptions(
  diagram: Diagram,
  options: VisibilityOptions | undefined,
): VisibilityOptions {
  return cloneVisibilityOptions(
    options ?? diagram.view?.visibility ?? defaultVisibilityOptions,
  )
}

export function surfaceDepthSortEnabled(options: VisibilityOptions): boolean {
  return options.enabled && options.surfaceDepthSort
}

export function visibilityOptionsEqual(
  left: VisibilityOptions,
  right: VisibilityOptions,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.surfaceDepthSort === right.surfaceDepthSort &&
    left.sortMode === right.sortMode &&
    left.depthEpsilon === right.depthEpsilon
  )
}

export function isVisibilitySortMode(
  value: string,
): value is VisibilitySortMode {
  return visibilitySortModes.includes(value as VisibilitySortMode)
}
