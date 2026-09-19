import { measureSvgInkBounds } from './labelInkBounds.ts'

/** DOM-independent, narrow MathJax SVG boundary. All coordinates are 1000/em. */
export interface RawSvgElement {
  readonly tag: string
  readonly attributes: Readonly<Record<string, string>>
  readonly children: readonly (RawSvgElement | string)[]
}

export interface ForegroundPaint {
  readonly kind: 'foreground'
}

const FOREGROUND: ForegroundPaint = Object.freeze({ kind: 'foreground' })
export type SvgAttributeValue = string | ForegroundPaint

export interface ValidatedSvgElement {
  readonly tag: string
  readonly attributes: Readonly<Record<string, SvgAttributeValue>>
  readonly children: readonly (ValidatedSvgElement | string)[]
}

export interface MathSvgGeometry {
  readonly svg: ValidatedSvgElement
  /** em, y down, baseline 0. width is logical advance, not viewport width. */
  readonly metrics: Readonly<{
    width: number; ascent: number; descent: number
    /** Conservative ink/viewport enclosure relative to the logical run origin. */
    inkLeft: number; inkRight: number
  }>
  /** Ink-enclosing user units; left edge normalized to zero, includes baseline 0. */
  readonly viewBox: readonly [number, number, number, number]
  /** Translation already applied to SVG children, in em. Place SVG at run.x - offsetX. */
  readonly offsetX: number
  readonly unitsPerEm: 1000
  readonly nodeCount: number
  readonly pathCount: number
}

export interface SvgValidationLimits {
  readonly maxNodes: number
  readonly maxPaths: number
  readonly maxDepth: number
  readonly maxAttributeCharacters: number
}

export const DEFAULT_SVG_LIMITS: SvgValidationLimits = Object.freeze({
  maxNodes: 10000,
  maxPaths: 5000,
  maxDepth: 128,
  maxAttributeCharacters: 2000000,
})

export class LabelSvgError extends Error {
  readonly category: 'tex' | 'output' | 'invalid-metrics' | 'work-limit'

  constructor(category: LabelSvgError['category'], message: string) {
    super(message)
    this.name = 'LabelSvgError'
    this.category = category
  }
}

const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?'
const NUMBER_PATTERN = new RegExp(`^${NUMBER}$`)
const LENGTH_PATTERN = new RegExp(`^(${NUMBER})(px|em|ex)?$`)
// MathJax's unknown-glyph <text> fallback relies on estimated browser-font
// metrics. Reject it; normal label text uses the actual text-measurement boundary.
const ELEMENTS = new Set(['svg', 'g', 'path', 'rect', 'line', 'polygon', 'polyline'])
const NUMERIC_ATTRIBUTES = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'rx', 'ry', 'width', 'height',
  'stroke-width', 'stroke-dashoffset', 'opacity', 'fill-opacity', 'stroke-opacity',
])
const PAINT_ATTRIBUTES = new Set(['fill', 'stroke', 'color'])
const ENUM_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'fill-rule': ['nonzero', 'evenodd'],
}

function fail(message: string): never {
  throw new LabelSvgError('output', message)
}

function finiteNumber(value: string): number {
  if (!NUMBER_PATTERN.test(value) || !Number.isFinite(Number(value))) fail('Invalid SVG number')
  const number = Number(value)
  if (Math.abs(number) > 1e8) throw new LabelSvgError('invalid-metrics', 'SVG coordinate exceeds bounds')
  return number
}

function numberList(value: string): number[] {
  const values = value.trim().split(/[\s,]+/)
  if (values.length === 0 || values.some((item) => item === '')) fail('Empty SVG number list')
  return values.map(finiteNumber)
}

function length(value: string, allowFontUnits = false): number {
  const match = LENGTH_PATTERN.exec(value)
  if (!match) fail('Invalid SVG length')
  // Inner geometry is expressed in MathJax user units (px is equivalent there).
  // Leaving em/ex on a child would make its shape depend on an embedding page's
  // font instead of the validated viewBox and reusable em metrics.
  if (!allowFontUnits && (match[2] === 'em' || match[2] === 'ex')) fail('Font-relative SVG geometry')
  return finiteNumber(match[1])
}

