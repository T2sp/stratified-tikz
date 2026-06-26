import {
  deleteLayer,
  duplicateLayer,
  elementsOnLayer,
  formatLayerValue,
  getLayerMetadata,
  type LayerTranslationVector,
  mergeLayers,
  normalizeLayerValue,
  swapLayers,
  translateLayer,
} from '../model/layers.ts'
import type { Diagram, Vec3 } from '../model/types.ts'
import {
  clearSelectionForLayerFilter,
  normalizeLayerFilterForDiagram,
  type LayerFilter,
} from './layerFilter.ts'
import {
  layerCreationInputForLayer,
  parseLayerValueInput,
} from './layerPalette.ts'
import {
  commitDiagramChange,
  type UndoableEditorState,
} from './undo.ts'

export type LayerOperationEditorState = UndoableEditorState & {
  layerOperationStatus: string
}

export function applyDuplicateLayerToEditorState<
  T extends LayerOperationEditorState,
>(
  current: T,
  sourceLayerValue: number,
  targetLayerValue?: number,
): T {
  try {
    const result = duplicateLayer(current.editableDiagram, sourceLayerValue, {
      ...(targetLayerValue === undefined ? {} : { targetLayerValue }),
    })
    const nextLayerFilter = normalizeLayerFilterForDiagram(
      result.diagram,
      current.layerFilter,
    )

    return commitDiagramChange(current, {
      ...current,
      editableDiagram: result.diagram,
      selectedElement: clearSelectionForLayerFilter(
        result.diagram,
        current.selectedElement,
        nextLayerFilter,
      ),
      layerFilter: nextLayerFilter,
      layerOperationStatus: `Duplicated layer ${formatLayerValue(
        result.sourceLayer,
      )} to layer ${formatLayerValue(result.targetLayer)} (${layerElementCountLabel(
        result.duplicatedStrata + result.duplicatedLabels,
      )}).`,
    })
  } catch (error) {
    return {
      ...current,
      layerOperationStatus: layerOperationErrorMessage(
        error,
        'Duplicate layer failed.',
      ),
    }
  }
}

export function applySwapLayersToEditorState<
  T extends LayerOperationEditorState,
>(
  current: T,
  leftLayerValue: number,
  rightLayerValue: number,
): T {
  if (
    normalizeLayerValue(leftLayerValue) ===
    normalizeLayerValue(rightLayerValue)
  ) {
    return {
      ...current,
      layerOperationStatus: 'Choose two different layers to swap.',
    }
  }

  try {
    const nextDiagram = swapLayers(
      current.editableDiagram,
      leftLayerValue,
      rightLayerValue,
    )
    const nextLayerFilter = normalizeLayerFilterForDiagram(
      nextDiagram,
      swapLayerFilterForLayerSwap(
        current.layerFilter,
        leftLayerValue,
        rightLayerValue,
      ),
    )

    return commitDiagramChange(current, {
      ...current,
      editableDiagram: nextDiagram,
      selectedElement: clearSelectionForLayerFilter(
        nextDiagram,
        current.selectedElement,
        nextLayerFilter,
      ),
      layerFilter: nextLayerFilter,
      layerOperationStatus: `Swapped layers ${formatLayerValue(
        leftLayerValue,
      )} and ${formatLayerValue(rightLayerValue)}.`,
    })
  } catch (error) {
    return {
      ...current,
      layerOperationStatus: layerOperationErrorMessage(
        error,
        'Swap layers failed.',
      ),
    }
  }
}

export function applyTranslateLayerToEditorState<
  T extends LayerOperationEditorState,
>(
  current: T,
  layerValue: number,
  translation: LayerTranslationVector,
): T {
  try {
    const nextDiagram = translateLayer(
      current.editableDiagram,
      layerValue,
      translation,
    )
    const preview = layerTranslationVectorPreview(translation)

    return commitDiagramChange(current, {
      ...current,
      editableDiagram: nextDiagram,
      layerOperationStatus:
        nextDiagram === current.editableDiagram
          ? `Layer ${formatLayerValue(layerValue)} was not moved.`
          : `Translated layer ${formatLayerValue(layerValue)} by (${preview.x}, ${preview.y}, ${preview.z}).`,
    })
  } catch (error) {
    return {
      ...current,
      layerOperationStatus: layerOperationErrorMessage(
        error,
        'Translate layer failed.',
      ),
    }
  }
}

export function applyMergeLayersToEditorState<
  T extends LayerOperationEditorState,
>(
  current: T,
  sourceLayerValue: number,
  targetLayerValue: number,
): T {
  if (
    normalizeLayerValue(sourceLayerValue) ===
    normalizeLayerValue(targetLayerValue)
  ) {
    return {
      ...current,
      layerOperationStatus: 'Choose two different layers to merge.',
    }
  }

  try {
    const warning = layerMergeWarningMessage(
      current.editableDiagram,
      targetLayerValue,
    )
    const result = mergeLayers(
      current.editableDiagram,
      sourceLayerValue,
      targetLayerValue,
    )
    const nextLayerFilter = normalizeLayerFilterForDiagram(
      result.diagram,
      mergeLayerFilterForLayerMerge(
        current.layerFilter,
        result.sourceLayer,
        result.targetLayer,
      ),
    )

    return commitDiagramChange(current, {
      ...current,
      editableDiagram: result.diagram,
      selectedElement: clearSelectionForLayerFilter(
        result.diagram,
        current.selectedElement,
        nextLayerFilter,
      ),
      layerFilter: nextLayerFilter,
      layerOperationStatus: `${mergeLayersStatusMessage(
        result.sourceLayer,
        result.targetLayer,
        result.movedStrata + result.movedLabels,
      )}${warning}`,
    })
  } catch (error) {
    return {
      ...current,
      layerOperationStatus: layerOperationErrorMessage(
        error,
        'Merge layers failed.',
      ),
    }
  }
}

