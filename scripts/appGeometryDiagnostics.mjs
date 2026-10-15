import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

export const appGeometryLimits = Object.freeze({ samples: 1024, events: 128, ancestors: 12,
  animations: 16, monitorSamples: 8, recordBytes: 64_000, string: 4000,
  controlFrames: 24, controlEvents: 32, controlScan: 512, controlMatches: 2, hitTargets: 4, stateParse: 256_000 })
const observerKey = '__stzAppGeometryDiagnostics'
const waitOwners = new WeakMap()
const clipped = (value, limit = 4000) => String(value ?? '').slice(0, limit)
const errorDetails = (error) => ({ message: clipped(error?.message ?? error), stack: clipped(error?.stack, 12_000),
  ...(Array.isArray(error?.log) ? { log: error.log.slice(0, 64).map((line) => clipped(line, 500)),
    logTruncated: error.log.length > 64 || error.log.some((line) => String(line).length > 500) } :
    error?.log !== undefined ? { log: clipped(error.log), logTruncated: String(error.log).length > 4000 } : {}),
  messageTruncated: String(error?.message ?? error).length > 4000, stackTruncated: String(error?.stack ?? '').length > 12_000 })

/** DOM observation is always available. Optional native-control evidence reads
 * state only from the original owned document/API; it never calls geometry APIs.
 * Node identities are document-local, so replacement and movement differ. */
