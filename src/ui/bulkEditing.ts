import {
  arrowHeadKinds,
  endpointArrowModes,
  labelAnchors,
  lineStyles,
  midArrowDirections,
  pointFills,
  pointShapes,
} from '../model/types.ts'
import { ensureLayerMetadata, formatLayerValue, normalizeLayerValue } from '../model/layers.ts'
import {
  cleanPathCrossingStates,
} from '../model/pathCrossings.ts'
import {
  diagramTranslationContext,
  isZeroTranslationVector,
  translateStratum,
  translateTextLabel,
  translationVectorPreview,
  type TranslationVector,
} from '../model/translation.ts'
import {
  isArrowHeadKind,
  isEndpointArrowMode,
  isMidArrowDirection,
  resolvePathArrowOptions,
} from '../model/pathArrows.ts'
import type {
  ClosedPathBoundary,
  CurveStratum,
  CurveStyleSegment,
  Diagram,
  HexColor,
  LabelAnchor,
  LineStyle,
  PointFill,
  PointShape,
  PolygonSheetStratum,
  Stratum,
  TextLabel,
} from '../model/types.ts'
import { isHexColorString } from './colorInput.ts'
import {
  clearSelectionForLayerFilter,
  isSelectionCompatibleWithLayerFilter,
  normalizeLayerFilterForDiagram,
  type LayerFilter,
} from './layerFilter.ts'
import {
  selectedElementFromElements,
  selectedElements,
  type SelectableGeometricKind,
  type SelectedElement,
  type SelectedDiagramElement,
  type SingleSelectedElement,
} from './selection.ts'
import {
  isPathArrowEditableCurve,
  updatePathEndpointArrow,
  updatePathMidArrowDirection,
  updatePathMidArrowEnabled,
  updatePathMidArrowHead,
  updatePathMidArrowPosition,
} from './pathArrowEditing.ts'
import {
  commitDiagramChange,
  type UndoableEditorState,
} from './undo.ts'

export const bulkMixedValueLabel = 'Mixed'
export const defaultFilledSurfaceLineWidth = 1.5

export type BulkFieldScalarValue = string | number

export type BulkFieldValue<T extends BulkFieldScalarValue = BulkFieldScalarValue> =
  | {
      kind: 'value'
      value: T
    }
  | {
      kind: 'mixed'
    }

export type BulkStyleFieldInputKind =
  | 'color'
  | 'opacity'
  | 'positiveNumber'
  | 'select'

export type BulkStyleFieldId =
  | 'region.fillColor'
  | 'region.fillOpacity'
  | 'region.strokeColor'
  | 'region.strokeOpacity'
  | 'region.lineWidth'
  | 'sheet.fillColor'
  | 'sheet.fillOpacity'
  | 'sheet.strokeColor'
  | 'sheet.strokeOpacity'
  | 'sheet.lineWidth'
  | 'curve.strokeColor'
  | 'curve.strokeOpacity'
  | 'curve.lineWidth'
  | 'curve.lineStyle'
  | 'curve.arrowEndpoint'
  | 'curve.arrowMidEnabled'
  | 'curve.arrowMidPosition'
  | 'curve.arrowMidDirection'
  | 'curve.arrowMidHead'
  | 'point.color'
  | 'point.opacity'
  | 'point.size'
  | 'point.shape'
  | 'point.fill'
  | 'label.color'
  | 'label.opacity'
  | 'label.fontSize'
  | 'label.anchor'

export type BulkStyleField = {
  id: BulkStyleFieldId
  label: string
  input: BulkStyleFieldInputKind
  value: BulkFieldValue
  options?: readonly string[]
}

export type BulkStyleEditorModel = {
  geometricKind: SelectableGeometricKind
  count: number
  fields: BulkStyleField[]
  arrowFields: BulkStyleField[]
}

export type BulkRemoveSelectedElementsResult = {
  diagram: Diagram
  selectedElement: SelectedElement
  removed: boolean
  removedCount: number
}

export type BulkRemoveSelectedElementsWithLayerFilterResult =
  BulkRemoveSelectedElementsResult & {
    layerFilter: LayerFilter
  }

export type BulkDuplicateIdChange = {
  sourceId: string
  copiedId: string
}

export type BulkDuplicatePathLabelChange = {
  sourcePathLabel: string
  copiedPathLabel: string
}

export type BulkDuplicateSelectedElementsResult = {
  diagram: Diagram
  selectedElement: SelectedElement
  duplicatedCount: number
  idChanges: BulkDuplicateIdChange[]
  pathLabelChanges: BulkDuplicatePathLabelChange[]
}

export type BulkTranslateSelectedElementsResult =
  | {
      ok: true
      diagram: Diagram
      translated: boolean
      translatedCount: number
    }
  | {
      ok: false
      diagram: Diagram
      error: string
    }

