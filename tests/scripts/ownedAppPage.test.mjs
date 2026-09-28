import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { assertOwnedAppDocument, assertOwnedAppState, createOwnedAppPage, observeOwnedAppDocument } from '../../scripts/ownedAppPage.mjs'

const url = 'http://127.0.0.1:5174/stratified-tikz/scripts/fixtures/freeLabelsApp.html'
const state = { json: '{"diagram":{}}', runtimeDiagramJson: '{"camera":{}}', history: '{"past":[],"future":[]}', labelDocumentRevision: 1 }
class Page extends EventEmitter {
  currentUrl = url
  closed = false
  document = { url, readyState: 'complete', contentType: 'text/html', generation: 'document-1',
    api: { type: 'object', stateType: 'function', sameInstance: true }, root: { tag: 'div', children: 1 }, scripts: [] }
  snapshot = { ...state }
  calls = []
  url() { return this.currentUrl }
  mainFrame() { return this }
  isClosed() { return this.closed }
  async addInitScript() {}
  async waitForFunction() {}
  async evaluate(operation, argument) {
    this.calls.push({ operation: operation.name, argument })
    if (operation.name === 'observeOwnedAppDocument') return structuredClone(this.document)
    if (typeof argument === 'string') return
    return { ...this.snapshot }
  }
  async screenshot(options) { this.calls.push({ screenshot: options }) }
  async close() { this.closed = true; this.emit('close') }
}
async function setup(t, options = {}) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-owned-app-test-'))
  const timings = []
  const page = new Page(), app = createOwnedAppPage({ page, expectedUrl: url, artifactDir,
    observeDiagnostic: (entry) => timings.push(entry), ...options })
  // Install cleanup before startup so a startup/persistence failure cannot leave
  // owned listeners or temporary files behind. Retain opt-in timing separately.
  t.after(async () => {
    try { await app.dispose() }
    finally {
      try {
        if (process.env.STZ_LIFECYCLE_TIMING_DIR) {
          await mkdir(process.env.STZ_LIFECYCLE_TIMING_DIR, { recursive: true })
          await writeFile(join(process.env.STZ_LIFECYCLE_TIMING_DIR, `${app.pageId}.json`),
            JSON.stringify({ test: t.name, artifactDir, node: process.version, timings }, null, 2) + '\n')
        }
      } finally { await rm(artifactDir, { recursive: true, force: true }) }
    }
  })
  await app.install(); const startup = await app.start()
  return { app, page, startup, artifactDir, timings }
}

test('owned document boundary rejects wrong page, URL, API, and same-URL replacement', () => {
  const snapshot = { pageId: 'owned', closed: false, crashed: false, document: new Page().document }
  const expected = { pageId: 'owned', url, generation: 'document-1' }
  assert.doesNotThrow(() => assertOwnedAppDocument(snapshot, expected))
  for (const [change, pattern] of [
    [{ pageId: 'renderer' }, /page identity/], [{ closed: true }, /page closed/], [{ crashed: true }, /page crashed/],
    [{ document: { ...snapshot.document, url: 'file:///standalone.svg' } }, /URL changed/],
    [{ document: { ...snapshot.document, generation: 'document-2' } }, /generation changed/],
    [{ document: { ...snapshot.document, api: { type: 'undefined' } } }, /API missing/],
    [{ document: { ...snapshot.document, api: { type: 'object', stateType: 'number' } } }, /state API missing/],
    [{ document: { ...snapshot.document, api: { type: 'object', stateType: 'function', sameInstance: false } } }, /API instance changed/],
  ]) assert.throws(() => assertOwnedAppDocument({ ...snapshot, ...change }, expected), pattern)
})

test('standalone continuity compares saved model, runtime model, exact history and document revision independently', () => {
  assert.doesNotThrow(() => assertOwnedAppState(state, { ...state }))
  for (const key of Object.keys(state)) assert.throws(() => assertOwnedAppState(state, { ...state, [key]: 'changed' }), new RegExp(key))
})

test('wrapper retains distinct standalone open/capture/close and preserves App state through helper return', async (t) => {
  const { app, page, startup, artifactDir } = await setup(t)
  const svg = new Page(); svg.currentUrl = 'file:///retained.svg'
  const result = await app.withStandalone('clear-multiple', async (track) => {
    track(svg); svg.emit('framenavigated', svg); await svg.screenshot({ fullPage: false }); await svg.close(); return 'captured'
  })
  assert.equal(result, 'captured'); assert.equal(page.closed, false)
  const evidence = await app.finish()
  assert.equal(evidence.startup.pageId, startup.pageId)
  assert.equal(evidence.transitions.length, 1)
  assert.equal(evidence.transitions[0].result, 'passed')
  assert.notEqual(evidence.transitions[0].standalonePages[0].pageId, startup.pageId)
  assert.deepEqual(evidence.transitions[0].standalonePages[0].events.map((entry) => entry.event), ['created', 'main-frame-navigation', 'close'])
  assert.deepEqual(evidence.helperReturn.state, evidence.beforeNextLoad.state)
  const file = JSON.parse(await readFile(join(artifactDir, 'point-paint-app-transitions.json'), 'utf8'))
  assert.equal(file.beforeNextLoad.boundary, 'before-next-app-load')
})

