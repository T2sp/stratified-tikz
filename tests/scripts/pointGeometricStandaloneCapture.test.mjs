import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { captureGeometricStandalone } from '../../scripts/checkPointNodeGeometricShapes.mjs'

// Scheduling controls are synthetic. The image bytes are a retained, complete
// native PNG fixture, not a header substitute; their unrelated pixels do not
// establish acceptance of this synthetic SVG. Fresh browser downloads remain
// required by the cumulative parent policy.
const pngFixture = resolve('tests/fixtures/dash-cap-native-endpoints/point-paint-dash-caps-triangle-square-wide-scale-0.5-edit-dashPhase.screen.png')

async function fixture(t, background = 'transparent', options = {}) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-geometric-standalone-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const scenario = `point-geometric-download-${background}`, svgPath = join(artifactDir, `${scenario}.svg`)
  const fileUrl = pathToFileURL(svgPath).href, artifactPath = join(artifactDir, `${scenario}-standalone.json`)
  const root = { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360' }
  const measurement = { url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', bodyExists: false, htmlBodyExists: false,
    root: { ...root, bounds: { x: 0, y: 0, width: 520, height: 360 } }, parserErrors: [],
    viewport: { width: 1500, height: 1150 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 2 }
  const contour = { tag: 'path', attributes: { d: 'M 0,0 L 1,1', stroke: '#203040', fill: 'none' } }
  const reopened = [{ source: 'captured $x$', shape: 'cylinder', contour, regions: [
    { tag: 'path', attributes: { fill: '#99ddff', stroke: 'none' } }, { tag: 'path', attributes: { fill: '#ffcc66', stroke: 'none' } },
  ], glyphs: 4, errors: 0 }]
  const expected = [{ id: 'geometric-cylinder', source: reopened[0].source, shape: 'cylinder', rendered: { contour } }]
  const click = { snapshot: { points: [{ id: expected[0].id, source: expected[0].source, style: { shape: 'cylinder', shapeParameters: { aspect: .55 } } }] } }
  const document = { root, forbiddenCount: 0, externalReferences: [], backgroundCount: background === 'white' ? 1 : 0 }
  const standalone = new EventEmitter(), calls = [], pageErrors = []
  standalone.goto = async (url) => { calls.push('goto'); assert.equal(url, fileUrl); standalone.emit('request', { url: () => url }) }
  standalone.evaluate = async (callback) => {
    if (callback.name === 'observeGeometricStandaloneDocument') {
      calls.push('reopen'); return structuredClone({ reopened, document })
    }
    if (callback.name === 'settleStandaloneDocument') { calls.push('settle'); return }
    calls.push('measure'); return structuredClone(measurement)
  }
  standalone.setViewportSize = async () => assert.fail('The complete root already fits')
  standalone.screenshot = async (captureOptions) => {
    calls.push('screenshot')
    const raw = JSON.parse(await readFile(artifactPath, 'utf8'))
    assert.equal(raw.result, 'observed')
    assert.equal(raw.capture.status, 'pending')
    assert.equal(raw.capture.coverage.completeRoot, true)
    assert.deepEqual(raw.capture.before, measurement)
    assert.deepEqual(raw.reopened, reopened)
    assert.deepEqual(raw.expected, expected); assert.deepEqual(raw.click, click)
    assert.deepEqual(captureOptions, { path: join(artifactDir, `${scenario}.png`), fullPage: false, scale: 'css', timeout: 5000 })
    if (options.screenshot) await options.screenshot({ captureOptions, artifactPath, raw })
    else await copyFile(pngFixture, captureOptions.path)
  }
  standalone.close = async () => { calls.push('close'); if (options.closeError) throw options.closeError }
  const observe = async (name, details) => {
    calls.push('observed')
    assert.equal(name, `${scenario}-observed`); assert.equal(details.result, 'observed')
    const raw = JSON.parse(await readFile(artifactPath, 'utf8'))
    assert.equal(raw.capture, undefined, 'Candidate is persisted before capture starts')
    assert.deepEqual(raw.reopened, reopened); assert.deepEqual(raw.document, document)
    assert.equal(raw.svgPath, svgPath); assert.equal(raw.fileUrl, fileUrl); assert.equal(raw.background, background)
  }
  await writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360"/>')
  return { standalone, artifactDir, artifactPath, svgPath, scenario, background, pageErrors, expected, click, observe,
    reopened, document, measurement, calls }
}

test('geometric transparent and white reopening candidates precede one bounded complete-root capture', async (t) => {
  for (const background of ['transparent', 'white']) {
    const context = await fixture(t, background)
    const result = await captureGeometricStandalone(context)
    const raw = JSON.parse(await readFile(context.artifactPath, 'utf8'))
    assert.equal(result.result, 'observed'); assert.equal(raw.result, 'observed')
    assert.equal(raw.capture.status, 'saved')
    assert.equal(raw.capture.before.bodyExists, false)
    assert.deepEqual(raw.capture.after, raw.capture.before)
    const bytes = await readFile(raw.capture.retainedPath)
    assert.ok(bytes.length > 24)
    assert.deepEqual(raw.capture.png, { width: 1500, height: 1150, bytes: bytes.length })
    assert.deepEqual(context.calls, ['goto', 'reopen', 'observed', 'settle', 'measure', 'screenshot', 'measure', 'close'])
    assert.equal(context.standalone.eventNames().length, 0)
    assert.deepEqual(context.pageErrors, [])
    await assert.rejects(readFile(join(context.artifactDir, `${context.scenario}.json`)), { code: 'ENOENT' })
  }
})

test('a reopening assertion failure retains raw observations before image work and cannot pass', async (t) => {
  const context = await fixture(t)
  context.expected[0].rendered.contour = { tag: 'path', attributes: { d: 'wrong contour' } }
  await assert.rejects(captureGeometricStandalone(context), /deep-equal/)
  const raw = JSON.parse(await readFile(context.artifactPath, 'utf8'))
  assert.equal(raw.result, 'observed'); assert.deepEqual(raw.reopened, context.reopened)
  assert.deepEqual(raw.expected, context.expected); assert.deepEqual(raw.click, context.click)
  assert.ok(raw.error.message); assert.equal(raw.capture, undefined)
  assert.equal(context.calls.includes('screenshot'), false)
  assert.equal(context.calls.at(-1), 'close')
})

test('geometric missing PNG stays failed with the pre-image candidate and no capture retry', async (t) => {
  const context = await fixture(t, 'transparent', { screenshot: async () => {} })
  await assert.rejects(captureGeometricStandalone(context), { code: 'ENOENT' })
  const raw = JSON.parse(await readFile(context.artifactPath, 'utf8'))
  assert.equal(raw.result, 'observed'); assert.equal(raw.capture.status, 'failed')
  assert.equal(raw.capture.fileExists, false); assert.equal(raw.capture.retainedPath, undefined)
  assert.deepEqual(raw.reopened, context.reopened); assert.deepEqual(raw.capture.before, context.measurement)
  assert.equal(context.calls.filter((call) => call === 'screenshot').length, 1)
})

test('geometric capture owns secondary evidence and page cleanup failures without another image', async (t) => {
  const primary = new Error('native screenshot original failure'), closeError = new Error('secondary page close')
  let beforeFailure
  const context = await fixture(t, 'transparent', { closeError, screenshot: async ({ artifactPath, raw }) => {
    beforeFailure = raw
    await rm(artifactPath); await mkdir(artifactPath) // Deliberate write failure after a retained candidate.
    throw primary
  } })
  await assert.rejects(captureGeometricStandalone(context), (error) => error === primary)
  assert.equal(beforeFailure.result, 'observed'); assert.deepEqual(beforeFailure.reopened, context.reopened)
  assert.deepEqual(beforeFailure.capture.before, context.measurement)
  assert.equal(context.calls.filter((call) => call === 'screenshot').length, 1)
  assert.equal(context.calls.at(-1), 'close')
  assert.equal(context.standalone.eventNames().length, 0)
  assert.ok(context.pageErrors.some((message) => message.includes('failure evidence:')))
  assert.ok(context.pageErrors.some((message) => message.includes(closeError.message)))
})

test('successful geometric image followed by unowned cleanup failure still fails the workflow', async (t) => {
  const primary = new Error('standalone page cannot close'), context = await fixture(t, 'white', { closeError: primary })
  await assert.rejects(captureGeometricStandalone(context), (error) => error === primary)
  const raw = JSON.parse(await readFile(context.artifactPath, 'utf8'))
  assert.equal(raw.result, 'observed'); assert.equal(raw.capture.status, 'saved')
  assert.equal(raw.cleanupErrors[0].message, primary.message)
  assert.equal(context.calls.filter((call) => call === 'screenshot').length, 1)
  await assert.rejects(readFile(join(context.artifactDir, `${context.scenario}.json`)), { code: 'ENOENT' })
})
