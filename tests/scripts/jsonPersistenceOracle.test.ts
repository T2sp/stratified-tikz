import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import { defaultVisibilityOptions } from '../../src/model/visibility.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import type { OrthographicCamera3D } from '../../src/model/types.ts'
import type { SavedDiagramFile } from '../../src/model/serialization.ts'
import type { TikzExportUiOptions } from '../../src/ui/tikzExportMode.ts'
import { jsonPersistenceExpectation } from '../../scripts/fixtures/jsonPersistenceExpectation.ts'
// The same assertions executed at actual Download/Load JSON boundaries.
// @ts-expect-error JavaScript browser harness module has no declaration file.
import { assertJsonDownload, assertJsonReload, differencePaths, checkPersistenceEvidence } from '../../scripts/appJsonPersistence.mjs'

function fixture(ambientDimension: 2 | 3, exportMode: 'standalone' | 'inlineMath') {
  const diagram = createEmptyDiagram({ ambientDimension })
  diagram.strata = [createPointStratum({ ambientDimension, id: 'point-exact',
    text: '  日本 $g_j$\t\r\n tail  ', position: { x: .4, y: .7, z: ambientDimension === 3 ? .2 : 0 } })]
  const settings: TikzExportUiOptions = { exportMode, includeCoordinateAxesInTikz: false,
    visibility: { ...defaultVisibilityOptions, enabled: true, surfaceDepthSort: false },
    ...(ambientDimension === 3 ? { camera3d: { ...createInitialCamera3D(), thetaDeg: 41, phiDeg: -28, zoom: 1.3, pan: { x: 12, y: -9 } } } : {}) }
  const before = { json: serializeDiagram(diagram), history: 'independent history', uiSettings: JSON.stringify(settings), labelDocumentRevision: 4 }
  // Explicit expected file built independently of the expectation helper.
  const payload = JSON.parse(before.json) as SavedDiagramFile
  payload.diagram.view = { ...payload.diagram.view, exportMode, visibility: structuredClone(settings.visibility),
    ...(ambientDimension === 3 ? { camera3d: structuredClone(settings.camera3d), showCoordinateAxesInTikz: false } : {}) }
  const expected = jsonPersistenceExpectation(before.json, settings)
  return { before, after: { ...before }, settings, payload, expected }
}

for (const dimension of [2, 3] as const) for (const mode of ['standalone', 'inlineMath'] as const) {
  test(`${dimension}D ${mode}: separate model/UI save boundary and strict reload`, () => {
    const input = fixture(dimension, mode)
    assert.notDeepEqual(input.payload, JSON.parse(input.before.json), 'Reproduces diagnostic versus download distinction')
    assert.deepEqual(input.expected, input.payload)
    assertJsonDownload(input)
    const parsed = parseSavedDiagramJson(JSON.stringify(input.payload))
    assert.ok(parsed.ok)
    const loaded = { ...input.before, json: serializeDiagram(parsed.diagram) }
    const saved = { ...input, controls: { exportMode: mode } }
    assertJsonReload({ saved, loaded, controls: saved.controls })
    assert.equal(parsed.diagram.strata[0].geometricKind, 'point')
    assert.deepEqual(JSON.parse(loaded.json), input.payload)
  })
}

