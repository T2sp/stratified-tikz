import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPendingLayoutViewEvidence, changePendingLayoutView } from '../../scripts/pointLayoutPendingView.mjs'
import { syntheticPendingLayoutViewEvidence } from './pointLayoutPendingViewFixture.mjs'
import { syntheticPendingLayoutPreparation } from './standalonePointDownloadFixture.mjs'

// Every control, event and matrix below is explicitly synthetic Node evidence.
// These tests enforce the acceptance oracle, never native browser acceptance.
function fixture() {
  const pending = syntheticPendingLayoutPreparation(), source = pending.pendingPreparation.source
  return { click: pending.click, source, record: syntheticPendingLayoutViewEvidence({ click: pending.click, source }) }
}
const after = (record) => record.stages[2]
const immediate = (record) => record.stages[1]
const before = (record) => record.stages[0]

test('synthetic actual-control and root-relative projection proof accepts unchanged serialized 2D UI and root screen CTM', () => {
  const { click, record } = fixture(), original = structuredClone(click)
  assert.equal(before(record).state.uiSettings, after(record).state.uiSettings)
  assert.deepEqual(before(record).canvas.screenCTM, after(record).canvas.screenCTM)
  assert.notDeepEqual(before(record).points[1].root, after(record).points[1].root)
  assert.equal(click.snapshot.points[0].held.started, 1)
  assert.equal(before(record).hold.started, 2, 'The later held observation remains distinct from the actual export-click snapshot')
  assert.equal(before(record).points[0].source, 'later $changed$')
  assertPendingLayoutViewEvidence(record, click)
  assert.deepEqual(click, original)
})

test('synthetic owned input accepts honest optional change provenance and unrelated same-request completion', () => {
  const { click, record } = fixture()
  const change = { ...structuredClone(after(record).events[0]), type: 'change', order: 1, at: 115,
    inputType: null, data: null, sliderValue: '1.4' }
  immediate(record).events.push(structuredClone(change)); after(record).events.push(change)
  after(record).points[0].status = 'ready'
  assertPendingLayoutViewEvidence(record, click)
})

test('synthetic genuine root-relative zoom remains provable independently of changed CSS and scroll framing', () => {
  const { click, record } = fixture()
  for (const stage of record.stages.slice(1)) {
    stage.canvas.screenCTM.e += 30; stage.canvas.screenCTM.f -= 20
    stage.canvas.client.x += 30; stage.canvas.client.y -= 20
    stage.viewport.scrollY = 20; stage.scroll[0].scrollTop = 20
    for (const point of stage.points) {
      point.screen.x += 30; point.screen.y -= 20
      point.screenCTM.e += 30; point.screenCTM.f -= 20
    }
  }
  assertPendingLayoutViewEvidence(record, click)
})

function setProjection(stage, origin, scale, rounded = false) {
  for (const point of stage.points) {
    const round = rounded ? Math.fround : (value) => value
    const root = { x: round(origin.x + scale * point.model.position.x), y: round(origin.y - scale * point.model.position.y) }
    const m = stage.canvas.screenCTM
    point.root = root; point.rootMatrix.e = root.x; point.rootMatrix.f = root.y
    point.CTM.e = root.x; point.CTM.f = root.y
    point.nodeTransform = `translate(${root.x} ${root.y})`
    point.screen = { x: m.a * root.x + m.c * root.y + m.e, y: m.b * root.x + m.d * root.y + m.f }
    point.screenCTM.e = point.screen.x; point.screenCTM.f = point.screen.y
  }
}

test('synthetic independently rounded native SVG translations retain precise propagated binary32 acceptance', () => {
  const { click, record } = fixture(), origin = { x: 63.15151515151515, y: 247.63636363636363 }
  const scale = 448 / 33
  setProjection(before(record), origin, scale, true)
  for (const stage of record.stages.slice(1)) setProjection(stage, origin, scale * 1.4, true)
  assertPendingLayoutViewEvidence(record, click)
  for (const stage of record.stages.slice(1)) setProjection(stage, { ...origin, x: origin.x + .001 }, scale * 1.4, true)
  assert.throws(() => assertPendingLayoutViewEvidence(record, click), /Native projection/)
})

