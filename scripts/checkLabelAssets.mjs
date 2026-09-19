/**
 * Built browser smoke test. Requires an externally supplied Playwright install
 * and Chromium; neither is a production dependency.
 *
 * npm run build
 * STZ_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
 * STZ_BROWSER_EXECUTABLE=/absolute/path/to/chromium node scripts/checkLabelAssets.mjs
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname, sep, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

const base = '/stratified-tikz/'
const dist = resolve('dist')
const manifest = JSON.parse(await readFile(resolve(dist, '.vite/manifest.json'), 'utf8'))
const adapter = Object.values(manifest).find((entry) => entry.isEntry && entry.src === 'src/rendering/labels/labelService.ts')
assert.ok(adapter, 'Build manifest must include the independently testable label adapter entry')
const workerManifest = JSON.parse(await readFile(resolve(dist, '.vite/mathjax-worker-manifest.json'), 'utf8'))
assert.equal(workerManifest.version, 1, 'Worker deployment manifest has the expected version')
const workerChunks = new Map(workerManifest.chunks.map((chunk) => [chunk.file, chunk]))
const workerEntry = workerManifest.chunks.find((chunk) => chunk.isEntry)
const runtimeChunk = workerManifest.chunks.find((chunk) => chunk.sources.some((source) => source.endsWith('/mathjaxRuntime.ts')))
assert.ok(workerEntry && runtimeChunk && workerEntry !== runtimeChunk,
  'The lazy worker entry and runtime must both be discoverable')
const approvedFontNames = (await readdir('node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic'))
  .filter((name) => name.endsWith('.js')).sort()
const fontChunks = workerManifest.chunks.filter((chunk) => chunk.sources.some((source) =>
  /\/@mathjax\/mathjax-newcm-font\/(?:mjs|js)\/svg\/dynamic\/[^/]+\.js$/u.test(source)))
const emittedFontNames = [...new Set(fontChunks.flatMap((chunk) => chunk.sources.flatMap((source) => {
  const match = /\/@mathjax\/mathjax-newcm-font\/(?:mjs|js)\/svg\/dynamic\/([^/]+\.js)$/u.exec(source)
  return match ? [match[1]] : []
})))].sort()
assert.deepEqual(emittedFontNames, approvedFontNames, 'Every approved local font module must be emitted in the worker graph')
let staticReferences = 0
for (const entry of Object.values(manifest)) {
  await readFile(resolve(dist, entry.file))
  for (const reference of [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])]) {
    assert.ok(manifest[reference], `Missing main graph reference: ${reference}`)
    staticReferences++
  }
  for (const file of [...(entry.assets ?? []), ...(entry.css ?? [])]) await readFile(resolve(dist, file))
}
for (const chunk of workerChunks.values()) {
  await readFile(resolve(dist, chunk.file))
  for (const reference of [...chunk.imports, ...chunk.dynamicImports]) {
    assert.ok(workerChunks.has(reference), `Missing worker graph reference: ${reference}`)
    await readFile(resolve(dist, reference))
    staticReferences++
  }
}
const transitiveChunk = runtimeChunk.imports.map((file) => workerChunks.get(file))
  .find((chunk) => chunk && chunk !== workerEntry)
assert.ok(transitiveChunk, 'The split runtime graph must supply an actual transitive native-module failure fixture')
const graphEvidence = { mainEntries: Object.keys(manifest).length, workerChunks: workerChunks.size,
  references: staticReferences, approvedFontModules: emittedFontNames.length,
  worker: workerEntry.file, runtime: runtimeChunk.file, transitive: transitiveChunk.file }
console.log(JSON.stringify({ result: 'static-assets-passed', graph: graphEvidence }))
if (process.env.STZ_SMOKE_ARTIFACT_DIR) {
  const output = resolve(process.env.STZ_SMOKE_ARTIFACT_DIR)
  await mkdir(output, { recursive: true })
  await writeFile(resolve(output, 'asset-graph-evidence.json'), JSON.stringify(graphEvidence, null, 2))
}

const playwrightModule = process.env.STZ_PLAYWRIGHT_MODULE ?? 'playwright'
let chromium
try {
  ;({ chromium } = await import(isAbsolute(playwrightModule) ? pathToFileURL(playwrightModule).href : playwrightModule))
} catch (error) {
  throw new Error('Browser check unavailable: provide Playwright through STZ_PLAYWRIGHT_MODULE (no browser check has passed)', { cause: error })
}

const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
}
const served = []
const serverRequests = []
let injectedFailure
const nativeProbePath = base + '__native_module_failure_probe.js'
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith(base)) {
      response.writeHead(404).end('Outside configured application base')
      return
    }
    if (injectedFailure?.path === url.pathname && injectedFailure.active) {
      const evidence = { path: url.pathname, status: 503, scenario: injectedFailure.name }
      injectedFailure.hits.push(evidence)
      serverRequests.push(evidence)
      response.writeHead(503, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' })
        .end('Intentional scenario-local native module download failure')
      return
    }
    if (url.pathname === nativeProbePath) {
      serverRequests.push({ path: url.pathname, status: 200 })
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' })
        .end('export const recovered = true')
      return
    }
    const relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html'
    const file = resolve(dist, relative)
    if (!file.startsWith(dist + sep)) {
      response.writeHead(403).end('Invalid path')
      return
    }
    const data = await readFile(file)
    served.push(url.pathname)
    serverRequests.push({ path: url.pathname, status: 200 })
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data)
  } catch {
    serverRequests.push({ path: new URL(request.url ?? '/', 'http://localhost').pathname, status: 404 })
    response.writeHead(404).end('Missing built asset')
  }
})
await new Promise((resolveReady, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolveReady)
})
const address = server.address()
assert.ok(address && typeof address !== 'string')
const origin = `http://127.0.0.1:${address.port}`
let browser

// Browser-native fill bounds and an independently enlarged image viewport are
// verification oracles, not adapter geometry. The latter detects pixels that a
// standalone SVG would otherwise clip at its own viewport, including strokes.
async function inspectStandalone(page, serialized) {
  return page.evaluate(async (source) => {
    const documentSvg = new DOMParser().parseFromString(source, 'image/svg+xml')
    if (documentSvg.querySelector('parsererror')) throw new Error('Invalid standalone SVG XML')
    const svg = documentSvg.documentElement
    document.body.appendChild(svg)
    const box = svg.getBBox()
    const nativeBounds = { minX: box.x, minY: box.y, maxX: box.x + box.width, maxY: box.y + box.height }
    const viewport = svg.viewBox.baseVal
    const viewBox = { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height }
    if (!(viewBox.width > 0 && viewBox.height > 0)) throw new Error('Raster fixture must have nonempty geometry')
    const geometryInside = nativeBounds.minX >= viewBox.x - 1e-6
      && nativeBounds.minY >= viewBox.y - 1e-6
      && nativeBounds.maxX <= viewBox.x + viewBox.width + 1e-6
      && nativeBounds.maxY <= viewBox.y + viewBox.height + 1e-6
    const width = Math.max(1, Math.ceil(viewBox.width * 0.128))
    const height = Math.max(1, Math.ceil(viewBox.height * 0.128))
    const guard = 128
    if (width + 2 * guard > 4096 || height + 2 * guard > 4096) throw new Error('Raster fixture exceeds bounded canvas size')
    // Explicit image dimensions and preserveAspectRatio keep the two rasters at
    // exactly the same user-unit scale and integer-pixel translation. No page
    // CSS or overflow behavior is used, and every original drawable is retained.
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.setAttribute('preserveAspectRatio', 'none')
    const serializer = new XMLSerializer()
    const originalSource = serializer.serializeToString(svg)
    const expanded = svg.cloneNode(true)
    const padX = guard * viewBox.width / width
    const padY = guard * viewBox.height / height
    expanded.setAttribute('viewBox', [viewBox.x - padX, viewBox.y - padY,
      viewBox.width + 2 * padX, viewBox.height + 2 * padY].join(' '))
    expanded.setAttribute('width', String(width + 2 * guard))
    expanded.setAttribute('height', String(height + 2 * guard))
    const referenceSource = serializer.serializeToString(expanded)
    svg.remove()
    const load = async (xml) => {
      const image = new Image()
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
      await image.decode()
      return image
    }
    const [image, referenceImage] = await Promise.all([load(originalSource), load(referenceSource)])
    const raster = (image, padded) => {
      const canvas = document.createElement('canvas')
      canvas.width = width + 2 * guard
      canvas.height = height + 2 * guard
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas image verification unavailable')
      if (padded) context.drawImage(image, guard, guard, width, height)
      else context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return { canvas, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data }
    }
    const original = raster(image, true)
    const reference = raster(referenceImage, false)
    let paintedPixels = 0
    let outsideInkPixels = 0
    let lostInkPixels = 0
    for (let y = 0; y < reference.canvas.height; y++) {
      for (let x = 0; x < reference.canvas.width; x++) {
        const index = 4 * (y * reference.canvas.width + x)
        const alpha = reference.pixels[index + 3]
        if (alpha > 20) {
          paintedPixels++
          if (x < guard || x >= guard + width || y < guard || y >= guard + height) outsideInkPixels++
        }
        // A small channel tolerance permits harmless raster roundoff while
        // preserving sensitivity to missing antialiased glyph edges.
        if (alpha > original.pixels[index + 3] + 8) lostInkPixels++
      }
    }
    return {
      geometryInside, nativeBounds, viewBox, paintedPixels, outsideInkPixels, lostInkPixels,
      width: reference.canvas.width, height: reference.canvas.height,
      png: original.canvas.toDataURL('image/png'), referencePng: reference.canvas.toDataURL('image/png'),
    }
  }, serialized)
}

async function installPublicService(page) {
  await page.evaluate(async ({ adapterUrl }) => {
    const adapterModule = await import(adapterUrl)
    // Deliberately use the default production loader, with no injected engine,
    // font callback, worker factory, short timeout, or substituted import.
    const service = adapterModule.createLabelService({ measurement: adapterModule.createBrowserTextMeasurementProvider() })
    globalThis.__labelAssetSmoke = {
      adapterModule, service, originalService: service, originalPageUrl: location.href,
      settings: {
        font: { family: 'Times New Roman, Times, serif', sizePx: 20, weight: '400', style: 'normal', fontReadinessGeneration: 0 },
        tabSize: 4,
        lineGapEm: 0.2,
      },
    }
  }, { adapterUrl: origin + base + adapter.file })
}

// Context-level events include dedicated-worker imports. Only the exact
// scenario's intentional 503 is exempt; unrelated responses, failed requests,
// uncaught errors, and new external requests still fail the check.
async function isolatedBrowserScenario(name, expectedPath) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const blockedExternal = []
  const unexpected = []
  const expectedResponses = []
  const injectedRequests = new Set()
  const workers = []
  const navigations = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      blockedExternal.push(url.href)
      if (url.href !== 'https://www.googletagmanager.com/gtag/js?id=G-1ELW3Y7X1B') {
        unexpected.push(`Unexpected external request: ${url.href}`)
      }
      await route.abort('blockedbyclient')
    } else await route.continue()
  })
  context.on('request', (request) => {
    if (request.url() === origin + expectedPath && injectedFailure?.name === name && injectedFailure.active) {
      injectedRequests.add(request)
    }
  })
  context.on('response', (response) => {
    if (!response.url().startsWith(origin) || response.status() < 400) return
    const record = { url: response.url(), status: response.status() }
    if (record.url === origin + expectedPath && record.status === 503 && injectedRequests.has(response.request())) {
      expectedResponses.push(record)
    } else unexpected.push(`HTTP ${record.status} ${record.url}`)
  })
  context.on('requestfailed', (request) => {
    if (!request.url().startsWith(origin)) return
    // Chromium may report an HTTP module rejection as both response(503) and
    // requestfailed(ERR_ABORTED); allow only that exact server-injected request.
    if (injectedRequests.has(request) && request.url() === origin + expectedPath &&
      serverRequests.some((record) => record.path === expectedPath && record.scenario === name && record.status === 503)) return
    unexpected.push(`${request.failure()?.errorText} ${request.url()}`)
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => unexpected.push(`Uncaught page error: ${error.message}`))
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations.push(frame.url()) })
  page.on('worker', (worker) => {
    const evidence = { url: worker.url(), closed: false }
    workers.push(evidence)
    worker.on('close', () => { evidence.closed = true })
  })
  await page.goto(origin + base, { waitUntil: 'networkidle' })
  return { context, page, blockedExternal, unexpected, expectedResponses, workers, navigations }
}

async function inspectNativeFailureCaching() {
  const name = 'native-module-cache-capability'
  const scenario = await isolatedBrowserScenario(name, nativeProbePath)
  const failure = { name, path: nativeProbePath, active: true, hits: [] }
  try {
    injectedFailure = failure
    const first = await scenario.page.evaluate(async (url) => {
      try { await import(url); return { rejected: false } }
      catch (error) { return { rejected: true, error: String(error) } }
    }, origin + nativeProbePath)
    assert.equal(first.rejected, true, 'Native-cache capability fixture must actually fail its first import')
    assert.equal(failure.hits.length, 1, 'Native-cache capability fixture must reach the server exactly once')
    failure.active = false
    const requestsBeforeRetry = serverRequests.length
    const second = await scenario.page.evaluate(async (url) => {
      try { return { rejected: false, recovered: (await import(url)).recovered } }
      catch (error) { return { rejected: true, error: String(error) } }
    }, origin + nativeProbePath)
    const retriedRequests = serverRequests.slice(requestsBeforeRetry).filter((record) => record.path === nativeProbePath)
    assert.deepEqual(scenario.unexpected, [], 'Native cache capability probe must not conceal unrelated errors')
    const cachesFailedNativeImports = second.rejected && retriedRequests.length === 0
    if (!cachesFailedNativeImports) {
      assert.equal(second.recovered, true, 'Browser must either retain the native failure or actually fetch the restored module')
      assert.ok(retriedRequests.some((record) => record.status === 200))
    }
    return { cachesFailedNativeImports, failedUrl: origin + nativeProbePath,
      injectedFailures: failure.hits, first, second, restoredResourceRequests: retriedRequests }
  } finally {
    injectedFailure = undefined
    await scenario.context.close()
  }
}

async function checkNativeRecovery({ name, chunk, source, warmup }) {
  const path = base + chunk.file
  const requestStart = serverRequests.length
  const scenario = await isolatedBrowserScenario(name, path)
  const { page } = scenario
  const failure = { name, path, active: true, hits: [] }
  try {
    await installPublicService(page)
    const convert = (input) => page.evaluate(async (source) => {
      const { service, settings } = globalThis.__labelAssetSmoke
      // This is an independent test watchdog, not the service's failure policy.
      let timer
      try {
        return await Promise.race([service.convert(source, settings), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Public conversion did not settle within 15 seconds')), 15_000)
        })])
      } finally { clearTimeout(timer) }
    }, input)
    if (warmup) {
      const ordinary = await convert('$x$')
      assert.equal(ordinary.kind, 'success', `${name}: ordinary mathematics must work before the font failure`)
    }
    assert.ok(!serverRequests.slice(requestStart).some((record) => record.path === path),
      `${name}: intended module must be cold before failure injection (preload/cache could mask the regression)`)
    const externalBefore = scenario.blockedExternal.length
    const navigationBefore = scenario.navigations.length
    const workersBefore = scenario.workers.length
    injectedFailure = failure
    const started = Date.now()
    const fallback = await convert(source)
    const elapsedMs = Date.now() - started
    assert.ok(elapsedMs < 15_000, `${name}: public resource failure exceeded its finite settlement window`)
    assert.ok(failure.hits.length > 0, `${name}: intended native asset request was never failed`)
    assert.equal(fallback.kind, 'fallback', `${name}: native request failure must affect conversion: ${JSON.stringify(fallback)}`)
    assert.equal(fallback.reason, 'resource-error', `${name}: actual resource failure must retain its category`)
    assert.equal(fallback.source, source, `${name}: fallback must retain delimiters, spaces, tabs, and physical CRLF`)
    assert.ok(!('runs' in fallback) && !('layout' in fallback), `${name}: no earlier run geometry survives failure`)
    const plainDuringFailure = await convert('  領域 A\t🙂\r\n B  ')
    assert.equal(plainDuringFailure.kind, 'success', `${name}: native math failure must leave plain labels usable`)
    const failedWorkerCount = scenario.workers.length
    assert.ok(failedWorkerCount > 0, `${name}: default production worker must actually be exercised`)
    // Restoring the exact URL does not clear any browser cache. Only the public
    // invalidation and production loader may replace an internal execution realm.
    failure.active = false
    const restoredRequestStart = serverRequests.length
    const recovery = await page.evaluate(async (input) => {
      const state = globalThis.__labelAssetSmoke
      const { service, settings } = state
      service.invalidate()
      const first = service.convert(input, settings)
      const second = service.convert(input, settings)
      const [result, equivalent] = await Promise.all([first, second])
      const cached = await service.convert(input, settings)
      const deepFrozen = (value) => value === null || typeof value !== 'object' ||
        (Object.isFrozen(value) && Object.values(value).every(deepFrozen))
      return {
        result, sameService: service === state.originalService, samePage: location.href === state.originalPageUrl,
        coalesced: first === second && result === equivalent, reusedImmutable: result === cached && deepFrozen(result),
        stats: service.stats(),
      }
    }, source)
    assert.equal(recovery.result.kind, 'success', `${name}: same-page recovery failed: ${JSON.stringify(recovery.result)}`)
    assert.equal(recovery.result.source, source)
    assert.ok(recovery.result.runs.some((run) => run.kind === 'math' && run.geometry.pathCount > 0))
    assert.equal(recovery.sameService, true, `${name}: service must not be replaced`)
    assert.equal(recovery.samePage, true, `${name}: page must not be navigated`)
    assert.equal(scenario.navigations.length, navigationBefore, `${name}: no reload or navigation is permitted`)
    assert.equal(recovery.coalesced, true, `${name}: equivalent requests must coalesce after recovery`)
    assert.equal(recovery.reusedImmutable, true, `${name}: recovered success remains immutable and reusable`)
    assert.ok(recovery.result.generation > fallback.generation)
    assert.equal(recovery.stats.pending, 0)
    assert.equal(recovery.stats.unsettledTasks, 0)
    const restoredRequests = serverRequests.slice(restoredRequestStart).filter((record) => record.path === path)
    assert.ok(restoredRequests.some((record) => record.status === 200), `${name}: same failed URL must actually load after recovery`)
    assert.ok(scenario.workers.length > failedWorkerCount, `${name}: native module state must be replaced in a new production realm`)
    // Playwright's close event can follow the already settled protocol reply.
    // Wait for that observed lifecycle event with a short independent deadline.
    const abandonedWorkers = scenario.workers.slice(0, failedWorkerCount)
    const closeDeadline = Date.now() + 2_000
    while (abandonedWorkers.some((worker) => !worker.closed) && Date.now() < closeDeadline) {
      await new Promise((resolveTick) => setTimeout(resolveTick, 10))
    }
    assert.ok(abandonedWorkers.every((worker) => worker.closed),
      `${name}: abandoned production workers must be terminated`)
    assert.equal((await convert('$z+1$')).kind, 'success', `${name}: later valid math remains usable`)
    assert.equal((await convert(' plain\ttext\r\n後 ')).kind, 'success', `${name}: later ordinary text remains usable`)
    assert.deepEqual(scenario.unexpected, [], `${name}: expected injection must not hide unrelated browser failures`)
    assert.equal(scenario.blockedExternal.length, externalBefore, `${name}: conversion must not attempt external requests`)
    return {
      name, failedUrl: origin + path, source, elapsedMs, injectedFailures: failure.hits,
      observedFailedResponses: scenario.expectedResponses, fallback,
      recovery: { kind: recovery.result.kind, source: recovery.result.source, generation: recovery.result.generation,
        sameService: recovery.sameService, samePage: recovery.samePage, coalesced: recovery.coalesced,
        reusedImmutable: recovery.reusedImmutable, stats: recovery.stats },
      restoredRequests, workersBefore, workers: scenario.workers.map((worker) => ({ ...worker })),
    }
  } finally {
    injectedFailure = undefined
    await scenario.context.close()
  }
}

try {
  browser = await chromium.launch({
    headless: true,
    timeout: 30_000,
    ...(process.env.STZ_BROWSER_EXECUTABLE ? { executablePath: process.env.STZ_BROWSER_EXECUTABLE } : {}),
  })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const blockedExternal = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      blockedExternal.push(url.href)
      await route.abort('blockedbyclient')
    } else {
      await route.continue()
    }
  })
  const page = await context.newPage()
  const failures = []
  context.on('response', (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })
  context.on('requestfailed', (request) => {
    if (request.url().startsWith(origin)) failures.push(`${request.failure()?.errorText} ${request.url()}`)
  })
  page.on('pageerror', (error) => failures.push(`Uncaught page error: ${error.message}`))
  await page.goto(origin + base, { waitUntil: 'networkidle' })
  assert.ok(await page.locator('#root').evaluate((root) => root.childElementCount > 0), 'Built application mounts under its configured base')
  assert.ok(blockedExternal.every((url) => url === 'https://www.googletagmanager.com/gtag/js?id=G-1ELW3Y7X1B'),
    'Only the unchanged application analytics request may be blocked during startup; all other external requests are unexpected')
  const initialExternalCount = blockedExternal.length

  await installPublicService(page)
  const beforePlain = served.length
  const plain = await page.evaluate(async () => {
    const { service, settings } = globalThis.__labelAssetSmoke
    return [await service.convert('領域 A & < B \t🙂', settings), await service.convert('prefix $x', settings)]
  })
  assert.equal(plain[0].kind, 'success', JSON.stringify(plain[0]))
  assert.equal(plain[1].kind, 'fallback')
  assert.equal(plain[1].source, 'prefix $x')
  assert.equal(served.length, beforePlain, 'Plain and parser-rejected labels must not load engine or font assets')

  const convert = (source) => page.evaluate(async (input) => {
    const { service, settings } = globalThis.__labelAssetSmoke
    return service.convert(input, settings)
  }, source)
  const basic = await convert('$x$')
  assert.equal(basic.kind, 'success', JSON.stringify(basic))
  assert.ok(basic.runs[0].geometry.pathCount > 0)
  const afterBasic = served.length
  const additional = await convert('$\\mathbb{R}+\\mathfrak{g}+\\mathcal{F}$')
  assert.equal(additional.kind, 'success', JSON.stringify(additional))
  const additionalFontAssets = served.slice(afterBasic).filter((path) => /\.js$/u.test(path))
  assert.ok(additionalFontAssets.length > 0, 'Probe must exercise additional font data after basic math; zero requests is not proof of lazy font loading')

  const matrixSource = 'Map $\\frac{1}{\\sqrt{x_i^2+1}}$\n$$\\begin{matrix}\na & b \\\\\nc & d\n\\end{matrix}$$'
  const matrix = await convert(matrixSource)
  assert.equal(matrix.kind, 'success', JSON.stringify(matrix))
  assert.equal(matrix.source, matrixSource)
  assert.equal(matrix.layout.lines.length, 2)
  for (const metric of Object.values(matrix.layout.metrics)) assert.ok(Number.isFinite(metric))
  const failedSource = '  $x$ then $\\undefinedSmokeMacro$\t\n'
  const failed = await convert(failedSource)
  assert.equal(failed.kind, 'fallback')
  assert.equal(failed.source, failedSource)
  const colored = await convert('${\\color{red}x}+\\sqrt{y}+\\frac{1}{2}$')
  assert.equal(colored.kind, 'success', JSON.stringify(colored))

  const overflowFixtures = [
    ['rlap', '$\\rlap{x}$'], ['llap', '$\\llap{x}$'], ['smash', '$\\smash{x}$'],
    ['smash-descenders', '$\\smash{x_{gj}}$'], ['negative-thin-space', '$\\!x$'],
    ['trailing-negative-space', '$x\\!$'], ['negative-kern', '$\\kern-.2em x$'],
    ['negative-mkern', '$\\mkern-3mu x$'], ['negative-hspace', '$\\hspace{-.2em}x$'],
    ['nested-overhang', '$a+{\\rlap{\\smash{x_{gj}}}}y$'],
    ['following-run', '$\\rlap{x}$Z'],
  ]
  const overflowResults = []
  for (const [name, source] of overflowFixtures) {
    const result = await convert(source)
    assert.equal(result.kind, 'success', `${name}: ${JSON.stringify(result)}`)
    assert.equal(result.source, source)
    if (name === 'rlap' || name === 'llap' || name === 'following-run') {
      assert.equal(result.runs[0].geometry.metrics.width, 0, `${name}: overlapping ink must not increase logical advance`)
    }
    if (name === 'following-run') {
      assert.equal(result.layout.placements[1].x, 0, 'Text following a zero-advance formula retains its intended origin')
    }
    overflowResults.push({ name, result })
  }
  const rejectedSource = ' \t$x$ then \\(\\kern-1em x\\)\n  '
  const rejected = await convert(rejectedSource)
  assert.equal(rejected.kind, 'fallback', JSON.stringify(rejected))
  assert.equal(rejected.source, rejectedSource)
  assert.equal(rejected.reason, 'invalid-metrics')
  assert.ok(!('runs' in rejected) && !('layout' in rejected), 'No earlier successful geometry survives whole-source rejection')
  const recovered = await convert('$z+1$')
  assert.equal(recovered.kind, 'success', JSON.stringify(recovered))

  const standalone = await page.evaluate((geometry) => {
    return globalThis.__labelAssetSmoke.adapterModule.serializeMathSvg(geometry, '#2468ac')
  }, colored.runs[0].geometry)
  assert.ok(!/\s(?:class|data-[\w-]+)=/u.test(standalone))
  assert.ok(!/(?:href=|url\(|currentColor|<foreignObject|<script)/iu.test(standalone))
  // Render as an SVG image with no page styles or HTML descendants. Pixel counts
  // establish that foreground and formula-internal paint survive portability.
  const raster = await page.evaluate(async (svg) => {
    const image = new Image()
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, image.naturalWidth * 4)
    canvas.height = Math.max(1, image.naturalHeight * 4)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas image verification unavailable')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let red = 0
    let blue = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 20) continue
      if (pixels[index] > pixels[index + 2] * 1.5) red++
      if (pixels[index + 2] > pixels[index] * 1.5) blue++
    }
    return { red, blue, width: canvas.width, height: canvas.height, png: canvas.toDataURL('image/png') }
  }, standalone)
  assert.ok(raster.red > 0 && raster.blue > 0, `Standalone paint was lost: ${JSON.stringify({ ...raster, png: undefined })}`)

  // A separate blank page ensures the native geometry probe has no application
  // stylesheet; all raster probes load the serialized formulas as SVG images.
  const rasterPage = await context.newPage()
  await rasterPage.goto('about:blank')
  const serialize = (geometry) => page.evaluate((input) =>
    globalThis.__labelAssetSmoke.adapterModule.serializeMathSvg(input, '#2468ac'), geometry)
  const containmentResults = []
  const controls = [
    { name: 'ordinary', result: basic }, { name: 'colored-fraction-radical', result: colored },
    { name: 'matrix', result: matrix },
  ]
  for (const { name, result } of [...controls, ...overflowResults]) {
    for (const [runIndex, run] of result.runs.entries()) {
      if (run.kind !== 'math') continue
      const svg = await serialize(run.geometry)
      const inspected = await inspectStandalone(rasterPage, svg)
      const { png, referencePng, ...evidence } = inspected
      assert.ok(evidence.geometryInside, `${name}: native fill geometry escapes portable viewport: ${JSON.stringify(evidence)}`)
      const placement = result.layout.placements.find((entry) => entry.kind === 'math' && entry.runIndex === runIndex)
      assert.ok(placement, `${name}: mathematical placement is missing`)
      const { nativeBounds } = evidence
      if (name === 'rlap') {
        assert.ok(nativeBounds.maxX / 1000 - run.geometry.offsetX > run.geometry.metrics.width,
          'rlap fixture must actually exercise ink beyond its logical advance')
      } else if (name === 'llap') {
        assert.ok(nativeBounds.minX / 1000 - run.geometry.offsetX < 0,
          'llap fixture must actually exercise leftward ink')
      } else if (name === 'smash-descenders') {
        assert.ok(nativeBounds.minY < 0 && nativeBounds.maxY > 0,
          'Smashed-descender fixture must retain ink on both sides of the baseline')
      }
      const placedBounds = {
        minX: placement.x - run.geometry.offsetX + nativeBounds.minX / 1000,
        maxX: placement.x - run.geometry.offsetX + nativeBounds.maxX / 1000,
        minY: placement.baseline + nativeBounds.minY / 1000,
        maxY: placement.baseline + nativeBounds.maxY / 1000,
      }
      const bounds = result.layout.bounds
      assert.ok(bounds.minX <= placedBounds.minX + 1e-9 && bounds.maxX >= placedBounds.maxX - 1e-9
        && bounds.minY <= placedBounds.minY + 1e-9 && bounds.maxY >= placedBounds.maxY - 1e-9,
      `${name}: native ink escapes composed label bounds: ${JSON.stringify({ bounds, placedBounds })}`)
      assert.ok(evidence.paintedPixels > 0, `${name}: empty raster is not containment evidence`)
      assert.equal(evidence.outsideInkPixels, 0, `${name}: reference raster exposes ink outside portable viewport: ${JSON.stringify(evidence)}`)
      assert.equal(evidence.lostInkPixels, 0, `${name}: standalone viewport clips ink: ${JSON.stringify(evidence)}`)
      containmentResults.push({ name: `${name}-${runIndex}`, svg, png, referencePng,
        advance: run.geometry.metrics.width, offsetX: run.geometry.offsetX, placedBounds, labelBounds: bounds, ...evidence })
    }
  }
  // Deliberately crop a genuine glyph without deleting any paths. Both oracles
  // must detect the loss; nonempty or colored-pixel checks alone would pass it.
  const cropped = await rasterPage.evaluate((source) => {
    const documentSvg = new DOMParser().parseFromString(source, 'image/svg+xml')
    const svg = documentSvg.documentElement
    const box = svg.viewBox.baseVal
    svg.setAttribute('viewBox', [box.x, box.y, box.width / 4, box.height].join(' '))
    return new XMLSerializer().serializeToString(svg)
  }, await serialize(basic.runs[0].geometry))
  const sensitivity = await inspectStandalone(rasterPage, cropped)
  assert.equal(sensitivity.geometryInside, false, 'Native oracle must detect the deliberately cropped real glyph')
  assert.ok(sensitivity.outsideInkPixels > 0 && sensitivity.lostInkPixels > 0,
    'Raster oracle must detect the deliberately cropped real glyph')
  assert.deepEqual(failures, [], 'All requested built assets must return successfully under the configured base')
  assert.equal(blockedExternal.length, initialExternalCount, 'Label conversion must not attempt external network access')

  const additionalFontChunk = fontChunks.find((chunk) => additionalFontAssets.includes(base + chunk.file))
  assert.ok(additionalFontChunk, 'Additional-font fixture must be an observed lazy font module from the emitted worker graph')
  const nativeFailureCaching = await inspectNativeFailureCaching()
  const nativeRecovery = []
  for (const fixture of [
    { name: 'runtime-native-import', chunk: runtimeChunk, source: '  \t$x$ then \\(y+1\\)\r\n trailing  ' },
    { name: 'additional-font-native-import', chunk: additionalFontChunk,
      source: '  \t$x$ then \\(\\mathbb{R}+\\mathfrak{g}+\\mathcal{F}\\)\t\r\n trailing  ', warmup: true },
    { name: 'transitive-native-import', chunk: transitiveChunk, source: '  \t$x$ then \\(y+1\\)\r\n trailing  ' },
  ]) nativeRecovery.push(await checkNativeRecovery(fixture))

  const nativeEvidence = { browser: await browser.version(), graph: graphEvidence,
    affectedBrowserRecoveryVerified: nativeFailureCaching.cachesFailedNativeImports,
    nativeFailureCaching, scenarios: nativeRecovery }

  if (process.env.STZ_SMOKE_ARTIFACT_DIR) {
    const output = resolve(process.env.STZ_SMOKE_ARTIFACT_DIR)
    await mkdir(output, { recursive: true })
    await writeFile(resolve(output, 'label-standalone.svg'), standalone)
    await writeFile(resolve(output, 'label-standalone.png'), Buffer.from(raster.png.split(',')[1], 'base64'))
    for (const { name, svg, png, referencePng } of containmentResults) {
      await writeFile(resolve(output, `${name}.svg`), svg)
      await writeFile(resolve(output, `${name}.png`), Buffer.from(png.split(',')[1], 'base64'))
      await writeFile(resolve(output, `${name}-reference.png`), Buffer.from(referencePng.split(',')[1], 'base64'))
    }
    await writeFile(resolve(output, 'containment-evidence.json'), JSON.stringify({
      fixtures: containmentResults.map(({ svg, png, referencePng, ...evidence }) => evidence),
      croppedOracle: { geometryInside: sensitivity.geometryInside, outsideInkPixels: sensitivity.outsideInkPixels,
        lostInkPixels: sensitivity.lostInkPixels },
    }, null, 2))
    await writeFile(resolve(output, 'native-retry-evidence.json'), JSON.stringify(nativeEvidence, null, 2))
  }
  console.log(JSON.stringify({
    result: nativeFailureCaching.cachesFailedNativeImports ? 'passed' : 'functional-checks-passed-affected-browser-unverified',
    browser: await browser.version(), base,
    checks: ['application-mount', 'lazy-plain-labels', 'real-math', 'additional-font-data', 'matrix-newlines',
      'complete-source-fallback', 'overflow-geometry', 'zero-advance-placement', 'negative-advance-fallback-recovery',
      'standalone-svg-paint', 'native-ink-containment', 'standalone-raster-containment', 'containment-oracle-sensitivity',
      'worker-graph-assets', 'native-failure-cache-capability', 'runtime-native-import-recovery',
      'additional-font-native-import-recovery', 'transitive-native-import-recovery'],
    nativeEvidence,
    additionalFontAssets, sameOriginAssets: new Set(served).size,
    blockedPreexistingExternalRequests: blockedExternal,
    standalonePixels: { red: raster.red, blue: raster.blue },
    containment: containmentResults.map(({ svg, png, referencePng, ...evidence }) => evidence),
    croppedOracle: { geometryInside: sensitivity.geometryInside, outsideInkPixels: sensitivity.outsideInkPixels,
      lostInkPixels: sensitivity.lostInkPixels },
  }, null, 2))
  if (!nativeFailureCaching.cachesFailedNativeImports) {
    console.error('Browser retries failed native imports itself: affected-browser recovery remains unverified (exit 2).')
    process.exitCode = 2
  }
} finally {
  await browser?.close()
  await new Promise((resolveClosed) => server.close(resolveClosed))
}
