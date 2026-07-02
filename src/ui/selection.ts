import type { CoordinateAnchor, Diagram, Stratum, TextLabel } from '../model/types'

export type SingleSelectedElement =
  | { kind: 'stratum'; id: string }
  | { kind: 'label'; id: string }
  | { kind: 'coordinate'; id: string }

export type MultiSelectedElement = {
  kind: 'multi'
  id?: never
  elements: SingleSelectedElement[]
}

export type SelectedElement =
  | SingleSelectedElement
  | MultiSelectedElement
  | null

export type Selection =
  | { kind: 'none' }
  | { kind: 'single'; id: string }
  | { kind: 'multi'; ids: string[] }

export type SelectedDiagramElement =
  | { kind: 'stratum'; element: Stratum }
  | { kind: 'label'; element: TextLabel }
  | { kind: 'coordinate'; element: CoordinateAnchor }

export type SelectableGeometricKind =
  | Stratum['geometricKind']
  | TextLabel['geometricKind']
  | 'coordinate'

export type SelectionClickMode = 'replace' | 'toggle'

export function findSelectedElement(
  diagram: Diagram,
  selection: SelectedElement,
): SelectedDiagramElement | null {
  if (!isSingleSelectedElement(selection)) {
    return null
  }

  if (selection.kind === 'stratum') {
    const stratum = diagram.strata.find((candidate) => candidate.id === selection.id)
    return stratum === undefined ? null : { kind: 'stratum', element: stratum }
  }

  if (selection.kind === 'coordinate') {
    const anchor = (diagram.coordinateAnchors ?? []).find(
      (candidate) => candidate.id === selection.id,
    )

    return anchor === undefined ? null : { kind: 'coordinate', element: anchor }
  }

  const label = diagram.labels.find((candidate) => candidate.id === selection.id)
  return label === undefined ? null : { kind: 'label', element: label }
}

export function findSelectedElements(
  diagram: Diagram,
  selection: SelectedElement,
): SelectedDiagramElement[] {
  return selectedElements(selection).flatMap((element) => {
    const selected = findSelectedElement(diagram, element)

    return selected === null ? [] : [selected]
  })
}

export function selectionExistsInDiagram(
  diagram: Diagram,
  selection: SelectedElement,
): boolean {
  if (selection === null) {
    return false
  }

  const elements = selectedElements(selection)

  return (
    elements.length > 0 &&
    elements.every((element) => findSelectedElement(diagram, element) !== null)
  )
}

export function clearSelectionIfMissing(
  diagram: Diagram,
  selection: SelectedElement,
): SelectedElement {
  return normalizeSelectedElement(diagram, selection)
}

export function normalizeSelectedElement(
  diagram: Diagram,
  selection: SelectedElement,
): SelectedElement {
  const normalized = selectedElements(selection)
    .reduce<SingleSelectedElement[]>((elements, element) => {
      if (findSelectedElement(diagram, element) === null) {
        return elements
      }

      if (
        elements.some(
          (candidate) =>
            candidate.kind === element.kind && candidate.id === element.id,
        )
      ) {
        return elements
      }

      return [...elements, element]
    }, [])

  return selectedElementFromElements(filterSameGeometricKind(diagram, normalized))
}

export function updateSelectionForClick(
  diagram: Diagram,
  currentSelection: SelectedElement,
  clickedElement: SingleSelectedElement,
  mode: SelectionClickMode,
): SelectedElement {
  if (findSelectedElement(diagram, clickedElement) === null) {
    return normalizeSelectedElement(diagram, currentSelection)
  }

  if (mode === 'replace') {
    return clickedElement
  }

  const currentElements = selectedElements(
    normalizeSelectedElement(diagram, currentSelection),
  )

  if (currentElements.length === 0) {
    return clickedElement
  }

  const clickedKind = selectedElementGeometricKind(diagram, clickedElement)
  const currentKind = selectedElementGeometricKind(
    diagram,
    currentElements[0] ?? null,
  )

  // Coordinate anchors are their own selection family. Modifier-clicking across
  // coordinate and layer-bound families replaces the selection instead of mixing.
  if (clickedKind === null || currentKind === null || clickedKind !== currentKind) {
    return clickedElement
  }

  const existingIndex = currentElements.findIndex(
    (element) =>
      element.kind === clickedElement.kind && element.id === clickedElement.id,
  )

  if (existingIndex >= 0) {
    return selectedElementFromElements(
      currentElements.filter((_, index) => index !== existingIndex),
    )
  }

  return selectedElementFromElements([...currentElements, clickedElement])
}