export type BulkOperationEditorState = UndoableEditorState & {
  layerOperationStatus: string
}

type LayerBoundSelectedDiagramElement = Extract<
  SelectedDiagramElement,
  { kind: 'stratum' | 'label' }
>

const midArrowEnabledModes = ['off', 'on'] as const

export function createBulkStyleEditorModel(
  diagram: Diagram,
  selection: SelectedElement,
): BulkStyleEditorModel | null {
  const selected = existingSelectedElements(diagram, selection)

  if (selected.length === 0) {
    return null
  }

  const geometricKind = selected[0]?.element.geometricKind

  if (
    geometricKind === undefined ||
    !selected.every((candidate) => candidate.element.geometricKind === geometricKind)
  ) {
    return null
  }

  switch (geometricKind) {
    case 'region': {
      const regions = selected.flatMap((candidate) =>
        candidate.kind === 'stratum' && candidate.element.geometricKind === 'region'
          ? [candidate.element]
          : [],
      )

      return {
        geometricKind,
        count: regions.length,
        fields: [
          bulkField(
            'region.fillColor',
            'Fill color',
            'color',
            commonBulkValue(regions.map((region) => region.style.fillColor)),
          ),
          bulkField(
            'region.fillOpacity',
            'Fill opacity',
            'opacity',
            commonBulkValue(regions.map((region) => region.style.fillOpacity)),
          ),
          bulkField(
            'region.strokeColor',
            'Stroke color',
            'color',
            commonBulkValue(regions.map((region) => region.style.strokeColor)),
          ),
          bulkField(
            'region.strokeOpacity',
            'Stroke opacity',
            'opacity',
            commonBulkValue(regions.map((region) => region.style.strokeOpacity)),
          ),
          bulkField(
            'region.lineWidth',
            'Line width',
            'positiveNumber',
            commonBulkValue(
              regions.map((region) => filledSurfaceLineWidth(region.style)),
            ),
          ),
        ],
        arrowFields: [],
      }
    }
    case 'sheet': {
      const sheets = selected.flatMap((candidate) =>
        candidate.kind === 'stratum' && candidate.element.geometricKind === 'sheet'
          ? [candidate.element]
          : [],
      )

      return {
        geometricKind,
        count: sheets.length,
        fields: [
          bulkField(
            'sheet.fillColor',
            'Fill color',
            'color',
            commonBulkValue(sheets.map((sheet) => sheet.style.fillColor)),
          ),
          bulkField(
            'sheet.fillOpacity',
            'Fill opacity',
            'opacity',
            commonBulkValue(sheets.map((sheet) => sheet.style.fillOpacity)),
          ),
          bulkField(
            'sheet.strokeColor',
            'Stroke color',
            'color',
            commonBulkValue(sheets.map((sheet) => sheet.style.strokeColor)),
          ),
          bulkField(
            'sheet.strokeOpacity',
            'Stroke opacity',
            'opacity',
            commonBulkValue(sheets.map((sheet) => sheet.style.strokeOpacity)),
          ),
          bulkField(
            'sheet.lineWidth',
            'Line width',
            'positiveNumber',
            commonBulkValue(sheets.map((sheet) => filledSurfaceLineWidth(sheet.style))),
          ),
        ],
        arrowFields: [],
      }
    }
    case 'curve': {
      const curves = selected.flatMap((candidate) =>
        candidate.kind === 'stratum' && candidate.element.geometricKind === 'curve'
          ? [candidate.element]
          : [],
      )
      const arrowEditableCurves = curves.filter(isPathArrowEditableCurve)
      const arrowFields =
        arrowEditableCurves.length === curves.length
          ? createBulkArrowFields(arrowEditableCurves)
          : []

      return {
        geometricKind,
        count: curves.length,
        fields: [
          bulkField(
            'curve.strokeColor',
            'Stroke color',
            'color',
            commonBulkValue(curves.map((curve) => curve.style.strokeColor)),
          ),
          bulkField(
            'curve.strokeOpacity',
            'Opacity',
            'opacity',
            commonBulkValue(curves.map((curve) => curve.style.strokeOpacity)),
          ),
          bulkField(
            'curve.lineWidth',
            'Line width',
            'positiveNumber',
            commonBulkValue(curves.map((curve) => curve.style.lineWidth)),
          ),
          bulkField(
            'curve.lineStyle',
            'Line style',
            'select',
            commonBulkValue(curves.map((curve) => curve.style.lineStyle)),
            lineStyles,
          ),
        ],
        arrowFields,
      }
    }
    case 'point': {
      const points = selected.flatMap((candidate) =>
        candidate.kind === 'stratum' && candidate.element.geometricKind === 'point'
          ? [candidate.element]
          : [],
      )

      return {
        geometricKind,
        count: points.length,
        fields: [
          bulkField(
            'point.color',
            'Color',
            'color',
            commonBulkValue(points.map((point) => point.style.color)),
          ),
          bulkField(
            'point.opacity',
            'Opacity',
            'opacity',
            commonBulkValue(points.map((point) => point.style.opacity)),
          ),
          bulkField(
            'point.size',
            'Size',
            'positiveNumber',
            commonBulkValue(points.map((point) => point.style.size)),
          ),
          bulkField(
            'point.shape',
            'Shape',
            'select',
            commonBulkValue(points.map((point) => point.style.shape)),
            pointShapes,
          ),
          bulkField(
            'point.fill',
            'Fill',
            'select',
            commonBulkValue(points.map((point) => point.style.fill)),
            pointFills,
          ),
        ],
        arrowFields: [],
      }
    }
    case 'label': {
      const labels = selected.flatMap((candidate) =>
        candidate.kind === 'label' ? [candidate.element] : [],
      )

      return {
        geometricKind,
        count: labels.length,
        fields: [
          bulkField(
            'label.color',
            'Text color',
            'color',
            commonBulkValue(labels.map((label) => label.style.color)),
          ),
          bulkField(
            'label.opacity',
            'Opacity',
            'opacity',
            commonBulkValue(labels.map((label) => label.style.opacity)),
          ),
          bulkField(
            'label.fontSize',
            'Font size',
            'positiveNumber',
            commonBulkValue(labels.map((label) => label.style.fontSize)),
          ),
          bulkField(
            'label.anchor',
            'Anchor',
            'select',
            commonBulkValue(labels.map((label) => label.style.anchor)),
            labelAnchors,
          ),
        ],
        arrowFields: [],
      }
    }
  }
}

