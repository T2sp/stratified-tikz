import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDashMechanismGeometry, runPointDashCapMechanismChecks } from '../../scripts/checkPointDashCapMechanism.mjs'
import { assertDashCapMechanismEvidence, dashCapMechanismArtifacts, dashCapMechanismCases } from '../../scripts/pointDashCapMechanismContract.mjs'
import { syntheticMechanismEvidence } from './pointDashCapMechanismFixture.mjs'

test('synthetic mechanism policy keeps literal/raw/near/seam/winding/diagonal and control matrix plus every grid cell', () => {
  const evidence = syntheticMechanismEvidence()
  assertDashCapMechanismEvidence(evidence)
  assert.match(evidence.fixture, /synthetic.*not native/u)
  assert.equal(dashCapMechanismCases.length, 21)
  assert.equal(evidence.cases.reduce((sum, entry) => sum + entry.samples.length, 0), 21 * 1089)
  assert.equal(dashCapMechanismArtifacts().length, 169)
  assert.equal(new Set(dashCapMechanismArtifacts()).size, 169)
  assert.notEqual(evidence.cases[0].source.rawPoints, evidence.cases[1].source.rawPoints)
  assert.deepEqual(evidence.cases[0].probes.map((r) => [r[0], r[1], r[2], r[7]]), [[-22, -22, 255, true], [20, 20, 255, true], [-22, -30, 0, false]])
})

const first = (e) => e.cases[0]
const hit = (e) => first(e).samples.find((r) => r[9] === 'hit')
const miss = (e) => first(e).samples.find((r) => r[9] === 'miss')
for (const [name, damage] of [
  ['missing matrix', (e) => { e.cases = [] }],
  ['missing terminal case', (e) => { e.cases = e.cases.filter((c) => c.key !== 'zero-terminal-seam') }],
  ['duplicate case', (e) => { e.cases[1] = structuredClone(first(e)) }],
  ['unpassed case', (e) => { first(e).result = 'observed' }],
  ['rounded raw source', (e) => { first(e).source.rawPoints = e.cases[1].source.rawPoints }],
  ['erased raw model pattern', (e) => { first(e).source.model.patternPt = [10] }],
  ['missing parsed vertices', (e) => { first(e).native.vertices.pop() }],
  ['different parsed contour', (e) => { first(e).native.vertices[0].x = 100 }],
  ['invalid native path length', (e) => { first(e).native.pathLength = null }],
  ['missing browser', (e) => { delete first(e).native.browser }],
  ['wrong native cap', (e) => { first(e).native.stroke.cap = 'butt' }],
  ['wrong transform', (e) => { first(e).native.ctm.e = 0 }],
  ['relaxed uncertainty', (e) => { first(e).raster.uncertainty = .2 }],
  ['inflated tolerance', (e) => { first(e).grid.tolerance = 7 }],
  ['missing grid cell', (e) => { first(e).samples.pop() }],
  ['duplicate grid cell', (e) => { first(e).samples[1] = [...first(e).samples[0]] }],
  ['missing grid column', (e) => { first(e).samples[0].pop() }],
  ['reclassified painted cell', (e) => { hit(e)[9] = 'uncertain' }],
  ['omitted paint hit', (e) => { hit(e)[12] = false }],
  ['exterior false hit', (e) => { miss(e)[12] = true }],
  ['tangent zero cap distance', (e) => { hit(e)[11] += 1 }],
  ['unpainted claimed core', (e) => { const row = hit(e); row[8] = true; row[2] = 0 }],
  ['native excluded claimed core', (e) => { const row = hit(e); row[8] = true; row[7] = false }],
  ['changed counts', (e) => { first(e).counts.hits-- }],
  ['unreported mismatch', (e) => { first(e).mismatches.push({ local: { x: 0, y: 0 } }) }],
  ['radius deficit', (e) => { first(e).geometry.radius = 26.419689627245816 }],
  ['masked cap radius deficit', (e) => { first(e).geometry.capRadius = 26.419689627245816 }],
  ['removed observed bounds', (e) => { first(e).paint.bounds = null }],
  ['bounds deficit', (e) => { first(e).geometry.bounds.minX = -20 }],
  ['dropped explicit witnesses', (e) => { first(e).probes.pop() }],
  ['painted negative witness', (e) => { first(e).probes[2][7] = true }],
  ['removed live capture', (e) => { first(e).livePaint.captures.pop() }],
  ['missing live grid cell', (e) => { first(e).livePaint.captures[1].samples.pop() }],
  ['changed live source', (e) => { first(e).livePaint.captures[0].sourceUnchanged = false }],
  ['changed live source hash', (e) => { first(e).livePaint.sourceSha256 = 'invalid' }],
  ['changed live PNG hash', (e) => { first(e).livePaint.captures[1].sha256 = 'invalid' }],
  ['uncalibrated live screen', (e) => { first(e).livePaint.captures[1].ctm.a = 15 }],
  ['moved live screen after screenshot', (e) => { first(e).livePaint.captures[1].afterCtm.e++ }],
  ['wrong live pixel resolution', (e) => { first(e).livePaint.captures[1].width = 128 }],
  ['changed live effective pattern', (e) => { first(e).livePaint.captures[1].stroke.pattern = [10, 10] }],
  ['silently changed live containment', (e) => { first(e).livePaint.captures[0].samples[0][7] = true }],
  ['unexplained live containment change', (e) => { const c = first(e).livePaint.captures[1]; c.samples[0][7] = true; c.containmentResolutionChanges.samples = [{ x: -32, y: -32, before: false, after: true }] }],
  ['changed live parse', (e) => { first(e).livePaint.captures[1].vertices[0].x++ }],
  ['unpainted live core', (e) => { const entry = first(e), i = entry.samples.findIndex((r) => r[8]); entry.livePaint.captures[1].samples[i][2] = 255 }],
  ['filled live exterior', (e) => { const entry = first(e), i = entry.samples.findIndex((r) => r[9] === 'miss'); entry.livePaint.captures[1].samples[i][2] = 0 }],
  ['suppressed containment disagreement', (e) => { e.cases.find((c) => c.key === 'zero-off-continuous').livePaint.rasterCoreContainmentDisagreements = [] }],
  ['unconfirmed low resolution contradiction', (e) => { const entry = e.cases.find((c) => c.key === 'positive-before-corner'), i = entry.samples.findIndex((r) => r[8] && !r[7]); entry.livePaint.captures[0].samples[i][2] = 255 }],
  ['unconfirmed high resolution contradiction', (e) => { const entry = e.cases.find((c) => c.key === 'zero-off-continuous'), i = entry.samples.findIndex((r) => r[8] && !r[7]); entry.livePaint.captures[1].samples[i][6] = false }],
  ['repainted terminal negative regression', (e) => { const entry = e.cases.find((c) => c.key === 'zero-terminal-seam'); entry.probes[1][2] = 255 }],
  ['aborted aggregate', (e) => { e.result = 'failed' }],
]) test(`synthetic mechanism policy rejects ${name}`, () => {
  const evidence = syntheticMechanismEvidence()
  damage(evidence)
  assert.throws(() => assertDashCapMechanismEvidence(evidence))
})

