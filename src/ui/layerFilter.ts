import type { Diagram, Stratum, TextLabel } from '../model/types'
import { getUsedLayerValues } from '../model/layers.ts'
import {
  findSelectedElement,
  type SelectedElement,
} from './selection.ts'

export type LayerFilter =
  | { kind: 'all' }
  | { kind: 'layer'; layer: number }

export const allLayersFilter: LayerFilter = { kind: 'all' }

export function deriveAvailableLayers(diagram: Diagram): number[] {
  return getUsedLayerValues(diagram)
}

export function layerFilterIncludesLayer(
  filter: LayerFilter,
  layer: number,
): boolean {
  return filter.kind === 'all' || filter.layer === layer
}

export function isStratumSelectableByLayerFilter(
  stratum: Stratum,
  filter: LayerFilter,
): boolean {
  return layerFilterIncludesLayer(filter, stratum.layer)
}

export function isTextLabelSelectableByLayerFilter(
  label: TextLabel,
  filter: LayerFilter,
): boolean {
  return layerFilterIncludesLayer(filter, label.layer)
}

export function normalizeLayerFilterForDiagram(
  diagram: Diagram,
  filter: LayerFilter,
): LayerFilter {
  if (filter.kind === 'all') {
    return filter
  }

  return deriveAvailableLayers(diagram).includes(filter.layer)
    ? filter
    : allLayersFilter
}

export function isSelectionCompatibleWithLayerFilter(
  diagram: Diagram,
  selection: SelectedElement,
  filter: LayerFilter,
): boolean {
  const selected = findSelectedElement(diagram, selection)

  if (selected === null) {
    return selection === null
  }

  return selected.kind === 'stratum'
    ? isStratumSelectableByLayerFilter(selected.element, filter)
    : isTextLabelSelectableByLayerFilter(selected.element, filter)
}

export function clearSelectionForLayerFilter(
  diagram: Diagram,
  selection: SelectedElement,
  filter: LayerFilter,
): SelectedElement {
  return isSelectionCompatibleWithLayerFilter(diagram, selection, filter)
    ? selection
    : null
}
