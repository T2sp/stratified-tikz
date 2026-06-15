import type { Diagram } from '../model/types.ts'
import { cloneDiagram } from './diagramUpdates.ts'
import {
  clearSelectionForLayerFilter,
  normalizeLayerFilterForDiagram,
  type LayerFilter,
} from './layerFilter.ts'
import type { SelectedElement } from './selection.ts'

export type UndoableEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  polylineDraft: unknown
  cubicBezierDraft: unknown
  sheetPolygonDraft: unknown
  undoDiagram: Diagram | null
}

export type CommitDiagramChangeOptions = {
  undoSourceDiagram?: Diagram
}

export function commitDiagramChange<T extends UndoableEditorState>(
  current: T,
  next: T,
  options: CommitDiagramChangeOptions = {},
): T {
  if (areDiagramsEqual(current.editableDiagram, next.editableDiagram)) {
    return next
  }

  return {
    ...next,
    undoDiagram: cloneDiagram(options.undoSourceDiagram ?? current.editableDiagram),
  }
}

export function undoLastDiagramChange<T extends UndoableEditorState>(
  current: T,
): T {
  if (current.undoDiagram === null) {
    return current
  }

  const editableDiagram = cloneDiagram(current.undoDiagram)
  const layerFilter = normalizeLayerFilterForDiagram(
    editableDiagram,
    current.layerFilter,
  )

  return {
    ...current,
    editableDiagram,
    selectedElement: clearSelectionForLayerFilter(
      editableDiagram,
      current.selectedElement,
      layerFilter,
    ),
    layerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    sheetPolygonDraft: null,
    undoDiagram: null,
  }
}

export function areDiagramsEqual(left: Diagram, right: Diagram): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
