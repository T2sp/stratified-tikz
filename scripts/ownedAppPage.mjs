import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

const markerKey = '__stzOwnedAppDocument'
const clipped = (value, limit = 2000) => String(value).slice(0, limit)
const errorDetails = (error) => ({ message: clipped(error.message, 4000), stack: clipped(error.stack ?? '', 12000),
  log: Array.isArray(error.log) ? error.log.slice(0, 32).map((entry) => clipped(entry)) : undefined })

/** The marker belongs to one Document, not its URL, and remembers the exact API
 * object once startup commits. It is diagnostics only, outside model/history. */
export function installOwnedAppDocumentMarker(key) {
  const marker = { generation: crypto.randomUUID(), api: undefined, nativeActions: [] }
  Object.defineProperty(window, key, { value: marker, configurable: false })
  window.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null
    if (!button) return
    marker.nativeActions.push({ at: performance.now(), action: 'click',
      name: (button.getAttribute('aria-label') ?? button.textContent ?? '').slice(0, 300) })
    if (marker.nativeActions.length > 64) marker.nativeActions.shift()
  }, { capture: true })
}

/** This deliberately never calls the fixture API, even on the failure path. */
export function observeOwnedAppDocument({ key, includeDom = false }) {
  const marker = window[key], api = window.stzAppLabels, root = document.getElementById('root')
  const result = {
    url: location.href, readyState: document.readyState, title: document.title.slice(0, 300),
    contentType: document.contentType, generation: marker?.generation ?? null,
    nativeActions: marker?.nativeActions ?? [],
    api: { type: typeof api, stateType: typeof api?.state, sameInstance: marker?.api !== undefined && marker.api === api },
    root: root ? { tag: root.localName, children: root.childElementCount } : null,
    scripts: Array.from(document.scripts).slice(0, 24).map((script) => ({ src: script.src.slice(0, 2000), type: script.type, text: script.textContent.slice(0, 200) })),
  }
  if (includeDom) {
    // Avoid serializing an unbounded document. Retain a bounded structural DOM
    // walk, including text and attributes, from the actual owned App document.
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
    const nodes = []; let node = walker.currentNode, bytes = 0
    while (node && nodes.length < 512 && bytes < 64_000) {
      const entry = node.nodeType === Node.TEXT_NODE ? { text: node.textContent.slice(0, 300) }
        : { tag: node.localName, attributes: Array.from(node.attributes).slice(0, 12).map((item) => [item.name.slice(0, 100), item.value.slice(0, 200)]) }
      const size = JSON.stringify(entry).length
      if (bytes + size > 64_000) break
      nodes.push(entry); bytes += size; node = walker.nextNode()
    }
    result.dom = { nodes, bytes, truncated: node !== null, maxNodes: 512, maxBytes: 64_000 }
  }
  return result
}

export function assertOwnedAppDocument(snapshot, expected) {
  assert.equal(snapshot.pageId, expected.pageId, 'Owned App page identity changed')
  assert.equal(snapshot.closed, false, 'Owned App page closed')
  assert.equal(snapshot.crashed, false, 'Owned App page crashed')
  assert.equal(snapshot.document.url, expected.url, 'Owned App URL changed')
  assert.equal(snapshot.document.generation, expected.generation, 'Owned App document generation changed (including same-URL reload)')
  assert.equal(snapshot.document.api.type, 'object', 'Owned App fixture API missing or invalid')
  assert.equal(snapshot.document.api.stateType, 'function', 'Owned App fixture state API missing or invalid')
  assert.equal(snapshot.document.api.sameInstance, true, 'Owned App fixture API instance changed')
  assert.ok(snapshot.document.root?.children > 0, 'Owned App root is not initialized')
}

export function assertOwnedAppState(before, after) {
  for (const key of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) {
    assert.equal(after[key], before[key], `Standalone work changed App ${key}`)
  }
}

