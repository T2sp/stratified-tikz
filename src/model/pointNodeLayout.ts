import type { PointNodeDimensionField, PointNodeDimensionSource, PointNodeDimensionUnit, PointNodeFontContext, PointNodeLayoutField, PointNodeLayoutOptions, PointStyle } from './types.ts'

/** TeX Computer Modern 10pt context. Font/paragraph execution is not supported. */
export const defaultPointNodeFontContext: Readonly<PointNodeFontContext> = { fontSizePt: 10, xHeightPt: 4.30554 }
export const pointNodeDimensionFields: readonly PointNodeDimensionField[] = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
export const pointNodeLayoutFields: readonly PointNodeLayoutField[] = [...pointNodeDimensionFields, 'anchor']
export const pointNodeLayoutTikzKeys: Readonly<Record<PointNodeLayoutField, string>> = {
  innerXSep: 'inner xsep', innerYSep: 'inner ysep', outerXSep: 'outer xsep', outerYSep: 'outer ysep',
  minimumWidth: 'minimum width', minimumHeight: 'minimum height', anchor: 'anchor',
}
export const literalPointLayoutKeys = ['inner sep', 'outer sep', 'minimum size', ...Object.values(pointNodeLayoutTikzKeys)]
const units: readonly PointNodeDimensionUnit[] = ['pt', 'mm', 'cm', 'in', 'bp', 'em', 'ex']
const limitPt = 10_000

export function parsePointNodeDimension(source: string, context: PointNodeFontContext = defaultPointNodeFontContext): PointNodeDimensionSource | null {
  const match = source.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(pt|mm|cm|in|bp|em|ex)?$/)
  if (!match) return null
  const unit = (match[2] ?? 'pt') as PointNodeDimensionUnit
  const factors: Record<PointNodeDimensionUnit, number> = {
    pt: 1, mm: 72.27 / 25.4, cm: 72.27 / 2.54, in: 72.27, bp: 72.27 / 72,
    em: context.fontSizePt, ex: context.xHeightPt,
  }
  const texPoints = Number(match[1]) * factors[unit]
  return Number.isFinite(texPoints) && Math.abs(texPoints) <= limitPt ? {
    source, unit, texPoints, ...(unit === 'em' || unit === 'ex' ? { fontContext: { ...context } } : {}),
  } : null
}

export function isPointNodeAnchorLiteral(value: string): boolean {
  return value.length > 0 && value.length <= 100 && /^[a-zA-Z0-9 .+-]+$/.test(value) && value.trim().length > 0
}

