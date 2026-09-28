import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { runPointDashCapChecks } from '../../scripts/checkPointDashCaps.mjs'
import { dashCapCases, dashCapScales, dashCapProbeIsProximityHit } from '../../scripts/pointDashCapContract.mjs'
import { dashCapMechanismCases } from '../../scripts/pointDashCapMechanismContract.mjs'
import { dashCapArtifacts, assertDashCapEvidence } from '../../scripts/pointDashCapContract.mjs'
import { dashCapEvidence } from './dashCapEvidenceFixture.mjs'
import { connectedPaintCaptureMetadata, decodeConnectedPaintPng, inspectConnectedLivePaintPng, inspectConnectedLivePaintRgba } from '../../scripts/connectedLivePaintOracle.mjs'
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
test('synthetic zero-off proximity witness preserves native target and reachable nearby point at both scales', () => {
  const evidence = dashCapEvidence()
  for (const entry of evidence.cases) {
    for (const probe of entry.probes) {
      assert.equal(dashCapProbeIsProximityHit(entry.specification, probe.kind), entry.key === 'square-zero-off' && probe.kind === 'exact-1')
    }
  }
  for (const scale of dashCapScales) {
    const entry = evidence.cases.find((candidate) => candidate.key === 'square-zero-off' && candidate.scale === scale)
    const probe = entry.probes.find((candidate) => candidate.kind === 'exact-1')
    assert.deepEqual(probe.local, { x: 16, y: -22 })
    assert.equal(probe.nativeStrokeContains, false)
    assert.equal(probe.live.insideContour, false)
    assert.equal(probe.live.expected, 'hit')
    assert.ok(probe.live.paintDistance > .14 && probe.live.paintDistance < 5.86)
    assert.ok(probe.live.rgba.slice(0, 3).every((channel) => channel >= 230))
    assert.equal(probe.actions[0].alt, false)
    assert.equal(probe.actions[0].selection.id, 'control')
    for (const action of probe.actions) assert.deepEqual([...action.candidates].sort(), ['control', 'p'])
    assert.deepEqual([...new Set(probe.actions.filter((action) => action.alt).map((action) => action.selection.id))].sort(), ['control', 'p'])
    assert.equal(entry.probes.find((candidate) => candidate.kind === 'exact-0').actions[0].selection.id, 'p')
    assert.equal(entry.probes.find((candidate) => candidate.kind === 'outside').actions[0].selection.id, 'control')
  }
  assertDashCapEvidence(evidence)
})
for (const scale of dashCapScales) for (const [name, damage] of [
  ['ordinary candidate omission', (probe) => { probe.actions[0].candidates = ['control'] }],
  ['Alt candidate omission', (probe) => { probe.actions[1].candidates = ['control'] }],
  ['unreachable nearby point', (probe) => { for (const action of probe.actions.filter((action) => action.alt)) action.selection.id = 'control' }],
  ['ordinary selection of unpainted nearby point', (probe) => { probe.actions[0].selection.id = 'p' }],
  ['missing ordinary control selection', (probe) => { probe.actions[0].selection = null }],
  ['native-painted witness relabelled as proximity', (probe) => { probe.nativeStrokeContains = true }],
  ['contour interior relabelled as proximity', (probe) => { probe.live.insideContour = true }],
  ['painted witness relabelled as proximity', (probe) => { probe.live.paintDistance = 0 }],
  ['outside-tolerance witness relabelled as proximity', (probe) => { probe.live.paintDistance = 6.2 }],
]) test(`synthetic zero-off proximity policy rejects ${name} at scale ${scale}`, () => {
  const evidence = dashCapEvidence()
  const entry = evidence.cases.find((candidate) => candidate.key === 'square-zero-off' && candidate.scale === scale)
  damage(entry.probes.find((probe) => probe.kind === 'exact-1'))
  assert.throws(() => assertDashCapEvidence(evidence))
})
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
  ['missing responsive isolation', (entry) => { delete entry.observation.livePaint.captures[0].isolation }],
  ['missing magnified post-capture isolation', (entry) => { delete entry.observation.livePaint.captures[1].isolationAfter }],
  ['visible root tooltip despite valid flag', (entry) => { entry.observation.livePaint.captures[0].isolation.rootDecorationVisibility[1].visibility = 'visible' }],
  ['post-capture tooltip leakage', (entry) => { entry.observation.livePaint.captures[1].isolationAfter.feedback[0].visibility = 'visible' }],
  ['nonempty isolation leak report', (entry) => { entry.observation.livePaint.captures[1].isolation.visibilityLeaks.push({ class: 'svg-selection-cycle-feedback', visibility: 'visible' }) }],
  ['missing owned restoration', (entry) => { delete entry.observation.livePaint.captures[1].isolationRestoration }],
  ['unrestored decoration despite restored flag', (entry) => { entry.observation.livePaint.captures[0].isolationRestoration.changedVisibility.push({ class: 'svg-selection-cycle-feedback' }) }],
  ['restoration transforms changed', (entry) => { entry.observation.livePaint.captures[0].isolationRestoration.ctm.e++ }],
  ['dirty preaction isolation', (entry) => { entry.probes[0].liveCapture.isolationAfter.feedback[0].visibility = 'visible' }],
  ['preaction restoration absent', (entry) => { delete entry.probes[0].liveCapture.isolationRestoration }],
  ['preaction source changed during isolation', (entry) => { entry.probes[0].liveCapture.isolation.source = '<polygon />' }],
  ['magnified source changed after capture', (entry) => { entry.observation.livePaint.captures[1].isolationAfter.source = '<polygon />' }],
  ['pointer semantics changed for capture', (entry) => { entry.probes[0].liveCapture.isolation.pointerEventsUnchanged = false }],
  ['support outside measured region despite enclosed flag', (entry) => {
    for (const name of ['isolation', 'isolationAfter']) {
      const support = entry.observation.livePaint.captures[0][name].paintSupport
      support.geometricBounds.maxX = 20; support.bounds.maxX = 20 + support.expansion
    }
  }],
  ['understated square-cap support', (entry) => { entry.observation.livePaint.captures[1].isolation.paintSupport.expansion = 18 }],
  ['missing capture state', (entry) => { delete entry.probes[0].liveCapture.captureState }],
  ['captured preaction image never inspected', (entry) => { entry.probes[0].liveCapture.status = 'captured' }],
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