const faults = [
  ['already-equal zoom precondition', (record) => { before(record).controls.zoom.value = '1.4'; before(record).controls.slider.value = '1.4' }],
  ['unapplied numeric control', (record) => { after(record).controls.zoom.value = '1' }],
  ['unapplied associated slider', (record) => { after(record).controls.slider.value = '1' }],
  ['numeric values without view movement', (record) => { for (const stage of record.stages.slice(1)) stage.points = structuredClone(before(record).points) }],
  ['CSS or scroll movement without root projection', (record) => {
    for (const stage of record.stages.slice(1)) {
      stage.points = structuredClone(before(record).points); stage.viewport.scrollY = 30
      stage.scroll[0].scrollTop = 30; stage.canvas.client.y -= 30; stage.canvas.screenCTM.f -= 30
      for (const point of stage.points) { point.screen.y -= 30; point.screenCTM.f -= 30 }
    }
  }],
  ['wrong numeric control', (record) => { after(record).controls.zoom.accessibleName = 'theta value' }],
  ['ambiguous numeric control', (record) => { record.resolution.numericCount = 2 }],
  ['missing slider', (record) => { after(record).controls.slider.count = 0 }],
  ['unassociated slider', (record) => { after(record).controls.associated = false }],
  ['detached numeric control', (record) => { after(record).controls.zoom.connected = false }],
  ['replaced numeric identity', (record) => { after(record).controls.zoom.sameIdentity = false }],
  ['closed actual disclosure', (record) => { after(record).controls.disclosure.expanded = 'false' }],
  ['unrelated disclosure', (record) => { after(record).controls.disclosure.controls = 'other-details' }],
  ['invalid numeric range', (record) => { after(record).controls.zoom.max = 'NaN' }],
  ['target outside range', (record) => { for (const stage of record.stages) { stage.controls.zoom.max = '1.2'; stage.controls.slider.max = '1.2' } }],
  ['detached current point', (record) => { after(record).points[0].connected = false }],
  ['replaced current point', (record) => { after(record).points[0].sameIdentity = false }],
  ['wrong point owner', (record) => { after(record).points[0].owner = JSON.stringify(['point-node', 1, 'layout-circle']) }],
  ['wrong source', (record) => { after(record).points[1].source = 'stale source' }],
  ['wrong body request', (record) => { after(record).points[1].bodyRequest = 'stale request' }],
  ['new reference request across stages', (record) => { for (const stage of record.stages) { stage.points[1].request = 'stale'; stage.points[1].bodyRequest = 'stale' } }],
  ['missing request', (record) => { after(record).points[0].request = null; after(record).points[0].bodyRequest = null }],
  ['changed epoch', (record) => { after(record).state.labelDocumentRevision++ }],
  ['changed exact saved model', (record) => { after(record).state.json += ' ' }],
  ['changed exact runtime model', (record) => { after(record).state.runtimeDiagramJson += ' ' }],
  ['changed history', (record) => { after(record).state.history += ' ' }],
  ['changed selection', (record) => { after(record).state.selection.id = 'layout-rectangle' }],
  ['changed unrelated UI', (record) => { after(record).state.uiSettings += ' ' }],
  ['changed pan', (record) => { after(record).controls.panX.value = '1' }],
  ['hidden projection translation', (record) => { for (const stage of record.stages.slice(1)) setProjection(stage, { x: 21, y: 25 }, 14) }],
  ['wrong zoom ratio', (record) => { for (const stage of record.stages.slice(1)) setProjection(stage, { x: 20, y: 25 }, 13) }],
  ['changed model placement', (record) => { after(record).points[1].model.position.x++ }],
  ['missing before observation', (record) => { record.stages.shift() }],
  ['missing immediate-input observation', (record) => { record.stages.splice(1, 1) }],
  ['missing after observation', (record) => { record.stages.pop() }],
  ['reordered observations', (record) => { record.stages.reverse() }],
  ['nonfinite stage time', (record) => { immediate(record).at = NaN }],
  ['backdated after observation', (record) => { after(record).at = 90 }],
  ['missing current geometry', (record) => { after(record).points.pop() }],
  ['missing root placement', (record) => { after(record).points[1].root = null }],
  ['missing control events', (record) => { immediate(record).events = []; after(record).events = [] }],
  ['events contaminated before input', (record) => { before(record).events = structuredClone(after(record).events) }],
  ['untrusted input', (record) => { immediate(record).events[0].trusted = false; after(record).events[0].trusted = false }],
  ['wrong input control owner', (record) => { for (const stage of record.stages.slice(1)) stage.events[0].target.sameIdentity = false }],
  ['missing event state', (record) => { for (const stage of record.stages.slice(1)) delete stage.events[0].state }],
  ['stale event request', (record) => { for (const stage of record.stages.slice(1)) stage.events[0].points[1].request = 'obsolete' }],
  ['wrong event input value', (record) => { for (const stage of record.stages.slice(1)) stage.events[0].value = '1.3' }],
  ['event before baseline', (record) => { for (const stage of record.stages.slice(1)) stage.events[0].at = 99 }],
  ['missing immediate event copy', (record) => { immediate(record).events = [] }],
  ['dropped control events', (record) => { after(record).droppedEvents = 1 }],
  ['multiple ordinary fills', (record) => { record.fillCount = 2 }],
  ['early source release', (record) => { after(record).hold.released = true }],
  ['early source completion', (record) => { after(record).hold.completed = 1 }],
  ['changed held request accounting', (record) => { after(record).hold.started++ }],
  ['missing live click', (record) => { after(record).click = null }],
  ['changed immutable click snapshot', (record) => { record.click.snapshot.points[0].nodeTransform = 'translate(999 999)' }],
  ['declared summary without observations', (record) => { record.viewChanged = true; record.stages = [] }],
  ['secondary observation error', (record) => { after(record).errors.push({ name: 'matrix', message: 'controlled error' }) }],
  ['secondary diagnostic error', (record) => { record.secondaryErrors.push({ operation: 'controlled diagnostic', message: 'failure' }) }],
  ['unremoved observer', (record) => { record.cleanup.observerRemoved = false }],
  ['unrestored disclosure', (record) => { record.cleanup.disclosureRestored = false }],
  ['missing restoration observation', (record) => { delete record.cleanup.observation }],
  ['restoration source release', (record) => { record.cleanup.observation.hold.released = true }],
  ['restoration state change', (record) => { record.cleanup.observation.state.history += ' ' }],
  ['wrong actual restoration', (record) => { record.cleanup.observation.expanded = 'true' }],
  ['missing preparation state', (record) => { delete record.preparation.stateBefore }],
]
for (const [name, corrupt] of faults) test(`synthetic post-click view rejects ${name}`, () => {
  const { click, record } = fixture(); corrupt(record)
  assert.throws(() => assertPendingLayoutViewEvidence(record, click))
})