test('wrapper fails closed on replacement or state loss without recreating or waiting for App', async (t) => {
  const { app, page } = await setup(t)
  await assert.rejects(app.withStandalone('missing-api', async (track) => {
    const svg = new Page(); track(svg); await svg.close(); page.document.api.type = 'undefined'
  }), /API missing/)
  assert.equal(page.closed, false)
  page.document.api.type = 'object'
  await assert.rejects(app.withStandalone('changed-model', async (track) => {
    const svg = new Page(); track(svg); await svg.close(); page.snapshot.history = 'lost-history'
  }), /App history/)
  assert.equal(page.closed, false)
})

test('standalone cannot use the App page or return before its own close', async (t) => {
  const { app, page } = await setup(t)
  await assert.rejects(app.withStandalone('wrong-owner', async (track) => track(page)), /distinct page/)
  await assert.rejects(app.withStandalone('not-closed', async (track) => track(new Page())), /closed before App continuation/)
})

test('owned failure persists primary before API-independent DOM and screenshot; other pages are untouched', async (t) => {
  const { app, page, startup, artifactDir } = await setup(t)
  const primary = new Error('primary missing-API failure'), calls = [], original = page.evaluate.bind(page)
  page.evaluate = async (operation, argument) => {
    const saved = JSON.parse(await readFile(join(artifactDir, 'point-paint-app-failure.json'), 'utf8'))
    assert.equal(saved.error.message, primary.message)
    assert.equal(operation.name, 'observeOwnedAppDocument', 'Failure never executes fixture state API')
    calls.push('dom'); return original(operation, argument)
  }
  page.screenshot = async (options) => {
    calls.push('image'); assert.equal(options.fullPage, false); assert.ok(options.timeout <= 2000)
    assert.equal(options.path, join(artifactDir, 'point-paint-app-failure.png'))
  }
  const evidence = await app.failure(primary, { scenario: 'next-scenario-before-load' })
  assert.deepEqual(calls, ['dom', 'image'])
  assert.equal(evidence.pageId, startup.pageId)
  assert.equal(evidence.snapshot.pageId, startup.pageId)
  assert.equal(evidence.error.message, primary.message)
  assert.equal(evidence.scenario, 'next-scenario-before-load')
})

test('bounded failing capture and screenshot retain primary, own late rejections and permit cleanup', { timeout: 10_000 }, async (t) => {
  // Only advance the diagnostic clock after an intentionally hanging browser
  // operation starts. Real filesystem setup/persistence/disposal still happens,
  // with the same 15ms configured budget, but host scheduling cannot spend it.
  // Each test owns/restores its timer mock; ordinary production timers are intact.
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { app, page, artifactDir, timings } = await setup(t, { timeoutMs: 15 })
  let rejectCapture, rejectImage, captureEntered, imageEntered
  const captureStarted = new Promise((resolve) => { captureEntered = resolve })
  const imageStarted = new Promise((resolve) => { imageEntered = resolve })
  page.evaluate = () => new Promise((_resolve, reject) => { rejectCapture = reject; captureEntered() })
  page.screenshot = (options) => new Promise((_resolve, reject) => {
    assert.equal(options.timeout, 15)
    assert.equal(options.fullPage, false)
    rejectImage = reject; imageEntered()
  })
  const primary = new Error('primary action failure')
  const failure = app.failure(primary)
  await captureStarted
  t.mock.timers.tick(15)
  await imageStarted
  t.mock.timers.tick(115)
  const evidence = await failure
  assert.equal(evidence.error.message, primary.message)
  assert.match(evidence.captureError.message, /Timed out after 15ms during owned App document capture \(failure\)/)
  assert.match(evidence.screenshotError.message, /Timed out after 115ms during owned App failure screenshot/)
  assert.deepEqual(timings.filter((entry) => entry.outcome === 'failed').map(({ name, timeoutMs }) => ({ name, timeoutMs })), [
    { name: 'owned App document capture (failure)', timeoutMs: 15 },
    { name: 'owned App failure screenshot', timeoutMs: 115 },
  ])
  await page.close(); rejectCapture(new Error('late evaluate cancellation')); rejectImage(new Error('late screenshot cancellation'))
  await new Promise((resolve) => setImmediate(resolve))
  await app.dispose()
  const retained = JSON.parse(await readFile(join(artifactDir, 'point-paint-app-failure.json'), 'utf8'))
  assert.equal(retained.error.message, primary.message)
  assert.equal(retained.captureError.message, evidence.captureError.message)
  assert.equal(retained.screenshotError.message, evidence.screenshotError.message)
  const lifecycle = JSON.parse(await readFile(join(artifactDir, 'point-paint-app-lifecycle.json'), 'utf8'))
  assert.equal(lifecycle.events.at(-1).event, 'close')
  assert.equal(lifecycle.failure.error.message, primary.message, 'Cleanup retains primary in lifecycle evidence')
  assert.equal(page.eventNames().length, 0, 'Cleanup releases every owned page listener')
  assert.ok(timings.filter((entry) => entry.name.includes('evidence')).every((entry) => entry.outcome === 'passed' && entry.timeoutMs === 15))
})

