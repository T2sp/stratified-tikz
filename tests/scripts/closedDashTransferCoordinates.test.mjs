import assert from 'node:assert/strict'
import test from 'node:test'
import { assertClosedDashTransferCoordinates } from '../../scripts/closedDashTransferCoordinates.mjs'

const baseline = { expectedScale: 1, source: '<polygon stroke-dasharray="100.00000000000001 100.00000000000001"/>', json: 'raw model', history: 'unchanged history' }
function observation() {
  return { source: baseline.source, json: baseline.json, history: baseline.history, ctm: { a: 1, b: 0, c: 0, d: 1, e: 450, f: 350 },
    root: { bounds: { x: 0, y: 0, width: 900, height: 700 }, viewBox: { x: 0, y: 0, width: 900, height: 700 } }, viewport: { width: 1600, height: 1600 },
    samples: [{ local: { x: 2, y: -24 }, viewBoxPoint: { x: 452, y: 326 }, screenFromRoot: { x: 452, y: 326 }, screenFromContour: { x: 452, y: 326 } }] }
}
test('native action framing independently agrees for the retained disputed witness and exact emitted dash spelling', () => {
  assert.doesNotThrow(() => assertClosedDashTransferCoordinates(observation(), baseline))
})
for (const [name, mutate, reason] of [
  ['stale magnified CTM', (x) => { x.ctm.a = x.ctm.d = 16 }, /Actual transfer/],
  ['root mapping disagreement', (x) => { x.samples[0].screenFromContour.x += 1 }, /conversions agree/],
  ['identically displaced coordinate conversions', (x) => { x.samples[0].screenFromRoot.x += 1; x.samples[0].screenFromContour.x += 1 }, /uses measured framing/],
  ['wrong intended local point', (x) => { x.samples[0].viewBoxPoint.x += 1 }, /intended local sample/],
  ['wrong root scale', (x) => { x.root.bounds.width = 901 }, /Independent root scale/],
  ['offscreen witness', (x) => { x.viewport.width = 450 }, /inside action root/],
  ['nonfinite sample', (x) => { x.samples[0].local.x = NaN }, /Finite independently/],
  ['rounded dash input', (x) => { x.source = '<polygon stroke-dasharray="100 100"/>' }, /Same literal/],
  ['mutated model', (x) => { x.json += 'changed' }, /retain model/],
  ['mutated history', (x) => { x.history += 'changed' }, /retain history/],
]) test(`transfer coordinate evidence rejects ${name}`, () => {
  const x = observation(); mutate(x)
  assert.throws(() => assertClosedDashTransferCoordinates(x, baseline), reason)
})
