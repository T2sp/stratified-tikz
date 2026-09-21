/** Independent native-SVG and pixel oracle for path inline-label presentation.
 * Production layout bounds are checked against native painted descendants;
 * halo pixels are compared with the identical rendered foreground alone. */
const required = <T,>(value: T | null, message: string): T => {
  if (value === null) throw new Error(message)
  return value
}
const matrixData = ({ a, b, c, d, e, f }: DOMMatrix) => ({ a, b, c, d, e, f })
export async function inspectInlineLabel(pathId: string, nodeId: string, rasterize = false) {
  const outer = required(document.querySelector<SVGGElement>(
    `[data-path-inline-node-path-id="${CSS.escape(pathId)}"][data-path-inline-node-id="${CSS.escape(nodeId)}"]`), 'Inline-node group missing')
  const marker = required(outer.querySelector<SVGCircleElement>(':scope > circle'), 'Marker missing')
  const node = outer.querySelector<SVGGElement>('[data-label-state]')
  const matrix = required(outer.getScreenCTM(), 'Inline node screen transform missing')
  const markerPoint = new DOMPoint(marker.cx.baseVal.value, marker.cy.baseVal.value).matrixTransform(matrix)
  const markerState = { x: marker.cx.baseVal.value, y: marker.cy.baseVal.value, r: marker.r.baseVal.value,
    fill: marker.getAttribute('fill'), fillOpacity: marker.getAttribute('fill-opacity'),
    stroke: marker.getAttribute('stroke'), strokeWidth: marker.getAttribute('stroke-width'),
    client: { x: markerPoint.x, y: markerPoint.y } }
  if (!node) return { pathId, nodeId, marker: markerState, label: null }
  const content = required(node.querySelector<SVGGElement>('[data-label-content]'), 'Foreground content missing')
  const halo = required(node.querySelector<SVGGElement>('[data-label-halo]'), 'Decorative halo missing')
  const foregroundBox = content.getBBox()
  const contentToNode = required(node.getScreenCTM(), 'Label transform missing').inverse()
    .multiply(required(content.getScreenCTM(), 'Content transform missing'))
  const corners = [new DOMPoint(foregroundBox.x, foregroundBox.y),
    new DOMPoint(foregroundBox.x + foregroundBox.width, foregroundBox.y + foregroundBox.height)]
    .map((point) => point.matrixTransform(contentToNode))
  const native = { minX: Math.min(...corners.map(({ x }) => x)), minY: Math.min(...corners.map(({ y }) => y)),
    maxX: Math.max(...corners.map(({ x }) => x)), maxY: Math.max(...corners.map(({ y }) => y)) }
  const bounds = required(node.getAttribute('data-label-bounds'), 'Published bounds missing').split(' ').map(Number)
  const rect = content.getBoundingClientRect()
  const texts = Array.from(content.querySelectorAll('text'), (text) => ({ text: text.textContent,
    x: text.x.baseVal.getItem(0)?.value, y: text.y.baseVal.getItem(0)?.value,
    xmlSpace: text.getAttribute('xml:space'), whiteSpace: getComputedStyle(text).whiteSpace,
    fontSize: getComputedStyle(text).fontSize, fill: getComputedStyle(text).fill }))
  const result = { pathId, nodeId, marker: markerState, label: {
    source: node.getAttribute('data-label-source'), status: node.getAttribute('data-label-state'),
    owner: node.getAttribute('data-label-owner'),
    request: node.getAttribute('data-label-request'), transform: node.getAttribute('transform'),
    pointerEvents: getComputedStyle(node).pointerEvents,
    bounds: { minX: bounds[0], minY: bounds[1], maxX: bounds[2], maxY: bounds[3] }, native,
    matrix: matrixData(required(node.getScreenCTM(), 'Label matrix missing')),
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    math: content.querySelectorAll('[data-label-math]').length,
    literal: Array.from(content.querySelectorAll('[data-label-literal]'), (text) => text.textContent), texts,
    halos: node.querySelectorAll('[data-label-halo]').length, haloHidden: halo.getAttribute('aria-hidden'),
    haloPointerEvents: getComputedStyle(halo).pointerEvents,
    haloTitles: halo.querySelectorAll('title,desc,[role="img"],[aria-label]').length,
    hitRectangles: node.querySelectorAll(':scope > rect[data-svg-export-exclude]').length,
    raster: rasterize ? await rasterEvidence(node, native) : undefined,
  } }
  return result
}