/** Fail closed after startup. Never wait for, reload, or recreate a lost App. */
export function createOwnedAppPage({ page, expectedUrl, artifactDir, prefix = 'point-paint-app', timeoutMs = 2000, observeDiagnostic }) {
  const pageId = `app-${randomUUID()}`, events = [], listeners = [], transitions = []
  let sequence = 0, droppedEvents = 0, crashed = false, expected, startup, lastState, failureRecord
  const evidencePath = resolve(artifactDir, `${prefix}-lifecycle.json`)
  const diagnostic = async (operation, name, deadlineMs = timeoutMs) => {
    const started = performance.now()
    let outcome = 'passed'
    try { return await boundedPointDiagnostic(operation, name, deadlineMs) }
    catch (error) { outcome = 'failed'; throw error }
    finally {
      // Optional read-only test/runner timing; never replaces an operation's
      // result, error, or production deadline. It runs outside persisted state.
      try { observeDiagnostic?.({ name, timeoutMs: deadlineMs, elapsedMs: performance.now() - started, outcome }) }
      catch (error) { console.error('Owned App timing observer:', error) }
    }
  }
  const add = (event, details = {}) => {
    events.push({ sequence: ++sequence, at: new Date().toISOString(), event, pageId, url: clipped(page.url()), ...details })
    if (events.length > 256) { events.shift(); droppedEvents++ }
  }
  const on = (target, event, listener) => { target.on(event, listener); listeners.push(() => target.off(event, listener)) }
  on(page, 'framenavigated', (frame) => { if (frame === page.mainFrame()) add('main-frame-navigation', { url: clipped(frame.url()) }) })
  on(page, 'filechooser', () => add('native-filechooser'))
  on(page, 'download', (download) => add('native-download', { downloadUrl: clipped(download.url()), filename: clipped(download.suggestedFilename()) }))
  on(page, 'close', () => add('close'))
  on(page, 'crash', () => { crashed = true; add('crash') })
  on(page, 'pageerror', (error) => add('pageerror', { error: errorDetails(error) }))
  on(page, 'console', (message) => {
    if (['warning', 'error'].includes(message.type()) || /\[vite\]|reload|module/i.test(message.text())) {
      add('console', { type: message.type(), text: clipped(message.text()), location: { url: clipped(message.location().url ?? ''), lineNumber: message.location().lineNumber, columnNumber: message.location().columnNumber } })
    }
  })
  on(page, 'requestfailed', (request) => add('requestfailed', { requestUrl: clipped(request.url()), resourceType: request.resourceType(), failure: clipped(request.failure()?.errorText ?? '') }))
  on(page, 'response', (response) => { if (response.status() >= 400) add('response-failure', { requestUrl: clipped(response.url()), status: response.status() }) })
  on(page, 'websocket', (socket) => {
    on(socket, 'framereceived', ({ payload }) => {
      if (/reload|update|error/.test(String(payload))) add('module-websocket', { socketUrl: clipped(socket.url()), payload: clipped(payload) })
    })
  })
  add('created', { expectedUrl })
  const persist = (phase, extra = {}) => diagnostic(() => writeFile(evidencePath, JSON.stringify({
    schema: 1, pageId, expectedUrl, expected, startup, droppedEvents, events, failure: failureRecord, ...extra,
  }, null, 2) + '\n'), `owned App lifecycle evidence (${phase})`)
  async function capture(boundary, includeDom = false) {
    const snapshot = { boundary, pageId, expectedUrl, closed: page.isClosed(), crashed,
      document: await diagnostic(() => page.evaluate(observeOwnedAppDocument, { key: markerKey, includeDom }), `owned App document capture (${boundary})`) }
    add('document-observation', { boundary, document: { ...snapshot.document, dom: undefined } })
    await persist(`capture:${boundary}`)
    return snapshot
  }
  async function readState() {
    assert.ok(expected, 'Owned App startup must complete before model observations')
    // Check and read atomically in the same browser task: a navigation between
    // a prior document check and this call cannot pass as the old App instance.
    return diagnostic(() => page.evaluate(({ key, expected }) => {
      const marker = window[key]
      if (location.href !== expected.url || marker?.generation !== expected.generation
        || typeof window.stzAppLabels?.state !== 'function' || marker.api !== window.stzAppLabels) {
        throw new Error('Owned App continuity lost before state read')
      }
      return window.stzAppLabels.state()
    }, { key: markerKey, expected }), 'owned App state read')
  }
  async function checkpoint(boundary) {
    const snapshot = await capture(boundary)
    assertOwnedAppDocument(snapshot, expected)
    const state = await readState()
    const continuity = Object.fromEntries(['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision'].map((key) => [key, state[key]]))
    for (const key of ['json', 'runtimeDiagramJson', 'history']) {
      assert.equal(typeof continuity[key], 'string', `App continuity ${key} is available`)
      assert.ok(continuity[key].length <= 8_000_000, `App continuity ${key} exceeds evidence budget`)
    }
    lastState = { ...snapshot, state: continuity }
    return lastState
  }
  return {
    pageId, transitions, readState, checkpoint,
    async install() { await page.addInitScript(installOwnedAppDocumentMarker, markerKey); await persist('install') },
    async start() {
      await capture('startup-before-ready')
      // The only readiness wait belongs to the legitimate initial navigation.
      await page.waitForFunction(() => {
        if (typeof window.stzAppLabels?.state !== 'function' || !document.getElementById('root')?.childElementCount) return false
        try { return typeof window.stzAppLabels.state().runtimeDiagramJson === 'string' } catch { return false }
      }, undefined, { timeout: 30_000 })
      await page.evaluate((key) => { window[key].api = window.stzAppLabels }, markerKey)
      const ready = await capture('startup-ready')
      expected = { pageId, url: expectedUrl, generation: ready.document.generation }
      assert.equal(typeof expected.generation, 'string', 'Startup document generation is present')
      startup = await checkpoint('startup-committed')
      await persist('startup-complete')
      return startup
    },
    async withStandalone(name, operation) {
      assert.ok(transitions.length < 32, 'Bounded standalone transition evidence limit exceeded')
      const before = await checkpoint(`${name}:before-standalone`), standalonePages = [], releases = []
      const transition = { name, before, standalonePages, result: 'pending' }
      transitions.push(transition)
      const saveTransitions = () => diagnostic(() => writeFile(resolve(artifactDir, `${prefix}-transitions.json`),
        JSON.stringify({ schema: 1, pageId, transitions }, null, 2) + '\n'), `owned App transition evidence (${name}:${transition.result})`)
      await saveTransitions()
      const trackStandalone = (standalone) => {
        assert.notEqual(standalone, page, 'Standalone SVG must own a distinct page')
        const identity = { pageId: `svg-${randomUUID()}`, events: [], closed: false }
        standalonePages.push(identity)
        const note = (event, details = {}) => {
          identity.events.push({ event, url: clipped(standalone.url()), ...details })
          if (identity.events.length > 32) identity.events.shift()
          add('standalone', { name, standalonePageId: identity.pageId, standaloneEvent: event, standaloneUrl: clipped(standalone.url()), ...details })
        }
        const navigation = (frame) => { if (frame === standalone.mainFrame()) note('main-frame-navigation') }
        const close = () => { identity.closed = true; note('close') }
        const crash = () => note('crash')
        standalone.on('framenavigated', navigation); standalone.on('close', close); standalone.on('crash', crash)
        releases.push(() => { standalone.off('framenavigated', navigation); standalone.off('close', close); standalone.off('crash', crash) })
        note('created')
      }
      try {
        const value = await operation(trackStandalone)
        const after = await checkpoint(`${name}:after-standalone-close`)
        transition.after = after
        transition.result = 'observed'
        await saveTransitions()
        assert.ok(standalonePages.length > 0, 'Actual standalone page was tracked')
        assert.ok(standalonePages.every((entry) => entry.closed), 'Standalone pages closed before App continuation')
        assertOwnedAppState(before.state, after.state)
        transition.result = 'passed'
        await saveTransitions()
        return value
      } catch (error) {
        transition.result = 'failed'; transition.error = errorDetails(error)
        await saveTransitions().catch((diagnosticError) => console.error('Owned App transition evidence:', diagnosticError))
        throw error
      } finally { for (const release of releases) release() }
    },
    async finish() {
      const helperReturn = await checkpoint('import-helper-return')
      assert.ok(transitions.length > 0, 'Native App-to-standalone-to-App transition required')
      assertOwnedAppState(transitions.at(-1).after.state, helperReturn.state)
      const beforeNextLoad = await checkpoint('before-next-app-load')
      assertOwnedAppState(helperReturn.state, beforeNextLoad.state)
      const result = { schema: 1, startup, helperReturn, beforeNextLoad, transitions,
        lifecycleArtifact: `${prefix}-lifecycle.json`, transitionsArtifact: `${prefix}-transitions.json` }
      await writeFile(resolve(artifactDir, `${prefix}-transitions.json`), JSON.stringify(result, null, 2) + '\n')
      await persist('finish')
      return result
    },
    async failure(primary, details = {}) {
      // Save primary + lifecycle before any DOM or image operation, then update
      // the same owned artifact after each bounded best-effort diagnostic.
      const evidence = { boundary: 'owned-app-failure', pageId, expectedUrl, error: errorDetails(primary), ...details }
      const path = resolve(artifactDir, `${prefix}-failure.json`)
      failureRecord = { error: errorDetails(primary), artifact: `${prefix}-failure.json` }
      const save = async (phase) => {
        try { await diagnostic(() => writeFile(path, JSON.stringify(evidence, null, 2) + '\n'), `owned App primary failure evidence (${phase})`) }
        catch (error) { console.error('Owned App failure evidence:', error) }
        try { await persist(`failure:${phase}`) }
        catch (error) { console.error('Owned App lifecycle evidence:', error) }
      }
      await save('primary')
      try { evidence.snapshot = await capture('failure', true) }
      catch (error) { evidence.captureError = errorDetails(error) }
      await save('after-capture')
      try {
        const screenshot = `${prefix}-failure.png`
        await diagnostic(() => page.screenshot({ path: resolve(artifactDir, screenshot), fullPage: false, timeout: timeoutMs }), 'owned App failure screenshot', timeoutMs + 100)
        evidence.screenshot = screenshot
      } catch (error) { evidence.screenshotError = errorDetails(error) }
      await save('after-screenshot')
      return evidence
    },
    async dispose() {
      try { await persist('dispose', { lastBoundary: lastState?.boundary }) }
      finally { for (const release of listeners) release() }
    },
  }
}

