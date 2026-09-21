import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'

const svgNamespace = 'http://www.w3.org/2000/svg'
const maxSide = 8192
const maxPixels = 16_777_216

/** Cover the entire measured SVG viewport, including its background edges.
 * Never shrink/scale the export or accept a clipped corner as evidence. */
export function standaloneSvgViewport(document) {
  assert.equal(document.root.localName, 'svg', 'Standalone root is SVG')
  assert.equal(document.root.namespace, svgNamespace)
  assert.deepEqual(document.parserErrors, [], 'Standalone XML parses without errors')
  const { bounds } = document.root
  assert.ok([bounds.x, bounds.y, bounds.width, bounds.height,
    document.viewport.width, document.viewport.height, document.devicePixelRatio,
    document.scroll.x, document.scroll.y].every(Number.isFinite), 'Capture measurements are finite')
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.width > 0 && bounds.height > 0,
    'The complete SVG must be reachable from the viewport origin')
  assert.ok(document.viewport.width > 0 && document.viewport.height > 0 && document.devicePixelRatio > 0)
  assert.deepEqual(document.scroll, { x: 0, y: 0 }, 'Standalone capture starts at the document origin')
  const viewport = {
    width: Math.ceil(Math.max(document.viewport.width, bounds.x + bounds.width + 16)),
    height: Math.ceil(Math.max(document.viewport.height, bounds.y + bounds.height + 16)),
  }
  assert.ok(viewport.width <= maxSide && viewport.height <= maxSide && viewport.width * viewport.height <= maxPixels,
    'Complete SVG exceeds the bounded screenshot budget')
  return viewport
}

export async function measureStandaloneSvg(page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const bounds = root.getBoundingClientRect()
    return {
      url: location.href, contentType: document.contentType, readyState: document.readyState,
      bodyExists: document.body !== null,
      htmlBodyExists: document.body?.namespaceURI === 'http://www.w3.org/1999/xhtml',
      parserErrors: [...document.querySelectorAll('parsererror')].map((node) => node.textContent?.slice(0, 2000)),
      root: { localName: root.localName, namespace: root.namespaceURI,
        width: root.getAttribute('width'), height: root.getAttribute('height'), viewBox: root.getAttribute('viewBox'),
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } },
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { x: scrollX, y: scrollY }, devicePixelRatio,
    }
  })
}

/** Retain observations BEFORE image work. SVG XML has no HTML body, so
 * Playwright's fullPage sizing can wait forever after font readiness. One
 * viewport adjustment and one explicitly bounded capture suffice; no retry in
 * the failure path. Font readiness and the SVG document are left unchanged. */
export async function captureStandaloneSvg(page, path, persist) {
  const capture = { status: 'pending', requestedPath: path, fileExists: false,
    options: { path, fullPage: false, scale: 'css', timeout: 5000 }, measurements: [] }
  try {
    await persist(capture)
    const initial = await measureStandaloneSvg(page)
    capture.measurements.push(initial)
    await persist(capture)
    const viewport = standaloneSvgViewport(initial)
    if (viewport.width !== initial.viewport.width || viewport.height !== initial.viewport.height) {
      await page.setViewportSize(viewport)
      capture.measurements.push(await measureStandaloneSvg(page))
      await persist(capture)
    }
    const measured = capture.measurements.at(-1)
    const required = standaloneSvgViewport(measured)
    assert.ok(required.width <= measured.viewport.width && required.height <= measured.viewport.height,
      'Resized viewport must cover the complete SVG without further resizing')
    capture.coverage = { completeRoot: true, bounds: measured.root.bounds, viewport: measured.viewport }
    await persist(capture)
    await page.screenshot(capture.options)
    const bytes = await readFile(path)
    assert.ok(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'Capture wrote a real PNG')
    const png = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length }
    assert.deepEqual({ width: png.width, height: png.height }, measured.viewport, 'PNG covers the measured CSS viewport')
    Object.assign(capture, { status: 'saved', fileExists: true, retainedPath: path, png })
    await persist(capture)
    return capture
  } catch (error) {
    capture.status = 'failed'
    delete capture.retainedPath
    capture.fileExists = await stat(path).then((file) => file.isFile(), () => false)
    capture.error = { message: error.message, stack: error.stack }
    await persist(capture).catch(() => {})
    throw error
  }
}
