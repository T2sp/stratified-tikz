import { applyLiteralPointShapeOption } from './importedTikzShapes.ts'
import { pointShapeParameterKeys, pointShapeParameterIssues } from './pointShapeParameters.ts'
import type { HexColor, LineStyle, PointShape, PointShapeParameters } from './types.ts'

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
  shapeParameters?: PointShapeParameters
  pointShape?: PointShape
  pointSize?: number
  diagnostics?: string[]
  unresolvedFields?: string[]
  sourceDependencies?: string[]
  /** Derived per invocation: color bindings/key handlers may have changed. */
  executionUncertain?: boolean
}
export type TikzStylePreviewDefinition = {
  key: string
  options?: string
  sourceId?: string
  sourceDependencies?: readonly string[]
  dependencyOptions?: readonly string[]
  executionUncertain?: boolean
} & (
  | { state?: 'known' }
  | { state: 'unresolved'; diagnostics: readonly string[] }
)
export type TikzPreviewContext = {
  styles?: readonly TikzStylePreviewDefinition[]
  colors?: TikzColorBindings
  colorSourceIds?: Readonly<Record<string, string>>
  sourceIds?: readonly string[]
  /** Unknown source execution can redefine any style, color or key handler. */
  sourceDiagnostics?: readonly string[]
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
  const shapeFields = ['pointShape', ...pointShapeParameterKeys.map((field) => `shapeParameters.${field}`)]
  const paintFields = ['fillColor', 'fillEnabled', 'drawColor', 'drawEnabled', 'textColor', 'fillOpacity', 'drawOpacity', 'textOpacity', 'lineWidth', 'dashPattern', 'dashPhase', 'lineCap', 'lineJoin']
  // No safe prefix/suffix or local key boundary exists for a rejected saved
  // source. Do not traverse legacy options: even built-in color bindings and
  // absolute option handlers may have changed. The caller supplies a visible
  // fallback while these fields prohibit authoritative post-key paint.
  if (context.sourceDiagnostics?.length) return {
    executionUncertain: true,
    diagnostics: context.sourceDiagnostics.slice(0, 64),
    unresolvedFields: [...paintFields, ...shapeFields],
    sourceDependencies: [...(context.sourceIds ?? [])],
  }
  const keyFields: Record<string, string[]> = {
    fill: ['fillColor', 'fillEnabled'], draw: ['drawColor', 'drawEnabled'], color: ['fillColor', 'drawColor', 'textColor'], text: ['textColor'],
    opacity: ['fillOpacity', 'drawOpacity'], 'fill opacity': ['fillOpacity'], 'draw opacity': ['drawOpacity'], 'text opacity': ['textOpacity'],
    'line width': ['lineWidth'], 'dash pattern': ['dashPattern'], 'dash phase': ['dashPhase'],
    'line cap': ['lineCap'], cap: ['lineCap'], 'line join': ['lineJoin'], join: ['lineJoin'],
  }
  const deferredShapeLayout = /^(?:shape(?: |$)|circle$|rectangle$|ellipse$|diamond$|trapezium(?: |$)|semicircle$|regular polygon(?: |$)|star(?: |$)|isosceles triangle(?: |$)|kite(?: |$)|dart(?: |$)|circular sector(?: |$)|cylinder(?: |$)|aspect$|inner |outer |minimum |anchor$|text (?:width|height|depth)$|align$|font$|node contents$)/
  let bindingsKnown = true
  const resolved = (...fields: string[]) => {
    if (bindingsKnown) fields.forEach((field) => unresolved.delete(field))
  }
  let work = 0
  const styles = new Map((context.styles ?? []).map((style) => [canonicalTikzStyleKey(style.key), style]))
  const warn = (message: string) => { if (diagnostics.length < 64 && !diagnostics.includes(message)) diagnostics.push(message) }
  // Dependency discovery is deliberately separate from paint resolution. An
  // unsupported style-list mutation can require nested styles and colors even
  // though none of its option values are safe to apply to the preview. Return
  // whether its invocation directory stays known, and propagate executable
  // effects without applying the mutation's paint approximation.
  let dependencyWork = 0
  const retainAllSourceHints = (message: string) => {
    warn(message)
    for (const sourceId of context.sourceIds ?? []) dependencies.add(sourceId)
  }
  const loseExecutionCertainty = (message: string) => {
    bindingsKnown = false
    preview.executionUncertain = true
    ;[...paintFields, ...shapeFields].forEach((field) => unresolved.add(field))
    retainAllSourceHints(`${message} Runtime color bindings and option handlers remain unknown; later paint cannot restore certainty.`)
  }
  // Known paint keys with ordinary invalid literals retain field-local recovery.
  // An unknown key/handler can run arbitrary code; do not guess its effects.
  const hasRuntimeHandlerSyntax = (key: string) => /\/\s*\./.test(key) || /[\\{}#=$%~^&]/.test(key)
  const isPaintOrLayoutKey = (key: string) => !key.includes('/') && !hasRuntimeHandlerSyntax(key) && (Object.hasOwn(keyFields, key)
    || Object.hasOwn(thickness, key) || Object.hasOwn(lineStyles, key) || deferredShapeLayout.test(key))
  const isColorOption = (key: string) => Object.hasOwn(context.colors ?? {}, key)
    || Object.hasOwn(namedTikzColors, key) || key.includes('!')
  // Classify values before literal parsing: recognized handlers can expand TeX
  // too. Use the same boundary for ordinary and dependency-only traversal,
  // including normalized /tikz keys. Braces alone are literal grouping.
  const hasExecutableOptionValue = (key: string, value: string) => isPaintOrLayoutKey(key)
    && /[\\#~^$&%]/.test(value)
  const executableValueDiagnostic = (key: string, option: string) =>
    `Unsupported executable ${deferredShapeLayout.test(key) ? 'layout' : 'paint'} option: ${option}`
  const collectOptionDependencies = (body: string, active: readonly string[], directoryKnown = true): boolean => {
    if (body.length > 100_000 || active.length > 16) {
      loseExecutionCertainty('Style dependency scan exceeds its preview bound; unvisited options may execute code.')
      return false
    }
    for (const rawOption of splitTikzOptions(body)) {
      const option = rawOption.trim()
      if (!option) continue
      dependencyWork += 1
      if (dependencyWork > 4096) {
        loseExecutionCertainty('Style dependency scan exceeds the 4096-option bound; unvisited options may execute code.')
        return false
      }
      const equals = option.indexOf('=')
      const key = (equals < 0 ? option : option.slice(0, equals)).trim()
      const paintKey = key.replace(/^\/tikz\//, '').replace(/\s+/g, ' ')
      if (key.endsWith('/.cd')) {
        if (/[\\{}#=$%~^&]/.test(key) || /[\\#~^$&%]/.test(option.slice(equals + 1))) {
          loseExecutionCertainty(`Unsupported executable runtime directory: ${option}`)
        }
        retainAllSourceHints('Style dependency scan has an unsupported runtime directory change; retaining all imported source hints.')
        directoryKnown = false
        continue
      }
      const identity = canonicalTikzStyleKey(key)
      const definition = styles.get(identity)
      if (hasRuntimeHandlerSyntax(key)) loseExecutionCertainty(`Unsupported executable runtime key: ${option}`)
      if (hasExecutableOptionValue(paintKey, equals < 0 ? '' : option.slice(equals + 1))) {
        loseExecutionCertainty(executableValueDiagnostic(paintKey, option))
      }
      // After .cd, even a relative paint-looking key can invoke a retained
      // namespaced code handler. Inspect all matching definitions for effects;
      // do not pick a directory or apply their paint values to the preview.
      const candidates = !directoryKnown && !key.startsWith('/')
        ? [...styles.values()].filter((style) => canonicalTikzStyleKey(style.key).endsWith(`/${key}`))
        : definition === undefined ? [] : [definition]
      for (const candidate of candidates) {
        dependencyWork += 1
        if (dependencyWork > 4096) {
          loseExecutionCertainty('Style dependency scan exceeds the 4096-option bound; unvisited handlers may execute code.')
          return false
        }
        const candidateIdentity = canonicalTikzStyleKey(candidate.key)
        if (equals >= 0 && candidate.options?.includes('#')) loseExecutionCertainty(`Unsupported parameterized style invocation: ${option}`)
        if (candidate.sourceId !== undefined) dependencies.add(candidate.sourceId)
        for (const sourceId of candidate.sourceDependencies ?? []) dependencies.add(sourceId)
        if (candidate.executionUncertain) loseExecutionCertainty(`Unsupported executable style mutation: ${candidate.key}.`)
        if (active.includes(candidateIdentity)) {
          loseExecutionCertainty(`Cyclic style dependency: ${key}; unvisited options may execute code.`)
        } else {
          const nestedActive = [...active, candidateIdentity]
          const startedWithKnownDirectory = directoryKnown
          directoryKnown = collectOptionDependencies(candidate.options ?? '', nestedActive, directoryKnown) && directoryKnown
          for (const options of candidate.dependencyOptions ?? []) {
            directoryKnown = collectOptionDependencies(options, nestedActive, directoryKnown) && directoryKnown
          }
          if (startedWithKnownDirectory && !directoryKnown && candidate.dependencyOptions?.length) {
            // A retained prefix can run before the fallback/earlier lists. We
            // do not interpret mutation order, so inspect all possible effects
            // again with unknown directory using the same bounded work budget.
            collectOptionDependencies(candidate.options ?? '', nestedActive, false)
            for (const options of candidate.dependencyOptions) collectOptionDependencies(options, nestedActive, false)
          }
        }
      }
      if (candidates.length) continue
      if (equals < 0 && isColorOption(paintKey)) {
        color(paintKey)
      } else if (['fill', 'draw', 'text', 'color', 'cylinder end fill', 'cylinder body fill'].includes(paintKey)) {
        color(option.slice(equals + 1))
      } else if (!isPaintOrLayoutKey(paintKey)) {
        loseExecutionCertainty(`Unsupported executable preview option: ${option}`)
      }
    }
    return directoryKnown
  }
  // A .style body uses the invocation's active directory (/tikz for normal
  // nodes), not the declaration's parent directory. Keep this context shared
  // through nested expansion. Runtime .cd is deliberately unsupported; once
  // encountered, relative options remain unresolved instead of guessing a path.
  let runtimeDirectoryKnown = true
  const incompleteExpansion = (message: string) => {
    // Unvisited options can redefine bindings and handlers as well as directory.
    runtimeDirectoryKnown = false
    retainAllSourceHints(`${message} Runtime key directory remains unknown; retaining all imported source hints.`)
    loseExecutionCertainty('Incomplete style expansion; unvisited options may execute code.')
  }
  const visit = (body: string, active: readonly string[]) => {
    if (body.length > 100_000) { incompleteExpansion('Preview option input exceeds the 100000-character bound.'); return }
    for (const rawOption of splitTikzOptions(body)) {
      const option = rawOption.trim()
      if (!option) continue
      work += 1
      if (work > 4096) { incompleteExpansion('Preview style expansion exceeds the 4096-option work bound.'); return }
      const equals = option.indexOf('=')
      const rawKey = equals < 0 ? option : option.slice(0, equals).trim()
      const key = rawKey.replace(/^\/tikz\//, '').replace(/\s+/g, ' ')
      const value = equals < 0 ? undefined : unbrace(option.slice(equals + 1))
      if (rawKey.endsWith('/.cd')) {
        if (/[\\{}#=$%~^&]/.test(rawKey) || (value !== undefined && /[\\#~^$&%]/.test(value))) {
          loseExecutionCertainty(`Unsupported executable runtime directory: ${option}`)
        }
        warn(`Unsupported runtime key directory change: ${option}`)
        runtimeDirectoryKnown = false
        paintFields.forEach((field) => unresolved.add(field))
        continue
      }
      if (!runtimeDirectoryKnown && !rawKey.startsWith('/')) {
        // Still inspect retained lists for executable effects after .cd.
        collectOptionDependencies(option, active, false)
        warn(`Unresolved option after unsupported runtime key directory change: ${option}`)
        paintFields.forEach((field) => unresolved.add(field))
        continue
      }
      const canonicalKey = canonicalTikzStyleKey(rawKey)
      const reference = styles.has(canonicalKey) ? canonicalKey : undefined
      if (reference !== undefined) {
        const definition = styles.get(reference)!
        const startedWithKnownDirectory = runtimeDirectoryKnown
        if (equals >= 0) loseExecutionCertainty(`Unsupported parameterized style invocation: ${option}`)
        if (definition.sourceId !== undefined) dependencies.add(definition.sourceId)
        for (const sourceId of definition.sourceDependencies ?? []) dependencies.add(sourceId)
        if (active.includes(reference)) loseExecutionCertainty(`Cyclic style reference: ${[...active, reference].join(' → ')}`)
        else if (active.length >= 16) incompleteExpansion('Preview style expansion exceeds the 16-level depth bound.')
        else visit(definition.options ?? '', [...active, reference])
        // The last known body is only a deterministic preview approximation.
        // Only a completely scanned paint-only mutation can permit later
        // own-field recovery. Arbitrary handlers also invalidate bindings.
        if (definition.state === 'unresolved') {
          definition.diagnostics.forEach(warn)
          if (definition.executionUncertain) loseExecutionCertainty(`Unsupported executable style mutation: ${rawKey}.`)
          for (const options of definition.dependencyOptions ?? []) {
            runtimeDirectoryKnown = collectOptionDependencies(options, [reference], runtimeDirectoryKnown) && runtimeDirectoryKnown
          }
          if (startedWithKnownDirectory && !runtimeDirectoryKnown && definition.dependencyOptions?.length) {
            collectOptionDependencies(definition.options ?? '', [reference], false)
            for (const options of definition.dependencyOptions) collectOptionDependencies(options, [reference], false)
          }
          paintFields.forEach((field) => unresolved.add(field))
        }
        continue
      }
      const invalid = (affectedFields?: readonly string[]) => {
        warn(`Unsupported or invalid preview option: ${option}`)
        const fields = affectedFields ?? (Object.hasOwn(keyFields, key) ? keyFields[key] : deferredShapeLayout.test(key) ? [] : paintFields)
        fields.forEach((field) => unresolved.add(field))
      }
      if (hasRuntimeHandlerSyntax(rawKey)) loseExecutionCertainty(`Unsupported executable runtime key: ${option}`)
      if (hasExecutableOptionValue(key, value ?? '')) loseExecutionCertainty(executableValueDiagnostic(key, option))
      if (!isPaintOrLayoutKey(key) && !(value === undefined && isColorOption(key))) {
        invalid()
        loseExecutionCertainty(`Unsupported executable preview option: ${option}`)
      }
      // Continue bounded dependency discovery, but never apply stale handlers or
      // bindings to the fallback after arbitrary execution has become possible.
      if (!bindingsKnown) {
        if (value === undefined && isColorOption(key)) color(key)
        else if (value !== undefined && ['fill', 'draw', 'text', 'color', 'cylinder end fill', 'cylinder body fill'].includes(key)) color(value)
        continue
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
      else if (applyLiteralPointShapeOption(preview, key, value, { number: literalTikzNumber, dimension: literalTikzDimension, color, invalid, resolved })) { /* ordered shape option */ }
      else {
        const resolvedColor = value === undefined ? color(key) : null
        if (resolvedColor) { preview.color = resolvedColor; delete preview.drawColor; delete preview.fillColor; delete preview.textColor; resolved('fillColor', 'drawColor', 'textColor') }
        else if (value === undefined && (Object.hasOwn(context.colors ?? {}, key) || key.includes('!'))) invalid(['fillColor', 'drawColor', 'textColor'])
        else invalid()
      }
    }
  }
  visit(options, context.key ? [canonicalTikzStyleKey(context.key)] : [])
  for (const issue of pointShapeParameterIssues(preview.shapeParameters).filter((entry) => entry.message.startsWith('Dart tail'))) {
    warn(issue.message)
    unresolved.add('shapeParameters.dartTipAngle')
    unresolved.add('shapeParameters.dartTailAngle')
    if (preview.shapeParameters) { delete preview.shapeParameters.dartTipAngle; delete preview.shapeParameters.dartTailAngle }
  }
  if (diagnostics.length) preview.diagnostics = diagnostics
  if (unresolved.size) preview.unresolvedFields = [...unresolved]
  if (dependencies.size) preview.sourceDependencies = [...new Set([...(context.sourceIds ?? []), ...dependencies])].filter((sourceId) => dependencies.has(sourceId))
  return preview
}
