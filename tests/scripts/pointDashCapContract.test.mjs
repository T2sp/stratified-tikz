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
import { decodeConnectedPaintPng, inspectConnectedLivePaintPng } from '../../scripts/connectedLivePaintOracle.mjs'
test('synthetic dash-cap policy contract preserves paint hits, gaps, exterior controls, transformations, live edits and engine audits', () => {
  const evidence = dashCapEvidence()
  assertDashCapEvidence(evidence)
  assert.equal(evidence.cases.length, 22)
  assert.equal(evidence.cases.filter((entry) => entry.observation.engineAudit).length, 14)
  assert.equal(dashCapArtifacts().length, 301)
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
    assert.equal(evidence.result, 'failed'); assert.equal(evidence.cases.length, 22); assert.ok(evidence.cases.every((entry) => entry.result === 'failed'))
    assert.equal(evidence.error.message, original.message); assert.equal(evidence.cases[0].error.stack, original.stack)
    assert.throws(() => assertDashCapEvidence(evidence))
    const mechanism = JSON.parse(await readFile(join(artifactDir, 'point-paint-dash-cap-mechanism.json'), 'utf8'))
    assert.equal(mechanism.result, 'failed'); assert.equal(mechanism.cases.length, dashCapMechanismCases.length)
  } finally { await rm(artifactDir, { recursive: true, force: true }) }
})

test('synthetic endpoint policy retains disproven terminal positives as negatives and adds independently painted App witnesses at both scales', () => {
  const evidence = dashCapEvidence()
  for (const scale of dashCapScales) {
    const terminal = evidence.cases.find((entry) => entry.key === 'square-terminal-zero' && entry.scale === scale)
    assert.deepEqual(terminal.specification.exact, [{ x: 21, y: -21 }, { x: 22, y: -22 }, { x: -22, y: -22 }, { x: 22, y: -18 }])
    for (const index of [0, 1, 3]) {
      const probe = terminal.probes.find((probe) => probe.kind === `exact-${index}`)
      assert.equal(probe.alpha, 0); assert.equal(probe.nativeStrokeContains, false)
      assert.ok(probe.rasterDistance > 6.14 && probe.solidDistance > 6.14)
      assert.ok(probe.actions.every((action) => action.candidates.join() === 'control'))
    }
    const positive = evidence.cases.find((entry) => entry.key === 'square-positive-corner' && entry.scale === scale)
    assert.deepEqual(positive.specification.exterior, { x: -22, y: -30 })
    assert.deepEqual(positive.specification.exact, [{ x: 20, y: 20 }, { x: 16, y: -22 }, { x: 22, y: -22 }])
    for (const entry of [positive]) {
      for (const probe of entry.probes.filter((probe) => probe.kind.startsWith('exact-'))) {
        assert.equal(probe.alpha, 255); assert.ok(probe.solidDistance > 6.14)
        assert.ok(probe.actions.every((action) => action.candidates.includes('p')))
      }
    }
  }
  assertDashCapEvidence(evidence)
})