test('synthetic mechanism fixtures have independent mutable arrays and do not retain serialized transport strings', () => {
  const a = syntheticMechanismEvidence(), b = syntheticMechanismEvidence()
  a.cases[0].samples[0][0] = 100
  a.cases[0].specification.pattern[0] = 100
  assert.equal(b.cases[0].samples[0][0], -32)
  assert.equal(b.cases[0].specification.pattern[0], 0)
  assert.equal(dashCapMechanismCases[0].pattern[0], 0)
  assert.ok(Object.values(a).every((value) => typeof value !== 'string' || value.length < 200))
})

test('native command loads the actual pure TypeScript geometry without requiring Node type stripping', async () => {
  const { createDashCaps, distanceToDashCaps, createPolygonStrokeRegion, distanceToPolygonStroke } = await loadDashMechanismGeometry()
  const vertices = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
  const solid = createPolygonStrokeRegion(vertices, 2, 'bevel', 10)
  assert.equal(distanceToPolygonStroke({ x: 5, y: -1 }, solid), 0)
  assert.equal(distanceToPolygonStroke({ x: 5, y: -4 }, solid), 3)
  const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices }, 2, [1, 9], 0, 'square')
  assert.ok(caps.families.length > 0)
  assert.ok(Number.isFinite(distanceToDashCaps({ x: 5, y: -4 }, caps)))
})

