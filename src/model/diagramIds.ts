import {
  coonsPatchBoundaryRoles,
  isCoonsPatchBoundarySources,
  type Diagram,
} from './types.ts'

export function collectTopLevelDiagramIds(diagram: Diagram): Set<string> {
  const ids = new Set<string>()

  for (const stratum of diagram.strata) {
    ids.add(stratum.id)

    if (
      stratum.geometricKind !== 'sheet' ||
      stratum.kind !== 'curvedSheet' ||
      stratum.primitive.kind !== 'coonsPatch' ||
      !isCoonsPatchBoundarySources(stratum.primitive.boundarySources)
    ) {
      continue
    }

    for (const role of coonsPatchBoundaryRoles) {
      const source = stratum.primitive.boundarySources[role]
      const sourceId =
        source.kind === 'path' ? source.sourcePathId : source.sourcePointId

      if (sourceId.length > 0) {
        ids.add(sourceId)
      }
    }
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
