import { LabelSvgError, type SvgAttributeValue, type ValidatedSvgElement } from './labelSvg.ts'

export interface SvgInkBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

interface Transform {
  readonly sx: number
  readonly sy: number
  readonly tx: number
  readonly ty: number
}

interface Paint {
  readonly fill: SvgAttributeValue
  readonly stroke: SvgAttributeValue
  readonly strokeWidth: number
  readonly linejoin: string
  readonly linecap: string
}

const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?'
const PATH_ARITIES: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 }
const IDENTITY: Transform = Object.freeze({ sx: 1, sy: 1, tx: 0, ty: 0 })
const DEFAULT_PAINT: Paint = Object.freeze({
  fill: '#000000', stroke: 'none', strokeWidth: 1, linejoin: 'miter', linecap: 'butt',
})

function unsupported(message: string): never {
  throw new LabelSvgError('output', message)
}

function finite(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e8) {
    throw new LabelSvgError('invalid-metrics', 'Transformed SVG ink exceeds coordinate bounds')
  }
  return value
}

function attribute(node: ValidatedSvgElement, name: string, fallback = ''): string {
  const value = node.attributes[name]
  if (value === undefined) return fallback
  if (typeof value !== 'string') return unsupported('Expected numeric SVG attribute')
  return value
}

function numeric(node: ValidatedSvgElement, name: string, fallback = 0): number {
  // Validation has already excluded child em/ex lengths; px equals a user unit.
  return finite(Number(attribute(node, name, String(fallback)).replace(/px$/, '')))
}

function compose(parent: Transform, child: Transform): Transform {
  return {
    sx: finite(parent.sx * child.sx), sy: finite(parent.sy * child.sy),
    tx: finite(parent.sx * child.tx + parent.tx),
    ty: finite(parent.sy * child.ty + parent.ty),
  }
}

function transform(value: string, inherited: Transform): Transform {
  // Only the translate/scale subset emitted by the supported MathJax output is
  // retained. Other syntactically valid transforms fail rather than using an
  // incorrect enclosure. Sticky matching consumes each character once.
  const matcher = /\s*(translate|scale)\(([^()]*)\)\s*/gy
  let position = 0
  let local = IDENTITY
  while (position < value.length) {
    matcher.lastIndex = position
    const match = matcher.exec(value)
    if (!match) return unsupported('SVG transform has no supported ink enclosure')
    const values = match[2].trim().split(/[\s,]+/).map((part) => finite(Number(part)))
    if (values.length < 1 || values.length > 2) return unsupported('Invalid SVG transform operands')
    local = compose(local, match[1] === 'translate'
      ? { sx: 1, sy: 1, tx: values[0], ty: values[1] ?? 0 }
      : { sx: values[0], sy: values[1] ?? values[0], tx: 0, ty: 0 })
    position = matcher.lastIndex
  }
  return compose(inherited, local)
}

class Enclosure {
  private minX = Infinity
  private minY = Infinity
  private maxX = -Infinity
  private maxY = -Infinity

  point(x: number, y: number): void {
    finite(x)
    finite(y)
    this.minX = Math.min(this.minX, x)
    this.minY = Math.min(this.minY, y)
    this.maxX = Math.max(this.maxX, x)
    this.maxY = Math.max(this.maxY, y)
  }

  result(): SvgInkBounds | null {
    if (this.minX === Infinity) return null
    return Object.freeze({ minX: this.minX, minY: this.minY, maxX: this.maxX, maxY: this.maxY })
  }
}

function pathBounds(path: string): SvgInkBounds | null {
  const enclosure = new Enclosure()
  const token = new RegExp(`[a-zA-Z]|${NUMBER}`, 'y')
  const separator = /[\s,]*/y
  let position = 0
  let command = ''
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  const operands: number[] = []
  while (position < path.length) {
    separator.lastIndex = position
    separator.exec(path)
    position = separator.lastIndex
    if (position === path.length) break
    token.lastIndex = position
    const match = token.exec(path)
    if (!match) return unsupported('Invalid SVG path ink geometry')
    position = token.lastIndex
    if (/^[a-zA-Z]$/.test(match[0])) {
      if (operands.length) return unsupported('Incomplete SVG path ink geometry')
      command = match[0]
      if (!Object.hasOwn(PATH_ARITIES, command)) {
        return unsupported('SVG path command has no supported ink enclosure')
      }
      if (command === 'Z') {
        x = startX
        y = startY
      }
      continue
    }
    const arity = PATH_ARITIES[command]
    if (!arity) return unsupported('Missing SVG path ink command')
    operands.push(finite(Number(match[0])))
    if (operands.length !== arity) continue
    if (command === 'H') {
      x = operands[0]
      enclosure.point(x, y)
    } else if (command === 'V') {
      y = operands[0]
      enclosure.point(x, y)
    } else {
      // Every Bézier point is in the convex hull of its endpoints and control
      // points. Their rectangle is an authoritative, conservative enclosure;
      // unlike a nominal layout box, it includes overhang without guessed pads.
      for (let index = 0; index < operands.length; index += 2) {
        enclosure.point(operands[index], operands[index + 1])
      }
      x = operands[arity - 2]
      y = operands[arity - 1]
      if (command === 'M') {
        startX = x
        startY = y
        // Subsequent pairs after moveto are implicit lineto operations.
        command = 'L'
      }
    }
    operands.length = 0
  }
  if (operands.length) return unsupported('Incomplete SVG path ink geometry')
  return enclosure.result()
}

