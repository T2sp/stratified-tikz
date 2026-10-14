import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const schedulePointDiagnosticDeadline = (expire, timeoutMs) => {
  const timer = setTimeout(expire, timeoutMs)
  return () => clearTimeout(timer)
}

/** One diagnostic owns its complete composed callback, including queued file
 * authority. Absolute monotonic checks also catch synchronous work that delays
 * timer delivery. Its compact progress never contains native/raw snapshots. */
export function createPointDiagnosticOperation(name, timeoutMs = 2000, monotonicNow = () => performance.now()) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Point diagnostic timeout must be finite and positive')
  const startMs = monotonicNow(), deadlineMs = startMs + timeoutMs, owner = randomUUID(), token = `${owner}:0`
  if (!Number.isFinite(startMs)) throw new Error('Point diagnostic clock must be finite')
  const progress = []
  let state = 'active', generation = 0, failure
  const mark = (stage, details = {}) => {
    const values = Object.fromEntries(Object.entries(details).map(([key, value]) => {
      if (value !== null && !['number', 'string', 'boolean'].includes(typeof value)) throw new Error('Diagnostic progress contains only compact scalar values')
      return [key, value]
    }))
    const record = Object.freeze({ ...values, owner, token, generation, stage, atMs: monotonicNow(), state })
    if (progress.length === 96) progress.shift()
    progress.push(record)
    return record
  }
  const expire = () => {
    if (state === 'active') {
      failure = new Error(`Timed out after ${timeoutMs}ms during ${name}`)
      state = 'expired'; generation++; mark('operation-expired')
    }
    return failure
  }
  const operation = {
    owner, token, name, timeoutMs, startMs, deadlineMs, progress, mark, expire,
    assertActive(stage = 'operation-guard') {
      if (state === 'active' && monotonicNow() >= deadlineMs) expire()
      if (state !== 'active') throw failure ?? new Error(`Point diagnostic operation is ${state}: ${name}`)
      mark(stage)
    },
    snapshot() { return { owner, token, generation, name, timeoutMs, startMs, deadlineMs,
      state, progress: [...progress] } },
    settle(error) {
      if (state !== 'active') { mark(error ? 'late-rejection-consumed' : 'late-fulfillment-consumed'); return }
      if (error) { failure = error; state = 'rejected' }
      else state = 'completed'
      generation++; mark(error ? 'operation-rejected' : 'operation-completed')
    },
    get error() { return failure }, get state() { return state }, get generation() { return generation },
  }
  mark('operation-start', { deadlineMs, timeoutMs })
  return operation
}

/** Bound page/evidence diagnostics and immediately own both promise outcomes.
 * The optional scheduler controls only the explicitly supplied operation. */
export async function boundedPointDiagnostic(callback, name, timeoutMs = 2000,
  scheduleDeadline = schedulePointDiagnosticDeadline) {
  const operation = createPointDiagnosticOperation(name, timeoutMs, scheduleDeadline.monotonicNow)
  let cancelDeadline
  const outcome = Promise.resolve().then(() => {
    operation.assertActive('callback-entered')
    return callback(operation)
  }).then((value) => {
    try { operation.assertActive('callback-completed'); operation.settle(); return { ok: true, value } }
    catch (error) { operation.settle(error); return { ok: false, error } }
  }, (error) => {
    let failure = error
    try { operation.assertActive('callback-rejected') } catch (expired) { failure = expired }
    operation.settle(failure)
    return { ok: false, error: failure }
  })
  try {
    const result = await Promise.race([outcome, new Promise((resolve) => {
      cancelDeadline = scheduleDeadline(() => resolve({ ok: false, error: operation.expire() }), timeoutMs, operation)
    })])
    if (!result.ok) throw result.error
    return result.value
  } finally { cancelDeadline?.() }
}

/** Called before assertions. Diagnostic records never count as passing scenarios. */
export function createPointDiagnostics({ artifactDir, observe, artifactPrefix = 'point-observation', publish }) {
  let index = 0
  return async (group, scenario, details, { operation, disposition = 'running', primary } = {}) => {
    operation?.assertActive('diagnostic-snapshot-start')
    const artifact = `${artifactPrefix}-${String(++index).padStart(4, '0')}.json`
    // Detach before the first await: the producer may record a later timeout or
    // cleanup error while these already captured raw bytes remain historical.
    const observation = structuredClone({ group, scenario, result: 'observed', ...details })
    observation.result = 'observed'
    operation?.mark('diagnostic-snapshot-completed')
    operation?.assertActive('diagnostic-publication-start')
    if (operation) observation.diagnosticOperation = operation.snapshot()
    if (publish) await publish(artifact, observation, { stage: scenario, disposition, operation, primary })
    else {
      operation?.mark('diagnostic-serialization-start')
      const bytes = JSON.stringify(observation, null, 2) + '\n'
      operation?.mark('diagnostic-serialization-completed', { bytes: Buffer.byteLength(bytes) })
      operation?.assertActive('diagnostic-write-start')
      await writeFile(resolve(artifactDir, artifact), bytes)
      operation?.assertActive('diagnostic-write-completed')
    }
    operation?.assertActive('diagnostic-report-checkpoint-start')
    await observe(`${scenario}-observed`, { group, artifact }, { operation, disposition, primary })
    operation?.assertActive('diagnostic-report-checkpoint-completed')
    return observation
  }
}

/** Retain a current native stage before replacing its document or validating a
 * candidate. An existing action failure owns subsequent capture/write failures. */
export async function captureObservedPointCheck({ capture, diagnose, details = {}, primary,
  secondaryErrors, name, timeoutMs = 2000 }) {
  const observation = { ...details }
  let failure = primary, captured
  if (primary) observation.actionError = { message: primary.message, stack: primary.stack }
  try { captured = await boundedPointDiagnostic(() => capture(observation), `${name} capture`, timeoutMs) }
  catch (error) {
    observation.captureError = { message: error.message, stack: error.stack }
    if (failure) secondaryErrors.push(`${name} capture after primary failure: ${error.message}`)
    else failure = error
  }
  if (captured !== undefined) Object.assign(observation, captured)
  try { await boundedPointDiagnostic((operation) => diagnose(observation, { operation, disposition: failure ? 'failed' : 'running', primary: failure }), `${name} evidence`, timeoutMs) }
  catch (error) {
    if (failure) secondaryErrors.push(`${name} evidence after primary failure: ${error.message}`)
    else failure = error
  }
  if (failure) throw failure
  return captured
}

/** Collection can fail before an assertion (font/CTM/browser errors). Save that
 * failure too, and never let an evidence-write failure replace its cause. */
export async function capturePointCheck(capture, diagnose) {
  let point
  try { point = await capture() } catch (error) {
    try { await boundedPointDiagnostic((operation) => diagnose({ captureError: { message: error.message, stack: error.stack } }, { operation, disposition: 'failed', primary: error }), 'point capture failure evidence') }
    catch (diagnosticError) { console.error('Point capture diagnostics:', diagnosticError) }
    throw error
  }
  await diagnose({ point })
  return point
}

/** Cleanup cannot replace an assertion failure; without one, cleanup still fails. */
export async function cleanupPointCheck(primary, cleanup) {
  try { await cleanup() } catch (error) { if (!primary) throw error }
}
