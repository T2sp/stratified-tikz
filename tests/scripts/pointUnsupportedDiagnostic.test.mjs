import assert from 'node:assert/strict'
import test from 'node:test'
import { runUnsupportedDiagnosticCase } from '../../scripts/pointUnsupportedDiagnostic.mjs'
import { syntheticDiagnosticMeasurement } from './pointUnsupportedDiagnosticFixture.mjs'

// These controls exercise the real orchestrator with synthetic measurements and
// event delivery. They do not establish native browser or six-case acceptance.
function setup(options = {}) {
  const token = 'synthetic-canvas', calls = [], observed = [], secondaryErrors = []
  const ambientDimension = options.ambientDimension ?? 2, shape = options.shape ?? 'ellipse'
  const baseline = syntheticDiagnosticMeasurement({ token, ambientDimension, shape })
  const state = structuredClone(baseline.stateSnapshot)
  const ui = structuredClone(baseline.ui)
  Object.assign(ui.inspector, options.inspector ?? {})
  Object.assign(ui.toolbar, options.toolbar ?? {})
  if (options.selectPressed !== undefined) ui.selectPressed = options.selectPressed
  let installed = false, active = false, latest, nativeEvents = [], measurementCount = 0, inputCount = 0
  const measurement = () => {
    const selected = state.selection?.id === 'app-point'
    const raw = syntheticDiagnosticMeasurement({ token, ambientDimension, shape, selection: state.selection,
      ring: selected ? { cx: 0, cy: 0, radius: 70 } : null })
    raw.stateSnapshot = structuredClone(state)
    raw.ui = structuredClone(ui)
    if (options.obstruct && !ui.toolbar.collapsed) {
      const overlay = { ...raw.bodyClick.hit.target, tag: 'button', canvas: false, canvasRoot: false,
        canvasToken: null, background: false, overlay: true, toolbar: true }
      for (const probe of [raw.bodyClick, raw.warningClick, ...raw.candidates]) probe.hit = { target: overlay, stack: [overlay] }
    }
    if (options.drawerObstruction && ui.inspector.open) {
      const drawer = { ...raw.bodyClick.hit.target, tag: 'button', canvas: false, canvasRoot: false,
        canvasToken: null, background: false, overlay: true, drawer: true }
      raw.warningClick.hit = { target: drawer, stack: [drawer] }
    }
    options.mutateMeasurement?.(raw, { measurementCount, inputCount, state, ui })
    latest = raw
    return structuredClone(raw)
  }
  const readState = async () => {
    calls.push({ type: 'state' })
    options.onReadState?.({ state, ui, inputCount })
    return structuredClone(state)
  }
  const page = {
    async evaluate(callback, argument) {
      calls.push({ type: 'evaluate', name: callback.name })
      if (callback.name === 'installUnsupportedDiagnosticObserver') {
        assert.equal(installed, false); assert.equal(argument.token, token); installed = true; return
      }
      if (callback.name === 'observeUnsupportedDiagnostic') {
        assert.equal(installed, true); measurementCount++; return measurement()
      }
      if (callback.name === 'unsupportedDiagnosticEvents') {
        assert.equal(installed, true)
        active = argument.active
        if (active) nativeEvents = []
        return structuredClone({ events: nativeEvents, errors: [], droppedEvents: 0, canvasCaptureAfterInput: false })
      }
      if (callback.name === 'removeUnsupportedDiagnosticObserver') {
        assert.equal(argument, token); installed = false; active = false
        if (options.cleanupError) throw options.cleanupError
        return
      }
      assert.fail(`Unowned browser evaluation: ${callback.name}`)
    },
    getByRole(role, query) {
      assert.equal(role, 'button'); assert.equal(query.exact, true)
      return {
        async count() { return 1 },
        async click(clickOptions) {
          assert.equal(clickOptions.timeout, 5000)
          calls.push({ type: 'control', name: query.name })
          const error = options.controlError?.(query.name, { state, ui, inputCount })
          if (error) throw error
          if (query.name === 'Select') ui.selectPressed = 'true'
          else if (query.name === 'Expand preview toolbar') ui.toolbar.collapsed = false
          else if (query.name === 'Collapse preview toolbar') ui.toolbar.collapsed = true
          else if (query.name === 'Open inspector drawer') ui.inspector.open = true
          else if (query.name === 'Close inspector drawer') ui.inspector.open = false
          else assert.fail(`Unowned UI action ${query.name}`)
        },
      }
    },
    locator(selector) {
      return { async waitFor(waitOptions) {
        assert.equal(waitOptions.timeout, 5000)
        const attached = selector === '#preview-inspector-drawer' ? ui.inspector.open
          : selector.startsWith('.preview-toolbar-overlay-stack') ? (selector.includes(':not') ? !ui.toolbar.collapsed : ui.toolbar.collapsed)
          : !ui.toolbar.collapsed
        assert.equal(attached, waitOptions.state === 'visible')
      } }
    },
    mouse: { async click(x, y) {
      assert.equal(installed, true); assert.equal(active, true)
      const kind = ['body', 'far', 'warning'][inputCount++]
      calls.push({ type: 'input', kind, x, y })
      const probe = kind === 'far' ? latest.candidates.find((candidate) => candidate.name === 'left') : latest[`${kind}Click`]
      assert.ok(probe, 'The synthetic far route is the measured left candidate')
      assert.equal(x, probe.screen.x); assert.equal(y, probe.screen.y)
      if (options.nativeError) throw options.nativeError
      const root = probe.hit.stack.find((target) => target.canvasRoot)
      nativeEvents = ['pointerdown', 'pointerup', 'click'].map((type, order) => {
        const captured = options.farCapture && kind === 'far' && order > 0
        const target = captured ? root : probe.hit.target
        return { type, order, trusted: true, x, y, pointerId: 11, pointerType: 'mouse', button: 0,
          altKey: false, shiftKey: false, ctrlKey: false, metaKey: false,
          canvasHasPointerCapture: !!captured && type === 'pointerup',
          buttons: order === 0 ? 1 : 0, epoch: latest.identity.epoch,
          identity: structuredClone(latest.identity), target: structuredClone(target),
          path: captured ? [structuredClone(root)] : [structuredClone(probe.hit.target),
            ...(kind === 'far' ? [] : [latest.bodyTarget.ownerNode, latest.bodyTarget.ownerGroup]), root],
        }
      })
      options.mutateEvents?.(nativeEvents, { kind, inputCount })
      // A synthetic owner-route control, never proof of production delivery.
      // Background body input cannot invent a successful point selection.
      const target = probe.hit.target
      const ownerRoute = target?.pointId === latest.identity.id && target.ownerToken === latest.identity.ownerToken
        && (kind === 'body' ? target.bodyTarget === true : kind === 'warning' && target.warning === true)
      state.selection = ownerRoute && !options.failSelection ? { kind: 'stratum', id: 'app-point' } : null
    } },
  }
  const diagnose = async ({ stage, entry }) => {
    calls.push({ type: 'evidence', stage }); observed.push({ stage, entry: structuredClone(entry) })
    const error = options.evidenceError?.(stage, entry)
    if (error) throw error
  }
  const args = { page, readState, diagnose, token, secondaryErrors,
    expected: { id: 'app-point', ambientDimension, shape } }
  return { args, calls, observed, state, ui, secondaryErrors, get installed() { return installed } }
}

