import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPointDiagnostics, cleanupPointCheck, capturePointCheck } from '../../scripts/pointCheckDiagnostics.mjs'
import { runPointThenAppChecks } from '../../scripts/checkPointNodes.mjs'
import { captureNativePointSetup, diagnoseNativePointFailure } from '../../scripts/pointNativeSetupDiagnostics.mjs'

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
