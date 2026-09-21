/** Independent native-SVG and pixel oracle for path inline-label presentation.
 * Production layout bounds are checked against native painted descendants;
 * halo pixels are compared with the identical rendered foreground alone. */
import { compareInlineCompositePixel, type Rgba } from './inlineLabelComposite.ts'

const required = <T,>(value: T | null, message: string): T => {
  if (value === null) throw new Error(message)
  return value
}
const matrixData = ({ a, b, c, d, e, f }: DOMMatrix) => ({ a, b, c, d, e, f })
const paintProperties = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-kerning',
  'text-rendering', 'white-space', 'color', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity',
  'stroke-width', 'vector-effect', 'opacity', 'isolation', 'mix-blend-mode', 'pointer-events']
function describe(element: SVGElement) {
  const style = getComputedStyle(element)
  return { tag: element.tagName, attributes: Object.fromEntries(Array.from(element.attributes, ({ name, value }) => [name, value])),
    computed: Object.fromEntries(paintProperties.map((name) => [name, style.getPropertyValue(name)])),
    matrix: element instanceof SVGGraphicsElement && element.getScreenCTM() ? matrixData(element.getScreenCTM()!) : null }
}
export async function inspectInlineLabel(pathId: string, nodeId: string, rasterize = false, controls = false) {
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
    paint: rasterize ? { node: describe(node), parent: describe(outer), svg: describe(required(node.ownerSVGElement, 'SVG missing')),
      // DOM order is paint order; include nested viewBoxes and MathJax transforms.
      descendantCount: node.querySelectorAll('*').length, descendantLimit: 512,
      descendants: Array.from(node.querySelectorAll<SVGElement>('*')).slice(0, 512).map(describe) } : undefined,
    raster: rasterize ? await rasterEvidence(node, native, controls) : undefined,
  } }
  return result
}

