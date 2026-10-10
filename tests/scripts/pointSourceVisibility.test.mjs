import assert from 'node:assert/strict'
import test from 'node:test'
import { assertHiddenPointVisibilityAction, inspectSourceHiddenPoints, selectHiddenPointVisibility } from '../../scripts/pointSourceVisibility.mjs'
import { syntheticPointSourceVisibilityAction } from './pointSourceVisibilityFixture.mjs'

// Selector-aware DOM doubles exercise the actual read-only inspector and owned
// listener functions. These controls remain synthetic policy tests.
function fixture(overrides = {}) {
  const accepted = syntheticPointSourceVisibilityAction()
  let state = structuredClone(accepted.before.state)
  const settings = JSON.parse(state.uiSettings)
  if (overrides.ambientDimension !== undefined) {
    for (const field of ['json', 'runtimeDiagramJson', 'history']) {
      const payload = JSON.parse(state[field]), diagram = field === 'json' ? payload.diagram : field === 'history' ? payload.present : payload
      diagram.ambientDimension = overrides.ambientDimension
      state[field] = JSON.stringify(payload)
    }
  }
  if (overrides.visibilityEnabled !== undefined) settings.visibility.enabled = overrides.visibilityEnabled
  if (overrides.policy) settings.visibility.pointVisibility = overrides.policy
  state.uiSettings = JSON.stringify(settings)
  const calls = [], diagnostics = [], secondaryErrors = [], listeners = new Map()
  const data = { value: overrides.policy ?? 'dimHidden', outsideValue: 'hideHidden', scrolled: false, ...overrides }
  const node = (tagName, className = '', text = '') => {
    const element = { tagName, className, text, children: [], parentElement: null, isConnected: true,
      scrollTop: 0, scrollLeft: 0, clientWidth: 500, clientHeight: 500, clientLeft: 0, clientTop: 0,
      scrollWidth: 500, scrollHeight: 800,
      get textContent() { return this.children.length ? this.children.map((child) => child.textContent).join('') : this.text },
      get outerHTML() { return `<${this.tagName.toLowerCase()}${this.className ? ` class="${this.className}"` : ''}>${this.children.length ? this.children.map((child) => child.outerHTML).join('') : this.text}</${this.tagName.toLowerCase()}>` },
      getAttribute(attribute) { if (attribute === 'class') return this.className || null; return this.attributes?.[attribute] ?? null },
      matches(query) {
        if (query === ':disabled') return this.disabled === true
        if (query === 'optgroup:disabled') return this.tagName === 'OPTGROUP' && this.disabled === true
        if (query === 'select.toolbar-select') return this.tagName === 'SELECT' && this.className.split(' ').includes('toolbar-select')
        if (query === 'label.tikz-export-mode-control') return this.tagName === 'LABEL' && this.className === 'tikz-export-mode-control'
        if (query === '.source-panel') return this.className.split(' ').includes('source-panel')
        throw new Error(`Unexpected fixture DOM selector: ${query}`)
      },
      closest(query) { for (let current = this; current; current = current.parentElement) if (current.matches(query)) return current; return null },
      querySelector(query) { assert.equal(query, ':scope > span'); return this.children.find((child) => child.tagName === 'SPAN') ?? null },
      getBoundingClientRect() { return this.bounds ?? { x: 0, y: 0, width: 500, height: 500 } },
      addEventListener(type, listener) { listeners.set(type, listener) },
      removeEventListener(type, listener) { assert.equal(listeners.get(type), listener); listeners.delete(type) },
    }
    return element
  }
  const body = node('BODY'), panel = node('ARTICLE', 'workspace-panel source-panel'), header = node('DIV', 'panel-heading')
  const wrapper = node(data.wrapperTag ?? 'LABEL', data.wrapperClass ?? 'tikz-export-mode-control')
  const caption = node('SPAN', '', data.caption ?? 'Hidden points:')
  const select = node(data.controlTag ?? 'SELECT', data.controlClass ?? 'toolbar-select')
  select.disabled = data.disabled ?? false
  select.attributes = { 'aria-disabled': data.ariaDisabled ?? null }
  Object.defineProperty(select, 'value', { get: () => data.value })
  const attach = (parent, child) => { parent.children.push(child); child.parentElement = parent }
  attach(body, panel); attach(panel, header); attach(header, wrapper); attach(wrapper, caption); attach(wrapper, select)
  wrapper.control = data.wrongAssociated ? caption : select
  select.labels = data.wrongAssociated ? [] : [wrapper]
  select.options = (data.options ?? ['dimHidden', 'hideHidden']).map((value) => {
    const option = node('OPTION', '', value === 'dimHidden' ? 'Dim hidden' : 'Hide hidden')
    option.value = value; option.disabled = data.disabledOptions?.includes(value) ?? false
    Object.defineProperty(option, 'selected', { get: () => data.value === value })
    attach(select, option); return option
  })
  select.isConnected = data.connected ?? true
  const originalBounds = { x: 100, y: data.offScroll ? 700 : 100, width: 120, height: 24 }
  for (const element of [wrapper, caption, select]) element.bounds = { ...originalBounds }
  select.style = { display: data.hidden ? 'none' : 'block', visibility: 'visible' }
  header.style = { overflowY: 'auto', overflowX: 'visible' }
  const window = { innerWidth: 1000, innerHeight: 800, stzAppLabels: { state: () => structuredClone(state) } }
  function inDOM(operation) {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const previousStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle')
    Object.defineProperty(globalThis, 'window', { configurable: true, value: window })
    Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true,
      value: (element) => ({ display: 'block', visibility: 'visible', overflowX: 'visible', overflowY: 'visible', ...element.style }) })
    try { return operation() } finally {
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window
      if (previousStyle) Object.defineProperty(globalThis, 'getComputedStyle', previousStyle); else delete globalThis.getComputedStyle
    }
  }
  const locator = (kind, elements) => ({
    count: async () => elements.length,
    evaluateAll: async (operation) => inDOM(() => operation(elements)),
    async evaluate(operation, argument) {
      calls.push(operation.name)
      if (operation.name === 'installHiddenPointObserver' && data.installError) throw data.installError
      return inDOM(() => operation(select, argument))
    },
    filter({ hasText }) {
      assert.equal(kind, 'captions'); assert.ok(hasText instanceof RegExp)
      assert.equal(hasText.test('Hidden points:Dim hiddenHide hidden'), false)
      assert.equal(hasText.test('Unrelated Hidden points:'), false)
      return locator(kind, elements.filter((element) => hasText.test(element.textContent)))
    },
    locator(query) {
      calls.push(query)
      if (kind === 'panels') { assert.equal(query, 'span'); return locator('captions', Array(data.captionCount ?? 1).fill(caption)) }
      if (kind === 'captions') { assert.equal(query, '..'); return locator('wrappers', Array(data.wrapperCount ?? elements.length).fill(wrapper)) }
      assert.equal(kind, 'wrappers'); assert.equal(query, 'select.toolbar-select')
      return locator('controls', Array(data.controlCount ?? elements.length).fill(select).filter((element) => element.matches(query)))
    },
    getByLabel(text, options) {
      assert.equal(kind, 'panels'); assert.equal(text, 'Hidden points:'); assert.deepEqual(options, { exact: true })
      return { count: async () => data.exactLabelCount ?? 0 }
    },
    async scrollIntoViewIfNeeded(options) {
      assert.equal(kind, 'controls'); assert.deepEqual(options, { timeout: 5000 }); calls.push('native-scroll')
      if (data.scrollError) throw data.scrollError
      data.scrolled = true; header.scrollTop = 600
      if (!data.staysOffScroll) for (const element of [wrapper, caption, select]) element.bounds.y = 100
    },
    async selectOption(value, options) {
      assert.equal(kind, 'controls'); assert.deepEqual(options, { timeout: 5000 }); calls.push('native-select')
      if (data.actionError) throw data.actionError
      if (!data.keepValue) data.value = value
      inDOM(() => {
        for (const type of ['input', 'change']) listeners.get(type)?.({ type, isTrusted: false, target: select })
      })
      if (!data.staleSettings) {
        const settings = JSON.parse(state.uiSettings); settings.visibility.pointVisibility = value
        state.uiSettings = JSON.stringify(settings)
      }
      if (data.afterMutation) data.afterMutation(state)
      if (data.afterWorkPlane) data.workPlaneValue = 'yz'
      return data.selectionResult ?? [value]
    },
  })
  const page = {
    locator(query) { calls.push(query); assert.equal(query, '.source-panel'); return locator('panels', Array(data.panelCount ?? 1).fill(panel)) },
    async evaluate(operation, argument) {
      calls.push(operation.name)
      if (operation.name === 'observeSourceVisibilityContext') return {
        workPlaneControls: [{ value: data.workPlaneValue ?? 'xy' }], workPlaneStatus: ['xy at z=0'] }
      if (operation.name === 'readHiddenPointObserver' && data.eventReadError) throw data.eventReadError
      if (operation.name === 'removeHiddenPointObserver' && data.cleanupError) throw data.cleanupError
      return inDOM(() => operation(argument))
    },
  }
  const run = (value = 'dimHidden') => selectHiddenPointVisibility({ page, value, readState: async () => structuredClone(state),
    observePoint: async () => {
      if (data.afterRenderError && calls.includes('native-select')) throw data.afterRenderError
      if (data.renderError) throw data.renderError
      return data.value === 'hideHidden' ? null : structuredClone(accepted.before.rendered)
    }, diagnose: async (record) => {
      diagnostics.push(structuredClone(record))
      if (data.afterDiagnosticError && calls.includes('native-select')) throw data.afterDiagnosticError
      if (data.diagnosticError) throw data.diagnosticError
    }, secondaryErrors, scenario: data.scenario ?? 'point-geometric-visibility', sequence: data.sequence ?? 1 })
  return { page, data, calls, diagnostics, secondaryErrors, listeners, run, get state() { return state } }
}

