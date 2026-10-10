import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPointDiagnostics, cleanupPointCheck, capturePointCheck, captureObservedPointCheck } from '../../scripts/pointCheckDiagnostics.mjs'
import { runPointThenAppChecks } from '../../scripts/checkPointNodes.mjs'
import { runPointNodeGeometricShapeChecks } from '../../scripts/checkPointNodeGeometricShapes.mjs'
import { assertGeometricShapeEvidence } from '../../scripts/pointGeometricShapesContract.mjs'
import { syntheticGeometricVisibilityEvidence, mutateSyntheticVisibilityStageModels } from './pointGeometricVisibilityFixture.mjs'
import { captureNativePointSetup, diagnoseNativePointFailure } from '../../scripts/pointNativeSetupDiagnostics.mjs'
import { observePointLiteral, assertOracleCanvasDocument, diagnoseStandalonePointFailure } from '../../scripts/pointLiteralOracle.mjs'

test('point matrix saves the failing current case before assertions, without passing or starting the App group', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-point-diagnostics-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const groups = [], diagnostics = [], passes = [], stages = []
  const context = { artifactDir, observe: async (name, details) => diagnostics.push({ name, ...details }),
    record: async (name) => passes.push(name), startGroup: async (group) => groups.push(group),
    completeGroup: async () => assert.fail('Cannot complete a failing matrix'), setStage: (stage) => stages.push(stage),
    page: { waitForFunction: async () => {}, evaluate: async (fn) => {
      const code = fn.toString()
      if (code.includes('getScreenCTM')) return null // Native point unexpectedly missing.
      return {}
    } } }
  await assert.rejects(runPointThenAppChecks(context, async () => assert.fail('Later App checks must remain unexecuted')), /assert|falsy/i)
  assert.deepEqual(groups, ['point-node-body-layout-lifecycle'])
  assert.deepEqual(stages, ['point-node-checks', ...groups]); assert.deepEqual(passes, [])
  const saved = JSON.parse(await readFile(join(artifactDir, diagnostics[0].artifact), 'utf8'))
  assert.deepEqual(saved, { group: groups[0], scenario: 'point-language-shapes-2d-3d', result: 'observed', ambientDimension: 2, shape: 'circle', source: '', point: null })
})

test('diagnostic callback failure still retains observation bytes and creates no passed record', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-point-observation-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const diagnose = createPointDiagnostics({ artifactDir, observe: async () => { throw new Error('diagnostic callback') } })
  await assert.rejects(diagnose('point-node-settled-export', 'case', { point: { source: '\t\r\n' } }), /diagnostic callback/)
  const data = JSON.parse(await readFile(join(artifactDir, 'point-observation-0001.json'), 'utf8'))
  assert.equal(data.result, 'observed'); assert.equal(data.point.source, '\t\r\n')
})

