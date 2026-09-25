import {
  labelAnchors,
  lineStyles,
  pointFills,
  pointShapes,
  pointPaintFields,
} from './types.ts'
import type {
  CurveStyle,
  HexColor,
  LabelAnchor,
  LabelStyle,
  LineStyle,
  Opacity,
  PathSegmentStyleOverride,
  PointFill,
  PointPaint,
  PointPaintField,
  PointShape,
  PointStyle,
  RegionStyle,
  SheetStyle,
} from './types.ts'

export type StylePreset<TStyle> = {
  id: string
  name: string
  style: TStyle
}

export const defaultRegionStyle: RegionStyle = {
  kind: 'regionStyle',
  fillColor: '#FFFFFF',
  fillOpacity: 0,
  strokeColor: '#000000',
  strokeOpacity: 0,
}

export const defaultSheetStyle: SheetStyle = {
  kind: 'sheetStyle',
  fillColor: '#4D9DE0',
  fillOpacity: 0.35,
  strokeColor: '#4D9DE0',
  strokeOpacity: 1,
}

export const defaultCurveStyle: CurveStyle = {
  kind: 'curveStyle',
  strokeColor: '#000000',
  strokeOpacity: 1,
  lineWidth: 1.2,
  lineStyle: 'solid',
}

export const defaultPointStyle: PointStyle = {
  kind: 'pointStyle',
  color: '#000000',
  opacity: 1,
  shape: 'circle',
  fill: 'filled',
  size: 3,
}

export const defaultLabelStyle: LabelStyle = {
  kind: 'labelStyle',
  color: '#000000',
  opacity: 1,
  fontSize: 10,
  anchor: 'center',
}

export const regionStylePresets: readonly StylePreset<RegionStyle>[] = [
  {
    id: 'blueTranslucentRegion',
    name: 'Blue translucent',
    style: {
      kind: 'regionStyle',
      fillColor: '#4D9DE0',
      fillOpacity: 0.35,
      strokeColor: '#4D9DE0',
      strokeOpacity: 1,
    },
  },
  {
    id: 'redTranslucentRegion',
    name: 'Red translucent',
    style: {
      kind: 'regionStyle',
      fillColor: '#E76F51',
      fillOpacity: 0.28,
      strokeColor: '#C44536',
      strokeOpacity: 0.9,
    },
  },
] as const

export const sheetStylePresets: readonly StylePreset<SheetStyle>[] = [
  {
    id: 'blueTranslucentSheet',
    name: 'Blue translucent',
    style: {
      kind: 'sheetStyle',
      fillColor: '#4D9DE0',
      fillOpacity: 0.35,
      strokeColor: '#4D9DE0',
      strokeOpacity: 1,
    },
  },
  {
    id: 'redTranslucentSheet',
    name: 'Red translucent',
    style: {
      kind: 'sheetStyle',
      fillColor: '#E76F51',
      fillOpacity: 0.28,
      strokeColor: '#C44536',
      strokeOpacity: 0.9,
    },
  },
] as const

export const curveStylePresets: readonly StylePreset<CurveStyle>[] = [
  {
    id: 'blackSolidCurve',
    name: 'Black solid',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
  },
  {
    id: 'blackDenselyDottedCurve',
    name: 'Black densely dotted',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'denselyDotted',
    },
  },
] as const

export const pointStylePresets: readonly StylePreset<PointStyle>[] = [
  {
    id: 'blackFilledCirclePoint',
    name: 'Black filled circle',
    style: {
      kind: 'pointStyle',
      color: '#000000',
      opacity: 1,
      shape: 'circle',
      fill: 'filled',
      size: 3,
    },
  },
  {
    id: 'blackHollowCirclePoint',
    name: 'Black hollow circle',
    style: {
      kind: 'pointStyle',
      color: '#000000',
      opacity: 1,
      shape: 'circle',
      fill: 'hollow',
      size: 3,
    },
  },
  {
    id: 'blackFilledSquarePoint',
    name: 'Black filled square',
    style: {
      kind: 'pointStyle',
      color: '#000000',
      opacity: 1,
      shape: 'square',
      fill: 'filled',
      size: 3.5,
    },
  },
  {
    id: 'blackHollowSquarePoint',
    name: 'Black hollow square',
    style: {
      kind: 'pointStyle',
      color: '#000000',
      opacity: 1,
      shape: 'square',
      fill: 'hollow',
      size: 3.5,
    },
  },
] as const

export function cloneStylePreset<TStyle extends object>(preset: {
  readonly style: TStyle
}): TStyle {
  return structuredClone(preset.style)
}