test('source caption resolves contaminated wrapping label and ignores unrelated option/caption text', async () => {
  const control = fixture()
  const observed = await inspectSourceHiddenPoints(control.page)
  assert.equal(observed.exactLabelCount, 0); assert.equal(observed.correctedControlCount, 1)
  assert.equal(observed.captions[0].text, 'Hidden points:')
  assert.equal(observed.wrappers[0].text, 'Hidden points:Dim hiddenHide hidden')
  assert.equal(observed.controls[0].associatedOwningLabel, true)
  assert.deepEqual(observed.controls[0].options.map(({ value }) => value), ['dimHidden', 'hideHidden'])
  assert.equal(control.calls.includes('.source-panel'), true)
  assert.equal(control.calls.some((call) => call.includes('inspector')), false)
})

test('same-value selection records native input/change without an invented effective transition', async () => {
  const control = fixture(), record = await control.run()
  assertHiddenPointVisibilityAction(record)
  assert.equal(record.before.control.controls[0].value, record.afterAction.control.controls[0].value)
  assert.equal(record.before.state.uiSettings, record.afterAction.state.uiSettings)
  assert.deepEqual(record.afterAction.transition, { priorValue: 'dimHidden', finalValue: 'dimHidden', effective: false })
  assert.deepEqual(record.afterAction.events.events.map(({ trusted }) => trusted), [false, false])
  assert.equal(control.listeners.size, 0)
})