test('visibility stages survive later document loads and a rejecting candidate validator as observations', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-visibility-observation-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const order = [], records = [], passes = []
  const diagnose = createPointDiagnostics({ artifactDir, artifactPrefix: 'point-geometric-visibility-control',
    observe: async (name, details) => { order.push(`persist ${records.length + 1}`); records.push({ name, ...details }) } })
  const candidate = syntheticGeometricVisibilityEvidence()
  candidate.result = 'observed'
  mutateSyntheticVisibilityStageModels(candidate, 'locked', (model) => { model.layers[0].visible = false })
  const { locked, hidden } = candidate.visibility
  const stage = (phase, captured) => captureObservedPointCheck({ capture: async () => captured,
    diagnose: (details) => diagnose('point-node-geometric-shapes', candidate.scenario, details),
    details: { phase }, secondaryErrors: [], name: phase })
  await stage('visibility-locked-before', { state: locked.before, rendered: locked.rendered })
  await stage('visibility-locked-after', locked)
  order.push('native hidden load')
  await stage('visibility-hidden', hidden)
  order.push('native dim load')
  await stage('visibility-candidate', { candidate })
  let primary
  await assert.rejects((async () => {
    try {
      order.push('validate')
      const terminal = { ...candidate, result: 'passed' }
      assertGeometricShapeEvidence(terminal, candidate.scenario)
      await writeFile(join(artifactDir, `${candidate.scenario}.json`), JSON.stringify(terminal))
      passes.push(candidate.scenario)
    } catch (error) { primary = error; throw error }
    finally { await cleanupPointCheck(primary, async () => { throw new Error('secondary listener cleanup') }) }
  })(), (error) => error === primary && /Locked point layer.*visible/.test(error.message))
  assert.deepEqual(order, ['persist 1', 'persist 2', 'native hidden load', 'persist 3', 'native dim load', 'persist 4', 'validate'])
  assert.deepEqual(passes, [])
  const observations = await Promise.all(records.map(async ({ artifact }) => JSON.parse(await readFile(join(artifactDir, artifact), 'utf8'))))
  assert.ok(observations.every(({ result }) => result === 'observed'))
  assert.deepEqual(observations[1].stateAfter, locked.stateAfter)
  assert.deepEqual(observations[1].renderedAfter, locked.renderedAfter)
  assert.deepEqual(observations[2].state, hidden.state); assert.equal(observations[2].rendered, null)
  assert.deepEqual(observations[3].candidate, candidate)
  await assert.rejects(readFile(join(artifactDir, `${candidate.scenario}.json`)), { code: 'ENOENT' })
})

test('visibility action failure owns partial capture, callback failure and rejecting cleanup', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-visibility-secondary-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const primary = new Error('native locked click'), secondaryErrors = []
  const diagnose = createPointDiagnostics({ artifactDir, observe: async () => { throw new Error('observer callback failed') } })
  await assert.rejects(captureObservedPointCheck({ primary, name: 'locked-after', secondaryErrors,
    details: { phase: 'visibility-locked-after', before: { json: 'raw before' } },
    capture: async (observation) => { observation.stateAfter = { json: 'raw after' }; throw new Error('native render capture failed') },
    diagnose: (details) => diagnose('point-node-geometric-shapes', 'point-geometric-visibility', details) }), (error) => error === primary)
  await cleanupPointCheck(primary, async () => { throw new Error('observer cleanup failed') })
  const observed = JSON.parse(await readFile(join(artifactDir, 'point-observation-0001.json'), 'utf8'))
  assert.equal(observed.result, 'observed'); assert.equal(observed.actionError.message, primary.message)
  assert.equal(observed.captureError.message, 'native render capture failed')
  assert.deepEqual(observed.stateAfter, { json: 'raw after' })
  assert.deepEqual(secondaryErrors, ['locked-after capture after primary failure: native render capture failed',
    'locked-after evidence after primary failure: observer callback failed'])
})

test('visibility observation deadlines own late rejections and block validation on evidence failure', async () => {
  const primary = new Error('native policy action'), secondaryErrors = [], observations = []
  let rejectCapture, rejectEvidence, validated = false
  await assert.rejects(captureObservedPointCheck({ primary, name: 'visibility-stage', timeoutMs: 15, secondaryErrors,
    capture: () => new Promise((_resolve, reject) => { rejectCapture = reject }),
    diagnose: async (observation) => { observations.push(observation); throw new Error('secondary evidence') } }), (error) => error === primary)
  assert.match(observations[0].captureError.message, /Timed out after 15ms during visibility-stage capture/)
  rejectCapture(new Error('late closed page'))
  await assert.rejects((async () => {
    await captureObservedPointCheck({ name: 'visibility-candidate', timeoutMs: 15, secondaryErrors,
      capture: async () => ({ candidate: { result: 'observed' } }),
      diagnose: () => new Promise((_resolve, reject) => { rejectEvidence = reject }) })
    validated = true
  })(), /Timed out after 15ms during visibility-candidate evidence/)
  assert.equal(validated, false)
  rejectEvidence(new Error('late evidence write'))
  await new Promise((resolve) => setImmediate(resolve))
})

