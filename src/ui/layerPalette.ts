import {
  countElementsByLayer,
  elementsOnLayer,
  formatLayerValue,
  getLayerMetadata,
  normalizeLayerValue,
} from '../model/layers.ts'
import type { Diagram, DiagramLayer } from '../model/types.ts'
import { allLayersFilter, type LayerFilter } from './layerFilter.ts'

export type LayerThumbnailMarkKind =
  | 'region'
  | 'sheet'
  | 'curve'
  | 'point'
  | 'label'

export type LayerThumbnailMark = {
  kind: LayerThumbnailMarkKind
  color: string
  opacity: number
}

export type LayerThumbnail = {
  marks: LayerThumbnailMark[]
  totalElementCount: number
  hiddenElementCount: number
}

export type LayerPaletteRow = {
  layer: DiagramLayer
  elementCount: number
  isCreationLayer: boolean
  isFilterActive: boolean
  thumbnail: LayerThumbnail
}

export type LayerDropSwap =
  | {
      ok: true
      leftLayerValue: number
      rightLayerValue: number
    }
  | {
      ok: false
    }

export const LAYER_DRAG_MIME = 'application/x-stratified-tikz-layer'

export type LayerDropSourceInput = {
  customPayload: string
  // Browser-compatible mirror payload; external drops can set it, so it is
  // never trusted as the source layer without active internal drag state.
  plainPayload: string
  draggedLayerValue: number | null
  validLayerValues: readonly number[]
}

export function nextLayerPaletteOpenState(open: boolean): boolean {
  return !open
}

export function parseLayerValueInput(value: string): number | null {
  if (value.trim().length === 0) {
    return null
  }

  const layer = Number(value)

  return Number.isFinite(layer) ? normalizeLayerValue(layer) : null
}

export function parseDraggedLayerValue(payload: string): number | null {
  const trimmedPayload = payload.trim()

  if (trimmedPayload.length === 0) {
    return null
  }

  const layer = Number(trimmedPayload)

  return Number.isFinite(layer) ? normalizeLayerValue(layer) : null
}

export function layerButtonLabel(
  creationLayerInput: string,
  totalLayerCount: number,
): string {
  const creationLayer = parseLayerValueInput(creationLayerInput)
  const layerLabel =
    creationLayer === null ? 'L?' : `L${formatLayerValue(creationLayer)}`

  return `${layerLabel} / ${totalLayerCount}`
}

export function layerButtonTitle(
  creationLayerInput: string,
  layers: readonly DiagramLayer[],
): string {
  const creationLayer = parseLayerValueInput(creationLayerInput)

  if (creationLayer === null) {
    return `New element layer is invalid. ${layers.length} total layers.`
  }

  const layerName = layers.find((layer) => layer.value === creationLayer)?.name
  const nameSuffix = layerName === undefined ? '' : `: ${layerName}`

  return `New elements: layer ${formatLayerValue(
    creationLayer,
  )}${nameSuffix}. ${layers.length} total layers.`
}

export function layerCreationInputForLayer(layerValue: number): string {
  return formatLayerValue(normalizeLayerValue(layerValue))
}

export function layerPaletteRows(
  diagram: Diagram,
  layerFilter: LayerFilter,
  creationLayerInput: string,
  maxThumbnailElements = 12,
): LayerPaletteRow[] {
  const layers = getLayerMetadata(diagram)
  const counts = countElementsByLayer(diagram)
  const creationLayer = parseLayerValueInput(creationLayerInput)
  const filterLayer =
    layerFilter.kind === 'layer'
      ? normalizeLayerValue(layerFilter.layer)
      : null

  return layers.map((layer) => ({
    layer,
    elementCount: counts.get(layer.value) ?? 0,
    isCreationLayer: creationLayer === layer.value,
    isFilterActive: filterLayer === layer.value,
    thumbnail: createLayerThumbnail(diagram, layer.value, maxThumbnailElements),
  }))
}