test('both policies are exercised through the same exact owning control and settings', async () => {
  const control = fixture()
  const hide = await control.run('hideHidden'), dim = await control.run('dimHidden')
  assert.equal(hide.afterAction.rendered, null); assert.ok(dim.afterAction.rendered)
  assert.equal(hide.afterAction.control.controls[0].value, 'hideHidden')
  assert.equal(JSON.parse(hide.afterAction.state.uiSettings).visibility.pointVisibility, 'hideHidden')
  assert.equal(JSON.parse(dim.afterAction.state.uiSettings).visibility.pointVisibility, 'dimHidden')
  assert.equal(control.calls.filter((call) => call === 'native-select').length, 2)
  assert.equal(control.data.outsideValue, 'hideHidden', 'Out-of-panel decoy control remains untouched')
})

test('native scroll prepares the internal source header and preserves document/model/UI state', async () => {
  const control = fixture({ offScroll: true }), record = await control.run()
  assert.equal(record.before.control.controls[0].inScrollport, false)
  assert.equal(record.prepared.control.controls[0].inScrollport, true)
  assert.equal(record.prepared.control.controls[0].scrollAncestors[1].scrollTop, 600)
  assert.deepEqual(record.before.state, record.prepared.state)
  assert.equal(control.calls.indexOf('native-scroll') < control.calls.indexOf('native-select'), true)
})

