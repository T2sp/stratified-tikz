import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Bound page/evidence diagnostics and own late rejections after a deadline. */
export async function boundedPointDiagnostic(operation, name, timeoutMs = 2000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Point diagnostic timeout must be finite and positive')
  let timer
  const outcome = Promise.resolve().then(operation).then(
    (value) => ({ ok: true, value }), (error) => ({ ok: false, error }))
  try {
    const result = await Promise.race([outcome, new Promise((resolve) => {
      timer = setTimeout(() => resolve({ ok: false,
        error: new Error(`Timed out after ${timeoutMs}ms during ${name}`) }), timeoutMs)
    })])
    if (!result.ok) throw result.error
    return result.value
  } finally { clearTimeout(timer) }
}

/** Called before assertions. Diagnostic records never count as passing scenarios. */
export function createPointDiagnostics({ artifactDir, observe, artifactPrefix = 'point-observation' }) {
  let index = 0
  return async (group, scenario, details) => {
    const artifact = `${artifactPrefix}-${String(++index).padStart(4, '0')}.json`
    const observation = { group, scenario, result: 'observed', ...details }
    await writeFile(resolve(artifactDir, artifact), JSON.stringify(observation, null, 2) + '\n')
    await observe(`${scenario}-observed`, { group, artifact })
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
  try { await boundedPointDiagnostic(() => diagnose(observation), `${name} evidence`, timeoutMs) }
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
    try { await boundedPointDiagnostic(() => diagnose({ captureError: { message: error.message, stack: error.stack } }), 'point capture failure evidence') }
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
