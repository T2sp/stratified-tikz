import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ownPageEvent } from './ownedPageEvent.mjs'

export function differencePaths(actual, expected, path = '$') {
  if (Object.is(actual, expected)) return []
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object'
    || Array.isArray(actual) !== Array.isArray(expected)) return [path]
  return [...new Set([...Object.keys(actual), ...Object.keys(expected)])].flatMap((key) =>
    !Object.hasOwn(actual, key) || !Object.hasOwn(expected, key) ? [`${path}.${key}`]
      : differencePaths(actual[key], expected[key], `${path}.${key}`))
}

export function assertJsonDownload({ before, after, payload, expected }) {
  assert.deepEqual(payload, expected, `JSON download difference paths: ${differencePaths(payload, expected).join(', ')}`)
  for (const key of ['json', 'history', 'uiSettings', 'labelDocumentRevision']) {
    assert.equal(after[key], before[key], `Download preserves ${key}`)
  }
}

export function assertJsonReload({ saved, loaded, controls }) {
  assert.deepEqual(JSON.parse(loaded.json), saved.payload, 'Reload preserves the entire saved document')
  assert.deepEqual(JSON.parse(loaded.uiSettings), JSON.parse(saved.before.uiSettings), 'Reload restores saved UI state')
  assert.deepEqual(controls, saved.controls, 'Reload restores selected controls')
}

/** Evidence precedes assertions; a secondary write failure cannot mask a primary
 * persistence mismatch. No observation is recorded as a passing scenario. */
export async function checkPersistenceEvidence(details, diagnose, check) {
  try { await diagnose(details) } catch (error) {
    check() // If both fail, preserve the actual assertion.
    throw error
  }
  check()
}

export async function readPersistenceControls(page, ambientDimension) {
  const controls = { exportMode: await page.getByLabel(/^TikZ export mode:/).inputValue() }
  if (ambientDimension === 3) {
    controls.axes = await page.getByLabel('Show xyz axes in TikZ output', { exact: true }).isChecked()
    controls.visibility = await page.getByLabel('Enable approximate 3D visibility', { exact: true }).isChecked()
    controls.surfaceDepthSort = await page.getByLabel('Auto depth-sort surfaces', { exact: true }).isChecked()
    // Camera controls may be collapsed; their committed state is also observed
    // separately in uiSettings. Native point coverage keeps them expanded.
    controls.camera = {}
    for (const label of ['theta', 'phi', 'zoom', 'pan x', 'pan y']) {
      const field = page.getByRole('spinbutton', { name: `${label} value`, exact: true })
      if (await field.count()) controls.camera[label] = Number(await field.inputValue())
    }
  }
  return controls
}

export function assertPersistenceControls(settings, controls) {
  assert.equal(settings.exportMode, controls.exportMode, 'Fresh observed export mode matches selected control')
  if ('axes' in controls) {
    assert.equal(settings.includeCoordinateAxesInTikz, controls.axes)
    assert.equal(settings.visibility.enabled, controls.visibility)
    assert.equal(settings.visibility.surfaceDepthSort, controls.surfaceDepthSort)
    const camera = settings.camera3d
    const values = { theta: camera.thetaDeg, phi: camera.phiDeg, zoom: camera.zoom, 'pan x': camera.pan.x, 'pan y': camera.pan.y }
    for (const [key, value] of Object.entries(controls.camera)) assert.equal(values[key], value, `Fresh camera ${key}`)
  }
}

/** The native point scenario deliberately changes live controls before reload.
 * This assertion proves the saved values differ from the current controls and
 * committed UI state, without changing the saved model or its history. */
export function assertPointPersistenceChanged({ saved, beforeLoad, controls }) {
  assert.ok(saved.ambientDimension === 2 || saved.ambientDimension === 3, 'Point persistence dimension is 2 or 3')
  assert.ok(['inlineMath', 'standalone'].includes(saved.controls.exportMode), 'Saved point export mode is explicit')
  for (const key of ['json', 'history', 'labelDocumentRevision']) {
    assert.equal(beforeLoad[key], saved.after[key], `Point control changes preserve ${key}`)
  }
  const savedSettings = JSON.parse(saved.after.uiSettings)
  const settings = JSON.parse(beforeLoad.uiSettings)
  assertPersistenceControls(savedSettings, saved.controls)
  assertPersistenceControls(settings, controls)
  const expectedMode = saved.controls.exportMode === 'inlineMath' ? 'standalone' : 'inlineMath'
  assert.equal(controls.exportMode, expectedMode, 'Point reload begins with the opposite export mode')
  const expectedSettings = structuredClone(savedSettings)
  expectedSettings.exportMode = expectedMode
  if (saved.ambientDimension === 3) {
    assert.equal(saved.controls.axes, saved.controls.exportMode === 'standalone', 'Saved point axes match the selected mode')
    assert.equal(saved.controls.visibility, true, 'Saved point visibility is enabled')
    assert.equal(saved.controls.surfaceDepthSort, false, 'Saved point surface sorting is disabled')
    assert.deepEqual(Object.keys(saved.controls.camera).sort(), ['pan x', 'pan y', 'phi', 'theta', 'zoom'],
      'Saved point camera includes every expanded control')
    assert.ok(Object.values(saved.controls.camera).every(Number.isFinite), 'Saved point camera controls are finite')
    assert.equal(saved.controls.camera.theta, 41, 'Saved point theta is 41')
    assert.equal(controls.axes, !saved.controls.axes, 'Point reload begins with opposite axes')
    assert.equal(controls.visibility, false, 'Point visibility changes from true to false before reload')
    assert.equal(controls.surfaceDepthSort, true, 'Point surface sorting changes from false to true before reload')
    assert.deepEqual(controls.camera, { ...saved.controls.camera, theta: 63 },
      'Point theta changes to 63 while other camera controls remain saved')
    expectedSettings.includeCoordinateAxesInTikz = !saved.controls.axes
    expectedSettings.visibility.enabled = false
    expectedSettings.visibility.surfaceDepthSort = true
    expectedSettings.camera3d.thetaDeg = 63
  }
  assert.deepEqual(settings, expectedSettings, 'Point pre-reload UI state contains exactly the intended changes')
}