for (const [name, overrides, value] of [
  ['missing panel', { panelCount: 0 }], ['duplicate panel', { panelCount: 2 }],
  ['missing caption', { captionCount: 0 }], ['duplicate caption', { captionCount: 2 }], ['wrong caption', { caption: 'Hidden points: warning' }],
  ['missing wrapper', { wrapperCount: 0 }], ['duplicate wrapper', { wrapperCount: 2 }], ['wrong wrapper tag', { wrapperTag: 'DIV' }],
  ['wrong wrapper class', { wrapperClass: 'inspector-field' }], ['wrong native association', { wrongAssociated: true }],
  ['missing control', { controlCount: 0 }], ['duplicate control', { controlCount: 2 }], ['wrong control', { controlTag: 'INPUT' }],
  ['wrong control class', { controlClass: 'decoy' }], ['hidden control', { hidden: true }], ['disabled control', { disabled: true }],
  ['aria disabled control', { ariaDisabled: 'true' }], ['disconnected control', { connected: false }],
  ['missing requested option', { options: ['dimHidden'] }, 'hideHidden'],
  ['unexpected option', { options: ['dimHidden', 'hideHidden', 'other'] }], ['wrong option order', { options: ['hideHidden', 'dimHidden'] }],
  ['duplicate option', { options: ['dimHidden', 'hideHidden', 'hideHidden'] }],
  ['disabled requested option', { disabledOptions: ['hideHidden'] }, 'hideHidden'], ['unavailable requested value', {}, 'other'],
  ['non-3D document', { ambientDimension: 2 }], ['disabled visibility setting', { visibilityEnabled: false }],
  ['stale control vs setting', { policy: 'hideHidden', value: 'dimHidden' }], ['failed scroll preparation', { offScroll: true, staysOffScroll: true }],
  ['wrong action scenario', { scenario: 'unrelated' }], ['invalid action sequence', { sequence: 0 }],
]) {
  test(`rejects ${name} with precondition raw records and no selection`, async () => {
    const control = fixture(overrides)
    await assert.rejects(control.run(value))
    assert.equal(control.calls.includes('native-select'), false)
    assert.ok(control.diagnostics[0].record.before, 'Observations precede control assertions')
    assert.equal(control.diagnostics.at(-1).boundary, 'hidden-points-failure')
    assert.equal(control.listeners.size, 0)
  })
}

for (const [name, overrides] of [
  ['wrong returned selection', { selectionResult: ['dimHidden'] }], ['unchanged final DOM value', { keepValue: true }],
  ['stale authoritative settings', { staleSettings: true }],
  ['changed model', { afterMutation: (state) => { state.runtimeDiagramJson += ' ' } }],
  ['changed epoch', { afterMutation: (state) => { state.labelDocumentRevision++ } }],
  ['changed history', { afterMutation: (state) => { state.history += ' ' } }],
  ['changed selection', { afterMutation: (state) => { state.selection = { kind: 'stratum', id: 'unrelated' } } }],
  ['changed camera setting', { afterMutation: (state) => { const settings = JSON.parse(state.uiSettings); settings.camera3d.thetaDeg++; state.uiSettings = JSON.stringify(settings) } }],
  ['changed active work plane', { afterWorkPlane: true }],
]) {
  test(`retains after-action evidence before rejecting ${name}`, async () => {
    const control = fixture(overrides)
    await assert.rejects(control.run('hideHidden'))
    assert.equal(control.calls.includes('native-select'), true)
    assert.ok(control.diagnostics.find(({ boundary }) => boundary === 'hidden-points-after-action')?.record.afterAction)
    assert.equal(control.listeners.size, 0)
  })
}