test('unsupported diagnostic adopts measured left after off-canvas right and refreshes after the visible ring appears', async () => {
  const context = setup()
  const result = await runUnsupportedDiagnosticCase(context.args)
  assert.equal(result.result, 'passed')
  assert.equal(result.rendered.adopted, 'left')
  assert.ok(result.rendered.candidates[0].reasons.includes('outside-svg-viewbox'))
  assert.equal(result.rendered.candidates[1].eligible, true)
  assert.deepEqual(context.calls.filter(({ type }) => type === 'input').map(({ kind }) => kind), ['body', 'far', 'warning'])
  assert.equal(context.calls.some(({ type }) => type === 'control'), false, 'Unobstructed measured route needs no native UI action')
  assert.equal(result.clicks[0].measurement.ring, null)
  assert.equal(result.clicks[1].measurement.ring.radius, 70)
  assert.equal(result.clicks[2].measurement.ring, null)
  assert.deepEqual(result.clicks.map(({ after }) => after.selection), [{ kind: 'stratum', id: 'app-point' }, null, { kind: 'stratum', id: 'app-point' }])
  for (const kind of ['body', 'far', 'warning']) {
    const preparation = context.calls.findIndex(({ type, stage }) => type === 'evidence' && stage === `${kind}-bound-before-click`)
    const input = context.calls.findIndex((call) => call.type === 'input' && call.kind === kind)
    assert.ok(preparation >= 0 && preparation < input, 'Fresh raw coordinates and target are retained before input')
  }
  assert.equal(context.installed, false); assert.deepEqual(context.secondaryErrors, [])
})

