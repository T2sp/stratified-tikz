export type ExampleBarState = 'expanded' | 'compact'

export function defaultExampleBarState(): ExampleBarState {
  return 'expanded'
}

export function collapseExampleBarForEditing(): ExampleBarState {
  return 'compact'
}

export function shouldCollapseExampleBarForDiagramChange(
  diagramMatchesSelectedExample: boolean,
): boolean {
  return !diagramMatchesSelectedExample
}

export function toggleExampleDropdown(isOpen: boolean): boolean {
  return !isOpen
}
