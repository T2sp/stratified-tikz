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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