test('geometric rejection retains its first error when failure artifacts and owned context cleanup fail', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-geometric-failure-owner-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  t.mock.method(console, 'error', () => {})
  const primary = new Error('actual geometric native failure'), order = []
  const page = new EventEmitter()
  page.url = () => 'about:blank'; page.addInitScript = async () => {}
  page.goto = async () => { await rm(artifactDir, { recursive: true }); order.push('action failure'); throw primary }
  page.evaluate = async () => { throw new Error('secondary native capture') }
  page.isClosed = () => false
  page.screenshot = async () => { throw new Error('secondary screenshot') }
  const context = new EventEmitter()
  context.newPage = async () => page
  context.close = async () => { order.push('context cleanup'); throw new Error('secondary context cleanup') }
  await assert.rejects(runPointNodeGeometricShapeChecks({ browser: { newContext: async () => context }, origin: 'http://localhost',
    artifactDir, observe: async () => {}, startGroup: async () => {},
    record: async () => assert.fail('Failure cannot publish success'),
    completeGroup: async () => assert.fail('Failure cannot complete group') }), (error) => error === primary)
  assert.deepEqual(order, ['action failure', 'context cleanup'])
})

test('point cleanup preserves the primary assertion and rejects otherwise unowned cleanup failure', async () => {
  const failure = new Error('cleanup'), cleanup = async () => { throw failure }
  await cleanupPointCheck(new Error('primary assertion'), cleanup)
  await assert.rejects(cleanupPointCheck(undefined, cleanup), (error) => error === failure)
})


test('metric collection failure is saved before rethrow and diagnostic failure cannot replace it', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-point-metric-failure-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const primary = new Error('Canvas configuration unavailable')
  const diagnose = createPointDiagnostics({ artifactDir, observe: async () => { throw new Error('secondary write') } })
  await assert.rejects(capturePointCheck(async () => { throw primary },
    (details) => diagnose('point-node-body-layout-lifecycle', 'native-metrics', details)), (e) => e === primary)
  const data = JSON.parse(await readFile(join(artifactDir, 'point-observation-0001.json'), 'utf8'))
  assert.equal(data.captureError.message, primary.message)
  assert.equal(data.result, 'observed')
})