async function rasterEvidence(node: SVGGElement, box: { minX: number; minY: number; maxX: number; maxY: number }) {
  const margin = 7
  const left = Math.floor(box.minX) - margin, top = Math.floor(box.minY) - margin
  const width = Math.ceil(box.maxX) - left + margin, height = Math.ceil(box.maxY) - top + margin
  if (width * height > 1_000_000) throw new Error('Inline raster oracle work bound exceeded')
  async function paint(layer: 'foreground' | 'halo' | 'outlined') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height))
    svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)
    const clone = node.cloneNode(true) as SVGGElement
    clone.removeAttribute('transform')
    clone.querySelectorAll('title,desc,[data-svg-export-exclude]').forEach((entry) => entry.remove())
    if (layer === 'foreground') clone.querySelectorAll('[data-label-halo]').forEach((entry) => entry.remove())
    if (layer === 'halo') clone.querySelectorAll('[data-label-content]').forEach((entry) => entry.remove())
    svg.append(clone)
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = required(canvas.getContext('2d', { willReadFrequently: true }), 'Raster context missing')
    try {
      const image = new Image(); image.src = url
      await image.decode(); context.drawImage(image, 0, 0)
    } finally { URL.revokeObjectURL(url) }
    return { pixels: context.getImageData(0, 0, width, height).data, dataUrl: canvas.toDataURL() }
  }
  const foreground = await paint('foreground'), halo = await paint('halo'), outlined = await paint('outlined')
  let dark = 0, darkPreserved = 0, addedWhite = 0, distantClear = 0, distantFilled = 0
  let compositeCompared = 0, maxCompositeError = 0
  const distances: number[] = []
  const ink = (pixels: Uint8ClampedArray, index: number) => pixels[index + 3] > 40
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4
    if (foreground.pixels[index + 3] === 255 && foreground.pixels[index] < 60) {
      dark++
      if (outlined.pixels[index + 3] === 255 && [0, 1, 2].every((channel) =>
        Math.abs(outlined.pixels[index + channel] - foreground.pixels[index + channel]) <= 2)) darkPreserved++
    }
    // Compare antialiased pixels to source-over of two independently painted
    // layers, rather than requiring partially transparent edges to stay dark.
    const frontAlpha = foreground.pixels[index + 3] / 255, haloAlpha = halo.pixels[index + 3] / 255
    const expectedAlpha = frontAlpha + haloAlpha * (1 - frontAlpha)
    if (expectedAlpha * 255 > 40) {
      compositeCompared++
      maxCompositeError = Math.max(maxCompositeError, Math.abs(expectedAlpha * 255 - outlined.pixels[index + 3]))
      for (const channel of [0, 1, 2]) {
        const expected = (foreground.pixels[index + channel] * frontAlpha
          + halo.pixels[index + channel] * haloAlpha * (1 - frontAlpha)) / expectedAlpha
        maxCompositeError = Math.max(maxCompositeError, Math.abs(expected - outlined.pixels[index + channel]))
      }
    }
    if (ink(foreground.pixels, index)) continue
    let nearest = Infinity
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const px = x + dx, py = y + dy
      if (px >= 0 && px < width && py >= 0 && py < height && ink(foreground.pixels, (py * width + px) * 4)) {
        nearest = Math.min(nearest, Math.hypot(dx, dy))
      }
    }
    if (ink(outlined.pixels, index)) {
      if ([0, 1, 2].every((channel) => outlined.pixels[index + channel] > 235)) addedWhite++
      distances.push(nearest)
    }
    // Internal blank pixels far from glyphs must remain transparent. This
    // rejects solid formula backgrounds while allowing the intended halo.
    if (nearest > 3 && x + left > box.minX && x + left < box.maxX && y + top > box.minY && y + top < box.maxY) {
      distantClear++
      if (ink(outlined.pixels, index)) distantFilled++
    }
  }
  return { width, height, dark, darkPreserved, compositeCompared, maxCompositeError, addedWhite, distantClear, distantFilled,
    furthestAddedPixel: Math.max(0, ...distances), foregroundDataUrl: foreground.dataUrl, outlinedDataUrl: outlined.dataUrl }
}
