import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPointNativeDragEvidence, assertPointCanvasPreparation, dragSelectedPoint, prepareSelectedPointCanvas,
  installPointNativeDragObserver, observePointNativeDrag, removePointNativeDragObserver, setPointNativeDragPhase } from '../../scripts/pointNativeDrag.mjs'
import { syntheticPointNativeDragEvidence, syntheticPointToolbarRevisionRecords } from './pointNativeDragFixture.mjs'
import { observeGeometricSelection } from '../../scripts/pointGeometricSelection.mjs'

// Policy/orchestration doubles. Native Chrome acceptance is retained separately
// by the cumulative App runner; these records make no native-browser claim.
test('synthetic raw evidence accepts the intended handle with captured canvas continuation', () => {
  const evidence = syntheticPointNativeDragEvidence()
  assertPointNativeDragEvidence(evidence)
  assert.equal(evidence.afterAction.observation.events[0].canvasHasPointerCapture, false, 'Capture-phase down may precede the production handler')
  assert.equal(evidence.afterAction.observation.events[2].target.canvasRoot, true, 'Captured continuation reaches the canvas root')
})
test('synthetic raw evidence accepts closed preparation without a close action', () => {
  const evidence = syntheticPointNativeDragEvidence()
  evidence.preparation.inherited.inspector.open = false; evidence.preparation.inherited.inspector.bounds = null
  evidence.preparation.drawerCount = 0; evidence.preparation.closeActions = 0
  assertPointNativeDragEvidence(evidence)
})
test('synthetic raw evidence tolerates bounded native fractional-coordinate quantization', () => {
  const evidence = syntheticPointNativeDragEvidence()
  for (const event of evidence.afterAction.observation.events) { event.client.x += .000025; event.client.y -= .000025 }
  assertPointNativeDragEvidence(evidence)
})
test('synthetic raw evidence supports drag history at its bounded capacity', () => {
  const evidence = syntheticPointNativeDragEvidence()
  const before = JSON.parse(evidence.stateBefore.history), after = JSON.parse(evidence.afterAction.state.history)
  before.past = Array.from({ length: 100 }, (_, index) => ({ ...before.present, marker: index }))
  after.past = [...before.past, before.present].slice(-100)
  const undo = { past: after.past.slice(0, -1), present: before.present, future: [after.present] }
  for (const state of [evidence.stateBefore, evidence.preparation.stateBefore, evidence.preparation.stateAfter, evidence.preparation.statePrepared]) state.history = JSON.stringify(before)
  for (const state of [evidence.toolbarPreparation.stateBefore, evidence.toolbarPreparation.statePrepared,
    ...evidence.toolbarPreparation.actions.flatMap((action) => [action.stateBefore, action.stateAfter])]) state.history = JSON.stringify(before)
  for (const state of [evidence.afterAction.state, evidence.undo.stateBefore, evidence.redo.stateAfter]) state.history = JSON.stringify(after)
  for (const state of [evidence.toolbarRestoration.stateBefore, evidence.toolbarRestoration.stateAfter]) state.history = JSON.stringify(after)
  for (const state of [evidence.undo.stateAfter, evidence.redo.stateBefore]) state.history = JSON.stringify(undo)
  assertPointNativeDragEvidence(evidence)
})

