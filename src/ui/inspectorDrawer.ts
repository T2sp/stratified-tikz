export type InspectorDrawerState = 'open' | 'closed'

export function defaultInspectorDrawerState(): InspectorDrawerState {
  return 'closed'
}

export function openInspectorDrawerState(): InspectorDrawerState {
  return 'open'
}

export function closeInspectorDrawerState(): InspectorDrawerState {
  return 'closed'
}

export function toggleInspectorDrawerState(
  state: InspectorDrawerState,
): InspectorDrawerState {
  return state === 'open' ? 'closed' : 'open'
}

export function isInspectorDrawerOpen(state: InspectorDrawerState): boolean {
  return state === 'open'
}
