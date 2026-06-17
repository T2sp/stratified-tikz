import type {
  ClosedPathBoundary,
  CurveStyleSegment,
  CurveStratum,
  CubicBezierControlMode,
  CurvedSheetPrimitive,
  Diagram,
  DiagramLayer,
  PathSegment,
  PathTemplate,
  PolygonSheetStratum,
  QuadSheetStratum,
  RegionStratum,
  SheetStratum,
  Stratum,
  TextLabel,
  Vec3,
  WorkPlaneFrameSnapshot,
} from './types.ts'

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

export type LayerTranslationVector = Vec3

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
): number {
  const sourceLayer = normalizedFiniteLayerValue(
    sourceLayerValue,
    'sourceLayerValue',
  )
  const usedLayers = new Set(
    getLayerMetadata(diagram).map((layer) => layer.value),
  )
  let candidate = normalizeLayerValue(sourceLayer + 1)

  while (usedLayers.has(candidate)) {
    candidate = normalizeLayerValue(candidate + 1)
  }

  return candidate
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
      ? nextUnusedLayerValue(diagram, sourceLayer)
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

  const topLevelIdAllocator = createUniqueIdAllocator(topLevelElementIds(diagram))
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

  if (
    !hadMetadata &&
    strata.length === diagram.strata.length &&
    labels.length === diagram.labels.length
  ) {
    return diagram
  }

  return {
    ...diagram,
    strata,
    labels,
    layers: metadata.filter((candidate) => candidate.value !== layer),
  }
}

export function translateLayer(
  diagram: Diagram,
  layerValue: number,
  translation: LayerTranslationVector,
): Diagram {
  const layer = normalizedFiniteLayerValue(layerValue, 'layerValue')
  const normalizedTranslation = normalizeLayerTranslationForDiagram(
    diagram,
    translation,
  )

  if (isZeroVector(normalizedTranslation)) {
    return diagram
  }

  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (!elementIsOnLayer(stratum, layer)) {
      return stratum
    }

    const translated = translateStratum(stratum, normalizedTranslation, diagram)
    changed = changed || translated !== stratum
    return translated
  })
  const labels = diagram.labels.map((label) => {
    if (!elementIsOnLayer(label, layer)) {
      return label
    }

    changed = true
    return {
      ...label,
      position: translateVec3(label.position, normalizedTranslation, diagram),
    }
  })

  return changed
    ? {
        ...diagram,
        strata,
        labels,
      }
    : diagram
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

function normalizeLayerTranslationForDiagram(
  diagram: Diagram,
  translation: LayerTranslationVector,
): LayerTranslationVector {
  if (!isFiniteVec3(translation)) {
    throw new Error('translation must contain finite dx, dy, and dz values.')
  }

  if (diagram.ambientDimension === 2 && translation.z !== 0) {
    throw new Error('2D layer translation does not allow dz.')
  }

  return diagram.ambientDimension === 2
    ? { x: translation.x, y: translation.y, z: 0 }
    : { ...translation }
}

function translateStratum(
  stratum: Stratum,
  translation: LayerTranslationVector,
  diagram: Diagram,
): Stratum {
  switch (stratum.geometricKind) {
    case 'region':
      return translateRegionStratum(stratum, translation, diagram)
    case 'sheet':
      return translateSheetStratum(stratum, translation, diagram)
    case 'curve':
      return translateCurveStratum(stratum, translation, diagram)
    case 'point':
      return {
        ...stratum,
        position: translateVec3(stratum.position, translation, diagram),
      }
  }
}

function translateRegionStratum(
  stratum: RegionStratum,
  translation: LayerTranslationVector,
  diagram: Diagram,
): RegionStratum {
  if (stratum.kind !== 'filledRegion') {
    return stratum
  }

  return {
    ...stratum,
    boundaries: translateClosedPathBoundaries(
      stratum.boundaries,
      translation,
      diagram,
    ),
  }
}

function translateSheetStratum(
  stratum: SheetStratum,
  translation: LayerTranslationVector,
  diagram: Diagram,
): SheetStratum {
  switch (stratum.kind) {
    case 'quadSheet':
      return {
        ...stratum,
        corners: stratum.corners.map((corner) =>
          translateVec3(corner, translation, diagram),
        ) as QuadSheetStratum['corners'],
      }
    case 'polygonSheet':
      return {
        ...stratum,
        vertices: stratum.vertices.map((vertex) =>
          translateVec3(vertex, translation, diagram),
        ),
      }
    case 'workPlaneFilledSheet':
      return {
        ...stratum,
        planeFrame: translateFrameOrigin(
          stratum.planeFrame,
          translation,
          diagram,
        ),
        boundaries: translateClosedPathBoundaries(
          stratum.boundaries,
          translation,
          diagram,
        ),
      }
    case 'curvedSheet':
      return {
        ...stratum,
        primitive: translateCurvedSheetPrimitive(
          stratum.primitive,
          translation,
          diagram,
        ),
      }
  }
}

