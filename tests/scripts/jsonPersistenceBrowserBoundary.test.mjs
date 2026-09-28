import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveAppJson, checkAppJsonReload, assertPointPersistenceChanged, assertNativePointCheckboxAction, checkNativePointCheckboxAction, checkPersistenceEvidence } from '../../scripts/appJsonPersistence.mjs'
import { createAppGeometryDiagnostics } from '../../scripts/appGeometryDiagnostics.mjs'

test('mandatory checkbox observations wait for the optional monitor to drain without an evaluation collision', { timeout: 10_000 }, async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-native-control-monitor-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  let entered, release, calls = 0, checked = false
  const monitorEntered = new Promise((resolve) => { entered = resolve })
  const monitorRelease = new Promise((resolve) => { release = resolve })
  const page = new EventEmitter(), name = 'Auto depth-sort surfaces'
  page.url = () => 'http://app'
  page.isClosed = () => false
  page.evaluate = async (callback) => {
    if (callback.name !== 'readAppGeometryObserver') return {}
    const call = ++calls
    // One mandatory pre-observation and around's pre-observation precede this
    // first optional sample. Hold its protocol response across action return.
    if (call === 3) { entered(); await monitorRelease }
    return { monotonic: call * 10, generation: 'original', url: 'http://app', api: { sameInstance: true },
      nativeControls: { controls: [{ name, matchCount: 1, matches: [{ id: 1, checked, enabled: true, connected: true }] }],
        events: { samples: checked ? ['input', 'change'].map((event) => ({ event, names: [name], nodeId: 1,
          checked: true, trusted: true, monotonic: 35 })) : [] } } }
  }
  const geometry = createAppGeometryDiagnostics({ page, artifactDir })
  try {
    const witness = await checkNativePointCheckboxAction({ name, checked: true,
      capture: (boundary) => geometry.capture(boundary),
      action: () => geometry.around('checkbox', async () => {
        await monitorEntered
        checked = true
        // No sleep/retry: resolve the held optional response on the next host
        // turn, after the simulated native action has returned.
        setImmediate(release)
      }, {}, 1000),
    })
    assert.equal(witness.before.control.checked, false)
    assert.equal(witness.after.control.checked, true)
    assert.equal(witness.events.length, 2)
    const index = JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
    assert.ok(index.index.some((entry) => entry.boundary === 'checkbox:during'))
    assert.ok(index.index.every((entry) => entry.status === 'available'), 'Optional and mandatory captures never overlap')
  } finally { release(); await geometry.dispose() }
  assert.equal(page.eventNames().length, 0)
})

test('failed monitored checkbox action retains its primary error and skips the success observation', async () => {
  const primary = new Error('native uncheck timeout'), captures = []
  await assert.rejects(checkNativePointCheckboxAction({ name: 'visibility', checked: false,
    capture: async (boundary) => { captures.push(boundary); return {} },
    action: async () => { throw primary },
  }), (error) => error === primary)
  assert.deepEqual(captures, ['before-input'])
})

for (const checked of [true, false]) {
  for (const defect of ['none', 'noop', 'untrusted', 'missing-input', 'stale-event', 'replaced-document', 'replaced-control', 'duplicate', 'unavailable', 'wrong-final']) {
    test(`native checkbox ${checked} witness rejects ${defect}`, () => {
      const name = checked ? 'Auto depth-sort surfaces' : 'Enable approximate 3D visibility'
      const before = { browser: { status: 'available', snapshot: { monotonic: 100, generation: 'original', url: 'http://app', api: { sameInstance: true },
        nativeControls: { controls: [{ name, matchCount: 1, matches: [{ id: 1, checked: !checked, enabled: true, connected: true }] }], events: { samples: [] } } } } }
      const after = structuredClone(before)
      const last = after.browser.snapshot
      last.monotonic = 200
      last.nativeControls.controls[0].matches[0].checked = checked
      last.nativeControls.events.samples = ['input', 'change'].map((event) => ({ event, names: [name], nodeId: 1, checked, trusted: true, monotonic: 150 }))
      if (defect === 'noop') before.browser.snapshot.nativeControls.controls[0].matches[0].checked = checked
      if (defect === 'untrusted') last.nativeControls.events.samples.forEach((event) => { event.trusted = false })
      if (defect === 'missing-input') last.nativeControls.events.samples.shift()
      if (defect === 'stale-event') last.nativeControls.events.samples.forEach((event) => { event.monotonic = 50 })
      if (defect === 'replaced-document') last.generation = 'replacement'
      if (defect === 'replaced-control') last.nativeControls.controls[0].matches[0].id = 2
      if (defect === 'duplicate') last.nativeControls.controls[0].matchCount = 2
      if (defect === 'unavailable') after.browser.status = 'unavailable'
      if (defect === 'wrong-final') last.nativeControls.controls[0].matches[0].checked = !checked
      const check = () => assertNativePointCheckboxAction({ before, after, name, checked })
      if (defect === 'none') assert.equal(check().events.length, 2)
      else assert.throws(check, { code: 'ERR_ASSERTION' })
    })
  }
}

