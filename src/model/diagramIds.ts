import type { Diagram } from './types.ts'

export function collectTopLevelDiagramIds(diagram: Diagram): Set<string> {
  const ids = new Set<string>()

  for (const stratum of diagram.strata) {
    ids.add(stratum.id)
  }
  for (const label of diagram.labels) {
    ids.add(label.id)
  }
  for (const anchor of diagram.coordinateAnchors ?? []) {
    ids.add(anchor.id)
  }
  for (const variable of diagram.variables ?? []) {
    ids.add(variable.id)
  }
  for (const state of diagram.pathCrossings ?? []) {
    ids.add(state.id)
  }

  return ids
}
