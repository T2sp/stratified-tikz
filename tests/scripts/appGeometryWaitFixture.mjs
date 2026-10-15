import { EventEmitter } from 'node:events'
import { createContext, runInContext } from 'node:vm'

const flush = () => new Promise((resolve) => setImmediate(resolve))
const rect = () => ({ x: 1, y: 2, width: 300, height: 200, top: 2, right: 301, bottom: 202, left: 1 })
const matrix = () => ({ a: 1, b: 0, c: 0, d: 1, e: 1, f: 2 })
function eventTarget() {
  const listeners = new Map()
  return { listeners, addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name) } }
}
export function browserDocument() {
  let monotonic = 500, wall = 1_700_000_000_000, next = 0
  const frames = new Map(), timers = new Map(), cancelledFrames = [], cancelledTimers = []
  const element = (tag, attributes = {}) => ({ localName: tag, id: '', isConnected: true, parentElement: null,
    attributes, bounds: rect(), transform: matrix(), style: { overflowY: 'auto', scrollBehavior: 'auto' },
    scrollLeft: 0, scrollTop: 0, scrollWidth: 300, scrollHeight: 1200, clientWidth: 300, clientHeight: 200,
    getAttribute(name) { return this.attributes[name] ?? null }, getBoundingClientRect() { return { ...this.bounds } },
    getScreenCTM() { return this.transform && { ...this.transform } }, getAnimations: () => [] })
  const ancestor = element('div'), svg = element('svg', { viewBox: '0 0 100 100' })
  let inspector = null, cameraToggle = null
  const cameraFields = []
  let label = element('g', { 'data-label-source': '$\\mathord{\\mathrm{i}}$',
    'data-label-request': '["$\\\\mathord{\\\\mathrm{i}}$",1,16.2]', 'data-label-state': 'pending', 'data-label-bounds': '0 0 10 10' })
  svg.parentElement = ancestor; label.parentElement = svg
  const api = { state: () => ({ json: '{}', history: '{}', selection: null }) }
  const location = { href: 'http://localhost/app' }
  const window = { ...eventTarget(), __stzOwnedAppDocument: { generation: 'original-document', api }, stzAppLabels: api,
    innerWidth: 1600, innerHeight: 1200, devicePixelRatio: 1, scrollX: 0, scrollY: 0 }
  const document = { ...eventTarget(), readyState: 'complete', visibilityState: 'visible', hasFocus: () => true,
    documentElement: { clientWidth: 1600, clientHeight: 1200 },
    querySelectorAll: (selector) => selector === 'input[aria-label^="pan "]' ? cameraFields : [],
    querySelector(selector) { return selector === 'svg.svg-diagram' ? svg
      : selector === '[data-label-id="app-label"] [data-label-state]' ? label
        : selector === '#preview-inspector-drawer' ? inspector : selector === '.camera-summary-toggle' ? cameraToggle : null } }
  class BrowserDate extends Date { static now() { return wall } }
  const context = createContext({ window, document, location, Date: BrowserDate, performance: { now: () => monotonic },
    getComputedStyle: (node) => node.style,
    requestAnimationFrame(callback) { const id = ++next; frames.set(id, callback); return id },
    cancelAnimationFrame(id) { cancelledFrames.push(id); frames.delete(id) },
    setTimeout(callback, delay) { const id = ++next; timers.set(id, { callback, at: monotonic + delay, delay }); return id },
    clearTimeout(id) { cancelledTimers.push(id); timers.delete(id) } })
  class Page extends EventEmitter {
    calls = []
    overrides = new Map()
    evaluationListeners = new Set()
    closed = false
    url() { return location.href }
    isClosed() { return this.closed }
    mainFrame() { return this }
    onEvaluate(listener) { this.evaluationListeners.add(listener); return () => this.evaluationListeners.delete(listener) }
    execute(callback, argument) {
      context.argument = argument
      return runInContext(`(${callback.toString()})(argument)`, context)
    }
    async evaluate(callback, argument) {
      if (this.closed) throw new Error('Owned test page is closed; no replacement document evaluation')
      const call = { name: callback.name, argument }
      this.calls.push(call)
      for (const listener of this.evaluationListeners) listener(call)
      const override = this.overrides.get(callback.name)
      return override ? override(callback, argument) : this.execute(callback, argument)
    }
    async close() { this.closed = true; this.emit('close') }
  }
  const page = new Page()
  return { page, context, window, document, location, api, svg, ancestor, frames, timers, cancelledFrames, cancelledTimers,
    get label() { return label }, get monotonic() { return monotonic }, get wall() { return wall },
    replaceLabel() { const replacement = element('g', { ...label.attributes }); replacement.parentElement = svg; label = replacement },
    openInspector() { inspector = element('aside') },
    expandCamera() { cameraToggle = element('button', { 'aria-expanded': 'true' }); const input = element('input', { 'aria-label': 'pan x value' }); input.value = '1'; cameraFields.push(input) },
    advance(ms, wallMs = ms) { monotonic += ms; wall += wallMs },
    async frame(ms = 16) {
      monotonic += ms; wall += ms
      const pending = [...frames.values()]; frames.clear()
      for (const callback of pending) callback(monotonic)
      await flush()
    },
    async deliverTimers() {
      const due = [...timers].filter(([, timer]) => timer.at <= monotonic)
      for (const [id, timer] of due) { timers.delete(id); timer.callback() }
      await flush()
    } }
}
