import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { captureOwnedMetricPoint, observeOwnedMetricPoint } from '../../scripts/pointMetricComparison.mjs'

const input = { id: 'metric-reference', source: '  $\\missingNativePoint$\t\n tail  ', ambientDimension: 3 }

function fixture(apiName = 'stzLabels') {
  const url = 'http://127.0.0.1:12345/stratified-tikz/scripts/fixtures/freeLabels.html'
  const identity = { key: 'owned', expected: { url, generation: 'original' }, apiName }
  const model = { ambientDimension: 3, strata: [{ id: input.id, geometricKind: 'point', text: input.source }] }
  const runtime = { identity: 'point-metric-fixture', documentRevision: 17, fontGeneration: 3 }
  const ownerId = JSON.stringify(['point-node', runtime.documentRevision, input.id])
  const request = JSON.stringify([input.source, 'Times New Roman, Times, serif', 12, '400', 'normal', runtime.fontGeneration, 4, .2, ownerId])
  const bodyAttributes = { 'data-label-source': input.source, 'data-label-state': 'fallback', 'data-label-request': request }
  const pointAttributes = { 'data-point-node': ownerId, 'data-point-request': request }
  const body = { getAttribute: (key) => bodyAttributes[key] ?? null }
  const point = { getAttribute: (key) => pointAttributes[key] ?? null, querySelector: () => body }
  const outer = { querySelector: () => point }
  let present = true, stateCalls = 0
  const api = { state() { stateCalls++; return { json: JSON.stringify({ diagram: model }) } }, pointRuntime: () => runtime }
  const context = { window: { [apiName]: api, owned: { api, generation: 'original' } }, location: { href: url }, CSS: { escape: (s) => s },
    document: { querySelector: () => present ? outer : null } }
  const observe = (args) => runInNewContext(`(${observeOwnedMetricPoint.toString()})(args)`, { ...context, args })
  const inspected = { ambientDimension: 3, source: input.source, modelSource: input.source, owner: ownerId,
    request, pointRequest: request, status: 'fallback', runtime: { ...runtime },
    literalObservation: { request, pointRequest: request, status: 'fallback' } }
  const setRequest = (next) => { bodyAttributes['data-label-request'] = next; pointAttributes['data-point-request'] = next }
  return { identity, model, bodyAttributes, pointAttributes, context, observe, inspected, runtime, setRequest,
    remove: () => { present = false }, stateCalls: () => stateCalls }
}

test('both renderer and App observations require their exact retained API and expected metric point', () => {
  for (const apiName of ['stzLabels', 'stzAppLabels']) {
    const f = fixture(apiName)
    f.context.window[apiName === 'stzLabels' ? 'stzAppLabels' : 'stzLabels'] = { state() { throw new Error('Other fixture must not supply this point') } }
    const observation = f.observe({ identity: f.identity, input })
    assert.equal(observation.id, input.id); assert.equal(observation.source, input.source)
    assert.equal(observation.apiName, apiName); assert.equal(observation.generation, 'original')
    assert.equal(f.observe({ identity: f.identity, input, settlement: true }), true)
  }
})

test('empty reset model or missing DOM cannot pass settlement just because no pending label exists', () => {
  for (const fault of ['model-reset', 'dom-removed']) {
    const f = fixture()
    if (fault === 'model-reset') f.model.strata = []
    else f.remove()
    assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), fault === 'model-reset'
      ? /expected model point missing/ : /expected point DOM body missing/)
  }
})

test('same-URL replacement and changed API fail before reading the replacement fixture state', () => {
  for (const fault of ['document', 'api']) {
    const f = fixture()
    if (fault === 'document') f.context.window.owned.generation = 'replacement'
    else f.context.window.stzLabels = { state() { throw new Error('Replacement state must never run') } }
    assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), /document\/API continuity lost/)
    assert.equal(f.stateCalls(), 0)
  }
})

test('wrong dimension, model source, DOM source, revision or body request blocks metric use', () => {
  for (const [mutate, pattern] of [
    [(f) => { f.model.ambientDimension = 2 }, /ambient dimension/],
    [(f) => { f.model.strata[0].text = 'reset source' }, /model source changed/],
    [(f) => { f.bodyAttributes['data-label-source'] = 'obsolete body' }, /DOM source changed/],
    [(f) => { f.pointAttributes['data-point-node'] = '["point-node",3,"metric-reference"]' }, /document revision/],
    [(f) => { f.pointAttributes['data-point-request'] = 'old request' }, /requests differ/],
  ]) {
    const f = fixture(); mutate(f)
    assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), pattern)
  }
})