export function bulkLayerFieldValue(
  diagram: Diagram,
  selection: SelectedElement,
): BulkFieldValue<number> {
  const layers = existingSelectedElements(diagram, selection).map(
    (selected) => selected.element.layer,
  )

  return commonBulkValue(layers)
}

export function applyBulkStyleField(
  diagram: Diagram,
  selection: SelectedElement,
  fieldId: BulkStyleFieldId,
  value: BulkFieldScalarValue,
): Diagram {
  const selectedKeys = selectedElementKeySet(selection)

  if (selectedKeys.size === 0) {
    return diagram
  }

  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (!selectedKeys.has(selectedElementKey({ kind: 'stratum', id: stratum.id }))) {
      return stratum
    }

    const updated = updateStratumBulkStyleField(stratum, fieldId, value)
    changed = changed || updated !== stratum
    return updated
  })
  const labels = diagram.labels.map((label) => {
    if (!selectedKeys.has(selectedElementKey({ kind: 'label', id: label.id }))) {
      return label
    }

    const updated = updateLabelBulkStyleField(label, fieldId, value)
    changed = changed || updated !== label
    return updated
  })

  return changed ? { ...diagram, strata, labels } : diagram
}

export function updateSelectedElementsLayer(
  diagram: Diagram,
  selection: SelectedElement,
  rawLayer: number,
): Diagram {
  if (!Number.isFinite(rawLayer)) {
    return diagram
  }

  const layer = normalizeLayerValue(rawLayer)
  const selectedKeys = selectedElementKeySet(selection)

  if (selectedKeys.size === 0) {
    return diagram
  }

  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (
      !selectedKeys.has(selectedElementKey({ kind: 'stratum', id: stratum.id })) ||
      normalizeLayerValue(stratum.layer) === layer
    ) {
      return stratum
    }

    changed = true
    return {
      ...stratum,
      layer,
    }
  })
  const labels = diagram.labels.map((label) => {
    if (
      !selectedKeys.has(selectedElementKey({ kind: 'label', id: label.id })) ||
      normalizeLayerValue(label.layer) === layer
    ) {
      return label
    }

    changed = true
    return {
      ...label,
      layer,
    }
  })

  return changed ? ensureLayerMetadata({ ...diagram, strata, labels }) : diagram
}

export function translateSelectedElements(
  diagram: Diagram,
  selection: SelectedElement,
  translation: TranslationVector,
): BulkTranslateSelectedElementsResult {
  const selected = existingSelectedElements(diagram, selection)

  if (selected.length === 0 || isZeroTranslationVector(translation)) {
    return {
      ok: true,
      diagram,
      translated: false,
      translatedCount: 0,
    }
  }

  const selectedKeys = selectedElementKeySet(selection)
  let context

  try {
    context = diagramTranslationContext(diagram)
  } catch (error) {
    return {
      ok: false,
      diagram,
      error: bulkOperationErrorMessage(error, 'Translate selected failed.'),
    }
  }

  let changed = false
  let changedCurve = false

  try {
    const strata = diagram.strata.map((stratum) => {
      if (!selectedKeys.has(selectedElementKey({ kind: 'stratum', id: stratum.id }))) {
        return stratum
      }

      const translated = translateStratum(stratum, translation, context)
      changed = changed || translated !== stratum
      changedCurve = changedCurve || stratum.geometricKind === 'curve'
      return translated
    })
    const labels = diagram.labels.map((label) => {
      if (!selectedKeys.has(selectedElementKey({ kind: 'label', id: label.id }))) {
        return label
      }

      changed = true
      return translateTextLabel(label, translation, context)
    })

    if (!changed) {
      return {
        ok: true,
        diagram,
        translated: false,
        translatedCount: 0,
      }
    }

    const nextDiagram = {
      ...diagram,
      strata,
      labels,
    }

    return {
      ok: true,
      diagram: changedCurve ? cleanPathCrossingStates(nextDiagram) : nextDiagram,
      translated: true,
      translatedCount: selected.length,
    }
  } catch (error) {
    return {
      ok: false,
      diagram,
      error: bulkOperationErrorMessage(error, 'Translate selected failed.'),
    }
  }
}

