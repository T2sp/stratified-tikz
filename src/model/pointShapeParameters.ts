import type { PointShapeParameters, PointShapeField, PointStyle } from './types.ts'

/** TeX points, degrees and dimensionless ratios. Counts bound contour work. */
export const defaultPointShapeParameters: Readonly<Required<PointShapeParameters>> = {
  aspect: 1, borderRotate: 0, borderUsesIncircle: false,
  trapeziumLeftAngle: 60, trapeziumRightAngle: 60,
  trapeziumStretches: false, trapeziumStretchesBody: false,
  regularPolygonSides: 5, starPoints: 5, starPointHeight: 72.27 / 2.54 * .5,
  starPointRatio: 1.5, starPointMode: 'ratio',
  isoscelesTriangleApexAngle: 45, isoscelesTriangleStretches: false,
  kiteUpperVertexAngle: 120, kiteLowerVertexAngle: 60,
  dartTipAngle: 45, dartTailAngle: 135, circularSectorAngle: 60,
  cylinderUsesCustomFill: false, cylinderEndFill: '#FFFFFF', cylinderBodyFill: '#FFFFFF',
}
export const pointShapeParameterKeys = Object.keys(defaultPointShapeParameters) as (keyof PointShapeParameters)[]
export const pointShapeFields: readonly PointShapeField[] = ['shape', ...pointShapeParameterKeys]
export function resolvePointShapeParameters(parameters?: PointShapeParameters): Required<PointShapeParameters> {
  return { ...defaultPointShapeParameters, ...parameters }
}

export type PointShapeParameterIssue = { field: string; message: string }
export function pointShapeParameterIssues(parameters: unknown): PointShapeParameterIssue[] {
  if (parameters === undefined) return []
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) return [{ field: '', message: 'Shape parameters must be an object.' }]
  const result: PointShapeParameterIssue[] = []
  for (const [key, value] of Object.entries(parameters)) {
    const reject = (message: string) => result.push({ field: key, message })
    if (!Object.hasOwn(defaultPointShapeParameters, key)) { reject('Unsupported shape parameter.'); continue }
    const fallback = defaultPointShapeParameters[key as keyof PointShapeParameters]
    if (typeof fallback === 'boolean') { if (typeof value !== 'boolean') reject('Shape flag must be boolean.'); continue }
    if (key === 'starPointMode') { if (value !== 'height' && value !== 'ratio') reject('Star mode must be height or ratio.'); continue }
    if (typeof fallback === 'string') { if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) reject('Shape fill must be a #RRGGBB color.'); continue }
    if (typeof value !== 'number' || !Number.isFinite(value)) { reject('Shape number must be finite.'); continue }
    if (key === 'regularPolygonSides' || key === 'starPoints') {
      if (!Number.isInteger(value) || value < 3 || value > 64) reject('Shape count must be an integer from 3 to 64.')
    } else if (key === 'borderRotate') {
      if (Math.abs(value) > 360_000) reject('Border rotation must be within ±360000 degrees.')
    } else if (key === 'circularSectorAngle') {
      if (value < 1 || value > 179) reject('Sector angle must be between 1 and 179 degrees; PGF body fitting requires an angle below 180.')
    } else if (key.endsWith('Angle')) {
      if (value < 1 || value > 179) reject('Vertex angle must be between 1 and 179 degrees.')
    } else if (key === 'starPointHeight') {
      if (value < 0 || value > 10_000) reject('Star point height must be between 0 and 10000pt.')
    } else if (key === 'starPointRatio') {
      if (value < 1 || value > 100) reject('Star ratio must be between 1 and 100.')
    } else if (key === 'aspect' && (value < .01 || value > 100)) reject('Aspect must be between 0.01 and 100.')
  }
  const values = parameters as PointShapeParameters
  if ((values.dartTipAngle !== undefined || values.dartTailAngle !== undefined) &&
      (values.dartTipAngle ?? 45) >= (values.dartTailAngle ?? 135)) result.push({ field: 'dartTailAngle', message: 'Dart tail angle must exceed its tip angle.' })
  return result
}

/** Explicit local edits remain authoritative even when imported execution is uncertain. */
export function markPointShapeOverrides(style: PointStyle, fields: readonly PointShapeField[]): PointStyle {
  if (style.importedShape === undefined) return style
  const overridden = new Set([...style.importedShape.overriddenFields, ...fields])
  return { ...style, importedShape: { ...style.importedShape, overriddenFields: pointShapeFields.filter((field) => overridden.has(field)) } }
}

export function changedPointShapeFields(before: PointStyle, after: PointStyle): PointShapeField[] {
  const a = resolvePointShapeParameters(before.shapeParameters)
  const b = resolvePointShapeParameters(after.shapeParameters)
  return [...(before.shape === after.shape ? [] : ['shape' as const]), ...pointShapeParameterKeys.filter((key) => a[key] !== b[key])]
}