// Scheduling/failure tests only: actual HTMLCanvasElement/XML creation is
// asserted by the same wrapper in native App and saved file:// export checks.
const svgDocumentContext = {
  url: 'file:///tmp/point.svg', contentType: 'image/svg+xml', body: null, bodyFound: true,
  root: { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg' },
  canvas: { namespaceURI: 'http://www.w3.org/1999/xhtml', localName: 'canvas', htmlCanvasElement: true,
    ownerDocumentMatches: true, isConnected: false, parentNodePresent: false,
    getContext: 'function', context2dAvailable: true, measureText: 'function' },
}

test('literal collection saves document/Canvas context before metrics and reports cleaned-up document', async () => {
  const order = [], observations = []
  const page = { evaluate: async (_fn, { mode }) => {
    order.push(mode)
    return mode === 'context' ? svgDocumentContext : { point: { source: '  $bad\t\n tail  ' }, documentUnchanged: true }
  } }
  const result = await observePointLiteral(page, { source: '  $bad\t\n tail  ', standalone: true,
    diagnose: async (details) => { order.push('persist'); observations.push(details) } })
  assert.deepEqual(order, ['context', 'persist', 'metrics'])
  assert.equal(observations[0].boundary, 'before-literal-metrics')
  assert.equal(result.documentContext, svgDocumentContext)
  assert.equal(result.documentUnchanged, true)
})

test('literal metric failure preserves its native error and context despite evidence failure', async () => {
  const observations = []
  const page = { evaluate: async (_fn, { mode }) => mode === 'context' ? svgDocumentContext : {
    collectionError: { message: 'Oracle Canvas 2D context unavailable', name: 'Error', stack: 'native metric stack' }, documentUnchanged: true,
  } }
  await assert.rejects(observePointLiteral(page, { source: '$bad', standalone: true, diagnose: async (details) => {
    observations.push(details)
    if (details.captureError) throw new Error('secondary evidence write')
  } }), (error) => error.message === 'Oracle Canvas 2D context unavailable' && error.stack === 'native metric stack')
  assert.equal(observations[1].boundary, 'literal-collection-failure')
  assert.equal(observations[1].documentContext, svgDocumentContext)
  assert.equal(observations[1].documentUnchanged, true)
})

test('literal collection rejects document mutation and unusable or wrong-document Canvas evidence', async () => {
  const page = { evaluate: async (_fn, { mode }) => mode === 'context' ? svgDocumentContext : { point: {}, documentUnchanged: false } }
  await assert.rejects(observePointLiteral(page, { standalone: true }), /leaves the document unchanged/)
  for (const [property, value] of Object.entries({ namespaceURI: 'http://www.w3.org/2000/svg', htmlCanvasElement: false,
    ownerDocumentMatches: false, isConnected: true, parentNodePresent: true, getContext: 'undefined', context2dAvailable: false, measureText: 'undefined' })) {
    assert.throws(() => assertOracleCanvasDocument({ ...svgDocumentContext, canvas: { ...svgDocumentContext.canvas, [property]: value } }, true))
  }
  assert.throws(() => assertOracleCanvasDocument({ ...svgDocumentContext, url: 'http://localhost/inline-svg' }, true), /saved file directly/)
  assert.throws(() => assertOracleCanvasDocument({ ...svgDocumentContext, contentType: 'text/html' }, true))
})

test('standalone failure records the saved path and actual file-page context before closing', async () => {
  const order = [], primary = new Error('geometry or PNG failure'), observations = []
  const page = { evaluate: async () => { order.push('context'); return svgDocumentContext },
    close: async () => { order.push('close') } }
  await diagnoseStandalonePointFailure({ page, source: '$bad', svgPath: '/tmp/point.svg', primary,
    diagnose: async (details) => { order.push('persist'); observations.push(details) } })
  await page.close()
  assert.deepEqual(order, ['context', 'persist', 'close'])
  assert.equal(observations[0].svgPath, '/tmp/point.svg')
  assert.equal(observations[0].error.message, primary.message)
  assert.equal(observations[0].documentContext, svgDocumentContext)
})

test('standalone failure owns bounded capture/write failures and late rejection without replacing primary', async () => {
  const primary = new Error('original metric failure'), observations = []
  let rejectCapture
  const page = { evaluate: () => new Promise((_resolve, reject) => { rejectCapture = reject }) }
  await diagnoseStandalonePointFailure({ page, source: '$bad', svgPath: '/tmp/point.svg', primary, timeoutMs: 15,
    diagnose: async (details) => { observations.push(details); throw new Error('secondary write') } })
  assert.match(observations[0].contextError.message, /Timed out after 15ms/)
  assert.equal(observations[0].error.message, primary.message)
  assert.equal(observations[0].svgPath, '/tmp/point.svg')
  rejectCapture(new Error('late page close'))
  await new Promise((resolve) => setTimeout(resolve, 0))
})

// These cases exercise capture/write failure ownership only. Their stub pages
// do not locate production elements or stand in for native acceptance evidence.
test('native failure saves current-page setup as an observation before page cleanup', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-point-native-failure-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const order = [], records = [], primary = new Error('selectOption original call log')
  const setup = { document: { ambientDimension: 3, labelDocumentRevision: 4 },
    formCount: 1, coordinateMode: { scopedCount: 1, globalCount: 1, controls: [] } }
  const page = { evaluate: async (_capture, selector) => {
    assert.equal(selector, '#direct-input-drawer .direct-input-drawer-form')
    order.push('capture actual failing page'); return setup
  }, close: async () => { order.push('close') } }
  const diagnose = createPointDiagnostics({ artifactDir, observe: async (name) => {
    records.push(name); order.push('saved observation')
  } })
  try {
    await assert.rejects(diagnoseNativePointFailure({ page, primary,
      diagnose: (details) => diagnose('point-node-body-layout-lifecycle', 'native', details),
      details: { ambientDimension: 3 } }), (error) => error === primary)
  } finally { await page.close() }
  const observation = JSON.parse(await readFile(join(artifactDir, 'point-observation-0001.json'), 'utf8'))
  assert.deepEqual(order, ['capture actual failing page', 'saved observation', 'close'])
  assert.deepEqual(records, ['native-observed'])
  assert.equal(observation.result, 'observed')
  assert.equal(observation.boundary, 'native-failure')
  assert.equal(observation.error.message, primary.message)
  assert.deepEqual(observation.nativeSetup, setup)
})

