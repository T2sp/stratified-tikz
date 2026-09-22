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

export async function saveAppJson({ page, artifactDir, name, diagnose, owned }) {
  // Flush committed read-only observations after the preceding native UI action.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
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