/** Paints cannot contain CSS functions, resource references, variables, or HTML. */
function paint(value: string, foreground: SvgAttributeValue): SvgAttributeValue {
  if (value === 'currentColor') return foreground
  if (value === 'none' || /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) return value
  const rgb = /^(rgb|rgba)\(\s*([^()]*)\s*\)$/i.exec(value)
  if (rgb) {
    const components = rgb[2].split(',').map((component) => component.trim())
    if (components.length !== (rgb[1].toLowerCase() === 'rgb' ? 3 : 4)) fail('Invalid SVG RGB paint')
    for (const [index, component] of components.entries()) {
      const percent = component.endsWith('%')
      const number = finiteNumber(percent ? component.slice(0, -1) : component)
      const maximum = percent ? 100 : index === 3 ? 1 : 255
      if (number < 0 || number > maximum) fail('Invalid SVG RGB paint')
    }
    return value
  }
  // Named CSS colors are inert identifiers; unknown names are rejected by browsers.
  // Limit to the standard names so unsupported output never silently loses paint.
  if (CSS_COLORS.has(value.toLowerCase())) return value.toLowerCase()
  fail('Unsupported SVG paint')
}

const CSS_COLORS = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black '
  + 'blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral '
  + 'cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen '
  + 'darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon '
  + 'darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink '
  + 'deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro '
  + 'ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo '
  + 'ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan '
  + 'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen '
  + 'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen '
  + 'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen '
  + 'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream '
  + 'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid '
  + 'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum '
  + 'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown '
  + 'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen '
  + 'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow '
  + 'yellowgreen transparent').split(' '))

function validateTransform(value: string): void {
  let remaining = value.trim()
  while (remaining) {
    const match = /^(matrix|translate|scale|rotate|skewX|skewY)\(([^()]*)\)\s*/.exec(remaining)
    if (!match) fail('Unsupported SVG transform')
    const values = numberList(match[2])
    const arities: Readonly<Record<string, readonly number[]>> = {
      matrix: [6], translate: [1, 2], scale: [1, 2], rotate: [1, 3], skewX: [1], skewY: [1],
    }
    if (!arities[match[1]].includes(values.length)) fail('Invalid SVG transform arity')
    remaining = remaining.slice(match[0].length)
  }
}

function validatePath(value: string): void {
  // MathJax emits only ordinary SVG path commands and finite numeric operands.
  const tokens = value.match(new RegExp(`[a-zA-Z]|${NUMBER}|[^\\s,]`, 'g')) ?? []
  const arities: Readonly<Record<string, number>> = { m: 2, z: 0, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 }
  let command = ''
  let operands: number[] = []
  function finish(): void {
    if (!command) return
    const arity = arities[command.toLowerCase()]
    if (arity === 0 ? operands.length !== 0 : operands.length === 0 || operands.length % arity !== 0) {
      fail('Invalid SVG path operands')
    }
    if (command.toLowerCase() === 'a') {
      for (let index = 0; index < operands.length; index += 7) {
        if (operands[index] < 0 || operands[index + 1] < 0
          || ![0, 1].includes(operands[index + 3]) || ![0, 1].includes(operands[index + 4])) {
          fail('Invalid SVG arc operands')
        }
      }
    }
  }
  for (const token of tokens) {
    if (/^[MmZzLlHhVvCcSsQqTtAa]$/.test(token)) {
      finish()
      command = token
      operands = []
    } else {
      if (!command) fail('Missing SVG path command')
      operands.push(finiteNumber(token))
    }
  }
  finish()
  if (value && !/^[\s]*[Mm]/.test(value)) fail('SVG path must begin with moveto')
}

function styleAttributes(style: string, root: boolean): Record<string, string> {
  const values: Record<string, string> = {}
  for (const declaration of style.split(';')) {
    if (!declaration.trim()) continue
    const colon = declaration.indexOf(':')
    if (colon < 0) fail('Malformed SVG style')
    const property = declaration.slice(0, colon).trim()
    const value = declaration.slice(colon + 1).trim()
    if (root && property === 'vertical-align') {
      length(value, true)
    } else if (property === 'color' || property === 'fill' || property === 'stroke'
      || property === 'stroke-width') {
      values[property] = value
    } else {
      fail('Unsupported SVG stylesheet effect')
    }
  }
  return values
}