function setRevision(records, revision) {
  for (const record of records) {
    if (revision === undefined) delete record.labelDocumentRevision
    else record.labelDocumentRevision = revision
    if (record.layout?.owner && record.model?.id) record.layout.owner = JSON.stringify(['point-node', revision, record.model.id])
  }
}
function epochRecords(evidence) {
  return [evidence.preparation.stateBefore, evidence.preparation.stateAfter, evidence.preparation.statePrepared,
    evidence.preparation.inherited, evidence.preparation.closed, evidence.preparation.prepared,
    evidence.stateBefore, evidence.before, evidence.afterAction.state, evidence.afterAction.observation,
    evidence.undo.stateBefore, evidence.undo.stateAfter, evidence.undo.observation,
    evidence.redo.stateBefore, evidence.redo.stateAfter, evidence.redo.observation,
    ...evidence.afterAction.observation.events, ...evidence.undo.observation.events, ...evidence.redo.observation.events,
    ...syntheticPointToolbarRevisionRecords(evidence)]
}
function actionRevisionRecords(evidence, action) {
  // Keep the redundant authoritative, observed and successor records consistent
  // so these controls reach the document epoch rule rather than continuity.
  if (action === 'drag') return [evidence.afterAction.state, evidence.afterAction.observation, evidence.undo.stateBefore]
  if (action === 'undo') return [evidence.undo.stateAfter, evidence.undo.observation, evidence.redo.stateBefore]
  return [evidence.redo.stateAfter, evidence.redo.observation]
}
for (const revision of [0, 100]) test(`synthetic movement and native history records retain document epoch ${revision}`, () => {
  const evidence = syntheticPointNativeDragEvidence()
  setRevision(epochRecords(evidence), revision)
  assertPointCanvasPreparation(evidence.preparation, evidence.id)
  assertPointNativeDragEvidence(evidence)
  assert.ok(epochRecords(evidence).every((record) => record.labelDocumentRevision === revision))
  assert.notEqual(evidence.afterAction.state.runtimeDiagramJson, evidence.stateBefore.runtimeDiagramJson)
  assert.equal(evidence.undo.stateAfter.json, evidence.stateBefore.json)
  assert.equal(evidence.redo.stateAfter.json, evidence.afterAction.state.json)
})
const revisionFaults = [['increased', 101], ['decreased', 99], ['missing', undefined], ['null', null],
  ['negative', -1], ['fractional', 100.5], ['string', '100'], ['infinite', Infinity], ['NaN', NaN]]
for (const action of ['drag', 'undo', 'redo']) for (const [name, revision] of revisionFaults) {
  test(`synthetic epoch policy rejects ${name} document revision during ${action}`, () => {
    const evidence = syntheticPointNativeDragEvidence()
    setRevision(actionRevisionRecords(evidence, action), revision)
    const expected = name === 'increased' || name === 'decreased'
      ? new RegExp(`Native point ${action}: same document revision`)
      : /labelDocumentRevision must be a nonnegative integer/
    assert.throws(() => assertPointNativeDragEvidence(evidence), expected)
  })
}
for (const [name, revision] of revisionFaults.slice(2)) test(`synthetic preparation rejects consistently ${name} document epoch`, () => {
  const evidence = syntheticPointNativeDragEvidence()
  setRevision(epochRecords(evidence), revision)
  assert.throws(() => assertPointNativeDragEvidence(evidence), /labelDocumentRevision must be a nonnegative integer/)
})
for (const [name, snapshot] of [
  ['inherited', (e) => e.preparation.inherited], ['closed', (e) => e.preparation.closed],
  ['prepared', (e) => e.preparation.prepared], ['before drag', (e) => e.before],
  ['after drag', (e) => e.afterAction.observation], ['undo', (e) => e.undo.observation], ['redo', (e) => e.redo.observation],
]) test(`synthetic epoch policy rejects ${name} observed-authoritative disagreement`, () => {
  const evidence = syntheticPointNativeDragEvidence()
  snapshot(evidence).labelDocumentRevision++
  assert.throws(() => assertPointNativeDragEvidence(evidence), /observed revision matches authoritative state/)
})
for (const revision of [101, undefined, -1]) test(`synthetic epoch policy rejects inconsistent native event revision ${revision}`, () => {
  const evidence = syntheticPointNativeDragEvidence()
  setRevision([evidence.afterAction.observation.events[2]], revision)
  assert.throws(() => assertPointNativeDragEvidence(evidence), /Native point drag event.*(same document revision|labelDocumentRevision must be a nonnegative integer)/)
})

