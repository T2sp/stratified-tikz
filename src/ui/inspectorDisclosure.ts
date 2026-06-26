import {
  isMultiSelectedElement,
  selectedElements,
  type SelectedElement,
} from './selection.ts'

export type InspectorDisclosureState = {
  selectionKey: string | null
  expanded: boolean
}

export function selectedElementDisclosureKey(
  selection: SelectedElement,
): string | null {
  if (selection === null) {
    return null
  }

  if (isMultiSelectedElement(selection)) {
    return `multi:${selectedElements(selection)
      .map((element) => `${element.kind}:${element.id}`)
      .join('|')}`
  }

  return `${selection.kind}:${selection.id}`
}

export function nextInspectorDisclosureStateForSelection(
  current: InspectorDisclosureState,
  selection: SelectedElement,
): InspectorDisclosureState {
  const selectionKey = selectedElementDisclosureKey(selection)

  return current.selectionKey === selectionKey
    ? current
    : {
        selectionKey,
        expanded: false,
      }
}

export function setInspectorDisclosureExpanded(
  current: InspectorDisclosureState,
  selection: SelectedElement,
  expanded: boolean,
): InspectorDisclosureState {
  const selectionKey = selectedElementDisclosureKey(selection)
  const nextExpanded = selectionKey === null ? false : expanded

  return current.selectionKey === selectionKey && current.expanded === nextExpanded
    ? current
    : {
        selectionKey,
        expanded: nextExpanded,
      }
}
