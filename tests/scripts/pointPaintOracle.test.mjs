import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { assertPointPaint, assertRasterPointOverlap, assertResponsivePointPaint, captureResponsivePointPaint,
  measureResponsivePointPaint, restorePointDisplayScale, setPointDisplayScale,
  observePostExternalPointPaint, assertPostExternalPointPaint, observeLiteralPointPaint,
  assertExplicitPointPaint } from '../../scripts/pointPaintOracle.mjs'
import { assertResponsiveCaptureStable, responsivePointFraming, responsivePointProbes } from '../../scripts/pointResponsiveFraming.mjs'

test('external paint oracle uses the actual post-key options and resolves the final named color', () => {
  const code = String.raw`\definecolor{before}{HTML}{000000}
\definecolor{after}{HTML}{123456}
\node[fill=before,example,fill=after,text=before] at (0,0) {};
\node[fill=before,unrelated] at (1,0) {};`
  const output = observePostExternalPointPaint(code, 'example')
  assertPostExternalPointPaint(output, { fill: '#123456', text: '#000000', draw: null })
  assert.throws(() => assertPostExternalPointPaint(output, { fill: '#000000' }))
  assert.throws(() => assertPostExternalPointPaint(output, { fill: null }))
  const untouched = observePostExternalPointPaint(code.replace('example,fill=after', 'example'), 'example')
  assertPostExternalPointPaint(untouched, { fill: null })
  assert.throws(() => assertPostExternalPointPaint(untouched, { fill: '#000000' }))
  assert.throws(() => observePostExternalPointPaint(code + '\n\\node[example] at (2,0) {};', 'example'))
})

test('detached point oracle examines the literal target and checks every explicit paint setting', () => {
  const code = String.raw`\definecolor{target}{HTML}{123456}
\definecolor{other}{HTML}{654321}
\node[fill=target,text=other,draw=target,fill opacity=.25,text opacity=.5,draw opacity=.75,line width=3pt,dash pattern=on 3pt off 2pt,dash phase=1pt,line cap=round,line join=bevel] at (0,0) {Clear target};
\node[redpoint,fill=other] at (1,0) {Control point};`
  const expected = { opacity: 1, paint: { text: { color: '#654321', opacity: .5 }, fill: { enabled: true, color: '#123456', opacity: .25 },
    stroke: { enabled: true, color: '#123456', opacity: .75, width: 3, lineStyle: 'solid', dashPattern: [3, 2], dashPhase: 1, lineCap: 'round', lineJoin: 'bevel' } } }
  const observed = observeLiteralPointPaint(code, 'Clear target')
  assert.equal(observed.options.includes('redpoint'), false)
  assertExplicitPointPaint(observed, expected)
  for (const [before, after] of [['fill=target', 'fill=other'], ['text opacity=.5', 'text opacity=.6'], ['draw opacity=.75', 'draw opacity=1'],
    ['line width=3pt', 'line width=2pt'], ['dash phase=1pt', 'dash phase=0pt'], ['on 3pt off 2pt', 'on 2pt off 3pt'], ['line cap=round', 'line cap=butt'], ['line join=bevel', 'line join=miter']]) {
    assert.throws(() => assertExplicitPointPaint(observeLiteralPointPaint(code.replace(before, after), 'Clear target'), expected))
  }
  assert.throws(() => observeLiteralPointPaint(code, 'absent target'))
  assert.throws(() => observeLiteralPointPaint(`${code}\n\\node[fill=target] at (2,0) {Clear target};`, 'Clear target'))
})

test('paint oracle rejects coupled colors, lost zero opacity, dropped dash and lost explicit math color', () => {
  const expected = { fill: 'rgb(0, 0, 255)', stroke: 'rgb(0, 128, 0)', fillAlpha: 0, strokeAlpha: .7,
    strokeWidth: 2.4, dashed: true, text: 'rgb(255, 0, 0)', textAlpha: .6, explicitMathColor: 'rgb(128, 0, 128)' }
  const actual = { contour: { ...expected, dash: '4px, 2px' }, leaves: [
    { kind: 'path', fill: expected.text, fillAlpha: .6 }, { kind: 'path', fill: expected.explicitMathColor, fillAlpha: .6 },
  ] }
  assert.doesNotThrow(() => assertPointPaint(actual, expected))
  for (const change of [{ fill: expected.stroke }, { fillAlpha: 1 }, { strokeAlpha: .35 }, { dash: 'none' }]) {
    assert.throws(() => assertPointPaint({ ...actual, contour: { ...actual.contour, ...change } }, expected))
  }
  assert.throws(() => assertPointPaint({ ...actual, leaves: actual.leaves.slice(0, 1) }, expected))
})