test('matching point and body requests still require current source, owner and font generation', () => {
  for (const [slot, value, pattern] of [
    [0, 'old source', /expected request source changed/],
    [5, 2, /request font generation/],
    [8, '["point-node",16,"metric-reference"]', /request owner/],
  ]) {
    const f = fixture(), request = JSON.parse(f.bodyAttributes['data-label-request'])
    request[slot] = value; f.setRequest(JSON.stringify(request))
    assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), pattern)
  }
})

test('metric requests reject missing or malformed JSON and nonproduction tuple shapes', () => {
  for (const [request, pattern] of [
    [null, /body request missing/],
    ['', /malformed body request JSON/],
    ['{unfinished', /malformed body request JSON/],
    ['null', /invalid nine-field/],
    ['{}', /invalid nine-field/],
    [JSON.stringify([input.source, 'font', 12, '400', 'normal', 3, 4]), /invalid nine-field/],
    [JSON.stringify([input.source, 'font', 12, '400', 'normal', 3, 4, .2, 'owner', 'extra']), /invalid nine-field/],
  ]) {
    const f = fixture(); f.setRequest(request)
    assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), pattern)
  }
})

test('nine-field request metadata must use valid production font and layout value types', () => {
  for (const [slot, value] of [
    [0, null], [1, ' '], [1, null], [2, '12'], [2, 0], [2, Infinity],
    [3, null], [3, 'invalid-weight'], [4, 'invalid-style'],
    [5, null], [5, '3'], [5, -1], [5, .5], [5, Number.MAX_SAFE_INTEGER + 1],
    [6, null], [6, '4'], [6, 0], [6, 1.5], [7, null], [7, '.2'], [7, -1], [8, null],
  ]) {
    const f = fixture(), request = JSON.parse(f.bodyAttributes['data-label-request'])
    request[slot] = value; f.setRequest(JSON.stringify(request))
    assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), /invalid nine-field/)
  }
})

test('metric runtime rejects missing or invalid generations and revision identities', () => {
  for (const [field, value] of [
    ['fontGeneration', undefined], ['fontGeneration', null], ['fontGeneration', '3'],
    ['fontGeneration', -1], ['fontGeneration', .5], ['fontGeneration', Infinity],
    ['fontGeneration', Number.MAX_SAFE_INTEGER + 1],
    ['documentRevision', null], ['documentRevision', {}], ['documentRevision', Infinity], ['documentRevision', ' '],
    ['identity', null], ['identity', ' '],
  ]) {
    const f = fixture(); f.runtime[field] = value
    assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), /invalid current point runtime/)
  }
  const f = fixture(); f.context.window.stzLabels.pointRuntime = () => null
  assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), /invalid current point runtime/)
})

test('string document revisions bind the owner without treating tab size or line gap as revisions', () => {
  const f = fixture(); f.runtime.documentRevision = 'current-document'
  const owner = JSON.stringify(['point-node', f.runtime.documentRevision, input.id])
  f.pointAttributes['data-point-node'] = owner
  const request = JSON.parse(f.bodyAttributes['data-label-request']); request[8] = owner
  f.setRequest(JSON.stringify(request))
  const observed = f.observe({ identity: f.identity, input })
  assert.equal(observed.owner, owner)
  assert.equal(f.observe({ identity: f.identity, input, settlement: true }), true)
})

test('only ready and fallback settle; pending waits and unknown or absent states fail explicitly', () => {
  for (const status of ['ready', 'fallback', 'pending', 'unrecognized', '', null]) {
    const f = fixture(); f.bodyAttributes['data-label-state'] = status
    if (['ready', 'fallback', 'pending'].includes(status)) {
      assert.equal(f.observe({ identity: f.identity, input, settlement: true }), status !== 'pending')
    } else assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), /unknown point body status/)
  }
})

test('pending metric body delays settlement while a document reset during the wait fails immediately', () => {
  const f = fixture()
  f.bodyAttributes['data-label-state'] = 'pending'
  assert.equal(f.observe({ identity: f.identity, input, settlement: true }), false)
  f.context.window.owned.generation = 'reset-during-conversion'
  assert.throws(() => f.observe({ identity: f.identity, input, settlement: true }), /continuity lost/)
})

function orchestration(f, overrides = {}) {
  const calls = [], diagnostics = []
  const owner = { browserIdentity: () => f.identity, checkpoint: async (boundary) => { calls.push(boundary) } }
  const page = {
    async evaluate(operation, args) { assert.equal(operation, observeOwnedMetricPoint); calls.push('input'); return f.observe(args) },
    async waitForFunction(operation, args, options) {
      assert.equal(operation, observeOwnedMetricPoint); assert.equal(options.timeout, 30_000)
      calls.push('settlement'); assert.equal(f.observe(args), true)
      return { dispose: async () => { calls.push('handle dispose') } }
    },
  }
  const options = { page, owner, input, boundary: '3d-resized',
    inspect: async () => { calls.push('inspect'); return f.inspected },
    diagnose: async (details) => diagnostics.push(details), ...overrides }
  return { options, calls, diagnostics }
}