test('App download stops before native action when its bounded frame flush fails', async () => {
  const primary = new Error('App animation frames stalled within 2000ms')
  let reads = 0
  const page = { evaluate: async () => { reads++; throw new Error('No state read after failed flush') } }
  await assert.rejects(saveAppJson({ page, waitForFrames: async () => { throw primary } }), (error) => error === primary)
  assert.equal(reads, 0)
})

// Exercise the browser orchestration itself, with independent model/UI/download
// inputs and a deterministic event source. These are not native-browser passes.
for (const defect of ['none', 'missing mode', 'stale mode', 'point text', 'history', 'stale observation']) {
  test(`actual save boundary records evidence before rejecting ${defect}`, async (t) => {
    const artifactDir = await mkdtemp(join(tmpdir(), 'stz-persistence-boundary-'))
    t.after(() => rm(artifactDir, { recursive: true, force: true }))
    const original = { format: 'stratified-tikz-diagram', version: 1, diagram: { version: 1, ambientDimension: 2,
      strata: [{ id: 'p', geometricKind: 'point', codim: 2, text: '  $x$\t\r\n ' }], labels: [] } }
    const expected = structuredClone(original)
    expected.diagram.view = { exportMode: 'inlineMath' }
    const payload = structuredClone(expected)
    if (defect === 'missing mode') delete payload.diagram.view.exportMode
    if (defect === 'stale mode') payload.diagram.view.exportMode = 'standalone'
    if (defect === 'point text') payload.diagram.strata[0].text = '$x$'
    const before = { json: JSON.stringify(original), history: 'original history', labelDocumentRevision: 1,
      uiSettings: JSON.stringify({ exportMode: defect === 'stale observation' ? 'standalone' : 'inlineMath' }) }
    let snapshot = before, clicked = false
    const observations = []
    const page = new EventEmitter()
    page.isClosed = () => false
    page.evaluate = async (fn, args) => {
      if (args) {
        assert.equal(args.json, before.json)
        assert.deepEqual(args.settings, JSON.parse(before.uiSettings))
        return expected
      }
      return fn.toString().includes('state()') ? snapshot : undefined
    }
    page.getByLabel = () => ({ inputValue: async () => 'inlineMath' })
    page.getByRole = (role, options) => ({ click: async () => {
      assert.equal(role, 'button'); assert.equal(options.name, 'Download JSON')
      assert.equal(observations.at(-1).boundary, 'before-download')
      clicked = true
      if (defect === 'history') snapshot = { ...before, history: 'mutated history' }
      page.emit('download', { saveAs: (path) => writeFile(path, JSON.stringify(payload)) })
    } })
    const diagnose = async (details) => { observations.push(structuredClone(details)) }
    const operation = saveAppJson({ page, artifactDir, name: 'native', diagnose, owned: [] })
    if (defect === 'none') {
      const saved = await operation
      snapshot = { ...before, json: JSON.stringify(payload), labelDocumentRevision: 2 }
      await checkAppJsonReload({ page, saved, diagnose })
      assert.equal(observations.at(-1).boundary, 'reload')
      snapshot = { ...snapshot, uiSettings: JSON.stringify({ exportMode: 'standalone' }) }
      await assert.rejects(checkAppJsonReload({ page, saved, diagnose }), /Reload restores saved UI state/)
      assert.equal(observations.at(-1).loaded.uiSettings, snapshot.uiSettings)
    } else await assert.rejects(operation, /JSON download difference paths|Download preserves history|Fresh observed export mode/)
    assert.equal(clicked, defect !== 'stale observation')
    if (clicked) {
      assert.deepEqual(JSON.parse(await readFile(join(artifactDir, 'native.json'), 'utf8')), payload)
      const recorded = observations.find((d) => d.boundary === 'download')
      assert.deepEqual(recorded.payload, payload)
      assert.deepEqual(recorded.expected, expected)
      assert.deepEqual(recorded.originalModel, original)
    }
    assert.ok(observations.every((d) => d.result !== 'passed'))
    assert.equal(page.listenerCount('download'), 0)
  })
}

