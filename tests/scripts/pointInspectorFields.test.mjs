import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DISABLED_BORDER_LINE_STYLE_REJECTION, POINT_PAINT_SELECT_OPTIONS, checkPointInspectorFieldBoundary,
  inspectPointInspectorField, resolvePointInspectorField, selectPointInspectorField,
} from '../../scripts/pointInspectorFields.mjs'

// Selector-aware doubles verify orchestration, bounds and failure ownership.
// The correlated disabled fixture models the observed wrapping-label result;
// these doubles do not reimplement Playwright's state/retargeting algorithm.
// The registered native App paint scenario exercises cloned production markup.
function inspectorFixture(overrides = {}) {
  const state = {
    inspectorCount: 1, inspectorVisible: true, inspectorEnabled: true,
    captionCount: 1, captionVisible: true, wrapperCount: 1, wrapperVisible: true,
    wrapperEnabled: true, wrapperMatches: true, controlCount: 1, controlVisible: true,
    controlEnabled: true, options: [...POINT_PAINT_SELECT_OPTIONS['Border line style']],
    value: 'solid', caption: 'Border line style', selector: 'select', ...overrides,
  }
  const queries = [], selections = [], enabledQueries = []
  const node = (prefix) => ({
    count: async () => state[`${prefix}Count`],
    isVisible: async () => state[`${prefix}Visible`],
    isEnabled: async () => { enabledQueries.push(prefix); return state[`${prefix}Enabled`] },
    getAttribute: async (attribute) => {
      assert.equal(attribute, 'aria-disabled')
      return state[`${prefix}AriaDisabled`] ?? null
    },
  })
  const control = {
    ...node('control'),
    locator(selector) {
      assert.equal(selector, 'option')
      queries.push(selector)
      return { evaluateAll: async (inspect) => inspect(state.options.map((value) => ({
        value, disabled: state.disabledOptions?.includes(value) ?? false,
      }))) }
    },
    async selectOption(value, options) {
      assert.deepEqual(options, { timeout: 5000 }, 'Native selection is bounded')
      selections.push(value)
      if (state.selectError) throw state.selectError
      if (!state.keepValue) state.value = value
      return state.selectionResult ?? [value]
    },
    inputValue: async () => state.value,
  }
  const wrapper = {
    ...node('wrapper'),
    evaluate: async (inspect) => inspect({ matches: (selector) => {
      assert.equal(selector, '.inspector-field'); return state.wrapperMatches
    } }),
    locator(selector) { assert.equal(selector, state.selector); queries.push(selector); return control },
  }
  const captions = {
    ...node('caption'),
    filter({ hasText }) {
      assert.ok(hasText instanceof RegExp, 'Exact matching only tests caption text')
      assert.equal(hasText.test(state.caption), true)
      assert.equal(hasText.test(`Preset ${state.caption}`), false)
      assert.equal(hasText.test(`${state.caption}solid dashed`), false)
      assert.equal(hasText.test(`${state.caption} must be a finite number greater than 0.`), false)
      assert.equal(hasText.test(`${state.caption} trailing`), false)
      assert.equal(hasText.test(`leading ${state.caption}`), false)
      return captions
    },
    locator(selector) { assert.equal(selector, '..'); queries.push(selector); return wrapper },
  }
  const inspector = {
    ...node('inspector'),
    locator(selector) { assert.equal(selector, '.inspector-field-label'); queries.push(selector); return captions },
  }
  const page = {
    locator(selector) { assert.equal(selector, '#preview-inspector-drawer'); queries.push(selector); return inspector },
  }
  return { page, state, selections, queries, enabledQueries, inspector, captions, wrapper, control }
}