const rejectionControls = [
  ['open drawer at drag', (e) => { e.before.inspector.open = true }],
  ['a duplicate close action', (e) => { e.preparation.closeActions = 2 }],
  ['false close detachment', (e) => { e.preparation.closedDrawerCount = 1 }],
  ['expanded closed opener', (e) => { e.preparation.openerExpanded = 'true' }],
  ['preparation selection change', (e) => { e.preparation.stateAfter.selection = null }],
  ['preparation history change', (e) => { e.preparation.stateAfter.history = '{}' }],
  ['preparation revision change', (e) => { e.preparation.statePrepared.labelDocumentRevision++ }],
  ['camera preparation change', (e) => { e.preparation.prepared.camera.scale = 5 }],
  ['work-plane preparation change', (e) => { e.preparation.prepared.workPlaneStatus = ['xz-plane at y=5'] }],
  ['unselected handle', (e) => { e.before.selection = null }],
  ['missing handle', (e) => { e.before.handle.count = 0 }],
  ['ambiguous handle', (e) => { e.before.handle.count = 2 }],
  ['detached handle', (e) => { e.before.handle.connected = false }],
  ['wrong handle owner', (e) => { e.before.handle.selectedOwner = 'other-point' }],
  ['wrong handle label', (e) => { e.before.handle.element.ariaLabel = 'Other point' }],
  ['stale coordinate versus CTM', (e) => { e.before.handle.start.x += 20; e.requested.start.x += 20; e.requested.end.x += 20 }],
  ['remaining nondrawer obstruction', (e) => { e.before.elementFromPoint = { tag: 'div', svg: false, drawer: false } }],
  ['bad current hit stack', (e) => { e.before.elementsFromPoint[0] = { tag: 'div', drawer: true } }],
  ['missing screen CTM', (e) => { e.before.handle.screenCTM = null }],
  ['wrong owned canvas', (e) => { e.before.canvas.sameOwnedCanvas = false }],
  ['stale event-boundary CTM', (e) => { e.afterAction.observation.events[0].handleAtPointerDown.screenCTM.e = 30 }],
  ['pointerdown event obstruction', (e) => { e.afterAction.observation.events[0].handleAtPointerDown.hitTarget.drawer = true }],
  ['overlay-only events', (e) => { for (const event of e.afterAction.observation.events) event.target = { tag: 'div', drawer: true } }],
  ['unrelated earlier selection only', (e) => { for (const event of e.afterAction.observation.events) event.phase = 'selection'; e.trustedDown = true; e.trustedDrag = true; e.dragged = true }],
  ['selection events contaminated into drag', (e) => { e.afterAction.observation.events.unshift({ ...e.afterAction.observation.events[0], handleAtPointerDown: undefined }) }],
  ['root pointerdown with fabricated success booleans', (e) => { e.afterAction.observation.events[0].target = { ...e.afterAction.observation.events[2].target }; e.dragged = e.trustedDown = e.trustedDrag = true }],
  ['wrong pointer identity', (e) => { e.afterAction.observation.events[2].pointerId = 2 }],
  ['wrong event owner', (e) => { e.afterAction.observation.events[2].selection.id = 'other' }],
  ['wrong path owner', (e) => { e.afterAction.observation.events[0].path[1].selectedOwner = 'other' }],
  ['untrusted down', (e) => { e.afterAction.observation.events[0].trusted = false }],
  ['untrusted movement', (e) => { e.afterAction.observation.events[2].trusted = false }],
  ['pointer cancellation', (e) => { e.afterAction.observation.events[2].type = 'pointercancel' }],
  ['noncaptured root continuation', (e) => { e.afterAction.observation.events[2].canvasHasPointerCapture = false }],
  ['capture of another pointer', (e) => { e.afterAction.observation.events[0].captureAfterMicrotask = false; e.afterAction.observation.events[1].pointerId = 2 }],
  ['failure to release capture', (e) => { e.afterAction.observation.events.at(-2).captureAfterBubble = true; e.afterAction.observation.captureStates[0].captured = true }],
  ['wrong requested displacement', (e) => { e.requested.end.x++ }],
  ['stale delivered coordinates', (e) => { e.afterAction.observation.events[0].client.x += 20 }],
  ['missing native pointerup', (e) => { e.afterAction.observation.events = e.afterAction.observation.events.filter((event) => event.type !== 'pointerup') }],
  ['dropped events', (e) => { e.afterAction.observation.droppedEvents = 1 }],
  ['unchanged-position false success', (e) => { e.afterAction.state = structuredClone(e.stateBefore); e.dragged = true }],
  ['camera-only change', (e) => { const model = JSON.parse(e.afterAction.state.runtimeDiagramJson); model.camera.scale = 2; e.afterAction.state.runtimeDiagramJson = JSON.stringify(model) }],
  ['another point moved', (e) => { const model = JSON.parse(e.afterAction.state.runtimeDiagramJson); model.strata.push({ ...model.strata[0], id: 'other' }); e.afterAction.state.runtimeDiagramJson = JSON.stringify(model) }],
  ['two effective history commits', (e) => { const history = JSON.parse(e.afterAction.state.history); history.past.push(history.present); e.afterAction.state.history = JSON.stringify(history) }],
  ['unrestored Undo source', (e) => { e.undo.stateAfter.json = e.afterAction.state.json }],
  ['unrestored Redo history', (e) => { e.redo.stateAfter.history = e.stateBefore.history }],
  ['observation owner disagrees with authoritative model', (e) => { e.before.modelPoint.position.x = 40 }],
]
for (const [name, alter] of rejectionControls) test(`synthetic raw drag policy rejects ${name}`, () => {
  const evidence = syntheticPointNativeDragEvidence(); alter(evidence)
  assert.throws(() => assertPointNativeDragEvidence(evidence))
})
for (const field of ['toolbarPreparation', 'toolbarRestoration']) test(`synthetic raw drag policy rejects missing ${field}`, () => {
  const evidence = syntheticPointNativeDragEvidence()
  delete evidence[field]
  assert.throws(() => assertPointNativeDragEvidence(evidence))
})
test('synthetic raw drag policy rejects duplicate native Select records', () => {
  const evidence = syntheticPointNativeDragEvidence()
  evidence.toolbarPreparation.actions.push(structuredClone(evidence.toolbarPreparation.actions[0]))
  assert.throws(() => assertPointNativeDragEvidence(evidence), /One native Select action/u)
})
for (const boundary of ['Select', 'restoration']) for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']) {
  test(`synthetic raw drag policy rejects ${field} mutation during toolbar ${boundary}`, () => {
    const evidence = syntheticPointNativeDragEvidence()
    const record = boundary === 'Select' ? evidence.toolbarPreparation.actions[0] : evidence.toolbarRestoration
    if (field === 'selection') {
      record.stateAfter.selection = { kind: 'stratum', id: 'other-point' }
      record.after.selection = record.stateAfter.selection
    } else if (field === 'labelDocumentRevision') {
      record.stateAfter.labelDocumentRevision++
      record.after.labelDocumentRevision++
      record.after.layout.owner = JSON.stringify(['point-node', record.after.labelDocumentRevision, record.after.model.id])
    } else record.stateAfter[field] += ' '
    assert.throws(() => assertPointNativeDragEvidence(evidence), new RegExp(`preserves ${field}`, 'u'))
  })
}
for (const [name, record] of [['inherited', (e) => e.toolbarPreparation.inherited],
  ['prepared', (e) => e.toolbarPreparation.prepared], ['Select before', (e) => e.toolbarPreparation.actions[0].before],
  ['Select after', (e) => e.toolbarPreparation.actions[0].after], ['restoration before', (e) => e.toolbarRestoration.before],
  ['restoration after', (e) => e.toolbarRestoration.after]]) {
  test(`synthetic raw drag policy rejects toolbar ${name} observed-authoritative epoch disagreement`, () => {
    const evidence = syntheticPointNativeDragEvidence()
    record(evidence).labelDocumentRevision++
    assert.throws(() => assertPointNativeDragEvidence(evidence), /Observed epoch matches authoritative state/u)
  })
}