for (const [name, key, damage] of [
  ['terminal phantom candidate at (21,-21)', 'square-terminal-zero', (entry) => { entry.probes.find((probe) => probe.kind === 'exact-0').actions[0].candidates.push('p') }],
  ['terminal negative inside continuous stroke', 'square-terminal-zero', (entry) => { entry.probes.find((probe) => probe.kind === 'exact-0').solidDistance = 5.9 }],
  ['terminal opaque negative', 'square-terminal-zero', (entry) => { entry.probes.find((probe) => probe.kind === 'exact-1').alpha = 255 }],
  ['removed terminal painted positive', 'square-terminal-zero', (entry) => { entry.probes = entry.probes.filter((probe) => probe.kind !== 'exact-2') }],
  ['terminal first-failure candidate', 'square-terminal-zero', (entry) => { entry.probes.find((probe) => probe.kind === 'exact-3').actions[0].candidates.push('p') }],
  ['positive corner missing ordinary candidate', 'square-positive-corner', (entry) => { entry.probes.find((probe) => probe.kind === 'exact-1').actions[0].candidates = ['control'] }],
  ['positive corner missing cycling candidate', 'square-positive-corner', (entry) => { entry.probes.find((probe) => probe.kind === 'exact-2').actions[1].candidates = ['control'] }],
  ['positive corner distant negative', 'square-positive-corner', (entry) => { entry.observation.engineAudit.samples.find((sample) => sample.local.x === -22 && sample.local.y === -30).paintDistance = 80 }],
  ['zero-off omitted independently contained positive', 'square-zero-off', (entry) => { entry.probes.find((probe) => probe.kind === 'exact-0').actions[0].candidates = ['control'] }],
  ['before-corner phantom candidate at live exterior', 'square-positive-before-corner', (entry) => { entry.probes.find((probe) => probe.kind === 'exact-1').actions[0].candidates = ['control', 'p'] }],
]) test(`synthetic endpoint policy rejects ${name}`, () => {
  const evidence = dashCapEvidence(); damage(evidence.cases.find((entry) => entry.key === key)); assert.throws(() => assertDashCapEvidence(evidence))
})

const liveEntry = (evidence) => evidence.cases.find((entry) => entry.key === 'square-positive-before-corner')
const liveSample = (entry, x = 16, y = -22) => entry.observation.livePaint.captures[1].samples.find((sample) => sample.local.x === x && sample.local.y === y)
test('synthetic oracle policy preserves clone disagreement while live paint independently corrects interaction', () => {
  const evidence = dashCapEvidence(), entry = liveEntry(evidence)
  const sample = entry.observation.engineAudit.samples.find((sample) => sample.local.x === 16 && sample.local.y === -22)
  assert.equal(sample.paintCore, true); assert.equal(sample.paintAlpha, 255); assert.equal(sample.nativeStrokeContains, false)
  assert.deepEqual(liveSample(entry).rgba, [245, 245, 245, 255]); assert.deepEqual(sample.candidates, [])
  assert.equal(entry.probes.find((probe) => probe.kind === 'exact-1').live.expected, 'miss')
  const zero = evidence.cases.find((entry) => entry.key === 'square-zero-off')
  assert.deepEqual(liveSample(zero).rgba, [245, 245, 245, 255]); assert.equal(zero.probes.find((probe) => probe.kind === 'exact-1').live.expected, 'hit')
  assert.ok(entry.observation.livePaint.disagreements.some(({ x, y }) => x === 16 && y === -22))
  assertDashCapEvidence(evidence)
})
for (const [name, damage] of [
  ['missing native App paint', (entry) => { delete entry.observation.livePaint }],
  ['dropped responsive capture', (entry) => { entry.observation.livePaint.captures.shift() }],
  ['unfinished native capture', (entry) => { entry.observation.livePaint.captures[1].status = 'captured' }],
  ['drifting native transform', (entry) => { entry.observation.livePaint.captures[1].afterCtm.e += 1 }],
  ['changed source', (entry) => { entry.observation.livePaint.captures[1].source = '<polygon />' }],
  ['missing live grid cell', (entry) => { entry.observation.livePaint.captures[1].samples.pop() }],
  ['wrong native transform', (entry) => { entry.observation.livePaint.captures[1].ctm.a = 15 }],
  ['misprojected native pixel', (entry) => { liveSample(entry).pixel.x++ }],
  ['forged live paint restores disproven cloned seam', (entry) => { liveSample(entry).rgba = [0, 0, 0, 255] }],
  ['live paint disproves genuine exterior', (entry) => { liveSample(entry, -22, -30).rgba = [0, 0, 0, 255] }],
  ['dropped contradiction', (entry) => { entry.observation.livePaint.disagreements = [] }],
  ['retained selection decoration', (entry) => { entry.observation.livePaint.captures[1].overlays = 1 }],
  ['mutated model', (entry) => { entry.observation.livePaint.modelUnchanged = false }],
  ['unrestored framing', (entry) => { entry.observation.livePaint.restored = false }],
  ['missing screenshot identity', (entry) => { delete entry.observation.livePaint.captures[1].sha256 }],
  ['invalid screenshot byte length', (entry) => { entry.observation.livePaint.captures[1].bytes = 0 }],
  ['inflated interaction tolerance', (entry) => { entry.observation.livePaint.interaction.tolerance = 7 }],
  ['inflated interaction uncertainty', (entry) => { entry.observation.livePaint.interaction.uncertainty = 1 }],
  ['merged selection decoration allowance', (entry) => { entry.observation.livePaint.interaction.selectionDecorationAllowance = 6 }],
  ['dropped raw clone disagreement', (entry) => { entry.observation.engineAudit.mismatches = [] }],
  ['missing source hash', (entry) => { delete entry.observation.livePaint.captures[1].sourceSha256 }],
  ['missing background calibration', (entry) => { delete entry.observation.livePaint.captures[1].calibration.backgroundControl }],
  ['missing pre-action live capture', (entry) => { delete entry.probes[0].liveCapture }],
  ['pre-action source changed', (entry) => { entry.probes[0].liveCapture.source = '<polygon />' }],
  ['pre-action transform changed', (entry) => { entry.probes[0].liveCapture.ctm.e += 1 }],
  ['pre-action point opacity changed', (entry) => { entry.probes[0].liveCapture.stroke.opacity = .5 }],
  ['live grid still has a definite failure', (entry) => { entry.observation.livePaint.interaction.mismatches.push({ local: { x: -22, y: -22 } }) }],
  ['new native exclusion outside retained region', (entry) => {
    const sample = entry.observation.engineAudit.samples.find((sample) => sample.local.x === -22 && sample.local.y === -22)
    sample.nativeStrokeContains = false
    entry.observation.livePaint.disagreements.unshift(sample.local)
  }],
]) test(`synthetic live App oracle rejects ${name}`, () => {
  const evidence = dashCapEvidence(); damage(liveEntry(evidence)); assert.throws(() => assertDashCapEvidence(evidence))
})

