import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

export const appGeometryLimits = Object.freeze({ samples: 1024, events: 128, ancestors: 12,
  animations: 16, monitorSamples: 8, recordBytes: 64_000, string: 4000 })
const observerKey = '__stzAppGeometryDiagnostics'
const clipped = (value, limit = 4000) => String(value ?? '').slice(0, limit)
const errorDetails = (error) => ({ message: clipped(error?.message ?? error), stack: clipped(error?.stack, 12_000) })

/** This observer reads the actual DOM, never the fixture state/geometry API.
 * Node identities are document-local, so replacement and movement differ. */
export function installAppGeometryObserver({ key = '__stzAppGeometryDiagnostics', limits }) {
  if (window[key]) throw new Error('App geometry observer is already installed; do not reacquire a replaced document')
  const nodes = new WeakMap(), events = [], listeners = []
  let nodeIndex = 0, frames = 0, lastFrame = null, raf = null, stopped = false, droppedEvents = 0, lease
  const owned = window.__stzOwnedAppDocument
  const expected = { generation: owned?.generation ?? null, api: owned?.api, url: location.href }
  const assertOwnership = () => {
    const marker = window.__stzOwnedAppDocument
    if (location.href !== expected.url || !expected.generation || marker?.generation !== expected.generation
      || expected.api !== window.stzAppLabels || marker.api !== expected.api || typeof expected.api?.state !== 'function') {
      throw new Error('Owned App continuity lost during condition wait')
    }
  }
  const text = (value) => String(value ?? '').slice(0, limits.string)
  const add = (event) => {
    events.push({ event, wall: Date.now(), monotonic: performance.now(), visibility: document.visibilityState })
    if (events.length > limits.events) { events.shift(); droppedEvents++ }
  }
  const listen = (target, event) => {
    const callback = () => add(event)
    target.addEventListener(event, callback)
    listeners.push(() => target.removeEventListener(event, callback))
  }
  for (const event of ['visibilitychange', 'freeze', 'resume']) listen(document, event)
  for (const event of ['pagehide', 'pageshow']) listen(window, event)
  const tick = (at) => { frames++; lastFrame = at; if (!stopped) raf = requestAnimationFrame(tick) }
  const stop = () => {
    if (stopped) return
    stopped = true; cancelAnimationFrame(raf); clearTimeout(lease)
    for (const release of listeners) release()
    add('observer-stopped')
  }
  // A lost host must not leave instrumentation running forever. Each successful
  // capture renews this lease; expiry is explicit evidence, never a restart.
  const renew = () => { clearTimeout(lease); if (!stopped) lease = setTimeout(stop, 120_000) }
  const rect = (value) => ({ x: value.x, y: value.y, width: value.width, height: value.height,
    top: value.top, right: value.right, bottom: value.bottom, left: value.left })
  const matrix = (value) => value ? { a: value.a, b: value.b, c: value.c, d: value.d, e: value.e, f: value.f } : null
  const node = (element) => {
    if (!element) return null
    if (!nodes.has(element)) nodes.set(element, ++nodeIndex)
    const style = getComputedStyle(element)
    const layout = Object.fromEntries(['display', 'visibility', 'position', 'width', 'height', 'minWidth', 'minHeight',
      'maxWidth', 'maxHeight', 'overflow', 'overflowX', 'overflowY', 'scrollBehavior', 'transform', 'transformOrigin',
      'transitionProperty', 'transitionDuration', 'transitionDelay', 'animationName', 'animationDuration',
      'animationPlayState', 'contain', 'contentVisibility'].map((name) => [name, text(style[name])]))
    return { id: nodes.get(element), tag: element.localName, domId: text(element.id), class: text(element.getAttribute('class')),
      connected: element.isConnected, rect: rect(element.getBoundingClientRect()),
      screenCTM: typeof element.getScreenCTM === 'function' ? matrix(element.getScreenCTM()) : null,
      scroll: { left: element.scrollLeft, top: element.scrollTop, width: element.scrollWidth, height: element.scrollHeight,
        clientWidth: element.clientWidth, clientHeight: element.clientHeight }, layout }
  }
  const snapshot = () => {
    renew()
    const svg = document.querySelector('svg.svg-diagram')
    const label = document.querySelector('[data-label-id="app-label"] [data-label-state]')
    const ancestors = []; let parent = label?.parentElement ?? svg?.parentElement
    while (parent && ancestors.length < limits.ancestors) { ancestors.push(node(parent)); parent = parent.parentElement }
    const marker = window.__stzOwnedAppDocument, api = window.stzAppLabels, visual = window.visualViewport
    const animations = []
    // Bound iteration before materializing animation details. Inspect only the
    // measured nodes and ancestors, not every animation in the document.
    for (const element of [svg, label, document.querySelector('#preview-inspector-drawer')]) {
      if (!element || typeof element.getAnimations !== 'function') continue
      for (const animation of element.getAnimations().slice(0, limits.animations - animations.length)) {
        animations.push({ playState: text(animation.playState), currentTime: typeof animation.currentTime === 'number' ? animation.currentTime : text(animation.currentTime),
          playbackRate: animation.playbackRate, startTime: typeof animation.startTime === 'number' ? animation.startTime : text(animation.startTime),
          target: text(animation.effect?.target?.localName), id: text(animation.id) })
      }
      if (animations.length >= limits.animations) break
    }
    return { wall: Date.now(), monotonic: performance.now(), url: location.href, readyState: document.readyState,
      generation: marker?.generation ?? null, observerGeneration: expected.generation, observerUrl: expected.url,
      api: { type: typeof api, stateType: typeof api?.state,
        sameInstance: expected.api !== undefined && expected.api === api && marker?.api === api },
      frames: { count: frames, last: lastFrame, stopped }, visibility: document.visibilityState, hasFocus: document.hasFocus(),
      lifecycle: { events: events.slice(), dropped: droppedEvents },
      labelSource: label ? text(label.getAttribute('data-label-source')) : null,
      labelRequest: label ? text(label.getAttribute('data-label-request')) : null,
      labelAttributesTruncated: !!label && ['data-label-source', 'data-label-request'].some((name) => (label.getAttribute(name)?.length ?? 0) > limits.string),
      labelStatus: label?.getAttribute('data-label-state') ?? null,
      labelBounds: label?.getAttribute('data-label-bounds') ?? null,
      svg: node(svg), label: node(label), ancestors, ancestorsTruncated: parent !== null && parent !== undefined,
      viewBox: svg?.getAttribute('viewBox') ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio,
        documentWidth: document.documentElement.clientWidth, documentHeight: document.documentElement.clientHeight,
        visual: visual ? { width: visual.width, height: visual.height, offsetLeft: visual.offsetLeft, offsetTop: visual.offsetTop,
          pageLeft: visual.pageLeft, pageTop: visual.pageTop, scale: visual.scale } : null },
      scroll: { x: window.scrollX, y: window.scrollY },
      inspector: node(document.querySelector('#preview-inspector-drawer')),
      camera: { toggle: node(document.querySelector('.camera-summary-toggle')),
        expanded: document.querySelector('.camera-summary-toggle')?.getAttribute('aria-expanded') ?? null,
        fields: Array.from(document.querySelectorAll('input[aria-label^="pan "]')).slice(0, 3)
          .map((input) => ({ name: text(input.getAttribute('aria-label')), value: text(input.value), rect: rect(input.getBoundingClientRect()) })) },
      animations }
  }
  Object.defineProperty(window, key, { value: { snapshot, stop, assertOwnership }, configurable: false })
  add('observer-installed'); raf = requestAnimationFrame(tick); renew()
  return { installed: true, generation: expected.generation }
}