export function updateSelectionForBackgroundClick(
  currentSelection: SelectedElement,
  mode: SelectionClickMode,
): SelectedElement {
  return mode === 'toggle' ? currentSelection : null
}

export function selectedElements(
  selection: SelectedElement,
): SingleSelectedElement[] {
  if (selection === null) {
    return []
  }

  return selection.kind === 'multi' ? selection.elements : [selection]
}

export function selectedElementIds(selection: SelectedElement): string[] {
  return selectedElements(selection).map((element) => element.id)
}

export function selectedElementCount(selection: SelectedElement): number {
  return selectedElements(selection).length
}

export function isCoordinateAnchorSelection(
  selection: SelectedElement,
): boolean {
  const elements = selectedElements(selection)

  return (
    elements.length > 0 &&
    elements.every((element) => element.kind === 'coordinate')
  )
}

export function selectionIncludesCoordinateAnchor(
  selection: SelectedElement,
): boolean {
  return selectedElements(selection).some(
    (element) => element.kind === 'coordinate',
  )
}

export function updateSelectionForCoordinateAnchorVisibility(
  selection: SelectedElement,
  showCoordinateAnchors: boolean,
): SelectedElement {
  return !showCoordinateAnchors && selectionIncludesCoordinateAnchor(selection)
    ? null
    : selection
}

export function isSingleSelectedElement(
  selection: SelectedElement,
): selection is SingleSelectedElement {
  return (
    selection !== null &&
    (selection.kind === 'stratum' ||
      selection.kind === 'label' ||
      selection.kind === 'coordinate')
  )
}

export function isMultiSelectedElement(
  selection: SelectedElement,
): selection is MultiSelectedElement {
  return selection?.kind === 'multi'
}

export function isSelectedElement(
  selectedElement: SelectedElement,
  element: SingleSelectedElement,
): boolean {
  return selectedElements(selectedElement).some(
    (candidate) => candidate.kind === element.kind && candidate.id === element.id,
  )
}

export function selectedElementGeometricKind(
  diagram: Diagram,
  selection: SelectedElement,
): SelectableGeometricKind | null {
  const selected = findSelectedElement(diagram, selection)

  return selected?.kind === 'coordinate'
    ? 'coordinate'
    : selected?.element.geometricKind ?? null
}

export function selectionGeometricKind(
  diagram: Diagram,
  selection: SelectedElement,
): SelectableGeometricKind | null {
  const [first] = selectedElements(selection)

  return first === undefined ? null : selectedElementGeometricKind(diagram, first)
}

export function selectedElementFromElements(
  elements: readonly SingleSelectedElement[],
): SelectedElement {
  const coordinateSelection = elements.filter(
    (element) => element.kind === 'coordinate',
  )

  if (coordinateSelection.length > 0) {
    return selectionFromHomogeneousElements(coordinateSelection)
  }

  return selectionFromHomogeneousElements(elements)
}

function selectionFromHomogeneousElements(
  elements: readonly SingleSelectedElement[],
): SelectedElement {
  if (elements.length === 0) {
    return null
  }

  if (elements.length === 1) {
    return elements[0] ?? null
  }

  return {
    kind: 'multi',
    elements: [...elements],
  }
}

export function selectionToSerializableModel(
  selection: SelectedElement,
): Selection {
  const ids = selectedElementIds(selection)

  if (ids.length === 0) {
    return { kind: 'none' }
  }

  if (ids.length === 1) {
    return { kind: 'single', id: ids[0] ?? '' }
  }

  return { kind: 'multi', ids }
}

function filterSameGeometricKind(
  diagram: Diagram,
  elements: readonly SingleSelectedElement[],
): SingleSelectedElement[] {
  let expectedKind: SelectableGeometricKind | null = null

  return elements.filter((element) => {
    const geometricKind = selectedElementGeometricKind(diagram, element)

    if (geometricKind === null) {
      return false
    }

    if (expectedKind === null) {
      expectedKind = geometricKind
      return true
    }

    return geometricKind === expectedKind
  })
}