function orchestration(options = {}) {
  const evidence = syntheticPointNativeDragEvidence(), calls = [], records = [], secondaryErrors = []
  let open = options.closed ? false : true, phase = 'preparation', selected = false, scrolled = false, dragged = false, undone = false, redone = false
  let install = false, cleanup = 0, stateReads = 0, observations = 0, mousePosition, moveAttempted = false
  let toolbarCollapsed = options.toolbarCollapsed ?? false
  const copy = (value) => structuredClone(value)
  const state = () => copy(redone ? evidence.redo.stateAfter : undone ? evidence.undo.stateAfter : dragged && !options.noMovement ? evidence.afterAction.state : evidence.stateBefore)
  const readState = async () => {
    calls.push('state'); stateReads++
    if (options.readErrorAt === stateReads || options.readAfterMoveError && moveAttempted) throw options.readError
    return state()
  }
  const page = {
    async evaluate(operation, argument) {
      calls.push(operation.name)
      if (operation === installPointNativeDragObserver) {
        if (options.installError) throw options.installError
        assert.equal(install, false); install = true; return
      }
      if (operation === removePointNativeDragObserver) { cleanup++; install = false; if (options.cleanupError) throw options.cleanupError; return }
      if (operation === setPointNativeDragPhase) { phase = argument.phase; return }
      if (operation === observeGeometricSelection) {
        const currentState = state(), runtime = JSON.parse(currentState.runtimeDiagramJson)
        return { errors: [], selection: currentState.selection, labelDocumentRevision: currentState.labelDocumentRevision,
          model: runtime.strata.find(({ id }) => id === argument.id), camera: runtime.camera,
          workPlaneControls: [], workPlaneStatus: ['xy-plane at z=0'],
          layout: { owner: JSON.stringify(['point-node', currentState.labelDocumentRevision, argument.id]),
            source: runtime.strata.find(({ id }) => id === argument.id).text, request: 'point-request', bodyRequest: 'point-request' },
          inspector: { open }, tool: { selectPressed: toolbarCollapsed ? null : selected ? 'true' : 'false' },
          toolbar: { overlayCount: 1, collapsed: toolbarCollapsed, floatingCount: toolbarCollapsed ? 0 : 1,
            expandCount: toolbarCollapsed ? 1 : 0, collapseCount: toolbarCollapsed ? 0 : 1,
            quickStyleCount: toolbarCollapsed ? 0 : 1, historyCount: 1 } }
      }
      assert.equal(operation, observePointNativeDrag)
      observations++
      if (options.observeErrorAt === observations || options.observeAfterDragError && dragged) throw options.observeError
      const snapshot = copy(dragged ? evidence.afterAction.observation : open ? evidence.preparation.inherited : selected && scrolled ? evidence.before : evidence.preparation.closed)
      snapshot.phase = phase; snapshot.inspector.open = open
      if (options.obstruction && !open) snapshot.elementFromPoint = { tag: 'div', drawer: false }
      if (options.detached && !open) snapshot.handle.connected = false
      if (!scrolled) { snapshot.handle.start.x -= 100; snapshot.handle.screenCTM.e -= 100 }
      if (!selected) snapshot.selectPressed = 'false'
      if (dragged && options.noMovement) snapshot.modelPoint = copy(evidence.before.modelPoint)
      if (undone) snapshot.modelPoint = copy(evidence.before.modelPoint)
      if (redone) snapshot.modelPoint = copy(evidence.afterAction.observation.modelPoint)
      snapshot.labelDocumentRevision = state().labelDocumentRevision
      return snapshot
    },
    locator(selector) {
      if (selector === '#preview-inspector-drawer') return { count: async () => open ? 1 : 0,
        waitFor: async ({ state: expected, timeout }) => { calls.push('detach'); assert.equal(expected, 'detached'); assert.equal(timeout, 5000); if (options.detachError) throw options.detachError } }
      if (selector.startsWith('.preview-') || selector === 'section.preview-floating-toolbar') return {
        count: async () => selector.endsWith('.preview-floating-toolbar') ? Number(!toolbarCollapsed) : 1,
        waitFor: async ({ state: expected, timeout }) => {
          calls.push(`toolbar wait ${selector} ${expected}`); assert.equal(timeout, 5000)
          if (options.toolbarWaitError) throw options.toolbarWaitError
          if (selector.endsWith('.preview-floating-toolbar')) assert.equal(expected, toolbarCollapsed ? 'detached' : 'visible')
          else if (selector.includes(':not')) assert.equal(toolbarCollapsed, false)
          else if (selector.includes('.is-collapsed')) assert.equal(toolbarCollapsed, true)
        },
      }
      assert.equal(selector, 'svg.svg-diagram')
      return { scrollIntoViewIfNeeded: async ({ timeout }) => { assert.equal(timeout, 5000); calls.push('scroll'); scrolled = true; if (options.scrollError) throw options.scrollError } }
    },
    getByRole(role, { name, exact }) {
      assert.equal(role, 'button'); assert.equal(exact, true)
      return { count: async () => name === 'Close inspector drawer' ? options.closeCount ?? (open ? 1 : 0)
        : name === 'Select' ? options.selectCount ?? Number(!toolbarCollapsed)
        : name === 'Expand preview toolbar' ? options.expandCount ?? Number(toolbarCollapsed)
        : name === 'Collapse preview toolbar' ? options.collapseCount ?? Number(!toolbarCollapsed) : 1,
        getAttribute: async (attribute) => attribute === 'aria-pressed' ? selected ? 'true' : 'false'
          : options.openerExpanded ?? (open ? 'true' : 'false'),
        waitFor: async ({ state: expected, timeout }) => {
          calls.push(`toolbar wait ${name} ${expected}`); assert.equal(timeout, 5000); assert.equal(expected, 'visible')
          assert.equal(name, toolbarCollapsed ? 'Expand preview toolbar' : 'Collapse preview toolbar')
        },
        click: async ({ timeout } = {}) => {
          assert.equal(timeout, 5000); calls.push(name)
          if (name === 'Close inspector drawer') { if (options.closeError) throw options.closeError; if (!options.keepOpen) open = false }
          else if (name === 'Select') selected = true
          else if (name === 'Expand preview toolbar') { if (options.expandError) throw options.expandError; toolbarCollapsed = false }
          else if (name === 'Collapse preview toolbar') { if (options.collapseError) throw options.collapseError; toolbarCollapsed = true }
          else if (name === 'Undo last diagram change') undone = true
          else if (name === 'Redo last undone diagram change') redone = true
          else assert.fail(`Unexpected button: ${name}`)
        } }
    },
    mouse: {
      async move(x, y, moveOptions) {
        calls.push(moveOptions ? 'drag-move' : 'start-move'); mousePosition = { x, y }
        if (moveOptions) { moveAttempted = true; assert.deepEqual(moveOptions, { steps: 4 }); if (options.moveError) throw options.moveError }
      },
      async down() { calls.push('mouse-down'); assert.deepEqual(mousePosition, evidence.requested.start); if (options.downError) throw options.downError },
      async up() { calls.push('mouse-up'); if (phase === 'drag') dragged = true },
    },
  }
  const diagnose = async ({ boundary, observation }) => {
    if (boundary === 'toolbar-restored-before-assertion') options.mutateAfterRestore?.(observation)
    records.push({ boundary, observation: copy(observation) })
    if (options.artifactError) throw options.artifactError
  }
  const arguments_ = { page, readState, diagnose, secondaryErrors, scenario: evidence.scenario, sequence: 1,
    id: evidence.id, displacement: evidence.displacement, steps: evidence.steps }
  return { arguments_, evidence, calls, records, secondaryErrors, get cleanup() { return cleanup },
    get installed() { return install }, get toolbarCollapsed() { return toolbarCollapsed } }
}