test('synthetic unsupported far input retains observed native capture in both ambient dimensions', async () => {
  for (const ambientDimension of [2, 3]) {
    const context = setup({ ambientDimension, shape: 'cylinder', farCapture: true })
    const result = await runUnsupportedDiagnosticCase(context.args)
    assert.equal(result.result, 'passed')
    const action = result.clicks.find(({ kind }) => kind === 'far')
    assert.equal(action.events[0].target.background, true)
    assert.equal(action.events[0].canvasHasPointerCapture, false)
    assert.equal(action.events[1].target.canvasRoot, true)
    assert.equal(action.events[1].canvasHasPointerCapture, true)
    assert.equal(action.events[2].target.canvasRoot, true)
    assert.equal(action.events[2].canvasHasPointerCapture, false)
    assert.equal(action.canvasCaptureAfterInput, false)
    assert.equal(action.after.selection, null)
    for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings']) {
      assert.equal(action.after[field], result.preparation.before[field])
    }
    assert.deepEqual(context.calls.filter(({ type }) => type === 'input').map(({ kind }) => kind), ['body', 'far', 'warning'])
    assert.equal(context.installed, false)
  }
})

test('ordinary body route rejects actual null selection and retains after-input state before failure', async () => {
  const context = setup({ failSelection: true })
  await assert.rejects(runUnsupportedDiagnosticCase(context.args), /body selects the owned point/)
  assert.deepEqual(context.calls.filter(({ type }) => type === 'input').map(({ kind }) => kind), ['body'])
  const retained = context.observed.find(({ stage }) => stage === 'body-after-input-before-assertion').entry.clicks[0]
  assert.equal(retained.after.selection, null); assert.equal(retained.selectedId, null)
  assert.equal(retained.afterMeasurement.ring, null); assert.equal(retained.events.length, 3)
  assert.equal(retained.click.hit.target.bodyTarget, true)
  assert.equal(context.installed, false)
})

test('ordinary background body delivery fails before input despite a synthetic owner-selection hook', async () => {
  const context = setup({ mutateMeasurement(raw) { raw.bodyClick.hit = structuredClone(raw.candidates[1].hit) } })
  await assert.rejects(runUnsupportedDiagnosticCase(context.args))
  assert.equal(context.calls.some(({ type }) => type === 'input'), false)
  assert.equal(context.state.selection, null); assert.equal(context.installed, false)
})