test('PNG oracle reads independent known pixels and measures local boundary-center distances without geometry', () => {
  // Literal RGB screenshot: a black 8x8 rectangle at pixels [8,16)^2 on white.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nO3NMREAIAwEsPdvGhR0K8MfiYHkPBaBoDjIQCD4KdgiEAgEgorgAu3YNWaLXhnZAAAAAElFTkSuQmCC', 'base64')
  const decoded = decodeConnectedPaintPng(png)
  assert.equal(decoded.width, 32); assert.equal(decoded.height, 32)
  assert.deepEqual([...decoded.rgba.subarray((8 * 32 + 8) * 4, (8 * 32 + 8) * 4 + 4)], [0, 0, 0, 255])
  assert.deepEqual([...decoded.rgba.subarray((16 * 32 + 16) * 4, (16 * 32 + 16) * 4 + 4)], [255, 255, 255, 255])
  const observed = inspectConnectedLivePaintPng(png, { ctm: { a: 2, b: 0, c: 0, d: 2, e: 16, f: 16 },
    samples: [{ local: { x: -2, y: -2 } }, { local: { x: 2, y: -2 } }], region: { minX: -8, minY: -8, maxX: 8, maxY: 8 } })
  assert.equal(observed.paintedPixelCount, 64); assert.equal(observed.boundaryPixelCount, 28)
  assert.deepEqual(observed.paintBounds, { minX: -4, minY: -4, maxX: 0, maxY: 0 })
  assert.equal(observed.samples[0].paintDistance, 0); assert.equal(observed.samples[0].paintCore, true)
  assert.equal(observed.samples[1].paintDistance, Math.hypot(2.25, .25))
  assert.deepEqual(observed.calibration.backgroundControl.rgba, [255, 255, 255, 255])
  assert.deepEqual(observed.calibration.positiveControl.rgba, [0, 0, 0, 255])
  assert.throws(() => inspectConnectedLivePaintPng(png, { ctm: { a: 2, b: 0, c: 0, d: 2, e: 16, f: 16 }, samples: [{ local: { x: -9, y: 0 } }], region: { minX: -8, minY: -8, maxX: 8, maxY: 8 } }), /inside measured region/u)
  assert.throws(() => decodeConnectedPaintPng(png.subarray(0, 20)))
  const unsupported = Buffer.from(png); unsupported[24] = 16
  assert.throws(() => decodeConnectedPaintPng(unsupported))
})