// DOM properties and queried enabled state are deliberately separate inputs.
// These stubs exercise diagnostic naming and lookup guards, not browser state.
function diagnosticFixture(t, overrides = {}) {
  const fixture = inspectorFixture({ controlDisabled: true, wrapperEnabled: false, controlEnabled: false, ...overrides })
  const { state } = fixture
  const previousStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle')
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true,
    value: () => ({ display: 'block', visibility: 'visible' }),
  })
  t.after(() => {
    if (previousStyle) Object.defineProperty(globalThis, 'getComputedStyle', previousStyle)
    else delete globalThis.getComputedStyle
  })
  const element = (prefix, tagName) => ({
    tagName, id: `${prefix}-id`, outerHTML: `<${tagName.toLowerCase()}></${tagName.toLowerCase()}>`,
    textContent: prefix === 'caption' ? state.caption : `${state.caption} solid dashed dotted denselyDotted`,
    getBoundingClientRect: () => ({ width: 160, height: 24 }),
    getAttribute: (attribute) => attribute === 'aria-disabled' ? state[`${prefix}AriaDisabled`] ?? null : null,
    matches: (selector) => {
      assert.equal(selector, ':disabled')
      return prefix === 'control' && state.controlDisabled
    },
  })
  const native = { ...element('control', 'SELECT'), disabled: state.controlDisabled, value: state.value,
    options: state.options.map((value) => ({ value, textContent: value, selected: value === state.value, disabled: false })),
  }
  const wrapper = { ...element('wrapper', 'LABEL'), control: native,
    querySelectorAll: (selector) => { assert.equal(selector, 'select'); return Array(state.controlCount).fill(native) },
    querySelector: (selector) => { assert.equal(selector, 'select'); return state.controlCount ? native : null },
  }
  native.labels = [wrapper]
  for (const [prefix, locator, dom] of [
    ['inspector', fixture.inspector, element('inspector', 'ASIDE')],
    ['caption', fixture.captions, element('caption', 'SPAN')],
    ['wrapper', fixture.wrapper, wrapper], ['control', fixture.control, native],
  ]) {
    locator.evaluateAll = async (inspect, selector) => inspect(Array(state[`${prefix}Count`]).fill(dom), selector)
  }
  fixture.inspector.getByLabel = (caption, options) => {
    assert.equal(caption, state.caption)
    assert.deepEqual(options, { exact: true })
    return { count: async () => 0 }
  }
  const locate = fixture.page.locator
  fixture.page.locator = (selector) => selector.startsWith('[aria-controls="preview-inspector-drawer"]')
    ? { evaluateAll: async (inspect, nativeSelector) => inspect([], nativeSelector) } : locate(selector)
  return fixture
}

for (const [caption, initial, desired] of [
  ['Border line style', 'solid', 'dashed'], ['Border cap', 'butt', 'round'], ['Border join', 'miter', 'bevel'],
]) {
  for (const prefix of ['', 'Preset ']) {
    test(`${prefix}${caption} selects the explicit desired value and re-resolves after change`, async () => {
      const options = POINT_PAINT_SELECT_OPTIONS[caption]
      const fixture = inspectorFixture({ caption: `${prefix}${caption}`, options, value: initial })
      assert.notEqual(initial, desired)
      const result = await selectPointInspectorField(fixture.page, `${prefix}${caption}`, desired, { options })
      assert.deepEqual(result, { options, selection: [desired], value: desired })
      await selectPointInspectorField(fixture.page, `${prefix}${caption}`, initial, { options })
      assert.deepEqual(fixture.selections, [desired, initial])
      assert.equal(fixture.queries.filter((query) => query === '#preview-inspector-drawer').length, 2)
    })
  }
}

for (const caption of ['Border width', 'Border width (pt). [draft] + * ? ^ $ \\']) {
  test(`numeric caption ${caption} resolves only its explicit text input`, async () => {
    const fixture = inspectorFixture({ caption, selector: 'input[type="text"]' })
    assert.equal(await resolvePointInspectorField(fixture.page, caption, fixture.state.selector), fixture.control)
    assert.deepEqual(fixture.selections, [])
    assert.deepEqual(fixture.queries, ['#preview-inspector-drawer', '.inspector-field-label', '..', 'input[type="text"]'])
  })
}