export function installAppGeometryObserver({ key = '__stzAppGeometryDiagnostics', limits, nativeControls = false }) {
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
  const controlFrames = [], controlEvents = []
  let droppedControlFrames = 0, droppedControlEvents = 0, lastControlFrame = null
  const tick = (at) => {
    const delta = lastFrame === null ? null : at - lastFrame
    frames++; lastFrame = at
    if (nativeControls && (lastControlFrame === null || at - lastControlFrame >= 100)) {
      lastControlFrame = at
      // Sampling never calls state(). This is a finite ring, not a readiness
      // wait, and timestamps distinguish observed frame gaps from wall time.
      try {
        controlFrames.push({ wall: Date.now(), monotonic: performance.now(), frame: at, delta,
          scroll: { x: window.scrollX, y: window.scrollY }, controls: findControls().groups.slice(0, 3)
            .map(({ name, matches }) => ({ name, matches: matches.slice(0, limits.controlMatches)
              .map((element) => ({ id: identity(element), connected: element.isConnected,
                checked: element.checked, rect: compactRect(element.getBoundingClientRect()) })) })) })
        if (controlFrames.length > limits.controlFrames) { controlFrames.shift(); droppedControlFrames++ }
      } catch (error) { add(`control-frame-unavailable: ${text(error?.message ?? error)}`) }
    }
    if (!stopped) raf = requestAnimationFrame(tick)
  }
  const stop = () => {
    if (stopped) return
    stopped = true; cancelAnimationFrame(raf); clearTimeout(lease)
    raf = null; lease = undefined
    for (const release of listeners.splice(0)) release()
    add('observer-stopped')
  }
  // A lost host must not leave instrumentation running forever. Each successful
  // capture renews this lease; expiry is explicit evidence, never a restart.
  const renew = () => { clearTimeout(lease); if (!stopped) lease = setTimeout(stop, 120_000) }
  const rect = (value) => ({ x: value.x, y: value.y, width: value.width, height: value.height,
    top: value.top, right: value.right, bottom: value.bottom, left: value.left })
  const compactRect = (value) => ({ x: value.x, y: value.y, width: value.width, height: value.height })
  const matrix = (value) => value ? { a: value.a, b: value.b, c: value.c, d: value.d, e: value.e, f: value.f } : null
  const identity = (element) => {
    if (!nodes.has(element)) nodes.set(element, ++nodeIndex)
    return nodes.get(element)
  }
  const node = (element) => {
    if (!element) return null
    identity(element)
    const style = getComputedStyle(element)
    const layout = Object.fromEntries(['display', 'visibility', 'position', 'width', 'height', 'minWidth', 'minHeight',
      'maxWidth', 'maxHeight', 'overflow', 'overflowX', 'overflowY', 'scrollBehavior', 'transform', 'transformOrigin',
      'transitionProperty', 'transitionDuration', 'transitionDelay', 'animationName', 'animationDuration',
      'animationPlayState', 'contain', 'contentVisibility', 'pointerEvents', 'zIndex', 'opacity'].map((name) => [name, text(style[name])]))
    return { id: nodes.get(element), tag: element.localName, domId: text(element.id), class: text(element.getAttribute('class')),
      connected: element.isConnected, rect: rect(element.getBoundingClientRect()),
      screenCTM: typeof element.getScreenCTM === 'function' ? matrix(element.getScreenCTM()) : null,
      scroll: { left: element.scrollLeft, top: element.scrollTop, width: element.scrollWidth, height: element.scrollHeight,
        clientWidth: element.clientWidth, clientHeight: element.clientHeight }, layout }
  }
  const controlNames = ['Enable approximate 3D visibility', 'Auto depth-sort surfaces', 'Show xyz axes in TikZ output',
    'TikZ export mode:', 'theta value', 'phi value', 'zoom value', 'pan x value', 'pan y value']
  const normalizeLabel = (value) => String(value ?? '').slice(0, limits.string).replace(/\s+/g, ' ').trim()
  const controlLabels = (element) => [element.getAttribute('aria-label'),
    ...Array.from(element.labels ?? []).slice(0, 4).map((label) => label.textContent)]
    .filter((value) => value !== null && value !== undefined).map(normalizeLabel)
  const matchesName = (labels, name) => labels.some((label) => name === 'TikZ export mode:' ? label.startsWith(name) : label === name)
  const findControls = () => {
    const candidates = document.querySelectorAll('input[type="checkbox"], select, input[type="number"]')
    const groups = controlNames.map((name) => ({ name, count: 0, matches: [] }))
    for (let i = 0; i < Math.min(candidates.length, limits.controlScan); i++) {
      const element = candidates[i], labels = controlLabels(element)
      for (const group of groups) if (matchesName(labels, group.name)) {
        group.count++
        if (group.matches.length < limits.controlMatches) group.matches.push(element)
      }
    }
    return { groups, scanned: Math.min(candidates.length, limits.controlScan), totalCandidates: candidates.length,
      truncated: candidates.length > limits.controlScan }
  }
  const stateEvidence = () => {
    try { assertOwnership() } catch (error) { return { status: 'unavailable', reason: text(error.message) } }
    try {
      const state = expected.api.state()
      // Strings are summarized/clipped with their original lengths explicit.
      // Large documents/history are never parsed by this diagnostic observer.
      const serialized = (value, max = 800) => ({ type: typeof value, length: typeof value === 'string' ? value.length : null,
        text: String(value ?? '').slice(0, max), truncated: typeof value === 'string' && value.length > max })
      const selection = (value) => {
        if (value === null || value === undefined) return null
        if (typeof value !== 'object') return serialized(value)
        const single = (item) => ({ kind: text(item?.kind).slice(0, 100), id: text(item?.id).slice(0, 300) })
        return { ...single(value), ...(Array.isArray(value.elements) ? { count: value.elements.length,
          elements: value.elements.slice(0, 8).map(single), truncated: value.elements.length > 8 } : {}) }
      }
      const parse = (value) => typeof value === 'string' && value.length <= limits.stateParse ? JSON.parse(value) : null
      const documentValue = parse(state.json), history = parse(state.history), diagram = documentValue?.diagram
      return { status: 'available', labelDocumentRevision: state.labelDocumentRevision,
        uiSettings: serialized(state.uiSettings, 4000), selection: selection(state.selection),
        model: { ...serialized(state.json), ambientDimension: diagram?.ambientDimension ?? null,
          strataCount: Array.isArray(diagram?.strata) ? diagram.strata.length : null,
          freeLabelCount: Array.isArray(diagram?.labels) ? diagram.labels.length : null,
          summaryOmitted: diagram === undefined || diagram === null },
        history: { ...serialized(state.history, 400), pastCount: history?.past?.length ?? null,
          futureCount: history?.future?.length ?? null, summaryOmitted: history === null } }
    } catch (error) { return { status: 'unavailable', reason: text(error?.message ?? error) } }
  }
  const nativeSnapshot = () => {
    const found = findControls(), ancestorNodes = new Map()
    // Keep the native extension inside the existing record budget even when
    // the fixture has both SVG ancestors and expanded camera controls.
    const controlNode = (element) => {
      const value = node(element)
      return { id: value.id, tag: value.tag, domId: value.domId, class: value.class.slice(0, 200),
        connected: value.connected, rect: value.rect, scroll: value.scroll,
        layout: Object.fromEntries(['display', 'visibility', 'position', 'overflowX', 'overflowY', 'scrollBehavior',
          'transform', 'transitionProperty', 'transitionDuration', 'animationName', 'animationDuration', 'contain',
          'contentVisibility', 'pointerEvents', 'zIndex', 'opacity'].map((name) => [name, value.layout[name].slice(0, 200)])) }
    }
    const brief = (element) => element ? { id: identity(element), tag: text(element.localName), domId: text(element.id),
      class: text(element.getAttribute('class')).slice(0, 200), role: text(element.getAttribute('role')).slice(0, 100),
      connected: element.isConnected, rect: compactRect(element.getBoundingClientRect()) } : null
    const controls = found.groups.map(({ name, count, matches }) => ({ name, matchCount: count,
      matches: matches.map((element) => {
        const ancestors = []; let parent = element.parentElement, depth = 0, omittedAncestors = 0
        while (parent && depth++ < limits.ancestors) {
          const id = identity(parent)
          if (!ancestorNodes.has(id) && ancestorNodes.size < limits.ancestors) ancestorNodes.set(id, controlNode(parent))
          if (ancestorNodes.has(id)) ancestors.push(id)
          else omittedAncestors++
          parent = parent.parentElement
        }
        const bounds = element.getBoundingClientRect(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2
        const inViewport = x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight
        const hits = inViewport && typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : []
        return { ...controlNode(element), labels: controlLabels(element).map((label) => label.slice(0, 300)),
          type: text(element.type), value: text(element.value).slice(0, 300), checked: element.type === 'checkbox' ? element.checked : null,
          enabled: !element.matches(':disabled'), ancestors, ancestorsTruncated: !!parent || omittedAncestors > 0,
          associatedLabels: Array.from(element.labels ?? []).slice(0, 2).map(brief),
          hitTest: { x, y, inViewport, targets: hits.slice(0, limits.hitTargets).map(brief), truncated: hits.length > limits.hitTargets } }
      }) }))
    return { state: stateEvidence(), controls, scan: { scanned: found.scanned, totalCandidates: found.totalCandidates, truncated: found.truncated },
      ancestors: [...ancestorNodes.values()], activeFocus: brief(document.activeElement),
      nearby: ['.source-panel', '.copy-controls', '.tikz-export-help', '.camera-panel'].map((selector) => ({ selector, node: brief(document.querySelector(selector)) })),
      frames: { samples: controlFrames.slice(), dropped: droppedControlFrames, intervalMs: 100 },
      events: { samples: controlEvents.slice(), dropped: droppedControlEvents } }
  }
  if (nativeControls) {
    for (const event of ['input', 'change']) {
      const callback = (eventValue) => {
        const element = eventValue.target
        if (!element || typeof element.getAttribute !== 'function') return
        const labels = controlLabels(element), names = controlNames.filter((name) => matchesName(labels, name))
        if (!names.length) return
        controlEvents.push({ event, trusted: eventValue.isTrusted, wall: Date.now(), monotonic: performance.now(),
          names, nodeId: identity(element), connected: element.isConnected,
          checked: element.type === 'checkbox' ? element.checked : null, value: text(element.value).slice(0, 300) })
        if (controlEvents.length > limits.controlEvents) { controlEvents.shift(); droppedControlEvents++ }
      }
      document.addEventListener(event, callback, true)
      listeners.push(() => document.removeEventListener(event, callback, true))
    }
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
      animations, ...(nativeControls ? { nativeControls: nativeSnapshot() } : {}) }
  }
  const identityEvidence = () => {
    const marker = window.__stzOwnedAppDocument, label = document.querySelector('[data-label-id="app-label"] [data-label-state]')
    return { generation: expected.generation, url: expected.url, currentGeneration: marker?.generation ?? null,
      currentUrl: location.href, sameInstance: expected.api === window.stzAppLabels && marker?.api === expected.api,
      stopped, source: label ? text(label.getAttribute('data-label-source')) : null,
      request: label ? text(label.getAttribute('data-label-request')) : null, status: label?.getAttribute('data-label-state') ?? null,
      bounds: label ? text(label.getAttribute('data-label-bounds')) : null,
      attributesTruncated: !!label && ['data-label-source', 'data-label-request', 'data-label-bounds']
        .some((name) => (label.getAttribute(name)?.length ?? 0) > limits.string),
      cleanup: { observerFramePending: raf !== null, observerTimerPending: lease !== undefined, listeners: listeners.length } }
  }
  Object.defineProperty(window, key, { value: { snapshot, stop, assertOwnership, identity: identityEvidence }, configurable: false })
  add('observer-installed'); raf = requestAnimationFrame(tick); renew()
  return { installed: true, generation: expected.generation, url: expected.url }
}