test('mechanism runner retains the first native failure, executes every bounded case, and never passes an aborted matrix', async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-mechanism-failure-'))
  const original = new Error('original native observation failure'), attempted = []
  const page = { viewportSize: () => ({ width: 1500, height: 1150 }), setViewportSize: async () => {}, context: () => ({ browser: () => ({ version: () => 'synthetic-failure-boundary' }) }),
    evaluate: async (_callback, input) => { if (!input) return; const { spec } = input; attempted.push(spec.key); throw attempted.length === 1 ? original : new Error(`later ${spec.key}`) } }
  try {
    await assert.rejects(runPointDashCapMechanismChecks({ page, artifactDir }), (error) => error === original)
    assert.deepEqual(attempted, dashCapMechanismCases.map(({ key }) => key))
    const aggregate = JSON.parse(await readFile(join(artifactDir, 'point-paint-dash-cap-mechanism.json'), 'utf8'))
    assert.equal(aggregate.result, 'failed'); assert.equal(aggregate.cases.length, 21)
    assert.ok(aggregate.cases.every((entry) => entry.result === 'failed'))
    assert.equal(aggregate.cases[0].error.message, original.message)
    assert.throws(() => assertDashCapMechanismEvidence(aggregate))
    for (const { key } of dashCapMechanismCases) {
      const entry = JSON.parse(await readFile(join(artifactDir, `point-paint-dash-cap-mechanism-${key}.json`), 'utf8'))
      assert.equal(entry.result, 'failed'); assert.ok(entry.error.stack.includes(entry.error.message))
    }
  } finally { await rm(artifactDir, { recursive: true, force: true }) }
})

test('synthetic live corroboration preserves both observed contradictions without weakening independent controls', () => {
  const evidence = syntheticMechanismEvidence()
  for (const [key, count] of [['zero-off-continuous', 24], ['positive-before-corner', 30]]) {
    const entry = evidence.cases.find((c) => c.key === key)
    assert.equal(entry.livePaint.rasterCoreContainmentDisagreements.length, count)
    const row = entry.samples.find((r) => r[0] === 16 && r[1] === -22)
    assert.equal(row[2], 255); assert.equal(row[7], false); assert.equal(row[8], true); assert.equal(row[12], true)
    for (const capture of entry.livePaint.captures) assert.deepEqual(capture.samples.find((r) => r[0] === 16 && r[1] === -22).slice(2), [0, 0, 0, 255, true, false])
  }
  assertDashCapMechanismEvidence(evidence)
  for (const key of ['exact-zero', 'positive-exact-corner', 'solid-bevel-control']) assert.deepEqual(evidence.cases.find((c) => c.key === key).livePaint.rasterCoreContainmentDisagreements, [])
})

test('synthetic live screenshot failure retains every complete native grid and both contradictory observations before continuing the matrix', async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-mechanism-live-failure-'))
  const synthetic = syntheticMechanismEvidence(), attempted = [], screenshots = []
  const original = new Error('first live compositor screenshot failure')
  let current
  const page = {
    viewportSize: () => ({ width: 1500, height: 1150 }), setViewportSize: async () => {},
    context: () => ({ browser: () => ({ version: () => 'synthetic-live-failure-boundary' }) }),
    evaluate: async (_callback, input) => {
      if (!input) return
      if (input.spec) {
        current = synthetic.cases.find((entry) => entry.key === input.spec.key); attempted.push(current.key)
        return { native: structuredClone(current.native), raster: structuredClone(current.raster), paint: structuredClone(current.paint),
          samples: current.samples.map((r) => r.slice(0, 10)), probes: current.probes.map((r) => r.slice(0, 10)),
          polygonMarkup: '<polygon></polygon>', xml: '<svg></svg>', png: 'AA==', solidXml: '<svg></svg>', solidPng: 'AA==' }
      }
      return { scale: input.scale, side: 128 * input.scale, xml: '<svg></svg>' }
    },
    screenshot: async () => { screenshots.push(current.key); throw screenshots.length === 1 ? original : new Error(`later compositor ${current.key}`) },
  }
  try {
    await assert.rejects(runPointDashCapMechanismChecks({ page, artifactDir }), (error) => error === original)
    assert.deepEqual(attempted, dashCapMechanismCases.map(({ key }) => key)); assert.deepEqual(screenshots, attempted)
    const aggregate = JSON.parse(await readFile(join(artifactDir, 'point-paint-dash-cap-mechanism.json'), 'utf8'))
    assert.equal(aggregate.result, 'failed'); assert.equal(aggregate.cases.length, 21)
    for (const entry of aggregate.cases) { assert.equal(entry.result, 'failed'); assert.equal(entry.samples.length, 1089); assert.equal(entry.samples[0].length, 13) }
    for (const [key, count] of [['zero-off-continuous', 24], ['positive-before-corner', 30]]) {
      const entry = aggregate.cases.find((item) => item.key === key)
      assert.equal(entry.samples.filter((r) => r[8] && !r[7]).length, count)
      assert.equal(entry.livePaint.rasterCoreContainmentDisagreements.length, count)
      assert.deepEqual(entry.livePaint.captures, [])
    }
    assert.equal(aggregate.cases[0].error.message, original.message)
    assert.throws(() => assertDashCapMechanismEvidence(aggregate))
  } finally { await rm(artifactDir, { recursive: true, force: true }) }
})
