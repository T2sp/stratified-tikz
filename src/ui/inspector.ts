import type {
  AmbientDimension,
  CurveStratum,
  Diagram,
  LabelStyle,
  PointStratum,
  SheetStratum,
  Stratum,
  StratumStyle,
  TextLabel,
  Vec3,
} from '../model/types'
import { findSelectedElement, type SelectedElement } from './selection.ts'

export type InspectorField = {
  label: string
  value: string
}

export type InspectorSection = {
  title: string
  fields: InspectorField[]
}

export type CurvePointDescription = {
  label: string
  point: Vec3
}

export function createInspectorSections(
  diagram: Diagram,
  selection: SelectedElement,
): InspectorSection[] {
  const selected = findSelectedElement(diagram, selection)

  if (selected === null) {
    return []
  }

  return selected.kind === 'stratum'
    ? createStratumSections(selected.element, diagram.ambientDimension)
    : createLabelSections(selected.element, diagram.ambientDimension)
}

export function formatVec3(
  point: Vec3,
  ambientDimension: AmbientDimension,
): string {
  const coordinates =
    ambientDimension === 2
      ? [point.x, point.y]
      : [point.x, point.y, point.z]

  return `(${coordinates.map(formatNumber).join(', ')})`
}

export function describeCurvePoints(curve: CurveStratum): CurvePointDescription[] {
  if (curve.kind === 'cubicBezier') {
    const bezierLabels = ['Start', 'Control point 1', 'Control point 2', 'End']

    return curve.points.map((point, index) => ({
      label: bezierLabels[index] ?? `Point ${index + 1}`,
      point,
    }))
  }

  return curve.points.map((point, index) => ({
    label: `Vertex ${index}`,
    point,
  }))
}

function createStratumSections(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
): InspectorSection[] {
  return [
    {
      title: 'Selection',
      fields: [
        { label: 'Type', value: 'stratum' },
        { label: 'ID', value: stratum.id },
        { label: 'Name', value: stratum.name },
        { label: 'Geometric kind', value: stratum.geometricKind },
        { label: 'Codimension', value: String(stratum.codim) },
        { label: 'Layer', value: String(stratum.layer) },
        { label: 'Attached label', value: stratum.label ?? 'none' },
      ],
    },
    ...createGeometrySections(stratum, ambientDimension),
    {
      title: 'Style',
      fields: [
        {
          label: stratum.style.kind,
          value: formatStratumStyleSummary(stratum.style),
        },
      ],
    },
  ]
}

function createGeometrySections(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
): InspectorSection[] {
  switch (stratum.geometricKind) {
    case 'region':
      return [
        {
          title: 'Geometry',
          fields: [{ label: 'Visible', value: stratum.visible ? 'yes' : 'no' }],
        },
      ]
    case 'sheet':
      return [createSheetGeometrySection(stratum, ambientDimension)]
    case 'curve':
      return [createCurveGeometrySection(stratum, ambientDimension)]
    case 'point':
      return [createPointGeometrySection(stratum, ambientDimension)]
  }
}

function createSheetGeometrySection(
  sheet: SheetStratum,
  ambientDimension: AmbientDimension,
): InspectorSection {
  return {
    title: 'Geometry',
    fields: sheet.corners.map((corner, index) => ({
      label: `Corner ${index + 1}`,
      value: formatVec3(corner, ambientDimension),
    })),
  }
}

function createCurveGeometrySection(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
): InspectorSection {
  return {
    title: 'Geometry',
    fields: [
      { label: 'Curve kind', value: curve.kind },
      { label: 'Style segments', value: String(curve.styleSegments.length) },
      ...describeCurvePoints(curve).map((description) => ({
        label: description.label,
        value: formatVec3(description.point, ambientDimension),
      })),
    ],
  }
}

function createPointGeometrySection(
  point: PointStratum,
  ambientDimension: AmbientDimension,
): InspectorSection {
  return {
    title: 'Geometry',
    fields: [
      { label: 'Position', value: formatVec3(point.position, ambientDimension) },
    ],
  }
}

function createLabelSections(
  label: TextLabel,
  ambientDimension: AmbientDimension,
): InspectorSection[] {
  return [
    {
      title: 'Selection',
      fields: [
        { label: 'Type', value: 'free text label' },
        { label: 'ID', value: label.id },
        { label: 'Name', value: label.name },
        { label: 'Text', value: label.text },
        { label: 'Layer', value: String(label.layer) },
      ],
    },
    {
      title: 'Geometry',
      fields: [
        { label: 'Position', value: formatVec3(label.position, ambientDimension) },
      ],
    },
    {
      title: 'Style',
      fields: [
        { label: label.style.kind, value: formatLabelStyleSummary(label.style) },
      ],
    },
  ]
}

export function formatStratumStyleSummary(style: StratumStyle): string {
  switch (style.kind) {
    case 'regionStyle':
    case 'sheetStyle':
      return [
        `fill ${style.fillColor} @ ${formatNumber(style.fillOpacity)}`,
        `stroke ${style.strokeColor} @ ${formatNumber(style.strokeOpacity)}`,
      ].join('; ')
    case 'curveStyle':
      return [
        `stroke ${style.strokeColor} @ ${formatNumber(style.strokeOpacity)}`,
        `width ${formatNumber(style.lineWidth)}pt`,
        style.lineStyle,
      ].join('; ')
    case 'pointStyle':
      return [
        style.color,
        `opacity ${formatNumber(style.opacity)}`,
        style.shape,
        style.fill,
        `size ${formatNumber(style.size)}pt`,
      ].join('; ')
  }
}

export function formatLabelStyleSummary(style: LabelStyle): string {
  return [
    style.color,
    `opacity ${formatNumber(style.opacity)}`,
    `font ${formatNumber(style.fontSize)}pt`,
    `anchor ${style.anchor}`,
  ].join('; ')
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) {
    return '0'
  }

  return String(Number(value.toFixed(3)))
}
