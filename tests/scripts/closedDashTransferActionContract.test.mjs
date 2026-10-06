import assert from 'node:assert/strict'
import test from 'node:test'
import { assertClosedDashTransferAction, observeClosedDashTriangleEndpointCaps } from '../../scripts/closedDashTransferActionContract.mjs'
import { inspectConnectedLivePaintRgba } from '../../scripts/connectedLivePaintOracle.mjs'
import { calibrateConnectedPaintSampling, classifyConnectedPaintSampling } from '../../scripts/connectedPaintSampling.mjs'

function observation({ expected = 'hit', rawCellExpected = expected, alt = false, pointId = null,
  role = 'retained-witness', candidates = expected === 'miss' ? [] : ['p'] } = {}) {
  const local = { x: -2, y: -24 }
  const strictSample = { local, expected }
  const selected = alt ? candidates.includes('p') : pointId === 'p'
  const action = { shape: 'square', local, role, candidateExpected: expected, rawCellExpected, alt, candidates,
    ordinaryTarget: { pointId, insideRoot: true, tagName: pointId === null ? 'svg' : 'polygon' },
    trusted: true, overlayExcluded: true, beforeSelection: null,
    selection: selected ? { kind: 'stratum', id: 'p' } : null }
  return { action, strictSample }
}

const literalTriangle = '<polygon fill="none" fill-opacity="1" stroke="#000000" stroke-opacity="1" stroke-width="12" stroke-dasharray="100.00000000000001 100.00000000000001" stroke-dashoffset="1" stroke-linecap="square" stroke-linejoin="bevel" stroke-miterlimit="10" data-point-contour="true" points="6.123233995736766e-16,-10 -8.660254037844389,4.999999999999997 8.660254037844384,5.000000000000004"></polygon>'
const literalCaps = (local, changes = {}) => observeClosedDashTriangleEndpointCaps({ source: literalTriangle,
  local, insideContour: false, nativeStrokeContains: false, background: 'rgb(255, 255, 255)', ...changes })

test('independent literal rectangles require genuine triangle proximity without promoting strict uncertainty', () => {
  for (const local of [{ x: -2, y: -24 }, { x: 2, y: -24 }, { x: 14, y: -12 }]) {
    const independent = literalCaps(local)
    assert.ok(Math.abs(independent.distance - 5.807161309399608) < 1e-12)
    assert.equal(independent.rectangles.length, 2)
    assert.equal(independent.definiteHit, true)
    assert.equal(independent.threshold, 5.86)
    for (const alt of [false, true]) {
      const { action, strictSample } = observation({ expected: 'uncertain', rawCellExpected: 'miss', alt })
      action.shape = 'triangle'; action.local = local; strictSample.local = local
      action.independentEndpointCaps = { ...independent, sourceAuthenticated: true }
      assertClosedDashTransferAction(action, strictSample)
      assert.equal(action.candidateExpected, 'uncertain')
      assert.equal(action.rawCellExpected, 'miss')
      action.candidates = []; action.selection = null
      assert.throws(() => assertClosedDashTransferAction(action, strictSample), /Independent literal endpoint-cap proximity requirement/)
    }
  }
})

test('literal proximity observation authenticates the finite source and cannot infer an exterior miss from a paint subset', () => {
  assert.throws(() => literalCaps({ x: -2, y: -24 }, { source: literalTriangle.replace('stroke-width="12"', 'stroke-width="10"') }))
  assert.throws(() => literalCaps({ x: -2, y: -24 }, { source: literalTriangle.replace('stroke-dashoffset="1"', 'stroke-dashoffset="99"') }))
  assert.throws(() => literalCaps({ x: -2, y: -24 }, { background: 'rgb(0, 0, 0)' }))
  assert.equal(literalCaps({ x: -40, y: -40 }).definiteHit, false)
  assert.equal(literalCaps({ x: -2, y: -24 }, { nativeStrokeContains: true }).definiteHit, false)
  const { action, strictSample } = observation({ expected: 'uncertain', alt: true })
  action.shape = 'triangle'
  assert.throws(() => assertClosedDashTransferAction(action, strictSample), /retains its independent/)
  action.independentEndpointCaps = { ...literalCaps(action.local), sourceAuthenticated: false }
  assert.throws(() => assertClosedDashTransferAction(action, strictSample), /retain authenticated source/)
})

