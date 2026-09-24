import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { responsivePointFraming, assertResponsiveCaptureStable } from './pointResponsiveFraming.mjs'

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

/** Resize the actual root SVG through CSS, leaving the camera, viewBox, point
 * model, body and contour alone. Fixed placement makes bounded native captures
 * and screen-coordinate clicks independent of the App's surrounding drawers. */
export async function setPointDisplayScale(page, scale, standalone = false) {
  assert.ok(Number.isFinite(scale) && scale > 0, 'CSS display scale must be finite and positive')
  const size = await boundedPointDiagnostic(() => page.evaluate(({ scale, standalone }) => {
    const root = standalone ? document.documentElement : document.querySelector('svg.svg-diagram')
    const box = root.viewBox.baseVal
    return { width: Math.ceil(box.width * scale + 40), height: Math.ceil(box.height * scale + 40) }
  }, { scale, standalone }), 'responsive root size', 5000)
  assert.ok(size.width > 0 && size.height > 0 && size.width <= 4096 && size.height <= 4096,
    'Responsive native screenshot remains within its bounded viewport')
  await boundedPointDiagnostic(() => page.setViewportSize({ width: Math.max(1200, size.width), height: Math.max(900, size.height) }), 'responsive viewport resize', 5000)
  await boundedPointDiagnostic(() => page.evaluate(({ scale, standalone }) => {
    const root = standalone ? document.documentElement : document.querySelector('svg.svg-diagram')
    if (!root.hasAttribute('data-responsive-original-style')) root.setAttribute('data-responsive-original-style', JSON.stringify(root.getAttribute('style')))
    const box = root.viewBox.baseVal
    for (const [key, value] of Object.entries({ position: 'fixed', left: '20px', top: '20px',
      width: `${box.width * scale}px`, height: `${box.height * scale}px`, 'min-width': '0', 'min-height': '0',
      'max-width': 'none', 'max-height': 'none', margin: '0', padding: '0', border: '0', 'z-index': '2147483647' })) root.style.setProperty(key, value, 'important')
  }, { scale, standalone }), 'responsive CSS scale', 5000)
}

export async function restorePointDisplayScale(page) {
  await boundedPointDiagnostic(() => page.evaluate(() => {
    const root = document.querySelector('[data-responsive-original-style]')
    if (!root) return
    const original = JSON.parse(root.getAttribute('data-responsive-original-style'))
    if (original !== null) root.setAttribute('style', original)
    else root.removeAttribute('style')
    root.removeAttribute('data-responsive-original-style')
  }), 'responsive CSS restore', 5000)
}

/** A real browser screenshot is the paint oracle. Decode that exact PNG only
 * to count fixture-red pixels; never redraw the contour at scale 1. The root
 * and contour screen matrices, body, layout and screenshot crop are retained
 * before assertions, including for the deliberately broken vector effect. */