for (const field of ['screenCTM', 'CTM', 'rootMatrix']) {
  for (const invalid of ['missing', 'singular', 'nonfinite']) test(`synthetic post-click view rejects ${invalid} point ${field}`, () => {
    const { click, record } = fixture(), point = after(record).points[1]
    if (invalid === 'missing') delete point[field]
    else if (invalid === 'singular') { point[field].a = 0; point[field].b = 0 }
    else point[field].e = Infinity
    assert.throws(() => assertPendingLayoutViewEvidence(record, click))
  })
}
for (const field of ['screenCTM', 'CTM']) test(`synthetic post-click view rejects singular root ${field}`, () => {
  const { click, record } = fixture(); after(record).canvas[field].a = 0
  assert.throws(() => assertPendingLayoutViewEvidence(record, click))
})

function controlledViewPage(record, faults = {}) {
  const actions = [], persisted = [], errors = [], original = record.preparation.originalExpanded
  let expanded = original === 'true', captures = 0, observed = false
  const disclosure = { count: async () => 1, getAttribute: async (name) => { assert.equal(name, 'aria-expanded'); return String(expanded) },
    async click(options) {
      assert.deepEqual(options, { timeout: 5000 }); actions.push(expanded ? 'collapse' : 'expand')
      if (expanded && faults.restoreError) throw faults.restoreError
      expanded = !expanded
    } }
  const numeric = { count: async () => 1, async scrollIntoViewIfNeeded(options) { assert.deepEqual(options, { timeout: 5000 }); actions.push('scroll') },
    async fill(value, options) {
      assert.equal(value, '1.4'); assert.deepEqual(options, { timeout: 5000 }); actions.push('fill')
      if (faults.fillError) throw faults.fillError
    } }
  const page = {
    locator(selector) { assert.equal(selector, '.camera-panel .camera-summary-toggle'); return disclosure },
    getByRole(role, options) {
      assert.equal(options.exact, true)
      if (role === 'spinbutton') { assert.equal(options.name, 'zoom value'); return numeric }
      assert.equal(role, 'slider'); assert.equal(options.name, 'zoom slider'); return { count: async () => 1 }
    },
    async evaluate(callback) {
      if (callback.name === 'commitViewFrames') { actions.push('commit'); return }
      if (callback.name === 'installPendingViewObserver') { actions.push('install'); observed = true; return }
      if (callback.name === 'removePendingViewObserver') {
        actions.push('remove'); if (faults.removeError) throw faults.removeError
        observed = false; return true
      }
      if (callback.name === 'observePendingLayoutView') {
        actions.push(`capture-${captures}`)
        const stage = structuredClone(record.stages[captures++]); delete stage.boundary
        return stage
      }
      if (callback.toString().includes('disclosureCount:')) {
        actions.push('cleanup-observation'); return { ...structuredClone(record.cleanup.observation), expanded: String(expanded) }
      }
      actions.push('state'); return structuredClone(record.preparation.stateBefore)
    },
  }
  const persist = async (value) => { actions.push(`persist-${value.stages.length}`); persisted.push(structuredClone(value)) }
  const run = () => changePendingLayoutView({ page, scenario: record.scenario, source: record.source, click: record.click, persist, secondaryErrors: errors })
  return { run, actions, persisted, errors, observerActive: () => observed, disclosureExpanded: () => expanded }
}