/** A successful no-op check/uncheck is insufficient: retain a real trusted
 * input/change pair bracketed by this same document's control observations. */
export function assertNativePointCheckboxAction({ before, after, name, checked }) {
  const controls = [before, after].map((record) => {
    assert.equal(record.browser.status, 'available', 'Native checkbox observation is available')
    const snapshot = record.browser.snapshot
    assert.equal(snapshot.api.sameInstance, true, 'Native checkbox keeps the original App API')
    const group = snapshot.nativeControls.controls.find((control) => control.name === name)
    assert.equal(group?.matchCount, 1, 'Native checkbox has exactly one associated label match')
    assert.equal(group.matches.length, 1)
    const control = group.matches[0]
    assert.equal(control.connected, true)
    assert.equal(control.enabled, true)
    return control
  })
  const first = before.browser.snapshot, last = after.browser.snapshot
  assert.ok(first.generation, 'Native checkbox document generation is present')
  assert.equal(last.generation, first.generation, 'Native checkbox document is unchanged')
  assert.equal(last.url, first.url, 'Native checkbox URL is unchanged')
  assert.equal(controls[1].id, controls[0].id, 'Native checkbox node is unchanged')
  assert.equal(controls[0].checked, !checked, 'Native checkbox action begins with the opposite value')
  assert.equal(controls[1].checked, checked, 'Native checkbox action commits its target value')
  const events = last.nativeControls.events.samples.filter((event) => event.names.includes(name)
    && event.nodeId === controls[0].id && event.monotonic >= first.monotonic && event.monotonic <= last.monotonic)
  for (const type of ['input', 'change']) {
    assert.ok(events.some((event) => event.event === type && event.trusted === true && event.checked === checked),
      `Native checkbox ${type} event is trusted and belongs to this action`)
  }
  return { name, checked, generation: first.generation, url: first.url,
    before: { monotonic: first.monotonic, control: controls[0] },
    after: { monotonic: last.monotonic, control: controls[1] }, events }
}

/** Mandatory observations bracket the entire monitored action, including its
 * monitor drain. An optional in-flight sample must not collide with them. */
export async function checkNativePointCheckboxAction({ capture, action, name, checked }) {
  const before = await capture('before-input')
  await action()
  const after = await capture('after-input')
  return assertNativePointCheckboxAction({ before, after, name, checked })
}

export async function saveAppJson({ page, artifactDir, name, diagnose, owned,
  waitForFrames = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))) }) {
  // Flush committed read-only observations after the preceding native UI action.
  await waitForFrames()
  const before = await page.evaluate(() => window.stzAppLabels.state())
  const originalModel = JSON.parse(before.json)
  const ambientDimension = originalModel.diagram.ambientDimension
  const settings = JSON.parse(before.uiSettings)
  const controls = await readPersistenceControls(page, ambientDimension)
  const expected = await page.evaluate(({ json, settings }) => window.stzAppLabels.jsonPersistenceExpectation(json, settings), { json: before.json, settings })
  const path = resolve(artifactDir, `${name}.json`)
  const base = { boundary: 'before-download', ambientDimension, path, before, originalModel, settings, controls, expectedMetadata: expected.diagram.view, expected }
  await checkPersistenceEvidence(base, diagnose, () => assertPersistenceControls(settings, controls))
  const wait = ownPageEvent(page, 'download', { name, timeoutMs: 30_000 })
  owned?.push(wait)
  const { event: download } = await wait.run(() => page.getByRole('button', { name: 'Download JSON', exact: true }).click({ timeout: 5000 }))
  await download.saveAs(path)
  const json = await readFile(path, 'utf8')
  const after = await page.evaluate(() => window.stzAppLabels.state())
  // Persist bytes even if JSON parsing itself fails.
  await checkPersistenceEvidence({ ...base, boundary: 'download-bytes', json, after }, diagnose, () => JSON.parse(json))
  const payload = JSON.parse(json)
  const details = { ...base, boundary: 'download', json, payload, after, differencePaths: differencePaths(payload, expected) }
  await checkPersistenceEvidence(details, diagnose, () => assertJsonDownload(details))
  return details
}

export async function checkAppJsonReload({ page, saved, diagnose }) {
  const loaded = await page.evaluate(() => window.stzAppLabels.state())
  const controls = await readPersistenceControls(page, saved.ambientDimension)
  const details = { boundary: 'reload', ambientDimension: saved.ambientDimension, path: saved.path,
    originalModel: saved.originalModel, settings: saved.settings, expectedMetadata: saved.expectedMetadata,
    saved, loaded, controls, differencePaths: differencePaths(JSON.parse(loaded.json), saved.payload) }
  await checkPersistenceEvidence(details, diagnose, () => assertJsonReload(details))
  return details
}
