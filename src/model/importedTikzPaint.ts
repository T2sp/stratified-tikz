import type { HexColor, LineStyle, PointShape } from './types.ts'

/** Literal-only, bounded TikZ paint support. No TeX evaluation is performed. */
export const namedTikzColors: Readonly<Record<string, HexColor>> = {
  black: '#000000', white: '#FFFFFF', gray: '#808080', lightgray: '#BFBFBF',
  darkgray: '#404040', red: '#FF0000', green: '#00FF00', blue: '#0000FF',
  cyan: '#00FFFF', magenta: '#FF00FF', yellow: '#FFFF00', orange: '#FF8000',
  violet: '#800080', purple: '#BF0040', brown: '#BF8040', lime: '#BFFF00',
  olive: '#808000', pink: '#FFBFBF', teal: '#008080',
}
/** An own null binding shadows both an earlier literal and a built-in name. */
export type TikzColorBindings = Readonly<Record<string, HexColor | null>>
export type TikzPaintPreview = {
  color?: HexColor
  fillColor?: HexColor
  drawColor?: HexColor
  textColor?: HexColor
  opacity?: number
  fillOpacity?: number
  drawOpacity?: number
  textOpacity?: number
  fillEnabled?: boolean
  drawEnabled?: boolean
  lineStyle?: LineStyle
  lineWidth?: number
  dashPattern?: number[]
  dashPhase?: number
  lineCap?: 'butt' | 'round' | 'rect'
  lineJoin?: 'miter' | 'round' | 'bevel'
  pointShape?: PointShape
  pointSize?: number
  diagnostics?: string[]
  unresolvedFields?: string[]
  sourceDependencies?: string[]
}
export type TikzPreviewContext = {
  styles?: readonly { key: string; options?: string; sourceId?: string }[]
  colors?: TikzColorBindings
  colorSourceIds?: Readonly<Record<string, string>>
  sourceIds?: readonly string[]
  key?: string
}
/** Internal identity only: retain the user's key spelling in saved references. */
export function canonicalTikzStyleKey(key: string): string {
  const trimmed = key.trim()
  return trimmed.startsWith('/') ? trimmed : `/tikz/${trimmed}`
}
const thickness: Readonly<Record<string, number>> = {
  'ultra thin': .1, 'very thin': .2, thin: .4, semithick: .6,
  thick: .8, 'very thick': 1.2, 'ultra thick': 1.6,
}
const lineStyles: Readonly<Record<string, LineStyle>> = {
  solid: 'solid', dashed: 'dashed', dotted: 'dotted', 'densely dotted': 'denselyDotted',
}
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
export function literalTikzNumber(value: string): number | null {
  return decimal.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null
}
export function literalTikzDimension(value: string, signed = false): number | null {
  const match = value.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(pt|mm|cm|in|bp)?$/)
  if (!match) return null
  const number = Number(match[1])
  const factors: Record<string, number> = { pt: 1, mm: 72.27 / 25.4, cm: 72.27 / 2.54, in: 72.27, bp: 72.27 / 72 }
  const result = number * factors[match[2] ?? 'pt']
  return Number.isFinite(result) && (signed || result >= 0) ? result : null
}
export function literalTikzColor(value: string, colors: TikzColorBindings = {}, onBindingUse?: (name: string) => void): HexColor | null {
  const tokens = unbrace(value).split('!').map((token) => token.trim())
  const lookup = (name: string): HexColor | null | undefined => {
    if (Object.hasOwn(colors, name)) { onBindingUse?.(name); return colors[name] }
    return Object.hasOwn(namedTikzColors, name) ? namedTikzColors[name] : undefined
  }
  if (tokens.length > 33) return null
  // Collect every explicit/implicit operand dependency even when another
  // operand is unknown; the emitted external mixture still uses them all.
  const operands = [lookup(tokens[0])]
  for (let index = 1; index < tokens.length; index += 2) operands.push(lookup(tokens[index + 1] ?? 'white'))
  const first = operands[0]
  if (!first) return null
  let channels = [1, 3, 5].map((offset) => Number.parseInt(first.slice(offset, offset + 2), 16))
  for (let index = 1; index < tokens.length; index += 2) {
    const weight = literalTikzNumber(tokens[index])
    const second = operands[(index + 1) / 2]
    if (weight === null || weight < 0 || weight > 100 || !second) return null
    channels = [1, 3, 5].map((offset, index) =>
      channels[index] * weight / 100 +
      Number.parseInt(second.slice(offset, offset + 2), 16) * (1 - weight / 100),
    )
  }
  return rgbHex(channels)
}
export function literalDefinedColor(model: string, value: string): HexColor | null {
  if (model === 'HTML') return /^[\da-f]{6}$/i.test(value.trim()) ? `#${value.trim().toUpperCase()}` : null
  const channels = value.split(',').map((channel) => literalTikzNumber(channel))
  if (channels.some((channel) => channel === null)) return null
  const values = channels as number[]
  if (model === 'RGB' && values.length === 3 && values.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) return rgbHex(values)
  if (model === 'rgb' && values.length === 3 && values.every(unitInterval)) return rgbHex(values.map((v) => v * 255))
  if (model === 'gray' && values.length === 1 && unitInterval(values[0])) return rgbHex([values[0] * 255, values[0] * 255, values[0] * 255])
  return null
}
function rgbHex(values: readonly number[]): HexColor {
  return `#${values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
function unitInterval(value: number): boolean { return value >= 0 && value <= 1 }
function unbrace(value: string): string {
  const trimmed = value.trim()
  return trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed.slice(1, -1).trim() : trimmed
}
/** Split only outside balanced TeX groups, brackets and parentheses. */
export function splitTikzOptions(text: string): string[] {
  const result: string[] = []
  const stack: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '\\') { i += 1; continue }
    if ('{[('.includes(char)) stack.push(char)
    else if ('}])'.includes(char)) stack.pop()
    else if (char === ',' && stack.length === 0) { result.push(text.slice(start, i)); start = i + 1 }
  }
  result.push(text.slice(start))
  return result
}
export function resolveTikzPaint(options: string, context: TikzPreviewContext = {}): TikzPaintPreview {
  const preview: TikzPaintPreview = {}
  const diagnostics: string[] = []
  const unresolved = new Set<string>()
  const dependencies = new Set<string>()
  const color = (value: string): HexColor | null => literalTikzColor(value, context.colors, (name) => {
    const sourceId = context.colorSourceIds?.[name]
    if (sourceId !== undefined) dependencies.add(sourceId)
  })
  const paintFields = ['fillColor', 'fillEnabled', 'drawColor', 'drawEnabled', 'textColor', 'fillOpacity', 'drawOpacity', 'textOpacity', 'lineWidth', 'dashPattern', 'dashPhase', 'lineCap', 'lineJoin']
  const keyFields: Record<string, string[]> = {
    fill: ['fillColor', 'fillEnabled'], draw: ['drawColor', 'drawEnabled'], color: ['fillColor', 'drawColor', 'textColor'], text: ['textColor'],
    opacity: ['fillOpacity', 'drawOpacity'], 'fill opacity': ['fillOpacity'], 'draw opacity': ['drawOpacity'], 'text opacity': ['textOpacity'],
    'line width': ['lineWidth'], 'dash pattern': ['dashPattern'], 'dash phase': ['dashPhase'],
    'line cap': ['lineCap'], cap: ['lineCap'], 'line join': ['lineJoin'], join: ['lineJoin'],
  }
  const deferredShapeLayout = /^(?:shape(?: |$)|circle$|rectangle$|ellipse$|diamond$|trapezium(?: |$)|semicircle$|regular polygon(?: |$)|star(?: |$)|isosceles triangle(?: |$)|kite(?: |$)|dart(?: |$)|circular sector(?: |$)|cylinder(?: |$)|aspect$|inner |outer |minimum |anchor$|text (?:width|height|depth)$|align$|font$|node contents$)/
  const resolved = (...fields: string[]) => fields.forEach((field) => unresolved.delete(field))
  let work = 0
  const styles = new Map((context.styles ?? []).map((style) => [canonicalTikzStyleKey(style.key), style]))
  const warn = (message: string) => { if (diagnostics.length < 64 && !diagnostics.includes(message)) diagnostics.push(message) }
  // A .style body uses the invocation's active directory (/tikz for normal
  // nodes), not the declaration's parent directory. Keep this context shared
  // through nested expansion. Runtime .cd is deliberately unsupported; once
  // encountered, relative options remain unresolved instead of guessing a path.
  let runtimeDirectoryKnown = true
  const visit = (body: string, active: readonly string[]) => {
    if (body.length > 100_000) { warn('Preview option input exceeds the 100000-character bound.'); paintFields.forEach((field) => unresolved.add(field)); return }
    for (const rawOption of splitTikzOptions(body)) {
      const option = rawOption.trim()
      if (!option) continue
      work += 1
      if (work > 4096) { warn('Preview style expansion exceeds the 4096-option work bound.'); paintFields.forEach((field) => unresolved.add(field)); return }
      const equals = option.indexOf('=')
      const rawKey = equals < 0 ? option : option.slice(0, equals).trim()
      const key = rawKey.replace(/^\/tikz\//, '').replace(/\s+/g, ' ')
      const value = equals < 0 ? undefined : unbrace(option.slice(equals + 1))
      if (rawKey.endsWith('/.cd')) {
        warn(`Unsupported runtime key directory change: ${option}`)
        runtimeDirectoryKnown = false
        paintFields.forEach((field) => unresolved.add(field))
        continue
      }
      if (!runtimeDirectoryKnown && !rawKey.startsWith('/')) {
        warn(`Unresolved option after unsupported runtime key directory change: ${option}`)
        paintFields.forEach((field) => unresolved.add(field))
        continue
      }
      const canonicalKey = canonicalTikzStyleKey(rawKey)
      const reference = equals < 0 && styles.has(canonicalKey) ? canonicalKey : undefined
      if (reference !== undefined) {
        const definition = styles.get(reference)!
        if (definition.sourceId !== undefined) dependencies.add(definition.sourceId)
        if (active.includes(reference)) { warn(`Cyclic style reference: ${[...active, reference].join(' → ')}`); paintFields.forEach((field) => unresolved.add(field)) }
        else if (active.length >= 16) { warn('Preview style expansion exceeds the 16-level depth bound.'); paintFields.forEach((field) => unresolved.add(field)) }
        else visit(definition.options ?? '', [...active, reference])
        continue
      }
      const invalid = (affectedFields?: readonly string[]) => {
        warn(`Unsupported or invalid preview option: ${option}`)
        const fields = affectedFields ?? (Object.hasOwn(keyFields, key) ? keyFields[key] : deferredShapeLayout.test(key) ? [] : paintFields)
        fields.forEach((field) => unresolved.add(field))
      }
      if (key === 'draw' || key === 'fill') {
        const enabledKey = key === 'draw' ? 'drawEnabled' : 'fillEnabled'
        const colorKey = key === 'draw' ? 'drawColor' : 'fillColor'
        if (value === undefined || value === '') { preview[enabledKey] = true; resolved(enabledKey) }
        else if (value === 'none') { preview[enabledKey] = false; resolved(enabledKey) }
        else {
          const resolvedColor = color(value)
          if (resolvedColor === null) invalid()
          else { preview[enabledKey] = true; preview[colorKey] = resolvedColor; resolved(enabledKey, colorKey) }
        }
      } else if (key === 'opacity' || key === 'fill opacity' || key === 'draw opacity' || key === 'text opacity') {
        const alpha = value === undefined ? null : literalTikzNumber(value)
        if (alpha === null || !unitInterval(alpha)) invalid()
        else if (key === 'opacity') { preview.opacity = alpha; delete preview.fillOpacity; delete preview.drawOpacity; resolved('fillOpacity', 'drawOpacity') }
        else if (key === 'fill opacity') { preview.fillOpacity = alpha; resolved('fillOpacity') }
        else if (key === 'draw opacity') { preview.drawOpacity = alpha; resolved('drawOpacity') }
        else { preview.textOpacity = alpha; resolved('textOpacity') }
      } else if (key === 'color' || key === 'text') {
        const resolvedColor = value === undefined ? null : color(value)
        if (resolvedColor === null) invalid()
        else if (key === 'text') { preview.textColor = resolvedColor; resolved('textColor') }
        else { preview.color = resolvedColor; delete preview.drawColor; delete preview.fillColor; delete preview.textColor; resolved('fillColor', 'drawColor', 'textColor') }
      } else if (value === undefined && Object.hasOwn(thickness, key)) { preview.lineWidth = thickness[key]; resolved('lineWidth') }
      else if (value === undefined && Object.hasOwn(lineStyles, key)) { preview.lineStyle = lineStyles[key]; delete preview.dashPattern; resolved('dashPattern') }
      else if (key === 'line width' || key === 'inner sep' || key === 'dash phase') {
        const dimension = value === undefined ? null : literalTikzDimension(value, key === 'dash phase')
        if (dimension === null || ((key === 'inner sep' || key === 'line width') && dimension === 0)) invalid()
        else if (key === 'line width') { preview.lineWidth = dimension; resolved('lineWidth') }
        else if (key === 'inner sep') preview.pointSize = dimension * 2
        else { preview.dashPhase = dimension; resolved('dashPhase') }
      } else if (key === 'dash pattern' && value !== undefined) {
        if (value === '') { preview.lineStyle = 'solid'; delete preview.dashPattern; resolved('dashPattern'); continue }
        const segments = [...value.matchAll(/\b(on|off)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:pt|mm|cm|in|bp)?)/g)]
        const pattern = segments.map((segment) => literalTikzDimension(segment[2]))
        if (!segments.length || segments.length > 32 || segments.length % 2 !== 0 ||
          segments.map((segment) => segment[0]).join(' ').replace(/\s+/g, '') !== value.replace(/\s+/g, '') ||
          segments.some((segment, index) => segment[1] !== (index % 2 === 0 ? 'on' : 'off')) ||
          pattern.some((part) => part === null) || !pattern.some((part) => part !== null && part > 0)) invalid()
        else { preview.dashPattern = pattern as number[]; preview.lineStyle = 'solid'; resolved('dashPattern') }
      } else if ((key === 'line cap' || key === 'cap') && (value === 'butt' || value === 'round' || value === 'rect')) { preview.lineCap = value; resolved('lineCap') }
      else if ((key === 'line join' || key === 'join') && (value === 'miter' || value === 'round' || value === 'bevel')) { preview.lineJoin = value; resolved('lineJoin') }
      else if ((key === 'circle' && value === undefined) || (key === 'shape' && value === 'circle')) preview.pointShape = 'circle'
      else {
        const resolvedColor = value === undefined ? color(key) : null
        if (resolvedColor) { preview.color = resolvedColor; delete preview.drawColor; delete preview.fillColor; delete preview.textColor; resolved('fillColor', 'drawColor', 'textColor') }
        else if (value === undefined && (Object.hasOwn(context.colors ?? {}, key) || key.includes('!'))) invalid(['fillColor', 'drawColor', 'textColor'])
        else invalid()
      }
    }
  }
  visit(options, context.key ? [canonicalTikzStyleKey(context.key)] : [])
  if (diagnostics.length) preview.diagnostics = diagnostics
  if (unresolved.size) preview.unresolvedFields = [...unresolved]
  if (dependencies.size) preview.sourceDependencies = [...new Set([...(context.sourceIds ?? []), ...dependencies])].filter((sourceId) => dependencies.has(sourceId))
  return preview
}
