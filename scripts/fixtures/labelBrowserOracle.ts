/** Test-only independent SVG oracle. No production layout/metrics imports.
 *
 * Only painted descendants are measured. getBBox + getScreenCTM supplies a
 * generous raster viewport, then alpha pixels of an isolated visible-content
 * clone supply ink extents. Picking rectangles and editor decorations never
 * enter that clone. MathJax's painted rects (notably fraction rules) are kept.
 */
export type OracleBounds = { minX: number; minY: number; maxX: number; maxY: number }
export type OracleMatrix = { a: number; b: number; c: number; d: number; e: number; f: number }
export type OraclePoint = { x: number; y: number }

const matrixData = ({ a, b, c, d, e, f }: DOMMatrix): OracleMatrix => ({ a, b, c, d, e, f })
const asBounds = ({ x, y, width, height }: DOMRect): OracleBounds => ({ minX: x, minY: y, maxX: x + width, maxY: y + height })
const union = (bounds: OracleBounds[]): OracleBounds => ({
  minX: Math.min(...bounds.map((box) => box.minX)), minY: Math.min(...bounds.map((box) => box.minY)),
  maxX: Math.max(...bounds.map((box) => box.maxX)), maxY: Math.max(...bounds.map((box) => box.maxY)),
})
function transformBounds(box: OracleBounds, matrix: DOMMatrix): OracleBounds {
  const corners = [new DOMPoint(box.minX, box.minY), new DOMPoint(box.maxX, box.minY),
    new DOMPoint(box.minX, box.maxY), new DOMPoint(box.maxX, box.maxY)].map((point) => point.matrixTransform(matrix))
  return { minX: Math.min(...corners.map(({ x }) => x)), minY: Math.min(...corners.map(({ y }) => y)),
    maxX: Math.max(...corners.map(({ x }) => x)), maxY: Math.max(...corners.map(({ y }) => y)) }
}
function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message)
  return value
}

const textMetricProperties = [
  'font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch',
  'font-size-adjust', 'font-kerning', 'font-optical-sizing', 'font-feature-settings',
  'font-variation-settings', 'font-variant-ligatures', 'font-variant-caps',
  'font-variant-numeric', 'font-variant-east-asian', 'font-variant-position',
  'font-synthesis', 'letter-spacing', 'word-spacing', 'text-rendering',
  'white-space', 'tab-size', 'direction', 'unicode-bidi', 'writing-mode', 'text-orientation',
] as const

function textMetricStyle(text: SVGTextElement) {
  const style = getComputedStyle(text)
  return {
    // Diagnostic only: this shorthand can be empty even with a valid displayed
    // font. Never assign it to Canvas, whose default would silently survive.
    font: style.font,
    properties: Object.fromEntries(textMetricProperties.map((property) => [property, style.getPropertyValue(property)])),
    xmlSpace: text.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'space'),
  }
}

/** Measure independently through the displayed SVG font, including whitespace.
 *
 * The temporary sibling retains the original inheritance context, and explicit
 * computed longhands prevent selector or font-shorthand serialization changes
 * from selecting another font. It is never included in ink/export measurements.
 */