// Lossless RGBA crops of the complete measured regions in gHadrw's four failed
// responsive captures. Original PNGs remain byte-identical in historical
// 05-check-free-labels/artifacts; these rejected observations are regression
// inputs, never corrected acceptance evidence. The crop origin translates only
// the screenshot coordinate frame; no pixel is erased or reclassified.
const retainedTooltipCrops = [
  { ...{"key":"square-zero-off","scale":0.5,"file":"point-paint-dash-caps-square-zero-off-scale-0.5-live.screen.png","sha256":"9adedbc66d1cfcb2ea9bcb35a5e9ef1ebbce03f8c94ebb4759aa626e52382c04","originalDimensions":{"width":1500,"height":1150},"origin":{"x":208,"y":158},"side":35,"rgbaSha256":"9fef41cbf7c108428af43b1252147329390cce8c1b58a81422d633454ffbd64f"},
    rgba: 'eJz7+vXr/6+jeBQPE7xjx47/1dXVFGOQOZS6BWQOAwMDxRhkzqhbBrdbbG1tB41bYGFDSXqmplsojbdRt5DnFgUFhf96enpk4cmTJ////v07VkyqWxwcnf77+If/t7L3Igu7+YT9D4pIwopJcQsoPEDu4BdVIhvLqRj+1zF2wIpJcQsojEF+w2aHkIQqhpiIlNp/cxs3urlFXEbz/6vXb/4/f/Hy/979h8BiYtIa/wXFVf5b2Hr8f/LkGYoYzC0m1u5g+sChY//9Q+Op4hZdI7v/P37+/D9xyqz/MQmZ/+OTc8BuA+FAoB0gtyCL+QbF/v/48dP/d+8//J8+a+H/379//z96/PT/9Ru3UewWKQWd/8np+f83b935//PnL/9Pnz3//9u3b//fvXv/v6yqEewWZLF5C5f/v3Tl+n8zW8//9q6B/58+ff4/Kj7zPwhQ6hZNfSuwG+7ee/D/6rUb/2MTs8D+B7khIiYVTCOLgfILLFzauyf9P3Hy7P9zFy7/X0eFcAFhUDpQ1jBBSbPoaRkmBksvRpauNMtH9M7Tg6l8GUzlLgzLy8sPivqI3vU0tfoktOqnjOJRPIpxYwDHvglK' },
  { ...{"key":"square-zero-off","scale":1.5,"file":"point-paint-dash-caps-square-zero-off-scale-1.5-live.screen.png","sha256":"e1b5c91b6eb47d2787bc9feb5639b9ac2ca4a5ebd076d5ec028a5be2fb8ead50","originalDimensions":{"width":1500,"height":1150},"origin":{"x":624,"y":474},"side":103,"rgbaSha256":"e21625adc4a80754f45357b0ca51b834713d0591bf98e1267a1e44fe58eb53b3"},
    rgba: 'eJztnYtTVFUYwPkPmmYqy0ALH2EStlAqDDvKSzIlcimcaCTLMTAR07bEgAGjpCjHLMu3oGkiZoIVi0CYUJKZVtP0MPExjRFgBAnLY5fli+/YPdy7sIjtOHvu4Tszv2H33Ht3ued3v/N9e/desFqtYCUIgiAIgiAIgiAIgiAIgiAIgiCkoaysDNLT06UD98vTY+suuB9eXl7Sgfvl6bElN+RGb5AbcSE34kJuxIXciAu5ERdyIy7kRlzIjbiQG3ExGo0eH1tyI2/syOxG735kd6P40eP3CyPBjV5jjdyQGz1BbsSF3IgLuREXciMu5EZcyI24kBtxITfiQm7EZaS48fHxAZPJBGazGbKysnSBxWIBm83mNqK68fb2Zvt5pLwCKiqPwradH8CGd7fogs1bC2Dnrn1uI6Ibg8EAxcUlcPiTUkh8ZincMdYfbrrVVzeMGW8A/6CZbiOaG4wX9IJx4ndfsMfHmdz0g/MYxotevcjqBvM+5hecxzw9vuRGC9ZjmPf1ll9GghuskzHPeHpsyc1A8vLyWA3q6bElNzfWzdgJBrh7YqBbrxERbYJ9RR8zbh8zmdy44eaW0ROhsuoYdHZ1gdK6urvheO031zW2Cq/mruOvM2lKyA1z8+xSMyN89mPSumlobAJXraWlFW4eNV44N4HBUfw99n9UIqUbU/xCvo8YJxPunQrj/B6AUksF7095Pm3AdugrxvQkW/d63Yy+y5+97213+g3pJiw6DpJSXoSg4Fma/oAHw8EYEcvf41BJKUw1zu7rD5PKze49+/k+zoh8RLPs09JyOHrsS42bUd6T4Keff4Xe3l6+3ZUrbZCQmHRNNyEzHoamy39p4vLSpXq+juLmzfXvQ2dnl3a9P+rBGPkoW7638OCgMZ6e/bpUblJXvsz3ra2tHXLz3nY5D2GsnK07r5nv7PYe9tjhcED0nMddusGfSj5Dr81/t3C/ra3/gM+4KcxN5po3NOPd3W3jj5ubW9jYv/PedpYPleZw9LLnqS9ksNiRxQ3m+samywOOQRxHy5HPIWh6BF83PmERX/7Ka2+xPqzpOjo6WF/t1ydduik8cIh7CY+ex/pwTlRaZnYuc9PYdDWuenp6IGpOPHOxo+BDvt4TiclD5pvnlqdJ4wbx9g3om7M/42OsbjabHWZGxbL1dhTs5f1l5VUcpWEcuXKjjrfBtq36ooa5wRjAVvPVCU2OSV72EixJXcXnNVdu8LFMbtRMC50FGzZuZXOO0qpratmy2hPfDnCnbjivuXLT3m4dctsLF3+HwOmR/HnhgeL/Vaed/v5HadysMGfA5m27IC0jR9OPNRSONTbM185xExo2dwDo9Vpxg3XDYNtONoSyuMG5DNvxvvlR7WLh4uWwKHkFq8ec3RQdPCxl3FjKKvk+JqeYef/Ti5fxfqzXnPNN3rqNfN2ivvGoO3eB5afh5JuHYuazPsz/J099B+fOX2Q1CLr5s6HxvxjshZi4RDbe+bsL+evNX5DE62il/XLmLK+fZco3WDer62HML+raCJfNnZfA67Qzv9XxZThPqc8lbNqSP2Sdps5nmJuUuMQWG7eAuTGvXgPqZrfb+WOsv9WxpHhUfs+Vq7KlqtMQPI5xrnFuOPZYSznPdadO/8Br56vHuAO25+/h6+Ss7XfjF9D/XR/OefX1DZpjAcdCiVfl801O7npoc8pPmI9CwmI0btCj1drve3XmWqk+36jxvSeIzWXIcM53Yp5Q19jDBc/f4WchPAeh7nc+L4AuEp5awuavoeoCXH7/tEjpztmIhIznofFaAXJDbsgNuZHFDV0vIK4bus5GXDd0fZq4bpScQ9d1iumGrocW1w1C9xGI60aJH7r/Rkw36vpAb/etVVdXS33fmp4ZKfd76hFyIy7kRlzIjbiQG3ERxY2s/wvPHUT5O7cEQRAEQRAEQRAEQRAEQRAEQRAEMVL4F35iyOU=' },
  { ...{"key":"square-positive-before-corner","scale":0.5,"file":"point-paint-dash-caps-square-positive-before-corner-scale-0.5-live.screen.png","sha256":"6371775d1d4817acf87480f1d3dce46233de81a02e77ed28588b2f0950cd2281","originalDimensions":{"width":1500,"height":1150},"origin":{"x":208,"y":158},"side":35,"rgbaSha256":"ea1c9c7fbdaa4b708d29af37dea9ef416b0d31173ed7635e78b104e9ec934afa"},
    rgba: 'eJz7+vXr/6+jeBQPE7xjx47/1dXVZGFquwVkJgMDA1mY2u6hxC3Udg+lbqGme6jhFmq5h1pugbkHGYPyxUC5BR2PuoU+blFQUPivp6dHFj569Oj/79+/Y8WkusXB0em/j3/4fyt7L7Kwm0/Y/6CIJKyYFLeAwgPkDn5RJbKxnIrhfx1jB6yYFLeAwhjkN2x2CEmoYoiJSKn9N7dxo5tbxGU0/796/eb/8xcv/+/dfwgsJiat8V9QXOW/ha3H/ydPnqGIwdxiYu0Opg8cOvbfPzSeKm7RNbL7/+Pnz/8Tp8z6H5OQ+T8+OQfsNhAOBNoBcguymG9Q7P+PHz/9f/f+w//psxb+//379/+jx0//X79xG8VukVLQ+Z+cnv9/89ad/z9//vL/9Nnz/799+/b/3bv3/8uqGsFuQRabt3D5/0tXrv83s/X8b+8a+P/p0+f/o+Iz/4MApW7R1LcCu+HuvQf/r1678T82MQvsf5AbImJSwTSyGCi/wMKlvXvS/xMnz/4/d+Hy/3VUCBcQBqUDZQ0TlDSLnpZhYrD0YmTpSlTaxdauI5SPaJWncYUVNcoXVR1Lit0Ccw+l5a5PUAxJ5S4h98jLy9OtPqJlPU5qPU2sewZDn2UUj+JRjIoBE1qCbw==' },
  { ...{"key":"square-positive-before-corner","scale":1.5,"file":"point-paint-dash-caps-square-positive-before-corner-scale-1.5-live.screen.png","sha256":"1b77da37960d9b50f0bbac3f62c449696887024de30ff3aa38aaf814f7fa135d","originalDimensions":{"width":1500,"height":1150},"origin":{"x":624,"y":474},"side":103,"rgbaSha256":"14450c88b9eedeaed9e689075a60e0a018b833ce1f698c90309f6862d901a703"},
    rgba: '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' },
]
for (const fixture of retainedTooltipCrops) test(`retained gHadrw ${fixture.key} scale ${fixture.scale} rejects root tooltip paint with located diagnostics`, () => {
  const rgba = inflateSync(Buffer.from(fixture.rgba, 'base64'))
  assert.equal(createHash('sha256').update(rgba).digest('hex'), fixture.rgbaSha256)
  const scale = fixture.scale, originalCtm = { a: scale, b: 0, c: 0, d: scale, e: 450 * scale, f: 350 * scale }
  const ctm = { ...originalCtm, e: originalCtm.e - fixture.origin.x, f: originalCtm.f - fixture.origin.y }
  const region = { minX: -34, minY: -34, maxX: 34, maxY: 34 }
  const captureState = { screenshot: fixture.file, zoom: false, originalSha256: fixture.sha256, originalDimensions: fixture.originalDimensions, originalCtm, cropOrigin: fixture.origin }
  assert.throws(() => inspectConnectedLivePaintRgba({ width: fixture.side, height: fixture.side, rgba, ctm, region, captureState, samples: [] }), (error) => {
    assert.match(error.message, /Live paint mask has an exterior margin/u)
    const diagnostic = error.captureDiagnostic
    assert.deepEqual(diagnostic.boundary, ['right'])
    assert.deepEqual(diagnostic.captureState, captureState); assert.deepEqual(diagnostic.ctm, ctm); assert.deepEqual(diagnostic.region, region)
    assert.deepEqual(diagnostic.dimensions, { width: fixture.side, height: fixture.side })
    assert.deepEqual({ x: diagnostic.pixel.x + fixture.origin.x, y: diagnostic.pixel.y + fixture.origin.y }, scale === .5 ? { x: 242, y: 173 } : { x: 726, y: 520 })
    assert.deepEqual(diagnostic.rgba, scale === .5 ? [82, 88, 98, 255] : [44, 51, 64, 255])
    assert.ok(error.message.includes(fixture.file)); assert.ok(error.message.includes('"zoom":false'))
    return true
  })
  if (scale === .5) {
    const index = ((174 - fixture.origin.y) * fixture.side + 242 - fixture.origin.x) * 4
    assert.deepEqual([...rgba.subarray(index, index + 4)], [44, 51, 64, 255], 'Retained reported tooltip pixel')
  }
})