async function rasterEvidence(node: SVGGElement, box: { minX: number; minY: number; maxX: number; maxY: number }, controls: boolean) {
  const margin = 7
  const left = Math.floor(box.minX) - margin, top = Math.floor(box.minY) - margin
  const width = Math.ceil(box.maxX) - left + margin, height = Math.ceil(box.maxY) - top + margin
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || width * height > 1_000_000) {
    throw new Error('Inline raster oracle work bound exceeded')
  }
  type Variant = 'normal' | 'no-foreground-stroke' | 'isolated-foreground' | 'halo-over-foreground'
    | 'missing-halo' | 'oversized-halo' | 'rectangular-background' | 'wrong-color' | 'wrong-opacity'
  async function paint(layer: 'foreground' | 'halo' | 'outlined' | 'foregroundOnWhite', variant: Variant = 'normal') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height))
    svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)
    const clone = node.cloneNode(true) as SVGGElement
    clone.removeAttribute('transform')
    clone.querySelectorAll('title,desc,[data-svg-export-exclude]').forEach((entry) => entry.remove())
    if (layer === 'foreground' || layer === 'foregroundOnWhite') clone.querySelectorAll('[data-label-halo]').forEach((entry) => entry.remove())
    if (layer === 'halo') clone.querySelectorAll('[data-label-content]').forEach((entry) => entry.remove())
    const front = clone.querySelector<SVGGElement>('[data-label-content]')
    const outline = clone.querySelector<SVGGElement>('[data-label-halo]')
    if (variant === 'no-foreground-stroke') front?.querySelectorAll('path').forEach((entry) => entry.setAttribute('stroke', 'none'))
    if (variant === 'isolated-foreground') front?.setAttribute('style', 'isolation:isolate')
    if (variant === 'halo-over-foreground' && outline) outline.parentNode?.appendChild(outline)
    if (variant === 'missing-halo') outline?.remove()
    if (variant === 'oversized-halo') outline?.querySelectorAll('[stroke-width]').forEach((entry) => entry.setAttribute('stroke-width', '12'))
    if (variant === 'wrong-color') front?.querySelectorAll('text,path,rect,line,polygon,polyline').forEach((entry) => {
      entry.setAttribute('fill', '#dc2626'); entry.setAttribute('stroke', '#dc2626')
    })
    if (variant === 'wrong-opacity') front?.setAttribute('opacity', '0.5')
    if (layer === 'foregroundOnWhite' || variant === 'rectangular-background') {
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      for (const [name, value] of Object.entries({ x: left, y: top, width, height, fill: '#ffffff' })) {
        background.setAttribute(name, String(value))
      }
      svg.append(background)
    }
    svg.append(clone)
    const serializedSvg = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([serializedSvg], { type: 'image/svg+xml' }))
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const image = new Image()
    try {
      const context = required(canvas.getContext('2d', { willReadFrequently: true }), 'Raster context missing')
      image.src = url
      await image.decode(); context.drawImage(image, 0, 0)
      return { pixels: context.getImageData(0, 0, width, height).data, dataUrl: canvas.toDataURL(), serializedSvg }
    } finally { URL.revokeObjectURL(url); image.removeAttribute('src'); svg.remove(); canvas.width = 0; canvas.height = 0 }
  }
  const foreground = await paint('foreground'), halo = await paint('halo'), outlined = await paint('outlined')
  // Direct SVG fill/stroke painting over white need not equal flattening that
  // geometry on transparent first and reconstructing it from 8-bit readback.
  // Use an independent white backdrop exactly where the halo-only pixel is
  // opaque white. Elsewhere retain the original source-over calculation.
  // Neither reference reads the outlined output. Both keep the <=2 bound.
  const foregroundOnWhite = await paint('foregroundOnWhite')
  function compare(output: typeof outlined, front = foreground, onWhite = foregroundOnWhite) {
    const outlined = output, foreground = front
    let dark = 0, darkPreserved = 0, addedWhite = 0, distantClear = 0, distantFilled = 0
    let compositeCompared = 0, maxCompositeError = 0
    let maxAlphaError = 0, maxPremultipliedError = 0
    let opaqueWhiteCompared = 0, sourceOverCompared = 0, maxBackdropCompositeError = 0, maxBackdropPremultipliedError = 0
    let maxOpaqueWhiteError = 0, maxSourceOverError = 0, maxBackdropAlphaError = 0
    const worstBackdropPixels: { x: number; y: number; reference: string; expected: Rgba; actual: Rgba; error: number }[] = []
    const worstBackdropPremultipliedPixels: typeof worstBackdropPixels = []
    const worstPixels: { x: number; y: number; channel: number; premultipliedChannel: number;
      foreground: number[]; halo: number[]; outlined: number[];
      foregroundOnWhite: Rgba; backdropExpected: Rgba; backdropError: number;
      expected: number[]; colorDifference: number; alphaDifference: number; premultipliedDifference: number }[] = []
    const worstPremultipliedPixels: typeof worstPixels = []
    const expectedPixels = new Uint8ClampedArray(width * height * 4)
    const differencePixels = new Uint8ClampedArray(width * height * 4)
    const alphaDifferencePixels = new Uint8ClampedArray(width * height * 4)
    const backdropExpectedPixels = new Uint8ClampedArray(width * height * 4)
    const backdropDifferencePixels = new Uint8ClampedArray(width * height * 4)
    const rgba = (pixels: Uint8ClampedArray, index: number): Rgba =>
      [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]]
    const retainWorst = (list: typeof worstPixels, sample: typeof worstPixels[number], premultiplied = false) => {
      const error = (pixel: typeof sample) => Math.max(pixel.alphaDifference,
        premultiplied ? pixel.premultipliedDifference : pixel.colorDifference)
      if (list.length === 12 && error(sample) <= error(list[list.length - 1])) return
      list.push(sample); list.sort((a, b) => error(b) - error(a)); list.length = Math.min(list.length, 12)
    }
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
      const expected = [0, 1, 2].map((channel) => expectedAlpha === 0 ? 0 :
        (foreground.pixels[index + channel] * frontAlpha
          + halo.pixels[index + channel] * haloAlpha * (1 - frontAlpha)) / expectedAlpha)
      expected.push(expectedAlpha * 255)
      expectedPixels.set(expected, index)
      const alphaDifference = Math.abs(expected[3] - outlined.pixels[index + 3])
      const colorDifferences = expected.slice(0, 3).map((value, channel) => Math.abs(value - outlined.pixels[index + channel]))
      const premultipliedDifferences = expected.slice(0, 3).map((value, channel) =>
        Math.abs(value * expectedAlpha - outlined.pixels[index + channel] * outlined.pixels[index + 3] / 255))
      maxAlphaError = Math.max(maxAlphaError, alphaDifference)
      maxPremultipliedError = Math.max(maxPremultipliedError, ...premultipliedDifferences)
      differencePixels.set([...premultipliedDifferences.map((value) => value * 32), 255], index)
      alphaDifferencePixels.set([alphaDifference * 32, alphaDifference * 32, alphaDifference * 32, 255], index)
      const colorDifference = Math.max(...colorDifferences)
      const premultipliedDifference = Math.max(...premultipliedDifferences)
      const backdrop = compareInlineCompositePixel(rgba(foreground.pixels, index), rgba(halo.pixels, index),
        rgba(onWhite.pixels, index), rgba(outlined.pixels, index))
      const backdropError = Math.max(backdrop.alphaDifference, backdrop.colorDifference)
      const sample = { x, y, channel: alphaDifference > colorDifference ? 3 : colorDifferences.indexOf(colorDifference),
        premultipliedChannel: alphaDifference > premultipliedDifference ? 3 : premultipliedDifferences.indexOf(premultipliedDifference),
        foreground: Array.from(foreground.pixels.slice(index, index + 4)), halo: Array.from(halo.pixels.slice(index, index + 4)),
        outlined: Array.from(outlined.pixels.slice(index, index + 4)), expected, colorDifference, alphaDifference,
        premultipliedDifference, foregroundOnWhite: rgba(onWhite.pixels, index), backdropExpected: backdrop.expected, backdropError }
      // Diagnostic only: do not discard low-alpha pixels while investigating the
      // original straight-alpha assertion. These values do not count as passes.
      retainWorst(worstPremultipliedPixels, sample, true)
      if (expectedAlpha * 255 > 40) {
        compositeCompared++
        maxCompositeError = Math.max(maxCompositeError, alphaDifference, colorDifference)
        retainWorst(worstPixels, sample)
      }
      const backdropPremultipliedError = Math.max(backdrop.alphaDifference, backdrop.premultipliedDifference)
      maxBackdropAlphaError = Math.max(maxBackdropAlphaError, backdrop.alphaDifference)
      maxBackdropPremultipliedError = Math.max(maxBackdropPremultipliedError, backdropPremultipliedError)
      if (worstBackdropPremultipliedPixels.length < 12 || backdropPremultipliedError > worstBackdropPremultipliedPixels.at(-1)!.error) {
        worstBackdropPremultipliedPixels.push({ x, y, reference: backdrop.reference, expected: backdrop.expected,
          actual: rgba(outlined.pixels, index), error: backdropPremultipliedError })
        worstBackdropPremultipliedPixels.sort((a, b) => b.error - a.error)
        worstBackdropPremultipliedPixels.length = Math.min(12, worstBackdropPremultipliedPixels.length)
      }
      backdropExpectedPixels.set(backdrop.expected, index)
      backdropDifferencePixels.set([0, 1, 2].map((channel) => Math.abs(backdrop.expected[channel] * backdrop.expected[3] / 255
        - outlined.pixels[index + channel] * outlined.pixels[index + 3] / 255) * 32).concat(255), index)
      if (expectedAlpha * 255 > 40) {
        // Identical pixel population to the original straight-alpha comparison.
        maxBackdropCompositeError = Math.max(maxBackdropCompositeError, backdropError)
        if (backdrop.reference === 'opaque-white-backdrop') {
          opaqueWhiteCompared++; maxOpaqueWhiteError = Math.max(maxOpaqueWhiteError, backdropError)
        } else {
          sourceOverCompared++; maxSourceOverError = Math.max(maxSourceOverError, backdropError)
        }
        if (worstBackdropPixels.length < 12 || backdropError > worstBackdropPixels.at(-1)!.error) {
          worstBackdropPixels.push({ x, y, reference: backdrop.reference, expected: backdrop.expected,
            actual: rgba(outlined.pixels, index), error: backdropError })
          worstBackdropPixels.sort((a, b) => b.error - a.error); worstBackdropPixels.length = Math.min(12, worstBackdropPixels.length)
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
        // Infinity would become null across Playwright/JSON, hiding an oversized
        // outline. Six is the conservative lower bound outside this search.
        distances.push(Number.isFinite(nearest) ? nearest : 6)
      }
      // Internal blank pixels far from glyphs must remain transparent. This
      // rejects solid formula backgrounds while allowing the intended halo.
      if (nearest > 3 && x + left > box.minX && x + left < box.maxX && y + top > box.minY && y + top < box.maxY) {
        distantClear++
        if (ink(outlined.pixels, index)) distantFilled++
      }
    }
    function png(pixels: Uint8ClampedArray) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
      try {
        const context = required(canvas.getContext('2d'), 'Visualization context missing')
        const data = context.createImageData(width, height); data.data.set(pixels); context.putImageData(data, 0, 0)
        return canvas.toDataURL()
      } finally { canvas.width = 0; canvas.height = 0 }
    }
    return { width, height, viewBox: [left, top, width, height], dark, darkPreserved, compositeCompared, maxCompositeError,
      maxAlphaError, maxPremultipliedError, worstPixels, worstPremultipliedPixels,
      opaqueWhiteCompared, sourceOverCompared, maxBackdropCompositeError, maxBackdropPremultipliedError,
      maxOpaqueWhiteError, maxSourceOverError, maxBackdropAlphaError, worstBackdropPixels, worstBackdropPremultipliedPixels,
      diagnosticComparison: { space: 'premultiplied byte RGB and byte alpha', pixels: width * height, differenceGain: 32,
        acceptance: 'maxBackdropCompositeError <= 2 on the same expected-alpha > 40 pixels; maxBackdropPremultipliedError <= 2 on ALL pixels. Opaque-white halo: direct foreground on independent white. Otherwise: unchanged source-over. Original flattened comparison retained as diagnostic.' },
      addedWhite, distantClear, distantFilled,
      furthestAddedPixel: distances.reduce((maximum, value) => Math.max(maximum, value), 0),
      images: { expected: png(expectedPixels), difference: png(differencePixels), alphaDifference: png(alphaDifferencePixels),
        backdropExpected: png(backdropExpectedPixels), backdropDifference: png(backdropDifferencePixels) } }
  }
  const result = compare(outlined)
  const images: Record<string, string> = { ...result.images }
  const svgs: Record<string, string> = {}
  const retain = (name: string, raster: typeof outlined) => { images[name] = raster.dataUrl; svgs[name] = raster.serializedSvg }
  for (const [name, raster] of Object.entries({ foreground, halo, outlined, foregroundOnWhite })) retain(name, raster)
  const negativeControls = []
  const experiments = []
  if (controls) {
    // Only mutate a fresh tested output; every control uses the unmodified
    // foreground/halo/white references. No mounted production DOM is changed.
    for (const variant of ['halo-over-foreground', 'missing-halo', 'oversized-halo',
      'rectangular-background', 'wrong-color', 'wrong-opacity'] as const) {
      const bad = await paint('outlined', variant)
      const { images: differences, ...metrics } = compare(bad)
      negativeControls.push({ variant, ...metrics })
      retain(`control-${variant}`, bad)
      images[`control-${variant}-difference`] = differences.backdropDifference
    }
    // Change one rasterization condition at a time, in BOTH independently
    // rendered foreground and combined SVG. Evidence only, never a pass record.
    for (const variant of ['no-foreground-stroke', 'isolated-foreground'] as const) {
      const front = await paint('foreground', variant), combined = await paint('outlined', variant)
      const white = await paint('foregroundOnWhite', variant)
      const { images: differences, ...metrics } = compare(combined, front, white)
      experiments.push({ variant, ...metrics })
      for (const [name, raster] of Object.entries({ foreground: front, outlined: combined, foregroundOnWhite: white })) {
        retain(`experiment-${variant}-${name}`, raster)
      }
      images[`experiment-${variant}-difference`] = differences.difference
    }
  }
  return { ...result, negativeControls, experiments, images, svgs }
}