function pointControlChange(ambientDimension, exportMode) {
  const settings = { exportMode, includeCoordinateAxesInTikz: exportMode === 'standalone',
    visibility: { enabled: true, surfaceDepthSort: false, curveOcclusion: true },
    ...(ambientDimension === 3 ? { camera3d: { mode: '3d', kind: 'orthographic', thetaDeg: 41,
      phiDeg: -28, zoom: 1.3, pan: { x: 12, y: -9 } } } : {}) }
  const savedControls = { exportMode,
    ...(ambientDimension === 3 ? { axes: exportMode === 'standalone', visibility: true, surfaceDepthSort: false,
      camera: { theta: 41, phi: -28, zoom: 1.3, 'pan x': 12, 'pan y': -9 } } : {}) }
  const after = { json: JSON.stringify({ diagram: { ambientDimension, strata: [
    { id: 'point-1', geometricKind: 'point', codim: ambientDimension, text: '  $x$\t\r\n ' },
  ] } }), history: JSON.stringify({ past: [{ id: 'earlier' }], future: [] }),
  labelDocumentRevision: 5, uiSettings: JSON.stringify(settings) }
  const changedSettings = structuredClone(settings)
  changedSettings.exportMode = exportMode === 'inlineMath' ? 'standalone' : 'inlineMath'
  const controls = { ...structuredClone(savedControls), exportMode: changedSettings.exportMode }
  if (ambientDimension === 3) {
    changedSettings.includeCoordinateAxesInTikz = !settings.includeCoordinateAxesInTikz
    changedSettings.visibility.enabled = false
    changedSettings.visibility.surfaceDepthSort = true
    changedSettings.camera3d.thetaDeg = 63
    Object.assign(controls, { axes: !savedControls.axes, visibility: false, surfaceDepthSort: true })
    controls.camera.theta = 63
  }
  return { saved: { ambientDimension, controls: savedControls, after },
    beforeLoad: { ...after, uiSettings: JSON.stringify(changedSettings) }, controls }
}

function editSettings(snapshot, change) {
  const settings = JSON.parse(snapshot.uiSettings)
  change(settings)
  snapshot.uiSettings = JSON.stringify(settings)
}

for (const dimension of [2, 3]) for (const mode of ['inlineMath', 'standalone']) {
  test(`${dimension}D ${mode} point pre-reload contract proves changes without mutating snapshots`, () => {
    const input = pointControlChange(dimension, mode), original = structuredClone(input)
    assertPointPersistenceChanged(input)
    assert.deepEqual(input, original)
  })
  test(`${dimension}D ${mode} point pre-reload rejects an unchanged export mode`, () => {
    const input = pointControlChange(dimension, mode)
    input.controls.exportMode = mode
    editSettings(input.beforeLoad, (settings) => { settings.exportMode = mode })
    assert.throws(() => assertPointPersistenceChanged(input), /opposite export mode/)
  })
}

const missedPointTransitions = {
  visibility(input) {
    input.controls.visibility = true
    editSettings(input.beforeLoad, (settings) => { settings.visibility.enabled = true })
  },
  'surface sorting'(input) {
    input.controls.surfaceDepthSort = false
    editSettings(input.beforeLoad, (settings) => { settings.visibility.surfaceDepthSort = false })
  },
  axes(input) {
    input.controls.axes = input.saved.controls.axes
    editSettings(input.beforeLoad, (settings) => { settings.includeCoordinateAxesInTikz = input.controls.axes })
  },
  theta(input) {
    input.controls.camera.theta = 41
    editSettings(input.beforeLoad, (settings) => { settings.camera3d.thetaDeg = 41 })
  },
}
for (const [name, mutate] of Object.entries(missedPointTransitions)) for (const mode of ['inlineMath', 'standalone']) {
  test(`3D ${mode} point pre-reload rejects missed ${name} even when UI and control agree`, () => {
    const input = pointControlChange(3, mode)
    mutate(input)
    assert.throws(() => assertPointPersistenceChanged(input), /Point (reload begins|visibility changes|surface sorting changes|theta changes)/)
  })
}