test('unsupported diagnostic rejects a final native hit or CTM change despite unchanged authoritative state before any click', async () => {
  for (const corrupt of [
    (raw) => {
      const overlay = { ...raw.bodyClick.hit.target, tag: 'button', canvas: false, canvasRoot: false,
        canvasToken: null, background: false, overlay: true }
      raw.bodyClick.hit = { target: overlay, stack: [overlay] }
    },
    (raw) => { raw.nodeMatrix.e += 10 },
  ]) {
    const context = setup({ mutateMeasurement(raw, { measurementCount, inputCount }) {
      if (measurementCount === 3 && inputCount === 0) corrupt(raw)
    } })
    await assert.rejects(runUnsupportedDiagnosticCase(context.args))
    assert.equal(context.calls.some(({ type }) => type === 'input'), false)
    const observed = context.observed.find(({ stage }) => stage === 'body-input-measured-before-assertion').entry
    assert.deepEqual(observed.clicks[0].inputMeasurement.stateSnapshot, observed.clicks[0].before)
    assert.equal(observed.clicks[0].inputMeasurement.identity.ownerToken, observed.rendered.identity.ownerToken)
    assert.equal(context.state.selection, null)
    assert.equal(context.installed, false)
  }
})

test('unsupported diagnostic retains all invalid measured candidates and fails without trial clicks', async () => {
  const context = setup({ mutateMeasurement(raw) {
    for (const candidate of raw.candidates) candidate.hit = { target: null, stack: [] }
  } })
  await assert.rejects(runUnsupportedDiagnosticCase(context.args), /eligible|negative candidate/i)
  assert.equal(context.calls.some(({ type }) => type === 'input'), false)
  const retained = context.observed.at(-1).entry.latestMeasurement
  assert.equal(retained.candidates.length, 4)
  assert.ok(retained.candidates.every(({ eligible, reasons }) => !eligible && reasons.includes('missing-native-target')))
  assert.equal(retained.farClick, null)
  assert.equal(context.installed, false)
})

test('unsupported diagnostic accesses native Select before measured toolbar collapse and restores only its owned UI changes', async () => {
  const context = setup({ toolbar: { collapsed: true }, selectPressed: 'false', obstruct: true })
  const result = await runUnsupportedDiagnosticCase(context.args)
  assert.deepEqual(context.calls.filter(({ type }) => type === 'control').map(({ name }) => name), [
    'Expand preview toolbar', 'Select', 'Collapse preview toolbar',
  ])
  assert.equal(context.ui.toolbar.collapsed, true)
  assert.equal(result.preparation.uiBefore.toolbar.collapsed, true)
  assert.equal(result.preparation.uiAfter.toolbar.collapsed, true)
  const blocked = context.observed.find(({ stage }) => stage === 'select-prepared-resolved')
  assert.ok(blocked.entry.latestMeasurement.candidates.every(({ eligible }) => !eligible))
  assert.equal(result.rendered.adopted, 'left')
  assert.equal(context.installed, false)
})

test('unsupported diagnostic closes an actually obstructing owned Inspector and preserves warning selection while restoring it', async () => {
  const context = setup({ inspector: { open: true }, drawerObstruction: true })
  const result = await runUnsupportedDiagnosticCase(context.args)
  assert.deepEqual(context.calls.filter(({ type }) => type === 'control').map(({ name }) => name), ['Close inspector drawer', 'Open inspector drawer'])
  assert.equal(context.ui.inspector.open, true)
  assert.deepEqual(result.restoration.after.selection, { kind: 'stratum', id: 'app-point' })
})

test('unsupported diagnostic retains an open Inspector when it covers only a rejected candidate', async () => {
  const context = setup({ inspector: { open: true }, mutateMeasurement(raw) {
    const drawer = { ...raw.bodyClick.hit.target, canvas: false, canvasRoot: false, canvasToken: null,
      tag: 'aside', background: false, overlay: true, drawer: true }
    raw.candidates[0].hit = { target: drawer, stack: [drawer] }
  } })
  const result = await runUnsupportedDiagnosticCase(context.args)
  assert.equal(result.rendered.adopted, 'left')
  assert.equal(context.calls.some(({ type }) => type === 'control'), false)
  assert.equal(context.ui.inspector.open, true)
})

