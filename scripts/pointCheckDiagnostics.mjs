import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Called before assertions. Diagnostic records never count as passing scenarios. */
export function createPointDiagnostics({ artifactDir, observe }) {
  let index = 0
  return async (group, scenario, details) => {
    const artifact = `point-observation-${String(++index).padStart(4, '0')}.json`
    const observation = { group, scenario, result: 'observed', ...details }
    await writeFile(resolve(artifactDir, artifact), JSON.stringify(observation, null, 2) + '\n')
    await observe(`${scenario}-observed`, { group, artifact })
    return observation
  }
}

/** Collection can fail before an assertion (font/CTM/browser errors). Save that
 * failure too, and never let an evidence-write failure replace its cause. */
export async function capturePointCheck(capture, diagnose) {
  let point
  try { point = await capture() } catch (error) {
    try { await diagnose({ captureError: { message: error.message, stack: error.stack } }) }
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