function translateCurveStratum(
  stratum: CurveStratum,
  translation: LayerTranslationVector,
  diagram: Diagram,
): CurveStratum {
  switch (stratum.kind) {
    case 'polyline':
      return {
        ...stratum,
        points: stratum.points.map((point) =>
          translateVec3(point, translation, diagram),
        ),
      }
    case 'cubicBezier':
      return {
        ...stratum,
        points: stratum.points.map((point) =>
          translateVec3(point, translation, diagram),
        ),
        ...(stratum.bezierControls === undefined
          ? {}
          : {
              bezierControls: translateCubicBezierControlMode(
                stratum.bezierControls,
                translation,
                diagram,
              ),
            }),
      }
    case 'concatenatedPath':
      return {
        ...stratum,
        segments: stratum.segments.map((segment) =>
          translatePathSegment(segment, translation, diagram),
        ),
      }
    case 'templatePath':
      return {
        ...stratum,
        template: translatePathTemplate(stratum.template, translation, diagram),
      }
  }
}

function translateClosedPathBoundaries(
  boundaries: readonly ClosedPathBoundary[],
  translation: LayerTranslationVector,
  diagram: Diagram,
): ClosedPathBoundary[] {
  return boundaries.map((boundary) => ({
    ...boundary,
    segments: boundary.segments.map((segment) =>
      translatePathSegment(segment, translation, diagram),
    ),
  }))
}

function translatePathSegment(
  segment: PathSegment,
  translation: LayerTranslationVector,
  diagram: Diagram,
): PathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        ...segment,
        start: translateVec3(segment.start, translation, diagram),
        end: translateVec3(segment.end, translation, diagram),
      }
    case 'cubicBezier':
      return {
        ...segment,
        start: translateVec3(segment.start, translation, diagram),
        control1: translateVec3(segment.control1, translation, diagram),
        control2: translateVec3(segment.control2, translation, diagram),
        end: translateVec3(segment.end, translation, diagram),
        ...(segment.controlMode === undefined
          ? {}
          : {
              controlMode: translateCubicBezierControlMode(
                segment.controlMode,
                translation,
                diagram,
              ),
            }),
      }
    case 'arc':
      return {
        ...segment,
        start: translateVec3(segment.start, translation, diagram),
        end: translateVec3(segment.end, translation, diagram),
        center: translateVec3(segment.center, translation, diagram),
        ...(segment.frame === undefined
          ? {}
          : {
              frame: translateFrameOrigin(
                segment.frame,
                translation,
                diagram,
              ),
            }),
      }
  }
}

function translatePathTemplate(
  template: PathTemplate,
  translation: LayerTranslationVector,
  diagram: Diagram,
): PathTemplate {
  switch (template.kind) {
    case 'circleTemplate':
      return {
        ...template,
        center: translateVec3(template.center, translation, diagram),
        ...(template.frame === undefined
          ? {}
          : {
              frame: translateFrameOrigin(
                template.frame,
                translation,
                diagram,
              ),
            }),
      }
    case 'ellipseTemplate':
      return {
        ...template,
        center: translateVec3(template.center, translation, diagram),
        ...(template.frame === undefined
          ? {}
          : {
              frame: translateFrameOrigin(
                template.frame,
                translation,
                diagram,
              ),
            }),
      }
  }
}

function translateCubicBezierControlMode(
  controlMode: CubicBezierControlMode,
  translation: LayerTranslationVector,
  diagram: Diagram,
): CubicBezierControlMode {
  switch (controlMode.kind) {
    case 'absolute':
    case 'relativeCartesian':
    case 'relativePolar':
      return controlMode
    case 'workPlaneRelativeCartesian':
      return {
        ...controlMode,
        frame: translateFrameOrigin(controlMode.frame, translation, diagram),
      }
    case 'workPlaneRelativePolar':
      return {
        ...controlMode,
        frame: translateFrameOrigin(controlMode.frame, translation, diagram),
      }
  }
}

function translateCurvedSheetPrimitive(
  primitive: CurvedSheetPrimitive,
  translation: LayerTranslationVector,
  diagram: Diagram,
): CurvedSheetPrimitive {
  switch (primitive.kind) {
    case 'hemisphere':
      return {
        ...primitive,
        center: translateVec3(primitive.center, translation, diagram),
        frame: translateFrameOrigin(primitive.frame, translation, diagram),
      }
    case 'saddle':
      return {
        ...primitive,
        frame: translateFrameOrigin(primitive.frame, translation, diagram),
      }
  }
}

function translateFrameOrigin(
  frame: WorkPlaneFrameSnapshot,
  translation: LayerTranslationVector,
  diagram: Diagram,
): WorkPlaneFrameSnapshot {
  return {
    origin: translateVec3(frame.origin, translation, diagram),
    u: { ...frame.u },
    v: { ...frame.v },
    normal: { ...frame.normal },
  }
}

function translateVec3(
  point: Vec3,
  translation: LayerTranslationVector,
  diagram: Diagram,
): Vec3 {
  const translated = {
    x: point.x + translation.x,
    y: point.y + translation.y,
    z: diagram.ambientDimension === 2 ? 0 : point.z + translation.z,
  }

  if (!isFiniteVec3(translated)) {
    throw new Error('Layer translation would create a non-finite coordinate.')
  }

  return translated
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function isZeroVector(point: Vec3): boolean {
  return point.x === 0 && point.y === 0 && point.z === 0
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

function topLevelElementIds(diagram: Diagram): string[] {
  return [
    ...diagram.strata.map((stratum) => stratum.id),
    ...diagram.labels.map((label) => label.id),
  ]
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

function createUniqueIdAllocator(initialIds: string[]): UniqueIdAllocator {
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
        candidate.kind === 'templatePath'
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