test('unsupported diagnostic rejects stale owner, epoch, state and projected CTM before the next input', async () => {
  const controls = [
    ['owner', (raw) => { raw.identity.ownerToken = JSON.stringify(['point-node', raw.identity.epoch - 1, 'app-point']) }],
    ['epoch', (raw) => { raw.identity.epoch-- }],
    ['state', (raw) => { raw.stateSnapshot.history = JSON.stringify({ changed: true }) }],
    ['CTM', (raw) => { raw.nodeMatrix.e += 20 }],
  ]
  for (const [name, corrupt] of controls) {
    const context = setup({ mutateMeasurement(raw, { inputCount }) { if (inputCount === 1) corrupt(raw) } })
    await assert.rejects(runUnsupportedDiagnosticCase(context.args), undefined, name)
    assert.deepEqual(context.calls.filter(({ type }) => type === 'input').map(({ kind }) => kind), ['body'], `${name} staleness must stop before far input`)
    assert.equal(context.installed, false)
  }
})

test('unsupported diagnostic rejects actual native event misdelivery or wrong epoch immediately after body input', async () => {
  for (const corrupt of [
    (events) => { events[0].target.canvasToken = 'unrelated-canvas' },
    (events) => { events[1].epoch-- },
  ]) {
    const context = setup({ mutateEvents: corrupt })
    await assert.rejects(runUnsupportedDiagnosticCase(context.args))
    assert.deepEqual(context.calls.filter(({ type }) => type === 'input').map(({ kind }) => kind), ['body'])
    const action = context.observed.at(-1).entry.clicks[0]
    assert.equal(action.events.length, 3)
    assert.equal(context.installed, false)
  }
})

test('unsupported diagnostic rechecks actual far hit after body selection and stops when its current route is obstructed', async () => {
  const context = setup({ mutateMeasurement(raw, { inputCount }) {
    if (inputCount !== 1) return
    for (const candidate of raw.candidates) {
      const target = { ...raw.bodyClick.hit.target, pointId: 'app-point', ownerToken: raw.identity.ownerToken,
        tag: 'circle', background: false, ring: true }
      candidate.hit = { target, stack: [target] }
    }
  } })
  await assert.rejects(runUnsupportedDiagnosticCase(context.args), /eligible|negative candidate/i)
  assert.deepEqual(context.calls.filter(({ type }) => type === 'input').map(({ kind }) => kind), ['body'])
  const fresh = context.observed.find(({ stage }) => stage === 'far-fresh-before-input-resolved').entry.latestMeasurement
  assert.equal(fresh.ring.radius, 70)
  assert.ok(fresh.candidates.every(({ eligible, reasons }) => !eligible && reasons.includes('not-owned-canvas-background')))
  assert.equal(context.installed, false)
})

test('unsupported native input failure survives evidence, owned restoration and listener cleanup failures', async () => {
  const primary = new Error('first native mouse failure')
  const context = setup({ inspector: { open: true }, drawerObstruction: true, nativeError: primary,
    cleanupError: new Error('observer cleanup failure'),
    controlError(name) { if (name === 'Open inspector drawer') return new Error('owned drawer restore failure') },
    evidenceError(stage, entry) { if (entry.clicks[0]?.error || stage === 'finished') return new Error('secondary evidence failure') },
  })
  await assert.rejects(runUnsupportedDiagnosticCase(context.args), (error) => error === primary)
  assert.deepEqual(context.calls.filter(({ type }) => type === 'input').map(({ kind }) => kind), ['body'])
  assert.ok(context.secondaryErrors.some((message) => message.includes('observer cleanup failure')))
  assert.ok(context.secondaryErrors.some((message) => message.includes('owned drawer restore failure')))
  assert.ok(context.secondaryErrors.some((message) => message.includes('secondary evidence failure')))
  assert.equal(context.installed, false)
  assert.equal(context.observed.at(-1).entry.result, 'observed')
})
