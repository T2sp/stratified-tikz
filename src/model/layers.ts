import type {
  ClosedPathBoundary,
  CurveStyleSegment,
  CurveStratum,
  Diagram,
  DiagramLayer,
  PolygonSheetStratum,
  Stratum,
  TextLabel,
  Vec3,
} from './types.ts'
import { cleanPathCrossingStates } from './pathCrossings.ts'
import { collectTopLevelDiagramIds } from './diagramIds.ts'
import { detachCoordinateReferencesInElements } from './coordinateReferences.ts'
import {
  diagramTranslationContext,
  isZeroTranslationVector,
  normalizeTranslationVectorForDiagram,
  translateStratum,
  translateTextLabel,
  translationVectorFromNumericVec3,
  type TranslationVector,
} from './translation.ts'

export type DiagramLayerElement =
  | { kind: 'stratum'; element: Stratum }
  | { kind: 'label'; element: TextLabel }

export type LayerMetadataNormalizationResult = {
  layers: DiagramLayer[]
  warnings: string[]
  errors: string[]
}

export type DuplicateLayerOptions = {
  targetLayerValue?: number
  targetLayerName?: string
}

export type DuplicateLayerIdChange = {
  sourceId: string
  copiedId: string
}

export type DuplicateLayerPathLabelChange = {
  sourcePathLabel: string
  copiedPathLabel: string
}

export type DuplicateLayerResult = {
  diagram: Diagram
  sourceLayer: number
  targetLayer: number
  duplicatedStrata: number
  duplicatedLabels: number
  idChanges: DuplicateLayerIdChange[]
  pathLabelChanges: DuplicateLayerPathLabelChange[]
}

export type MergeLayersResult = {
  diagram: Diagram
  sourceLayer: number
  targetLayer: number
  movedStrata: number
  movedLabels: number
}

export type LayerTranslationVector = Vec3 | TranslationVector