test('primary native action failure survives after-action observer/artifact/listener failures', async () => {
  const primary = new Error('primary select failure')
  const control = fixture({ actionError: primary, eventReadError: new Error('observer read failure'), cleanupError: new Error('listener cleanup failure') })
  await assert.rejects(control.run('hideHidden'), (error) => error === primary)
  assert.ok(control.secondaryErrors.some((error) => error.includes('observer read failure')))
  assert.ok(control.secondaryErrors.some((error) => error.includes('listener cleanup failure')))
})

test('primary native action failure survives actual post-action capture and artifact failures', async () => {
  const primary = new Error('native select primary'), control = fixture({ actionError: primary,
    afterRenderError: new Error('post-action render capture'), afterDiagnosticError: new Error('post-action artifact write'),
    cleanupError: new Error('cleanup failure') })
  await assert.rejects(control.run('hideHidden'), (error) => error === primary)
  assert.ok(control.secondaryErrors.some((error) => error.includes('post-action render capture')))
  assert.ok(control.secondaryErrors.some((error) => error.includes('post-action artifact write')))
})

test('primary failed precondition survives artifact failure and never attempts action', async () => {
  const control = fixture({ disabled: true, diagnosticError: new Error('artifact write failure') })
  await assert.rejects(control.run(), { name: 'AssertionError' })
  assert.equal(control.calls.includes('native-select'), false)
  assert.ok(control.secondaryErrors.some((error) => error.includes('artifact write failure')))
})

test('successful action cannot pass when owned listener cleanup fails', async () => {
  const cleanup = new Error('owned cleanup failure'), control = fixture({ cleanupError: cleanup })
  await assert.rejects(control.run(), (error) => error === cleanup)
})

test('actual rendering capture failure survives diagnostic artifact failure', async () => {
  const primary = new Error('native geometry capture failed'), control = fixture({ renderError: primary, diagnosticError: new Error('artifact failure') })
  await assert.rejects(control.run(), (error) => error === primary)
  assert.equal(control.calls.includes('native-select'), false)
})

for (const [name, mutate] of [
  ['fabricated summary instead of raw record', (record) => { delete record.before; record.passed = true }],
  ['retained action failure', (record) => { record.actionError = { message: 'failed' } }],
  ['unrelated control event', (record) => { record.afterAction.events.events[0].target.sameOwnedControl = false }],
  ['wrong event provenance', (record) => { record.afterAction.events.provenance = 'fixture-summary' }],
  ['missing raw event observations', (record) => { record.afterAction.events.events = [] }],
  ['stale event epoch', (record) => { record.afterAction.events.events[0].labelDocumentRevision-- }],
  ['stale event settings', (record) => { record.afterAction.events.events[0].visibility.enabled = false }],
  ['fabricated changed camera', (record) => { const settings = JSON.parse(record.afterAction.state.uiSettings); settings.camera3d.thetaDeg++; record.afterAction.state.uiSettings = JSON.stringify(settings) }],
  ['unrelated associated label', (record) => { record.prepared.control.controls[0].labels[0].outerHTML = '<label>Unrelated</label>' }],
  ['wrong exact caption', (record) => { record.before.control.captions[0].text = 'Hidden points: warning' }],
  ['incorrect exact-label count', (record) => { record.before.control.exactLabelCount = 1 }],
  ['fake connected control', (record) => { record.afterAction.control.controls[0].connected = false }],
  ['invented effective transition', (record) => { record.afterAction.transition.effective = false }],
]) {
  test(`imported raw contract rejects ${name}`, () => {
    const record = syntheticPointSourceVisibilityAction({ value: 'hideHidden' })
    mutate(record); assert.throws(() => assertHiddenPointVisibilityAction(record))
  })
}

test('independently preserved normalized saved form need not equal runtime form', () => {
  const record = syntheticPointSourceVisibilityAction()
  for (const boundary of [record.before, record.prepared, record.afterAction]) {
    const saved = JSON.parse(boundary.state.json); saved.diagram.camera = { mode: '3d', normalized: true }
    boundary.state.json = JSON.stringify(saved)
  }
  assertHiddenPointVisibilityAction(record)
})