export function readAppGeometryObserver({ key = '__stzAppGeometryDiagnostics' } = {}) {
  if (!window[key]) throw new Error('App geometry observer missing; document was not reacquired')
  return window[key].snapshot()
}

export function stopAppGeometryObserver({ key = '__stzAppGeometryDiagnostics' } = {}) {
  window[key]?.stop()
  for (const wait of window.__stzAppGeometryWaits?.values() ?? []) wait.cancel('App geometry diagnostics disposed')
}

/** Serialized once into the owned page. Browser timers bound stopped frames;
 * host deadlines additionally bound an unresponsive evaluation/renderer. */
export function waitForAppGeometryInDocument({ token, mode, frames, timeoutMs, key = '__stzAppGeometryDiagnostics' }) {
  const waits = window.__stzAppGeometryWaits ??= new Map()
  if (waits.size >= 8) throw new Error('App geometry frame wait budget exceeded')
  return new Promise((resolve, reject) => {
    let raf, timer, count = 0, stable = 0, previous, finished = false
    const samples = []
    const finish = (error, result) => {
      if (finished) return
      finished = true; clearTimeout(timer); cancelAnimationFrame(raf); waits.delete(token)
      if (error) reject(error); else resolve(result)
    }
    waits.set(token, { cancel: (reason) => finish(new Error(reason)) })
    const measure = () => {
      const observer = window[key]
      if (!observer) throw new Error('App geometry observer missing during stability wait')
      const snapshot = observer.snapshot()
      if (!snapshot.generation || snapshot.generation !== snapshot.observerGeneration || snapshot.url !== snapshot.observerUrl || !snapshot.api.sameInstance) {
        throw new Error('Owned App URL/document/API continuity lost during geometry stability wait')
      }
      if (snapshot.labelAttributesTruncated) throw new Error('App source/request exceeds geometry stability evidence budget')
      if (snapshot.frames.stopped) throw new Error('App geometry observer stopped before stability wait')
      for (const target of [snapshot.svg, snapshot.label, ...snapshot.ancestors]) {
        if (!target?.connected || !Object.values(target.rect).every(Number.isFinite)
          || target.rect.width <= 0 || target.rect.height <= 0
          || (target.screenCTM && !Object.values(target.screenCTM).every(Number.isFinite))) {
          throw new Error('Missing or nonfinite App geometry during stability wait')
        }
      }
      if (!snapshot.svg.screenCTM || !snapshot.label.screenCTM) throw new Error('Missing App client transform during stability wait')
      const geometryNode = (node) => node && ({ id: node.id, rect: node.rect, screenCTM: node.screenCTM, scroll: node.scroll,
        layout: node.layout })
      const comparison = JSON.stringify({ generation: snapshot.generation, url: snapshot.url,
        labelSource: snapshot.labelSource, labelRequest: snapshot.labelRequest, labelStatus: snapshot.labelStatus,
        labelBounds: snapshot.labelBounds, svg: geometryNode(snapshot.svg), label: geometryNode(snapshot.label),
        ancestors: snapshot.ancestors.map(geometryNode), inspector: geometryNode(snapshot.inspector),
        camera: snapshot.camera, viewBox: snapshot.viewBox, viewport: snapshot.viewport, scroll: snapshot.scroll })
      stable = previous === comparison ? stable + 1 : 1
      previous = comparison
      samples.push(snapshot); if (samples.length > 3) samples.shift()
      return snapshot
    }
    const tick = () => {
      if (finished) return
      try {
        count++
        const snapshot = mode === 'stable' ? measure() : undefined
        if (mode === 'stable' ? stable >= 3 : count >= frames) {
          finish(null, { mode, frames: count, stableFrames: stable, snapshot, samples }); return
        }
        if (count >= 600) throw new Error('App geometry frame wait exceeded 600-frame budget')
        raf = requestAnimationFrame(tick)
      } catch (error) { finish(error) }
    }
    timer = setTimeout(() => finish(new Error(`App ${mode === 'stable' ? 'geometry never stabilized' : 'animation frames stalled'} within ${timeoutMs}ms`)), timeoutMs)
    raf = requestAnimationFrame(tick)
  })
}