test('independent raster oracle rejects group-opacity compositing and double dimming', () => {
  const observation = { fill: [0, 0, 255, 51], stroke: [0, 128, 0, 77], overlap: [0, 87, 81, 112] }
  assert.doesNotThrow(() => assertRasterPointOverlap(observation))
  assert.throws(() => assertRasterPointOverlap({ ...observation, overlap: [0, 101, 54, 97] }))
  assert.throws(() => assertRasterPointOverlap({ ...observation, fill: [0, 0, 255, 26] }))
})

test('responsive diagnostics read the foreground leaf font and readiness, separately from the group font', async () => {
  const box = { x: 0, y: 0, width: 26, height: 12 }, ctm = { a: .5, b: 0, c: 0, d: .5, e: 150, f: 110 }
  const node = (attributes = {}) => ({ getAttribute: (name) => attributes[name] ?? null,
    getBBox: () => box, getBoundingClientRect: () => box, getScreenCTM: () => ctm })
  const text = { ...node({ x: '0', y: '0' }), textContent: 'Scale' }
  const contour = { ...node({ r: '41.507105564650516' }), localName: 'circle' }
  const point = { ...node(), children: [contour], querySelector: () => null }
  const title = { textContent: 'Scale' }
  const body = { ...node(), parentElement: point, querySelector: () => title, querySelectorAll: () => [text] }
  title.parentElement = body
  const root = { ...node({ viewBox: '0 0 520 360' }), querySelectorAll: () => [title] }
  const fontChecks = [], fonts = Object.assign(new Set(), { status: 'loaded', check: (font, source) => {
    fontChecks.push({ font, source }); return true
  } })
  const leafCss = { font: '12px "Times New Roman", Times, serif', fontFamily: '"Times New Roman", Times, serif',
    fontSize: '12px', fontWeight: '400', fontStyle: 'normal', getPropertyValue: (key) => ({
      'font-family': '"Times New Roman", Times, serif', 'font-size': '12px', 'font-weight': '400', 'font-style': 'normal',
    })[key] ?? 'normal' }
  const page = { evaluate: async (callback, args) => runInNewContext(`(${callback})(${JSON.stringify(args)})`, {
    document: { documentElement: root, querySelector: () => null, fonts }, window: {},
    getComputedStyle: (element) => element === text ? leafCss : { font: '16px Inter, Arial, sans-serif', strokeWidth: '24', strokeOpacity: '1' },
    innerWidth: 1200, innerHeight: 900, devicePixelRatio: 2, scrollX: 0, scrollY: 0,
    XMLSerializer: class { serializeToString() { return '<svg />' } },
  }) }
  const observed = await measureResponsivePointPaint(page, { standalone: true })
  assert.equal(observed.body.font, leafCss.font)
  assert.equal(observed.body.inheritedGroupFont, '16px Inter, Arial, sans-serif')
  assert.equal(observed.body.texts[0].properties['font-size'], '12px')
  assert.equal(observed.body.texts[0].checked, true)
  assert.equal(observed.body.fontReadiness.status, 'loaded')
  assert.deepEqual(fontChecks, [{ font: 'normal 400 12px "Times New Roman", Times, serif', source: 'Scale' }])
})

