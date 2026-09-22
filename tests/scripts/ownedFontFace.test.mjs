import assert from 'node:assert/strict'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import { withOwnedFontFace, observeOwnedFontFace, assertRestoredPointFont } from '../../scripts/ownedFontFace.mjs'

// Execute the browser callbacks in an isolated realm. The set refuses any
// deletion target other than the exact new face, including same-family faces.
function browser(options = {}) {
  const existing = { family: '"Times New Roman"', style: 'normal', weight: 'normal', status: 'loaded' }
  const unrelated = { family: 'Other face', style: 'normal', weight: 'normal', status: 'loaded' }
  const created = [], deleted = [], events = [], handles = []
  const fonts = new Set([existing, unrelated])
  fonts.ready = Promise.resolve(fonts)
  fonts.dispatchEvent = (event) => { events.push(event.type) }
  fonts.delete = (face) => {
    assert.equal(face, created[0], 'Only the actual owned face may be deleted')
    deleted.push(face)
    if (options.deleteError) throw options.deleteError
    if (options.silentDeleteFailure) return false
    return Set.prototype.delete.call(fonts, face)
  }
  const document = { fonts, URL: 'http://fixture.local/renderer', defaultView: { Event } }
  class FontFace {
    constructor(family, source) {
      this.family = `"${family}"`; this.source = source
      this.style = 'normal'; this.weight = 'normal'; this.status = 'unloaded'
      created.push(this)
    }
    async load() {
      assert.equal(fonts.has(this), true)
      if (options.loadError) throw options.loadError
      this.status = 'loaded'
      return this
    }
  }
  const realm = createContext({ document, FontFace })
  const evaluate = (fn, argument) => runInContext(`(${fn.toString()})`, realm)(argument)
  const page = { async evaluateHandle(fn, argument) {
    if (options.acquireError) throw options.acquireError
    const value = await evaluate(fn, argument)
    const handle = { value, disposed: false,
      async evaluate(fn) { return structuredClone(await evaluate(fn, value)) },
      async dispose() { this.disposed = true; if (options.disposeError) throw options.disposeError },
    }
    handles.push(handle)
    return handle
  } }
  return { page, fonts, existing, unrelated, created, deleted, events, handles }
}
const config = { family: 'Times New Roman', source: 'local("Courier New")' }
const silenceCleanup = (t) => t.mock.method(console, 'error', () => {})
const clean = (fixture) => {
  assert.equal(fixture.fonts.has(fixture.created[0]), false)
  assert.equal(fixture.fonts.has(fixture.existing), true)
  assert.equal(fixture.fonts.has(fixture.unrelated), true)
  assert.equal(fixture.handles[0].disposed, true)
}

test('quoted family is removed by actual ownership while existing and later same-family faces survive', async () => {
  const f = browser()
  let before, added, after
  const later = { ...f.existing }
  const result = await withOwnedFontFace(f.page, { ...config,
    acquired: async (handle) => { before = await observeOwnedFontFace(handle) },
    use: async (handle) => {
      assert.notEqual(f.created[0], f.existing)
      assert.equal(f.created[0].family, '"Times New Roman"')
      assert.equal(f.created[0].family === 'Times New Roman', false, 'The historical name comparison misses this face')
      f.fonts.add(later)
      added = await observeOwnedFontFace(handle)
      return 'font changed'
    },
    restore: async (removal, handle) => {
      assert.equal(removal.deleted, true)
      after = await observeOwnedFontFace(handle)
      return 'metrics restored'
    },
  })
  assert.equal(before.ownedFacePresent, false)
  assert.equal(added.ownedFacePresent, true)
  assert.equal(after.ownedFacePresent, false)
  assert.ok(after.previousFaces.every((face) => face.present))
  assert.equal(f.fonts.has(later), true)
  assert.deepEqual(f.deleted, [f.created[0]])
  assert.deepEqual(f.events, ['loadingdone', 'loadingdone'])
  assert.equal(result.value, 'font changed'); assert.equal(result.restored, 'metrics restored')
  clean(f)
})