export function createLayerThumbnail(
  diagram: Diagram,
  layerValue: number,
  maxElements = 12,
): LayerThumbnail {
  const limit = Math.max(0, Math.floor(maxElements))
  const elements = elementsOnLayer(diagram, layerValue)
  const marks = elements.slice(0, limit).map((entry): LayerThumbnailMark => {
    if (entry.kind === 'label') {
      return {
        kind: 'label',
        color: entry.element.style.color,
        opacity: entry.element.style.opacity,
      }
    }

    const stratum = entry.element

    switch (stratum.geometricKind) {
      case 'region':
        return {
          kind: 'region',
          color: stratum.style.fillColor,
          opacity: stratum.style.fillOpacity,
        }
      case 'sheet':
        return {
          kind: 'sheet',
          color: stratum.style.fillColor,
          opacity: stratum.style.fillOpacity,
        }
      case 'curve':
        return {
          kind: 'curve',
          color: stratum.style.strokeColor,
          opacity: stratum.style.strokeOpacity,
        }
      case 'point':
        return {
          kind: 'point',
          color: stratum.style.color,
          opacity: stratum.style.opacity,
        }
    }
  })

  return {
    marks,
    totalElementCount: elements.length,
    hiddenElementCount: Math.max(0, elements.length - marks.length),
  }
}

export function selectedLayerActionTarget(
  layers: readonly DiagramLayer[],
  selectedLayerValue: number | null,
  creationLayerInput: string,
): number | null {
  if (
    selectedLayerValue !== null &&
    layers.some((layer) => layer.value === normalizeLayerValue(selectedLayerValue))
  ) {
    return normalizeLayerValue(selectedLayerValue)
  }

  const creationLayer = parseLayerValueInput(creationLayerInput)

  if (
    creationLayer !== null &&
    layers.some((layer) => layer.value === creationLayer)
  ) {
    return creationLayer
  }

  return layers[0]?.value ?? null
}

export function resolveLayerDropSwap(
  draggedLayerValue: number | null,
  targetLayerValue: number,
  validLayerValues?: readonly number[],
): LayerDropSwap {
  if (
    draggedLayerValue === null ||
    !Number.isFinite(draggedLayerValue) ||
    !Number.isFinite(targetLayerValue)
  ) {
    return { ok: false }
  }

  const leftLayerValue = normalizeLayerValue(draggedLayerValue)
  const rightLayerValue = normalizeLayerValue(targetLayerValue)
  const validLayerSet =
    validLayerValues === undefined
      ? null
      : normalizedValidLayerValueSet(validLayerValues)

  if (
    leftLayerValue === rightLayerValue ||
    (validLayerSet !== null &&
      (!validLayerSet.has(leftLayerValue) ||
        !validLayerSet.has(rightLayerValue)))
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    leftLayerValue,
    rightLayerValue,
  }
}

export function resolveLayerDropSource(
  input: LayerDropSourceInput,
): number | null {
  const validLayerSet = normalizedValidLayerValueSet(input.validLayerValues)

  if (input.customPayload.length > 0) {
    const customLayer = parseDraggedLayerValue(input.customPayload)

    return customLayer !== null && validLayerSet.has(customLayer)
      ? customLayer
      : null
  }

  const fallbackLayer = input.draggedLayerValue

  if (fallbackLayer === null || !Number.isFinite(fallbackLayer)) {
    return null
  }

  const normalizedFallbackLayer = normalizeLayerValue(fallbackLayer)

  return validLayerSet.has(normalizedFallbackLayer)
    ? normalizedFallbackLayer
    : null
}

export function layerFilterSelectValue(layerFilter: LayerFilter): string {
  return layerFilter.kind === 'all' ? 'all' : formatLayerValue(layerFilter.layer)
}

export function layerFilterFromSelectValue(value: string): LayerFilter {
  if (value === 'all') {
    return allLayersFilter
  }

  const layer = Number(value)

  return Number.isFinite(layer)
    ? { kind: 'layer', layer: normalizeLayerValue(layer) }
    : allLayersFilter
}

function normalizedValidLayerValueSet(
  layerValues: readonly number[],
): Set<number> {
  const validLayerSet = new Set<number>()

  for (const layerValue of layerValues) {
    if (Number.isFinite(layerValue)) {
      validLayerSet.add(normalizeLayerValue(layerValue))
    }
  }

  return validLayerSet
}