// Synthetic observations test the oracle's fault sensitivity; native acceptance
// separately captures the actual browser PNG and its measured display matrix.
// These 40-unit circle and 80-unit equilateral-triangle paths are literal
// geometry, independent of the application's body fitting and layout helpers.
function responsiveObservation(scale, shape = 'circle', variant = 'solid') {
  const circle = shape === 'circle', enabled = variant !== 'disabled'
  const visible = enabled && variant !== 'transparent'
  const radius = circle ? 40 : 80
  const path = circle ? { x: -40, y: -40, width: 80, height: 80 }
    : { x: -40 * Math.sqrt(3), y: -80, width: 80 * Math.sqrt(3), height: 120 }
  const extension = enabled ? 12 : 0
  const bounds = circle ? [-40 - extension, -40 - extension, 40 + extension, 40 + extension]
    : [path.x - Math.sqrt(3) * extension, -80 - 2 * extension, -path.x + Math.sqrt(3) * extension, 40 + extension]
  const center = { x: 260 * scale, y: 180 * scale }
  const matrix = { a: scale, b: 0, c: 0, d: scale, e: 20, f: 20 }
  return {
    root: { ctm: matrix, rect: { x: 20, y: 20, width: 520 * scale, height: 360 * scale },
      viewBox: '0 0 520 360', cssWidth: `${520 * scale}px`, cssHeight: `${360 * scale}px` },
    viewport: { width: 1200, height: 900 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 2,
    body: { bounds: { x: -20, y: -10, width: 40, height: 20 },
      ctm: { ...matrix, e: center.x + 20, f: center.y + 20 }, source: 'Scale', request: 'unchanged-body-request' },
    framingState: { camera: { panX: 0, panY: 0, zoom: 1 } },
    contour: { ctm: { ...matrix, e: center.x + 20, f: center.y + 20 },
      kind: circle ? 'circle' : 'polygon', radius,
      vertices: circle ? [] : [{ x: 0, y: -80 }, { x: -40 * Math.sqrt(3), y: 40 }, { x: 40 * Math.sqrt(3), y: 40 }],
      shapeBounds: path, strokeWidth: 24, stroke: enabled ? 'rgb(204, 0, 0)' : 'none',
      opacity: variant === 'transparent' ? 0 : 1,
      dash: variant === 'dashed' ? '14.4px, 9.6px' : 'none', dashOffset: variant === 'dashed' ? 3.6 : 0 },
    capture: { status: 'saved', bytes: 1000, width: 520 * scale, height: 360 * scale },
    layout: { paintedBounds: bounds, selectionRadius: String(radius + extension * (circle ? 1 : 2) + 6) },
    raster: { width: 520 * scale, height: 360 * scale, center, redPixels: visible ? 500 : 0,
      bounds: visible ? { minX: center.x + bounds[0] * scale, minY: center.y + bounds[1] * scale,
        maxX: center.x + bounds[2] * scale, maxY: center.y + bounds[3] * scale } : null,
      eastRun: { width: 24 * scale },
      phaseSamples: [[3, true], [6, true], [15, false], [17, false], [27, true], [30, true], [39, false], [41, false]]
        .map(([distance, red]) => ({ distance, red })),
    },
  }
}

for (const scale of [.5, 2]) for (const shape of ['circle', 'triangle']) {
  test(`responsive oracle accepts geometric ${shape} paint, local bounds and selection at scale ${scale}`, () => {
    for (const variant of ['solid', 'disabled', 'transparent', ...(shape === 'circle' ? ['dashed'] : [])]) {
      assert.doesNotThrow(() => assertResponsivePointPaint(responsiveObservation(scale, shape, variant),
        { scale, shape, variant, selected: true }))
    }
  })
  test(`responsive oracle rejects actual non-scaling ${shape} paint at scale ${scale} despite nominal width 24`, () => {
    const actual = responsiveObservation(scale, shape)
    // The old vector effect holds half-width at twelve *screen* pixels while
    // the path scales. It reports the same nominal computed stroke width.
    const { x, y, width, height } = actual.contour.shapeBounds
    actual.raster.bounds = { minX: actual.raster.center.x + x * scale - (shape === 'circle' ? 12 : Math.sqrt(3) * 12),
      minY: actual.raster.center.y + y * scale - (shape === 'circle' ? 12 : 24),
      maxX: actual.raster.center.x + (x + width) * scale + (shape === 'circle' ? 12 : Math.sqrt(3) * 12),
      maxY: actual.raster.center.y + (y + height) * scale + 12 }
    actual.raster.eastRun.width = 24
    assert.equal(actual.contour.strokeWidth, 24)
    assert.throws(() => assertResponsivePointPaint(actual, { scale, shape, selected: true }), /Native physical paint extent/)
  })
}

test('responsive oracle rejects stale transforms, local bounds, selection padding, opacity and dash-phase pixels', () => {
  const faults = [
    (actual) => { actual.root.ctm.a = 1 },
    (actual) => { actual.layout.paintedBounds[0] += 12 },
    (actual) => { actual.layout.selectionRadius = '46' },
    (actual) => { actual.raster.eastRun.width /= 2 },
    (actual) => { actual.capture.status = 'pending' },
  ]
  for (const mutate of faults) {
    const actual = responsiveObservation(2)
    mutate(actual)
    assert.throws(() => assertResponsivePointPaint(actual, { scale: 2, selected: true }))
  }
  const invisible = responsiveObservation(.5, 'circle', 'transparent')
  invisible.raster.redPixels = 1
  assert.throws(() => assertResponsivePointPaint(invisible, { scale: .5, variant: 'transparent' }), /no visible red paint/)
  const dash = responsiveObservation(.5, 'circle', 'dashed')
  dash.raster.phaseSamples[2].red = true
  assert.throws(() => assertResponsivePointPaint(dash, { scale: .5, variant: 'dashed' }), /dash\/phase/)
})

function moveResponsivePoint(actual, x, y) {
  const { a, d, e, f } = actual.root.ctm
  actual.contour.ctm.e = x * a + e; actual.contour.ctm.f = y * d + f
  actual.body.ctm.e = actual.contour.ctm.e; actual.body.ctm.f = actual.contour.ctm.f
  const old = actual.raster.center
  const center = { x: x * a, y: y * d }
  if (actual.raster.bounds) {
    for (const key of ['minX', 'maxX']) actual.raster.bounds[key] += center.x - old.x
    for (const key of ['minY', 'maxY']) actual.raster.bounds[key] += center.y - old.y
  }
  actual.raster.center = center
  return actual
}

function historicalCircle(center = { x: 116, y: 324 }) {
  const actual = responsiveObservation(.5), radius = 41.50710678
  actual.contour.radius = radius
  actual.contour.shapeBounds = { x: -radius, y: -radius, width: radius * 2, height: radius * 2 }
  const painted = radius + 12
  actual.layout.paintedBounds = [-painted, -painted, painted, painted]
  actual.layout.selectionRadius = String(painted + 6)
  actual.raster.bounds = { minX: 130 - painted * .5, minY: 90 - painted * .5,
    maxX: 130 + painted * .5, maxY: 90 + painted * .5 }
  return moveResponsivePoint(actual, center.x, center.y)
}

test('historical 260-by-180 capture fails setup before its clipped circle pixels can be judged', () => {
  const actual = historicalCircle()
  assert.deepEqual(actual.root.rect, { x: 20, y: 20, width: 260, height: 180 })
  assert.deepEqual(actual.raster.center, { x: 58, y: 162 })
  assert.equal(actual.contour.ctm.e, 78); assert.equal(actual.contour.ctm.f, 182)
  assert.ok(Math.abs(actual.raster.bounds.maxY - 188.75355339) < 1e-8)
  // Reproduce the measured PNG edge. The preflight must not accept that edge
  // by using the clipped pixels or the application's own painted bounds.
  actual.raster.bounds.maxY = 180
  actual.layout.paintedBounds[3] = 36
  assert.throws(() => responsivePointFraming(actual, { scale: .5 }), (error) => {
    assert.match(error.message, /Responsive framing setup: complete expected envelope/)
    assert.equal(error.framing.status, 'failed')
    assert.ok(Math.abs(162 + error.framing.local.geometric.maxY * .5 - 188.75355339) < 1e-8)
    assert.ok(Math.abs(error.framing.expected.capture.maxY - 194.75355339) < 1e-8,
      'Failure retains the larger control envelope instead of clipping it to 180')
    assert.ok(Math.abs(error.framing.margins.capture.bottom + 14.75355339) < 1e-8)
    return true
  })
  assert.throws(() => assertResponsivePointPaint(actual, { scale: .5 }), /Responsive framing setup:/)
})

test('interior placement preserves the historical radius, declaration, body source and physical paint target', () => {
  const original = historicalCircle(), framed = historicalCircle({ x: 260, y: 180 })
  const unchanged = (actual) => ({ radius: actual.contour.radius, bounds: actual.contour.shapeBounds,
    width: actual.contour.strokeWidth, body: actual.body.bounds, source: actual.body.source,
    request: actual.body.request, painted: actual.layout.paintedBounds, thickness: actual.raster.eastRun.width })
  assert.deepEqual(unchanged(framed), unchanged(original))
  const coverage = responsivePointFraming(framed, { scale: .5 })
  assert.equal(coverage.declaredWidthPt, 20); assert.equal(coverage.halfWidth, 12)
  assert.equal(framed.raster.eastRun.width, 12)
  assert.ok(coverage.expected.capture.maxY < 180 - 2)
  assert.doesNotThrow(() => assertResponsivePointPaint(framed, { scale: .5, selected: true }))
})

for (const scale of [.5, 2]) for (const shape of ['circle', 'triangle']) {
  test(`framing reserves ${shape} paint, selection, native probes and both stroke models at scale ${scale}`, () => {
    for (const variant of ['solid', 'dashed', 'transparent', 'disabled']) {
      const actual = responsiveObservation(scale, shape, variant)
      // A missing selected overlay and an empty pixel mask do not narrow the
      // independently required setup envelope.
      for (const selected of [false, true]) {
        actual.selection = selected ? [{ id: 'app-point' }] : []
        const coverage = responsivePointFraming(actual, { scale, variant })
        assert.equal(coverage.status, 'passed')
        assert.equal(coverage.selectionStrokePx, 3)
        assert.equal(coverage.local.selection.maxX,
          actual.contour.radius + (shape === 'circle' ? 12 : 24) + 6 + 1.5 / scale)
        assert.ok(Object.values(coverage.margins.capture).every((value) => value >= 2))
        assert.deepEqual(coverage.probes, responsivePointProbes(actual, variant))
        for (const probe of Object.values(coverage.probeMargins.capture)) {
          assert.ok(Object.values(probe).every((value) => value >= 2))
        }
        const path = actual.contour.shapeBounds
        assert.equal(coverage.local.nonScaling.minY, path.y - (shape === 'circle' ? 12 : 24) / scale)
        assert.equal(coverage.local.geometric.minY, path.y - (shape === 'circle' ? 12 : 24))
        const injected = structuredClone(actual)
        injected.contour.vectorEffect = 'non-scaling-stroke'
        assert.deepEqual(responsivePointFraming(injected, { scale, variant }), coverage,
          'The injected control must be fully framed independently of its computed vector effect')
      }
      const clipped = moveResponsivePoint(structuredClone(actual), 116, 324)
      assert.throws(() => responsivePointFraming(clipped, { scale, variant }), /Responsive framing setup:/,
        `${variant} coverage must not depend on a visible red-pixel mask`)
    }
  })
}

test('half-scale setup reserves the larger broken non-scaling circle before physical-width rejection', () => {
  const actual = moveResponsivePoint(responsiveObservation(.5), 260, 294)
  const center = actual.contour.ctm.f
  assert.ok(center + (40 + 12) * .5 <= 198, 'Valid geometric border has a positive margin')
  assert.ok(center + (40 + 12 + 6) * .5 + 1.5 <= 198, 'Selection overlay also fits')
  assert.equal(center + (40 + 24) * .5, 199, 'Broken control leaves only one pixel at the bottom')
  assert.throws(() => responsivePointFraming(actual, { scale: .5 }), /complete expected envelope needs 2px margin/)
})

test('a cropped negative control fails coverage before it can count as a physical-width rejection', () => {
  for (const scale of [.5, 2]) for (const shape of ['circle', 'triangle']) {
    const actual = responsiveObservation(scale, shape)
    actual.contour.vectorEffect = 'non-scaling-stroke'
    actual.raster.eastRun.width = 24
    actual.raster.bounds.maxY = actual.raster.height
    assert.doesNotThrow(() => responsivePointFraming(actual, { scale }))
    assert.throws(() => assertResponsivePointPaint(actual, { scale, shape, selected: true }), (error) => {
      assert.match(error.message, /Actual contour is not cropped by the native viewport/)
      assert.doesNotMatch(error.message, /Native physical paint extent|Physical border thickness/)
      return true
    })
  }
})

test('framing rejects nonfinite, stale, unsupported and cropped geometry instead of clamping it', () => {
  const faults = [
    ['nonfinite contour CTM', (actual) => { actual.contour.ctm.e = NaN }],
    ['singular body CTM', (actual) => { actual.body.ctm.a = 0 }],
    ['sheared root CTM', (actual) => { actual.root.ctm.c = .01 }],
    ['wrong contour scale', (actual) => { actual.contour.ctm.a = actual.contour.ctm.d = 1 }],
    ['stale capture origin', (actual) => { actual.root.rect.x += 1 }],
    ['cropped root width', (actual) => { actual.root.rect.width -= 1 }],
    ['fractional crop origin', (actual) => { actual.root.rect.x += .25; actual.root.ctm.e += .25 }],
    ['stale CSS height', (actual) => { actual.root.cssHeight = '179px' }],
    ['invalid viewBox', (actual) => { actual.root.viewBox = '0 0 520 NaN' }],
    ['nonpositive viewBox', (actual) => { actual.root.viewBox = '0 0 520 0' }],
    ['invalid radius', (actual) => { actual.contour.radius = Infinity }],
    ['stale shape bounds', (actual) => { actual.contour.shapeBounds.width -= 1 }],
    ['nonfinite body bounds', (actual) => { actual.body.bounds.width = NaN }],
    ['empty body bounds', (actual) => { actual.body.bounds.height = 0 }],
    ['body outside capture', (actual) => { actual.body.ctm.f += 200 }],
    ['cropped viewport', (actual) => { actual.viewport.height = 199 }],
    ['unbounded viewport', (actual) => { actual.viewport.width = 4097 }],
    ['invalid scroll', (actual) => { actual.scroll.y = Infinity }],
    ['invalid pixel ratio', (actual) => { actual.devicePixelRatio = 0 }],
  ]
  for (const [name, mutate] of faults) {
    const actual = responsiveObservation(.5)
    mutate(actual)
    assert.throws(() => responsivePointFraming(actual, { scale: .5 }), /Responsive framing setup:/, name)
  }
  const triangle = responsiveObservation(.5, 'triangle')
  triangle.contour.vertices[0].x = 1
  assert.throws(() => responsivePointFraming(triangle, { scale: .5 }), /triangle top/)
})

test('capture stability accepts identical geometry but rejects scroll, layout, body and root changes', () => {
  const before = responsiveObservation(.5)
  const png = { width: 260, height: 180 }
  assert.doesNotThrow(() => assertResponsiveCaptureStable(before, structuredClone(before), png))
  const faults = [
    (after) => { after.scroll.y = 1 },
    (after) => { after.root.rect.y += 1 },
    (after) => { after.root.ctm.f += 1 },
    (after) => { after.contour.ctm.e += 1 },
    (after) => { after.contour.ctm.a = NaN },
    (after) => { after.body.ctm.a *= 2 },
    (after) => { after.body.bounds.width += 1 },
    (after) => { after.body.request = 'new-body-request' },
    (after) => { after.layout.selectionRadius = '80' },
    (after) => { after.viewport.height += 1 },
    (after) => { after.devicePixelRatio = 1 },
    (after) => { after.framingState.camera.panX = 1 },
  ]
  for (const mutate of faults) {
    const after = structuredClone(before)
    mutate(after)
    assert.throws(() => assertResponsiveCaptureStable(before, after, png), /Responsive capture coordinate mismatch/)
  }
  for (const crop of [{ width: 259, height: 180 }, { width: 260, height: 179 }, { width: NaN, height: 180 }]) {
    assert.throws(() => assertResponsiveCaptureStable(before, structuredClone(before), crop), /Responsive capture coordinate mismatch: PNG/)
  }
})

// Header bytes test orchestration and crop validation only. They are never
// considered raster acceptance; the fake page returns a separately labelled
// synthetic raster where a real browser would decode the screenshot bytes.
function capturePngHeader(width = 260, height = 180) {
  const bytes = Buffer.alloc(25)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes)
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20)
  return bytes
}

