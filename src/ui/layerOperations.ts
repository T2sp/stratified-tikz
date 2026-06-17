import {
  deleteLayer,
  duplicateLayer,
  elementsOnLayer,
  formatLayerValue,
  normalizeLayerValue,
  swapLayers,
  translateLayer,
} from '../model/layers.ts'
import type { Vec3 } from '../model/types.ts'
import {
  clearSelectionForLayerFilter,
  normalizeLayerFilterForDiagram,
  type LayerFilter,
} from './layerFilter.ts'
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
  translation: Vec3,
): T {
  try {
    const nextDiagram = translateLayer(
      current.editableDiagram,
      layerValue,
      translation,
    )

    return commitDiagramChange(current, {
      ...current,
      editableDiagram: nextDiagram,
      layerOperationStatus:
        nextDiagram === current.editableDiagram
          ? `Layer ${formatLayerValue(layerValue)} was not moved.`
          : `Translated layer ${formatLayerValue(layerValue)} by (${translation.x}, ${translation.y}, ${translation.z}).`,
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

function layerElementCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'element' : 'elements'}`
}

function layerOperationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
