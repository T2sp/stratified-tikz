import type { Diagram } from '../model/types.ts'
import { synchronizeLinkedCoonsPatches } from '../model/coonsPatchLinks.ts'
import { cloneDiagram } from './diagramUpdates.ts'
import {
  clearSelectionForLayerFilter,
  type LayerFilter,
} from './layerFilter.ts'
import type { SelectedElement } from './selection.ts'

export const maxDiagramHistorySize = 100

export type DiagramHistory = {
  past: Diagram[]
  present: Diagram
  future: Diagram[]
}

export type UndoableEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  polylineDraft: unknown
  cubicBezierDraft: unknown
  pathDraft: unknown
  sheetPolygonDraft: unknown
  history: DiagramHistory
}

export type CommitDiagramChangeOptions = {
  undoSourceDiagram?: Diagram
}

export function createDiagramHistory(diagram: Diagram): DiagramHistory {
  return {
    past: [],
    present: cloneDiagram(diagram),
    future: [],
  }
}

export function commitDiagramChange<T extends UndoableEditorState>(
  current: T,
  next: T,
  options: CommitDiagramChangeOptions = {},
): T {
  const synchronizedDiagram = synchronizeLinkedCoonsPatches(
    current.editableDiagram,
    next.editableDiagram,
  ).diagram
  const synchronizedNext =
    synchronizedDiagram === next.editableDiagram
      ? next
      : { ...next, editableDiagram: synchronizedDiagram }

  if (areDiagramsEqual(current.editableDiagram, synchronizedDiagram)) {
    return {
      ...synchronizedNext,
      history: current.history,
    }
  }

  const undoSourceDiagram = cloneDiagram(
    options.undoSourceDiagram ?? current.editableDiagram,
  )
  const past =
    options.undoSourceDiagram !== undefined &&
    current.history.past.length > 0 &&
    areDiagramsEqual(
      current.history.past[current.history.past.length - 1],
      undoSourceDiagram,
    )
      ? current.history.past
      : appendBoundedPast(current.history.past, undoSourceDiagram)

  return {
    ...synchronizedNext,
    history: {
      past,
      present: cloneDiagram(synchronizedDiagram),
      future: [],
    },
  }
}

export function undoLastDiagramChange<T extends UndoableEditorState>(
  current: T,
): T {
  if (!canUndoDiagramChange(current.history)) {
    return current
  }

  const previousDiagram = cloneDiagram(
    current.history.past[current.history.past.length - 1],
  )
  const past = current.history.past.slice(0, -1)
  const future = [
    cloneDiagram(current.editableDiagram),
    ...current.history.future.map(cloneDiagram),
  ]

  return {
    ...current,
    editableDiagram: previousDiagram,
    selectedElement: clearSelectionForLayerFilter(
      previousDiagram,
      current.selectedElement,
      current.layerFilter,
    ),
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: {
      past,
      present: cloneDiagram(previousDiagram),
      future,
    },
  }
}

export function redoLastDiagramChange<T extends UndoableEditorState>(
  current: T,
): T {
  if (!canRedoDiagramChange(current.history)) {
    return current
  }

  const nextDiagram = cloneDiagram(current.history.future[0])
  const future = current.history.future.slice(1).map(cloneDiagram)

  return {
    ...current,
    editableDiagram: nextDiagram,
    selectedElement: clearSelectionForLayerFilter(
      nextDiagram,
      current.selectedElement,
      current.layerFilter,
    ),
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: {
      past: appendBoundedPast(current.history.past, current.editableDiagram),
      present: cloneDiagram(nextDiagram),
      future,
    },
  }
}

export function canUndoDiagramChange(history: DiagramHistory): boolean {
  return history.past.length > 0
}

export function canRedoDiagramChange(history: DiagramHistory): boolean {
  return history.future.length > 0
}

export function areDiagramsEqual(left: Diagram, right: Diagram): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function appendBoundedPast(past: Diagram[], diagram: Diagram): Diagram[] {
  return [...past, cloneDiagram(diagram)].slice(-maxDiagramHistorySize)
}