/** Validates before metadata removal, resolves MathJax SVG stylesheet effects. */
export function validateMathSvg(
  raw: RawSvgElement,
  limits: SvgValidationLimits = DEFAULT_SVG_LIMITS,
  // Standalone validator fixtures may use nominal advance. Production always
  // supplies the separately captured, unclamped MathJax logical advance.
  advanceWidth?: number,
): MathSvgGeometry {
  if (!raw || raw.tag !== 'svg') fail('Expected one SVG root')
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new LabelSvgError('work-limit', 'Invalid SVG limit')
  }
  let nodeCount = 0
  let pathCount = 0
  let attributeCharacters = 0

  function visit(node: RawSvgElement, depth: number, inheritedColor: SvgAttributeValue): ValidatedSvgElement {
    if (++nodeCount > limits.maxNodes || depth > limits.maxDepth) {
      throw new LabelSvgError('work-limit', 'SVG node/depth limit')
    }
    if (!node || typeof node !== 'object' || !node.attributes || !Array.isArray(node.children)) {
      fail('Invalid SVG tree')
    }
    const attrs = node.attributes
    if (node.tag === 'merror' || attrs['data-mml-node'] === 'merror'
      || 'data-mjx-error' in attrs || 'data-mjx-message' in attrs
      || /(?:^|\s)mjx-merror(?:\s|$)/.test(attrs.class ?? '')) {
      throw new LabelSvgError('tex', 'MathJax returned error geometry')
    }
    if (!ELEMENTS.has(node.tag) || (depth > 0 && node.tag === 'svg')) fail('Unsupported SVG element')
    if (node.tag === 'path' && ++pathCount > limits.maxPaths) {
      throw new LabelSvgError('work-limit', 'SVG path limit')
    }
    const input: Record<string, string> = { ...attrs }
    if (input.style) Object.assign(input, styleAttributes(input.style, depth === 0))
    const currentColor = input.color ? paint(input.color, inheritedColor) : inheritedColor
    const output: Record<string, SvgAttributeValue> = {}
    for (const [name, value] of Object.entries(input)) {
      if (typeof value !== 'string') fail('Invalid SVG attribute')
      attributeCharacters += name.length + value.length
      if (attributeCharacters > limits.maxAttributeCharacters) {
        throw new LabelSvgError('work-limit', 'SVG attribute size limit')
      }
      if (name === 'style' || name === 'class' || name.startsWith('data-')) continue
      if (name === 'aria-hidden' || name === 'role' || name === 'focusable') continue
      if (depth === 0 && ['x', 'y', 'transform'].includes(name)) fail('Unsupported SVG viewport transform')
      if (name === 'xmlns' && depth === 0 && value === 'http://www.w3.org/2000/svg') {
        output[name] = value
      } else if (name === 'xmlns:xlink' && depth === 0 && value === 'http://www.w3.org/1999/xlink') {
        // No references are retained with fontCache:none.
      } else if (PAINT_ATTRIBUTES.has(name)) {
        if (name !== 'color') output[name] = paint(value, currentColor)
      } else if (NUMERIC_ATTRIBUTES.has(name)) {
        const number = name.includes('opacity') ? finiteNumber(value)
          : length(value, depth === 0 && (name === 'width' || name === 'height'))
        if (['width', 'height', 'rx', 'ry', 'stroke-width'].includes(name) && number < 0) fail('Negative SVG size')
        if (name.includes('opacity') && (number < 0 || number > 1)) fail('Invalid SVG opacity')
        output[name] = value
      } else if (name === 'viewBox' && depth === 0) {
        try {
          if (numberList(value).length !== 4) throw new LabelSvgError('invalid-metrics', 'Invalid SVG viewBox')
        } catch {
          throw new LabelSvgError('invalid-metrics', 'Invalid SVG viewBox')
        }
        output[name] = value
      } else if (name === 'transform') {
        validateTransform(value)
        output[name] = value
      } else if (name === 'd' && node.tag === 'path') {
        validatePath(value)
        output[name] = value
      } else if ((name === 'points' && ['polygon', 'polyline'].includes(node.tag)) || name === 'stroke-dasharray') {
        const values = numberList(value)
        if ((name === 'points' && values.length % 2 !== 0) || (name === 'stroke-dasharray' && values.some((v) => v < 0))) {
          fail('Invalid SVG coordinate list')
        }
        output[name] = value
      } else if (ENUM_ATTRIBUTES[name]?.includes(value)) {
        output[name] = value
      } else {
        fail('Unsupported SVG attribute: ' + name)
      }
    }
    const classes = (attrs.class ?? '').split(/\s+/).filter(Boolean)
    for (const token of classes) {
      if (token === 'mjx-dashed') output['stroke-dasharray'] = '140'
      else if (token === 'mjx-dotted') {
        output['stroke-dasharray'] = '0 140'
        output['stroke-linecap'] = 'round'
      } else if (token === 'mjx-solid') {
        // Solid table rules use the frame/line attributes resolved below.
        if (!['rect', 'line'].includes(node.tag) || !('data-frame' in attrs || 'data-line' in attrs)) {
          fail('Unsupported solid table shape')
        }
      } else if (token !== 'MathJax') fail('Unsupported SVG class effect')
    }
    if ('data-frame' in attrs || 'data-line' in attrs) {
      if (!['rect', 'line'].includes(node.tag)) fail('Unsupported frame/line shape')
      output['stroke-width'] = '70'
      output.fill = 'none'
    }
    // MathJax 4's blacker=3 stylesheet targets glyph paths only. Paths used
    // for rules/enclosures must keep their inherited or explicit stroke width.
    if (node.tag === 'path' && 'data-c' in attrs && !('stroke-width' in output)) output['stroke-width'] = '3'
    if (depth === 0) {
      output.xmlns = 'http://www.w3.org/2000/svg'
      output.fill ??= currentColor
      output.stroke ??= currentColor
    }
    if (input.color) {
      output.fill ??= currentColor
      output.stroke ??= currentColor
    }
    const children = node.children.map((child) => {
      if (typeof child !== 'string') return visit(child, depth + 1, currentColor)
      nodeCount++
      attributeCharacters += child.length
      if (nodeCount > limits.maxNodes || attributeCharacters > limits.maxAttributeCharacters) {
        throw new LabelSvgError('work-limit', 'SVG text/node limit')
      }
      if (child.trim()) fail('Unexpected SVG text node')
      return child
    })
    return Object.freeze({ tag: node.tag, attributes: Object.freeze(output), children: Object.freeze(children) })
  }

  const svg = visit(raw, 0, FOREGROUND)
  let bounds: number[]
  try {
    bounds = numberList(raw.attributes.viewBox ?? '')
  } catch {
    throw new LabelSvgError('invalid-metrics', 'Missing or invalid SVG viewBox')
  }
  if (bounds.length !== 4) throw new LabelSvgError('invalid-metrics', 'Invalid SVG viewBox')
  const [x, y, width, height] = bounds
  if (width < 0 || height < 0 || (height === 0 && width !== 0) || Math.abs(y) > 1e7
    || width > 1e7 || height > 1e7) throw new LabelSvgError('invalid-metrics', 'Invalid SVG bounds')
  const advance = advanceWidth ?? width / 1000
  if (!Number.isFinite(advance) || advance < 0 || advance > 10000) {
    throw new LabelSvgError('invalid-metrics', 'Unsupported logical advance')
  }
  const ink = measureSvgInkBounds(svg)
  const left = Math.min(0, x, ink?.minX ?? 0)
  const right = Math.max(advance * 1000, x + width, ink?.maxX ?? 0)
  const top = Math.min(0, y, ink?.minY ?? 0)
  const bottom = Math.max(0, y + height, ink?.maxY ?? 0)
  const normalizedWidth = right - left
  const normalizedHeight = bottom - top
  if (![left, right, top, bottom, normalizedWidth, normalizedHeight].every((value) =>
    Number.isFinite(value) && Math.abs(value) <= 1e7)) {
    throw new LabelSvgError('invalid-metrics', 'SVG ink exceeds bounds')
  }
  const viewBox = Object.freeze([0, top, normalizedWidth, normalizedHeight]) as readonly [number, number, number, number]
  const children = left === 0 ? svg.children : Object.freeze([Object.freeze({
    tag: 'g', attributes: Object.freeze({ transform: `translate(${-left},0)` }), children: svg.children,
  })])
  const normalizedSvg = Object.freeze({
    ...svg,
    attributes: Object.freeze({
      ...svg.attributes,
      viewBox: viewBox.join(' '),
      width: `${normalizedWidth / 1000}em`,
      height: `${normalizedHeight / 1000}em`,
    }),
    children,
  })
  return Object.freeze({
    svg: normalizedSvg,
    metrics: Object.freeze({ width: advance, ascent: Math.max(0, -top / 1000), descent: bottom / 1000,
      inkLeft: left / 1000, inkRight: right / 1000 }),
    viewBox,
    offsetX: -left / 1000,
    unitsPerEm: 1000,
    nodeCount,
    pathCount,
  })
}

