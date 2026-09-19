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
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname, sep, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

const base = '/stratified-tikz/'
const dist = resolve('dist')
const manifest = JSON.parse(await readFile(resolve(dist, '.vite/manifest.json'), 'utf8'))
const adapter = Object.values(manifest).find((entry) => entry.isEntry && entry.src === 'src/rendering/labels/labelService.ts')
assert.ok(adapter, 'Build manifest must include the independently testable label adapter entry')

const playwrightModule = process.env.STZ_PLAYWRIGHT_MODULE ?? 'playwright'
let chromium
try {
  ;({ chromium } = await import(isAbsolute(playwrightModule) ? pathToFileURL(playwrightModule).href : playwrightModule))
} catch (error) {
  throw new Error('Browser check unavailable: provide Playwright through STZ_PLAYWRIGHT_MODULE (no check has passed)', { cause: error })
}

const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
}
const served = []
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith(base)) {
      response.writeHead(404).end('Outside configured application base')
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
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data)
  } catch {
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
  page.on('response', (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(origin)) failures.push(`${request.failure()?.errorText} ${request.url()}`)
  })
  await page.goto(origin + base, { waitUntil: 'networkidle' })
  assert.ok(await page.locator('#root').evaluate((root) => root.childElementCount > 0), 'Built application mounts under its configured base')
  const initialExternalCount = blockedExternal.length

  await page.evaluate(async ({ adapterUrl }) => {
    const adapterModule = await import(adapterUrl)
    const service = adapterModule.createLabelService({ measurement: adapterModule.createBrowserTextMeasurementProvider() })
    globalThis.__labelAssetSmoke = {
      adapterModule,
      service,
      settings: {
        font: { family: 'Times New Roman, Times, serif', sizePx: 20, weight: '400', style: 'normal', fontReadinessGeneration: 0 },
        tabSize: 4,
        lineGapEm: 0.2,
      },
    }
  }, { adapterUrl: origin + base + adapter.file })
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
  assert.deepEqual(failures, [], 'All requested built assets must return successfully under the configured base')
  assert.equal(blockedExternal.length, initialExternalCount, 'Label conversion must not attempt external network access')

  if (process.env.STZ_SMOKE_ARTIFACT_DIR) {
    const output = resolve(process.env.STZ_SMOKE_ARTIFACT_DIR)
    await mkdir(output, { recursive: true })
    await writeFile(resolve(output, 'label-standalone.svg'), standalone)
    await writeFile(resolve(output, 'label-standalone.png'), Buffer.from(raster.png.split(',')[1], 'base64'))
  }
  console.log(JSON.stringify({
    result: 'passed', browser: await browser.version(), base,
    checks: ['application-mount', 'lazy-plain-labels', 'real-math', 'additional-font-data', 'matrix-newlines', 'complete-source-fallback', 'standalone-svg-paint'],
    additionalFontAssets, sameOriginAssets: new Set(served).size,
    blockedPreexistingExternalRequests: blockedExternal,
    standalonePixels: { red: raster.red, blue: raster.blue },
  }, null, 2))
} finally {
  await browser?.close()
  await new Promise((resolveClosed) => server.close(resolveClosed))
}
