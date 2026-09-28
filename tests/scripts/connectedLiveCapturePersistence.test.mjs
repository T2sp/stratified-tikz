import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { observeLivePaint } from '../../scripts/checkPointDashCaps.mjs'
import { connectedLivePaintIsolationInDocument } from '../../scripts/connectedLivePaintIsolation.mjs'
import { dashCapEvidence, syntheticDashCapLivePng } from './dashCapEvidenceFixture.mjs'

// Exercise the actual capture/persistence/framing orchestration. DOM/CSS and
// retained native obstruction evidence have separate registered tests; this
// page double is not native paint acceptance.
async function fixture(t, scale, failureZoom, cleanupFails = false) {
  const dir = await mkdtemp(join(tmpdir(), 'stz-live-capture-persistence-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const entry = dashCapEvidence().cases.find((row) => row.key === 'square-zero-off' && row.scale === scale)
  const references = structuredClone(entry.observation.livePaint.captures)
  const observation = structuredClone(entry.observation)
  observation.probes = structuredClone(entry.probes)
  let zoom = false, framingRestored = false
  const calls = [], snapshots = []
  const saved = { style: 'width:900px', viewBox: '0 0 900 700', json: 'authoritative model', history: 4 }
  const current = () => references[Number(zoom)]
  const isolation = () => ({ valid: true, source: current().source, ctm: current().ctm, paintSupport: { enclosed: true } })
  const page = {
    async evaluate(operation, argument) {
      if (operation === connectedLivePaintIsolationInDocument) {
        calls.push({ action: argument.action, zoom })
        if (argument.action === 'restore') {
          if (cleanupFails) throw new Error('secondary isolation cleanup failure')
          return { restored: true, ctm: current().ctm }
        }
        return isolation()
      }
      const source = operation.toString()
      if (source.includes('select(null)')) return undefined
      if (source.includes('saved.style')) { framingRestored = true; zoom = false; return { ...saved, ctm: current().ctm } }
      if (source.includes("viewBox', '416")) { zoom = true; return undefined }
      if (source.includes('rawPoints:')) return Object.fromEntries(['rawPoints', 'vertices', 'pathLength', 'ctm', 'selection', 'stroke', 'viewport', 'source', 'overlays'].map((key) => [key, structuredClone(current()[key])]))
      if (source.includes('source: contour.outerHTML')) return { source: current().source, ctm: current().ctm }
      if (source.includes('history: state.history')) return { ...saved }
      throw new Error(`Unexpected capture operation: ${source}`)
    },
    async screenshot({ path, scale: screenshotScale }) {
      assert.equal(screenshotScale, 'css')
      const ctm = { ...current().ctm }
      if (zoom === failureZoom) ctm.e += 30 * ctm.a // Independent obstruction crosses the unchanged requested boundary.
      const png = syntheticDashCapLivePng({ ctm }, entry.key)
      await writeFile(path, png)
      return png
    },
  }
  const persist = async () => {
    const live = observation.livePaint
    snapshots.push(structuredClone(live))
    await writeFile(join(dir, 'capture.json'), JSON.stringify(live))
  }
  return { page, dir, observation, persist, calls, snapshots, restored: () => framingRestored }
}

for (const scale of [.5, 1.5]) for (const failureZoom of [false, true]) test(`capture preserves PNG metadata and restores after boundary failure at scale ${scale}, zoom ${failureZoom}`, async (t) => {
  const f = await fixture(t, scale, failureZoom)
  await assert.rejects(observeLivePaint(f.page, f.dir, 'existing-case', f.observation, f.persist), (error) => {
    assert.match(error.message, /Live paint mask has an exterior margin/)
    assert.equal(error.captureDiagnostic.captureState.zoom, failureZoom)
    assert.ok(error.captureDiagnostic.boundary.includes('right'))
    return true
  })
  const retained = JSON.parse(await readFile(join(f.dir, 'capture.json'), 'utf8'))
  const capture = retained.captures.at(-1), png = await readFile(join(f.dir, capture.screenshot))
  assert.equal(capture.status, 'captured')
  assert.equal(capture.width, 1500); assert.equal(capture.height, 1150)
  assert.equal(capture.sha256, createHash('sha256').update(png).digest('hex'))
  assert.equal(capture.sourceSha256, createHash('sha256').update(capture.source).digest('hex'))
  assert.deepEqual(capture.region, { minX: -34, minY: -34, maxX: 34, maxY: 34 })
  assert.ok(f.snapshots.some((state) => state.captures.at(-1)?.status === 'captured' && !state.error))
  assert.equal(capture.isolationRestoration.restored, true)
  assert.equal(retained.restored, true); assert.equal(retained.modelUnchanged, true); assert.equal(f.restored(), true)
  assert.deepEqual(f.calls.filter(({ action }) => action === 'restore').map(({ zoom }) => zoom), failureZoom ? [false, true] : [false])
})

for (const scale of [.5, 1.5]) test(`clean responsive and magnified capture both restore at scale ${scale}`, async (t) => {
  const f = await fixture(t, scale, null)
  const result = await observeLivePaint(f.page, f.dir, 'existing-case', f.observation, f.persist)
  assert.deepEqual(result.captures.map(({ zoom, status, isolationRestoration }) => [zoom, status, isolationRestoration.restored]), [[false, 'inspected', true], [true, 'inspected', true]])
  assert.equal(result.restored, true); assert.equal(result.modelUnchanged, true)
  assert.deepEqual(result.interaction.mismatches, [])
  assert.deepEqual(f.calls.filter(({ action }) => action === 'install').map(({ zoom }) => zoom), [false, true])
})

test('boundary failure remains primary when owned isolation cleanup also fails; framing still restores', async (t) => {
  const f = await fixture(t, .5, false, true)
  await assert.rejects(observeLivePaint(f.page, f.dir, 'existing-case', f.observation, f.persist), /Live paint mask has an exterior margin/)
  const capture = f.observation.livePaint.captures[0]
  assert.match(capture.isolationCleanupError.message, /secondary isolation cleanup/)
  assert.equal(f.observation.livePaint.restored, true); assert.equal(f.restored(), true)
})
