import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPointPaint, assertRasterPointOverlap, assertResponsivePointPaint } from '../../scripts/pointPaintOracle.mjs'

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
    root: { ctm: matrix, rect: { x: 20, y: 20, width: 520 * scale, height: 360 * scale } },
    contour: { ctm: { ...matrix, e: center.x + 20, f: center.y + 20 },
      kind: circle ? 'circle' : 'polygon', radius,
      vertices: circle ? [] : [{ x: 0, y: -80 }, { x: -40 * Math.sqrt(3), y: 40 }, { x: 40 * Math.sqrt(3), y: 40 }],
      shapeBounds: path, strokeWidth: 24, stroke: enabled ? 'rgb(204, 0, 0)' : 'none',
      opacity: variant === 'transparent' ? 0 : 1,
      dash: variant === 'dashed' ? '14.4px, 9.6px' : 'none', dashOffset: variant === 'dashed' ? 3.6 : 0 },
    capture: { status: 'saved', bytes: 1000 },
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
