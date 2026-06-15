import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import type {
  AmbientDimension,
  Diagram,
  Stratum,
  TextLabel,
  Vec3,
} from '../model/types.ts'
import type { SelectedElement } from './selection.ts'

export type CoordinateAxis = 'x' | 'y' | 'z'

export type SelectedElementUpdaters = {
  stratum?: (stratum: Stratum) => Stratum
  label?: (label: TextLabel) => TextLabel
}

export function cloneDiagram(diagram: Diagram): Diagram {
  return structuredClone(diagram) as Diagram
}

export function updateStratumById(
  diagram: Diagram,
  id: string,
  updater: (stratum: Stratum) => Stratum,
): Diagram {
  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (stratum.id !== id) {
      return stratum
    }

    changed = true
    return updater(stratum)
  })

  return changed ? { ...diagram, strata } : diagram
}

export function updateLabelById(
  diagram: Diagram,
  id: string,
  updater: (label: TextLabel) => TextLabel,
): Diagram {
  let changed = false
  const labels = diagram.labels.map((label) => {
    if (label.id !== id) {
      return label
    }

    changed = true
    return updater(label)
  })

  return changed ? { ...diagram, labels } : diagram
}

export function updateStratumNameById(
  diagram: Diagram,
  id: string,
  name: string,
): Diagram {
  if (name.trim().length === 0) {
    return diagram
  }

  return updateStratumById(diagram, id, (stratum) => ({ ...stratum, name }))
}

export function updateSelectedElement(
  diagram: Diagram,
  selectedElement: SelectedElement,
  updaters: SelectedElementUpdaters,
): Diagram {
  if (selectedElement === null) {
    return diagram
  }

  if (selectedElement.kind === 'stratum') {
    return updaters.stratum === undefined
      ? diagram
      : updateStratumById(diagram, selectedElement.id, updaters.stratum)
  }

  return updaters.label === undefined
    ? diagram
    : updateLabelById(diagram, selectedElement.id, updaters.label)
}

export function coordinateAxesForAmbientDimension(
  ambientDimension: AmbientDimension,
): CoordinateAxis[] {
  return ambientDimension === 2 ? ['x', 'y'] : ['x', 'y', 'z']
}

export function updateVec3Coordinate(
  point: Vec3,
  axis: CoordinateAxis,
  value: number,
  ambientDimension: AmbientDimension,
): Vec3 {
  return normalizePointForAmbientDimension(ambientDimension, {
    ...point,
    [axis]: value,
  })
}

export function parseFiniteNumber(rawValue: string): number | null {
  if (rawValue.trim() === '') {
    return null
  }

  const value = Number(rawValue)
  return Number.isFinite(value) ? value : null
}