for (const [control, setting, value] of [
  ['visibility', 'enabled', false], ['surfaceDepthSort', 'surfaceDepthSort', true],
]) test(`point pre-reload rejects a saved ${control} baseline that would bypass the transition`, () => {
  const input = pointControlChange(3, 'standalone')
  input.saved.controls[control] = value
  editSettings(input.saved.after, (settings) => { settings.visibility[setting] = value })
  assert.throws(() => assertPointPersistenceChanged(input), /Saved point (visibility|surface sorting)/)
})

test('point pre-reload requires the saved theta baseline and every camera control', () => {
  const changedTheta = pointControlChange(3, 'inlineMath')
  changedTheta.saved.controls.camera.theta = 63
  editSettings(changedTheta.saved.after, (settings) => { settings.camera3d.thetaDeg = 63 })
  assert.throws(() => assertPointPersistenceChanged(changedTheta), /Saved point theta is 41/)
  const missingSaved = pointControlChange(3, 'inlineMath')
  delete missingSaved.saved.controls.camera.phi
  assert.throws(() => assertPointPersistenceChanged(missingSaved), /every expanded control/)
  const missingLive = pointControlChange(3, 'inlineMath')
  delete missingLive.controls.camera.phi
  assert.throws(() => assertPointPersistenceChanged(missingLive), /other camera controls remain saved/)
})

test('point pre-reload rejects incidental camera or UI changes', () => {
  const camera = pointControlChange(3, 'standalone')
  camera.controls.camera.phi = -27
  editSettings(camera.beforeLoad, (settings) => { settings.camera3d.phiDeg = -27 })
  assert.throws(() => assertPointPersistenceChanged(camera), /other camera controls remain saved/)
  const visibility = pointControlChange(3, 'standalone')
  editSettings(visibility.beforeLoad, (settings) => { settings.visibility.curveOcclusion = false })
  assert.throws(() => assertPointPersistenceChanged(visibility), /exactly the intended changes/)
})

for (const dimension of [2, 3]) test(`${dimension}D point pre-reload rejects stale UI despite changed controls`, () => {
  const input = pointControlChange(dimension, 'inlineMath')
  input.beforeLoad.uiSettings = input.saved.after.uiSettings
  assert.throws(() => assertPointPersistenceChanged(input), /Fresh observed export mode/)
})
test('3D point pre-reload rejects stale committed visibility despite a changed checkbox', () => {
  const input = pointControlChange(3, 'inlineMath')
  editSettings(input.beforeLoad, (settings) => { settings.visibility.enabled = true })
  assert.throws(() => assertPointPersistenceChanged(input))
})

for (const key of ['json', 'history', 'labelDocumentRevision']) test(`point controls cannot mutate ${key} before reload`, () => {
  const input = pointControlChange(3, 'standalone')
  input.beforeLoad[key] = key === 'labelDocumentRevision' ? 6 : `${input.beforeLoad[key]} changed`
  assert.throws(() => assertPointPersistenceChanged(input), new RegExp(`Point control changes preserve ${key}`))
})

test('point transition evidence precedes assertions and a write failure cannot mask the missing transition', async () => {
  const input = pointControlChange(3, 'standalone'), observations = []
  missedPointTransitions.visibility(input)
  await assert.rejects(checkPersistenceEvidence(input, async (details) => { observations.push(structuredClone(details)) },
    () => assertPointPersistenceChanged(input)), /Point visibility changes/)
  assert.equal(observations.length, 1)
  assert.equal(observations[0].controls.visibility, true)
  await assert.rejects(checkPersistenceEvidence(input, async () => { throw new Error('secondary write failure') },
    () => assertPointPersistenceChanged(input)), /Point visibility changes/)
})
