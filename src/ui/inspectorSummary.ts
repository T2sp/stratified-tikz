import type {
  AmbientDimension,
  ClosedPathBoundary,
  CurveStratum,
  Diagram,
  LabelStyle,
  PathTemplate,
  PathSegment,
  PointStratum,
  SheetStratum,
  Stratum,
  StratumStyle,
  TextLabel,
  Vec3,
} from '../model/types'
import { cubicBezierControlModeLabel } from '../geometry/bezierControls.ts'
import { isClosedPathBoundary } from '../model/filledBoundaries.ts'
import {
  gridLatticePattern,
  gridPreviewSegments,
  scalarInputPreviewValue,
} from '../model/grids.ts'
import { pathCoordinates, pathEndpoints } from '../model/paths.ts'
import { sheetVertices } from '../model/sheets.ts'
import type { FilledBoundaryStratum } from './filledStratumEditing.ts'
import { findSelectedElement, type SelectedElement } from './selection.ts'

export type InspectorField = {
  label: string
  value: string
}

export type InspectorSection = {
  title: string
  fields: InspectorField[]
}

export type InspectorCompactSummary = {
  title: string
  layer: string
  detail: string | null
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

export function createInspectorCompactSummary(
  diagram: Diagram,
  selection: SelectedElement,
): InspectorCompactSummary | null {
  const selected = findSelectedElement(diagram, selection)

  if (selected === null) {
    return null
  }

  if (selected.kind === 'stratum') {
    const stratum = selected.element

    return {
      title: `${stratumKindLabel(stratum)}: ${stratum.name} [${stratum.id}]`,
      layer: formatNumber(stratum.layer),
      detail: `codim ${stratum.codim}`,
    }
  }

  const label = selected.element
  const titleText =
    label.text.trim().length === 0 ? label.name : compactSummaryText(label.text)

  return {
    title: `Label: ${titleText} [${label.id}]`,
    layer: formatNumber(label.layer),
    detail: `position ${formatVec3(label.position, diagram.ambientDimension)}`,
  }
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
  if (curve.kind === 'grid') {
    return []
  }

  if (curve.kind === 'cubicBezier') {
    const bezierLabels = ['Start', 'Control point 1', 'Control point 2', 'End']

    return curve.points.map((point, index) => ({
      label: bezierLabels[index] ?? `Point ${index + 1}`,
      point,
    }))
  }

  if (curve.kind === 'concatenatedPath') {
    return curve.segments.flatMap((segment, index) => {
      const segmentLabel = `Segment ${index + 1}`

      switch (segment.kind) {
        case 'line':
          return [
            { label: `${segmentLabel} start`, point: segment.start },
            { label: `${segmentLabel} end`, point: segment.end },
          ]
        case 'cubicBezier':
          return [
            { label: `${segmentLabel} start`, point: segment.start },
            { label: `${segmentLabel} control point 1`, point: segment.control1 },
            { label: `${segmentLabel} control point 2`, point: segment.control2 },
            { label: `${segmentLabel} end`, point: segment.end },
          ]
        case 'arc':
          return [
            { label: `${segmentLabel} start`, point: segment.start },
            { label: `${segmentLabel} center`, point: segment.center },
            { label: `${segmentLabel} end`, point: segment.end },
          ]
      }
    })
  }

  if (curve.kind === 'templatePath') {
    return [{ label: 'Center', point: curve.template.center }]
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
        { label: 'Attached label metadata', value: stratum.label ?? 'none' },
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
      if (stratum.kind === 'filledRegion') {
        return [createFilledBoundaryGeometrySection(stratum, ambientDimension)]
      }

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
  if (sheet.kind === 'workPlaneFilledSheet') {
    return createFilledBoundaryGeometrySection(sheet, ambientDimension)
  }

  if (sheet.kind === 'curvedSheet') {
    return {
      title: 'Geometry',
      fields: [
        { label: 'Primitive', value: sheet.primitive.kind },
        {
          label: 'Sampling',
          value: `${sheet.primitive.sampling.uSegments} x ${sheet.primitive.sampling.vSegments}`,
        },
      ],
    }
  }

  return {
    title: 'Geometry',
    fields: sheetVertices(sheet).map((vertex, index) => ({
      label: `${sheet.kind === 'quadSheet' ? 'Corner' : 'Vertex'} ${index + 1}`,
      value: formatVec3(vertex, ambientDimension),
    })),
  }
}

export function createFilledBoundaryGeometryFields(
  stratum: FilledBoundaryStratum,
  ambientDimension: AmbientDimension,
): InspectorField[] {
  return [
    { label: 'Object kind', value: filledBoundaryObjectKindLabel(stratum) },
    { label: 'Boundaries', value: String(stratum.boundaries.length) },
    { label: 'Fill rule', value: stratum.fillRule },
    { label: 'Boundary coordinates', value: 'read-only' },
    ...stratum.boundaries.map((boundary, index) => ({
      label: `Boundary ${index + 1}`,
      value: formatClosedPathBoundarySummary(boundary, ambientDimension),
    })),
  ]
}

export function filledBoundaryObjectKindLabel(
  stratum: FilledBoundaryStratum,
): 'Filled region' | 'Work-plane filled sheet' {
  return stratum.kind === 'filledRegion'
    ? 'Filled region'
    : 'Work-plane filled sheet'
}

export function formatClosedPathBoundarySummary(
  boundary: ClosedPathBoundary,
  ambientDimension: AmbientDimension,
): string {
  const endpoints = pathEndpoints(boundary.segments)
  const lineSegmentCount = countPathSegments(boundary.segments, 'line')
  const cubicSegmentCount = countPathSegments(boundary.segments, 'cubicBezier')
  const coordinateCount = pathCoordinates(boundary.segments).length
  const boundaryName =
    boundary.name === undefined || boundary.name.trim().length === 0
      ? `[${boundary.id}]`
      : `${boundary.name} [${boundary.id}]`
  const endpointSummary =
    endpoints === null
      ? 'no endpoints'
      : `${formatVec3(endpoints.start, ambientDimension)} to ${formatVec3(
          endpoints.end,
          ambientDimension,
        )}`
  const closureSummary = isClosedPathBoundary(boundary) ? 'closed' : 'open'

  return [
    boundaryName,
    `${formatCount(boundary.segments.length, 'segment')}`,
    `${formatCount(lineSegmentCount, 'line')}`,
    `${formatCount(cubicSegmentCount, 'cubic')}`,
    `${formatCount(coordinateCount, 'coordinate')}`,
    closureSummary,
    endpointSummary,
  ].join('; ')
}

function createFilledBoundaryGeometrySection(
  stratum: FilledBoundaryStratum,
  ambientDimension: AmbientDimension,
): InspectorSection {
  return {
    title: 'Geometry',
    fields: createFilledBoundaryGeometryFields(stratum, ambientDimension),
  }
}

function countPathSegments(
  segments: readonly PathSegment[],
  kind: PathSegment['kind'],
): number {
  return segments.filter((segment) => segment.kind === kind).length
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function createCurveGeometrySection(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
): InspectorSection {
  return {
    title: 'Geometry',
    fields: [
      { label: 'Curve kind', value: curve.kind },
      ...(curve.kind === 'concatenatedPath'
        ? [{ label: 'Segments', value: String(curve.segments.length) }]
        : []),
      ...(curve.kind === 'templatePath'
        ? templatePathSummaryFields(curve.template)
        : []),
      ...(curve.kind === 'grid'
        ? gridSummaryFields(curve, ambientDimension)
        : []),
      ...(curve.kind === 'cubicBezier'
        ? [
            {
              label: 'Bezier control mode',
              value: cubicBezierControlModeLabel(curve.bezierControls),
            },
          ]
        : []),
      { label: 'Style segments', value: String(curve.styleSegments.length) },
      ...describeCurvePoints(curve).map((description) => ({
        label: description.label,
        value: formatVec3(description.point, ambientDimension),
      })),
    ],
  }
}

function gridSummaryFields(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  ambientDimension: AmbientDimension,
): InspectorField[] {
  const preview = gridPreviewSegments(grid, ambientDimension)

  return [
    { label: 'Frame', value: grid.frame.kind },
    { label: 'Pattern', value: gridLatticePattern(grid) },
    {
      label: 'U range',
      value: formatGridRange(grid.uRange),
    },
    {
      label: 'V range',
      value: formatGridRange(grid.vRange),
    },
    {
      label: 'Clip',
      value: `u ${formatScalar(grid.clip.uMin)} to ${formatScalar(grid.clip.uMax)}, v ${formatScalar(grid.clip.vMin)} to ${formatScalar(grid.clip.vMax)}`,
    },
    {
      label: 'Preview lines',
      value: preview.ok ? String(preview.lineCount) : 'invalid',
    },
  ]
}

function formatGridRange(
  range: Extract<CurveStratum, { kind: 'grid' }>['uRange'],
): string {
  return `${formatScalar(range.min)} to ${formatScalar(range.max)} step ${formatScalar(range.step)}`
}

function formatScalar(
  value: Extract<CurveStratum, { kind: 'grid' }>['uRange']['min'],
): string {
  return value.kind === 'symbolic'
    ? `${value.expression} (${formatNumber(scalarInputPreviewValue(value))})`
    : formatNumber(value.value)
}

function templatePathSummaryFields(template: PathTemplate): InspectorField[] {
  switch (template.kind) {
    case 'circleTemplate':
      return [
        { label: 'Template', value: 'circle' },
        { label: 'Radius', value: formatNumber(template.radius) },
      ]
    case 'ellipseTemplate':
      return [
        { label: 'Template', value: 'ellipse' },
        { label: 'Radius x', value: formatNumber(template.radiusX) },
        { label: 'Radius y', value: formatNumber(template.radiusY) },
        { label: 'Rotation', value: formatNumber(template.rotationDeg ?? 0) },
      ]
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
      return joinStyleSummary([
        `fill color: ${style.fillColor}`,
        formatStyleNumber('fill opacity', style.fillOpacity),
        `stroke color: ${style.strokeColor}`,
        formatStyleNumber('stroke opacity', style.strokeOpacity),
      ])
    case 'curveStyle':
      return joinStyleSummary([
        `stroke color: ${style.strokeColor}`,
        formatStyleNumber('stroke opacity', style.strokeOpacity),
        formatStyleNumber('line width', style.lineWidth, 'pt'),
        `line style: ${style.lineStyle}`,
      ])
    case 'pointStyle':
      return joinStyleSummary([
        `color: ${style.color}`,
        formatStyleNumber('opacity', style.opacity),
        `shape: ${style.shape}`,
        `fill: ${style.fill}`,
        formatStyleNumber('size', style.size, 'pt'),
      ])
  }
}

export function formatLabelStyleSummary(style: LabelStyle): string {
  return joinStyleSummary([
    `color: ${style.color}`,
    formatStyleNumber('opacity', style.opacity),
    formatStyleNumber('font', style.fontSize, 'pt'),
    `anchor: ${style.anchor}`,
  ])
}

function stratumKindLabel(stratum: Stratum): string {
  if (stratum.geometricKind === 'region' && stratum.kind === 'filledRegion') {
    return 'Filled region'
  }

  if (
    stratum.geometricKind === 'sheet' &&
    stratum.kind === 'workPlaneFilledSheet'
  ) {
    return 'Work-plane filled sheet'
  }

  if (stratum.geometricKind === 'sheet' && stratum.kind === 'curvedSheet') {
    return 'Curved sheet'
  }

  switch (stratum.geometricKind) {
    case 'region':
      return 'Region'
    case 'sheet':
      return 'Sheet'
    case 'curve':
      return 'Curve'
    case 'point':
      return 'Point'
  }
}

function compactSummaryText(text: string): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const maxLength = 48

  return normalizedText.length <= maxLength
    ? normalizedText
    : `${normalizedText.slice(0, maxLength - 3)}...`
}

function joinStyleSummary(parts: Array<string | null>): string {
  const visibleParts = parts.filter((part): part is string => part !== null)
  return visibleParts.length === 0 ? 'none' : visibleParts.join('; ')
}

function formatStyleNumber(
  label: string,
  value: number | undefined,
  suffix = '',
): string | null {
  if (value === undefined || !Number.isFinite(value)) {
    return null
  }

  return `${label}: ${formatNumber(value)}${suffix}`
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) {
    return '0'
  }

  return String(Number(value.toFixed(3)))
}