for (const stage of ['load', 'measurement', 'assertion', 'evidence']) {
  test(`${stage} failure still removes the owned face, revalidates and disposes before preserving the primary error`, async () => {
    const primary = new Error(`${stage} failed`)
    const f = browser(stage === 'load' ? { loadError: primary } : {})
    let restored = false, diagnosed = false
    await assert.rejects(withOwnedFontFace(f.page, { ...config,
      use: async () => { throw primary },
      restore: async (removal) => { assert.equal(removal.ownedFacePresent, false); restored = true },
      diagnoseFailure: ({ primary: observed, cleanupErrors }) => {
        assert.equal(observed, primary); assert.equal(cleanupErrors.length, 0)
        assert.equal(f.handles[0].disposed, true); diagnosed = true
      },
    }), (error) => error === primary)
    assert.equal(restored, true); assert.equal(diagnosed, true)
    assert.equal(f.events.at(-1), 'loadingdone')
    clean(f)
  })
}

test('acquired-handle evidence failure cannot strand an unregistered face or its handle', async () => {
  const f = browser(), primary = new Error('before evidence failed')
  await assert.rejects(withOwnedFontFace(f.page, { ...config,
    acquired: async () => { throw primary },
    use: async () => assert.fail('No test starts after acquisition evidence failed'),
    restore: async (removal) => {
      assert.equal(removal.presentBeforeRemoval, false); assert.equal(removal.deleted, false)
    },
  }), (error) => error === primary)
  clean(f)
})

test('cleanup failure without a primary error fails the test and still attempts restoration and handle disposal', async (t) => {
  silenceCleanup(t)
  const cleanup = new Error('delete failed'), f = browser({ deleteError: cleanup })
  let restored = false, diagnosed = false
  await assert.rejects(withOwnedFontFace(f.page, { ...config, use: async () => {},
    restore: async (removal) => { assert.equal(removal, undefined); restored = true },
    diagnoseFailure: ({ primary, cleanupErrors }) => {
      assert.equal(primary, cleanup); assert.equal(cleanupErrors[0], cleanup); diagnosed = true
    },
  }), (error) => error === cleanup)
  assert.equal(restored, true); assert.equal(diagnosed, true)
  assert.equal(f.handles[0].disposed, true)
  assert.equal(f.fonts.has(f.existing), true)
})

test('a false deletion result with the owned face retained is a cleanup failure', async (t) => {
  silenceCleanup(t)
  const f = browser({ silentDeleteFailure: true })
  let removalObservation
  await assert.rejects(withOwnedFontFace(f.page, { ...config, use: async () => {},
    restore: async (removal) => { removalObservation = removal },
  }), /Injected FontFace must be absent/)
  assert.equal(removalObservation.ownedFacePresent, true, 'Evidence is available before cleanup assertion')
  assert.equal(f.handles[0].disposed, true)
})

test('cleanup, restoration and diagnostic failures never replace the primary test error', async (t) => {
  silenceCleanup(t)
  const primary = new Error('native radius assertion'), cleanup = new Error('delete failed')
  const restoration = new Error('restoration evidence failed'), diagnostic = new Error('failure evidence failed')
  const f = browser({ deleteError: cleanup })
  let observed
  await assert.rejects(withOwnedFontFace(f.page, { ...config,
    use: async () => { throw primary }, restore: async () => { throw restoration },
    diagnoseFailure: (details) => { observed = details; throw diagnostic },
  }), (error) => error === primary)
  assert.equal(observed.primary, primary)
  assert.equal(observed.cleanupErrors[0], cleanup)
  assert.equal(observed.cleanupErrors[1], restoration)
  assert.equal(f.handles[0].disposed, true)
})

test('restoration evidence failure after successful use is reported after removal and handle disposal', async (t) => {
  silenceCleanup(t)
  const f = browser(), failure = new Error('restored observation write failed')
  await assert.rejects(withOwnedFontFace(f.page, { ...config, use: async () => {},
    restore: async () => { throw failure },
  }), (error) => error === failure)
  clean(f)
})

