import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import {
  cloneCurveStyle,
  cloneLabelStyle,
  clonePointStyle,
  defaultCurveStyle,
  defaultLabelStyle,
  defaultPointStyle,
} from '../model/styles.ts'
import type {
  AmbientDimension,
  CurveStratum,
  Diagram,
  LabelStyle,
  PointStratum,
  Stratum,
  StratumStyle,
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

export function updateStratumStyleById(
  diagram: Diagram,
  id: string,
  updater: (style: StratumStyle) => StratumStyle,
): Diagram {
  return updateStratumById(diagram, id, (stratum) => {
    switch (stratum.geometricKind) {
      case 'region': {
        const style = updater(stratum.style)
        return style.kind === 'regionStyle' ? { ...stratum, style } : stratum
      }
      case 'sheet': {
        const style = updater(stratum.style)
        return style.kind === 'sheetStyle' ? { ...stratum, style } : stratum
      }
      case 'curve': {
        const style = updater(stratum.style)
        return style.kind === 'curveStyle' ? { ...stratum, style } : stratum
      }
      case 'point': {
        const style = updater(stratum.style)
        return style.kind === 'pointStyle' ? { ...stratum, style } : stratum
      }
    }
  })
}

export function updateLabelStyleById(
  diagram: Diagram,
  id: string,
  updater: (style: LabelStyle) => LabelStyle,
): Diagram {
  return updateLabelById(diagram, id, (label) => ({
    ...label,
    style: updater(label.style),
  }))
}

export type AddPointStratumOptions = {
  id?: string
  name?: string
  layer?: number
}

export type AddTextLabelOptions = {
  id?: string
  name?: string
  text?: string
  layer?: number
}

export type AddPolylineCurveStratumOptions = {
  id?: string
  name?: string
  layer?: number
}

export type AddPointStratumResult = {
  diagram: Diagram
  id: string
}

export type AddTextLabelResult = {
  diagram: Diagram
  id: string
}

export type AddPolylineCurveStratumResult = {
  diagram: Diagram
  id: string | null
}

export function makeUniqueId(diagram: Diagram, prefix: string): string {
  const existingIds = new Set([
    ...diagram.strata.map((stratum) => stratum.id),
    ...diagram.labels.map((label) => label.id),
  ])
  let index = 1

  while (existingIds.has(`${prefix}-${index}`)) {
    index += 1
  }

  return `${prefix}-${index}`
}

export function addPointStratum(
  diagram: Diagram,
  position: Vec3,
  options: AddPointStratumOptions = {},
): Diagram {
  return addPointStratumWithResult(diagram, position, options).diagram
}

export function addPointStratumWithResult(
  diagram: Diagram,
  position: Vec3,
  options: AddPointStratumOptions = {},
): AddPointStratumResult {
  const point = createPointForDiagram(diagram, position, options)

  return {
    diagram: {
      ...diagram,
      strata: [...diagram.strata, point],
    },
    id: point.id,
  }
}

export function addTextLabel(
  diagram: Diagram,
  position: Vec3,
  options: AddTextLabelOptions = {},
): Diagram {
  return addTextLabelWithResult(diagram, position, options).diagram
}

export function addTextLabelWithResult(
  diagram: Diagram,
  position: Vec3,
  options: AddTextLabelOptions = {},
): AddTextLabelResult {
  const label = createLabelForDiagram(diagram, position, options)

  return {
    diagram: {
      ...diagram,
      labels: [...diagram.labels, label],
    },
    id: label.id,
  }
}

export function addPolylineCurveStratum(
  diagram: Diagram,
  points: Vec3[],
  options: AddPolylineCurveStratumOptions = {},
): Diagram {
  return addPolylineCurveStratumWithResult(diagram, points, options).diagram
}

export function addPolylineCurveStratumWithResult(
  diagram: Diagram,
  points: Vec3[],
  options: AddPolylineCurveStratumOptions = {},
): AddPolylineCurveStratumResult {
  if (points.length < 2) {
    return {
      diagram,
      id: null,
    }
  }

  const curve = createPolylineCurveForDiagram(diagram, points, options)

  return {
    diagram: {
      ...diagram,
      strata: [...diagram.strata, curve],
    },
    id: curve.id,
  }
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

function nextLayer(diagram: Diagram): number {
  const layers = [
    ...diagram.strata.map((stratum) => stratum.layer),
    ...diagram.labels.map((label) => label.layer),
  ]

  return layers.length === 0 ? 0 : Math.max(...layers) + 1
}

function createPointForDiagram(
  diagram: Diagram,
  position: Vec3,
  options: AddPointStratumOptions,
): PointStratum {
  return {
    codim: diagram.ambientDimension === 2 ? 2 : 3,
    geometricKind: 'point',
    id: options.id ?? makeUniqueId(diagram, 'point'),
    name: options.name ?? 'Point',
    style: clonePointStyle(defaultPointStyle),
    position: normalizePointForAmbientDimension(diagram.ambientDimension, position),
    layer: options.layer ?? nextLayer(diagram),
  }
}

function createLabelForDiagram(
  diagram: Diagram,
  position: Vec3,
  options: AddTextLabelOptions,
): TextLabel {
  return {
    id: options.id ?? makeUniqueId(diagram, 'label'),
    geometricKind: 'label',
    name: options.name ?? 'Label',
    text: options.text ?? 'Label',
    position: normalizePointForAmbientDimension(diagram.ambientDimension, position),
    style: cloneLabelStyle(defaultLabelStyle),
    layer: options.layer ?? nextLayer(diagram),
  }
}

function createPolylineCurveForDiagram(
  diagram: Diagram,
  points: Vec3[],
  options: AddPolylineCurveStratumOptions,
): CurveStratum {
  return {
    codim: diagram.ambientDimension === 2 ? 1 : 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: safeOptionalId(diagram, options.id, 'curve'),
    name: safeOptionalName(options.name, 'Curve'),
    style: cloneCurveStyle(defaultCurveStyle),
    points: points.map((point) =>
      normalizePointForAmbientDimension(diagram.ambientDimension, point),
    ),
    styleSegments: [],
    layer: options.layer ?? nextLayer(diagram),
  }
}

function safeOptionalId(
  diagram: Diagram,
  id: string | undefined,
  fallbackPrefix: string,
): string {
  const trimmedId = id?.trim()

  if (trimmedId === undefined || trimmedId.length === 0) {
    return makeUniqueId(diagram, fallbackPrefix)
  }

  const existingIds = new Set([
    ...diagram.strata.map((stratum) => stratum.id),
    ...diagram.labels.map((label) => label.id),
  ])

  return existingIds.has(trimmedId)
    ? makeUniqueId(diagram, fallbackPrefix)
    : trimmedId
}

function safeOptionalName(
  name: string | undefined,
  fallbackName: string,
): string {
  const trimmedName = name?.trim()

  return trimmedName === undefined || trimmedName.length === 0
    ? fallbackName
    : trimmedName
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

export function parseOpacity(rawValue: string): number | null {
  const value = parseFiniteNumber(rawValue)

  if (value === null || value < 0 || value > 1) {
    return null
  }

  return value
}

export function parsePositiveFiniteNumber(rawValue: string): number | null {
  const value = parseFiniteNumber(rawValue)

  if (value === null || value <= 0) {
    return null
  }

  return value
}
