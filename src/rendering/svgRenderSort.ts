import type { ProjectedSurfaceFace } from './projectedPrimitives.ts'

export type SvgRenderItemKind =
  | 'surfaceFace'
  | 'region'
  | 'sheet'
  | 'curve'
  | 'point'
  | 'label'

export type SvgRenderableSortItem = {
  id: string
  layer: number
  renderKind: SvgRenderItemKind
  stableIndex: number
  surfaceFace?: ProjectedSurfaceFace
  surfaceSortIndex?: number
}

export type SvgRenderSortKey = {
  layer: number
  categoryRank: number
  surfaceDepthOrder: number
  id: string
  stableIndex: number
  kindRank: number
}

// SVG render order uses one total sort key:
// layer -> surface/non-surface category -> sorted surface face order -> id ->
// stable emission index. This avoids non-transitive mixed surface/non-surface
// comparisons while keeping curves, points, and labels above sorted surfaces.
export function compareSvgRenderItems(
  left: SvgRenderableSortItem,
  right: SvgRenderableSortItem,
): number {
  const leftKey = svgRenderSortKey(left)
  const rightKey = svgRenderSortKey(right)

  return (
    compareNumbers(leftKey.layer, rightKey.layer) ||
    compareNumbers(leftKey.categoryRank, rightKey.categoryRank) ||
    compareNumbers(leftKey.surfaceDepthOrder, rightKey.surfaceDepthOrder) ||
    leftKey.id.localeCompare(rightKey.id) ||
    compareNumbers(leftKey.stableIndex, rightKey.stableIndex) ||
    compareNumbers(leftKey.kindRank, rightKey.kindRank)
  )
}

export function svgRenderSortKey(
  item: SvgRenderableSortItem,
): SvgRenderSortKey {
  const isSortedSurfaceFace = item.renderKind === 'surfaceFace'

  return {
    layer: normalizedNumber(item.layer),
    categoryRank: isSortedSurfaceFace ? 0 : 1,
    surfaceDepthOrder: isSortedSurfaceFace
      ? normalizedIndex(item.surfaceSortIndex)
      : 0,
    id: item.id,
    stableIndex: normalizedIndex(item.stableIndex),
    kindRank: svgRenderItemKindRank(item.renderKind),
  }
}

function svgRenderItemKindRank(kind: SvgRenderItemKind): number {
  switch (kind) {
    case 'surfaceFace':
      return 0
    case 'region':
      return 1
    case 'sheet':
      return 2
    case 'curve':
      return 3
    case 'point':
      return 4
    case 'label':
      return 5
  }
}

function normalizedNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Object.is(value, -0) ? 0 : value
}

function normalizedIndex(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.trunc(value)
    : Number.MAX_SAFE_INTEGER
}

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0
}