function responsiveCapturePage({ before = responsiveObservation(.5), after = before, png = capturePngHeader(), screenshotError } = {}) {
  const calls = [], checkpoints = [], measurements = [before, after]
  let measureIndex = 0
  const native = (actual) => {
    const copy = structuredClone(actual)
    delete copy.raster; delete copy.capture
    copy.xml = '<svg><!-- original native document --></svg>'
    return copy
  }
  const locator = {
    first() { calls.push('first'); return locator },
    async scrollIntoViewIfNeeded(options) { calls.push('scroll'); assert.deepEqual(options, { timeout: 5000 }) },
    async screenshot(options) {
      calls.push('screenshot')
      assert.deepEqual(options, { path: 'responsive.png', timeout: 5000, scale: 'css', animations: 'disabled' })
      assert.equal(checkpoints.at(-1).framing.status, 'passed', 'Preflight evidence must precede the actual image')
      if (screenshotError) throw screenshotError
      return png
    },
  }
  const page = {
    locator(selector) { calls.push(`locator:${selector}`); return locator },
    async evaluate(_callback, args) {
      if (args === undefined) { calls.push('settle'); return }
      if ('png' in args) {
        calls.push('decode')
        assert.equal(args.png, png.toString('base64'), 'Pixel decoding uses the actual screenshot bytes')
        assert.deepEqual(args.observation.contour, before.contour)
        assert.equal(checkpoints.at(-1).capture.status, 'captured')
        return { ...structuredClone(before.raster), method: 'synthetic raster for capture orchestration test only' }
      }
      calls.push('measure')
      assert.equal(args.source, 'Scale')
      assert.ok(measureIndex < measurements.length, 'No hidden capture retries')
      return native(measurements[measureIndex++])
    },
  }
  const persist = async (observation) => {
    calls.push(`persist:${observation.capture.status}`)
    checkpoints.push(structuredClone(observation))
  }
  return { page, calls, checkpoints, persist, options: { path: 'responsive.png', scale: .5, persist } }
}