export type ResolvedPointNodeLayoutOptions = Record<PointNodeDimensionField, number> & { anchor: string; fontContext: PointNodeFontContext }
export function resolvePointNodeLayoutOptions(style: Pick<PointStyle, 'size' | 'paint' | 'layout'>, lineWidthPt = style.paint?.stroke.width ?? .4): ResolvedPointNodeLayoutOptions {
  const layout = style.layout
  return {
    innerXSep: layout?.innerXSep ?? style.size / 2, innerYSep: layout?.innerYSep ?? style.size / 2,
    outerXSep: layout?.outerXSep ?? lineWidthPt / 2, outerYSep: layout?.outerYSep ?? lineWidthPt / 2,
    minimumWidth: layout?.minimumWidth ?? 1, minimumHeight: layout?.minimumHeight ?? 1,
    anchor: layout?.anchor ?? 'center', fontContext: { ...defaultPointNodeFontContext, ...layout?.fontContext },
  }
}
export function pointLayoutIdentity(style: Pick<PointStyle, 'size' | 'paint' | 'layout'>): string { return JSON.stringify(resolvePointNodeLayoutOptions(style)) }
export function clonePointNodeLayout(layout: PointNodeLayoutOptions): PointNodeLayoutOptions {
  return { ...layout, ...(layout.fontContext ? { fontContext: { ...layout.fontContext } } : {}),
    ...(layout.units ? { units: Object.fromEntries(Object.entries(layout.units).map(([key, value]) => [key, clonePointNodeDimensionSource(value, layout.fontContext)])) } : {}) }
}
/** Capture legacy global context before combining independently authored axes. */
export function clonePointNodeDimensionSource(source: PointNodeDimensionSource, legacyContext?: PointNodeFontContext): PointNodeDimensionSource {
  const context = source.fontContext ?? ((source.unit === 'em' || source.unit === 'ex') ? legacyContext : undefined)
  return { ...source, ...(context ? { fontContext: { ...context } } : {}) }
}
export function changedPointLayoutFields(before: PointStyle, after: PointStyle): PointNodeLayoutField[] {
  // Omission and explicit values are distinct: a later imported style update
  // must never turn an accepted equal-valued local control into inheritance.
  return pointNodeLayoutFields.filter((field) => before.layout?.[field] !== after.layout?.[field])
}
export function markPointLayoutOverrides(style: PointStyle, fields: readonly PointNodeLayoutField[]): PointStyle {
  if (!style.importedLayout) return style
  const overridden = new Set([...style.importedLayout.overriddenFields, ...fields])
  return { ...style, importedLayout: { ...style.importedLayout, overriddenFields: pointNodeLayoutFields.filter((field) => overridden.has(field)) } }
}
export function updatePointNodeDimension(style: PointStyle, fields: readonly PointNodeDimensionField[], source: string): PointStyle | null {
  const layout = clonePointNodeLayout(style.layout ?? {})
  // A single-axis edit keeps that source's context. A shorthand deliberately
  // assigns both axes using the current common input context.
  const context = fields.length === 1 ? layout.units?.[fields[0]]?.fontContext ?? layout.fontContext : layout.fontContext
  const dimension = source.trim() === '' ? undefined : parsePointNodeDimension(source, context)
  if (dimension === null) return null
  for (const field of fields) {
    if (dimension === undefined) { delete layout[field]; if (layout.units) delete layout.units[field] }
    else { layout[field] = dimension.texPoints; layout.units = { ...layout.units, [field]: clonePointNodeDimensionSource(dimension) } }
  }
  if (dimension?.unit === 'em' || dimension?.unit === 'ex') layout.fontContext = { ...defaultPointNodeFontContext, ...layout.fontContext }
  return markPointLayoutOverrides({ ...style, layout }, fields)
}
/** Editing legacy size returns both padding axes to the single legacy source. */
export function updateLegacyPointSize(style: PointStyle, size: number): PointStyle {
  const result = updatePointNodeDimension(style, ['innerXSep', 'innerYSep'], '')
  return { ...(result ?? style), size }
}

/** Ordered PGF shorthand resolution: each shorthand writes both axes now. */
export function applyLiteralPointLayoutOption(preview: { pointLayout?: PointNodeLayoutOptions; pointSize?: number }, key: string,
  value: string | undefined, context: PointNodeFontContext | undefined,
  invalid: (fields: readonly string[]) => void, resolved: (...fields: string[]) => void): boolean {
  if (!literalPointLayoutKeys.includes(key)) return false
  const fields: readonly PointNodeLayoutField[] = key === 'inner sep' ? ['innerXSep', 'innerYSep']
    : key === 'outer sep' ? ['outerXSep', 'outerYSep'] : key === 'minimum size' ? ['minimumWidth', 'minimumHeight']
      : pointNodeLayoutFields.filter((field) => pointNodeLayoutTikzKeys[field] === key)
  const unresolved = fields.map((field) => `pointLayout.${field}`)
  if (key === 'anchor') {
    if (value === undefined || !isPointNodeAnchorLiteral(value)) invalid(unresolved)
    else { preview.pointLayout = { ...preview.pointLayout, anchor: value }; resolved(...unresolved) }
    return true
  }
  const dimension = value === undefined ? null : parsePointNodeDimension(value, context)
  if (dimension === null) { invalid(unresolved); return true }
  const layout = clonePointNodeLayout(preview.pointLayout ?? {})
  for (const field of fields as readonly PointNodeDimensionField[]) {
    layout[field] = dimension.texPoints
    layout.units = { ...layout.units, [field]: clonePointNodeDimensionSource(dimension) }
  }
  if (dimension.unit === 'em' || dimension.unit === 'ex') layout.fontContext = { ...defaultPointNodeFontContext, ...context }
  preview.pointLayout = layout
  // Compatibility observation only: explicit layout axes are authoritative.
  if (key === 'inner sep' && dimension.texPoints > 0) preview.pointSize = dimension.texPoints * 2
  resolved(...unresolved)
  return true
}