for (const [name, overrides] of [
  ['absent Inspector', { inspectorCount: 0 }], ['duplicate Inspectors', { inspectorCount: 2 }],
  ['hidden Inspector', { inspectorVisible: false }], ['disabled Inspector', { inspectorEnabled: false }],
  ['ARIA disabled Inspector', { inspectorAriaDisabled: 'true' }],
  ['absent caption', { captionCount: 0 }], ['duplicate captions', { captionCount: 2 }],
  ['hidden caption', { captionVisible: false }],
  ['absent wrapper', { wrapperCount: 0 }], ['duplicate wrappers', { wrapperCount: 2 }],
  ['hidden wrapper', { wrapperVisible: false }], ['disabled wrapper', { wrapperEnabled: false }],
  ['ARIA disabled wrapper', { wrapperAriaDisabled: 'true' }], ['wrong wrapper', { wrapperMatches: false }],
  ['absent control', { controlCount: 0 }], ['duplicate controls', { controlCount: 2 }],
  ['hidden control', { controlVisible: false }], ['disabled control', { controlEnabled: false }],
  ['ARIA disabled control', { controlAriaDisabled: 'true' }],
  ['missing option', { options: ['solid', 'dotted', 'denselyDotted'] }],
  ['unexpected option', { options: ['solid', 'dashed', 'dotted', 'denselyDotted', 'extra'] }],
  ['duplicate option', { options: ['solid', 'dashed', 'dashed', 'denselyDotted'] }],
  ['reordered options', { options: ['dashed', 'solid', 'dotted', 'denselyDotted'] }],
  ['disabled desired option', { disabledOptions: ['dashed'] }],
]) {
  test(`field resolver rejects ${name} without selecting`, async () => {
    const fixture = inspectorFixture(overrides)
    await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed', {
      options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
    }))
    assert.deepEqual(fixture.selections, [])
    assert.equal(fixture.state.value, 'solid')
  })
}

test('disabled native select delegates enabled state to its wrapping label and rejects before selection', async () => {
  const fixture = inspectorFixture({ wrapperEnabled: false, controlEnabled: false })
  assert.equal(fixture.state.wrapperCount, 1)
  assert.equal(fixture.state.controlCount, 1)
  assert.equal(fixture.state.wrapperVisible, true)
  assert.equal(fixture.state.controlVisible, true)
  assert.notEqual(fixture.state.value, 'dashed')
  await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed', {
    options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
  }), { ...DISABLED_BORDER_LINE_STYLE_REJECTION,
    message: /^Enabled Inspector field wrapper: Border line style\n/,
  })
  assert.deepEqual(fixture.enabledQueries, ['inspector', 'wrapper'], 'Wrapper rejection precedes native state/action queries')
  assert.deepEqual(fixture.selections, [], 'selectOption is never invoked on the disabled target')
  assert.equal(fixture.state.value, 'solid')
  fixture.state.wrapperEnabled = true
  fixture.state.controlEnabled = true
  await selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed', {
    options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
  })
  assert.deepEqual(fixture.selections, ['dashed'])
  assert.equal(fixture.state.value, 'dashed')
})

for (const [name, overrides, message] of [
  ['independent disabled Inspector', { inspectorEnabled: false }, /^Enabled active Inspector\n/],
  ['independent disabled wrapper', { wrapperEnabled: false }, /^Enabled Inspector field wrapper: Border line style\n/],
  ['disabled native control without label delegation', { controlEnabled: false }, /^Enabled native select for Inspector field: Border line style\n/],
]) {
  test(`${name} retains its own rejection boundary and zero selection attempts`, async () => {
    const fixture = inspectorFixture(overrides)
    await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed', {
      options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
    }), { name: 'AssertionError', code: 'ERR_ASSERTION', actual: false, expected: true, operator: 'strictEqual', message })
    assert.deepEqual(fixture.selections, [])
    assert.equal(fixture.state.value, 'solid')
    if (name === 'independent disabled wrapper') assert.equal(fixture.state.controlEnabled, true)
  })
}

for (const overrides of [{ wrapperEnabled: false, controlEnabled: false }, { controlEnabled: false }]) {
  test(`disabled-control oracle accepts the exact known enabled assertion ${JSON.stringify(overrides)}`, async () => {
    const fixture = inspectorFixture(overrides)
    await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed', {
      options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
    }), DISABLED_BORDER_LINE_STYLE_REJECTION)
    assert.deepEqual(fixture.selections, [])
    assert.equal(fixture.state.value, 'solid')
  })
}

async function rejectionFrom(action) {
  let rejection
  await assert.rejects(action, (error) => { rejection = error; return true })
  return rejection
}