test('ordinary background and Alt geometry preserve the proximity candidate role', () => {
  for (const alt of [false, true]) {
    const { action, strictSample } = observation({ alt })
    assertClosedDashTransferAction(action, strictSample)
    assert.deepEqual(action.selection, alt ? { kind: 'stratum', id: 'p' } : null)
    action.selection = alt ? null : { kind: 'stratum', id: 'p' }
    assert.throws(() => assertClosedDashTransferAction(action, strictSample), /Alt action|Ordinary action/)
  }
})

test('quantization-only miss does not override an uncertain authenticated magnified sample', () => {
  for (const alt of [false, true]) {
    const { action, strictSample } = observation({ expected: 'uncertain', rawCellExpected: 'miss', alt })
    assertClosedDashTransferAction(action, strictSample)
    assert.equal(action.rawCellExpected, 'miss')
    assert.equal(action.candidateExpected, 'uncertain')
  }
})

test('a visible cutoff-128 pixel is excluded by the unchanged 127 mask without proving a vector miss', () => {
  const width = 20, height = 20, rgba = Buffer.alloc(width * height * 4, 255)
  const paint = (x, y, gray) => {
    for (let channel = 0; channel < 3; channel++) rgba[(y * width + x) * 4 + channel] = gray
  }
  for (let y = 11; y <= 13; y++) for (let x = 11; x <= 13; x++) paint(x, y, 0)
  paint(12, 5, 128)
  const local = { x: 12.5, y: 1.5 }, ctm = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  const captured = inspectConnectedLivePaintRgba({ width, height, rgba, ctm,
    samples: [{ local }], region: { minX: 0, minY: 0, maxX: 20, maxY: 20 } })
  assert.equal(captured.calibration.threshold, 127)
  assert.equal(captured.samples[0].paintDistance, 10)
  assert.equal(Math.hypot(local.x - 12.5, local.y - 5.5), 4, 'The excluded visible pixel is within six units')
  const diagnostic = classifyConnectedPaintSampling({ paintDistance: captured.samples[0].paintDistance,
    solidDistance: 20, insideContour: false, hit: true,
    calibration: calibrateConnectedPaintSampling({ width, height, ctm }) })
  assert.equal(diagnostic.expected, 'miss')
  assert.equal(diagnostic.definiteDiscrepancy, true)
  const { action, strictSample } = observation({ expected: 'uncertain', rawCellExpected: diagnostic.expected, alt: true })
  action.local = local; strictSample.local = local
  assertClosedDashTransferAction(action, strictSample)
  assert.equal(diagnostic.expected, 'miss', 'The original raw mask diagnosis remains recorded')
  assert.equal(diagnostic.definiteDiscrepancy, true)
})

for (const expected of ['hit', 'miss']) test(`strict ${expected} candidate assertions remain mandatory across raw classifications`, () => {
  for (const rawCellExpected of ['hit', 'miss', 'uncertain']) {
    const { action, strictSample } = observation({ expected, rawCellExpected })
    assertClosedDashTransferAction(action, strictSample)
    action.candidates = expected === 'hit' ? [] : ['p']
    assert.throws(() => assertClosedDashTransferAction(action, strictSample), /Strict native candidate requirement/)
  }
})

test('native expectation cannot substitute a different classification for the strict sample', () => {
  const { action, strictSample } = observation()
  action.candidateExpected = 'uncertain'
  assert.throws(() => assertClosedDashTransferAction(action, strictSample), /retains the strict scale-16 oracle/)
})

for (const role of ['painted-positive', 'exterior']) test(`${role} retains independent native ordinary and Alt controls`, () => {
  const expected = role === 'painted-positive' ? 'hit' : 'miss'
  const pointId = role === 'painted-positive' ? 'p' : null
  for (const alt of [false, true]) {
    const { action, strictSample } = observation({ expected, pointId, alt, role })
    assertClosedDashTransferAction(action, strictSample)
    action.ordinaryTarget.pointId = role === 'painted-positive' ? null : 'p'
    assert.throws(() => assertClosedDashTransferAction(action, strictSample), /Opaque positive|Genuine exterior/)
    action.ordinaryTarget.pointId = pointId
    action.rawCellExpected = 'uncertain'
    assert.throws(() => assertClosedDashTransferAction(action, strictSample))
  }
})

test('untrusted, overlay or wrong-point actions remain rejected even for uncertain samples', () => {
  for (const changes of [{ trusted: false }, { overlayExcluded: false }, { candidates: ['other'] },
    { ordinaryTarget: { pointId: 'other', insideRoot: true } }]) {
    const { action, strictSample } = observation({ expected: 'uncertain' })
    Object.assign(action, changes)
    assert.throws(() => assertClosedDashTransferAction(action, strictSample))
  }
})
