import assert from 'node:assert/strict'
import test from 'node:test'
import {
  POINT_PAINT_SELECT_OPTIONS, checkPointInspectorFieldBoundary,
  resolvePointInspectorField, selectPointInspectorField,
} from '../../scripts/pointInspectorFields.mjs'

// Selector-aware doubles verify orchestration, bounds and failure ownership.
// They do not implement Playwright label semantics: the registered native App
// paint scenario clones the actual production Inspector to exercise that DOM.
function inspectorFixture(overrides = {}) {
  const state = {
    inspectorCount: 1, inspectorVisible: true, inspectorEnabled: true,
    captionCount: 1, captionVisible: true, wrapperCount: 1, wrapperVisible: true,
    wrapperEnabled: true, wrapperMatches: true, controlCount: 1, controlVisible: true,
    controlEnabled: true, options: [...POINT_PAINT_SELECT_OPTIONS['Border line style']],
    value: 'solid', caption: 'Border line style', selector: 'select', ...overrides,
  }
  const queries = [], selections = []
  const node = (prefix) => ({
    count: async () => state[`${prefix}Count`],
    isVisible: async () => state[`${prefix}Visible`],
    isEnabled: async () => state[`${prefix}Enabled`],
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
  return { page, state, selections, queries, control }
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

test('selection rejects unavailable desired values and absent expected option contract', async () => {
  const fixture = inspectorFixture()
  await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'unknown', {
    options: POINT_PAINT_SELECT_OPTIONS['Border line style'],
  }), /Available native option/)
  await assert.rejects(selectPointInspectorField(fixture.page, fixture.state.caption, 'dashed'), /Expected native options/)
  assert.deepEqual(fixture.selections, [])
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