export function removeSelectedElements(
  diagram: Diagram,
  selection: SelectedElement,
): BulkRemoveSelectedElementsResult {
  const selectedKeys = selectedElementKeySet(selection)

  if (selectedKeys.size === 0) {
    return {
      diagram,
      selectedElement: null,
      removed: false,
      removedCount: 0,
    }
  }

  let removedCurve = false
  let removedStrata = 0
  let removedLabels = 0
  let removedCoordinates = 0
  const strata = diagram.strata.filter((stratum) => {
    const selected = selectedKeys.has(
      selectedElementKey({ kind: 'stratum', id: stratum.id }),
    )

    if (!selected) {
      return true
    }

    removedStrata += 1
    removedCurve = removedCurve || stratum.geometricKind === 'curve'
    return false
  })
  const labels = diagram.labels.filter((label) => {
    const selected = selectedKeys.has(selectedElementKey({ kind: 'label', id: label.id }))

    if (!selected) {
      return true
    }

    removedLabels += 1
    return false
  })
  const coordinateAnchors = (diagram.coordinateAnchors ?? []).filter((anchor) => {
    const selected = selectedKeys.has(
      selectedElementKey({ kind: 'coordinate', id: anchor.id }),
    )

    if (!selected) {
      return true
    }

    removedCoordinates += 1
    return false
  })
  const removedCount = removedStrata + removedLabels + removedCoordinates

  if (removedCount === 0) {
    return {
      diagram,
      selectedElement: null,
      removed: false,
      removedCount: 0,
    }
  }

  const nextDiagram = {
    ...diagram,
    coordinateAnchors,
    strata,
    labels,
  }

  return {
    diagram: removedCurve ? cleanPathCrossingStates(nextDiagram) : nextDiagram,
    selectedElement: null,
    removed: true,
    removedCount,
  }
}

export function removeSelectedElementsWithLayerFilter(
  diagram: Diagram,
  selection: SelectedElement,
  layerFilter: LayerFilter,
): BulkRemoveSelectedElementsWithLayerFilterResult {
  if (!isSelectionCompatibleWithLayerFilter(diagram, selection, layerFilter)) {
    return {
      diagram,
      selectedElement: null,
      removed: false,
      removedCount: 0,
      layerFilter: normalizeLayerFilterForDiagram(diagram, layerFilter),
    }
  }

  const result = removeSelectedElements(diagram, selection)

  return {
    ...result,
    layerFilter: normalizeLayerFilterForDiagram(result.diagram, layerFilter),
  }
}

export function duplicateSelectedElements(
  diagram: Diagram,
  selection: SelectedElement,
): BulkDuplicateSelectedElementsResult {
  const selected = existingSelectedElements(diagram, selection)

  if (selected.length === 0) {
    return {
      diagram,
      selectedElement: null,
      duplicatedCount: 0,
      idChanges: [],
      pathLabelChanges: [],
    }
  }

  const topLevelIdAllocator = createUniqueIdAllocator(topLevelElementIds(diagram))
  const nestedIdAllocator = createUniqueIdAllocator(nestedObjectIds(diagram))
  const pathLabelAllocator = createPathLabelAllocator(diagram)
  const idChanges: BulkDuplicateIdChange[] = []
  const pathLabelChanges: BulkDuplicatePathLabelChange[] = []
  const copiedStrata: Stratum[] = []
  const copiedLabels: TextLabel[] = []
  const copiedSelection: SingleSelectedElement[] = []

  for (const selectedElement of selected) {
    if (selectedElement.kind === 'stratum') {
      const copied = duplicateSelectedStratum(
        selectedElement.element,
        topLevelIdAllocator,
        nestedIdAllocator,
        pathLabelAllocator,
        idChanges,
        pathLabelChanges,
      )

      copiedStrata.push(copied)
      copiedSelection.push({ kind: 'stratum', id: copied.id })
      continue
    }

    const copied = duplicateSelectedTextLabel(
      selectedElement.element,
      topLevelIdAllocator,
      idChanges,
    )

    copiedLabels.push(copied)
    copiedSelection.push({ kind: 'label', id: copied.id })
  }

  return {
    diagram: ensureLayerMetadata({
      ...diagram,
      strata: [...diagram.strata, ...copiedStrata],
      labels: [...diagram.labels, ...copiedLabels],
    }),
    selectedElement: selectedElementFromElements(copiedSelection),
    duplicatedCount: copiedStrata.length + copiedLabels.length,
    idChanges,
    pathLabelChanges,
  }
}