test('PNG oracle records empty paint explicitly instead of inventing a positive or finite distance', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAJklEQVR4nO3NMQ0AAAwDoPo33arYsQQMkB6LQCAQCAQCgUAg+BIMi1X0pjxKe0gAAAAASUVORK5CYII=', 'base64')
  const observed = inspectConnectedLivePaintPng(png, { ctm: { a: 1, b: 0, c: 0, d: 1, e: 16, f: 16 }, samples: [{ local: { x: 0, y: 0 } }], region: { minX: -16, minY: -16, maxX: 16, maxY: 16 } })
  assert.equal(observed.paintedPixelCount, 0); assert.equal(observed.boundaryPixelCount, 0)
  assert.equal(observed.paintBounds, null); assert.equal(observed.calibration.positiveControl, null)
  assert.equal(observed.samples[0].paintDistance, null); assert.equal(observed.samples[0].paintCore, false)
})


test('synthetic triangle phase edit retains both independent negative controls and native ordinary/Alt actions at both scales', () => {
  const evidence = dashCapEvidence()
  for (const entry of evidence.cases.filter((entry) => entry.key === 'triangle-square-wide')) {
    const edit = entry.edits.find((edit) => edit.field === 'dashPhase')
    assert.deepEqual(edit.negativeProbes.map(({ local }) => local), [{ x: -6, y: -34 }, { x: 0, y: -32 }])
    assert.ok(edit.negativeProbes.every((probe) => probe.rasterDistance > 6.14 && probe.solidDistanceLowerBound > 6.14))
    assert.ok(edit.probe.actions.every((action) => action.candidates.includes('p')), 'Original painted positive remains')
  }
  assertDashCapEvidence(evidence)
})
for (const [name, damage] of [
  ['missing negative', (edit) => { edit.negativeProbes.pop() }],
  ['phantom ordinary candidate', (edit) => { edit.negativeProbes[0].actions[0].candidates.push('p') }],
  ['phantom Alt candidate', (edit) => { edit.negativeProbes[1].actions[1].candidates.push('p') }],
  ['painted negative', (edit) => { edit.negativeProbes[0].alpha = 255 }],
  ['paint within tolerance', (edit) => { edit.negativeProbes[0].rasterDistance = 5.9 }],
  ['native-contained negative', (edit) => { edit.negativeProbes[0].nativeStrokeContains = true }],
  ['invalid continuous-stroke bound', (edit) => { edit.negativeProbes[0].solidDistanceLowerBound = 20 }],
  ['changed support vertices', (edit) => { edit.observation.solidSupport.vertices[0].y = -20 }],
  ['unsupported solid join', (edit) => { edit.observation.solidSupport.join = 'miter' }],
  ['missing clear', (edit) => { edit.negativeProbes[0].selectionCleared = false }],
  ['untrusted pointer', (edit) => { edit.negativeProbes[0].actions[0].trusted = false }],
  ['incorrect transform', (edit) => { edit.negativeProbes[0].transform.ctm.e += 1 }],
]) test(`synthetic triangle phase negative rejects ${name}`, () => {
  const evidence = dashCapEvidence(), edit = evidence.cases[0].edits.find((edit) => edit.field === 'dashPhase')
  damage(edit); assert.throws(() => assertDashCapEvidence(evidence))
})
