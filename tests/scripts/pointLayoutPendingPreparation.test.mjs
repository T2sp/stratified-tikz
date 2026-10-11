import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPendingLayoutPreparation, assertPendingLayoutClickContinuation, inputPendingLayoutContour } from '../../scripts/pointLayoutPendingPreparation.mjs'
import { syntheticPendingLayoutPreparation } from './standalonePointDownloadFixture.mjs'

// These fabricated geometry/orchestration controls verify rejection and input
// counts. They do not establish native pending selection or download acceptance.
for (const background of ['transparent', 'white']) {
  test(`synthetic pending ${background} preparation requires complete ordinary contour and held click continuation`, () => {
    const { pendingPreparation, beforeExportClick, click } = syntheticPendingLayoutPreparation(background)
    assertPendingLayoutPreparation(pendingPreparation)
    assertPendingLayoutClickContinuation(pendingPreparation, click, beforeExportClick)
  })
}

function beforeInput(record) {
  return record.stages.find(({ boundary }) => boundary === 'immediate-before-input')
}
const trapezium = { tag: 'rect', pointId: 'layout-trapezium', bodyTarget: true, contour: false,
  drawer: false, svg: true, canvas: true, canvasRoot: false, toolbar: false }
function recordedSiblingStack(stage) {
  const circle = stage.measurement.elementFromPoint
  stage.measurement.elementFromPoint = trapezium
  stage.measurement.elementsFromPoint = [trapezium, { ...trapezium, tag: 'path', bodyTarget: false, contour: true },
    { ...trapezium, tag: 'path', pointId: 'layout-isosceles-triangle', bodyTarget: false, contour: true }, circle]
  // Incorrect success flags must not waive the actual first native hit.
  stage.measurement.eligibility = { eligible: true, reasons: [] }
}

test('synthetic recorded trapezium-before-circle stack fails before observer or ordinary input', async () => {
  const record = syntheticPendingLayoutPreparation().pendingPreparation
  const stage = beforeInput(record), actions = []
  recordedSiblingStack(stage)
  await assert.rejects(() => inputPendingLayoutContour({ stage, fixture: record.fixture, source: record.source,
    stateBefore: record.stateBefore, nativeSelection: record.nativeSelection, ...stage.measurement.requestedClick,
    startObserver: async () => actions.push('observer'), nativeClick: async () => actions.push('click') }),
  /intended owner/)
  assert.deepEqual(actions, [])
  assert.throws(() => assertPendingLayoutPreparation(record), /intended owner/)
})

test('synthetic fresh unobstructed .23 target routes one ordinary input to current circle', async () => {
  const record = syntheticPendingLayoutPreparation().pendingPreparation
  const stage = beforeInput(record), actions = []
  await inputPendingLayoutContour({ stage, fixture: record.fixture, source: record.source, stateBefore: record.stateBefore, nativeSelection: record.nativeSelection,
    ...stage.measurement.requestedClick, startObserver: async () => actions.push({ action: 'observer' }),
    nativeClick: async (x, y) => actions.push({ action: 'click', x, y }) })
  assert.deepEqual(actions, [{ action: 'observer' }, { action: 'click', ...stage.measurement.requestedClick }])
  assert.equal(record.stateAfter.selection.id, 'layout-circle')
  assertPendingLayoutPreparation(record)
})

const faults = [
  ['stale current owner', (record) => { beforeInput(record).measurement.points[0].owner = JSON.stringify(['point-node', 1, 'layout-circle']) }],
  ['stale body request', (record) => { beforeInput(record).measurement.points[0].bodyRequest = 'stale' }],
  ['stale shared contour CTM', (record) => { record.nativeSelection.before.geometry.contour.screenCTM.e += 1 }],
  ['sibling interception', (record) => recordedSiblingStack(beforeInput(record))],
  ['UI interception', (record) => { beforeInput(record).measurement.elementFromPoint = { svg: false, canvas: false, drawer: true } }],
  ['wrong actual selection', (record) => { record.stateAfter.selection.id = 'layout-trapezium' }],
  ['settled captured request', (record) => { beforeInput(record).measurement.points[0].state = 'ready' }],
  ['released held conversion', (record) => { beforeInput(record).measurement.hold.released = true }],
  ['modifier input', (record) => { record.modifiers.events[0].altKey = true }],
  ['missing sibling body target', (record) => { beforeInput(record).measurement.points[8].geometry.bodyTarget.connected = false }],
  ['wrong sibling source', (record) => { beforeInput(record).measurement.points[8].source = 'changed sibling' }],
  ['outside viewport success flag', (record) => { beforeInput(record).measurement.viewport.width = 50 }],
  ['clipped success flag', (record) => { beforeInput(record).measurement.clipFrames.push({ bounds: { x: 0, y: 0, width: 50, height: 50 } }) }],
  ['unremoved owned observer', (record) => { record.cleanup.observerRemoved = false }],
]
for (const [name, mutate] of faults) {
  test(`synthetic pending preparation rejects ${name}`, () => {
    const record = syntheticPendingLayoutPreparation().pendingPreparation
    mutate(record)
    assert.throws(() => assertPendingLayoutPreparation(record))
  })
}