export function applyBulkLayerChangeToEditorState<
  T extends BulkOperationEditorState,
>(current: T, layer: number): T {
  const nextDiagram = updateSelectedElementsLayer(
    current.editableDiagram,
    current.selectedElement,
    layer,
  )
  const nextLayerFilter = normalizeLayerFilterForDiagram(
    nextDiagram,
    current.layerFilter,
  )
  const nextSelection = clearSelectionForLayerFilter(
    nextDiagram,
    current.selectedElement,
    nextLayerFilter,
  )
  const count = selectedElements(current.selectedElement).length

  return commitDiagramChange(current, {
    ...current,
    editableDiagram: nextDiagram,
    selectedElement: nextSelection,
    layerFilter: nextLayerFilter,
    layerOperationStatus:
      nextDiagram === current.editableDiagram
        ? 'No selected objects moved.'
        : `Moved ${bulkElementCountLabel(count)} to layer ${formatLayerValue(layer)}.`,
  })
}

export function applyBulkDeleteToEditorState<T extends BulkOperationEditorState>(
  current: T,
): T {
  const result = removeSelectedElementsWithLayerFilter(
    current.editableDiagram,
    current.selectedElement,
    current.layerFilter,
  )

  return commitDiagramChange(current, {
    ...current,
    editableDiagram: result.diagram,
    selectedElement: result.selectedElement,
    layerFilter: result.layerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: result.removed
      ? `Deleted ${bulkElementCountLabel(result.removedCount)}.`
      : 'No selected objects deleted.',
  })
}

export function applyBulkDuplicateToEditorState<
  T extends BulkOperationEditorState,
>(current: T): T {
  if (
    !isSelectionCompatibleWithLayerFilter(
      current.editableDiagram,
      current.selectedElement,
      current.layerFilter,
    )
  ) {
    return {
      ...current,
      selectedElement: null,
      layerFilter: normalizeLayerFilterForDiagram(
        current.editableDiagram,
        current.layerFilter,
      ),
      layerOperationStatus: 'Selection is not editable in the current layer filter.',
    }
  }

  const result = duplicateSelectedElements(
    current.editableDiagram,
    current.selectedElement,
  )
  const nextLayerFilter = normalizeLayerFilterForDiagram(
    result.diagram,
    current.layerFilter,
  )
  const nextSelection = clearSelectionForLayerFilter(
    result.diagram,
    result.selectedElement,
    nextLayerFilter,
  )

  return commitDiagramChange(current, {
    ...current,
    editableDiagram: result.diagram,
    selectedElement: nextSelection,
    layerFilter: nextLayerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus:
      result.duplicatedCount === 0
        ? 'No selected objects duplicated.'
        : `Duplicated ${bulkElementCountLabel(result.duplicatedCount)}.`,
  })
}

export function applyBulkTranslateToEditorState<
  T extends BulkOperationEditorState,
>(current: T, translation: TranslationVector): T {
  if (
    !isSelectionCompatibleWithLayerFilter(
      current.editableDiagram,
      current.selectedElement,
      current.layerFilter,
    )
  ) {
    return {
      ...current,
      selectedElement: null,
      layerFilter: normalizeLayerFilterForDiagram(
        current.editableDiagram,
        current.layerFilter,
      ),
      layerOperationStatus: 'Selection is not editable in the current layer filter.',
    }
  }

  const result = translateSelectedElements(
    current.editableDiagram,
    current.selectedElement,
    translation,
  )

  if (!result.ok) {
    return {
      ...current,
      layerOperationStatus: result.error,
    }
  }

  const nextLayerFilter = normalizeLayerFilterForDiagram(
    result.diagram,
    current.layerFilter,
  )
  const nextSelection = clearSelectionForLayerFilter(
    result.diagram,
    current.selectedElement,
    nextLayerFilter,
  )
  const preview = translationVectorPreview(translation)

  return commitDiagramChange(current, {
    ...current,
    editableDiagram: result.diagram,
    selectedElement: nextSelection,
    layerFilter: nextLayerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus:
      result.translated
        ? `Translated ${bulkElementCountLabel(
            result.translatedCount,
          )} by (${preview.x}, ${preview.y}, ${preview.z}).`
        : 'No selected objects translated.',
  })
}

