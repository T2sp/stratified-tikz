import type { Diagram, Stratum, TextLabel } from '../model/types'

export type SelectedElement =
  | { kind: 'stratum'; id: string }
  | { kind: 'label'; id: string }
  | null

export type SelectedDiagramElement =
  | { kind: 'stratum'; element: Stratum }
  | { kind: 'label'; element: TextLabel }

export function findSelectedElement(
  diagram: Diagram,
  selection: SelectedElement,
): SelectedDiagramElement | null {
  if (selection === null) {
    return null
  }

  if (selection.kind === 'stratum') {
    const stratum = diagram.strata.find((candidate) => candidate.id === selection.id)
    return stratum === undefined ? null : { kind: 'stratum', element: stratum }
  }

  const label = diagram.labels.find((candidate) => candidate.id === selection.id)
  return label === undefined ? null : { kind: 'label', element: label }
}

export function selectionExistsInDiagram(
  diagram: Diagram,
  selection: SelectedElement,
): boolean {
  return findSelectedElement(diagram, selection) !== null
}

export function clearSelectionIfMissing(
  diagram: Diagram,
  selection: SelectedElement,
): SelectedElement {
  return selectionExistsInDiagram(diagram, selection) ? selection : null
}
