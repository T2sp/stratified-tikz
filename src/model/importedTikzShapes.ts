import { pointShapes, type HexColor, type PointShape, type PointShapeParameters } from './types.ts'
import { pointShapeParameterIssues } from './pointShapeParameters.ts'

/** Internal legacy aliases are not PGF shape names or reserved external keys. */
export const literalPointShapeNames = pointShapes.filter((shape) => shape !== 'square' && shape !== 'triangle')

export const pointShapeTikzKeys: Readonly<Record<keyof PointShapeParameters, string>> = {
  aspect: 'aspect', borderRotate: 'shape border rotate', borderUsesIncircle: 'shape border uses incircle',
  trapeziumLeftAngle: 'trapezium left angle', trapeziumRightAngle: 'trapezium right angle',
  trapeziumStretches: 'trapezium stretches', trapeziumStretchesBody: 'trapezium stretches body',
  regularPolygonSides: 'regular polygon sides', starPoints: 'star points',
  starPointHeight: 'star point height', starPointRatio: 'star point ratio', starPointMode: 'star point mode',
  isoscelesTriangleApexAngle: 'isosceles triangle apex angle', isoscelesTriangleStretches: 'isosceles triangle stretches',
  kiteUpperVertexAngle: 'kite upper vertex angle', kiteLowerVertexAngle: 'kite lower vertex angle',
  dartTipAngle: 'dart tip angle', dartTailAngle: 'dart tail angle', circularSectorAngle: 'circular sector angle',
  cylinderUsesCustomFill: 'cylinder uses custom fill', cylinderEndFill: 'cylinder end fill', cylinderBodyFill: 'cylinder body fill',
}
export const literalPointShapeKeys = Object.entries(pointShapeTikzKeys)
  .filter(([field]) => field !== 'starPointMode').map(([, key]) => key)
type ShapePreview = { pointShape?: PointShape; shapeParameters?: PointShapeParameters }
type ShapeParsers = {
  number: (value: string) => number | null
  dimension: (value: string) => number | null
  color: (value: string) => HexColor | null
  invalid: (fields: readonly string[]) => void
  resolved: (...fields: string[]) => void
}
const keyFields = new Map(Object.entries(pointShapeTikzKeys).filter(([field]) => field !== 'starPointMode').map(([field, key]) => [key, field as keyof PointShapeParameters]))
keyFields.set('shape aspect', 'aspect')
keyFields.set('star rotate', 'borderRotate')
const flags = new Set<keyof PointShapeParameters>(['borderUsesIncircle', 'trapeziumStretches', 'trapeziumStretchesBody', 'isoscelesTriangleStretches', 'cylinderUsesCustomFill'])

/** Mutate only the bounded preview, in original option order. Raw source is retained elsewhere. */
export function applyLiteralPointShapeOption(preview: ShapePreview, key: string, value: string | undefined, parsers: ShapeParsers): boolean {
  const shape = key === 'shape' ? value : value === undefined ? key : undefined
  if (shape !== undefined && (literalPointShapeNames as readonly string[]).includes(shape)) {
    preview.pointShape = shape as PointShape
    parsers.resolved('pointShape')
    return true
  }
  if (key === 'shape') { parsers.invalid(['pointShape']); return true }
  const assign = (field: keyof PointShapeParameters, input: unknown) => {
    const candidate = { [field]: input }
    // Dart ordering is validated after all ordered options, not against a
    // temporary default while parsing the first member of an angle pair.
    const issues = pointShapeParameterIssues(candidate).filter((issue) => !issue.message.startsWith('Dart tail'))
    if (issues.length) { parsers.invalid([`shapeParameters.${field}`]); return }
    preview.shapeParameters = { ...preview.shapeParameters, ...candidate }
    if (field === 'starPointHeight') preview.shapeParameters.starPointMode = 'height'
    if (field === 'starPointRatio') preview.shapeParameters.starPointMode = 'ratio'
    parsers.resolved(`shapeParameters.${field}`)
    if (field === 'starPointHeight' || field === 'starPointRatio') parsers.resolved('shapeParameters.starPointMode')
  }
  if (key === 'trapezium angle' || key === 'kite vertex angles') {
    const fields = key === 'trapezium angle' ? ['trapeziumLeftAngle', 'trapeziumRightAngle'] as const : ['kiteUpperVertexAngle', 'kiteLowerVertexAngle'] as const
    const parts = (value ?? '').split(/\s+and\s+/)
    if (parts.length > (key === 'trapezium angle' ? 1 : 2)) { parsers.invalid(fields.map((field) => `shapeParameters.${field}`)); return true }
    assign(fields[0], parsers.number(parts[0]))
    assign(fields[1], parsers.number(parts[1] ?? parts[0]))
    return true
  }
  const field = keyFields.get(key)
  if (field === undefined) return false
  if (flags.has(field)) assign(field, value === undefined || value === 'true' ? true : value === 'false' ? false : null)
  else if (field === 'cylinderEndFill' || field === 'cylinderBodyFill') assign(field, value === undefined ? null : parsers.color(value))
  else if (field === 'starPointHeight') assign(field, value === undefined ? null : parsers.dimension(value))
  else assign(field, value === undefined ? null : parsers.number(value))
  return true
}
