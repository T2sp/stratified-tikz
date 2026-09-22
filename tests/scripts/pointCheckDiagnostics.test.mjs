import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPointDiagnostics, cleanupPointCheck } from '../../scripts/pointCheckDiagnostics.mjs'
import { runPointThenAppChecks } from '../../scripts/checkPointNodes.mjs'

test('point matrix saves the failing current case before assertions, without passing or starting the App group', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-point-diagnostics-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const groups = [], diagnostics = [], passes = [], stages = []
  const context = { artifactDir, observe: async (name, details) => diagnostics.push({ name, ...details }),
    record: async (name) => passes.push(name), startGroup: async (group) => groups.push(group),
    completeGroup: async () => assert.fail('Cannot complete a failing matrix'), setStage: (stage) => stages.push(stage),
    page: { waitForFunction: async () => {}, evaluate: async (fn) => {
      const code = fn.toString()
      if (code.includes('getScreenCTM')) return null // Native point unexpectedly missing.
      return {}
    } } }
  await assert.rejects(runPointThenAppChecks(context, async () => assert.fail('Later App checks must remain unexecuted')), /assert|falsy/i)
  assert.deepEqual(groups, ['point-node-body-layout-lifecycle'])
  assert.deepEqual(stages, ['point-node-checks', ...groups]); assert.deepEqual(passes, [])
  const saved = JSON.parse(await readFile(join(artifactDir, diagnostics[0].artifact), 'utf8'))
  assert.deepEqual(saved, { group: groups[0], scenario: 'point-language-shapes-2d-3d', result: 'observed', ambientDimension: 2, shape: 'circle', source: '', point: null })
})

test('diagnostic callback failure still retains observation bytes and creates no passed record', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-point-observation-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const diagnose = createPointDiagnostics({ artifactDir, observe: async () => { throw new Error('diagnostic callback') } })
  await assert.rejects(diagnose('point-node-settled-export', 'case', { point: { source: '\t\r\n' } }), /diagnostic callback/)
  const data = JSON.parse(await readFile(join(artifactDir, 'point-observation-0001.json'), 'utf8'))
  assert.equal(data.result, 'observed'); assert.equal(data.point.source, '\t\r\n')
})

test('point cleanup preserves the primary assertion and rejects otherwise unowned cleanup failure', async () => {
  const failure = new Error('cleanup'), cleanup = async () => { throw failure }
  await cleanupPointCheck(new Error('primary assertion'), cleanup)
  await assert.rejects(cleanupPointCheck(undefined, cleanup), (error) => error === failure)
})
