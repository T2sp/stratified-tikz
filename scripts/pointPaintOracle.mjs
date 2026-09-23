import assert from 'node:assert/strict'

/** Observe the actual native SVG paint tree. This module never resolves model
 * styles; expected colors/alphas in acceptance are literal independent values. */
export async function observePointPaint(page, { id, source, standalone = false } = {}) {
  return page.evaluate(({ id, source, standalone }) => {
    const bodies = standalone
      ? [...document.querySelectorAll('g > title')].filter((title) => title.textContent === source.replace(/\r\n?/g, '\n')).map((title) => title.parentElement)
      : [...document.querySelectorAll(`[data-point-id="${CSS.escape(id)}"] [data-label-state]`)]
    if (bodies.length !== 1) throw new Error('Missing or ambiguous point paint body')
    const body = bodies[0], point = body.parentElement
    const contour = standalone ? [...point.children].find((element) => ['circle', 'polygon'].includes(element.localName))
      : point.querySelector(':scope > [data-point-contour]')
    if (!contour) throw new Error('Missing point paint contour')
    const root = point.ownerSVGElement
    const opacityChain = (element) => {
      const values = []
      for (let current = element; current && current !== root.parentElement; current = current.parentElement) {
        values.push({ kind: current.localName, opacity: Number(getComputedStyle(current).opacity) })
      }
      return values
    }
    const paint = (element) => {
      const css = getComputedStyle(element), chain = opacityChain(element)
      const opacity = chain.reduce((value, entry) => value * entry.opacity, 1)
      return { fill: css.fill, stroke: css.stroke, fillOpacity: Number(css.fillOpacity), strokeOpacity: Number(css.strokeOpacity),
        fillAlpha: Number(css.fillOpacity) * opacity, strokeAlpha: Number(css.strokeOpacity) * opacity,
        strokeWidth: parseFloat(css.strokeWidth), dash: css.strokeDasharray, dashOffset: parseFloat(css.strokeDashoffset),
        cap: css.strokeLinecap, join: css.strokeLinejoin, chain }
    }
    const bounds = (element) => { const box = element.getBBox(); return { x: box.x, y: box.y, width: box.width, height: box.height } }
    return { source: standalone ? body.querySelector(':scope > title').textContent : body.getAttribute('data-label-source'),
      state: body.getAttribute('data-label-state'), request: body.getAttribute('data-label-request'),
      pointRequest: point.getAttribute('data-point-request'), contour: paint(contour), contourMarkup: contour.outerHTML,
      bodyBounds: bounds(body), shapeBounds: bounds(contour), radius: Number(contour.getAttribute('r')),
      leaves: [...body.querySelectorAll('text,path,rect,use')].map((element) => ({ kind: element.localName, text: element.textContent, ...paint(element) })),
      mathPaths: body.querySelectorAll('path').length,
      backgroundCount: [...document.documentElement.children].filter((element) => element.localName === 'rect' && element.getAttribute('fill') === '#ffffff').length,
      forbidden: document.querySelectorAll('parsererror,foreignObject,image,script:not([type="module"]),[data-svg-export-exclude]').length,
      externalReferences: [...document.querySelectorAll('[href]')].map((element) => element.getAttribute('href')).filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1))) }
  }, { id, source, standalone })
}

export function assertPointPaint(actual, expected) {
  const close = (value, target, label) => assert.ok(Math.abs(value - target) < 1e-8, `${label}: ${value} != ${target}`)
  for (const key of ['fill', 'stroke', 'cap', 'join']) if (key in expected) assert.equal(actual.contour[key], expected[key], key)
  for (const key of ['fillAlpha', 'strokeAlpha', 'strokeWidth', 'dashOffset']) if (key in expected) close(actual.contour[key], expected[key], key)
  if ('dashed' in expected) assert.equal(actual.contour.dash !== 'none', expected.dashed)
  if (expected.text) {
    const inherited = actual.leaves.filter((leaf) => leaf.fill === expected.text)
    assert.ok(inherited.length > 0, `Expected text paint ${expected.text}: ${JSON.stringify(actual.leaves)}`)
    inherited.forEach((leaf) => close(leaf.fillAlpha, expected.textAlpha, 'text alpha'))
  }
  if (expected.explicitMathColor) assert.ok(actual.leaves.some((leaf) => leaf.kind === 'path' && leaf.fill === expected.explicitMathColor), 'Explicit formula color survives inherited text paint')
}

/** Rasterize only the observed contour and its original opacity ancestors.
 * Sampling the overlap at the circle's inside border distinguishes independent
 * alphas from group opacity, without reproducing the production resolver. */
export async function rasterPointOverlap(page, id) {
  return page.evaluate(async (id) => {
    const point = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
    const contour = point?.querySelector('[data-point-contour]')
    if (!contour || contour.localName !== 'circle') throw new Error('Overlap oracle needs a circle')
    const radius = Number(contour.getAttribute('r')), width = parseFloat(getComputedStyle(contour).strokeWidth)
    if (radius < width * 2 || width < 4) throw new Error('Overlap samples require large separated paint areas')
    const namespace = 'http://www.w3.org/2000/svg', svg = document.createElementNS(namespace, 'svg')
    const side = Math.ceil((radius + width + 5) * 2), half = side / 2
    svg.setAttribute('xmlns', namespace); svg.setAttribute('width', String(side)); svg.setAttribute('height', String(side))
    svg.setAttribute('viewBox', `${-half} ${-half} ${side} ${side}`)
    let inner = contour.cloneNode(true)
    for (let parent = contour.parentElement; parent && parent.localName !== 'svg'; parent = parent.parentElement) {
      const group = document.createElementNS(namespace, 'g')
      group.setAttribute('opacity', getComputedStyle(parent).opacity)
      group.append(inner); inner = group
    }
    svg.append(inner)
    const xml = new XMLSerializer().serializeToString(svg)
    const image = new Image(); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
    const sample = (x, y) => [...context.getImageData(Math.floor(x + half), Math.floor(y + half), 1, 1).data]
    return { radius, width, xml, fill: sample(0, 0), overlap: sample(0, radius - width / 4), stroke: sample(0, radius + width / 4) }
  }, id)
}

export function assertRasterPointOverlap(actual) {
  // Fixture: overall=.5; blue fill=.4; green stroke=.6. Independent effective
  // alpha is .2 and .3; source-over overlap is .3 + .2*(1-.3) = .44.
  const close = (actual, expected) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= 2,
    `Raster channel ${index}: ${value} != ${expected[index]}`))
  close(actual.fill, [0, 0, 255, 51])
  close(actual.stroke, [0, 128, 0, 77])
  close(actual.overlap, [0, 87, 81, 112])
}