test('handle-disposal failure reports failure after successful native cleanup', async (t) => {
  silenceCleanup(t)
  const failure = new Error('dispose failed'), f = browser({ disposeError: failure })
  await assert.rejects(withOwnedFontFace(f.page, { ...config, use: async () => {}, restore: async () => {} }), (error) => error === failure)
  clean(f)
})

test('acquisition failure creates no unowned registered face', async () => {
  const primary = new Error('target closed'), f = browser({ acquireError: primary })
  await assert.rejects(withOwnedFontFace(f.page, { ...config, use: async () => {}, restore: async () => {} }), (error) => error === primary)
  assert.equal(f.created.length, 0); assert.equal(f.handles.length, 0)
  assert.deepEqual([...f.fonts], [f.existing, f.unrelated])
})

function nativePoint(generation = 1, owner = 'point-owner') {
  const request = JSON.stringify(['mmmm WWWW $unclosed', 'Times New Roman, Times, serif', 12, '400', 'normal', generation, 4, .2, owner])
  return { source: 'mmmm WWWW $unclosed', style: { shape: 'circle', size: 3 }, owner,
    runtime: { identity: 'renderer-runtime', fontGeneration: generation, documentRevision: 8 },
    request, pointRequest: request, status: 'fallback',
    literalObservation: { source: 'mmmm WWWW $unclosed', request, pointRequest: request, status: 'fallback',
      font: { properties: { 'font-family': '"Times New Roman", Times, serif' } },
      canvasConfiguration: { effective: '12px "Times New Roman", Times, serif' },
      fontProbe: { width: 13, fontBoundingBoxAscent: 11, fontBoundingBoxDescent: 3 },
      space: { width: 3 }, lineContract: { ascent: 11, descent: 3 },
      lines: [{ width: 140, ascent: 11, descent: 3 }], measurements: [{ canvas: { width: 140 } }],
      extent: { minX: 0, maxX: 140 }, fontReadiness: { faces: [], status: 'loaded', checked: true } },
    bounds: [-70, -7, 70, 7], body: { x: -70, y: -7, width: 140, height: 14 },
    shape: { x: -74, y: -74, width: 148, height: 148 }, radius: 74, contour: '<circle r="74" />' }
}

test('restored measurements require native width, line boxes and contour, not only a current generation', () => {
  const before = nativePoint(), after = nativePoint(3)
  assertRestoredPointFont(before, after)
  for (const corrupt of [
    (p) => { p.literalObservation.lines[0].width = 190 },
    (p) => { p.literalObservation.fontProbe.fontBoundingBoxAscent = 10 },
    (p) => { p.literalObservation.lineContract.descent = 4 },
    (p) => { p.radius = 100 },
    (p) => { p.literalObservation.fontReadiness.faces.push({ family: '"Times New Roman"' }) },
    (p) => { p.runtime.fontGeneration++ },
    (p) => { p.runtime.identity = 'new-runtime' },
    (p) => { p.runtime.documentRevision++ },
    (p) => { p.literalObservation.request = nativePoint(2).request },
    (p) => { p.literalObservation.source = 'later source' },
    (p) => { p.literalObservation.pointRequest = nativePoint(2).pointRequest },
    (p) => { p.literalObservation.status = 'pending' },
    (p) => { p.request = JSON.stringify(['stale source', ...JSON.parse(p.request).slice(1)]); p.pointRequest = p.request },
    (p) => { const request = JSON.parse(p.request); request[8] = 'old owner'; p.request = JSON.stringify(request); p.pointRequest = p.request },
  ]) {
    const contaminated = structuredClone(after); corrupt(contaminated)
    assert.throws(() => assertRestoredPointFont(before, contaminated))
  }
})

test('same-page later reference may get a new owner but must keep the restored runtime and metrics', () => {
  const before = nativePoint(), reference = nativePoint(3, 'later-owner')
  reference.runtime.documentRevision++
  assertRestoredPointFont(before, reference, { sameOwner: false })
  assert.throws(() => assertRestoredPointFont(before, reference), /current point owner/)
  reference.literalObservation.measurements[0].canvas.width = 200
  assert.throws(() => assertRestoredPointFont(before, reference, { sameOwner: false }), /native measurements/)
})
