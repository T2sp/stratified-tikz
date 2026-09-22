import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveAppJson, checkAppJsonReload } from '../../scripts/appJsonPersistence.mjs'

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