/** Resolves only the controlled foreground; formula-internal colors remain intact. */
export function paintMathSvg(geometry: MathSvgGeometry, foreground: string): RawSvgElement {
  const resolved = paint(foreground, FOREGROUND)
  if (typeof resolved !== 'string' || resolved === 'none') fail('Expected explicit foreground color')
  const resolvedColor: string = resolved
  function visit(node: ValidatedSvgElement): RawSvgElement {
    return Object.freeze({
      tag: node.tag,
      attributes: Object.freeze(Object.fromEntries(Object.entries(node.attributes)
        .map(([name, value]) => [name, typeof value === 'string' ? value : resolvedColor]))),
      children: Object.freeze(node.children.map((child) => typeof child === 'string' ? child : visit(child))),
    })
  }
  return visit(geometry.svg)
}

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** Produces standalone SVG without requiring MathJax CSS, IDs, or external assets. */
export function serializeMathSvg(geometry: MathSvgGeometry, foreground = '#000000'): string {
  function serialize(node: RawSvgElement): string {
    const attributes = Object.entries(node.attributes).map(([name, value]) => ` ${name}="${xml(value)}"`).join('')
    const children = node.children.map((child) => typeof child === 'string' ? xml(child) : serialize(child)).join('')
    return `<${node.tag}${attributes}>${children}</${node.tag}>`
  }
  return serialize(paintMathSvg(geometry, foreground))
}