test('native capture explicitly scrolls and settles before retained measurements, then validates before decoding', async () => {
  for (const standalone of [false, true]) {
    const fake = responsiveCapturePage()
    const captured = await captureResponsivePointPaint(fake.page, { ...fake.options, standalone })
    assert.deepEqual(fake.calls, [standalone ? 'locator:svg' : 'locator:svg.svg-diagram', ...(standalone ? ['first'] : []),
      'scroll', 'settle', 'measure', 'persist:pending', 'persist:pending', 'screenshot', 'measure',
      'persist:pending', 'persist:captured', 'decode', 'persist:saved'])
    assert.equal(captured.capture.status, 'saved')
    assert.equal(captured.capture.coordinatesStable, true)
    assert.deepEqual(captured.measurements.before, captured.measurements.after)
    assert.equal(captured.capture.width, 260); assert.equal(captured.capture.height, 180)
    assert.equal(captured.body.source, 'Scale')
    assert.equal(fake.checkpoints[0].xml, '<svg><!-- original native document --></svg>')
  }
})

test('historical out-of-frame capture persists the setup failure and never screenshots or decodes', async () => {
  const fake = responsiveCapturePage({ before: historicalCircle() })
  await assert.rejects(captureResponsivePointPaint(fake.page, fake.options), /Responsive framing setup:/)
  assert.equal(fake.calls.includes('screenshot'), false)
  assert.equal(fake.calls.includes('decode'), false)
  assert.deepEqual(fake.calls.slice(0, 4), ['locator:svg.svg-diagram', 'scroll', 'settle', 'measure'])
  assert.equal(fake.checkpoints.at(-1).capture.status, 'failed')
  assert.equal(fake.checkpoints.at(-1).contour.ctm.f, 182)
  assert.match(fake.checkpoints.at(-1).capture.error.message, /complete expected envelope/)
  assert.equal(fake.checkpoints.at(-1).framing.status, 'failed')
  assert.ok(Math.abs(fake.checkpoints.at(-1).framing.expected.capture.maxY - 194.75355339) < 1e-8)
  assert.ok(Math.abs(fake.checkpoints.at(-1).framing.margins.capture.bottom + 14.75355339) < 1e-8)
})