function shapeBounds(node: ValidatedSvgElement): SvgInkBounds | null {
  if (node.tag === 'path') return pathBounds(attribute(node, 'd'))
  const enclosure = new Enclosure()
  if (node.tag === 'rect') {
    const x = numeric(node, 'x')
    const y = numeric(node, 'y')
    const width = numeric(node, 'width')
    const height = numeric(node, 'height')
    if (width === 0 || height === 0) return null
    enclosure.point(x, y)
    enclosure.point(x + width, y + height)
  } else if (node.tag === 'line') {
    enclosure.point(numeric(node, 'x1'), numeric(node, 'y1'))
    enclosure.point(numeric(node, 'x2'), numeric(node, 'y2'))
  } else if (node.tag === 'polygon' || node.tag === 'polyline') {
    const points = attribute(node, 'points').trim()
    if (points) {
      const values = points.split(/[\s,]+/)
      for (let index = 0; index < values.length; index += 2) {
        enclosure.point(finite(Number(values[index])), finite(Number(values[index + 1])))
      }
    }
  } else if (node.tag !== 'svg' && node.tag !== 'g') {
    return unsupported('SVG shape has no supported ink enclosure')
  }
  return enclosure.result()
}

/**
 * Encloses an already validated, size/depth/work-bounded SVG in its original
 * user units. Traversal and path tokenization are linear in the validated input;
 * at most six path operands are retained. This is deliberately not a general
 * SVG renderer. Unsupported shapes/transforms/commands reject the whole label.
 * Transparent paint can conservatively enlarge a bound, but is never removed.
 */
export function measureSvgInkBounds(svg: ValidatedSvgElement): SvgInkBounds | null {
  const enclosure = new Enclosure()
  function visit(node: ValidatedSvgElement, parentTransform: Transform, inherited: Paint): void {
    const localTransform = transform(attribute(node, 'transform'), parentTransform)
    const paint: Paint = {
      fill: node.attributes.fill ?? inherited.fill,
      stroke: node.attributes.stroke ?? inherited.stroke,
      strokeWidth: numeric(node, 'stroke-width', inherited.strokeWidth),
      linejoin: attribute(node, 'stroke-linejoin', inherited.linejoin),
      linecap: attribute(node, 'stroke-linecap', inherited.linecap),
    }
    // Even an unpainted shape is parsed: unsupported geometry must not bypass the
    // policy through inheritance, zero opacity, or a later foreground repaint.
    const shape = shapeBounds(node)
    const stroked = paint.stroke !== 'none' && paint.strokeWidth > 0
    if (shape && (stroked || (node.tag !== 'line' && paint.fill !== 'none'))) {
      const radius = paint.strokeWidth / 2
      // SVG's fixed default miterlimit is 4 (the validator does not admit an
      // override). Thus miter tips extend at most four radii. Round/bevel joins
      // and butt/round caps fit one radius; square cap corners fit sqrt(2).
      const strokeExtent = !stroked ? 0 : radius * Math.max(
        paint.linejoin === 'miter' ? 4 : 1, paint.linecap === 'square' ? Math.SQRT2 : 1,
      )
      enclosure.point(
        localTransform.sx * (shape.minX - strokeExtent) + localTransform.tx,
        localTransform.sy * (shape.minY - strokeExtent) + localTransform.ty,
      )
      enclosure.point(
        localTransform.sx * (shape.maxX + strokeExtent) + localTransform.tx,
        localTransform.sy * (shape.maxY + strokeExtent) + localTransform.ty,
      )
    }
    for (const child of node.children) {
      if (typeof child !== 'string') visit(child, localTransform, paint)
    }
  }
  visit(svg, IDENTITY, DEFAULT_PAINT)
  return enclosure.result()
}