for (const [name, overrides, requested] of [
  ['missing native control', { controlCount: 0 }, 'dashed'],
  ['disabled Inspector', { inspectorEnabled: false }, 'dashed'],
  ['disabled different field', { caption: 'Border cap', wrapperEnabled: false, controlEnabled: false }, 'round'],
  ['missing option', { options: ['solid', 'dotted', 'denselyDotted'] }, 'dashed'],
  ['disabled option', { disabledOptions: ['dashed'] }, 'dashed'],
  ['unavailable requested value', {}, 'unknown'],
]) {
  test(`disabled-control oracle refuses unrelated ${name} rejection`, async () => {
    const fixture = inspectorFixture(overrides)
    const error = await rejectionFrom(selectPointInspectorField(fixture.page, fixture.state.caption, requested, {
      options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
    }))
    await assert.rejects(assert.rejects(Promise.reject(error), DISABLED_BORDER_LINE_STYLE_REJECTION), { code: 'ERR_ASSERTION' })
    assert.deepEqual(fixture.selections, [])
    assert.equal(fixture.state.value, 'solid')
  })
}

for (const error of [
  new Error('arbitrary failure'), new Error('selectOption timed out after 5000ms'),
  new Error('Inspector diagnostic capture failure'),
  new Error('Enabled Inspector field wrapper: Border line style\nfalse !== true'),
]) {
  test(`disabled-control oracle refuses non-assertion failure: ${error.message.split('\n')[0]}`, async () => {
    await assert.rejects(assert.rejects(Promise.reject(error), DISABLED_BORDER_LINE_STYLE_REJECTION), { code: 'ERR_ASSERTION' })
  })
}

test('selection rejects unavailable desired values and absent expected option contract', async () => {
  const fixture = inspectorFixture()
  await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'unknown', {
    options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
  }), /Available native option/)
  await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed'), /Expected native options/)
  assert.deepEqual(fixture.selections, [])
})

for (const value of [undefined, null, 0, true, ['dashed'], { value: 'dashed' }]) {
  test(`selection rejects wrong requested value type ${JSON.stringify(value)} before selectOption`, async () => {
    const fixture = inspectorFixture()
    await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, value, {
      options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
    }), /Available native option/)
    assert.deepEqual(fixture.selections, [])
    assert.equal(fixture.state.value, 'solid')
  })
}

test('diagnostics distinguish a label local predicate from delegated Playwright enabled state', async (t) => {
  const fixture = diagnosticFixture(t)
  const observation = await inspectPointInspectorField(fixture.page, fixture.state.caption, 'select')
  assert.deepEqual(observation.playwrightState, {
    wrapper: { count: 1, enabled: false }, control: { count: 1, enabled: false },
  })
  assert.deepEqual(fixture.enabledQueries, ['wrapper', 'control'])
  const [wrapper] = observation.wrappers, [control] = observation.controls
  assert.equal(wrapper.enabled, true, 'Historical enabled field retains its local DOM meaning')
  assert.equal(control.enabled, false)
  assert.deepEqual(wrapper.localDomState, {
    disabledProperty: null, matchesDisabled: false, ariaDisabled: null, enabledPredicate: true,
  })
  assert.deepEqual(control.localDomState, {
    disabledProperty: true, matchesDisabled: true, ariaDisabled: null, enabledPredicate: false,
  })
  assert.deepEqual(wrapper.labelControl, { tag: 'select', id: 'control-id', disabledProperty: true,
    matchesDisabled: true, ariaDisabled: null, sameAsResolvedControl: true,
  })
  assert.equal(control.labelControl, null)
  assert.match(observation.enabledObservation, /local DOM predicate/)
  assert.equal(observation.exactLabelCount, 0)
  assert.equal(observation.correctedControlCount, 1)
  assert.equal(observation.captionCount, 1)
  assert.equal(observation.labelSemantics, 'exact-associated-label-mismatch-reproduced')
  assert.equal(control.value, 'solid')
  assert.deepEqual(control.options.map(({ value }) => value), POINT_PAINT_SELECT_OPTIONS['Border line style'])
  assert.equal(control.labels[0].outerHTML, wrapper.outerHTML)
  assert.deepEqual(fixture.selections, [])
})

for (const [wrapperCount, controlCount] of [[0, 0], [2, 2], [1, 0], [1, 2], [2, 1]]) {
  test(`diagnostics query enabled only for unique matches: wrapper=${wrapperCount}, control=${controlCount}`, async (t) => {
    const fixture = diagnosticFixture(t, { wrapperCount, controlCount })
    const observation = await inspectPointInspectorField(fixture.page, fixture.state.caption, 'select')
    assert.deepEqual(observation.playwrightState, {
      wrapper: { count: wrapperCount, enabled: wrapperCount === 1 ? false : null },
      control: { count: controlCount, enabled: controlCount === 1 ? false : null },
    })
    assert.deepEqual(fixture.enabledQueries, [
      ...(wrapperCount === 1 ? ['wrapper'] : []), ...(controlCount === 1 ? ['control'] : []),
    ])
    assert.equal(observation.wrappers.length, wrapperCount)
    assert.equal(observation.controls.length, controlCount)
    if (wrapperCount === 1 && controlCount !== 1) assert.equal(observation.wrappers[0].labelControl.sameAsResolvedControl, false)
    assert.deepEqual(fixture.selections, [])
  })
}

