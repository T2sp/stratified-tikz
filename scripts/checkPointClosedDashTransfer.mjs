/** One bounded follow-up, deliberately separate from cumulative acceptance.
 * Four currently supported point shapes, one uninterrupted closed-dash setting.
 * No arbitrary-polygon/engine sweep and no retry or policy exception. */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import { captureBrowserCheckoutSnapshot } from './browserCheckoutSnapshot.mjs'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { connectedPaintCaptureMetadata, inspectConnectedLivePaintPng } from './connectedLivePaintOracle.mjs'
import { withConnectedLivePaintIsolation } from './connectedLivePaintIsolation.mjs'

export const closedDashTransferCases = ['triangle', 'square', 'star', 'circle'].map((shape) => ({
  shape, size: 5.892556509887896, widthPt: 10, patternPt: [100 / 1.2, 100 / 1.2], phasePt: 1 / 1.2,
  strokeWidth: 12, pattern: [100, 100], emittedPattern: [(100 / 1.2) * 1.2, (100 / 1.2) * 1.2], phase: 1, cap: 'square', join: 'bevel', exterior: { x: -40, y: -40 },
}))
const region = { minX: -48, minY: -48, maxX: 48, maxY: 48 }
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const details = (error) => ({ message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, captureDiagnostic: error?.captureDiagnostic })