export function cancelAppGeometryWait({ token }) {
  window.__stzAppGeometryWaits?.get(token)?.cancel('App frame wait host deadline or evaluation failure')
}

async function waitForAppGeometry(page, mode, { timeoutMs = 2000, frames = 2 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) throw new Error('App geometry wait timeout must be in (0, 30000]')
  if (!Number.isInteger(frames) || frames < 1 || frames > 10) throw new Error('App frame count must be in [1, 10]')
  const token = randomUUID()
  try {
    return await boundedPointDiagnostic(() => page.evaluate(waitForAppGeometryInDocument,
      { token, mode, frames, timeoutMs }), `App ${mode} frame wait`, timeoutMs + 100)
  } catch (error) {
    // The initial evaluate retains its rejection handler after a host deadline.
    // Cancel work in a responsive document; never wait indefinitely for cleanup.
    await boundedPointDiagnostic(() => page.evaluate(cancelAppGeometryWait, { token }), 'App frame cancellation', 250).catch(() => {})
    throw error
  }
}
export const waitForAppFrames = (page, options) => waitForAppGeometry(page, 'frames', options)
export const waitForStableAppGeometry = (page, options) => waitForAppGeometry(page, 'stable', options)

/** Page and locator evaluations do not have Playwright's action timeout.
 * Keep one-shot geometry reads bounded too, so their caller can reach cleanup.
 * Closing the owned page cancels transport work; late rejection remains owned. */
