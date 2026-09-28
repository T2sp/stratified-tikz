/** Focused native reproduction of the unchanged complete real-App workflow.
 * This report is diagnostic evidence, never cumulative phase acceptance. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'
import { captureBrowserCheckoutSnapshot } from './browserCheckoutSnapshot.mjs'
import { runAppChecks } from './checkFreeLabelsApp.mjs'
import { createOwnedAppPage } from './ownedAppPage.mjs'
import { ownPageEvent } from './ownedPageEvent.mjs'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { createAppGeometryDiagnostics, waitForAppFrames, waitForStableAppGeometry } from './appGeometryDiagnostics.mjs'

const details = (error) => ({ message: String(error.message).slice(0, 4000),
  stack: String(error.stack ?? '').slice(0, 12000), code: error.code })
const stamp = () => ({ wallTime: new Date().toISOString(), monotonicMs: performance.now() })

/** Attempt every owned cleanup, retaining the operation's original failure.
 * Late rejections are consumed by boundedPointDiagnostic. */
export async function finishFocusedResources(primary, operations, diagnose, timeoutMs = 2000) {
  let failure = primary
  for (const [name, operation] of operations) {
    try { await boundedPointDiagnostic(operation, name, timeoutMs) }
    catch (error) {
      failure ??= error
      try { await boundedPointDiagnostic(() => diagnose(name, error), `${name} failure evidence`, timeoutMs) }
      catch { /* A diagnostic cannot replace either operation or cleanup failure. */ }
    }
  }
  return failure
}

