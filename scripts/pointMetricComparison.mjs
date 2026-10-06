import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

/** Browser task: document identity, expected model source and its DOM body are
 * checked together. A reset with no pending labels is a failure, not settlement.
 * This function is standalone so Playwright can serialize it without imports. */
export function observeOwnedMetricPoint({ identity, input, settlement = false }) {
  const { key, expected, apiName } = identity
  const marker = window[key], api = window[apiName]
  if (location.href !== expected.url || marker?.generation !== expected.generation
    || typeof api?.state !== 'function' || marker.api !== api) {
    throw new Error(`Point metric ${input.id}: owned ${apiName} document/API continuity lost`)
  }
  const state = api.state(), model = JSON.parse(state.json).diagram
  const stratum = model.strata.find((point) => point.id === input.id)
  const outer = document.querySelector(`[data-point-id="${CSS.escape(input.id)}"]`)
  const point = outer?.querySelector('[data-point-node]'), body = point?.querySelector('[data-label-state]')
  const runtime = typeof api.pointRuntime === 'function' ? api.pointRuntime() : null
  const observed = {
    id: input.id, apiName, generation: marker.generation, ambientDimension: model.ambientDimension,
    modelKind: stratum?.geometricKind ?? null, modelSource: stratum?.text ?? null,
    present: { outer: !!outer, point: !!point, body: !!body },
    source: body?.getAttribute('data-label-source') ?? null,
    status: body?.getAttribute('data-label-state') ?? null,
    request: body?.getAttribute('data-label-request') ?? null,
    pointRequest: point?.getAttribute('data-point-request') ?? null,
    owner: point?.getAttribute('data-point-node') ?? null,
    runtime,
  }
  const fail = (reason) => { throw new Error(`Point metric ${input.id}: ${reason}; ${JSON.stringify(observed)}`) }
  if (model.ambientDimension !== input.ambientDimension) fail('unexpected model ambient dimension')
  if (stratum?.geometricKind !== 'point') fail('expected model point missing')
  if ((stratum.text ?? '') !== input.source) fail('expected model source changed')
  if (!outer || !point || !body) fail('expected point DOM body missing')
  if (observed.source !== input.source) fail('expected DOM source changed')
  if (!runtime || typeof runtime.identity !== 'string' || !runtime.identity.trim()
    || !(typeof runtime.documentRevision === 'number' && Number.isFinite(runtime.documentRevision)
      || typeof runtime.documentRevision === 'string' && runtime.documentRevision.trim())
    || !Number.isSafeInteger(runtime.fontGeneration) || runtime.fontGeneration < 0) fail('invalid current point runtime')
  if (observed.owner !== JSON.stringify(['point-node', runtime.documentRevision, input.id])) fail('point owner does not match the current document revision')
  if (observed.pointRequest !== observed.request) fail('point and body requests differ')
  if (typeof observed.request !== 'string') fail('body request missing')
  let request
  try { request = JSON.parse(observed.request) } catch { fail('malformed body request JSON') }
  // Production identity: source, family, size, weight, style, font generation,
  // tab size, line gap, owner. Slots 6/7 are layout settings, not revisions.
  if (!Array.isArray(request) || request.length !== 9 || typeof request[0] !== 'string'
    || typeof request[1] !== 'string' || !request[1].trim() || request[1].length > 1024
    || !Number.isFinite(request[2]) || request[2] <= 0 || request[2] > 4096
    || typeof request[3] !== 'string' || !/^(?:normal|bold|bolder|lighter|[1-9]\d{0,2}|1000)$/u.test(request[3])
    || !['normal', 'italic', 'oblique'].includes(request[4])
    || !Number.isSafeInteger(request[5]) || request[5] < 0
    || !Number.isInteger(request[6]) || request[6] < 1 || request[6] > 32
    || !Number.isFinite(request[7]) || request[7] < 0 || request[7] > 100
    || typeof request[8] !== 'string') fail('invalid nine-field body request tuple')
  if (request[0] !== input.source) fail('expected request source changed')
  if (request[8] !== observed.owner) fail('request owner does not match the current point owner')
  if (request[5] !== runtime.fontGeneration) fail('request font generation does not match the current point runtime')
  if (!['pending', 'ready', 'fallback'].includes(observed.status)) fail('unknown point body status')
  if (settlement) return observed.status !== 'pending'
  return observed
}

/** Keep absence/continuity failures before the literal-property assertion and
 * record both input checks and the inspected result. Neither waits nor guards
 * navigate, reacquire an API, or replace a missing point. */
export async function captureOwnedMetricPoint({ page, owner, input, boundary, inspect, diagnose }) {
  const identity = owner.browserIdentity()
  await owner.checkpoint(`${boundary}:before-point-input`)
  const before = await boundedPointDiagnostic(() => page.evaluate(observeOwnedMetricPoint, { identity, input }), `point metric input (${boundary})`)
  await diagnose({ boundary, metricInput: before })
  const settlement = await page.waitForFunction(observeOwnedMetricPoint, { identity, input, settlement: true }, { timeout: 30_000 })
  await settlement.dispose()
  await owner.checkpoint(`${boundary}:after-settlement`)
  const point = await inspect(input.id)
  await owner.checkpoint(`${boundary}:after-inspection`)
  const after = await boundedPointDiagnostic(() => page.evaluate(observeOwnedMetricPoint, { identity, input }), `point metric input after inspection (${boundary})`)
  await diagnose({ boundary, metricInput: after, point })
  assert.ok(point, `Point metric ${input.id}: inspection returned no point at ${boundary}`)
  assert.equal(point.ambientDimension, input.ambientDimension, 'Metric body belongs to the expected ambient dimension')
  assert.equal(point.modelSource, input.source, 'Metric body retains the expected model source')
  assert.equal(point.source, input.source, 'Metric body retains the expected DOM source')
  assert.equal(point.owner, after.owner, 'Metric measurement retains the current point owner')
  assert.equal(point.request, after.request, 'Metric measurement retains the current body request')
  assert.equal(point.pointRequest, after.request, 'Metric measurement retains the current body request')
  assert.ok(['ready', 'fallback'].includes(after.status), 'Metric body remains in a known settled state after inspection')
  assert.ok(['ready', 'fallback'].includes(point.status), 'Metric body has a known settled state before literal measurement')
  assert.equal(point.status, after.status, 'Metric measurement retains the current settled state')
  assert.equal(point.runtime?.fontGeneration, after.runtime.fontGeneration, 'Metric measurement retains the current font generation')
  assert.equal(point.runtime?.identity, after.runtime.identity, 'Metric measurement retains the current point runtime')
  assert.equal(point.literalObservation?.request, after.request, 'Literal measurement retains the current body request')
  assert.equal(point.literalObservation?.pointRequest, after.request, 'Literal measurement retains the current point request')
  assert.equal(point.literalObservation?.status, after.status, 'Literal measurement retains the current settled state')
  return point
}