test('native setup capture failure is recorded without replacing the selection error', async () => {
  const primary = new Error('selectOption original'), captureError = new Error('page closed during capture')
  const page = { evaluate: async () => { throw captureError } }
  await assert.rejects(captureNativePointSetup(page), (error) => error === captureError)
  let observation
  await assert.rejects(diagnoseNativePointFailure({ page, primary,
    diagnose: async (details) => { observation = details } }), (error) => error === primary)
  assert.equal(observation.captureError.message, captureError.message)
  assert.equal(observation.nativeSetup, undefined)
  assert.equal(observation.error.message, primary.message)
})

test('native capture timeout still saves its cause and owns a late page rejection', async () => {
  let rejectCapture
  const primary = new Error('native coordinate selection failed'), observations = []
  const page = { evaluate: () => new Promise((_resolve, reject) => { rejectCapture = reject }) }
  await assert.rejects(diagnoseNativePointFailure({ page, primary, timeoutMs: 15,
    diagnose: async (details) => { observations.push(details) } }), (error) => error === primary)
  assert.equal(observations.length, 1)
  assert.match(observations[0].captureError.message, /Timed out after 15ms during native point setup capture/)
  rejectCapture(new Error('evaluate finally rejected after page close'))
  await new Promise((resolve) => setImmediate(resolve))
})

test('native evidence failure or timeout preserves primary and owns late diagnostic rejection', async (t) => {
  const primary = new Error('original native failure'), diagnostics = []
  t.mock.method(console, 'error', (...args) => { diagnostics.push(args) })
  const page = { evaluate: async () => ({ document: { ambientDimension: 3 } }) }
  await assert.rejects(diagnoseNativePointFailure({ page, primary,
    diagnose: async () => { throw new Error('evidence write failed') } }), (error) => error === primary)
  let rejectDiagnostic
  await assert.rejects(diagnoseNativePointFailure({ page, primary, timeoutMs: 15,
    diagnose: () => new Promise((_resolve, reject) => { rejectDiagnostic = reject }) }), (error) => error === primary)
  assert.equal(diagnostics.length, 2)
  assert.equal(diagnostics[0][1].message, 'evidence write failed')
  assert.match(diagnostics[1][1].message, /Timed out after 15ms during native point failure observation/)
  rejectDiagnostic(new Error('late evidence rejection'))
  await new Promise((resolve) => setImmediate(resolve))
})

test('native capture clears its owned deadline when evaluation finishes', async (t) => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout, timers = new Set()
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    const timer = originalSet(callback, delay); timers.add(timer); return timer
  })
  t.mock.method(globalThis, 'clearTimeout', (timer) => { timers.delete(timer); originalClear(timer) })
  const setup = { formCount: 0 }
  assert.equal(await captureNativePointSetup({ evaluate: async () => setup }), setup)
  assert.equal(timers.size, 0)
})