export function cloneRegionStyle(style: RegionStyle): RegionStyle {
  return { ...style }
}

export function cloneSheetStyle(style: SheetStyle): SheetStyle {
  return { ...style }
}

export function cloneCurveStyle(style: CurveStyle): CurveStyle {
  return { ...style }
}

export function resolveCurveStyle(
  baseStyle: CurveStyle,
  override: PathSegmentStyleOverride | undefined,
): CurveStyle {
  return {
    ...baseStyle,
    ...(override ?? {}),
    kind: 'curveStyle',
  }
}

export function curveStylesEqual(first: CurveStyle, second: CurveStyle): boolean {
  return (
    first.strokeColor === second.strokeColor &&
    first.strokeOpacity === second.strokeOpacity &&
    first.lineWidth === second.lineWidth &&
    first.lineStyle === second.lineStyle
  )
}

export function hasCurveStyleOverride(
  override: PathSegmentStyleOverride | undefined,
): boolean {
  return (
    override !== undefined &&
    (override.strokeColor !== undefined ||
      override.strokeOpacity !== undefined ||
      override.lineWidth !== undefined ||
      override.lineStyle !== undefined)
  )
}

/** Resolve legacy paint without mutating a diagram or its historical state. */
export function getPointPaint(style: PointStyle): PointPaint {
  return style.paint ?? {
    text: { color: '#000000', opacity: 1 },
    fill: { enabled: true, color: style.fill === 'hollow' ? '#FFFFFF' : style.color, opacity: 1 },
    stroke: { enabled: true, color: style.color, opacity: 1, width: 0.4,
      lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' },
  }
}

export function clonePointPaint(paint: PointPaint): PointPaint {
  return {
    text: { ...paint.text },
    fill: { ...paint.fill },
    stroke: { ...paint.stroke,
      ...(paint.stroke.dashPattern === undefined ? {} : { dashPattern: [...paint.stroke.dashPattern] }) },
  }
}

export function clonePointStyle(style: PointStyle): PointStyle {
  return { ...style, ...(style.paint === undefined ? {} : { paint: clonePointPaint(style.paint) }),
    ...(style.importedPaint === undefined ? {} : { importedPaint: {
      ...style.importedPaint, baseline: clonePointPaint(style.importedPaint.baseline),
      overriddenFields: [...style.importedPaint.overriddenFields],
    } }) }
}

/** Saved-file v2 writes explicit paint; Diagram.version remains 1. */
export function normalizePointStyle(style: PointStyle): PointStyle {
  return { ...clonePointStyle(style), paint: clonePointPaint(getPointPaint(style)) }
}

export function createImportedPointPaintSnapshot(style: PointStyle, referenceId: string): PointStyle {
  return { ...clonePointStyle(style), importedPaint: {
    referenceId, baseline: clonePointPaint(getPointPaint(style)), overriddenFields: [],
  } }
}

/** Clear provenance when a style is detached from or assigned another reference. */
export function pointStyleForImportedReference(style: PointStyle, referenceId: string | undefined): PointStyle {
  const result = clonePointStyle(style)
  if (result.importedPaint?.referenceId !== referenceId) delete result.importedPaint
  return result
}

export function pointPaintFieldValue(style: PointStyle, field: PointPaintField): unknown {
  if (field === 'opacity') return style.opacity
  const paint = getPointPaint(style)
  const [channel, property] = field.split('.')
  return Object.entries(paint[channel as keyof PointPaint]).find(([key]) => key === property)?.[1]
}

export function changedPointPaintFields(before: PointStyle, after: PointStyle): PointPaintField[] {
  return pointPaintFields.filter((field) =>
    JSON.stringify(pointPaintFieldValue(before, field)) !== JSON.stringify(pointPaintFieldValue(after, field)))
}

/** Also call for accepted equal-valued controls: value equality cannot encode intent. */
export function markPointPaintOverrides(style: PointStyle, fields: readonly PointPaintField[]): PointStyle {
  const result = clonePointStyle(style)
  if (result.importedPaint !== undefined) {
    const overridden = new Set([...result.importedPaint.overriddenFields, ...fields])
    result.importedPaint.overriddenFields = pointPaintFields.filter((field) => overridden.has(field))
  }
  return result
}

/** Capture distinguishable historical/manual edits without claiming equal fallbacks. */
export function recordPointPaintEdit(before: PointStyle, after: PointStyle): PointStyle {
  const result = clonePointStyle(after)
  if (before.importedPaint === undefined) return result
  const inherited = result.importedPaint?.referenceId === before.importedPaint.referenceId
    ? result.importedPaint.overriddenFields : []
  result.importedPaint = {
    referenceId: before.importedPaint.referenceId,
    baseline: clonePointPaint(before.importedPaint.baseline),
    overriddenFields: [...before.importedPaint.overriddenFields, ...inherited],
  }
  return markPointPaintOverrides(result, changedPointPaintFields(before, after))
}

/** Refresh importer snapshots only; legacy explicit styles have no provenance. */
export function refreshImportedPointPaintSnapshot(style: PointStyle, resolvedStyle: PointStyle, referenceId: string): PointStyle {
  if (style.importedPaint?.referenceId !== referenceId) return style
  const oldBaseline: PointStyle = { ...style, paint: style.importedPaint.baseline, opacity: 1 }
  const result = markPointPaintOverrides(style, changedPointPaintFields(oldBaseline, style))
  const overridden = new Set(result.importedPaint?.overriddenFields)
  const paint = clonePointPaint(getPointPaint(style))
  const resolved = getPointPaint(resolvedStyle)
  // Channel-wise copying retains optional dash-pattern deletion as a real value.
  for (const channel of ['text', 'fill', 'stroke'] as const) {
    const keys = new Set([...Object.keys(paint[channel]), ...Object.keys(resolved[channel])])
    for (const property of keys) {
      if (overridden.has(`${channel}.${property}` as PointPaintField)) continue
      const value: unknown = Reflect.get(resolved[channel], property)
      if (value === undefined) Reflect.deleteProperty(paint[channel], property)
      else Reflect.set(paint[channel], property, Array.isArray(value) ? [...value] : value)
    }
  }
  return { ...result, paint, importedPaint: {
    referenceId, baseline: clonePointPaint(resolved), overriddenFields: [...overridden],
  } }
}

/** Legacy combined-color control updates fill and border, preserving text paint. */
export function updatePointColor(style: PointStyle, color: HexColor): PointStyle {
  const paint = clonePointPaint(getPointPaint(style))
  paint.stroke.color = color
  if (style.fill === 'filled') paint.fill.color = color
  return markPointPaintOverrides({ ...style, color, paint }, style.fill === 'filled'
    ? ['stroke.color', 'fill.color'] : ['stroke.color'])
}

/** Hollow remains an opaque-white fill; transparency is fill.enabled=false. */
export function updatePointFill(style: PointStyle, fill: PointFill): PointStyle {
  const paint = clonePointPaint(getPointPaint(style))
  paint.fill = { enabled: true, color: fill === 'hollow' ? '#FFFFFF' : paint.stroke.color, opacity: 1 }
  return markPointPaintOverrides({ ...style, fill, paint }, ['fill.enabled', 'fill.color', 'fill.opacity'])
}

export function pointStylesEqual(first: PointStyle, second: PointStyle): boolean {
  if (first.opacity !== second.opacity || first.shape !== second.shape || first.size !== second.size) return false
  if (JSON.stringify(first.importedPaint) !== JSON.stringify(second.importedPaint)) return false
  const a = getPointPaint(first)
  const b = getPointPaint(second)
  return a.text.color === b.text.color && a.text.opacity === b.text.opacity &&
    a.fill.enabled === b.fill.enabled && a.fill.color === b.fill.color && a.fill.opacity === b.fill.opacity &&
    a.stroke.enabled === b.stroke.enabled && a.stroke.color === b.stroke.color &&
    a.stroke.opacity === b.stroke.opacity && a.stroke.width === b.stroke.width &&
    a.stroke.lineStyle === b.stroke.lineStyle && a.stroke.dashPhase === b.stroke.dashPhase &&
    a.stroke.lineCap === b.stroke.lineCap && a.stroke.lineJoin === b.stroke.lineJoin &&
    JSON.stringify(a.stroke.dashPattern) === JSON.stringify(b.stroke.dashPattern)
}

export function cloneLabelStyle(style: LabelStyle): LabelStyle {
  return { ...style }
}

export function isHexColor(value: string): value is HexColor {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function isOpacity(value: number): value is Opacity {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

export function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

export function isLineStyle(value: string): value is LineStyle {
  return includesStringValue(lineStyles, value)
}

export function isPointShape(value: string): value is PointShape {
  return includesStringValue(pointShapes, value)
}

export function isPointFill(value: string): value is PointFill {
  return includesStringValue(pointFills, value)
}

export function isLabelAnchor(value: string): value is LabelAnchor {
  return includesStringValue(labelAnchors, value)
}

function includesStringValue<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return (values as readonly string[]).includes(value)
}
