import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { capturePointLayoutStandalone } from '../../scripts/checkPointLayoutAnchors.mjs'

// Synthetic caller controls copy a complete retained PNG; they do not establish
// a native download/reopening pass. The fresh parent browser owns acceptance.
const fixturePng = new URL('../fixtures/dash-cap-native-endpoints/point-paint-dash-cap-mechanism-positive-before-corner.raster.png', import.meta.url)

async function setup(context, background = 'transparent') {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-layout-standalone-caller-'))
  context.after(() => rm(artifactDir, { recursive: true, force: true }))
  const scenario = `point-layout-pending-${background}-${background === 'transparent' ? 'edit' : 'load'}`
  const svgPath = join(artifactDir, `${scenario}.svg`), fileUrl = pathToFileURL(svgPath).href
  const details = { scenario, group: 'point-node-layout-anchors-combined', background, svgPath, fileUrl,
    pageErrors: [], expected: [{ source: '$F$', rendered: { contour: { tag: 'path', attributes: { d: 'M1 2' } }, nodeTransform: 'translate(0 0)', bodyTransform: 'translate(1 2)' } }],
    click: { snapshot: { points: [{ source: '$F$', status: 'pending', style: { layout: { anchor: 'base' } } }] } },
    pending: { contour: { tag: 'circle', attributes: { r: '10' } } }, outputs: { standalone: '\\node {$F$};', inlineMath: '\\node {$F$};' }, xml: '<svg/>' }
  const measurements = { url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', bodyExists: false, htmlBodyExists: false,
    parserErrors: [], root: { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360', bounds: { x: 0, y: 0, width: 520, height: 360 } },
    viewport: { width: 2048, height: 2048 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 2 }
  const reopened = [{ source: '$F$', shape: 'circle', ...details.expected[0].rendered, glyphs: 6, errors: 0 }]
  const document = { root: { ...measurements.root }, forbiddenCount: 0, externalReferences: [], backgroundCount: background === 'white' ? 1 : 0 }
  delete document.root.bounds
  const artifactPath = join(artifactDir, `${scenario}-standalone.json`)
  const listeners = new Map(), calls = { goto: [], screenshots: [], close: 0, observed: [], validations: 0 }
  const standalone = {
    on(type, listener) { assert.equal(listeners.has(type), false); listeners.set(type, listener) },
    off(type, listener) { assert.equal(listeners.get(type), listener); listeners.delete(type) },
    async goto(url) { calls.goto.push(url); listeners.get('request')({ url: () => url }) },
    async evaluate(callback) { return callback.name === 'settleStandaloneDocument' ? undefined : structuredClone(measurements) },
    async setViewportSize() { assert.fail('Existing viewport already covers the complete root') },
    async screenshot(options) {
      calls.screenshots.push(structuredClone(options))
      const before = JSON.parse(await readFile(artifactPath, 'utf8'))
      assert.equal(before.result, 'observed'); assert.equal(before.capture.status, 'pending')
      assert.deepEqual(before.reopened, reopened); assert.deepEqual(before.expected, details.expected)
      assert.deepEqual(before.click, details.click); assert.deepEqual(before.pending, details.pending)
      assert.deepEqual(before.outputs, details.outputs); assert.deepEqual(before.document, document)
      assert.deepEqual(before.capture.before, measurements); assert.equal(before.capture.coverage.completeRoot, true)
      await copyFile(fixturePng, options.path)
    },
    async close() { calls.close++ },
  }
  const args = { standalone, artifactDir, details, reopen: async () => ({ reopened, document }),
    assertReopened: async () => {
      calls.validations++
      const retained = JSON.parse(await readFile(artifactPath, 'utf8'))
      assert.equal(retained.result, 'observed'); assert.equal(retained.capture, undefined)
      assert.deepEqual(retained.reopened, reopened); assert.deepEqual(retained.requests, [fileUrl])
      assert.deepEqual(retained.standaloneErrors, []); assert.deepEqual(retained.outputs, details.outputs)
    },
    observe: async (candidate) => calls.observed.push(structuredClone(candidate)) }
  return { args, calls, listeners, details, artifactPath, measurements, reopened, document }
}

for (const background of ['transparent', 'white']) test(`layout ${background} reopening persists raw candidate before one complete-root image`, async (context) => {
  const fixture = await setup(context, background)
  const result = await capturePointLayoutStandalone(fixture.args)
  const retained = JSON.parse(await readFile(fixture.artifactPath, 'utf8'))
  assert.deepEqual(fixture.calls.goto, [fixture.details.fileUrl])
  assert.equal(fixture.calls.validations, 1); assert.equal(fixture.calls.close, 1); assert.equal(fixture.listeners.size, 0)
  assert.equal(fixture.calls.observed.length, 1); assert.equal(fixture.calls.observed[0].result, 'observed')
  assert.equal(fixture.calls.observed[0].capture, undefined)
  assert.deepEqual(fixture.calls.screenshots, [{ path: join(fixture.args.artifactDir, `${fixture.details.scenario}.png`), fullPage: false, scale: 'css', timeout: 5000 }])
  assert.equal(result.capture.status, 'saved'); assert.equal(retained.result, 'observed')
  assert.deepEqual(retained.capture.before, fixture.measurements); assert.deepEqual(retained.capture.after, fixture.measurements)
  assert.equal(retained.capture.before.bodyExists, false)
  assert.deepEqual(retained.capture.png, { width: 2048, height: 2048, bytes: (await readFile(fixturePng)).length })
  assert.deepEqual(retained.capture, result.capture); assert.deepEqual(retained.document, fixture.document)
})

test('layout assertion failure retains reopening evidence and owns subsequent close failure without an image', async (context) => {
  const fixture = await setup(context), primary = new Error('layout contour mismatch')
  const assertPersisted = fixture.args.assertReopened
  fixture.args.assertReopened = async () => { await assertPersisted(); throw primary }
  fixture.args.standalone.close = async () => { fixture.calls.close++; throw new Error('secondary standalone close') }
  await assert.rejects(capturePointLayoutStandalone(fixture.args), (error) => error === primary)
  const retained = JSON.parse(await readFile(fixture.artifactPath, 'utf8'))
  assert.deepEqual(retained.reopened, fixture.reopened); assert.equal(retained.error.message, primary.message)
  assert.equal(retained.result, 'observed'); assert.equal(retained.capture, undefined)
  assert.equal(retained.cleanupErrors[0].message, 'secondary standalone close')
  assert.equal(fixture.calls.screenshots.length, 0); assert.equal(fixture.calls.close, 1); assert.equal(fixture.listeners.size, 0)
})

test('layout screenshot error persists failed capture and keeps the original error through close diagnostics', async (context) => {
  const fixture = await setup(context), primary = new Error('native image capture failure')
  fixture.args.standalone.screenshot = async (options) => { fixture.calls.screenshots.push(options); throw primary }
  fixture.args.standalone.close = async () => { fixture.calls.close++; throw new Error('secondary close') }
  await assert.rejects(capturePointLayoutStandalone(fixture.args), (error) => error === primary)
  const retained = JSON.parse(await readFile(fixture.artifactPath, 'utf8'))
  assert.deepEqual(retained.reopened, fixture.reopened); assert.deepEqual(retained.expected, fixture.details.expected)
  assert.equal(retained.capture.status, 'failed'); assert.equal(retained.capture.fileExists, false)
  assert.deepEqual(retained.capture.before, fixture.measurements); assert.equal(retained.capture.error.message, primary.message)
  assert.equal(retained.error.message, primary.message); assert.equal(retained.cleanupErrors.length, 1)
  assert.equal(fixture.calls.screenshots.length, 1); assert.equal(fixture.calls.close, 1); assert.equal(fixture.listeners.size, 0)
})

test('layout screenshot error survives secondary evidence storage and cleanup errors with no retry', async (context) => {
  const fixture = await setup(context), primary = new Error('first screenshot failure')
  const beforePath = join(fixture.args.artifactDir, 'raw-before-image.json')
  fixture.args.standalone.screenshot = async (options) => {
    fixture.calls.screenshots.push(options)
    await rename(fixture.artifactPath, beforePath); await mkdir(fixture.artifactPath)
    throw primary
  }
  fixture.args.standalone.close = async () => { fixture.calls.close++; throw new Error('cleanup failure') }
  await assert.rejects(capturePointLayoutStandalone(fixture.args), (error) => error === primary)
  const before = JSON.parse(await readFile(beforePath, 'utf8'))
  assert.deepEqual(before.reopened, fixture.reopened); assert.equal(before.capture.status, 'pending')
  assert.deepEqual(before.capture.before, fixture.measurements)
  assert.ok(fixture.details.pageErrors.some((error) => error.includes('failure evidence')))
  assert.equal(fixture.calls.screenshots.length, 1); assert.equal(fixture.calls.close, 1); assert.equal(fixture.listeners.size, 0)
})

test('layout close failure after a valid image still fails instead of publishing terminal success', async (context) => {
  const fixture = await setup(context), primary = new Error('standalone close failed')
  fixture.args.standalone.close = async () => { fixture.calls.close++; throw primary }
  await assert.rejects(capturePointLayoutStandalone(fixture.args), (error) => error === primary)
  const retained = JSON.parse(await readFile(fixture.artifactPath, 'utf8'))
  assert.equal(retained.capture.status, 'saved'); assert.equal(retained.result, 'observed')
  assert.equal(retained.error.message, primary.message); assert.equal(retained.cleanupErrors[0].operation, 'page close')
  assert.equal(fixture.calls.screenshots.length, 1); assert.equal(fixture.calls.close, 1); assert.equal(fixture.listeners.size, 0)
})