test('capture coordinate drift keeps both snapshots and rejects the image before its pixels are decoded', async () => {
  for (const mutate of [
    (after) => { after.scroll.y = 12 },
    (after) => { after.root.rect.y += 1; after.root.ctm.f += 1 },
    (after) => { after.contour.ctm.e += 1 },
    (after) => { after.body.ctm.f += 1 },
    (after) => { after.body.bounds.width = NaN },
  ]) {
    const before = responsiveObservation(.5), after = structuredClone(before)
    mutate(after)
    const fake = responsiveCapturePage({ before, after })
    await assert.rejects(captureResponsivePointPaint(fake.page, fake.options), /Responsive capture coordinate mismatch/)
    assert.equal(fake.calls.filter((call) => call === 'screenshot').length, 1)
    assert.equal(fake.calls.includes('decode'), false)
    const failed = fake.checkpoints.at(-1)
    assert.equal(failed.capture.status, 'failed')
    assert.equal(failed.capture.coordinatesStable, undefined)
    assert.deepEqual(failed.measurements.before.root, before.root)
    assert.deepEqual(failed.measurements.after.root, after.root)
    assert.deepEqual(failed.measurements.after.body, after.body)
  }
})

test('invalid PNG bytes and cropped screenshots fail before pixel decoding despite stable measurements', async () => {
  for (const png of [Buffer.from('not a PNG'), capturePngHeader(259, 180), capturePngHeader(260, 179)]) {
    const fake = responsiveCapturePage({ png })
    await assert.rejects(captureResponsivePointPaint(fake.page, fake.options), /Native capture is a PNG|Responsive capture coordinate mismatch: PNG/)
    assert.equal(fake.calls.filter((call) => call === 'screenshot').length, 1)
    assert.equal(fake.calls.includes('decode'), false)
    assert.equal(fake.checkpoints.at(-1).capture.status, 'failed')
    assert.deepEqual(fake.checkpoints.at(-1).measurements.before, fake.checkpoints.at(-1).measurements.after)
  }
})