for (const [name, mutate] of [
  ['held conversion released at click', ({ click }) => { click.snapshot.points[0].held.released = true }],
  ['stale export request', ({ click }) => { click.snapshot.points[0].request = 'stale' }],
  ['wrong at-click selected owner', ({ click }) => { click.snapshot.selection.id = 'layout-trapezium' }],
  ['changed fixture position', ({ click }) => { click.snapshot.points[0].position.x += 1 }],
  ['wrong background control', ({ beforeExportClick }) => { beforeExportClick.measurement.exportBackground.value = 'white' }],
]) {
  test(`synthetic pending continuation rejects ${name}`, () => {
    const fixture = syntheticPendingLayoutPreparation()
    mutate(fixture)
    assert.throws(() => assertPendingLayoutClickContinuation(fixture.pendingPreparation, fixture.click, fixture.beforeExportClick))
  })
}

test('synthetic pending input rejects force/options and preserves first observer failure with no click', async () => {
  const record = syntheticPendingLayoutPreparation().pendingPreparation, stage = beforeInput(record)
  let clicks = 0
  const input = { stage, fixture: record.fixture, source: record.source, stateBefore: record.stateBefore, nativeSelection: record.nativeSelection,
    ...stage.measurement.requestedClick, nativeClick: async () => { clicks++ } }
  await assert.rejects(() => inputPendingLayoutContour({ ...input, options: [{ force: true }], startObserver: async () => {} }))
  const first = new Error('controlled owned observer failure')
  await assert.rejects(() => inputPendingLayoutContour({ ...input, startObserver: async () => { throw first } }), (error) => error === first)
  assert.equal(clicks, 0)
})

for (const [field, change] of [
  ['owner', (record) => { record.nativeSelection.before.layout.owner = 'obsolete-owner' }],
  ['request', (record) => { record.nativeSelection.before.layout.request = 'obsolete-request' }],
  ['CTM', (record) => { record.nativeSelection.before.geometry.contour.screenCTM.e += 1 }],
]) {
  test(`synthetic current target rejects stale shared ${field} before observer or click`, async () => {
    const record = syntheticPendingLayoutPreparation().pendingPreparation, stage = beforeInput(record)
    change(record)
    let observations = 0, clicks = 0
    await assert.rejects(() => inputPendingLayoutContour({ stage, fixture: record.fixture, source: record.source,
      stateBefore: record.stateBefore, nativeSelection: record.nativeSelection, ...stage.measurement.requestedClick,
      startObserver: async () => { observations++ }, nativeClick: async () => { clicks++ } }))
    assert.equal(observations, 0); assert.equal(clicks, 0)
  })
}

test('synthetic later restored UI interception remains observed while accepted native input is exact', () => {
  const fixture = syntheticPendingLayoutPreparation(), record = fixture.pendingPreparation
  const after = record.stages.find(({ boundary }) => boundary === 'after-native-selection')
  for (const measurement of [after.measurement, fixture.beforeExportClick.measurement]) {
    const overlay = { tag: 'div', pointId: null, svg: false, canvas: false, drawer: true }
    measurement.elementFromPoint = overlay; measurement.elementsFromPoint.unshift(overlay)
    measurement.eligibility = { eligible: false, reasons: ['unavailable-intended-target', 'wrong-first-hit-stack-owner'] }
  }
  assertPendingLayoutPreparation(record)
  assertPendingLayoutClickContinuation(record, fixture.click, fixture.beforeExportClick)
})
