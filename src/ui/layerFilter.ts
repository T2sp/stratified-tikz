import type { Diagram, Stratum, TextLabel } from '../model/types'
import {
  getUsedLayerValues,
  isLayerLocked,
  isLayerVisible,
} from '../model/layers.ts'
import {
  findSelectedElement,
  normalizeSelectedElement,
  selectedElementFromElements,
  selectedElements,
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

export function layerFilterAndVisibilityIncludeLayer(
  diagram: Diagram,
  filter: LayerFilter,
  layer: number,
): boolean {
  return layerFilterIncludesLayer(filter, layer) && isLayerVisible(diagram, layer)
}

export function isLayerSelectableByLayerFilter(
  diagram: Diagram,
  filter: LayerFilter,
  layer: number,
): boolean {
  return (
    layerFilterAndVisibilityIncludeLayer(diagram, filter, layer) &&
    !isLayerLocked(diagram, layer)
  )
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

export function isStratumSelectableInEditor(
  diagram: Diagram,
  stratum: Stratum,
  filter: LayerFilter,
): boolean {
  return isLayerSelectableByLayerFilter(diagram, filter, stratum.layer)
}

export function isTextLabelSelectableInEditor(
  diagram: Diagram,
  label: TextLabel,
  filter: LayerFilter,
): boolean {
  return isLayerSelectableByLayerFilter(diagram, filter, label.layer)
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
  if (selection === null) {
    return true
  }

  const elements = selectedElements(selection)

  if (elements.length === 0) {
    return false
  }

  return elements.every((element) => {
    const selected = findSelectedElement(diagram, element)

    if (selected === null) {
      return false
    }

    return selected.kind === 'stratum'
      ? isStratumSelectableInEditor(diagram, selected.element, filter)
      : isTextLabelSelectableInEditor(diagram, selected.element, filter)
  })
}

export function clearSelectionForLayerFilter(
  diagram: Diagram,
  selection: SelectedElement,
  filter: LayerFilter,
): SelectedElement {
  if (selection === null) {
    return null
  }

  return normalizeSelectedElement(
    diagram,
    selectedElementFromElements(
      selectedElements(selection).filter((element) => {
        const selected = findSelectedElement(diagram, element)

        if (selected === null) {
          return false
        }

        return selected.kind === 'stratum'
          ? isStratumSelectableInEditor(diagram, selected.element, filter)
          : isTextLabelSelectableInEditor(diagram, selected.element, filter)
      }),
    ),
  )
}