test('failed diagnostic persistence cannot replace the original screenshot error or trigger capture retries', async () => {
  const primary = new Error('primary bounded screenshot error')
  const fake = responsiveCapturePage({ screenshotError: primary })
  await assert.rejects(captureResponsivePointPaint(fake.page, { ...fake.options, persist: async (observation) => {
    await fake.persist(observation)
    if (observation.capture.status === 'failed') throw new Error('secondary diagnostic storage failure')
  } }), (error) => error === primary)
  assert.equal(fake.calls.filter((call) => call === 'screenshot').length, 1)
  assert.equal(fake.calls.includes('decode'), false)
  assert.equal(fake.checkpoints.at(-1).capture.error.message, primary.message)
  assert.equal(fake.checkpoints.at(-1).xml, '<svg><!-- original native document --></svg>')
})

function responsiveStylePage(original) {
  const attributes = new Map(original === null ? [] : [['style', original]])
  const calls = { evaluate: 0, viewports: [], properties: [] }
  const root = {
    viewBox: { baseVal: { x: 0, y: 0, width: 520, height: 360 } },
    getAttribute: (name) => attributes.get(name) ?? null,
    hasAttribute: (name) => attributes.has(name),
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    style: { setProperty(name, value, priority) {
      calls.properties.push({ name, value, priority })
      attributes.set('style', `${attributes.get('style') ?? ''}${name}:${value}!${priority};`)
    } },
  }
  const document = {
    documentElement: root,
    querySelector(selector) {
      if (selector === 'svg.svg-diagram') return root
      assert.equal(selector, '[data-responsive-original-style]')
      return attributes.has('data-responsive-original-style') ? root : null
    },
  }
  const page = {
    async evaluate(callback, args) {
      calls.evaluate++
      return runInNewContext(`(${callback.toString()})(args)`, { document, args })
    },
    async setViewportSize(viewport) { calls.viewports.push(structuredClone(viewport)) },
  }
  return { page, root, attributes, calls }
}