export function filledSurfaceLineWidth(style: { lineWidth?: number }): number {
  return style.lineWidth ?? defaultFilledSurfaceLineWidth
}

function createBulkArrowFields(curves: readonly CurveStratum[]): BulkStyleField[] {
  const arrows = curves.map((curve) => resolvePathArrowOptions(curve.arrows))

  return [
    bulkField(
      'curve.arrowEndpoint',
      'End arrow',
      'select',
      commonBulkValue(arrows.map((arrow) => arrow.endpoint)),
      endpointArrowModes,
    ),
    bulkField(
      'curve.arrowMidEnabled',
      'Mid arrow',
      'select',
      commonBulkValue(arrows.map((arrow) => (arrow.mid.enabled ? 'on' : 'off'))),
      midArrowEnabledModes,
    ),
    bulkField(
      'curve.arrowMidPosition',
      'Mid position',
      'positiveNumber',
      commonBulkValue(arrows.map((arrow) => arrow.mid.position)),
    ),
    bulkField(
      'curve.arrowMidDirection',
      'Mid direction',
      'select',
      commonBulkValue(arrows.map((arrow) => arrow.mid.direction)),
      midArrowDirections,
    ),
    bulkField(
      'curve.arrowMidHead',
      'Arrow head',
      'select',
      commonBulkValue(arrows.map((arrow) => arrow.mid.head)),
      arrowHeadKinds,
    ),
  ]
}

function bulkField(
  id: BulkStyleFieldId,
  label: string,
  input: BulkStyleFieldInputKind,
  value: BulkFieldValue,
  options?: readonly string[],
): BulkStyleField {
  return {
    id,
    label,
    input,
    value,
    ...(options === undefined ? {} : { options }),
  }
}

function commonBulkValue<T extends BulkFieldScalarValue>(
  values: readonly T[],
): BulkFieldValue<T> {
  const first = values[0]

  if (first === undefined) {
    return { kind: 'mixed' }
  }

  return values.every((value) => value === first)
    ? {
        kind: 'value',
        value: first,
      }
    : { kind: 'mixed' }
}

function updateStratumBulkStyleField(
  stratum: Stratum,
  fieldId: BulkStyleFieldId,
  value: BulkFieldScalarValue,
): Stratum {
  switch (stratum.geometricKind) {
    case 'region':
      return updateRegionBulkStyleField(stratum, fieldId, value)
    case 'sheet':
      return updateSheetBulkStyleField(stratum, fieldId, value)
    case 'curve':
      return updateCurveBulkStyleField(stratum, fieldId, value)
    case 'point':
      return updatePointBulkStyleField(stratum, fieldId, value)
  }
}

function updateRegionBulkStyleField(
  stratum: Extract<Stratum, { geometricKind: 'region' }>,
  fieldId: BulkStyleFieldId,
  value: BulkFieldScalarValue,
): Stratum {
  switch (fieldId) {
    case 'region.fillColor': {
      const fillColor = colorInput(value)
      return fillColor === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, fillColor },
          })
    }
    case 'region.fillOpacity': {
      const fillOpacity = opacityInput(value)
      return fillOpacity === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, fillOpacity },
          })
    }
    case 'region.strokeColor': {
      const strokeColor = colorInput(value)
      return strokeColor === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, strokeColor },
          })
    }
    case 'region.strokeOpacity': {
      const strokeOpacity = opacityInput(value)
      return strokeOpacity === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, strokeOpacity },
          })
    }
    case 'region.lineWidth': {
      const lineWidth = positiveNumberInput(value)
      return lineWidth === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, lineWidth },
          })
    }
    default:
      return stratum
  }
}

function updateSheetBulkStyleField(
  stratum: Extract<Stratum, { geometricKind: 'sheet' }>,
  fieldId: BulkStyleFieldId,
  value: BulkFieldScalarValue,
): Stratum {
  switch (fieldId) {
    case 'sheet.fillColor': {
      const fillColor = colorInput(value)
      return fillColor === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, fillColor },
          })
    }
    case 'sheet.fillOpacity': {
      const fillOpacity = opacityInput(value)
      return fillOpacity === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, fillOpacity },
          })
    }
    case 'sheet.strokeColor': {
      const strokeColor = colorInput(value)
      return strokeColor === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, strokeColor },
          })
    }
    case 'sheet.strokeOpacity': {
      const strokeOpacity = opacityInput(value)
      return strokeOpacity === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, strokeOpacity },
          })
    }
    case 'sheet.lineWidth': {
      const lineWidth = positiveNumberInput(value)
      return lineWidth === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, lineWidth },
          })
    }
    default:
      return stratum
  }
}

