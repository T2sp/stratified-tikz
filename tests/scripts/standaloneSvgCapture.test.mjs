import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { captureStandaloneSvg, measureStandaloneSvg, settleStandaloneSvg, standaloneSvgViewport } from '../../scripts/standaloneSvgCapture.mjs'

function measured(change = {}) {
  return {
    url: 'file:///saved.svg', contentType: 'image/svg+xml', readyState: 'complete',
    bodyExists: false, htmlBodyExists: false, parserErrors: [],
    root: { localName: 'svg', namespace: 'http://www.w3.org/2000/svg',
      width: '900', height: '700', viewBox: '0 0 900 700',
      bounds: { x: 0, y: 0, width: 900, height: 700 } },
    viewport: { width: 1100, height: 850 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 2,
    ...change,
  }
}

function withBounds(bounds) {
  const document = measured()
  return { ...document, root: { ...document.root, bounds: { ...document.root.bounds, ...bounds } } }
}

async function imagePath(context) {
  const directory = await mkdtemp(join(tmpdir(), 'stz-standalone-capture-test-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  return join(directory, 'standalone.png')
}

// Header-only files test the helper's file/dimension validation, not raster
// fidelity. Acceptance still requires a real native-browser PNG.
function pngHeader(width, height) {
  const bytes = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12)
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

function fakePage(measurements, screenshot, settle = () => {}) {
  const calls = { evaluate: 0, settles: 0, viewports: [], screenshots: [] }
  const page = {
    async evaluate(callback) {
      if (callback.name === 'settleStandaloneDocument') {
        calls.settles++
        return settle()
      }
      assert.ok(calls.evaluate < measurements.length, 'Every measurement is expected')
      return structuredClone(measurements[calls.evaluate++])
    },
    async setViewportSize(viewport) { calls.viewports.push(structuredClone(viewport)) },
    async screenshot(options) {
      calls.screenshots.push(structuredClone(options))
      await screenshot(options)
    },
  }
  return { page, calls }
}

test('complete finite SVG bounds fit the existing viewport without an HTML body', () => {
  const document = measured()
  assert.equal(document.bodyExists, false)
  assert.deepEqual(standaloneSvgViewport(document), document.viewport)
  assert.deepEqual(standaloneSvgViewport(withBounds({ x: 0.25, y: 0.5, width: 900.5, height: 700.5 })), document.viewport)
})

test('viewport expansion covers offset root edges with finite rounded margins', () => {
  const document = withBounds({ x: 5.5, y: 10.25, width: 1400.25, height: 1000.5 })
  assert.deepEqual(standaloneSvgViewport(document), { width: 1422, height: 1027 })
})

test('invalid XML, namespace and non-SVG roots cannot become capture evidence', () => {
  for (const document of [measured({ parserErrors: ['bad XML'] }),
    measured({ root: { ...measured().root, localName: 'html' } }),
    measured({ root: { ...measured().root, namespace: 'http://www.w3.org/1999/xhtml' } })]) {
    assert.throws(() => standaloneSvgViewport(document))
  }
})

test('nonfinite, nonpositive, negative-origin and scrolled measurements are rejected', () => {
  const invalid = [
    withBounds({ width: Infinity }), withBounds({ height: NaN }),
    withBounds({ x: -1 }), withBounds({ y: -1 }),
    withBounds({ width: 0 }), withBounds({ height: -1 }),
    measured({ viewport: { width: NaN, height: 850 } }),
    measured({ viewport: { width: 0, height: 850 } }),
    measured({ devicePixelRatio: Infinity }), measured({ devicePixelRatio: 0 }),
    measured({ scroll: { x: 1, y: 0 } }), measured({ scroll: { x: 0, y: -1 } }),
  ]
  for (const document of invalid) assert.throws(() => standaloneSvgViewport(document))
})

test('maximum side and total pixel limits reject oversized complete-root captures', () => {
  assert.throws(() => standaloneSvgViewport(withBounds({ width: 8192 })), /screenshot budget/)
  assert.throws(() => standaloneSvgViewport(withBounds({ width: 5000, height: 5000 })), /screenshot budget/)
  assert.throws(() => standaloneSvgViewport(measured({ viewport: { width: 9000, height: 850 } })), /screenshot budget/)
})

test('measurement retains the standalone document and body state without requiring a body', async () => {
  const document = measured()
  const { page, calls } = fakePage([document], () => assert.fail('Measurement must not take an image'))
  assert.deepEqual(await measureStandaloneSvg(page), document)
  assert.equal(calls.evaluate, 1)
  assert.equal(calls.screenshots.length, 0)
})

test('XML layout settling scrolls explicitly then waits two frames without an HTML body', async () => {
  const calls = [], timer = 17
  await settleStandaloneSvg({ async evaluate(callback) {
    return runInNewContext(`(${callback.toString()})()`, {
      window: { scrollTo(options) { calls.push({ scroll: structuredClone(options) }) } },
      requestAnimationFrame(callback) { calls.push('frame'); callback() },
      setTimeout(_callback, delay) { calls.push({ deadline: delay }); return timer },
      clearTimeout(value) { calls.push({ cleared: value }) },
    })
  } })
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { scroll: { left: 0, top: 0, behavior: 'instant' } }, 'frame', 'frame',
    { deadline: 2000 }, { cleared: timer },
  ])
})

test('layout settling deadline rejects stalled frames and releases its browser timer', async () => {
  let cleared = false
  await assert.rejects(settleStandaloneSvg({ async evaluate(callback) {
    return runInNewContext(`(${callback.toString()})()`, {
      window: { scrollTo() {} }, requestAnimationFrame() {},
      setTimeout(callback) { queueMicrotask(callback); return 1 },
      clearTimeout() { cleared = true },
    })
  } }), /layout settling exceeded 2000ms/)
  assert.equal(cleared, true)
})

test('settling failure preserves its primary error and never measures or screenshots', async (context) => {
  const path = await imagePath(context), failure = new Error('cannot settle SVG layout')
  const checkpoints = []
  const { page, calls } = fakePage([], () => assert.fail('No screenshot before settled coordinates'), () => { throw failure })
  await assert.rejects(captureStandaloneSvg(page, path, async (capture) => {
    checkpoints.push(structuredClone(capture))
    if (capture.status === 'failed') throw new Error('failed diagnostic write')
  }), (error) => error === failure)
  assert.equal(calls.settles, 1)
  assert.equal(calls.evaluate, 0)
  assert.equal(calls.screenshots.length, 0)
  assert.deepEqual(checkpoints.at(-1).measurements, [])
  assert.equal(checkpoints.at(-1).error.message, failure.message)
})

test('one bounded viewport capture persists measurements first and only saves an existing matching PNG', async (context) => {
  const path = await imagePath(context)
  const checkpoints = []
  const document = measured()
  const { page, calls } = fakePage([document, document], async (options) => {
    assert.equal(checkpoints.at(-1).status, 'pending')
    assert.deepEqual(checkpoints.at(-1).measurements, [document])
    assert.equal(checkpoints.at(-1).coverage.completeRoot, true)
    assert.equal(checkpoints.some(({ status }) => status === 'saved'), false)
    await writeFile(options.path, pngHeader(1100, 850))
  })
  const captured = await captureStandaloneSvg(page, path, async (capture) => checkpoints.push(structuredClone(capture)))
  assert.deepEqual(calls.screenshots, [{ path, fullPage: false, scale: 'css', timeout: 5000 }])
  assert.deepEqual(calls.viewports, [])
  assert.equal(calls.settles, 1)
  assert.equal(captured.status, 'saved')
  assert.equal(captured.fileExists, true)
  assert.equal(captured.retainedPath, path)
  assert.deepEqual(captured.png, { width: 1100, height: 850, bytes: 24 })
  assert.deepEqual(captured.before, document)
  assert.deepEqual(captured.after, document)
  assert.equal(captured.coordinatesStable, true)
  assert.deepEqual(checkpoints.at(-1), captured)
})

test('a screenshot throw keeps pre-image source observations and its original error without retry', async (context) => {
  const path = await imagePath(context)
  const failure = new Error('bounded screenshot failed')
  const reopened = { source: '$x$', matchingTitles: 1, foregroundPaths: 2, opacity: 0.175 }
  const checkpoints = []
  const { page, calls } = fakePage([measured()], () => { throw failure })
  await assert.rejects(captureStandaloneSvg(page, path, async (capture) => {
    checkpoints.push(structuredClone({ reopened, capture }))
  }), (error) => error === failure)
  assert.equal(calls.screenshots.length, 1)
  assert.equal(calls.screenshots[0].fullPage, false)
  assert.equal(checkpoints.at(-1).capture.status, 'failed')
  assert.equal(checkpoints.at(-1).capture.fileExists, false)
  assert.equal(checkpoints.at(-1).capture.retainedPath, undefined)
  assert.equal(checkpoints.at(-1).capture.error.message, failure.message)
  assert.deepEqual(checkpoints.at(-1).capture.measurements, [measured()])
  assert.ok(checkpoints.some(({ capture }) => capture.status === 'pending' && capture.coverage?.completeRoot))
  assert.ok(checkpoints.every((checkpoint) => JSON.stringify(checkpoint.reopened) === JSON.stringify(reopened)))
})

test('screenshot return without a PNG is failed/missing and retains the checkpoint', async (context) => {
  const path = await imagePath(context)
  const checkpoints = []
  const { page, calls } = fakePage([measured(), measured()], () => undefined)
  await assert.rejects(captureStandaloneSvg(page, path, async (capture) => checkpoints.push(structuredClone(capture))), /ENOENT/)
  assert.equal(calls.screenshots.length, 1)
  assert.equal(checkpoints.at(-1).status, 'failed')
  assert.equal(checkpoints.at(-1).fileExists, false)
  assert.equal(checkpoints.at(-1).retainedPath, undefined)
  assert.equal(checkpoints.some(({ status }) => status === 'saved'), false)
  assert.deepEqual(checkpoints.at(-1).measurements, [measured()])
})

test('invalid image bytes or cropped PNG dimensions never produce saved evidence', async (context) => {
  const path = await imagePath(context)
  for (const bytes of [Buffer.from('not a PNG'), pngHeader(900, 700)]) {
    const checkpoints = []
    const { page, calls } = fakePage([measured(), measured()], (options) => writeFile(options.path, bytes))
    await assert.rejects(captureStandaloneSvg(page, path, async (capture) => checkpoints.push(structuredClone(capture))))
    assert.equal(calls.screenshots.length, 1)
    assert.equal(checkpoints.at(-1).status, 'failed')
    assert.equal(checkpoints.at(-1).fileExists, true, 'The invalid file exists but is not accepted')
    assert.equal(checkpoints.at(-1).retainedPath, undefined)
    assert.equal(checkpoints.some(({ status }) => status === 'saved'), false)
  }
})

test('one viewport adjustment is followed by fresh complete-root measurement before capture', async (context) => {
  const path = await imagePath(context)
  const first = withBounds({ width: 1400, height: 1000 })
  const second = { ...first, viewport: { width: 1416, height: 1016 } }
  const checkpoints = []
  const { page, calls } = fakePage([first, second, second], async (options) => {
    assert.deepEqual(checkpoints.at(-1).measurements, [first, second])
    await writeFile(options.path, pngHeader(1416, 1016))
  })
  const captured = await captureStandaloneSvg(page, path, async (capture) => checkpoints.push(structuredClone(capture)))
  assert.deepEqual(calls.viewports, [second.viewport])
  assert.equal(calls.evaluate, 3)
  assert.equal(calls.settles, 2)
  assert.equal(calls.screenshots.length, 1)
  assert.deepEqual(captured.coverage, { completeRoot: true, bounds: second.root.bounds, viewport: second.viewport })
})

test('a root still exceeding the adjusted viewport fails without a resize or screenshot retry', async (context) => {
  const path = await imagePath(context)
  const first = withBounds({ width: 1400, height: 1000 })
  const second = { ...withBounds({ width: 1500, height: 1100 }), viewport: { width: 1416, height: 1016 } }
  const checkpoints = []
  const { page, calls } = fakePage([first, second], () => assert.fail('Cropped capture must not start'))
  await assert.rejects(captureStandaloneSvg(page, path, async (capture) => checkpoints.push(structuredClone(capture))), /without further resizing/)
  assert.equal(calls.viewports.length, 1)
  assert.equal(calls.evaluate, 2)
  assert.equal(calls.screenshots.length, 0)
  assert.equal(checkpoints.at(-1).status, 'failed')
  assert.deepEqual(checkpoints.at(-1).measurements, [first, second])
})

test('failure-diagnostic persistence cannot replace the original capture error', async (context) => {
  const path = await imagePath(context)
  const failure = new Error('primary capture failure')
  const { page, calls } = fakePage([measured()], () => { throw failure })
  await assert.rejects(captureStandaloneSvg(page, path, async (capture) => {
    if (capture.status === 'failed') throw new Error('diagnostic storage failure')
  }), (error) => error === failure)
  assert.equal(calls.screenshots.length, 1)
})

test('post-screenshot transform, crop, scroll and document drift persist both measurements and reject evidence', async (context) => {
  const path = await imagePath(context)
  const faults = [
    (after) => { after.root.bounds.x += 1 },
    (after) => { after.root.bounds.height -= 1 },
    (after) => { after.root.bounds.width = NaN },
    (after) => { after.root.viewBox = '0 1 900 700' },
    (after) => { after.viewport.width += 1 },
    (after) => { after.scroll.y = 12 },
    (after) => { after.devicePixelRatio = 1 },
    (after) => { after.url = 'file:///different.svg' },
  ]
  for (const mutate of faults) {
    const before = measured(), after = structuredClone(before), checkpoints = []
    mutate(after)
    const { page, calls } = fakePage([before, after], (options) => writeFile(options.path, pngHeader(1100, 850)))
    await assert.rejects(captureStandaloneSvg(page, path, async (capture) => checkpoints.push(structuredClone(capture))),
      /Standalone SVG capture coordinate mismatch/)
    const failed = checkpoints.at(-1)
    assert.equal(calls.screenshots.length, 1)
    assert.deepEqual(failed.before, before)
    assert.deepEqual(failed.after, after)
    assert.equal(failed.status, 'failed')
    assert.equal(failed.fileExists, true)
    assert.equal(failed.retainedPath, undefined)
    assert.equal(failed.coordinatesStable, undefined)
    assert.ok(checkpoints.some((capture) => capture.status === 'pending' && capture.after))
    assert.equal(checkpoints.some((capture) => capture.status === 'saved'), false)
  }
})