export type TranslateLayerResult = {
  diagram: Diagram
  layer: number
  translated: boolean
  detachedCoordinateReferenceCount: number
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

export function isLayerVisible(diagram: Diagram, layerValue: number): boolean {
  if (!Number.isFinite(layerValue)) {
    return false
  }

  const value = normalizeLayerValue(layerValue)
  const layer = getLayerMetadata(diagram).find(
    (candidate) => candidate.value === value,
  )

  return layer?.visible !== false
}

export function isLayerLocked(diagram: Diagram, layerValue: number): boolean {
  if (!Number.isFinite(layerValue)) {
    return false
  }

  const value = normalizeLayerValue(layerValue)
  const layer = getLayerMetadata(diagram).find(
    (candidate) => candidate.value === value,
  )

  return layer?.locked === true
}

export function setLayerVisibility(
  diagram: Diagram,
  layerValue: number,
  visible: boolean,
): Diagram {
  const value = normalizedFiniteLayerValue(layerValue, 'layerValue')

  return {
    ...diagram,
    layers: layerMetadataIncluding(diagram, [value]).map((layer) =>
      layer.value === value
        ? normalizedLayerState({ ...layer, visible })
        : layer,
    ),
  }
}

export function setLayerLock(
  diagram: Diagram,
  layerValue: number,
  locked: boolean,
): Diagram {
  const value = normalizedFiniteLayerValue(layerValue, 'layerValue')

  return {
    ...diagram,
    layers: layerMetadataIncluding(diagram, [value]).map((layer) =>
      layer.value === value
        ? normalizedLayerState({ ...layer, locked })
        : layer,
    ),
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

  const layerByValue = new Map(
    layerMetadataIncluding(diagram, [leftLayer, rightLayer]).map((layer) => [
      layer.value,
      layer,
    ]),
  )
  const layers = layerMetadataIncluding(diagram, [leftLayer, rightLayer]).map(
    (layer) => {
      if (layer.value === leftLayer) {
        return swappedLayerMetadata(
          layer,
          layerByValue.get(rightLayer),
          rightLayer,
        )
      }

      if (layer.value === rightLayer) {
        return swappedLayerMetadata(
          layer,
          layerByValue.get(leftLayer),
          leftLayer,
        )
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

export function nextUnusedLayerValue(
  diagram: Diagram,
  sourceLayerValue: number,
): number | null {
  const sourceLayer = normalizedFiniteLayerValue(
    sourceLayerValue,
    'sourceLayerValue',
  )
  const usedLayers = new Set(
    getLayerMetadata(diagram).map((layer) => layer.value),
  )
  let candidate = normalizeLayerValue(sourceLayer + 1)

  // JavaScript numbers stop progressing at large magnitudes: for example,
  // 2^53 + 1 === 2^53. Keep this search bounded and return null when no
  // finite, progressing default can be derived.
  if (candidate === sourceLayer) {
    return null
  }

  for (let attempt = 0; attempt <= usedLayers.size; attempt += 1) {
    if (!isAutomaticLayerDefault(candidate)) {
      return null
    }

    if (!usedLayers.has(candidate)) {
      return candidate
    }

    const next = normalizeLayerValue(candidate + 1)
    if (next === candidate || !isAutomaticLayerDefault(next)) {
      return null
    }

    candidate = next
  }

  return null
}

export function duplicateLayer(
  diagram: Diagram,
  sourceLayerValue: number,
  options: DuplicateLayerOptions = {},
): DuplicateLayerResult {
  const sourceLayer = normalizedFiniteLayerValue(
    sourceLayerValue,
    'sourceLayerValue',
  )
  const targetLayer =
    options.targetLayerValue === undefined
      ? defaultDuplicateTargetLayer(diagram, sourceLayer)
      : normalizedFiniteLayerValue(options.targetLayerValue, 'targetLayerValue')

  if (targetLayer === sourceLayer) {
    throw new Error('targetLayerValue must differ from sourceLayerValue.')
  }

  const sourceStrata = diagram.strata.filter((stratum) =>
    elementIsOnLayer(stratum, sourceLayer),
  )
  const sourceLabels = diagram.labels.filter((label) =>
    elementIsOnLayer(label, sourceLayer),
  )

  const unsupportedStratum = sourceStrata.find(
    (stratum) => !isSupportedStratumForLayerDuplicate(stratum),
  )

  if (unsupportedStratum !== undefined) {
    throw new Error(
      `Cannot duplicate unsupported stratum "${unsupportedStratum.id}".`,
    )
  }

  const topLevelIdAllocator = createUniqueIdAllocator(
    collectTopLevelDiagramIds(diagram),
  )
  const nestedIdAllocator = createUniqueIdAllocator(nestedObjectIds(diagram))
  const pathLabelAllocator = createPathLabelAllocator(diagram)
  const idChanges: DuplicateLayerIdChange[] = []
  const pathLabelChanges: DuplicateLayerPathLabelChange[] = []

  const copiedStrata = sourceStrata.map((stratum) =>
    duplicateStratumForLayer(
      stratum,
      targetLayer,
      topLevelIdAllocator,
      nestedIdAllocator,
      pathLabelAllocator,
      idChanges,
      pathLabelChanges,
    ),
  )
  const copiedLabels = sourceLabels.map((label) =>
    duplicateTextLabelForLayer(
      label,
      targetLayer,
      topLevelIdAllocator,
      idChanges,
    ),
  )
  const nextDiagram = {
    ...diagram,
    strata: [...diagram.strata, ...copiedStrata],
    labels: [...diagram.labels, ...copiedLabels],
    layers: layerMetadataForDuplicate(
      diagram,
      sourceLayer,
      targetLayer,
      options.targetLayerName,
    ),
  }

  return {
    diagram: nextDiagram,
    sourceLayer,
    targetLayer,
    duplicatedStrata: copiedStrata.length,
    duplicatedLabels: copiedLabels.length,
    idChanges,
    pathLabelChanges,
  }
}

export function deleteLayer(diagram: Diagram, layerValue: number): Diagram {
  const layer = normalizedFiniteLayerValue(layerValue, 'layerValue')
  const metadata = getLayerMetadata(diagram)
  const hadMetadata = metadata.some((candidate) => candidate.value === layer)
  const strata = diagram.strata.filter(
    (stratum) => !elementIsOnLayer(stratum, layer),
  )
  const labels = diagram.labels.filter((label) => !elementIsOnLayer(label, layer))
  const removedCurve = diagram.strata.some(
    (stratum) =>
      elementIsOnLayer(stratum, layer) && stratum.geometricKind === 'curve',
  )

  if (
    !hadMetadata &&
    strata.length === diagram.strata.length &&
    labels.length === diagram.labels.length
  ) {
    return diagram
  }

  const nextDiagram = {
    ...diagram,
    strata,
    labels,
    layers: metadata.filter((candidate) => candidate.value !== layer),
  }

  return removedCurve ? cleanPathCrossingStates(nextDiagram) : nextDiagram
}

export function mergeLayers(
  diagram: Diagram,
  sourceLayerValue: number,
  targetLayerValue: number,
): MergeLayersResult {
  const sourceLayer = normalizedFiniteLayerValue(
    sourceLayerValue,
    'sourceLayerValue',
  )
  const targetLayer = normalizedFiniteLayerValue(
    targetLayerValue,
    'targetLayerValue',
  )

  if (sourceLayer === targetLayer) {
    throw new Error('targetLayerValue must differ from sourceLayerValue.')
  }

  const existingLayerValues = new Set(
    getLayerMetadata(diagram).map((layer) => layer.value),
  )

  if (!existingLayerValues.has(sourceLayer)) {
    throw new Error('sourceLayerValue must refer to an existing layer.')
  }

  if (!existingLayerValues.has(targetLayer)) {
    throw new Error('targetLayerValue must refer to an existing layer.')
  }

  let movedStrata = 0
  let movedLabels = 0
  const strata = diagram.strata.map((stratum) => {
    if (!elementIsOnLayer(stratum, sourceLayer)) {
      return stratum
    }

    movedStrata += 1
    return {
      ...stratum,
      layer: targetLayer,
    }
  })
  const labels = diagram.labels.map((label) => {
    if (!elementIsOnLayer(label, sourceLayer)) {
      return label
    }

    movedLabels += 1
    return {
      ...label,
      layer: targetLayer,
    }
  })
  const metadata = layerMetadataIncluding(diagram, [targetLayer])
    .filter((layer) => layer.value !== sourceLayer)
    .sort((left, right) => left.value - right.value)

  const nextDiagram =
    movedStrata === 0 && movedLabels === 0
      ? {
          ...diagram,
          layers: metadata,
        }
      : cleanPathCrossingStates({
          ...diagram,
          strata,
          labels,
          layers: metadata,
        })

  return {
    diagram: nextDiagram,
    sourceLayer,
    targetLayer,
    movedStrata,
    movedLabels,
  }
}

export function translateLayer(
  diagram: Diagram,
  layerValue: number,
  translation: LayerTranslationVector,
): Diagram {
  return translateLayerWithResult(diagram, layerValue, translation).diagram
}

export function translateLayerWithResult(
  diagram: Diagram,
  layerValue: number,
  translation: LayerTranslationVector,
): TranslateLayerResult {
  const layer = normalizedFiniteLayerValue(layerValue, 'layerValue')
  const normalizedTranslation = isTranslationVector(translation)
    ? normalizeTranslationVectorForDiagram(
        diagram,
        translation,
        { reject2DNonZeroZ: true },
      )
    : translationVectorFromNumericVec3(
        diagram,
        translation,
        { reject2DNonZeroZ: true },
      )

  if (isZeroTranslationVector(normalizedTranslation)) {
    return {
      diagram,
      layer,
      translated: false,
      detachedCoordinateReferenceCount: 0,
    }
  }

  const layerElements = [
    ...diagram.strata
      .filter((stratum) => elementIsOnLayer(stratum, layer))
      .map((stratum) => ({ kind: 'stratum' as const, id: stratum.id })),
    ...diagram.labels
      .filter((label) => elementIsOnLayer(label, layer))
      .map((label) => ({ kind: 'label' as const, id: label.id })),
  ]
  const detached = detachCoordinateReferencesInElements(diagram, layerElements)

  if (!detached.ok) {
    throw new Error(
      `Could not translate layer ${formatLayerValue(layer)}: ${detached.error.path}: ${detached.error.message}`,
    )
  }

  const detachedDiagram = detached.value.diagram
  const context = diagramTranslationContext(detachedDiagram)
  let changed = false
  const strata = detachedDiagram.strata.map((stratum) => {
    if (!elementIsOnLayer(stratum, layer)) {
      return stratum
    }

    const translated = translateStratum(stratum, normalizedTranslation, context)
    changed = changed || translated !== stratum
    return translated
  })
  const labels = detachedDiagram.labels.map((label) => {
    if (!elementIsOnLayer(label, layer)) {
      return label
    }

    changed = true
    return translateTextLabel(label, normalizedTranslation, context)
  })

  if (!changed) {
    return {
      diagram,
      layer,
      translated: false,
      detachedCoordinateReferenceCount: 0,
    }
  }

  return {
    diagram: cleanPathCrossingStates({
      ...detachedDiagram,
      strata,
      labels,
    }),
    layer,
    translated: true,
    detachedCoordinateReferenceCount: detached.value.detachedCount,
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
      layers.push(
        normalizedLayerState({
          value,
          name: normalizedLayerName(layer.name, value, index, warnings),
          ...normalizedLayerVisibility(layer.visible, index, errors),
          ...normalizedLayerLock(layer.locked, index, errors),
        }),
      )
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

function normalizedLayerVisibility(
  rawVisible: unknown,
  index: number,
  errors: string[],
): Pick<DiagramLayer, 'visible'> {
  if (rawVisible === undefined) {
    return {}
  }

  if (typeof rawVisible !== 'boolean') {
    errors.push(`layers[${index}].visible must be a boolean when present.`)
    return {}
  }

  return rawVisible ? {} : { visible: false }
}

function normalizedLayerLock(
  rawLocked: unknown,
  index: number,
  errors: string[],
): Pick<DiagramLayer, 'locked'> {
  if (rawLocked === undefined) {
    return {}
  }

  if (typeof rawLocked !== 'boolean') {
    errors.push(`layers[${index}].locked must be a boolean when present.`)
    return {}
  }

  return rawLocked ? { locked: true } : {}
}

function normalizedLayerState(layer: DiagramLayer): DiagramLayer {
  return {
    value: layer.value,
    name: layer.name,
    ...(layer.visible === false ? { visible: false } : {}),
    ...(layer.locked === true ? { locked: true } : {}),
  }
}

function swappedLayerMetadata(
  target: DiagramLayer,
  source: DiagramLayer | undefined,
  sourceValue: number,
): DiagramLayer {
  return normalizedLayerState({
    value: target.value,
    name: source?.name ?? defaultLayerName(sourceValue),
    visible: source?.visible,
    locked: source?.locked,
  })
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

function defaultDuplicateTargetLayer(diagram: Diagram, sourceLayer: number): number {
  const targetLayer = nextUnusedLayerValue(diagram, sourceLayer)

  if (targetLayer === null) {
    throw new Error('No safe default target layer is available.')
  }

  return targetLayer
}

function isAutomaticLayerDefault(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER
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

function elementIsOnLayer(element: { layer: number }, layer: number): boolean {
  return (
    Number.isFinite(element.layer) &&
    normalizeLayerValue(element.layer) === layer
  )
}

function isTranslationVector(
  translation: LayerTranslationVector,
): translation is TranslationVector {
  return (
    isCoordinateComponent(translation.x) &&
    isCoordinateComponent(translation.y) &&
    isCoordinateComponent(translation.z)
  )
}

function isCoordinateComponent(value: unknown): value is TranslationVector['x'] {
  return (
    isRecord(value) &&
    (value.kind === 'numeric' || value.kind === 'symbolic')
  )
}

function layerMetadataForDuplicate(
  diagram: Diagram,
  sourceLayer: number,
  targetLayer: number,
  targetLayerName: string | undefined,
): DiagramLayer[] {
  const layers = layerMetadataIncluding(diagram, [sourceLayer])

  if (layers.some((layer) => layer.value === targetLayer)) {
    return layers
  }

  const sourceName =
    layers.find((layer) => layer.value === sourceLayer)?.name ??
    defaultLayerName(sourceLayer)

  return [
    ...layers,
    {
      value: targetLayer,
      name: safeLayerName(targetLayerName ?? `${sourceName} copy`, targetLayer),
    },
  ].sort((left, right) => left.value - right.value)
}

function duplicateStratumForLayer(
  stratum: Stratum,
  targetLayer: number,
  topLevelIdAllocator: UniqueIdAllocator,
  nestedIdAllocator: UniqueIdAllocator,
  pathLabelAllocator: PathLabelAllocator,
  idChanges: DuplicateLayerIdChange[],
  pathLabelChanges: DuplicateLayerPathLabelChange[],
): Stratum {
  const copied = cloneDiagramValue(stratum)
  const copiedId = topLevelIdAllocator.allocate(stratum.id)

  idChanges.push({ sourceId: stratum.id, copiedId })
  copied.id = copiedId
  copied.layer = targetLayer

  switch (copied.geometricKind) {
    case 'region':
      return duplicateRegionStratumNestedIds(copied, nestedIdAllocator)
    case 'sheet':
      return duplicateSheetStratumNestedData(
        copied,
        nestedIdAllocator,
        pathLabelAllocator,
        pathLabelChanges,
      )
    case 'curve':
      return duplicateCurveStratumNestedData(
        copied,
        nestedIdAllocator,
        pathLabelAllocator,
        pathLabelChanges,
      )
    case 'point':
      return copied
  }
}

function duplicateTextLabelForLayer(
  label: TextLabel,
  targetLayer: number,
  topLevelIdAllocator: UniqueIdAllocator,
  idChanges: DuplicateLayerIdChange[],
): TextLabel {
  const copied = cloneDiagramValue(label)
  const copiedId = topLevelIdAllocator.allocate(label.id)

  idChanges.push({ sourceId: label.id, copiedId })

  return {
    ...copied,
    id: copiedId,
    layer: targetLayer,
  }
}

function duplicateRegionStratumNestedIds(
  stratum: Extract<Stratum, { geometricKind: 'region' }>,
  nestedIdAllocator: UniqueIdAllocator,
): Extract<Stratum, { geometricKind: 'region' }> {
  if (stratum.kind === 'filledRegion') {
    return {
      ...stratum,
      boundaries: duplicateClosedPathBoundaries(
        stratum.boundaries,
        nestedIdAllocator,
      ),
    }
  }

  return stratum
}

function duplicateSheetStratumNestedData(
  stratum: Extract<Stratum, { geometricKind: 'sheet' }>,
  nestedIdAllocator: UniqueIdAllocator,
  pathLabelAllocator: PathLabelAllocator,
  pathLabelChanges: DuplicateLayerPathLabelChange[],
): Extract<Stratum, { geometricKind: 'sheet' }> {
  switch (stratum.kind) {
    case 'quadSheet':
    case 'curvedSheet':
      return stratum
    case 'polygonSheet':
      return duplicatePathLabel(stratum, pathLabelAllocator, pathLabelChanges)
    case 'workPlaneFilledSheet':
      return {
        ...stratum,
        boundaries: duplicateClosedPathBoundaries(
          stratum.boundaries,
          nestedIdAllocator,
        ),
      }
  }
}

function duplicateCurveStratumNestedData(
  stratum: CurveStratum,
  nestedIdAllocator: UniqueIdAllocator,
  pathLabelAllocator: PathLabelAllocator,
  pathLabelChanges: DuplicateLayerPathLabelChange[],
): CurveStratum {
  return duplicatePathLabel(
    {
      ...stratum,
      styleSegments: duplicateCurveStyleSegments(
        stratum.styleSegments,
        nestedIdAllocator,
      ),
    },
    pathLabelAllocator,
    pathLabelChanges,
  )
}

function duplicateClosedPathBoundaries(
  boundaries: ClosedPathBoundary[],
  nestedIdAllocator: UniqueIdAllocator,
): ClosedPathBoundary[] {
  return boundaries.map((boundary) => ({
    ...boundary,
    id: nestedIdAllocator.allocate(boundary.id),
  }))
}

function duplicateCurveStyleSegments(
  segments: CurveStyleSegment[],
  nestedIdAllocator: UniqueIdAllocator,
): CurveStyleSegment[] {
  return segments.map((segment) => ({
    ...segment,
    id: nestedIdAllocator.allocate(segment.id),
  }))
}

function duplicatePathLabel<
  T extends CurveStratum | PolygonSheetStratum,
>(
  stratum: T,
  pathLabelAllocator: PathLabelAllocator,
  pathLabelChanges: DuplicateLayerPathLabelChange[],
): T {
  if (stratum.pathLabel === undefined || stratum.pathLabel.trim().length === 0) {
    return stratum
  }

  const copiedPathLabel = pathLabelAllocator.allocate(stratum.pathLabel)
  pathLabelChanges.push({
    sourcePathLabel: stratum.pathLabel,
    copiedPathLabel,
  })

  return {
    ...stratum,
    pathLabel: copiedPathLabel,
  }
}

function nestedObjectIds(diagram: Diagram): string[] {
  return diagram.strata.flatMap((stratum) => {
    if (stratum.geometricKind === 'curve') {
      return stratum.styleSegments.map((segment) => segment.id)
    }

    if (stratum.geometricKind === 'region' && stratum.kind === 'filledRegion') {
      return stratum.boundaries.map((boundary) => boundary.id)
    }

    if (
      stratum.geometricKind === 'sheet' &&
      stratum.kind === 'workPlaneFilledSheet'
    ) {
      return stratum.boundaries.map((boundary) => boundary.id)
    }

    return []
  })
}

function createUniqueIdAllocator(initialIds: Iterable<string>): UniqueIdAllocator {
  const usedIds = new Set(initialIds)

  return {
    allocate(sourceId: string): string {
      const stem = sourceId.trim().length === 0 ? 'copy' : sourceId
      let candidate = `${stem}-copy`
      let suffix = 1

      while (usedIds.has(candidate)) {
        candidate = `${stem}-copy-${suffix}`
        suffix += 1
      }

      usedIds.add(candidate)
      return candidate
    },
  }
}

function createPathLabelAllocator(diagram: Diagram): PathLabelAllocator {
  const usedLabels = new Set(
    diagram.strata.flatMap((stratum) => {
      if (stratum.geometricKind === 'curve') {
        return pathLabelKeyValues(stratum.pathLabel)
      }

      if (stratum.geometricKind === 'sheet' && stratum.kind === 'polygonSheet') {
        return pathLabelKeyValues(stratum.pathLabel)
      }

      return []
    }),
  )

  return {
    allocate(sourcePathLabel: string): string {
      const stem = sourcePathLabel.trim()
      let candidate = `${stem} copy`
      let suffix = 2

      while (usedLabels.has(tikzSpathCollisionKey(candidate))) {
        candidate = `${stem} copy ${suffix}`
        suffix += 1
      }

      usedLabels.add(tikzSpathCollisionKey(candidate))
      return candidate
    },
  }
}

function pathLabelKeyValues(pathLabel: string | undefined): string[] {
  if (pathLabel === undefined || pathLabel.trim().length === 0) {
    return []
  }

  return [tikzSpathCollisionKey(pathLabel)]
}

function tikzSpathCollisionKey(pathLabel: string): string {
  const stem = tikzNameStemPart(pathLabel)
  const safeStem = stem.length === 0 ? 'savedPath' : stem

  return /^[a-zA-Z]/.test(safeStem) ? safeStem : `savedPath${safeStem}`
}

function tikzNameStemPart(value: string): string {
  let result = ''
  let capitalizeNext = false

  for (const character of value.trim()) {
    if (/^[a-zA-Z0-9]$/.test(character)) {
      result +=
        capitalizeNext && /^[a-z]$/.test(character)
          ? character.toUpperCase()
          : character
      capitalizeNext = false
      continue
    }

    if (result.length > 0) {
      capitalizeNext = true
    }
  }

  return result
}

function isSupportedStratumForLayerDuplicate(stratum: Stratum): boolean {
  const candidate = stratum as {
    geometricKind?: unknown
    kind?: unknown
  }

  switch (candidate.geometricKind) {
    case 'region':
      return (
        candidate.kind === undefined ||
        candidate.kind === 'ambientRegion' ||
        candidate.kind === 'filledRegion'
      )
    case 'sheet':
      return (
        candidate.kind === 'quadSheet' ||
        candidate.kind === 'polygonSheet' ||
        candidate.kind === 'workPlaneFilledSheet' ||
        candidate.kind === 'curvedSheet'
      )
    case 'curve':
      return (
        candidate.kind === 'polyline' ||
        candidate.kind === 'cubicBezier' ||
        candidate.kind === 'concatenatedPath' ||
        candidate.kind === 'templatePath' ||
        candidate.kind === 'grid'
      )
    case 'point':
      return true
    default:
      return false
  }
}

function cloneDiagramValue<T>(value: T): T {
  return structuredClone(value) as T
}

type UniqueIdAllocator = {
  allocate: (sourceId: string) => string
}

type PathLabelAllocator = {
  allocate: (sourcePathLabel: string) => string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