export function mergeLayersStatusMessage(
  sourceLayer: number,
  targetLayer: number,
  movedElementCount: number,
): string {
  return `Merged layer ${formatLayerValue(sourceLayer)} into layer ${formatLayerValue(
    targetLayer,
  )} (${layerElementCountLabel(movedElementCount)}).`
}

export function layerMergeWarningMessage(
  diagram: Diagram,
  targetLayerValue: number,
): string {
  const targetLayer = getLayerMetadata(diagram).find(
    (layer) =>
      normalizeLayerValue(layer.value) === normalizeLayerValue(targetLayerValue),
  )
  const warnings: string[] = []

  if (targetLayer?.visible === false) {
    warnings.push('target layer is hidden; moved objects may disappear from preview')
  }

  if (targetLayer?.locked === true) {
    warnings.push('target layer is locked; unlock it before editing moved objects')
  }

  return warnings.length === 0 ? '' : ` Warning: ${warnings.join('. ')}.`
}

export function applyDeleteLayerToEditorState<
  T extends LayerOperationEditorState,
>(current: T, layerValue: number): T {
  try {
    const elementCount = elementsOnLayer(
      current.editableDiagram,
      layerValue,
    ).length
    const nextDiagram = deleteLayer(current.editableDiagram, layerValue)
    const nextLayerFilter = normalizeLayerFilterForDiagram(
      nextDiagram,
      current.layerFilter,
    )

    return commitDiagramChange(current, {
      ...current,
      editableDiagram: nextDiagram,
      selectedElement: clearSelectionForLayerFilter(
        nextDiagram,
        current.selectedElement,
        nextLayerFilter,
      ),
      layerFilter: nextLayerFilter,
      polylineDraft: null,
      cubicBezierDraft: null,
      pathDraft: null,
      sheetPolygonDraft: null,
      layerOperationStatus: `Deleted layer ${formatLayerValue(
        layerValue,
      )} (${layerElementCountLabel(elementCount)}).`,
    })
  } catch (error) {
    return {
      ...current,
      layerOperationStatus: layerOperationErrorMessage(
        error,
        'Delete layer failed.',
      ),
    }
  }
}

export function layerCreationInputAfterLayerMerge(
  currentCreationLayerInput: string,
  sourceLayerValue: number,
  targetLayerValue: number,
): string {
  const currentLayer = parseLayerValueInput(currentCreationLayerInput)

  if (currentLayer === null) {
    return currentCreationLayerInput
  }

  const sourceLayer = normalizeLayerValue(sourceLayerValue)
  const targetLayer = normalizeLayerValue(targetLayerValue)

  return normalizeLayerValue(currentLayer) === sourceLayer
    ? layerCreationInputForLayer(targetLayer)
    : currentCreationLayerInput
}

function swapLayerFilterForLayerSwap(
  layerFilter: LayerFilter,
  leftLayerValue: number,
  rightLayerValue: number,
): LayerFilter {
  if (
    layerFilter.kind === 'all' ||
    !Number.isFinite(leftLayerValue) ||
    !Number.isFinite(rightLayerValue)
  ) {
    return layerFilter
  }

  const layer = normalizeLayerValue(layerFilter.layer)
  const leftLayer = normalizeLayerValue(leftLayerValue)
  const rightLayer = normalizeLayerValue(rightLayerValue)

  if (layer === leftLayer) {
    return { kind: 'layer', layer: rightLayer }
  }

  if (layer === rightLayer) {
    return { kind: 'layer', layer: leftLayer }
  }

  return layerFilter
}

function mergeLayerFilterForLayerMerge(
  layerFilter: LayerFilter,
  sourceLayerValue: number,
  targetLayerValue: number,
): LayerFilter {
  if (layerFilter.kind === 'all') {
    return layerFilter
  }

  const layer = normalizeLayerValue(layerFilter.layer)
  const sourceLayer = normalizeLayerValue(sourceLayerValue)

  return layer === sourceLayer
    ? { kind: 'layer', layer: normalizeLayerValue(targetLayerValue) }
    : layerFilter
}

function layerTranslationVectorPreview(translation: LayerTranslationVector): {
  x: number
  y: number
  z: number
} {
  return isNumericLayerTranslationVector(translation)
    ? translation
    : {
        x: translation.x.kind === 'numeric'
          ? translation.x.value
          : translation.x.previewValue,
        y: translation.y.kind === 'numeric'
          ? translation.y.value
          : translation.y.previewValue,
        z: translation.z.kind === 'numeric'
          ? translation.z.value
          : translation.z.previewValue,
      }
}

function isNumericLayerTranslationVector(
  translation: LayerTranslationVector,
): translation is Vec3 {
  return (
    typeof translation.x === 'number' &&
    typeof translation.y === 'number' &&
    typeof translation.z === 'number'
  )
}

function layerElementCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'element' : 'elements'}`
}

function layerOperationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
