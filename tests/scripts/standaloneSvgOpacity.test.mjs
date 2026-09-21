import assert from 'node:assert/strict'
import test from 'node:test'
import { assertStandaloneSvgOpacity, standaloneSvgOpacityTolerance } from '../../scripts/standaloneSvgOpacity.mjs'

const dimmed = 0.7 * 0.35

test('standalone opacity accepts the reported attribute/CSSOM pair and exact values including endpoints', () => {
  assert.equal(dimmed, 0.24499999999999997)
  assert.equal(Math.abs(0.245 - dimmed), 2.7755575615628914e-17)
  assert.doesNotThrow(() => assertStandaloneSvgOpacity(0.245, dimmed))
  for (const value of [0, 1, 0.7, dimmed]) {
    assert.doesNotThrow(() => assertStandaloneSvgOpacity(value, value))
  }
})

test('standalone opacity rejects invalid observations or expectations before applying tolerance', () => {
  for (const value of [undefined, null, '', '0', '0.245', 'invalid', false, true, [], {},
    NaN, Infinity, -Infinity, -Number.EPSILON, 1 + Number.EPSILON]) {
    assert.throws(() => assertStandaloneSvgOpacity(value, 0), /computed opacity must be a finite number in \[0, 1\]/)
    assert.throws(() => assertStandaloneSvgOpacity(0, value), /captured opacity must be a finite number in \[0, 1\]/)
    assert.throws(() => assertStandaloneSvgOpacity(value, value), /opacity must be a finite number in \[0, 1\]/)
  }
  assert.throws(() => assertStandaloneSvgOpacity(), /computed opacity must be a finite number/)
})

test('standalone opacity rejects missing and doubled dimming independently of geometry', () => {
  for (const computed of [0.7, 1, 0.08575, dimmed * 0.35]) {
    assert.throws(() => assertStandaloneSvgOpacity(computed, dimmed), /absolute error .* exceeds tolerance/)
  }
})

test('standalone opacity rejects nonzero output for zero and small meaningful drift in either direction', () => {
  assert.equal(standaloneSvgOpacityTolerance, 1e-12)
  for (const [computed, captured] of [[0.001, 0], [0, 0.001],
    [dimmed + 1e-10, dimmed], [dimmed - 1e-10, dimmed],
    [dimmed + 2e-12, dimmed], [dimmed - 2e-12, dimmed]]) {
    assert.throws(() => assertStandaloneSvgOpacity(computed, captured), /absolute error .* exceeds tolerance 1e-12/)
  }
})