export function readAppGeometry(target, operation, argument, timeoutMs = 2000) {
  return boundedPointDiagnostic(() => target.evaluate(operation, argument), 'App geometry observation', timeoutMs)
}

/** Always release this page's modifier, preserving a failed down/click as the
 * primary error even when release stalls or fails during page loss. */
export async function clickAppPointer(page, point, alt = false, timeoutMs = 5000) {
  let primary
  try {
    if (alt) await boundedPointDiagnostic(() => page.keyboard.down('Alt'), 'App Alt down', timeoutMs)
    await boundedPointDiagnostic(() => page.mouse.click(point.x, point.y), 'App native pointer click', timeoutMs)
  } catch (error) { primary = error }
  if (alt) {
    try { await boundedPointDiagnostic(() => page.keyboard.up('Alt'), 'App Alt release', timeoutMs) }
    catch (error) { primary ??= error }
  }
  if (primary) throw primary
}

function boundedDetails(value, depth = 0, budget = { bytes: 16_000 }) {
  if (budget.bytes <= 0) return '[byte budget]'
  budget.bytes -= 16
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') {
    const result = clipped(value, Math.min(4000, Math.max(0, budget.bytes)))
    budget.bytes -= result.length
    return result.length < value.length ? `${result}[truncated]` : result
  }
  if (depth >= 5) return '[depth budget]'
  if (Array.isArray(value)) return value.slice(-64).map((item) => boundedDetails(item, depth + 1, budget))
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40)
    .map(([key, item]) => [clipped(key, 100), boundedDetails(item, depth + 1, budget)]))
  return clipped(value)
}

/** Evidence only: diagnostic failure never turns a primary operation failure
 * into a screenshot/read/close error, nor counts as geometry acceptance. */
