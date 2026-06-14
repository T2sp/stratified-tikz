import type {
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

export function createInspectorSections(
  diagram: Diagram,
  selection: SelectedElement,
): InspectorSection[] {
  const selected = findSelectedElement(diagram, selection)

  if (selected === null) {
    return []
  }

  return selected.kind === 'stratum'
    ? createStratumSections(selected.element)
    : createLabelSections(selected.element)
}

export function formatVec3(point: Vec3): string {
  return `(${formatNumber(point.x)}, ${formatNumber(point.y)}, ${formatNumber(point.z)})`
}

function createStratumSections(stratum: Stratum): InspectorSection[] {
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
    ...createGeometrySections(stratum),
    {
      title: 'Style',
      fields: [{ label: stratum.style.kind, value: formatStyleSummary(stratum.style) }],
    },
  ]
}

function createGeometrySections(stratum: Stratum): InspectorSection[] {
  switch (stratum.geometricKind) {
    case 'region':
      return [
        {
          title: 'Geometry',
          fields: [{ label: 'Visible', value: stratum.visible ? 'yes' : 'no' }],
        },
      ]
    case 'sheet':
      return [createSheetGeometrySection(stratum)]
    case 'curve':
      return [createCurveGeometrySection(stratum)]
    case 'point':
      return [createPointGeometrySection(stratum)]
  }
}

function createSheetGeometrySection(sheet: SheetStratum): InspectorSection {
  return {
    title: 'Geometry',
    fields: sheet.corners.map((corner, index) => ({
      label: `Corner ${index + 1}`,
      value: formatVec3(corner),
    })),
  }
}

function createCurveGeometrySection(curve: CurveStratum): InspectorSection {
  return {
    title: 'Geometry',
    fields: [
      { label: 'Curve kind', value: curve.kind },
      { label: 'Style segments', value: String(curve.styleSegments.length) },
      ...curve.points.map((point, index) => ({
        label: `Point ${index + 1}`,
        value: formatVec3(point),
      })),
    ],
  }
}

function createPointGeometrySection(point: PointStratum): InspectorSection {
  return {
    title: 'Geometry',
    fields: [{ label: 'Position', value: formatVec3(point.position) }],
  }
}

function createLabelSections(label: TextLabel): InspectorSection[] {
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
      fields: [{ label: 'Position', value: formatVec3(label.position) }],
    },
    {
      title: 'Style',
      fields: [{ label: label.style.kind, value: formatLabelStyle(label.style) }],
    },
  ]
}

function formatStyleSummary(style: StratumStyle): string {
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

function formatLabelStyle(style: LabelStyle): string {
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