export type PointNodeLayoutIssue = { field: string; message: string }
export function pointNodeLayoutIssues(value: unknown): PointNodeLayoutIssue[] {
  if (value === undefined) return []
  if (!isRecord(value)) return [{ field: '', message: 'Point layout must be an object.' }]
  const result: PointNodeLayoutIssue[] = []
  const reject = (field: string, message: string) => result.push({ field, message })
  for (const [field, input] of Object.entries(value)) {
    if ((pointNodeDimensionFields as readonly string[]).includes(field)) {
      if (typeof input !== 'number' || !Number.isFinite(input) || Math.abs(input) > limitPt) reject(field, 'Dimension must be finite and within ±10000 TeX pt.')
    } else if (field === 'anchor') {
      if (typeof input !== 'string' || !isPointNodeAnchorLiteral(input)) reject(field, 'Anchor must be a bounded literal name or numeric angle; arbitrary TeX is unsupported.')
    } else if (field === 'fontContext') {
      if (!isPointNodeFontContext(input)) reject(field, 'Font unit context must contain finite positive fontSizePt and xHeightPt within 1000pt.')
    } else if (field === 'units') {
      if (!isRecord(input)) { reject(field, 'Dimension sources must be an object.'); continue }
      for (const [axis, metadata] of Object.entries(input)) {
        if (!(pointNodeDimensionFields as readonly string[]).includes(axis) || !isRecord(metadata) || typeof metadata.source !== 'string' ||
            typeof metadata.unit !== 'string' || !(units as readonly string[]).includes(metadata.unit) || typeof metadata.texPoints !== 'number') {
          reject(`units.${axis}`, 'Dimension metadata must contain its source, unit and resolved TeX points.'); continue
        }
        if (metadata.fontContext !== undefined && !isPointNodeFontContext(metadata.fontContext)) {
          reject(`units.${axis}.fontContext`, 'Axis font context must contain finite positive fontSizePt and xHeightPt within 1000pt.'); continue
        }
        const context = isPointNodeFontContext(metadata.fontContext) ? metadata.fontContext
          : isPointNodeFontContext(value.fontContext) ? value.fontContext : defaultPointNodeFontContext
        const parsed = parsePointNodeDimension(metadata.source, context)
        if (!parsed || parsed.unit !== metadata.unit || parsed.texPoints !== metadata.texPoints || metadata.texPoints !== value[axis]) reject(`units.${axis}`, 'Dimension metadata must match its authoritative resolved axis and font context.')
        if ((metadata.unit === 'em' || metadata.unit === 'ex') && metadata.fontContext === undefined && value.fontContext === undefined) reject(`units.${axis}`, 'Contextual dimensions require a recorded font context.')
      }
    } else reject(field, 'Unsupported point layout property.')
  }
  return result
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function isPointNodeFontContext(value: unknown): value is PointNodeFontContext {
  return isRecord(value) && Object.keys(value).every((key) => key === 'fontSizePt' || key === 'xHeightPt') &&
    typeof value.fontSizePt === 'number' && Number.isFinite(value.fontSizePt) && value.fontSizePt > 0 && value.fontSizePt <= 1000 &&
    typeof value.xHeightPt === 'number' && Number.isFinite(value.xHeightPt) && value.xHeightPt > 0 && value.xHeightPt <= 1000
}