test('capture identity and framing are available before mask inspection rejects paint', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nO3NMREAIAwEsPdvGhR0K8MfiYHkPBaBoDjIQCD4KdgiEAgEgorgAu3YNWaLXhnZAAAAAElFTkSuQmCC', 'base64')
  const options = { source: '<polygon points="0,0 1,0 1,1"/>', ctm: { a: 2, b: 0, c: 0, d: 2, e: 16, f: 16 },
    region: { minX: -4, minY: -4, maxX: 8, maxY: 8 }, captureState: { zoom: true, stage: 'before pixel inspection' } }
  const metadata = connectedPaintCaptureMetadata(png, options)
  assert.equal(metadata.bytes, png.length); assert.equal(metadata.width, 32); assert.equal(metadata.height, 32)
  assert.equal(metadata.sha256, createHash('sha256').update(png).digest('hex'))
  assert.equal(metadata.sourceSha256, createHash('sha256').update(options.source).digest('hex'))
  assert.deepEqual(metadata.ctm, options.ctm); assert.deepEqual(metadata.region, options.region); assert.deepEqual(metadata.captureState, options.captureState)
  assert.deepEqual(metadata.screenRegion, { minX: 8, minY: 8, maxX: 32, maxY: 32 })
  assert.throws(() => inspectConnectedLivePaintPng(png, { ...options, samples: [] }), (error) => {
    assert.deepEqual(error.captureDiagnostic.pixel, { x: 8, y: 8 })
    assert.deepEqual(error.captureDiagnostic.rgba, [0, 0, 0, 255])
    assert.deepEqual(error.captureDiagnostic.boundary, ['left', 'top'])
    assert.deepEqual(error.captureDiagnostic.captureState, options.captureState)
    return true
  })
  options.ctm.e = 20; options.region.minX = -8; options.captureState.zoom = false
  assert.equal(metadata.ctm.e, 16); assert.equal(metadata.region.minX, -4); assert.equal(metadata.captureState.zoom, true)
})

