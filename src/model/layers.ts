import type { Diagram, DiagramLayer, Stratum, TextLabel } from './types.ts'

export type DiagramLayerElement =
  | { kind: 'stratum'; element: Stratum }
  | { kind: 'label'; element: TextLabel }

export type LayerMetadataNormalizationResult = {
  layers: DiagramLayer[]
  warnings: string[]
  errors: string[]
}

export function normalizeLayerValue(layer: number): number {
  return Object.is(layer, -0) ? 0 : layer
}

export function formatLayerValue(layer: number): string {
  const normalizedLayer = normalizeLayerValue(layer)

  return String(normalizedLayer)
}

export function defaultLayerName(value: number): string {
  return `Layer ${formatLayerValue(value)}`
}

export function getUsedLayerValues(diagram: Diagram): number[] {
  const layers = [
    ...diagram.strata.map((stratum) => stratum.layer),
    ...diagram.labels.map((label) => label.layer),
  ]
    .filter(Number.isFinite)
    .map(normalizeLayerValue)

  return [...new Set(layers)].sort((left, right) => left - right)
}

export function countElementsByLayer(diagram: Diagram): Map<number, number> {
  const counts = new Map<number, number>()

  for (const element of [...diagram.strata, ...diagram.labels]) {
    if (!Number.isFinite(element.layer)) {
      continue
    }

    const layer = normalizeLayerValue(element.layer)
    counts.set(layer, (counts.get(layer) ?? 0) + 1)
  }

  return counts
}

export function elementsOnLayer(
  diagram: Diagram,
  layerValue: number,
): DiagramLayerElement[] {
  if (!Number.isFinite(layerValue)) {
    return []
  }

  const normalizedLayer = normalizeLayerValue(layerValue)

  return [
    ...diagram.strata
      .filter(
        (stratum) =>
          Number.isFinite(stratum.layer) &&
          normalizeLayerValue(stratum.layer) === normalizedLayer,
      )
      .map((stratum) => ({ kind: 'stratum' as const, element: stratum })),
    ...diagram.labels
      .filter(
        (label) =>
          Number.isFinite(label.layer) &&
          normalizeLayerValue(label.layer) === normalizedLayer,
      )
      .map((label) => ({ kind: 'label' as const, element: label })),
  ]
}

export function getLayerMetadata(diagram: Diagram): DiagramLayer[] {
  return normalizeLayerMetadataForDiagram(diagram).layers
}

export function ensureLayerMetadata(diagram: Diagram): Diagram {
  return {
    ...diagram,
    layers: getLayerMetadata(diagram),
  }
}

export function renameLayer(
  diagram: Diagram,
  layerValue: number,
  rawName: string,
): Diagram {
  const value = normalizedFiniteLayerValue(layerValue, 'layerValue')
  const nextName = safeLayerName(rawName, value)

  return {
    ...diagram,
    layers: layerMetadataIncluding(diagram, [value]).map((layer) =>
      layer.value === value ? { ...layer, name: nextName } : layer,
    ),
  }
}

export function swapLayers(
  diagram: Diagram,
  leftLayerValue: number,
  rightLayerValue: number,
): Diagram {
  const leftLayer = normalizedFiniteLayerValue(leftLayerValue, 'leftLayerValue')
  const rightLayer = normalizedFiniteLayerValue(
    rightLayerValue,
    'rightLayerValue',
  )

  if (leftLayer === rightLayer) {
    return diagram
  }

  const layerNameByValue = new Map(
    layerMetadataIncluding(diagram, [leftLayer, rightLayer]).map((layer) => [
      layer.value,
      layer.name,
    ]),
  )
  const layers = layerMetadataIncluding(diagram, [leftLayer, rightLayer]).map(
    (layer) => {
      if (layer.value === leftLayer) {
        return {
          ...layer,
          name: layerNameByValue.get(rightLayer) ?? defaultLayerName(rightLayer),
        }
      }

      if (layer.value === rightLayer) {
        return {
          ...layer,
          name: layerNameByValue.get(leftLayer) ?? defaultLayerName(leftLayer),
        }
      }

      return layer
    },
  )

  return {
    ...diagram,
    layers,
    strata: diagram.strata.map((stratum) =>
      swapElementLayer(stratum, leftLayer, rightLayer),
    ),
    labels: diagram.labels.map((label) =>
      swapElementLayer(label, leftLayer, rightLayer),
    ),
  }
}

export function normalizeLayerMetadataForDiagram(
  diagram: Diagram,
): LayerMetadataNormalizationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const layers: DiagramLayer[] = []
  const seen = new Set<number>()

  if (diagram.layers !== undefined) {
    diagram.layers.forEach((layer, index) => {
      if (!isRecord(layer)) {
        errors.push(`layers[${index}] must be a layer metadata object.`)
        return
      }

      if (
        typeof layer.value !== 'number' ||
        !Number.isFinite(layer.value)
      ) {
        errors.push(`layers[${index}].value must be a finite number.`)
        return
      }

      const value = normalizeLayerValue(layer.value)

      if (seen.has(value)) {
        warnings.push(
          `Duplicate metadata for layer ${formatLayerValue(
            value,
          )}; keeping the first name.`,
        )
        return
      }

      seen.add(value)
      layers.push({
        value,
        name: normalizedLayerName(layer.name, value, index, warnings),
      })
    })
  }

  for (const usedLayer of getUsedLayerValues(diagram)) {
    if (seen.has(usedLayer)) {
      continue
    }

    seen.add(usedLayer)
    layers.push({
      value: usedLayer,
      name: defaultLayerName(usedLayer),
    })
  }

  return {
    layers: layers.sort((left, right) => left.value - right.value),
    warnings,
    errors,
  }
}

function normalizedLayerName(
  rawName: unknown,
  value: number,
  index: number,
  warnings: string[],
): string {
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    const name = defaultLayerName(value)
    warnings.push(`layers[${index}].name is blank; using "${name}".`)
    return name
  }

  return rawName
}

function layerMetadataIncluding(
  diagram: Diagram,
  layerValues: number[],
): DiagramLayer[] {
  const layerByValue = new Map<number, DiagramLayer>()

  for (const layer of getLayerMetadata(diagram)) {
    layerByValue.set(layer.value, layer)
  }

  for (const value of layerValues) {
    const normalizedValue = normalizedFiniteLayerValue(value, 'layerValue')

    if (!layerByValue.has(normalizedValue)) {
      layerByValue.set(normalizedValue, {
        value: normalizedValue,
        name: defaultLayerName(normalizedValue),
      })
    }
  }

  return [...layerByValue.values()].sort((left, right) => left.value - right.value)
}

function safeLayerName(rawName: string, value: number): string {
  return rawName.trim().length === 0 ? defaultLayerName(value) : rawName
}

function normalizedFiniteLayerValue(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`)
  }

  return normalizeLayerValue(value)
}

function swapElementLayer<T extends { layer: number }>(
  element: T,
  leftLayer: number,
  rightLayer: number,
): T {
  const layer = normalizeLayerValue(element.layer)

  if (layer === leftLayer) {
    return {
      ...element,
      layer: rightLayer,
    }
  }

  if (layer === rightLayer) {
    return {
      ...element,
      layer: leftLayer,
    }
  }

  return element
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