test('synthetic orchestration closes a reopened Inspector once and freshly measures after Select/scroll', async () => {
  const fixture = orchestration(), evidence = await dragSelectedPoint(fixture.arguments_)
  assertPointNativeDragEvidence(evidence)
  assert.equal(evidence.preparation.inherited.inspector.open, true)
  assert.equal(evidence.preparation.closeActions, 1)
  assert.notDeepEqual(evidence.preparation.inherited.handle.start, evidence.before.handle.start)
  assert.ok(fixture.calls.indexOf('scroll') < fixture.calls.indexOf('start-move'))
  assert.equal(fixture.calls.filter((call) => call === 'Close inspector drawer').length, 1)
  assert.equal(fixture.cleanup, 1); assert.equal(fixture.installed, false)
  assert.equal(fixture.records.find(({ boundary }) => boundary === 'after-native-drag-before-assertion').observation.afterAction.state.json, evidence.afterAction.state.json)
})
test('synthetic orchestration uses a closed drawer as a no-op', async () => {
  const fixture = orchestration({ closed: true }), evidence = await dragSelectedPoint(fixture.arguments_)
  assert.equal(evidence.preparation.closeActions, 0)
  assert.equal(fixture.calls.includes('Close inspector drawer'), false)
  assert.equal(fixture.cleanup, 1)
})
test('synthetic standalone preparation returns preserved selected owner and fresh canvas measurements', async () => {
  const fixture = orchestration(), preparation = await prepareSelectedPointCanvas(fixture.arguments_)
  assertPointCanvasPreparation(preparation, 'app-point')
  assert.equal(fixture.calls.includes('mouse-down'), false); assert.equal(fixture.cleanup, 1)
})
for (const operation of [dragSelectedPoint, prepareSelectedPointCanvas]) {
  test(`synthetic ${operation.name} expands inherited collapsed toolbar for native Select and restores its owned state`, async () => {
    const fixture = orchestration({ toolbarCollapsed: true })
    await operation(fixture.arguments_)
    assert.equal(fixture.toolbarCollapsed, true)
    assert.equal(fixture.calls.filter((call) => call === 'Expand preview toolbar').length, 1)
    assert.equal(fixture.calls.filter((call) => call === 'Collapse preview toolbar').length, 1)
    assert.equal(fixture.calls.filter((call) => call === 'Select').length, 1)
    assert.ok(fixture.calls.indexOf('Expand preview toolbar') < fixture.calls.indexOf('Select'))
    assert.ok(fixture.calls.indexOf('Select') < fixture.calls.indexOf('scroll'))
    assert.ok(fixture.calls.indexOf('removePointNativeDragObserver') < fixture.calls.indexOf('Collapse preview toolbar'))
    assert.equal(fixture.cleanup, 1)
  })
  test(`synthetic ${operation.name} keeps inherited expanded toolbar available without toggling`, async () => {
    const fixture = orchestration()
    await operation(fixture.arguments_)
    assert.equal(fixture.toolbarCollapsed, false)
    assert.equal(fixture.calls.includes('Expand preview toolbar'), false)
    assert.equal(fixture.calls.includes('Collapse preview toolbar'), false)
    assert.equal(fixture.calls.filter((call) => call === 'Select').length, 1)
  })
  test(`synthetic ${operation.name} retains failed native toolbar expansion before canvas input`, async () => {
    const primary = new Error('native toolbar expansion failed'), fixture = orchestration({ toolbarCollapsed: true, expandError: primary })
    await assert.rejects(operation(fixture.arguments_), (error) => error === primary)
    assert.equal(fixture.calls.includes('Select'), false)
    assert.equal(fixture.calls.includes('mouse-down'), false)
    assert.equal(fixture.cleanup, 1)
  })
  test(`synthetic ${operation.name} retains first native restoration error after observer cleanup`, async () => {
    const primary = new Error('native toolbar restoration failed'), fixture = orchestration({ toolbarCollapsed: true, collapseError: primary })
    await assert.rejects(operation(fixture.arguments_), (error) => error === primary)
    assert.equal(fixture.cleanup, 1)
    assert.equal(fixture.calls.filter((call) => call === 'Collapse preview toolbar').length, 1)
    assert.equal(fixture.records.at(-1).observation.primary.message, primary.message)
  })
}
test('synthetic native drag primary action survives owned toolbar restoration failure', async () => {
  const primary = new Error('native movement failed'), fixture = orchestration({ toolbarCollapsed: true,
    moveError: primary, collapseError: new Error('native toolbar restoration failed') })
  await assert.rejects(dragSelectedPoint(fixture.arguments_), (error) => error === primary)
  assert.equal(fixture.cleanup, 1)
  assert.equal(fixture.calls.filter((call) => call === 'Collapse preview toolbar').length, 1)
  assert.ok(fixture.secondaryErrors.some((message) => message.includes('native toolbar restoration failed')))
})
test('synthetic restored inherited toolbar permits the next native drag preparation to access Select', async () => {
  const fixture = orchestration({ toolbarCollapsed: true })
  await prepareSelectedPointCanvas(fixture.arguments_)
  assert.equal(fixture.toolbarCollapsed, true)
  const drag = await dragSelectedPoint(fixture.arguments_)
  assertPointNativeDragEvidence(drag)
  assert.equal(fixture.toolbarCollapsed, true)
  assert.equal(fixture.calls.filter((call) => call === 'Select').length, 2)
  assert.equal(fixture.calls.filter((call) => call === 'Expand preview toolbar').length, 2)
  assert.equal(fixture.calls.filter((call) => call === 'Collapse preview toolbar').length, 2)
  assert.equal(fixture.cleanup, 2)
})
test('synthetic completed native drag retains its post-restoration raw history validator failure as final primary evidence', async () => {
  const fixture = orchestration({ toolbarCollapsed: true, mutateAfterRestore: (observation) => {
    observation.undo.stateAfter.history = '{}'
  } })
  await assert.rejects(dragSelectedPoint(fixture.arguments_), /Undo reverses precisely the drag history commit/u)
  const final = fixture.records.at(-1)
  assert.equal(final.boundary, 'native-drag-finished')
  assert.match(final.observation.primary.message, /Undo reverses precisely the drag history commit/u)
  assert.equal(final.observation.undo.stateAfter.history, '{}')
  assert.equal(fixture.toolbarCollapsed, true)
  assert.equal(fixture.cleanup, 1)
})
test('synthetic standalone preparation retains its completed raw toolbar validator failure as final primary evidence', async () => {
  const fixture = orchestration({ toolbarCollapsed: true, mutateAfterRestore: (observation) => {
    observation.toolbarPreparation.actions.find(({ name }) => name === 'Select').pressed = 'false'
  } })
  await assert.rejects(prepareSelectedPointCanvas(fixture.arguments_))
  const final = fixture.records.at(-1)
  assert.equal(final.boundary, 'canvas-preparation-finished')
  assert.ok(final.observation.primary.message)
  assert.equal(final.observation.toolbarPreparation.actions.find(({ name }) => name === 'Select').pressed, 'false')
  assert.equal(fixture.toolbarCollapsed, true)
  assert.equal(fixture.cleanup, 1)
})
for (const [name, options] of [
  ['failed native close', { closeError: new Error('native close failed') }],
  ['failed drawer detachment', { detachError: new Error('bounded detachment failed') }],
  ['remaining drawer', { keepOpen: true }],
  ['ambiguous close control', { closeCount: 2 }],
  ['failed native scroll', { scrollError: new Error('scroll failed') }],
  ['detached selected handle', { detached: true }],
  ['remaining nondrawer obstruction', { obstruction: true }],
]) test(`synthetic orchestration retains preparation failure and cleans ${name}`, async () => {
  const fixture = orchestration(options)
  await assert.rejects(dragSelectedPoint(fixture.arguments_))
  assert.equal(fixture.calls.includes('mouse-down'), false); assert.equal(fixture.cleanup, 1)
  assert.ok(fixture.records.at(-1).observation.primary)
})
test('synthetic unchanged model assertion is retained before cleanup even with artifact/cleanup failures', async () => {
  const fixture = orchestration({ noMovement: true, artifactError: new Error('artifact failed'), cleanupError: new Error('cleanup failed') })
  await assert.rejects(dragSelectedPoint(fixture.arguments_), (error) => error.message.includes('Native handle drag changes the selected model position'))
  const after = fixture.records.find(({ boundary }) => boundary === 'after-native-drag-before-assertion')
  assert.equal(after.observation.afterAction.state.json, after.observation.stateBefore.json)
  assert.equal(fixture.cleanup, 1); assert.ok(fixture.secondaryErrors.some((message) => message.includes('cleanup failed')))
  assert.equal(fixture.calls.includes('Undo last diagram change'), false)
})
test('synthetic primary native action error survives state/observation/artifact/cleanup failures', async () => {
  const primary = new Error('native movement failed'), fixture = orchestration({ moveError: primary,
    readAfterMoveError: true, readError: new Error('read failed'), observeAfterDragError: true, observeError: new Error('observation failed'),
    artifactError: new Error('artifact failed'), cleanupError: new Error('cleanup failed') })
  await assert.rejects(dragSelectedPoint(fixture.arguments_), (error) => error === primary)
  assert.equal(fixture.calls.filter((call) => call === 'mouse-up').length, 1, 'Held native input released on failure')
  assert.equal(fixture.cleanup, 1); assert.equal(fixture.installed, false)
  assert.equal(fixture.records.at(-1).observation.primary.message, primary.message)
})
for (const operation of [dragSelectedPoint, prepareSelectedPointCanvas]) test(`synthetic ${operation.name} duplicate observer installation cannot remove another owner`, async () => {
  const primary = new Error('duplicate owned observer'), fixture = orchestration({ installError: primary })
  await assert.rejects(operation(fixture.arguments_), (error) => error === primary)
  assert.equal(fixture.cleanup, 0); assert.equal(fixture.calls.includes('observePointNativeDrag'), false)
})