export function readAppGeometryObserver({ key = '__stzAppGeometryDiagnostics' } = {}) {
  if (!window[key]) throw new Error('App geometry observer missing; document was not reacquired')
  return window[key].snapshot()
}

export function stopAppGeometryObserver({ key = '__stzAppGeometryDiagnostics' } = {}) {
  window[key]?.stop()
  for (const wait of window.__stzAppGeometryWaits?.values() ?? []) wait.cancel('App geometry diagnostics disposed')
  window.__stzAppGeometryCancelledWaits?.clear()
  return { identity: window[key]?.identity?.() ?? null, waits: window.__stzAppGeometryWaits?.size ?? 0,
    cancelledTokens: window.__stzAppGeometryCancelledWaits?.size ?? 0 }
}

/** Serialized once into the owned page. Browser timers bound stopped frames;
 * host deadlines additionally bound an unresponsive evaluation/renderer. */
export function waitForAppGeometryInDocument({ token, mode, frames, timeoutMs, identity,
  context, key = '__stzAppGeometryDiagnostics' }) {
  const waits = window.__stzAppGeometryWaits ??= new Map()
  const cancelled = window.__stzAppGeometryCancelledWaits ??= new Map()
  const records = window.__stzAppGeometryWaitRecords ??= new Map()
  const entry = performance.now(), deadline = entry + timeoutMs
  const record = { token, mode, context, clock: 'browser-performance', entry, deadline,
    entryWall: Date.now(), frames: 0, stableFrames: 0, samples: [], droppedSamples: 0, result: 'running',
    limits: { frames: 600, snapshots: 3, progress: 16, activeWaits: 8, retainedWaits: 8 } }
  if (waits.size >= 8) throw new Error('App geometry frame wait budget exceeded')
  if (records.size >= 8) {
    const completed = [...records.keys()].find((candidate) => !waits.has(candidate))
    if (completed !== undefined) records.delete(completed)
  }
  records.set(token, record)
  const stamp = (event, details = {}) => {
    record.samples.push({ event, at: performance.now(), wall: Date.now(), ...details })
    if (record.samples.length > 16) { record.samples.splice(1, 1); record.droppedSamples++ }
  }
  record.entryIdentity = window[key]?.identity?.() ?? null
  stamp('wait-entered')
  if (cancelled.has(token)) {
    const tombstone = cancelled.get(token); cancelled.delete(token)
    record.result = 'cancelled-before-registration'; record.settlement = performance.now()
    record.settlementWall = Date.now()
    record.cleanup = { framePending: false, timerPending: false, mapHasToken: waits.has(token) }
    stamp('late-registration-rejected', { cancelledAt: tombstone.at })
    throw new Error('App frame wait cancelled before browser registration')
  }
  return new Promise((resolve, reject) => {
    let raf, timer, count = 0, stable = 0, previous, finished = false
    const samples = []
    const finish = (error, result) => {
      if (finished) return
      finished = true; clearTimeout(timer); cancelAnimationFrame(raf); waits.delete(token)
      raf = undefined; timer = undefined
      record.result = error ? 'failed' : 'passed'; record.settlement = performance.now(); record.settlementWall = Date.now()
      record.frames = count; record.stableFrames = stable
      record.cleanup = { framePending: false, timerPending: false, mapHasToken: waits.has(token) }
      stamp(error ? 'wait-rejected' : 'wait-completed', { error: error?.message ?? null })
      if (error) reject(error); else resolve({ ...result, timing: record })
    }
    const timeout = () => new Error(`App ${mode === 'stable' ? 'geometry never stabilized' : 'animation frames stalled'} within ${timeoutMs}ms`)
    const guard = () => {
      // Browser and host clocks have separate absolute deadlines. A withheld
      // browser timer cannot authorize a late third frame or delayed snapshot.
      if (performance.now() >= deadline) throw timeout()
      const observer = window[key]
      if (!observer) throw new Error('App geometry observer missing during stability wait')
      observer.assertOwnership?.()
      const current = observer.identity?.()
      if (identity && current && (current.generation !== identity.generation || current.url !== identity.url)) {
        throw new Error('Owned App URL/document/API continuity lost during geometry stability wait')
      }
      if (current?.stopped) throw new Error('App geometry observer stopped before stability wait')
    }
    waits.set(token, { cancel: (reason) => finish(new Error(reason)) })
    const measure = () => {
      const snapshot = window[key].snapshot()
      if (!snapshot.generation || snapshot.generation !== snapshot.observerGeneration || snapshot.url !== snapshot.observerUrl || !snapshot.api.sameInstance
        || (identity && (snapshot.generation !== identity.generation || snapshot.url !== identity.url))) {
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
      record.current = { source: snapshot.labelSource, request: snapshot.labelRequest,
        status: snapshot.labelStatus, bounds: snapshot.labelBounds }
      stamp('frame-sampled', { frame: count, stableFrames: stable,
        generation: snapshot.generation, url: snapshot.url, sameInstance: snapshot.api.sameInstance,
        observerFrames: snapshot.frames.count, observerLastFrame: snapshot.frames.last ?? null })
      return snapshot
    }
    const tick = () => {
      if (finished) return
      try {
        guard(); count++
        const snapshot = mode === 'stable' ? measure() : undefined
        guard()
        if (mode === 'stable' ? stable >= 3 : count >= frames) {
          finish(null, { mode, frames: count, stableFrames: stable, snapshot, samples }); return
        }
        if (count >= 600) throw new Error('App geometry frame wait exceeded 600-frame budget')
        raf = requestAnimationFrame(tick)
      } catch (error) { finish(error) }
    }
    try {
      guard()
      timer = setTimeout(() => { stamp('inner-timer-delivered'); finish(timeout()) }, timeoutMs)
      raf = requestAnimationFrame(tick)
    } catch (error) { finish(error) }
  })
}

export function cancelAppGeometryWait({ token, identity, key = '__stzAppGeometryDiagnostics' }) {
  const observer = window[key]
  if (!observer) throw new Error('Original App observer unavailable during frame cancellation')
  observer.assertOwnership?.()
  const current = observer.identity?.()
  if (identity && current && (current.generation !== identity.generation || current.url !== identity.url)) {
    throw new Error('Original owned App document lost before frame cancellation')
  }
  const waits = window.__stzAppGeometryWaits ??= new Map(), wait = waits.get(token)
  const records = window.__stzAppGeometryWaitRecords ??= new Map()
  const cancelled = window.__stzAppGeometryCancelledWaits ??= new Map()
  const registered = !!wait
  if (wait) wait.cancel('App frame wait host deadline or evaluation failure')
  else if (!records.has(token)) {
    // Cancellation may overtake evaluate entry. Retain a token-specific fence
    // in this original document; a late entry consumes it without scheduling rAF.
    if (cancelled.size >= 8) throw new Error('App geometry cancellation token budget exceeded')
    cancelled.set(token, { at: performance.now(), identity: current ?? identity })
  }
  return { token, cancelled: registered, registered, tombstoned: cancelled.has(token),
    cleanup: records.get(token)?.cleanup ?? { framePending: false, timerPending: false, mapHasToken: waits.has(token) },
    browser: records.get(token) ?? null, identity: current ?? null, at: performance.now(), wall: Date.now() }
}

/** A late registration rejection cannot transport custom Error properties.
 * Read its compact retained record only from the original document, without
 * taking a snapshot, renewing a lease, or restarting any observer. */
export function readAppGeometryWaitRecord({ token, identity, key = '__stzAppGeometryDiagnostics' }) {
  const observer = window[key]
  if (!observer) throw new Error('Original App observer unavailable during wait drain')
  observer.assertOwnership?.()
  const current = observer.identity?.()
  if (identity && current && (current.generation !== identity.generation || current.url !== identity.url)) {
    throw new Error('Original owned App document lost before wait drain')
  }
  return window.__stzAppGeometryWaitRecords?.get(token) ?? null
}

async function waitForAppGeometry(page, mode, { timeoutMs = 2000, frames = 2, identity = waitOwners.get(page),
  token = randomUUID(), context, observeWait, scheduleDeadline, cancellationScheduleDeadline } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) throw new Error('App geometry wait timeout must be in (0, 30000]')
  if (!Number.isInteger(frames) || frames < 1 || frames > 10) throw new Error('App frame count must be in [1, 10]')
  const now = scheduleDeadline?.monotonicNow ?? (() => performance.now())
  const emit = (event, details = {}) => {
    try { observeWait?.({ token, event, host: { wall: Date.now(), monotonic: now() }, ...details }) }
    catch { /* Compact timing evidence never changes operation ownership. */ }
  }
  emit('wait-start', { mode, frames, timeoutMs, hostTimeoutMs: timeoutMs + 100, cancellationTimeoutMs: 250,
    context, identity, clocks: 'host-performance and browser-performance are independent; token pairs endpoints only' })
  let operation, primary
  const scheduler = (expire, budget, owned) => {
    operation = owned
    emit('host-deadline-armed', { operation: owned.snapshot() })
    const deliver = () => { emit('host-timer-delivered'); expire() }
    if (scheduleDeadline) return scheduleDeadline(deliver, budget, owned)
    const timer = setTimeout(deliver, budget)
    return () => clearTimeout(timer)
  }
  scheduler.monotonicNow = now
  try {
    const result = await boundedPointDiagnostic((owned) => {
      operation = owned; emit('evaluation-entered', { operation: owned.snapshot() })
      // Own both raw transport outcomes immediately, including after expiry.
      owned.assertActive('browser-evaluation-start')
      const evaluation = Promise.resolve(page.evaluate(waitForAppGeometryInDocument,
        { token, mode, frames, timeoutMs, identity, context }))
      const active = () => owned.state === 'active' && now() < owned.deadlineMs
      evaluation.then((value) => emit(active() ? 'evaluation-returned' : 'late-fulfillment', { browser: value?.timing }),
        (error) => emit(active() ? 'evaluation-rejected' : 'late-rejection', { error: errorDetails(error) }))
      return evaluation
    }, `App ${mode} frame wait`, timeoutMs + 100, scheduler)
    emit('host-settled', { result: 'passed', operation: operation?.snapshot() })
    return result
  } catch (error) {
    primary = error
    emit('host-settled', { result: 'failed', error: errorDetails(error), operation: operation?.snapshot() })
    let cancellationOperation
    try {
      emit('cancellation-entered')
      const cancelNow = cancellationScheduleDeadline?.monotonicNow ?? (() => performance.now())
      const cancelScheduler = (expire, budget, owned) => {
        cancellationOperation = owned
        emit('cancellation-deadline-armed', { operation: owned.snapshot() })
        const deliver = () => { emit('cancellation-timer-delivered'); expire() }
        if (cancellationScheduleDeadline) return cancellationScheduleDeadline(deliver, budget, owned)
        const timer = setTimeout(deliver, budget)
        return () => clearTimeout(timer)
      }
      cancelScheduler.monotonicNow = cancelNow
      const cancellation = await boundedPointDiagnostic((owned) => {
        const evaluation = Promise.resolve(page.evaluate(cancelAppGeometryWait, { token, identity }))
        const active = () => owned.state === 'active' && cancelNow() < owned.deadlineMs
        evaluation.then((value) => emit(active() ? 'cancellation-evaluation-returned' : 'late-cancellation-fulfillment', { cancellation: value }),
          (secondary) => emit(active() ? 'cancellation-evaluation-rejected' : 'late-cancellation-rejection', { error: errorDetails(secondary) }))
        return evaluation
      }, 'App frame cancellation', 250, cancelScheduler)
      emit('cancellation-returned', { cancellation, operation: cancellationOperation?.snapshot() })
    } catch (secondary) { emit('cancellation-rejected', { error: errorDetails(secondary), operation: cancellationOperation?.snapshot() }) }
    throw primary
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
export function createAppGeometryDiagnostics({ page, artifactDir, timeoutMs = 2000, prefix = 'app-geometry', nativeControls = false }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) throw new Error('App diagnostic timeout must be in (0, 10000]')
  if (!/^[a-z0-9-]+$/i.test(prefix)) throw new Error('Invalid App diagnostic artifact prefix')
  const events = [], index = [], listeners = [], diagnosticErrors = [], waitIndex = [], dirtyWaits = new Set(), recentWaits = new Map()
  let sequence = 0, waitSequence = 0, droppedWaits = 0, droppedEvents = 0, droppedSamples = 0, pendingEvaluation, disposed = false, activeMonitor, failureRecord, capturedFailure = false
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
    diagnosticErrors, failure: failureRecord, disposed, waitIndex, droppedWaits })
  const flushWaits = async () => {
    // Only compact changed wait records, never accumulated App/native reports.
    // Writes happen outside stable-wait ownership and have ordinary I/O bounds.
    for (const record of [...dirtyWaits].slice(0, 8)) {
      dirtyWaits.delete(record)
      await safeWrite(resolve(artifactDir, record.artifact), record)
    }
  }
  const wait = async (mode, details = {}, options = {}) => {
    if (disposed) throw new Error('App geometry diagnostics disposed')
    if (!['stable', 'frames'].includes(mode)) throw new Error('Unknown App geometry wait mode')
    if (waitIndex.length >= appGeometryLimits.samples) {
      droppedWaits++; await persist()
      throw new Error('App geometry wait evidence sample budget exceeded')
    }
    const artifact = `${prefix}-wait-${String(++waitSequence).padStart(4, '0')}.json`
    const entryArtifact = `${prefix}-wait-${String(waitSequence).padStart(4, '0')}-entry.json`
    const context = boundedDetails(details), token = randomUUID(), identity = options.identity ?? waitOwners.get(page)
    const record = { schema: 1, sequence: waitSequence, token, identity, result: 'running', artifact, entryArtifact,
      mode, context, host: host(), events: [], droppedEvents: 0 }
    const entry = { artifact, entryArtifact, token, sequence: waitSequence, mode, context, host: record.host, result: 'running' }
    waitIndex.push(entry)
    recentWaits.set(token, record)
    if (recentWaits.size > 8) recentWaits.delete(recentWaits.keys().next().value)
    // Retain entry/probe independently before asking the renderer to run.
    // Separate immutable entry bytes prevent a late ordinary entry write from
    // overwriting terminal wait disposition. Neither file is phase acceptance.
    await safeWrite(resolve(artifactDir, entryArtifact), record)
    let result, primary
    const observeWait = (event) => {
      record.token ??= event.token; entry.token ??= event.token
      const { browser, cancellation, ...compact } = event
      if (browser) record.browser = browser
      if (cancellation) {
        const { browser: cancelledBrowser, ...outcome } = cancellation
        if (cancelledBrowser) record.browser = cancelledBrowser
        record.cancellation = outcome
      }
      record.events.push(compact)
      if (record.events.length > 32) { record.events.splice(1, 1); record.droppedEvents++ }
      dirtyWaits.add(record)
      options.observeWait?.(event)
    }
    try {
      result = await waitForAppGeometry(page, mode, { ...options, token, identity, context, observeWait })
      record.result = 'passed'
    } catch (error) { primary = error; record.result = 'failed'; record.error = errorDetails(error) }
    // A late raw transport event can append timing, but cannot change this
    // disposition or produce a running/pass checkpoint after host expiration.
    entry.result = record.result; record.completed = host()
    dirtyWaits.add(record); await flushWaits(); await persist()
    if (primary) throw primary
    return result
  }
  const evaluate = async (callback, args) => {
    if (pendingEvaluation) throw new Error('Prior App diagnostic evaluation remains pending; further evaluation omitted')
    const work = Promise.resolve().then(() => page.evaluate(callback, args))
    pendingEvaluation = work
    work.then(() => { if (pendingEvaluation === work) pendingEvaluation = undefined },
      () => { if (pendingEvaluation === work) pendingEvaluation = undefined })
    return boundedPointDiagnostic(() => work, 'App geometry browser observation', timeoutMs)
  }
  async function capture(boundary, details = {}) {
    await flushWaits()
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
    capture, around, wait,
    async drain() {
      for (const record of recentWaits.values()) {
        if (record.result !== 'failed' || record.browser || record.drain || !record.events.some(({ event }) => event === 'late-rejection')) continue
        record.drain = { started: host(), status: 'pending' }
        try {
          const browser = await boundedPointDiagnostic(() => page.evaluate(readAppGeometryWaitRecord,
            { token: record.token, identity: record.identity }), 'App late wait record drain', timeoutMs)
          if (browser) { record.browser = browser; record.drain.status = 'available' }
          else record.drain.status = 'missing'
        } catch (error) { record.drain.status = 'unavailable'; record.drain.error = errorDetails(error) }
        record.drain.completed = host(); dirtyWaits.add(record)
      }
      await flushWaits(); await persist()
    },
    async install() {
      const installed = await evaluate(installAppGeometryObserver, { key: observerKey, limits: appGeometryLimits, nativeControls })
      if (installed.generation && installed.url) waitOwners.set(page, { generation: installed.generation, url: installed.url })
      note('observer-installed', installed); await persist(); return installed
    },
    async failure(error, details = {}) {
      failureRecord ??= { error: errorDetails(error), ...host(), details: boundedDetails(details) }
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
      try { note('observer-stop-returned', await evaluate(stopAppGeometryObserver, { key: observerKey })) }
      catch (error) { note('observer-stop-unavailable', errorDetails(error)) }
      // At most one pending diagnostic evaluate is owned. Its rejection handler
      // remains installed until the caller closes this owned page.
      note('disposed', { pendingEvaluation: !!pendingEvaluation }); await flushWaits(); await persist()
      waitOwners.delete(page)
    },
  }
}