test('diagnostics retain DOM observations when a unique enabled-state query fails', async (t) => {
  const fixture = diagnosticFixture(t)
  const failure = new Error('Locator enabled-state query failed')
  fixture.wrapper.isEnabled = async () => { throw failure }
  const observation = await inspectPointInspectorField(fixture.page, fixture.state.caption, 'select')
  assert.deepEqual(observation.playwrightState.wrapper, {
    count: 1, enabled: null, error: { message: failure.message, stack: failure.stack },
  })
  assert.deepEqual(observation.playwrightState.control, { count: 1, enabled: false })
  assert.equal(observation.wrappers[0].enabled, true)
  assert.equal(observation.controls[0].value, 'solid')
  assert.deepEqual(fixture.selections, [])
})

test('diagnostics retain independently disabled wrapper ARIA and enabled native control', async (t) => {
  const fixture = diagnosticFixture(t, { wrapperAriaDisabled: 'true', controlDisabled: false, controlEnabled: true })
  const observation = await inspectPointInspectorField(fixture.page, fixture.state.caption, 'select')
  assert.equal(observation.wrappers[0].localDomState.ariaDisabled, 'true')
  assert.equal(observation.wrappers[0].enabled, false)
  assert.equal(observation.controls[0].enabled, true)
  assert.deepEqual(observation.playwrightState, {
    wrapper: { count: 1, enabled: false }, control: { count: 1, enabled: true },
  })
})

for (const selector of ['input', '*', 'select, input', '#unrelated', 'input[type="number"]']) {
  test(`field resolver rejects nonspecific or unsupported native selector ${selector}`, async () => {
    const fixture = inspectorFixture()
    await assert.rejects(resolvePointInspectorField(fixture.page, fixture.state.caption, selector), /Explicit supported native/)
    assert.deepEqual(fixture.queries, [])
  })
}

for (const overrides of [{ keepValue: true }, { selectionResult: [] }, { selectionResult: ['solid'] }, { selectionResult: ['dashed', 'solid'] }]) {
  test(`selection rejects incorrect native action outcome ${JSON.stringify(overrides)}`, async () => {
    const fixture = inspectorFixture(overrides)
    await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed', {
      options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
    }))
    assert.deepEqual(fixture.selections, ['dashed'])
  })
}

test('native selection preserves the original Playwright error object and call log', async () => {
  const primary = new Error('selectOption failed\nCall log: native action timed out')
  const fixture = inspectorFixture({ selectError: primary })
  await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed', {
    options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
  }), (error) => error === primary)
})

test('clone failure saves primary error before cleanup, even when diagnostics and cleanup fail', async (t) => {
  const primary = new Error('setContent original Playwright call log'), order = [], diagnostics = []
  t.mock.method(console, 'error', () => {})
  const appPage = { locator: (selector) => {
    assert.equal(selector, '#preview-inspector-drawer')
    return { evaluate: async () => '<aside id="preview-inspector-drawer"></aside>' }
  } }
  const page = {
    setContent: async () => { order.push('clone setup'); throw primary },
    locator: () => { throw new Error('capture failure') },
    close: async () => { order.push('close'); throw new Error('cleanup failure') },
  }
  await assert.rejects(checkPointInspectorFieldBoundary({ page: appPage, browser: { newPage: async () => page },
    diagnose: async (details) => { order.push('diagnose'); diagnostics.push(details); throw new Error('write failure') },
  }), (error) => error === primary)
  assert.deepEqual(order, ['clone setup', 'diagnose', 'close'])
  assert.equal(diagnostics[0].error.message, primary.message)
  assert.equal(diagnostics[0].error.stack, primary.stack)
  assert.equal(diagnostics[0].captureError.message, 'capture failure')
  assert.deepEqual(diagnostics[0].checks, [])
})