function updateCurveBulkStyleField(
  stratum: CurveStratum,
  fieldId: BulkStyleFieldId,
  value: BulkFieldScalarValue,
): Stratum {
  switch (fieldId) {
    case 'curve.strokeColor': {
      const strokeColor = colorInput(value)
      return strokeColor === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, strokeColor },
          })
    }
    case 'curve.strokeOpacity': {
      const strokeOpacity = opacityInput(value)
      return strokeOpacity === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, strokeOpacity },
          })
    }
    case 'curve.lineWidth': {
      const lineWidth = positiveNumberInput(value)
      return lineWidth === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, lineWidth },
          })
    }
    case 'curve.lineStyle': {
      const lineStyle = lineStyleInput(value)
      return lineStyle === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, lineStyle },
          })
    }
    case 'curve.arrowEndpoint': {
      return isEndpointArrowMode(value)
        ? updatePathEndpointArrow(stratum, value)
        : stratum
    }
    case 'curve.arrowMidEnabled': {
      if (value !== 'off' && value !== 'on') {
        return stratum
      }

      return updatePathMidArrowEnabled(stratum, value === 'on')
    }
    case 'curve.arrowMidPosition': {
      const position = numberInput(value)
      return position === null
        ? stratum
        : updatePathMidArrowPosition(stratum, position)
    }
    case 'curve.arrowMidDirection': {
      return isMidArrowDirection(value)
        ? updatePathMidArrowDirection(stratum, value)
        : stratum
    }
    case 'curve.arrowMidHead': {
      return isArrowHeadKind(value)
        ? updatePathMidArrowHead(stratum, value)
        : stratum
    }
    default:
      return stratum
  }
}

function updatePointBulkStyleField(
  stratum: Extract<Stratum, { geometricKind: 'point' }>,
  fieldId: BulkStyleFieldId,
  value: BulkFieldScalarValue,
): Stratum {
  switch (fieldId) {
    case 'point.color': {
      const color = colorInput(value)
      return color === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, color },
          })
    }
    case 'point.opacity': {
      const opacity = opacityInput(value)
      return opacity === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, opacity },
          })
    }
    case 'point.size': {
      const size = positiveNumberInput(value)
      return size === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, size },
          })
    }
    case 'point.shape': {
      const shape = pointShapeInput(value)
      return shape === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, shape },
          })
    }
    case 'point.fill': {
      const fill = pointFillInput(value)
      return fill === null
        ? stratum
        : clearStyleReferences({
            ...stratum,
            style: { ...stratum.style, fill },
          })
    }
    default:
      return stratum
  }
}

function updateLabelBulkStyleField(
  label: TextLabel,
  fieldId: BulkStyleFieldId,
  value: BulkFieldScalarValue,
): TextLabel {
  switch (fieldId) {
    case 'label.color': {
      const color = colorInput(value)
      return color === null
        ? label
        : clearStyleReferences({
            ...label,
            style: { ...label.style, color },
          })
    }
    case 'label.opacity': {
      const opacity = opacityInput(value)
      return opacity === null
        ? label
        : clearStyleReferences({
            ...label,
            style: { ...label.style, opacity },
          })
    }
    case 'label.fontSize': {
      const fontSize = positiveNumberInput(value)
      return fontSize === null
        ? label
        : clearStyleReferences({
            ...label,
            style: { ...label.style, fontSize },
          })
    }
    case 'label.anchor': {
      const anchor = labelAnchorInput(value)
      return anchor === null
        ? label
        : clearStyleReferences({
            ...label,
            style: { ...label.style, anchor },
          })
    }
    default:
      return label
  }
}

function colorInput(value: BulkFieldScalarValue): HexColor | null {
  return typeof value === 'string' && isHexColorString(value) ? value : null
}

function numberInput(value: BulkFieldScalarValue): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function opacityInput(value: BulkFieldScalarValue): number | null {
  const parsed = numberInput(value)

  return parsed !== null && parsed >= 0 && parsed <= 1 ? parsed : null
}

function positiveNumberInput(value: BulkFieldScalarValue): number | null {
  const parsed = numberInput(value)

  return parsed !== null && parsed > 0 ? parsed : null
}

function lineStyleInput(value: BulkFieldScalarValue): LineStyle | null {
  return typeof value === 'string' && lineStyles.includes(value as LineStyle)
    ? (value as LineStyle)
    : null
}

function pointShapeInput(value: BulkFieldScalarValue): PointShape | null {
  return typeof value === 'string' && pointShapes.includes(value as PointShape)
    ? (value as PointShape)
    : null
}

function pointFillInput(value: BulkFieldScalarValue): PointFill | null {
  return typeof value === 'string' && pointFills.includes(value as PointFill)
    ? (value as PointFill)
    : null
}

function labelAnchorInput(value: BulkFieldScalarValue): LabelAnchor | null {
  return typeof value === 'string' && labelAnchors.includes(value as LabelAnchor)
    ? (value as LabelAnchor)
    : null
}