/** Native negative controls use separate owned App pages. Deliberate faults
 * never reload/recover the real paint scenario or discard its history. */
export async function runOwnedAppPageControls({ browser, expectedUrl, artifactDir }) {
  const controls = []
  for (const fault of ['missing-api', 'wrong-api', 'same-url-reload']) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
    const prefix = `point-paint-app-control-${fault}`
    const app = createOwnedAppPage({ page, expectedUrl, artifactDir, prefix })
    let primary, cleanupFailure
    try {
      await app.install(); await page.goto(expectedUrl); const before = await app.start()
      if (fault === 'same-url-reload') await page.reload({ waitUntil: 'domcontentloaded' })
      else await page.evaluate((fault) => {
        if (fault === 'missing-api') delete window.stzAppLabels
        else window.stzAppLabels = { state: () => { throw new Error('Wrong API must never execute') } }
      }, fault)
      let rejected
      try { await app.checkpoint(`control-${fault}`) } catch (error) { rejected = error }
      assert.ok(rejected, `Native ${fault} must fail continuity`)
      const pattern = fault === 'same-url-reload' ? /generation changed/ : fault === 'missing-api' ? /API missing/ : /API instance changed/
      assert.match(rejected.message, pattern)
      const evidence = await app.failure(rejected, { deliberateNegativeControl: true, fault })
      assert.ok(evidence.snapshot, 'Native negative control retains API-independent failing DOM')
      assert.equal(evidence.screenshot, `${prefix}-failure.png`, 'Native negative control retains its own screenshot')
      assert.equal(evidence.snapshot.pageId, before.pageId)
      if (fault === 'same-url-reload') {
        assert.equal(evidence.snapshot.document.url, before.document.url)
        assert.notEqual(evidence.snapshot.document.generation, before.document.generation)
      }
      const control = { fault, result: 'passed', before, evidence,
        artifacts: [`${prefix}-failure.json`, `${prefix}-failure.png`, `${prefix}-lifecycle.json`] }
      controls.push(control)
      await writeFile(resolve(artifactDir, 'point-paint-app-controls.json'), JSON.stringify({ schema: 1, controls }, null, 2) + '\n')
    } catch (error) { primary = error; await app.failure(error, { deliberateNegativeControl: true, fault }) }
    finally {
      for (const operation of [() => page.close(), () => app.dispose()]) {
        try { await operation() } catch (error) { cleanupFailure ??= error }
      }
    }
    if (primary) throw primary
    if (cleanupFailure) throw cleanupFailure
  }
  return controls
}