export function createAppGeometryDiagnostics({ page, artifactDir, timeoutMs = 2000, prefix = 'app-geometry' }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) throw new Error('App diagnostic timeout must be in (0, 10000]')
  if (!/^[a-z0-9-]+$/i.test(prefix)) throw new Error('Invalid App diagnostic artifact prefix')
  const events = [], index = [], listeners = [], diagnosticErrors = []
  let sequence = 0, droppedEvents = 0, droppedSamples = 0, pendingEvaluation, disposed = false, activeMonitor, failureRecord, capturedFailure = false
  const host = () => ({ wall: Date.now(), monotonic: performance.now(), url: clipped(page.url()), closed: page.isClosed() })
  const note = (event, details = {}) => {
    events.push({ event, ...host(), details: boundedDetails(details) })
    if (events.length > appGeometryLimits.events) { events.shift(); droppedEvents++ }
  }
  const on = (event, listener) => { page.on(event, listener); listeners.push(() => page.off(event, listener)) }
  on('framenavigated', (frame) => { if (frame === page.mainFrame()) note('main-frame-navigation', { url: frame.url() }) })
  on('close', () => note('close')); on('crash', () => note('crash'))
  on('pageerror', (error) => note('pageerror', errorDetails(error)))
  on('download', (download) => note('download-started', { url: download.url(), filename: download.suggestedFilename() }))
  const safeWrite = async (path, value) => {
    try { await boundedPointDiagnostic(() => writeFile(path, JSON.stringify(value, null, 2) + '\n'), 'App geometry evidence write', timeoutMs) }
    catch (error) { diagnosticErrors.push({ ...host(), error: errorDetails(error) }); if (diagnosticErrors.length > 16) diagnosticErrors.shift() }
  }
  const persist = () => safeWrite(resolve(artifactDir, `${prefix}-index.json`), {
    schema: 1, result: 'diagnostics-only', limits: appGeometryLimits, index, events, droppedEvents, droppedSamples,
    diagnosticErrors, failure: failureRecord, disposed })
  const evaluate = async (callback, args) => {
    if (pendingEvaluation) throw new Error('Prior App diagnostic evaluation remains pending; further evaluation omitted')
    const work = Promise.resolve().then(() => page.evaluate(callback, args))
    pendingEvaluation = work
    work.then(() => { if (pendingEvaluation === work) pendingEvaluation = undefined },
      () => { if (pendingEvaluation === work) pendingEvaluation = undefined })
    return boundedPointDiagnostic(() => work, 'App geometry browser observation', timeoutMs)
  }
  async function capture(boundary, details = {}) {
    const record = { boundary: clipped(boundary, 300), host: host(), details: boundedDetails(details), browser: { status: 'pending' } }
    if (sequence >= appGeometryLimits.samples && (boundary !== 'primary-failure' || capturedFailure)) {
      droppedSamples++; record.browser = { status: 'unavailable', reason: 'sample budget exhausted' }; await persist(); return record
    }
    if (boundary === 'primary-failure') capturedFailure = true
    const artifact = `${prefix}-${String(++sequence).padStart(4, '0')}.json`
    const path = resolve(artifactDir, artifact)
    const entry = { boundary: record.boundary, artifact, host: record.host }
    index.push(entry)
    // This host record survives an evaluation that never returns.
    await safeWrite(path, record); await persist()
    try {
      if (disposed) throw new Error('App geometry diagnostics disposed')
      const snapshot = await evaluate(readAppGeometryObserver, { key: observerKey })
      if (JSON.stringify(snapshot).length > appGeometryLimits.recordBytes) throw new Error('App geometry snapshot exceeds byte budget')
      record.browser = { status: 'available', snapshot }
    } catch (error) { record.browser = { status: 'unavailable', error: errorDetails(error) } }
    record.completed = host(); entry.status = record.browser.status
    await safeWrite(path, record); await persist()
    return record
  }
  async function around(boundary, operation, details = {}, operationTimeoutMs = 30_000) {
    if (activeMonitor) throw new Error('Nested App geometry monitoring is not supported')
    if (!Number.isFinite(operationTimeoutMs) || operationTimeoutMs <= 0) throw new Error('App operation budget must be finite and positive')
    await capture(`${boundary}:before`, details)
    const monitor = { stopped: false, timer: undefined, wake: undefined }
    activeMonitor = monitor
    const started = performance.now()
    const monitoring = (async () => {
      for (const offset of [50, 150, 500, 1500, 4000, 10_000, 20_000, 28_000]) {
        if (monitor.stopped || offset >= operationTimeoutMs) break
        await new Promise((done) => {
          monitor.wake = done; monitor.timer = setTimeout(done, Math.max(0, offset - (performance.now() - started)))
        })
        monitor.wake = undefined; clearTimeout(monitor.timer)
        if (monitor.stopped) break
        await capture(`${boundary}:during`, { ...details, monitorOffset: offset })
      }
    })().catch((error) => note('monitor-unavailable', errorDetails(error)))
    monitor.work = monitoring
    let value, primary
    try {
      // Keep the operation's own 30s Playwright deadline primary. The host bound
      // is a backstop if the renderer/transport never delivers that rejection.
      value = await boundedPointDiagnostic(operation, `App ${boundary}`, operationTimeoutMs + 5000)
    } catch (error) { primary = error }
    finally {
      monitor.stopped = true; clearTimeout(monitor.timer); monitor.wake?.()
      await boundedPointDiagnostic(() => monitoring, 'App geometry monitor drain', timeoutMs * 5 + 100).catch((error) => note('monitor-drain-unavailable', errorDetails(error)))
      activeMonitor = undefined
    }
    await capture(`${boundary}:${primary ? 'failed' : 'after'}`, { ...details,
      elapsedMonotonic: performance.now() - started, ...(primary ? { error: errorDetails(primary) } : {}) })
    if (primary) throw primary
    return value
  }
  return {
    capture, around,
    async install() {
      const installed = await evaluate(installAppGeometryObserver, { key: observerKey, limits: appGeometryLimits })
      note('observer-installed', installed); await persist(); return installed
    },
    async failure(error, details = {}) {
      failureRecord = { error: errorDetails(error), ...host(), details: boundedDetails(details) }
      await persist()
      return capture('primary-failure', failureRecord)
    },
    async dispose() {
      disposed = true
      if (activeMonitor) {
        activeMonitor.stopped = true; clearTimeout(activeMonitor.timer); activeMonitor.wake?.()
        await boundedPointDiagnostic(() => activeMonitor?.work, 'App diagnostic disposal drain', timeoutMs * 5 + 100)
          .catch((error) => note('disposal-drain-unavailable', errorDetails(error)))
      }
      for (const release of listeners) release()
      try { await evaluate(stopAppGeometryObserver, { key: observerKey }) }
      catch (error) { note('observer-stop-unavailable', errorDetails(error)) }
      // At most one pending diagnostic evaluate is owned. Its rejection handler
      // remains installed until the caller closes this owned page.
      note('disposed', { pendingEvaluation: !!pendingEvaluation }); await persist()
    },
  }
}