export async function runClosedDashTransfer({ page, artifactDir }) {
  const evidence = { result: 'observed', scope: 'Bounded supported-point transfer investigation; not cumulative native acceptance or an adopted limitation',
    mechanism: 'One positive dash covers the complete closed path: width12, square caps, bevel joins, nominal [100,100], phase1. Raw model [100/1.2,100/1.2] emits [100.00000000000001,100.00000000000001]; the SVG source retains that conversion exactly.', cases: [] }
  const save = (name, data) => boundedPointDiagnostic(() => writeFile(resolve(artifactDir, name), typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n'), `closed-dash transfer ${name}`, 5000)
  const persist = () => save('closed-dash-transfer.json', evidence)
  const grid = []
  for (let y = -32; y <= 32; y += 2) for (let x = -32; x <= 32; x += 2) grid.push({ local: { x, y } })
  let primary
  for (const spec of closedDashTransferCases) {
    const entry = { shape: spec.shape, specification: spec, result: 'observed' }, stem = `closed-dash-transfer-${spec.shape}`
    evidence.cases.push(entry); await persist()
    try {
      entry.framing = await page.evaluate((spec) => {
        window.stzLabels.mount({ labels: [], points: [{ id: 'p', text: '', style: { shape: spec.shape, size: spec.size, paint: {
          text: { color: '#000000', opacity: 1 }, fill: { enabled: false, color: '#000000', opacity: 1 },
          stroke: { enabled: true, color: '#000000', opacity: 1, width: spec.widthPt, lineStyle: 'solid', dashPattern: spec.patternPt, dashPhase: spec.phasePt, lineCap: 'rect', lineJoin: 'bevel' },
        } } }] })
        window.stzLabels.setProps({ showGeometryHandles: false }); window.stzLabels.select(null)
        const svg = document.querySelector('svg.svg-diagram')
        const state = window.stzLabels.state()
        const saved = { style: svg.getAttribute('style'), viewBox: svg.getAttribute('viewBox'), json: state.json, history: state.history }
        svg.setAttribute('viewBox', '402 302 96 96')
        Object.assign(svg.style, { width: '1536px', height: '1536px', position: 'fixed', left: '0', top: '0', background: '#fff', zIndex: '2147483647' })
        return saved
      }, spec)
      await page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30000 })
      const samples = [...grid, { local: spec.exterior }]
      const before = await page.evaluate((samples) => {
        const contour = document.querySelector('[data-point-id="p"] [data-point-contour]'), css = getComputedStyle(contour), matrix = contour.getScreenCTM(), state = window.stzLabels.state()
        return { source: contour.outerHTML, sourcePattern: contour.getAttribute('stroke-dasharray'), sourceKind: contour.localName, pathLength: contour.getTotalLength(), ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])),
          stroke: { width: parseFloat(css.strokeWidth), pattern: css.strokeDasharray.split(/[ ,]+/u).map(parseFloat), phase: parseFloat(css.strokeDashoffset), cap: css.strokeLinecap, join: css.strokeLinejoin },
          model: state.points, json: state.json, history: state.history, tikz: state.tikz, inlineTikz: state.inlineTikz, viewport: { width: innerWidth, height: innerHeight },
          samples: samples.map(({ local }) => ({ local, insideContour: contour.isPointInFill(new DOMPoint(local.x, local.y)), nativeStrokeContains: contour.isPointInStroke(new DOMPoint(local.x, local.y)) })),
          candidates: window.stzLabels.emptyPointSelectionCandidates(samples.map(({ local }) => ({ x: 450 + local.x, y: 350 + local.y }))) }
      }, samples)
      entry.before = before; await save(`${stem}.source.svg`, before.source); entry.sourceSha256 = sha(before.source)
      assert.equal(before.sourcePattern, spec.emittedPattern.join(' '))
      assert.deepEqual(before.stroke, { width: spec.strokeWidth, pattern: spec.pattern, phase: spec.phase, cap: spec.cap, join: spec.join })
      assert.ok(before.pathLength > 0 && before.pathLength < 99, 'The retained positive interval must cover the full supported contour')
      entry.captureDecorationIsolation = await page.evaluate(() => {
        const style = document.createElement('style'); style.setAttribute('data-closed-dash-transfer-isolation', 'true'); style.textContent = 'svg.svg-diagram [data-svg-export-exclude] { visibility: hidden !important; }'; document.head.append(style)
        return { method: 'owned temporary CSS hides export-excluded decoration only', count: document.querySelectorAll('svg.svg-diagram [data-svg-export-exclude]').length }
      })
      const clip = { x: 0, y: 0, width: 1536, height: 1536 }
      const capture = async (kind) => {
        const file = `${stem}.${kind === 'live' ? 'live' : 'continuous'}.png`
        const captureState = { kind: 'supported full-closed transfer', shape: spec.shape, paint: kind }
        const captureSource = await boundedPointDiagnostic(() => page.evaluate(() => {
          const contour = document.querySelector('[data-point-id="p"] [data-point-contour]'), m = contour.getScreenCTM()
          return { source: contour.outerHTML, ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, m[key]])), viewport: { width: innerWidth, height: innerHeight } }
        }), 'transfer capture source and transform')
        const { source, ctm } = captureSource
        const record = { file, clip, ...captureSource, sourceSha256: sha(source), region, captureState, status: 'observed' }
        entry[kind] = record; await persist()
        assert.deepEqual(ctm, before.ctm, 'Capture retains the measured connected contour transform')
        await withConnectedLivePaintIsolation({ page, owner: 'stz-closed-dash-capture-isolation', record, persist, region }, async () => {
          const png = await page.screenshot({ clip, scale: 'css', animations: 'disabled', timeout: 5000 })
          await save(file, png)
          Object.assign(record, connectedPaintCaptureMetadata(png, { source, ctm, region, captureState }), { status: 'captured' }); await persist()
          record.pixels = inspectConnectedLivePaintPng(png, { ctm, samples, region, captureState })
          record.status = 'inspected'; await persist()
        })
      }
      await capture('live')
      let continuousFailure
      try {
        await boundedPointDiagnostic(() => page.evaluate(() => document.querySelector('[data-point-id="p"] [data-point-contour]').setAttribute('stroke-dasharray', 'none')), 'transfer continuous control installation')
        await capture('continuous')
      } catch (error) { continuousFailure = error }
      try {
        await boundedPointDiagnostic(() => page.evaluate((pattern) => document.querySelector('[data-point-id="p"] [data-point-contour]').setAttribute('stroke-dasharray', pattern), before.sourcePattern), 'transfer continuous source restoration')
      } catch (error) { entry.continuousRestorationError = details(error); continuousFailure ??= error }
      if (continuousFailure) throw continuousFailure
      entry.after = await page.evaluate(() => {
        const contour = document.querySelector('[data-point-id="p"] [data-point-contour]'), m = contour.getScreenCTM(), state = window.stzLabels.state()
        return { source: contour.outerHTML, json: state.json, history: state.history, ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, m[key]])) }
      })
      assert.equal(entry.after.source, before.source); assert.equal(entry.after.json, before.json); assert.equal(entry.after.history, before.history); assert.deepEqual(entry.after.ctm, before.ctm)
      entry.samples = samples.map(({ local }, index) => {
        const paintDistance = entry.live.pixels.samples[index].paintDistance, solidDistance = entry.continuous.pixels.samples[index].paintDistance
        const minimum = Math.min(paintDistance ?? Infinity, solidDistance ?? Infinity), insideContour = before.samples[index].insideContour
        return { local, paintDistance, solidDistance, insideContour, expected: insideContour || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain', candidates: before.candidates[index].candidates }
      })
      entry.mismatches = entry.samples.filter(({ expected, candidates }) => expected !== 'uncertain' && (candidates.includes('p') !== (expected === 'hit') || candidates.some((id) => id !== 'p')))
      const exterior = entry.samples.at(-1)
      assert.equal(exterior.expected, 'miss'); assert.deepEqual(exterior.candidates, []); assert.ok(exterior.paintDistance > 6.14 && exterior.solidDistance > 6.14)
      const positive = entry.samples.find(({ expected, paintDistance, local }) => expected === 'hit' && paintDistance === 0 && Math.abs(local.x) + Math.abs(local.y) > 8)
      assert.ok(positive, 'Independent painted positive control')
      // One disputed sample if any, otherwise one painted positive, plus the
      // genuine exterior. Complete trusted candidate records cannot mask p.
      const actionCtm = await page.evaluate(() => {
        const root = document.querySelector('svg.svg-diagram'); root.setAttribute('viewBox', '0 0 900 700'); Object.assign(root.style, { width: '900px', height: '700px' })
        const m = document.querySelector('[data-point-id="p"] [data-point-contour]').getScreenCTM()
        return Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, m[key]]))
      })
      entry.actionCtm = actionCtm; entry.actions = []
      let actionFailure
      for (const sample of [entry.mismatches[0] ?? positive, exterior]) {
        await page.evaluate(() => { window.stzLabels.select(null); window.stzTransferClicks = window.stzLabels.observeEmptyPointSelectionClicks() })
        try {
          for (const alt of [false, true]) {
            const freshCtm = await page.evaluate(() => {
              const m = document.querySelector('[data-point-id="p"] [data-point-contour]').getScreenCTM()
              return Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, m[key]]))
            })
            assert.deepEqual(freshCtm, actionCtm, 'Fresh action transform retains restored ordinary framing')
            if (alt) await page.keyboard.down('Alt')
            try { await page.mouse.click(freshCtm.a * sample.local.x + freshCtm.e, freshCtm.d * sample.local.y + freshCtm.f) }
            finally { if (alt) await page.keyboard.up('Alt') }
            const action = await page.evaluate(() => window.stzTransferClicks.read().at(-1))
            entry.actions.push({ local: sample.local, expected: sample.expected, ctm: freshCtm, ...action })
            try {
              assert.equal(action.trusted, true); assert.equal(action.overlayExcluded, true)
              // Canvas inversion can introduce sub-ulp arithmetic roundoff.
              // This mapping check does not change the six-unit hit tolerance.
              assert.ok(Math.abs(action.point.x - 450 - sample.local.x) <= 1e-9)
              assert.ok(Math.abs(action.point.y - 350 - sample.local.y) <= 1e-9)
              assert.deepEqual([...action.candidates].sort(), sample.expected === 'hit' ? ['p'] : [])
            }
            catch (error) { actionFailure ??= error; entry.actionFailure ??= details(error) }
          }
        } finally { await page.evaluate(() => { window.stzTransferClicks.dispose(); delete window.stzTransferClicks; window.stzLabels.select(null) }) }
      }
      // This is the fixture's production immutable SVG serializer. Actual App
      // download/reopen acceptance remains in the cumulative required groups.
      const exported = await page.evaluate(() => window.stzLabels.export('white'))
      assert.ok(exported); await save(`${stem}.export.svg`, exported)
      entry.export = { file: `${stem}.export.svg`, sha256: sha(exported) }
      const standalone = await page.context().newPage()
      try {
        await standalone.setViewportSize({ width: 1600, height: 1600 }); await standalone.setContent(exported)
        entry.export.contour = await standalone.evaluate((source) => {
          const contour = document.querySelector('polygon[stroke-dasharray],circle[stroke-dasharray]'), css = contour && getComputedStyle(contour)
          const original = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${source}</svg>`, 'image/svg+xml').documentElement.firstElementChild
          const geometryAttributes = ['points', 'r', 'cx', 'cy', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke', 'stroke-opacity', 'fill']
          return contour && { source: contour.outerHTML, sourcePreserved: contour.localName === original.localName && geometryAttributes.every((name) => contour.getAttribute(name) === original.getAttribute(name)), width: parseFloat(css.strokeWidth), pattern: css.strokeDasharray.split(/[ ,]+/u).map(parseFloat), phase: parseFloat(css.strokeDashoffset), cap: css.strokeLinecap, join: css.strokeLinejoin }
        }, before.source)
        assert.ok(entry.export.contour); assert.equal(entry.export.contour.sourcePreserved, true); assert.deepEqual(entry.export.contour.pattern, spec.pattern); assert.equal(entry.export.contour.width, spec.strokeWidth); assert.equal(entry.export.contour.phase, spec.phase); assert.equal(entry.export.contour.cap, spec.cap); assert.equal(entry.export.contour.join, spec.join)
        const reopened = await standalone.screenshot({ timeout: 5000 }); await save(`${stem}.reopened.png`, reopened); entry.export.reopenedSha256 = sha(reopened)
      } finally { await standalone.close() }
      if (actionFailure) throw actionFailure
      assert.deepEqual(entry.mismatches, [], 'Supported full-closed-dash interaction discrepancy')
      entry.result = 'passed'
    } catch (error) { primary ??= error; entry.result = 'failed'; entry.error = details(error) }
    for (const [name, cleanup] of [
      ['decoration', () => page.evaluate(() => document.querySelector('[data-closed-dash-transfer-isolation]')?.remove())],
      ['framing', async () => {
        if (!entry.framing) return
        entry.restoration = await page.evaluate((saved) => {
          const svg = document.querySelector('svg.svg-diagram')
          for (const [key, value] of [['style', saved.style], ['viewBox', saved.viewBox]]) value === null ? svg.removeAttribute(key) : svg.setAttribute(key, value)
          const state = window.stzLabels.state(), contour = document.querySelector('[data-point-id="p"] [data-point-contour]')
          return { style: svg.getAttribute('style'), viewBox: svg.getAttribute('viewBox'), json: state.json, history: state.history, source: contour.outerHTML }
        }, entry.framing)
        entry.framingRestored = entry.restoration.style === entry.framing.style && entry.restoration.viewBox === entry.framing.viewBox
        entry.modelUnchanged = entry.restoration.json === entry.framing.json && entry.restoration.history === entry.framing.history
        assert.equal(entry.framingRestored, true); assert.equal(entry.modelUnchanged, true)
        if (entry.before) assert.equal(entry.restoration.source, entry.before.source)
      }],
    ]) try { await boundedPointDiagnostic(cleanup, `transfer ${name} cleanup`, 5000) }
    catch (error) { primary ??= error; (entry.cleanupErrors ??= []).push({ name, ...details(error) }); entry.result = 'failed' }
    await save(`${stem}.json`, entry); await persist()
  }
  evidence.result = primary ? 'failed' : 'passed'; await persist()
  if (primary) throw primary
  return evidence
}

export async function main({ artifactDir = process.env.STZ_CLOSED_DASH_TRANSFER_DIR ?? `/private/tmp/stz-closed-dash-transfer-${Date.now()}` } = {}) {
  await mkdir(artifactDir, { recursive: true })
  const report = { scope: 'Single bounded transfer; independent investigation, not phase acceptance', result: 'observed', stage: 'checkout', cases: closedDashTransferCases.map(({ shape }) => ({ shape, result: 'not_run' })), pageErrors: [], node: process.version }
  const save = () => writeFile(resolve(artifactDir, 'transfer-run.json'), JSON.stringify(report, null, 2) + '\n')
  let server, browser, page, primary
  try {
    const snapshot = captureBrowserCheckoutSnapshot(); report.checkout = snapshot.checkout
    await writeFile(resolve(artifactDir, 'checkout.diff'), snapshot.diff); await writeFile(resolve(artifactDir, 'checkout-untracked.json'), JSON.stringify(snapshot.untracked))
    report.stage = 'development-server-listen'; await save()
    server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); await server.listen()
    const address = server.httpServer.address(); assert.ok(address && typeof address !== 'string')
    report.stage = 'browser-launch'; await save()
    const fallback = join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')
    const moduleName = process.env.STZ_PLAYWRIGHT_MODULE ?? (existsSync(fallback) ? fallback : 'playwright')
    const { chromium } = await import(isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName)
    const chrome = process.env.STZ_BROWSER_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    browser = await chromium.launch({ headless: true, timeout: 30000, ...(existsSync(chrome) ? { executablePath: chrome } : {}) }); report.browser = browser.version()
    page = await browser.newPage({ viewport: { width: 1600, height: 1600 } }); page.on('pageerror', (error) => report.pageErrors.push(error.message))
    await page.goto(`http://127.0.0.1:${address.port}/stratified-tikz/scripts/fixtures/freeLabels.html`); await page.waitForFunction(() => window.stzLabels !== undefined)
    report.stage = 'supported-shapes'; await save()
    const evidence = await runClosedDashTransfer({ page, artifactDir }); report.cases = evidence.cases.map(({ shape, result }) => ({ shape, result }))
    assert.deepEqual(report.pageErrors, []); report.result = 'passed'
  } catch (error) {
    primary = error; report.result = 'failed'; report.error = details(error)
    if (report.stage === 'supported-shapes') try { const evidence = JSON.parse(await readFile(resolve(artifactDir, 'closed-dash-transfer.json'), 'utf8')); report.cases = evidence.cases.map(({ shape, result }) => ({ shape, result })) }
    catch (readError) { (report.secondary ??= []).push(details(readError)) }
  }
  finally {
    for (const cleanup of [() => page?.close(), () => browser?.close(), () => server?.close()]) try { await boundedPointDiagnostic(cleanup, 'transfer owned cleanup', 5000) } catch (error) { if (!primary) { primary = error; report.result = 'failed'; report.error = details(error) } else (report.secondary ??= []).push(details(error)) }
    report.afterCheckout = captureBrowserCheckoutSnapshot().checkout
    report.checkoutUnchanged = report.checkout?.fingerprint === report.afterCheckout.fingerprint
    if (!report.checkoutUnchanged) {
      const error = new Error('Bounded transfer checkout identity changed during observation')
      if (!primary) { primary = error; report.error = details(error) } else (report.secondary ??= []).push(details(error))
      report.result = 'failed'
    }
    await save()
  }
  if (primary) throw primary
  return report
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1 })
