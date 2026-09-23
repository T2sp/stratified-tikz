import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPointPaint, assertRasterPointOverlap } from '../../scripts/pointPaintOracle.mjs'

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
