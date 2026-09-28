/** Focused reproduction of the complete native point workflow. It does not run
 * cumulative predecessors and can never establish phase acceptance. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'
import { captureBrowserCheckoutSnapshot } from './browserCheckoutSnapshot.mjs'
import { runNativePointChecks } from './checkPointNodesApp.mjs'
import { finishFocusedResources } from './checkFreeLabelsAppFocused.mjs'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { pointNodeScenarioArtifacts } from './automation/phase-verification.mjs'

const bodyGroup = 'point-node-body-layout-lifecycle'
const exportGroup = 'point-node-settled-export'
const nativeScenarios = {
  [bodyGroup]: ['point-native-direct-cursor-workplanes-inspector-persistence'],
  [exportGroup]: ['point-native-pending-transparent-edit', 'point-native-pending-white-load',
    'point-whole-node-fallback-opacity-validation'],
}
const stamp = () => ({ wallTime: new Date().toISOString(), monotonicMs: performance.now() })
const errorDetails = (error) => {
  const truncated = {}
  const text = (value, field, limit = 65_536) => {
    const original = String(value)
    if (original.length > limit) truncated[field] = true
    return original.slice(0, limit)
  }
  const result = { message: text(error instanceof Error ? error.message : error, 'message') }
  if (error instanceof Error) {
    if (error.stack !== undefined) result.stack = text(error.stack, 'stack')
    if (error.code !== undefined) result.code = text(error.code, 'code', 256)
    // Playwright may expose its call log separately from message/stack. Retain
    // ordinary logs exactly, with explicit markers when an evidence cap applies.
    if (Array.isArray(error.log)) {
      if (error.log.length > 128) truncated.log = true
      result.log = error.log.slice(0, 128).map((entry) => text(entry, 'log', 8192))
    } else if (error.log !== undefined) result.log = text(error.log, 'log')
  }
  if (Object.keys(truncated).length) result.truncated = truncated
  return result
}
const maxEvidenceBytes = 32_000_000
const maxObservations = 2048

/** Dependency injection is for lifecycle tests only. The CLI always invokes the
 * shared, complete workflow: both dimensions, both saved modes, then exports. */
export async function runFocusedNativePointWorkflow(context, nativeChecks = runNativePointChecks) {
  await context.startGroup(bodyGroup)
  await nativeChecks(context)
  await context.completeGroup(bodyGroup)
}