test('bounded event lifecycle retains navigation, close/crash, console, module and request failures', async (t) => {
  const { app, page, artifactDir } = await setup(t)
  for (let i = 0; i < 300; i++) page.emit('console', { type: () => 'error', text: () => 'x'.repeat(4000), location: () => ({}) })
  page.emit('requestfailed', { url: () => '/module.tsx', resourceType: () => 'script', failure: () => ({ errorText: 'network failed' }) })
  page.emit('framenavigated', page); page.emit('crash'); await page.close(); await app.dispose()
  const lifecycle = JSON.parse(await readFile(join(artifactDir, 'point-paint-app-lifecycle.json'), 'utf8'))
  assert.equal(lifecycle.events.length, 256); assert.ok(lifecycle.droppedEvents > 0)
  assert.ok(lifecycle.events.filter((event) => event.event === 'console').every((event) => event.text.length === 2000))
  assert.deepEqual(lifecycle.events.slice(-4).map((entry) => entry.event), ['requestfailed', 'main-frame-navigation', 'crash', 'close'])
  assert.equal(page.listenerCount('console'), 0)
})


test('helper return detects state loss after the last standalone already closed', async (t) => {
  const { app, page } = await setup(t)
  await app.withStandalone('final-clear', async (track) => { const svg = new Page(); track(svg); await svg.close() })
  page.snapshot.history = 'silently reset after standalone helper'
  await assert.rejects(app.finish(), /App history/)
})

test('DOM diagnostic has bounded nodes, attributes, text and scripts without executing the fixture API', () => {
  const api = { state() { throw new Error('Diagnostic must never execute fixture API') } }
  const nodes = Array.from({ length: 700 }, (_, index) => ({ nodeType: index % 2 ? 3 : 1,
    textContent: 'text'.repeat(400), localName: 'div', attributes: Array.from({ length: 40 }, () => ({ name: 'data-name', value: 'attribute'.repeat(300) })) }))
  const context = { window: { stzAppLabels: api, marker: { api, generation: 'generation', nativeActions: [] } },
    location: { href: url }, NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 }, Node: { TEXT_NODE: 3 },
    document: { readyState: 'complete', title: 'title', contentType: 'text/html', documentElement: nodes[0],
      getElementById: () => ({ localName: 'div', childElementCount: 1 }),
      scripts: Array.from({ length: 40 }, () => ({ src: 'source'.repeat(800), type: 'module', textContent: 'module'.repeat(100) })),
      createTreeWalker() { let index = 0; return { currentNode: nodes[0], nextNode: () => nodes[++index] ?? null } } } }
  const captured = runInNewContext(`(${observeOwnedAppDocument.toString()})({ key: 'marker', includeDom: true })`, context)
  assert.equal(captured.dom.truncated, true)
  assert.ok(captured.dom.nodes.length <= 512); assert.ok(captured.dom.bytes <= 64_000)
  assert.equal(captured.scripts.length, 24)
  for (const entry of captured.dom.nodes) {
    if (entry.text) assert.ok(entry.text.length <= 300)
    else { assert.ok(entry.attributes.length <= 12); assert.ok(entry.attributes.every((item) => item[1].length <= 200)) }
  }
})

test('evidence write failures do not replace primary even when failing DOM and screenshot also reject', async (t) => {
  const { app, page, artifactDir } = await setup(t)
  const primary = new Error('original page action failure'), diagnostics = []
  t.mock.method(console, 'error', (...args) => diagnostics.push(args))
  // A directory at the file path deterministically fails writes without relying
  // on host permissions (which differ across parent and child runners).
  const { mkdir } = await import('node:fs/promises')
  await mkdir(join(artifactDir, 'point-paint-app-failure.json'))
  page.evaluate = async () => { throw new Error('document lost') }
  page.screenshot = async () => { throw new Error('page closed') }
  const evidence = await app.failure(primary)
  assert.equal(evidence.error.message, primary.message)
  assert.equal(evidence.captureError.message, 'document lost')
  assert.equal(evidence.screenshotError.message, 'page closed')
  assert.ok(diagnostics.length >= 3)
  const lifecycle = JSON.parse(await readFile(join(artifactDir, 'point-paint-app-lifecycle.json'), 'utf8'))
  assert.equal(lifecycle.failure.error.message, primary.message)
})
