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
  const context = required(document.createElement('canvas').getContext('2d'), 'Canvas unavailable')
  let whitespaceAdvance = 0
  for (const text of content.querySelectorAll('text')) {
    context.font = getComputedStyle(text).font
    const value = text.textContent ?? ''
    const leading = value.match(/^\s*/u)?.[0] ?? ''
    const trailing = value.match(/\s*$/u)?.[0] ?? ''
    whitespaceAdvance = Math.max(whitespaceAdvance, context.measureText(leading).width, context.measureText(trailing).width)
  }
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
    request: node.getAttribute('data-label-request'), fontSize,
    ink, native, published, hit: hit ? asBounds(hit.getBBox()) : null,
    inkSvg: transformBounds(ink, localToSvg), inkClient: transformBounds(ink, localToClient),
    publishedSvg: transformBounds(published, localToSvg), publishedClient: transformBounds(published, localToClient),
    localToClient: matrixData(localToClient), localToSvg: matrixData(localToSvg), svgToClient: matrixData(svgToClient),
    descendants: measured, paintedRectangles: measured.filter(({ tag }) => tag === 'rect').length,
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