test('display scaling restores absent, empty and existing root styles exactly across repeated CSS scales', async () => {
  for (const original of [null, '', 'opacity: .7; width: 65%; color: red;']) for (const standalone of [false, true]) {
    const fake = responsiveStylePage(original)
    const viewBox = structuredClone(fake.root.viewBox.baseVal)
    for (const scale of [.5, 2]) {
      await setPointDisplayScale(fake.page, scale, standalone)
      assert.equal(fake.attributes.get('data-responsive-original-style'), JSON.stringify(original))
      assert.deepEqual(fake.calls.properties.findLast(({ name }) => name === 'width'),
        { name: 'width', value: `${520 * scale}px`, priority: 'important' })
      assert.deepEqual(fake.calls.properties.findLast(({ name }) => name === 'height'),
        { name: 'height', value: `${360 * scale}px`, priority: 'important' })
      assert.deepEqual(fake.root.viewBox.baseVal, viewBox, 'CSS scaling must preserve model/root coordinates')
    }
    await restorePointDisplayScale(fake.page)
    assert.equal(fake.root.getAttribute('style'), original)
    assert.equal(fake.root.hasAttribute('style'), original !== null)
    assert.equal(fake.root.hasAttribute('data-responsive-original-style'), false)
    await restorePointDisplayScale(fake.page)
    assert.equal(fake.root.getAttribute('style'), original, 'Cleanup is harmless after restoration')
  }
})

test('invalid display scales fail before browser or style mutations and oversized capture is bounded', async () => {
  for (const scale of [NaN, Infinity, -Infinity, 0, -1, '.5', undefined]) {
    const fake = responsiveStylePage('color: red;')
    await assert.rejects(setPointDisplayScale(fake.page, scale), /finite and positive/)
    assert.equal(fake.calls.evaluate, 0)
    assert.deepEqual(fake.calls.viewports, [])
    assert.deepEqual(fake.calls.properties, [])
    assert.equal(fake.root.getAttribute('style'), 'color: red;')
  }
  const fake = responsiveStylePage(null)
  await assert.rejects(setPointDisplayScale(fake.page, 100), /bounded viewport/)
  assert.equal(fake.calls.evaluate, 1, 'Only the existing viewBox was read')
  assert.deepEqual(fake.calls.viewports, [])
  assert.deepEqual(fake.calls.properties, [])
  assert.equal(fake.root.hasAttribute('data-responsive-original-style'), false)
})