function clearStyleReferences<
  T extends {
    stylePresetId?: string
    importedTikzStyleReferenceId?: string
  },
>(value: T): T {
  const nextValue = { ...value }

  delete nextValue.stylePresetId
  delete nextValue.importedTikzStyleReferenceId

  return nextValue
}

function existingSelectedElements(
  diagram: Diagram,
  selection: SelectedElement,
): LayerBoundSelectedDiagramElement[] {
  const seen = new Set<string>()
  const elements: LayerBoundSelectedDiagramElement[] = []
  const strataById = new Map(
    diagram.strata.map((stratum) => [stratum.id, stratum]),
  )
  const labelsById = new Map(
    diagram.labels.map((label) => [label.id, label]),
  )

  for (const selectedElement of selectedElements(selection)) {
    const key = selectedElementKey(selectedElement)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    if (selectedElement.kind === 'stratum') {
      const element = strataById.get(selectedElement.id)

      if (element !== undefined) {
        elements.push({ kind: 'stratum', element })
      }
      continue
    }

    if (selectedElement.kind !== 'label') {
      continue
    }

    const element = labelsById.get(selectedElement.id)

    if (element !== undefined) {
      elements.push({ kind: 'label', element })
    }
  }

  return elements
}

function selectedElementKeySet(selection: SelectedElement): Set<string> {
  return new Set(selectedElements(selection).map(selectedElementKey))
}

function selectedElementKey(element: SingleSelectedElement): string {
  return `${element.kind}:${element.id}`
}

function bulkOperationErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback

  return message.startsWith('Unsupported ')
    ? `${message} Translation supports saved geometry with absolute coordinates; rotate, scale, shear, and other affine transforms are deferred.`
    : message
}

function duplicateSelectedStratum(
  stratum: Stratum,
  topLevelIdAllocator: UniqueIdAllocator,
  nestedIdAllocator: UniqueIdAllocator,
  pathLabelAllocator: PathLabelAllocator,
  idChanges: BulkDuplicateIdChange[],
  pathLabelChanges: BulkDuplicatePathLabelChange[],
): Stratum {
  const copied = cloneDiagramValue(stratum)
  const copiedId = topLevelIdAllocator.allocate(stratum.id)

  idChanges.push({ sourceId: stratum.id, copiedId })
  copied.id = copiedId

  switch (copied.geometricKind) {
    case 'region':
      return duplicateRegionNestedIds(copied, nestedIdAllocator)
    case 'sheet':
      return duplicateSheetNestedData(
        copied,
        nestedIdAllocator,
        pathLabelAllocator,
        pathLabelChanges,
      )
    case 'curve':
      return duplicateCurveNestedData(
        copied,
        nestedIdAllocator,
        pathLabelAllocator,
        pathLabelChanges,
      )
    case 'point':
      return copied
  }
}

function duplicateSelectedTextLabel(
  label: TextLabel,
  topLevelIdAllocator: UniqueIdAllocator,
  idChanges: BulkDuplicateIdChange[],
): TextLabel {
  const copied = cloneDiagramValue(label)
  const copiedId = topLevelIdAllocator.allocate(label.id)

  idChanges.push({ sourceId: label.id, copiedId })

  return {
    ...copied,
    id: copiedId,
  }
}

function duplicateRegionNestedIds(
  stratum: Extract<Stratum, { geometricKind: 'region' }>,
  nestedIdAllocator: UniqueIdAllocator,
): Extract<Stratum, { geometricKind: 'region' }> {
  if (stratum.kind !== 'filledRegion') {
    return stratum
  }

  return {
    ...stratum,
    boundaries: duplicateClosedPathBoundaries(stratum.boundaries, nestedIdAllocator),
  }
}

function duplicateSheetNestedData(
  stratum: Extract<Stratum, { geometricKind: 'sheet' }>,
  nestedIdAllocator: UniqueIdAllocator,
  pathLabelAllocator: PathLabelAllocator,
  pathLabelChanges: BulkDuplicatePathLabelChange[],
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

function duplicateCurveNestedData(
  stratum: CurveStratum,
  nestedIdAllocator: UniqueIdAllocator,
  pathLabelAllocator: PathLabelAllocator,
  pathLabelChanges: BulkDuplicatePathLabelChange[],
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

function duplicatePathLabel<T extends CurveStratum | PolygonSheetStratum>(
  stratum: T,
  pathLabelAllocator: PathLabelAllocator,
  pathLabelChanges: BulkDuplicatePathLabelChange[],
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

function cloneDiagramValue<T>(value: T): T {
  return structuredClone(value) as T
}

function bulkElementCountLabel(count: number): string {
  return `${count} selected ${count === 1 ? 'object' : 'objects'}`
}

type UniqueIdAllocator = {
  allocate: (sourceId: string) => string
}

type PathLabelAllocator = {
  allocate: (sourcePathLabel: string) => string
}