export function measureSvgTextAdvance(text: SVGTextElement, value: string) {
  const parent = required(text.parentElement, 'SVG text measurement requires a connected parent')
  if (!text.isConnected) throw new Error('SVG text measurement requires displayed text')
  const computed = textMetricStyle(text)
  const clone = text.cloneNode(false) as SVGTextElement
  clone.removeAttribute('id')
  // Positioning/whole-fragment length constraints must not alter the advance of
  // the replacement string. Font and whitespace properties remain identical.
  for (const attribute of ['transform', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust']) clone.removeAttribute(attribute)
  clone.setAttribute('x', '0')
  clone.setAttribute('y', '0')
  clone.setAttribute('data-svg-export-exclude', 'true')
  clone.setAttribute('data-label-oracle-measurement', 'true')
  for (const [property, value] of Object.entries(computed.properties)) {
    if (value !== '') clone.style.setProperty(property, value, 'important')
  }
  clone.style.setProperty('opacity', '0', 'important')
  clone.style.setProperty('pointer-events', 'none', 'important')
  clone.textContent = value
  try {
    parent.append(clone)
    const effective = textMetricStyle(clone)
    const advance = clone.getComputedTextLength()
    if (!Number.isFinite(advance) || advance < 0) throw new Error('SVG text measurement returned a nonfinite or negative advance')
    return { method: 'svg-text-clone' as const, text: value, advance, computed, effective }
  } finally {
    clone.remove()
  }
}

/** Locate the next tab on an independently measured SVG whitespace grid.
 * Short SVG advances are rounded, so multiplying a single-space measurement
 * can select the wrong stop near a boundary. Measure each complete prefix
 * instead; neither the interval estimate nor its rounding is accumulated.
 */
export function measureSvgTabStop(text: SVGTextElement, position: number, tabSize = 4) {
  if (!Number.isFinite(position) || position < 0 || !Number.isInteger(tabSize) || tabSize < 1 || tabSize > 32) {
    throw new Error('Invalid SVG tab measurement input')
  }
  const interval = measureSvgTextAdvance(text, ' '.repeat(tabSize))
  if (interval.advance <= 0) throw new Error('SVG tab interval must have positive advance')
  const measureStop = (index: number) => {
    if (!Number.isSafeInteger(index) || index < 0 || index * tabSize > 16_384) {
      throw new Error('SVG tab measurement exceeds the fixture work bound')
    }
    return measureSvgTextAdvance(text, ' '.repeat(index * tabSize))
  }
  let index = Math.floor(position / interval.advance) + 1
  let previous = measureStop(index - 1), next = measureStop(index)
  while (previous.advance > position) {
    index--
    next = previous
    previous = measureStop(index - 1)
  }
  while (next.advance <= position) {
    index++
    previous = next
    next = measureStop(index)
  }
  return { method: 'svg-whitespace-grid' as const, position, tabSize, index, interval, previous, next, advance: next.advance }
}

function painted(element: SVGGraphicsElement, root: SVGGElement): boolean {
  if (element.closest('[data-svg-export-exclude],defs,clipPath,mask')) return false
  const style = getComputedStyle(element)
  if (style.visibility !== 'visible' || style.display === 'none') return false
  let ancestor: Element | null = element
  while (ancestor && ancestor !== root.parentElement) {
    if (Number(getComputedStyle(ancestor).opacity) === 0) return false
    ancestor = ancestor.parentElement
  }
  return (style.fill !== 'none' && style.fill !== 'transparent' && Number(style.fillOpacity) > 0)
    || (style.stroke !== 'none' && style.stroke !== 'transparent' && Number(style.strokeOpacity) > 0)
}

export async function inspectLabelContent(id: string, options: { fontSize?: number } = {}) {
  const node = required(document.querySelector<SVGGElement>(`[data-label-id="${CSS.escape(id)}"] [data-label-state]`), `${id}: rendered label missing`)
  const content = required(node.querySelector<SVGGElement>(':scope > g'), `${id}: visible content missing`)
  const canvasSvg = required(node.closest<SVGSVGElement>('svg.svg-diagram'), `${id}: canvas missing`)
  const localToClient = required(node.getScreenCTM(), `${id}: label CTM missing`)
  const svgToClient = required(canvasSvg.getScreenCTM(), `${id}: canvas CTM missing`)
  const localToSvg = svgToClient.inverse().multiply(localToClient)
  const leaves = Array.from(content.querySelectorAll<SVGGraphicsElement>('path,rect,circle,ellipse,line,polygon,polyline,text,use'))
    .filter((element) => painted(element, node))
  const measured = leaves.map((element) => {
    const matrix = required(element.getScreenCTM(), `${id}: descendant CTM missing`)
    const relative = localToClient.inverse().multiply(matrix)
    return { tag: element.tagName, text: element instanceof SVGTextElement ? element.textContent : undefined,
      native: asBounds(element.getBBox()), matrix: matrixData(relative),
      bounds: transformBounds(asBounds(element.getBBox()), relative) }
  }).filter(({ bounds }) => bounds.maxX > bounds.minX || bounds.maxY > bounds.minY)
  if (measured.length === 0) throw new Error(`${id}: no independently measurable visible descendants`)
  const native = union(measured.map(({ bounds }) => bounds))
  const fontSize = options.fontSize ?? Number.parseFloat(getComputedStyle(content.querySelector('text') ?? content).fontSize)
  if (!(Number.isFinite(fontSize) && fontSize > 0)) throw new Error(`${id}: invalid oracle font size`)
  // Derive whitespace allowance from displayed text, independently of layout.
  // This allows intentional leading/trailing spaces, but never raw TeX length
  // for successful formulas. Internal tabs/newlines already position fragments.
  let whitespaceAdvance = 0
  const whitespaceMeasurements = Array.from(content.querySelectorAll('text'), (text) => {
    const value = text.textContent ?? ''
    const leading = value.match(/^\s*/u)?.[0] ?? ''
    const trailing = value.match(/\s*$/u)?.[0] ?? ''
    const leadingMeasurement = measureSvgTextAdvance(text, leading)
    const trailingMeasurement = measureSvgTextAdvance(text, trailing)
    whitespaceAdvance = Math.max(whitespaceAdvance, leadingMeasurement.advance, trailingMeasurement.advance)
    return { text: value, leading: leadingMeasurement, trailing: trailingMeasurement }
  })
  const padding = Math.max(4, fontSize * 0.25)
  const viewport = { minX: native.minX - padding, minY: native.minY - padding,
    maxX: native.maxX + padding, maxY: native.maxY + padding }
  const width = viewport.maxX - viewport.minX, height = viewport.maxY - viewport.minY
  const rasterScale = Math.min(4, 4096 / Math.max(width, height))
  if (!(rasterScale > 0 && width * height * rasterScale ** 2 < 20_000_000)) throw new Error(`${id}: oracle raster limit`)
  const isolated = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  isolated.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  isolated.setAttribute('width', String(Math.ceil(width * rasterScale)))
  isolated.setAttribute('height', String(Math.ceil(height * rasterScale)))
  isolated.setAttribute('viewBox', `${viewport.minX} ${viewport.minY} ${width} ${height}`)
  isolated.setAttribute('preserveAspectRatio', 'none')
  const clone = content.cloneNode(true) as SVGGElement
  clone.querySelectorAll('[data-svg-export-exclude],title,desc').forEach((element) => element.remove())
  isolated.append(clone)
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(isolated)], { type: 'image/svg+xml' }))
  const raster = document.createElement('canvas')
  raster.width = Math.ceil(width * rasterScale)
  raster.height = Math.ceil(height * rasterScale)
  const rasterContext = required(raster.getContext('2d', { willReadFrequently: true }), 'Raster context unavailable')
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    rasterContext.drawImage(image, 0, 0)
  } finally { URL.revokeObjectURL(url) }
  const pixels = rasterContext.getImageData(0, 0, raster.width, raster.height).data
  let left = raster.width, top = raster.height, right = -1, bottom = -1
  for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
    if (pixels[(y * raster.width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
  }
  if (right < left) throw new Error(`${id}: isolated content has no painted pixels`)
  const ink = { minX: viewport.minX + left * width / raster.width, minY: viewport.minY + top * height / raster.height,
    maxX: viewport.minX + (right + 1) * width / raster.width, maxY: viewport.minY + (bottom + 1) * height / raster.height }
  const publishedValues = required(node.getAttribute('data-label-bounds'), `${id}: published bounds missing`).split(' ').map(Number)
  if (publishedValues.length !== 4) throw new Error(`${id}: invalid published bounds`)
  const [minX, minY, maxX, maxY] = publishedValues
  const published = { minX, minY, maxX, maxY }
  const hit = node.querySelector<SVGRectElement>(':scope > rect[data-svg-export-exclude]')
  return {
    id, source: node.getAttribute('data-label-source'), status: node.getAttribute('data-label-state'),
    request: node.getAttribute('data-label-request'), fontSize, anchorTransform: node.getAttribute('transform'),
    ink, native, published, hit: hit ? asBounds(hit.getBBox()) : null,
    inkSvg: transformBounds(ink, localToSvg), inkClient: transformBounds(ink, localToClient),
    publishedSvg: transformBounds(published, localToSvg), publishedClient: transformBounds(published, localToClient),
    localToClient: matrixData(localToClient), localToSvg: matrixData(localToSvg), svgToClient: matrixData(svgToClient),
    descendants: measured, paintedRectangles: measured.filter(({ tag }) => tag === 'rect').length,
    whitespaceMeasurements,
    raster: { width: raster.width, height: raster.height, viewport, pixels: { left, top, right, bottom } },
    tolerances: {
      // Math italic bearings/advance and SVG antialiasing: at most 0.35 em
      // horizontally. Font line leading/descenders: at most 0.85 em per side.
      // Literal leading/trailing whitespace adds only measured space advances.
      horizontal: fontSize * 0.35 + whitespaceAdvance + 1,
      vertical: fontSize * 0.85 + 1,
      containment: 1,
      hitEquality: 0.01,
      whitespaceAdvance,
      normalPointerPadding: { x: 0, y: 0 },
      altPointerPadding: { x: 14, y: 12 }, // production 6/4 padding + 8 tolerance
    },
  }
}
export type LabelContentEvidence = Awaited<ReturnType<typeof inspectLabelContent>>

export function assertLabelContent(evidence: LabelContentEvidence): void {
  const { id, ink, published, hit, tolerances } = evidence
  if (!Object.values(published).every(Number.isFinite)) throw new Error(`${id}: nonfinite published bounds`)
  for (const [edge, minimum] of [['minX', true], ['maxX', false], ['minY', true], ['maxY', false]] as const) {
    const outward = minimum ? ink[edge] - published[edge] : published[edge] - ink[edge]
    const allowance = edge.endsWith('X') ? tolerances.horizontal : tolerances.vertical
    if (outward < -tolerances.containment || outward > allowance) {
      throw new Error(`${id}: ${edge} published/independent ink gap ${outward} outside [-${tolerances.containment}, ${allowance}]`)
    }
    if (hit && Math.abs(hit[edge] - published[edge]) > tolerances.hitEquality) {
      throw new Error(`${id}: hit ${edge} differs from published bounds`)
    }
  }
}
export async function inspectAndAssertLabelContent(id: string, options: { fontSize?: number } = {}) {
  const evidence = await inspectLabelContent(id, options)
  assertLabelContent(evidence)
  return evidence
}