export async function measureResponsivePointPaint(page, { id = 'app-point', source = 'Scale', standalone = false } = {}) {
  return boundedPointDiagnostic(() => page.evaluate(({ id, source, standalone }) => {
    const root = standalone ? document.documentElement : document.querySelector('svg.svg-diagram')
    const body = standalone ? [...root.querySelectorAll('g > title')].find((title) => title.textContent === source)?.parentElement
      : root.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-label-state]`)
    const point = body?.parentElement
    const contour = standalone ? point && [...point.children].find((element) => ['circle', 'polygon'].includes(element.localName))
      : point?.querySelector(':scope > [data-point-contour]')
    if (!contour) throw new Error('Responsive point contour is missing')
    const matrix = (element) => { const m = element.getScreenCTM(); return m && { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f } }
    const rect = (element) => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height } }
    const bbox = (element) => { const b = element.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height } }
    const css = getComputedStyle(contour), rootCss = getComputedStyle(root)
    const state = window.stzAppLabels?.state()
    const diagram = state && JSON.parse(state.json).diagram
    return { root: { rect: rect(root), ctm: matrix(root), viewBox: root.getAttribute('viewBox'),
      width: root.getAttribute('width'), height: root.getAttribute('height'), cssWidth: rootCss.width, cssHeight: rootCss.height },
      viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio, scroll: { x: scrollX, y: scrollY },
      contour: { kind: contour.localName, ctm: matrix(contour), radius: Number(contour.getAttribute('r')),
        vertices: contour.localName === 'polygon' ? [...contour.points].map(({ x, y }) => ({ x, y })) : [],
        shapeBounds: bbox(contour), strokeWidth: parseFloat(css.strokeWidth), stroke: css.stroke, opacity: Number(css.strokeOpacity),
        vectorEffect: css.vectorEffect, dash: css.strokeDasharray, dashOffset: parseFloat(css.strokeDashoffset),
        lineCap: css.strokeLinecap, lineJoin: css.strokeLinejoin },
      body: { bounds: bbox(body), ctm: matrix(body), request: body.getAttribute('data-label-request'),
        source: standalone ? body.querySelector(':scope > title')?.textContent : body.getAttribute('data-label-source'),
        font: getComputedStyle(body).font },
      layout: { shapeBounds: point.getAttribute('data-point-shape-bounds')?.split(' ').map(Number),
        paintedBounds: point.getAttribute('data-point-painted-bounds')?.split(' ').map(Number),
        selectionRadius: point.querySelector('[data-svg-export-exclude]')?.getAttribute('r') ?? null },
      selection: state?.selection,
      framingState: { camera: diagram?.camera, view: diagram?.view, uiSettings: state?.uiSettings,
        previewCameraSummary: document.querySelector('.camera-summary')?.textContent ?? null,
        modelPosition: diagram?.strata.find((stratum) => stratum.id === id)?.position,
        pointTransform: point.getAttribute('transform'), rootTransform: root.getAttribute('transform') },
      xml: new XMLSerializer().serializeToString(root) }
  }, { id, source, standalone }), 'responsive point measurements', 5000)
}

export async function settleResponsivePointCapture(page) {
  await boundedPointDiagnostic(() => page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })), 'responsive layout settling', 5000)
}

export async function captureResponsivePointPaint(page, { id = 'app-point', source = 'Scale', standalone = false, path, persist,
  scale, variant = 'solid' }) {
  let observation = { capture: { status: 'pending', path } }
  const save = () => boundedPointDiagnostic(() => persist(observation), 'responsive capture evidence', 5000)
  try {
    const root = standalone ? page.locator('svg').first() : page.locator('svg.svg-diagram')
    // Explicit scrolling/settling precedes the retained coordinate snapshot.
    // Preflight then requires the entire root to fit; screenshot auto-scrolling
    // or any intervening layout/transform change must fail the post-check.
    await root.scrollIntoViewIfNeeded({ timeout: 5000 })
    await settleResponsivePointCapture(page)
    const before = await measureResponsivePointPaint(page, { id, source, standalone })
    observation = { ...before, capture: observation.capture }
    await save()
    observation.framing = responsivePointFraming(before, { scale, variant })
    await save()
    const png = await root.screenshot({ path, timeout: 5000, scale: 'css', animations: 'disabled' })
    const after = await measureResponsivePointPaint(page, { id, source, standalone })
    observation.measurements = { before: { ...before, xml: undefined }, after: { ...after, xml: undefined } }
    await save()
    assert.ok(png.length > 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Native capture is a PNG')
    const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
    observation.capture = { status: 'captured', path, bytes: png.length, ...dimensions }
    await save()
    assertResponsiveCaptureStable(before, after, dimensions)
    observation.capture.coordinatesStable = true

    const raster = await boundedPointDiagnostic(() => page.evaluate(async ({ png, observation }) => {
      const image = new Image(); image.src = `data:image/png;base64,${png}`
      let decodeTimer
      try {
        await Promise.race([image.decode(), new Promise((_, reject) => {
          decodeTimer = setTimeout(() => reject(new Error('Native responsive PNG decode exceeded 5000ms')), 5000)
        })])
      } finally { clearTimeout(decodeTimer) }
      const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')
      canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      const red = (x, y) => {
        x = Math.floor(x); y = Math.floor(y)
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false
        const index = (y * canvas.width + x) * 4
        return data[index] >= 100 && data[index + 1] < 80 && data[index + 2] < 80 && data[index + 3] > 127
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, count = 0
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (red(x, y)) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y + 1); count++
      }
      const m = observation.contour.ctm, crop = observation.root.rect
      const center = { x: m.e - crop.x, y: m.f - crop.y }
      const row = []
      for (let x = Math.ceil(center.x); x < canvas.width; x++) if (red(x, center.y)) row.push(x)
      const radius = observation.contour.radius
      const phaseSamples = observation.contour.kind === 'circle' ? [3, 6, 15, 17, 27, 30, 39, 41].map((distance) => {
        const angle = distance / radius, local = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
        const pixel = { x: local.x * m.a + local.y * m.c + center.x, y: local.x * m.b + local.y * m.d + center.y }
        return { distance, local, pixel, red: red(pixel.x, pixel.y) }
      }) : []
      return { width: canvas.width, height: canvas.height, redPixels: count,
        bounds: count ? { minX, minY, maxX, maxY } : null,
        eastRun: row.length ? { min: row[0], max: row.at(-1) + 1, width: row.at(-1) + 1 - row[0] } : null,
        center, phaseSamples, method: 'actual native screenshot PNG, fixture-red pixel mask; no SVG reconstruction' }
    }, { png: png.toString('base64'), observation: { ...before, xml: undefined } }), 'responsive PNG pixel decoding', 6000)
    observation.raster = raster
    observation.capture = { ...observation.capture, status: 'saved' }
    await save()
    return observation
  } catch (error) {
    if (error.framing) observation.framing = error.framing
    observation.capture = { ...observation.capture, status: 'failed', path, error: { message: error.message, stack: error.stack } }
    await save().catch(() => {})
    throw error
  }
}

/** Independent 20pt declaration: 24 local SVG units, 12 half-width; a regular
 * triangle's 60-degree corner extends 12/sin(30deg)=24 from its vertex. Path
 * geometry may be observed; neither expected border geometry nor the raster
 * target is computed from production painted bounds or strokeWidth. */
export function assertResponsivePointPaint(actual, { scale, shape = 'circle', variant = 'solid', selected = false, standalone = false } = {}) {
  responsivePointFraming(actual, { scale, variant })
  if (actual.measurements) assertResponsiveCaptureStable(actual.measurements.before, actual.measurements.after, actual.capture)
  const near = (value, target, tolerance, label) => assert.ok(Number.isFinite(value) && Math.abs(value - target) <= tolerance,
    `${label}: ${value} != ${target} (tolerance ${tolerance})`)
  for (const [name, m] of [['root', actual.root.ctm], ['contour', actual.contour.ctm]]) {
    near(m.a, scale, 1e-8, `${name} actual CSS display x scale`); near(m.d, scale, 1e-8, `${name} actual CSS display y scale`)
    near(m.b, 0, 1e-8, `${name} uniform scale`); near(m.c, 0, 1e-8, `${name} uniform scale`)
  }
  assert.equal(actual.capture.status, 'saved', 'Native paint screenshot exists')
  assert.ok(actual.capture.bytes > 24)
  near(actual.raster.width, actual.root.rect.width, 1, 'Raster preserves root display width')
  near(actual.raster.height, actual.root.rect.height, 1, 'Raster preserves root display height')
  if (actual.raster.bounds) {
    assert.ok(actual.raster.bounds.minX > 0 && actual.raster.bounds.minY > 0
      && actual.raster.bounds.maxX < actual.raster.width && actual.raster.bounds.maxY < actual.raster.height,
    'Actual contour is not cropped by the native viewport')
  }
  const enabled = variant !== 'disabled', visible = enabled && variant !== 'transparent'
  const halfWidth = enabled ? 12 : 0
  near(actual.contour.strokeWidth, 24, 1e-8, 'Declared 20pt is 24 local units')
  assert.equal(actual.contour.stroke === 'none', !enabled)
  near(actual.contour.opacity, variant === 'transparent' ? 0 : 1, 1e-8, 'Zero opacity remains enabled paint geometry')
  assert.equal(actual.contour.kind, shape === 'circle' ? 'circle' : 'polygon')
  if (shape === 'triangle') {
    assert.equal(actual.contour.vertices.length, 3, 'Supported triangle has three measured vertices')
    const [top, first, second] = [...actual.contour.vertices].sort((a, b) => a.y - b.y)
    const u = { x: first.x - top.x, y: first.y - top.y }, v = { x: second.x - top.x, y: second.y - top.y }
    const cosine = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))
    near(cosine, .5, 1e-6, 'Native top corner is independently 60 degrees')
  }
  const path = actual.contour.shapeBounds
  const bounds = shape === 'circle' ? [path.x - halfWidth, path.y - halfWidth, path.x + path.width + halfWidth, path.y + path.height + halfWidth]
    : [path.x - Math.sqrt(3) * halfWidth, path.y - 2 * halfWidth, path.x + path.width + Math.sqrt(3) * halfWidth, path.y + path.height + halfWidth]
  if (!standalone) {
    assert.equal(actual.layout.paintedBounds?.length, 4)
    actual.layout.paintedBounds.forEach((value, index) => near(value, bounds[index], 1e-4, `Independent local painted bound ${index}`))
  }
  if (selected) {
    const radius = shape === 'circle' ? actual.contour.radius : -Math.min(...actual.contour.vertices.map(({ y }) => y))
    near(Number(actual.layout.selectionRadius), radius + (shape === 'circle' ? halfWidth : 2 * halfWidth) + 6, 1e-4,
      'Selection ring includes geometric border and existing six-unit padding')
  }
  if (!visible) assert.equal(actual.raster.redPixels, 0, 'Disabled/zero-alpha border has no visible red paint')
  else if (variant === 'solid') {
    const raster = actual.raster, center = raster.center
    assert.ok(raster.bounds, 'Visible border has measured native painted pixels')
    for (const [index, key, offset] of [[0, 'minX', center.x], [1, 'minY', center.y], [2, 'maxX', center.x], [3, 'maxY', center.y]]) {
      near(raster.bounds[key], bounds[index] * scale + offset, 1.75, `Native physical paint extent ${key}`)
    }
    if (shape === 'circle') near(raster.eastRun?.width, 24 * scale, 2, 'Physical border thickness follows measured display CTM')
  } else if (variant === 'dashed') {
    assert.deepEqual(actual.contour.dash.split(/[ ,]+/).map(parseFloat), [14.4, 9.6])
    near(actual.contour.dashOffset, 3.6, 1e-8, 'Declared 3pt dash phase')
    assert.ok(actual.raster.redPixels > 0)
    if (shape === 'circle') for (const sample of actual.raster.phaseSamples) {
      assert.equal(sample.red, (sample.distance + 3.6) % 24 < 14.4,
        `Native dash/phase at ${sample.distance} local units scales with CTM ${scale}`)
    }
  }
}