test('guarded metric capture records current inputs and result around one settled inspection', async () => {
  const f = fixture(), run = orchestration(f)
  assert.equal(await captureOwnedMetricPoint(run.options), f.inspected)
  assert.deepEqual(run.calls, ['3d-resized:before-point-input', 'input', 'settlement', 'handle dispose',
    '3d-resized:after-settlement', 'inspect', '3d-resized:after-inspection', 'input'])
  assert.equal(run.diagnostics.length, 2)
  assert.equal(run.diagnostics[1].point, f.inspected)
})

test('removed resized point stops before literal inspection without retry or replacement', async () => {
  const f = fixture(), run = orchestration(f)
  f.remove()
  await assert.rejects(captureOwnedMetricPoint(run.options), /expected point DOM body missing/)
  assert.equal(run.calls.includes('settlement'), false)
  assert.equal(run.calls.includes('inspect'), false)
  assert.equal(run.calls.filter((call) => call === 'input').length, 1)
})

test('null inspection retains the observed null and fails before consuming literalObservation', async () => {
  const f = fixture(), run = orchestration(f, { inspect: async () => null })
  await assert.rejects(captureOwnedMetricPoint(run.options), /inspection returned no point/)
  assert.equal(run.diagnostics.at(-1).point, null)
})

test('document loss during inspection is rejected before the captured metric can be used', async () => {
  const f = fixture(), run = orchestration(f, { inspect: async () => {
    f.context.window.owned.generation = 'reloaded-during-inspect'
    return f.inspected
  } })
  await assert.rejects(captureOwnedMetricPoint(run.options), /continuity lost/)
  assert.equal(run.diagnostics.length, 1, 'A lost document never records a usable metric')
})

test('font readiness advancing without a DOM refresh fails after one inspection', async () => {
  const f = fixture()
  let inspections = 0
  const run = orchestration(f, { inspect: async () => {
    inspections++; f.runtime.fontGeneration++
    return f.inspected
  } })
  await assert.rejects(captureOwnedMetricPoint(run.options), /request font generation/)
  assert.equal(inspections, 1)
  assert.equal(run.diagnostics.length, 1, 'A stale generation never records a usable metric')
})

test('a current DOM refreshed during inspection cannot validate an older captured request', async () => {
  const f = fixture()
  const run = orchestration(f, { inspect: async () => {
    f.runtime.fontGeneration++
    const request = JSON.parse(f.bodyAttributes['data-label-request']); request[5] = f.runtime.fontGeneration
    f.setRequest(JSON.stringify(request))
    return f.inspected
  } })
  await assert.rejects(captureOwnedMetricPoint(run.options), /retains the current body request/)
  assert.equal(run.diagnostics.length, 2, 'Both captured and refreshed requests remain in diagnostics')
})

test('captured metrics require known settled point and literal states and their current requests', async () => {
  for (const [mutate, pattern] of [
    [(f) => { f.inspected.status = null }, /known settled state/],
    [(f) => { f.inspected.status = 'unrecognized' }, /known settled state/],
    [(f) => { f.inspected.status = 'pending' }, /known settled state/],
    [(f) => { f.bodyAttributes['data-label-state'] = 'pending' }, /remains in a known settled state/],
    [(f) => { f.inspected.runtime.fontGeneration-- }, /current font generation/],
    [(f) => { f.inspected.runtime.identity = 'old-runtime' }, /current point runtime/],
    [(f) => { f.inspected.literalObservation.request = 'old-literal-request' }, /Literal measurement retains the current body request/],
    [(f) => { f.inspected.literalObservation.pointRequest = 'old-point-request' }, /Literal measurement retains the current point request/],
    [(f) => { f.inspected.literalObservation.status = null }, /Literal measurement retains the current settled state/],
    [(f) => { delete f.inspected.literalObservation }, /Literal measurement retains the current body request/],
  ]) {
    const f = fixture(), run = orchestration(f, { inspect: async () => { mutate(f); return f.inspected } })
    await assert.rejects(captureOwnedMetricPoint(run.options), pattern)
    assert.equal(run.calls.filter((call) => call === 'settlement').length, 1)
  }
})

test('the exact inspection error survives without a second measurement', async () => {
  const primary = new Error('Execution context was destroyed'), f = fixture()
  let inspections = 0
  const run = orchestration(f, { inspect: async () => { inspections++; throw primary } })
  await assert.rejects(captureOwnedMetricPoint(run.options), (error) => error === primary)
  assert.equal(inspections, 1)
})