test('PNG capture rejects genuinely clipped regions while complete framing keeps both calibrations', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nO3NMREAIAwEsPdvGhR0K8MfiYHkPBaBoDjIQCD4KdgiEAgEgorgAu3YNWaLXhnZAAAAAElFTkSuQmCC', 'base64')
  const ctm = { a: 2, b: 0, c: 0, d: 2, e: 16, f: 16 }, region = { minX: -8, minY: -8, maxX: 8, maxY: 8 }
  const clean = inspectConnectedLivePaintPng(png, { ctm, region, samples: [] })
  assert.deepEqual(clean.calibration.positiveControl.rgba, [0, 0, 0, 255])
  assert.deepEqual(clean.calibration.backgroundControl.rgba, [255, 255, 255, 255])
  for (const [key, value] of [['minX', -8.25], ['minY', -8.25], ['maxX', 8.25], ['maxY', 8.25]]) {
    assert.throws(() => inspectConnectedLivePaintPng(png, { ctm, region: { ...region, [key]: value }, samples: [], captureState: { zoom: true } }), (error) => {
      assert.match(error.message, /Requested live paint region is not clipped/u)
      assert.equal(error.captureDiagnostic.region[key], value); assert.equal(error.captureDiagnostic.captureState.zoom, true)
      return true
    })
  }
  const decoded = decodeConnectedPaintPng(png)
  const noOpaqueCore = Buffer.from(decoded.rgba)
  for (let index = 0; index < noOpaqueCore.length; index += 4) if (noOpaqueCore[index] === 0) noOpaqueCore.fill(44, index, index + 3)
  assert.throws(() => inspectConnectedLivePaintRgba({ ...decoded, rgba: noOpaqueCore, ctm, region, samples: [] }), /Independent opaque positive calibration/u)
  const badBackground = Buffer.from(decoded.rgba); badBackground.fill(200, 0, 3)
  assert.throws(() => inspectConnectedLivePaintRgba({ ...decoded, rgba: badBackground, ctm, region, samples: [] }), (error) => {
    assert.match(error.message, /Independent background calibration/u); assert.deepEqual(error.captureDiagnostic.pixel, { x: 0, y: 0 })
    assert.deepEqual(error.captureDiagnostic.rgba, [200, 200, 200, 255])
    return true
  })
})