test('synthetic view orchestration persists each observation before validation and owns one fill plus disclosure/listener cleanup', async () => {
  const { record } = fixture(), control = controlledViewPage(record)
  const result = await control.run()
  assertPendingLayoutViewEvidence(result, record.click)
  assert.equal(control.actions.filter((action) => action === 'fill').length, 1)
  assert.deepEqual(control.actions.filter((action) => ['expand', 'collapse', 'scroll', 'install', 'remove'].includes(action)),
    ['expand', 'scroll', 'install', 'remove', 'collapse'])
  assert.deepEqual(control.persisted.filter(({ stages }) => stages.length).map(({ stages }) => stages.length), [1, 2, 3, 3, 3])
  assert.equal(control.persisted[3].result, 'observed', 'Immediate native input is saved before any terminal validation')
  assert.equal(control.persisted.at(-1).result, 'passed')
  assert.equal(control.observerActive(), false); assert.equal(control.disclosureExpanded(), false); assert.deepEqual(control.errors, [])
})

test('synthetic failed numeric-only view retains immediate and after evidence before rejection and still cleans up', async () => {
  const { record } = fixture()
  for (const stage of record.stages.slice(1)) stage.points = structuredClone(before(record).points)
  const control = controlledViewPage(record)
  await assert.rejects(control.run)
  const retained = control.persisted.at(-1)
  assert.deepEqual(retained.stages.map(({ boundary }) => boundary), ['before', 'immediate-input', 'after'])
  assert.equal(retained.result, 'observed'); assert.ok(retained.error)
  assert.equal(control.observerActive(), false); assert.equal(control.disclosureExpanded(), false)
  assert.equal(control.actions.filter((action) => action === 'fill').length, 1)
})

test('synthetic ordinary fill failure retains post-input observations and primary error through cleanup errors', async () => {
  const { record } = fixture(), fillError = new Error('controlled ordinary fill failure'), removeError = new Error('controlled listener cleanup failure')
  const control = controlledViewPage(record, { fillError, removeError })
  await assert.rejects(control.run, (error) => error === fillError)
  const retained = control.persisted.at(-1)
  assert.deepEqual(retained.stages.map(({ boundary }) => boundary), ['before', 'immediate-input', 'after'])
  assert.equal(retained.error.message, fillError.message)
  assert.equal(retained.cleanup.observerRemoved, false); assert.equal(retained.cleanup.disclosureRestored, true)
  assert.ok(control.errors.some((message) => message.includes(removeError.message)))
  assert.equal(control.actions.filter((action) => action === 'fill').length, 1)
})

test('synthetic failed precondition saves actual baseline and performs no numeric fill', async () => {
  const { record } = fixture(); before(record).controls.zoom.value = '1.4'; before(record).controls.slider.value = '1.4'
  const control = controlledViewPage(record)
  await assert.rejects(control.run, /Declared zoom must differ/)
  assert.equal(control.actions.includes('fill'), false)
  assert.deepEqual(control.persisted.at(-1).stages.map(({ boundary }) => boundary), ['before'])
  assert.equal(control.observerActive(), false); assert.equal(control.disclosureExpanded(), false)
})