export async function runAppGeometryNativeControls({ browser, origin, artifactDir, record }) {
  const controls = []
  const expectedUrl = `${origin}/stratified-tikz/scripts/fixtures/freeLabelsApp.html`
  for (const fault of ['stalled-frames', 'never-stable-svg', 'missing-api', 'wrong-api', 'same-url-reload']) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
    const prefix = `focused-control-${fault}`
    const app = createOwnedAppPage({ page, expectedUrl, artifactDir, prefix })
    const geometry = createAppGeometryDiagnostics({ page, artifactDir, prefix: `${prefix}-geometry` })
    const control = { fault, result: 'running', started: stamp(), secondary: [] }
    const diagnose = async (name, error) => { control.secondary.push({ name, error: details(error), ...stamp() }) }
    let primary, loadEvent
    try {
      await app.install()
      await page.goto(expectedUrl, { timeout: 30_000 })
      const before = await boundedPointDiagnostic(() => app.start(), 'control App startup readiness', 35_000)
      await geometry.install()
      const json = await app.readState()
      const fixture = await boundedPointDiagnostic(() => page.evaluate(() => window.stzAppLabels.documentJson('$\\mathord{\\mathrm{i}}$')), 'control input document')
      loadEvent = ownPageEvent(page, 'filechooser', { name: `${fault} native document load`, timeoutMs: 5000 })
      const { event: chooser } = await loadEvent.run(() => page.getByRole('button', { name: 'Load JSON', exact: true }).click({ timeout: 3000 }))
      await chooser.setFiles({ name: 'native-geometry-control.json', mimeType: 'application/json', buffer: Buffer.from(fixture) })
      await boundedPointDiagnostic(() => page.waitForFunction((revision) => {
        window.__stzAppGeometryDiagnostics.assertOwnership()
        return window.stzAppLabels.state().labelDocumentRevision > revision
          && document.querySelector('[data-label-id="app-label"] [data-label-state]')?.getAttribute('data-label-state') === 'ready'
      }, json.labelDocumentRevision, { timeout: 30_000 }), 'control document ready wait', 35_000)
      control.baseline = await waitForStableAppGeometry(page, { timeoutMs: 2000 })
      await geometry.capture('control-before-fault', { fault })
      let rejected
      if (fault === 'stalled-frames') {
        // A disposable page only: exercise our browser and host frame deadline.
        await boundedPointDiagnostic(() => page.evaluate(() => { window.requestAnimationFrame = () => 0 }), 'control frame fault')
        try {
          await geometry.around('controlled-frame-stall', () => waitForAppFrames(page, { frames: 2, timeoutMs: 250 }), { fault }, 1000)
        } catch (error) { rejected = error }
        assert.ok(rejected, 'A native stalled frame wait must reject')
        assert.match(rejected.message, /timed out|timeout|deadline|stalled/i)
      } else if (fault === 'never-stable-svg') {
        await boundedPointDiagnostic(() => page.evaluate(() => {
          document.querySelector('svg.svg-diagram').animate([
            { transform: 'translateY(0px)' }, { transform: 'translateY(120px)' },
          ], { duration: 1000, iterations: Infinity, easing: 'linear' })
        }), 'control movement fault')
        const rect = () => boundedPointDiagnostic(() => page.locator('svg.svg-diagram').evaluate((svg) => {
          const box = svg.getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width, height: box.height, monotonicMs: performance.now() }
        }), 'moving SVG rectangle')
        const first = await rect()
        await waitForAppFrames(page, { frames: 3, timeoutMs: 2000 })
        const next = await rect()
        control.motion = { first, next }
        assert.notEqual(first.y, next.y, 'Native control measures actual SVG layout movement before invoking stability')
        let stableRejected
        try {
          await geometry.around('controlled-never-stable-geometry',
            () => waitForStableAppGeometry(page, { timeoutMs: 500 }), { fault }, 1500)
        } catch (error) { stableRejected = error }
        assert.ok(stableRejected, 'Independent native geometry stability must reject a moving SVG')
        assert.match(stableRejected.message, /geometry never stabilized/)
        control.geometryRejection = details(stableRejected)
        try {
          // The production reproduction uses this same Playwright stability
          // mechanism. Its short deadline is deliberate only in this control.
          await geometry.around('controlled-never-stable-scroll',
            () => page.locator('svg.svg-diagram').scrollIntoViewIfNeeded({ timeout: 500 }), { fault }, 1500)
        } catch (error) { rejected = error }
        assert.ok(rejected, 'A native moving SVG must fail scrolling stability')
        assert.match(rejected.message, /scrollIntoViewIfNeeded.*Timeout/s)
        assert.match(rejected.message, /waiting for element to be stable/)
      } else {
        if (fault === 'same-url-reload') await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
        else await boundedPointDiagnostic(() => page.evaluate((fault) => {
          if (fault === 'missing-api') delete window.stzAppLabels
          else window.stzAppLabels = { state: () => { throw new Error('Replacement API must never execute') } }
        }, fault), 'control API fault')
        try { await app.checkpoint(`control-${fault}`) } catch (error) { rejected = error }
        assert.ok(rejected, `Native ${fault} must fail continuity`)
        assert.match(rejected.message, fault === 'same-url-reload' ? /generation changed/
          : fault === 'missing-api' ? /API missing/ : /API instance changed/)
        let stableRejected
        try { await waitForStableAppGeometry(page, { timeoutMs: 1000 }) }
        catch (error) { stableRejected = error }
        assert.ok(stableRejected, 'Native geometry stability must fail closed after ownership loss')
        assert.match(stableRejected.message, fault === 'same-url-reload' ? /observer missing/ : /continuity lost/)
        control.geometryRejection = details(stableRejected)
      }
      control.rejection = details(rejected)
      control.geometry = await geometry.capture('control-after-rejection', { fault, rejection: control.rejection })
      await geometry.failure(rejected, { deliberateNegativeControl: true, fault })
      control.owned = await app.failure(rejected, { deliberateNegativeControl: true, fault })
      assert.ok(control.owned.snapshot, 'Native control retains API-independent owned DOM')
      assert.equal(control.owned.snapshot.pageId, before.pageId)
      assert.equal(control.owned.screenshot, `${prefix}-failure.png`, 'Native control retains a viewport screenshot')
      if (fault === 'same-url-reload') {
        assert.equal(control.owned.snapshot.document.url, before.document.url)
        assert.notEqual(control.owned.snapshot.document.generation, before.document.generation)
      }
      control.result = 'passed'
    } catch (error) {
      primary = error
      control.result = 'failed'; control.error = details(error)
      for (const [name, operation] of [
        ['control geometry failure', () => geometry.failure(error, { fault })],
        ['control owned failure', () => app.failure(error, { fault })],
      ]) {
        try { await boundedPointDiagnostic(operation, name, 10_000) }
        catch (secondary) { await diagnose(name, secondary) }
      }
    } finally {
      loadEvent?.dispose()
      primary = await finishFocusedResources(primary, [
        ['geometry control dispose', () => geometry.dispose()],
        ['owned control dispose', () => app.dispose()],
        ['owned control page close', () => page.close()],
        ['owned control filechooser drain', async () => { await loadEvent?.drain() }],
      ], diagnose)
      if (primary) { control.result = 'failed'; control.error = details(primary) }
      control.finished = stamp()
      controls.push(control)
      try { await boundedPointDiagnostic(() => record(`native-control-${fault}`, control), 'native control report') }
      catch (error) { primary ??= error }
    }
    if (primary) throw primary
  }
  return controls
}

