import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runPointDashCapChecks } from '../../scripts/checkPointDashCaps.mjs'
import { dashCapCases, dashCapScales } from '../../scripts/pointDashCapContract.mjs'
import { dashCapMechanismCases } from '../../scripts/pointDashCapMechanismContract.mjs'
import { dashCapArtifacts, assertDashCapEvidence } from '../../scripts/pointDashCapContract.mjs'
import { dashCapEvidence } from './dashCapEvidenceFixture.mjs'
test('synthetic dash-cap policy contract preserves paint hits, gaps, exterior controls, transformations, live edits and engine audits', () => {
  const evidence = dashCapEvidence()
  assertDashCapEvidence(evidence)
  assert.equal(evidence.cases.length, 18)
  assert.equal(evidence.cases.filter((entry) => entry.observation.engineAudit).length, 10)
  assert.equal(dashCapArtifacts().length, 223)
})
for (const [name, damage] of [
  ['missing circle', (e) => { e.cases = e.cases.filter((c) => c.key !== 'circle-square-wide') }],
  ['missing exact triangle probe', (e) => { e.cases[0].probes = e.cases[0].probes.filter((p) => p.kind !== 'exact-1') }],
  ['unpainted positive', (e) => { e.cases[0].probes[0].alpha = 0 }],
  ['under-enclosing layout', (e) => { e.cases[0].observation.declaredBounds[1] = -16 }],
  ['under-enclosing selection', (e) => { e.cases[0].observation.selectionRadius = 21 }],
  ['missing candidate masked by control', (e) => { e.cases[0].probes[0].actions[0].candidates = ['control'] }],
  ['ordinary click omission', (e) => { e.cases[0].probes[0].actions[0].selection.id = 'control' }],
  ['unreachable cycling candidate', (e) => { for (const a of e.cases[0].probes[0].actions) a.selection.id = 'p' }],
  ['untrusted pointer', (e) => { e.cases[0].probes[0].actions[0].trusted = false }],
  ['handle intercepted pointer', (e) => { e.cases[0].probes[0].actions[0].overlayExcluded = false }],
  ['missing clear', (e) => { e.cases[0].probes[0].selectionCleared = false }],
  ['incorrect responsive transform', (e) => { e.cases[0].probes[0].transform.ctm.e += 1 }],
  ['painted gap control', (e) => { e.cases[4].probes.find((p) => p.kind === 'gap').alpha = 255 }],
  ['rejected intentional gap', (e) => { e.cases[4].probes.find((p) => p.kind === 'gap').actions[0].candidates = ['control'] }],
  ['inside exterior control', (e) => { e.cases[0].probes.find((p) => p.kind === 'outside').rasterDistance = 5.9 }],
  ['missing edit phase', (e) => { e.cases[0].edits.pop() }],
  ['remounted edit', (e) => { e.cases[0].edits[0].sameNode = false }],
  ['unchanged source model', (e) => { e.cases[0].edits[0].modelChanged = false }],
  ['missing intermediate pointer', (e) => { delete e.cases[0].edits[0].probe }],
  ['intermediate edit candidate omission', (e) => { e.cases[0].edits[1].probe.actions[0].candidates = ['control'] }],
  ['stale cap bounds', (e) => { e.cases[0].edits[1].observation.declaredBounds = e.cases[0].edits[0].observation.declaredBounds }],
  ['stale pattern paint', (e) => { e.cases[0].edits[2].observation.pattern = e.cases[0].edits[1].observation.pattern }],
  ['stale phase paint', (e) => { e.cases[0].edits[3].observation.phase = e.cases[0].edits[2].observation.phase }],
]) test(`dash-cap evidence rejects ${name}`, () => { const evidence = dashCapEvidence(); damage(evidence); assert.throws(() => assertDashCapEvidence(evidence)) })

// The mixed-pattern synthetic region retains explicit gap controls; exact-zero
// has a separate full-square synthetic region matching the corrected witness roles.
const auditEntry = (evidence) => evidence.cases.find((entry) => entry.key === 'square-later-zero-phase-10')
const audit = (evidence) => auditEntry(evidence).observation.engineAudit
const auditProbe = (evidence, kind = 'audit-cap') => auditEntry(evidence).probes.find((probe) => probe.kind === kind)
const auditSample = (evidence, predicate) => {
  const sample = audit(evidence).samples.find(predicate)
  assert.ok(sample, 'The synthetic fixture must retain the intended policy witness')
  return sample
}