const defects: Record<string, (file: SavedDiagramFile) => void> = {
  'missing mode': (f) => { delete f.diagram.view!.exportMode },
  'stale mode': (f) => { f.diagram.view!.exportMode = 'standalone' },
  'incorrect mode': (f) => { Object.assign(f.diagram.view!, { exportMode: 'broken' }) },
  'missing camera': (f) => { delete f.diagram.view!.camera3d },
  'stale camera': (f) => { f.diagram.view!.camera3d = createInitialCamera3D() },
  'incorrect axis': (f) => { f.diagram.view!.showCoordinateAxesInTikz = true },
  'missing axis': (f) => { delete f.diagram.view!.showCoordinateAxesInTikz },
  'missing visibility': (f) => { delete f.diagram.view!.visibility },
  'stale visibility': (f) => { f.diagram.view!.visibility = { ...defaultVisibilityOptions } },
  'incorrect visibility detail': (f) => { f.diagram.view!.visibility!.hiddenCurveStyle!.opacity = .2 },
  'raw whitespace': (f) => { Object.assign(f.diagram.strata[0], { text: '日本 $g_j$\n tail' }) },
  'stale text': (f) => { Object.assign(f.diagram.strata[0], { text: '$old$' }) },
  'coordinate': (f) => { Object.assign(f.diagram.strata[0], { position: { x: 1, y: 2, z: 3 } }) },
  'ID': (f) => { f.diagram.strata[0].id = 'other' },
  'codim': (f) => { Object.assign(f.diagram.strata[0], { codim: 2 }) },
  'style': (f) => { Object.assign(f.diagram.strata[0].style, { opacity: .1 }) },
  'layer': (f) => { f.diagram.strata[0].layer = 12 },
  'unrelated document field': (f) => { f.diagram.layers![0].name = 'changed' },
  'extra view data': (f) => { Object.assign(f.diagram.view!, { unexpected: true }) },
  'format': (f) => { Object.assign(f, { format: 'other' }) },
  'version': (f) => { Object.assign(f, { version: 2 }) },
}
for (const [name, mutate] of Object.entries(defects)) test(`save rejects ${name}`, () => {
  const input = fixture(3, 'inlineMath')
  mutate(input.payload)
  assert.ok(differencePaths(input.payload, input.expected).length)
  assert.throws(() => assertJsonDownload(input), /JSON download difference paths/)
})
for (const key of ['json', 'history', 'uiSettings', 'labelDocumentRevision'] as const) test(`download cannot change ${key}`, () => {
  const input = fixture(2, 'standalone')
  Object.assign(input.after, { [key]: key === 'labelDocumentRevision' ? 5 : 'changed' })
  assert.throws(() => assertJsonDownload(input), new RegExp(`Download preserves ${key}`))
})
test('existing view, UI overrides, defaults, 2D applicability and camera normalization', () => {
  const input = fixture(3, 'standalone')
  const settings = { ...input.settings, visibility: { ...defaultVisibilityOptions }, includeCoordinateAxesInTikz: true }
  const file = structuredClone(input.payload)
  const expected = jsonPersistenceExpectation(JSON.stringify(file), settings)
  assert.equal(expected.diagram.view!.visibility, undefined)
  assert.equal(expected.diagram.view!.showCoordinateAxesInTikz, true)
  // Use a valid 2D fixture with existing axis metadata: UI axis/camera options
  // are inapplicable, while the stored axis flag remains part of the contract.
  const two = fixture(2, 'inlineMath').payload
  two.diagram.view!.showCoordinateAxesInTikz = true
  const twoExpected = jsonPersistenceExpectation(JSON.stringify(two), settings)
  assert.equal(twoExpected.diagram.view!.showCoordinateAxesInTikz, true)
  assert.equal(twoExpected.diagram.view!.camera3d, undefined)
  const camera: OrthographicCamera3D = { ...createInitialCamera3D(), projectionBasis: { xVector: [1, 0], yVector: [0, 1], zVector: [0, 0] } }
  const normalized = jsonPersistenceExpectation(input.before.json, { ...settings, camera3d: camera })
  assert.equal(normalized.diagram.view!.camera3d!.projectionBasis, undefined)
})
test('reload rejects raw-content and restored-control/state corruption', () => {
  const saved = { ...fixture(3, 'inlineMath'), controls: { exportMode: 'inlineMath' } }
  const loaded = { ...saved.before, json: JSON.stringify(saved.payload) }
  assert.throws(() => assertJsonReload({ saved, loaded: { ...loaded, json: saved.before.json }, controls: saved.controls }))
  assert.throws(() => assertJsonReload({ saved, loaded: { ...loaded, uiSettings: '{}' }, controls: saved.controls }))
  assert.throws(() => assertJsonReload({ saved, loaded, controls: { exportMode: 'standalone' } }))
})
test('pre-assertion evidence survives failure and primary mismatch wins over diagnostic error', async () => {
  const input = fixture(3, 'inlineMath')
  delete input.payload.diagram.view!.exportMode
  const observations: unknown[] = []
  await assert.rejects(checkPersistenceEvidence(input, async (details: unknown) => { observations.push(structuredClone(details)) },
    () => assertJsonDownload(input)), /JSON download difference paths/)
  assert.equal(observations.length, 1)
  await assert.rejects(checkPersistenceEvidence(input, async () => { throw new Error('secondary write') },
    () => assertJsonDownload(input)), /JSON download difference paths/)
})