/** The cumulative App group may complete only after the full production
 * workflow and the isolated native stability/ownership controls both return. */
export async function runAppChecksWithGeometryControls(context,
  appChecks = runAppChecks, geometryControls = runAppGeometryNativeControls) {
  await appChecks(context)
  await geometryControls(context)
}

export async function runFocusedAppAcceptance() {
  const artifactDir = resolve(process.env.STZ_SMOKE_ARTIFACT_DIR ?? `/private/tmp/stz-app-focused-${Date.now()}`)
  await mkdir(artifactDir, { recursive: true })
  const environment = { nodeVersion: process.version, browserVersion: null,
    playwrightModule: process.env.STZ_PLAYWRIGHT_MODULE ?? 'playwright',
    browserExecutable: process.env.STZ_BROWSER_EXECUTABLE ?? null,
    baseUrl: process.env.STZ_BROWSER_BASE_URL ?? null }
  const evidence = [], secondary = []
  let stage = 'checkout-capture', browser, server, checkout, primary
  const started = stamp()
  const save = async (result) => {
    const report = JSON.stringify({ schema: 1, result, stage, started, observed: stamp(),
      scope: 'Focused real-App workflow and isolated native fault controls; not cumulative phase acceptance',
      environment, checkout, evidence, secondary, error: primary ? details(primary) : undefined }, null, 2) + '\n'
    assert.ok(Buffer.byteLength(report) <= 32_000_000, 'Focused report exceeds its bounded evidence budget')
    await boundedPointDiagnostic(() => writeFile(resolve(artifactDir, 'focused-app-evidence.json'), report), 'focused report write')
  }
  const diagnose = async (name, error) => {
    secondary.push({ name, error: details(error), ...stamp() })
    if (secondary.length > 32) secondary.shift()
    console.error(`Focused App ${name}: ${error.message}`)
  }
  const failed = async () => { try { await save('failed') } catch (error) { await diagnose('report write failed', error) } }
  const record = async (name, value) => {
    assert.ok(evidence.length < 256, 'Focused report record budget exceeded')
    evidence.push({ ...value, name, observed: stamp() })
    await save('running')
    console.log(JSON.stringify({ result: value.result ?? 'passed', name }))
  }
  try {
    const snapshot = captureBrowserCheckoutSnapshot(); checkout = snapshot.checkout
    await writeFile(resolve(artifactDir, 'checkout.diff'), snapshot.diff)
    await writeFile(resolve(artifactDir, 'checkout-untracked.json'), JSON.stringify(snapshot.untracked, null, 2))
    await save('running')
    stage = 'playwright-import'
    const moduleName = environment.playwrightModule
    const { chromium } = await import(isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName)
    stage = 'development-server-listen'
    if (!environment.baseUrl) {
      server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
      await boundedPointDiagnostic(() => server.listen(), 'focused server listen', 30_000)
      const address = server.httpServer.address()
      assert.ok(address && typeof address !== 'string')
      environment.baseUrl = `http://127.0.0.1:${address.port}`
    }
    stage = 'browser-launch'
    browser = await chromium.launch({ headless: true, timeout: 30_000,
      ...(environment.browserExecutable ? { executablePath: environment.browserExecutable } : {}) })
    environment.browserVersion = browser.version()
    stage = 'real-App-workflows'; await save('running')
    await runAppChecks({ browser, origin: environment.baseUrl, artifactDir, record })
    stage = 'native-diagnostic-controls'; await save('running')
    await runAppGeometryNativeControls({ browser, origin: environment.baseUrl, artifactDir, record })
    stage = 'checkout-identity-after'
    const after = captureBrowserCheckoutSnapshot().checkout
    assert.equal(after.fingerprint, checkout.fingerprint, 'Focused execution preserves tracked, untracked and binary checkout identity')
    stage = 'resource-cleanup'
  } catch (error) { primary = error; await failed() }
  finally {
    primary = await finishFocusedResources(primary,
      [['browser', browser], ['server', server]].filter(([, resource]) => resource)
        .map(([name, resource]) => [`${name} close`, () => resource.close()]), diagnose, 5000)
    if (primary) await failed()
  }
  if (primary) throw primary
  stage = 'complete'; await save('passed')
  console.log(JSON.stringify({ result: 'focused-app-check-passed', artifactDir, checks: evidence.length, environment }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runFocusedAppAcceptance()