test('synthetic engine audit has independent cap, continuous-gap, interior and nearby exterior policy witnesses', () => {
  const evidence = dashCapEvidence()
  const cap = auditSample(evidence, (sample) => sample.paintCore && sample.solidDistance > .3)
  const gap = auditSample(evidence, (sample) => sample.paintDistance > 6.14 && sample.solidDistance === 0 && !sample.insideContour)
  const interior = auditSample(evidence, (sample) => sample.insideContour)
  const exterior = auditProbe(evidence, 'audit-outside')
  assert.equal(cap.insideContour, false)
  assert.equal(gap.paintAlpha, 0)
  assert.equal(interior.expected, 'hit')
  assert.ok(exterior.rasterDistance > 6.14)
  const outsideSample = auditSample(evidence, (sample) => sample.local.x === exterior.local.x && sample.local.y === exterior.local.y)
  assert.ok(Math.min(outsideSample.paintDistance, outsideSample.solidDistance) < 8)
  assert.deepEqual(audit(evidence).mismatches, [])
})

for (const [name, damage] of [
  ['missing native engine audit', (e) => { delete auditEntry(e).observation.engineAudit }],
  ['missing grid cell', (e) => { audit(e).samples.pop() }],
  ['altered grid coordinate', (e) => { audit(e).samples[17].local.x += .25 }],
  ['duplicate grid cell', (e) => { audit(e).samples[17] = structuredClone(audit(e).samples[16]) }],
  ['changed grid resolution', (e) => { audit(e).grid.step = 4 }],
  ['incorrect grid projection', (e) => { audit(e).samples[17].point.x += 1 }],
  ['nonfinite paint distance', (e) => { audit(e).samples[17].paintDistance = Infinity }],
  ['negative solid distance', (e) => { audit(e).samples[17].solidDistance = -1 }],
  ['invalid raster alpha', (e) => { audit(e).samples[17].paintAlpha = 256 }],
  ['painted sample with nonzero distance', (e) => { auditSample(e, (s) => s.paintCore).paintDistance = .1 }],
  ['solid-painted sample with nonzero distance', (e) => { auditSample(e, (s) => s.solidAlpha === 255).solidDistance = .1 }],
  ['missing painted cap candidate', (e) => { auditSample(e, (s) => s.paintCore && s.solidDistance > 6.14).candidates = [] }],
  ['phantom cap candidate at an independently exterior sample', (e) => { auditSample(e, (s) => s.expected === 'miss').candidates = ['p'] }],
  ['retained engine mismatch', (e) => { audit(e).mismatches.push({ local: { x: 30, y: 30 }, expected: 'miss', candidates: ['p'] }) }],
  ['dropped continuous solid neighborhood', (e) => { auditSample(e, (s) => s.paintDistance > 6.14 && s.solidDistance > 0 && s.solidDistance < 5.86).candidates = [] }],
  ['dropped intentional dash-gap candidate', (e) => { auditSample(e, (s) => s.paintDistance > 6.14 && s.solidDistance === 0).candidates = [] }],
  ['paint-only gap expectation', (e) => { auditSample(e, (s) => s.paintDistance > 6.14 && s.solidDistance === 0).expected = 'miss' }],
  ['dropped original contour interior candidate', (e) => { auditSample(e, (s) => s.insideContour).candidates = [] }],
  ['missing original contour predicate', (e) => { delete auditSample(e, (s) => s.insideContour).insideContour }],
  ['omitted solid control', (e) => { delete audit(e).solidControl }],
  ['dashed solid control', (e) => { audit(e).solidControl.pattern = '3.6 3.6' }],
  ['shrunken solid control', (e) => { audit(e).solidControl.strokeWidth = 6 }],
  ['changed solid join', (e) => { audit(e).solidControl.join = 'round' }],
  ['filled solid control', (e) => { audit(e).solidControl.fill = 'black' }],
  ['different solid contour', (e) => { audit(e).solidControl.vertices[0].x += 1 }],
  ['wrong original contour', (e) => { audit(e).originalVertices[0].x = -6; audit(e).solidControl.vertices[0].x = -6 }],
  ['missing cap pointer witness', (e) => { auditEntry(e).probes = auditEntry(e).probes.filter((p) => p.kind !== 'audit-cap') }],
  ['missing exterior pointer witness', (e) => { auditEntry(e).probes = auditEntry(e).probes.filter((p) => p.kind !== 'audit-outside') }],
  ['pointer witness absent from grid', (e) => { auditProbe(e).local = { x: -21, y: -21 } }],
  ['pointer alpha inconsistent with grid', (e) => { auditProbe(e).alpha = 254 }],
  ['pointer distance inconsistent with grid', (e) => { auditProbe(e).rasterDistance = 1 }],
  ['untrusted audit pointer', (e) => { auditProbe(e).actions[0].trusted = false }],
  ['overlay-intercepted audit pointer', (e) => { auditProbe(e).actions[0].overlayExcluded = false }],
  ['uncleared audit selection', (e) => { auditProbe(e).selectionCleared = false }],
  ['missing ordinary audit candidate masked by control', (e) => { auditProbe(e).actions[0].candidates = ['control'] }],
  ['incorrect ordinary audit selection', (e) => { auditProbe(e).actions[0].selection.id = 'control' }],
  ['unreachable audit cycling candidate', (e) => { for (const action of auditProbe(e).actions) action.selection.id = 'p' }],
  ['phantom exterior audit pointer candidate', (e) => { auditProbe(e, 'audit-outside').actions[0].candidates = ['control', 'p'] }],
  ['native stroke containment beyond observed paint', (e) => { auditSample(e, (s) => s.paintDistance > .14).nativeStrokeContains = true }],
  ['paint core without native stroke containment', (e) => { auditSample(e, (s) => s.paintCore).nativeStrokeContains = false }],
  ['incorrect audit counts', (e) => { audit(e).counts.hits-- }],
  ['mutating candidate audit', (e) => { audit(e).modelUnchanged = false }],
]) test(`synthetic dash-cap engine policy rejects ${name}`, () => {
  const evidence = dashCapEvidence()
  damage(evidence)
  assert.throws(() => assertDashCapEvidence(evidence))
})