export async function runFocusedNativePointAcceptance({
  artifactDir = resolve(process.env.STZ_SMOKE_ARTIFACT_DIR ?? `/private/tmp/stz-point-native-focused-${Date.now()}`),
  env = process.env,
  captureCheckout = captureBrowserCheckoutSnapshot,
  loadChromium = async (moduleName) => (await import(isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName)).chromium,
  createViteServer = createServer,
  nativeChecks = runNativePointChecks,
  write = writeFile,
  diagnosticTimeoutMs = 2000,
  cleanupTimeoutMs = 5000,
} = {}) {
  await mkdir(artifactDir, { recursive: true })
  const environment = { nodeVersion: process.version, browserVersion: null,
    playwrightModule: env.STZ_PLAYWRIGHT_MODULE ?? 'playwright',
    browserExecutable: env.STZ_BROWSER_EXECUTABLE ?? null,
    baseUrl: env.STZ_BROWSER_BASE_URL ?? null,
    rendererViewport: { width: 1100, height: 850 },
    nativeAppViewport: { width: 1600, height: 1200 } }
  const evidence = [], observations = [], secondary = [], pageErrors = []
  const startedNativeScopes = [], completedNativeScopes = []
  const started = stamp()
  let stage = 'checkout-capture', checkpoint = null, observationIndex = 0
  let checkout, afterCheckout, primary, browser, server, page
  const writeBounded = (name, value) => {
    const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n'
    assert.ok(Buffer.byteLength(bytes) <= maxEvidenceBytes, `${name} exceeds the focused evidence byte budget`)
    return boundedPointDiagnostic(() => write(resolve(artifactDir, name), bytes), `${name} write`, diagnosticTimeoutMs)
  }
  const save = (result) => writeBounded('focused-point-native-evidence.json', {
    schema: 1, result, stage, checkpoint, started, observed: stamp(),
    scope: 'Focused complete native point workflow; diagnostic evidence only, not cumulative phase acceptance',
    scopeNote: 'Native scopes describe only the native subset of these cumulative groups. Cumulative predecessors and dash-cap audits are not executed here.',
    environment, checkout, afterCheckout, startedNativeScopes, completedNativeScopes,
    incompleteNativeScopes: Object.keys(nativeScenarios).filter((group) => !completedNativeScopes.includes(group)),
    unexecutedNativeScopes: Object.keys(nativeScenarios).filter((group) => !startedNativeScopes.includes(group)),
    evidence, observations, secondary, pageErrors,
    pageErrorCoverage: 'This list covers the renderer fixture. The shared native workflow records and asserts its separate App and standalone page errors.',
    error: primary ? errorDetails(primary) : undefined,
  })
  const diagnoseSecondary = async (name, error) => {
    secondary.push({ name, error: errorDetails(error), ...stamp() })
    if (secondary.length > 32) secondary.shift()
    console.error(`Focused native point ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const saveFailure = async () => {
    try { await save('failed') } catch (error) { await diagnoseSecondary('failure report write', error) }
  }
  const record = async (name, details) => {
    assert.ok(evidence.length < 64, 'Focused native scenario budget exceeded')
    evidence.push({ name, ...details, observed: stamp() })
    await save('running')
  }
  const observe = async (name, details = {}) => {
    assert.ok(observationIndex < maxObservations, 'Focused native observation budget exceeded')
    const artifact = `focused-point-observation-${String(++observationIndex).padStart(4, '0')}.json`
    await writeBounded(artifact, { name, ...details, observed: stamp() })
    checkpoint = { group: details.group ?? checkpoint?.group, name }
    // Large state/model observations stay file-backed, not copied into each report.
    observations.push({ ...checkpoint, artifact })
    await save('running')
  }
  const startGroup = async (group) => {
    assert.ok(nativeScenarios[group], `Known native subset: ${group}`)
    assert.ok(!startedNativeScopes.includes(group), `Native subset starts once: ${group}`)
    startedNativeScopes.push(group); checkpoint = { group, name: group }
    await save('running')
  }
  const completeGroup = async (group) => {
    assert.ok(startedNativeScopes.includes(group) && !completedNativeScopes.includes(group), `Started incomplete native subset: ${group}`)
    for (const name of nativeScenarios[group]) {
      assert.ok(evidence.some((entry) => entry.name === name && entry.group === group && entry.result === 'passed'), `Completed native scenario: ${name}`)
    }
    completedNativeScopes.push(group)
    await save('running')
  }
  const saved = async (name, details, group) => {
    assert.ok(nativeScenarios[group]?.includes(name), `Known focused native scenario: ${name}`)
    await writeBounded(`${name}.json`, details)
    await observe(`${name}-observed`, { group, artifact: `${name}.json` })
    await record(name, { group, result: 'passed', artifacts: pointNodeScenarioArtifacts(name) })
  }
  const onPageError = (error) => {
    if (pageErrors.length < 64) pageErrors.push(errorDetails(error))
  }
  try {
    const snapshot = captureCheckout(); checkout = snapshot.checkout
    await writeBounded('checkout.diff', snapshot.diff)
    await writeBounded('checkout-untracked.json', snapshot.untracked)
    await save('running')
    stage = 'playwright-import'
    const chromium = await loadChromium(environment.playwrightModule)
    stage = 'development-server-listen'
    if (!environment.baseUrl) {
      server = await createViteServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
      await boundedPointDiagnostic(() => server.listen(), 'focused native server listen', 30_000)
      const address = server.httpServer.address()
      assert.ok(address && typeof address !== 'string')
      environment.baseUrl = `http://127.0.0.1:${address.port}`
    }
    stage = 'browser-launch'
    browser = await chromium.launch({ headless: true, timeout: 30_000,
      ...(environment.browserExecutable ? { executablePath: environment.browserExecutable } : {}) })
    environment.browserVersion = browser.version()
    stage = 'renderer-fixture'
    page = await browser.newPage({ viewport: environment.rendererViewport })
    page.on('pageerror', onPageError)
    await page.goto(`${environment.baseUrl}/stratified-tikz/scripts/fixtures/freeLabels.html`, { timeout: 30_000 })
    await page.waitForFunction(() => window.stzLabels !== undefined, undefined, { timeout: 30_000 })
    stage = 'point-node-native-input'; await save('running')
    await runFocusedNativePointWorkflow({ browser, origin: environment.baseUrl, page, artifactDir,
      saved, startGroup, completeGroup, observe,
      diagnose: (group, scenario, details) => observe(`${scenario}-observed`, { group, scenario, result: 'observed', ...details }),
      setStage: (value) => { stage = value },
    }, nativeChecks)
    assert.deepEqual(pageErrors, [], 'Focused renderer fixture has no page errors')
    stage = 'checkout-identity-after'
    afterCheckout = captureCheckout().checkout
    assert.equal(afterCheckout.fingerprint, checkout.fingerprint,
      'Focused execution preserves tracked, untracked and binary checkout identity')
    stage = 'resource-cleanup'
  } catch (error) { primary = error; await saveFailure() }
  finally {
    primary = await finishFocusedResources(primary, [
      ...(page ? [['renderer listener removal', () => page.off('pageerror', onPageError)],
        ['renderer page close', () => page.close()]] : []),
      ...(browser ? [['browser close', () => browser.close()]] : []),
      ...(server ? [['server close', () => server.close()]] : []),
    ], diagnoseSecondary, cleanupTimeoutMs)
    if (primary) await saveFailure()
  }
  if (primary) throw primary
  stage = 'complete'
  try { await save('passed') } catch (error) { primary = error; await saveFailure(); throw error }
  console.log(JSON.stringify({ result: 'focused-native-point-check-passed', artifactDir,
    checks: evidence.length, cumulativeAcceptance: false, environment }))
  return { artifactDir, environment, checkout, afterCheckout, evidence }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runFocusedNativePointAcceptance()
