import type { DiagramLayer } from '../model/types.ts'

export function nextLayerManagerExpandedState(expanded: boolean): boolean {
  return !expanded
}

export function shouldShowLayerManagerDetails(
  expanded: boolean,
  layerCount: number,
): boolean {
  return expanded && layerCount > 0
}

export function layerManagerSummary(
  layers: readonly DiagramLayer[],
  counts: ReadonlyMap<number, number>,
): string {
  const layerCount = layers.length
  const elementCount = layers.reduce(
    (total, layer) => total + (counts.get(layer.value) ?? 0),
    0,
  )

  return `${layerCount} ${layerCount === 1 ? 'layer' : 'layers'}, ${elementCount} ${
    elementCount === 1 ? 'element' : 'elements'
  }`
}