const zeroEntry = (evidence) => evidence.cases.find((entry) => entry.key === 'square-exact-zero')
test('synthetic policy keeps disproven exterior as painted positive and a nearby independently exterior replacement at both scales', () => {
  const evidence = dashCapEvidence()
  assert.match(evidence.fixture, /synthetic.*not native/u)
  for (const entry of evidence.cases.filter((entry) => entry.key === 'square-exact-zero')) {
    assert.deepEqual(entry.specification.exterior, { x: -22, y: -30 })
    assert.deepEqual(entry.specification.exact, [{ x: -22, y: -22 }, { x: 20, y: 20 }])
    assertDashCapEvidence(evidence)
  }
})
for (const [name, damage] of [
  ['unpassed matrix entry', (entry) => { entry.result = 'observed' }],
  ['erased model zero entry', (entry) => { entry.observation.engineAudit.model.style.paint.stroke.dashPattern.shift() }],
  ['rounded emitted points', (entry) => { entry.observation.engineAudit.rawPoints = '5,-5 -5,-5 -5,5 5,5' }],
  ['unavailable native engine', (entry) => { entry.observation.engineAudit.browser.version = 'unavailable' }],
  ['missing fully painted regression', (entry) => { entry.probes = entry.probes.filter((probe) => probe.kind !== 'exact-1') }],
  ['painted exterior containment', (entry) => { entry.probes.find((probe) => probe.kind === 'outside').nativeStrokeContains = true }],
  ['distant replacement negative', (entry) => { entry.observation.engineAudit.samples.find((sample) => sample.local.x === -22 && sample.local.y === -30).paintDistance = 80 }],
]) test(`synthetic corrected witness rejects ${name}`, () => {
  const evidence = dashCapEvidence(); damage(zeroEntry(evidence)); assert.throws(() => assertDashCapEvidence(evidence))
})

test('failed App dash matrix retains every case and still runs supplemental mechanism without converting failures to successful scenarios', async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-dash-matrix-failure-'))
  const original = new Error('original App matrix failure'), appAttempts = [], mechanismAttempts = [], viewport = { width: 900, height: 700 }, sizes = []
  let saved = 0
  const page = { viewportSize: () => viewport, setViewportSize: async (size) => { sizes.push(size) },
    context: () => ({ browser: () => ({ version: () => 'synthetic-failure-boundary' }) }),
    evaluate: async (_callback, input) => {
      if (!input) return
      if (input.finalPaint) { appAttempts.push([input.spec.key, input.scale]); throw appAttempts.length === 1 ? original : new Error('later App failure') }
      mechanismAttempts.push(input.spec.key); throw new Error('supplemental native observation failure')
    } }
  try {
    await assert.rejects(runPointDashCapChecks({ page, artifactDir, begin() {}, saved: async () => { saved++ }, diagnose: async () => {} }), (error) => error === original)
    assert.deepEqual(appAttempts, dashCapCases.flatMap(({ key }) => dashCapScales.map((scale) => [key, scale])))
    assert.deepEqual(mechanismAttempts, dashCapMechanismCases.map(({ key }) => key))
    assert.equal(saved, 0); assert.deepEqual(sizes.at(-1), viewport)
    const evidence = JSON.parse(await readFile(join(artifactDir, 'point-paint-dash-caps.json'), 'utf8'))
    assert.equal(evidence.result, 'failed'); assert.equal(evidence.cases.length, 18); assert.ok(evidence.cases.every((entry) => entry.result === 'failed'))
    assert.equal(evidence.error.message, original.message); assert.equal(evidence.cases[0].error.stack, original.stack)
    assert.throws(() => assertDashCapEvidence(evidence))
    const mechanism = JSON.parse(await readFile(join(artifactDir, 'point-paint-dash-cap-mechanism.json'), 'utf8'))
    assert.equal(mechanism.result, 'failed'); assert.equal(mechanism.cases.length, 19)
  } finally { await rm(artifactDir, { recursive: true, force: true }) }
})
