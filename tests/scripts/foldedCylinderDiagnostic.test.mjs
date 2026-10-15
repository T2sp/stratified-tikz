import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { syntheticFoldedCylinderStandalone } from './foldedCylinderFixture.mjs'
import { assertFoldedCylinderEvidence, assertFoldedCylinderSvg, assertFoldedCylinderStandaloneEvidence } from '../../scripts/foldedCylinderContract.mjs'
function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'stz-folded-cylinder-policy-'))
  try {
    const pair = [2, 3].map(dimension => syntheticFoldedCylinderStandalone(directory, dimension)), evidence = pair[0].evidence
    evidence.cases[1] = pair[1].evidence.cases[1]; evidence.downloads[1] = pair[1].download
    run({ directory, pair, evidence })
  } finally { rmSync(directory, { recursive: true, force: true }) }
}
for (const dimension of [2, 3]) test(`synthetic folded cylinder authenticates every PGF anchor and complete ${dimension}D placement/file/PNG/TikZ proof`, () => fixture(({ directory, pair, evidence }) => {
  const context = assertFoldedCylinderStandaloneEvidence(evidence, pair[dimension - 2].raw, directory, dimension)
  assert.equal(context.schema, 'stz-folded-cylinder-artifact-v1'); assert.equal(context.source, '')
  assert.equal(evidence.cases[0].anchors.length, 37); assert.match(context.svgSha256, /^[a-f0-9]{64}$/u)
}))
for (const anchor of ['bottom', 'shape center', 'before bottom', 'after bottom', 'west', 'mid east', '+45.7', '-90.8']) {
  test(`synthetic folded cylinder rejects wrong role/sign construction for ${anchor}`, () => fixture(({ evidence }) => {
    const current = structuredClone(evidence), item = current.cases[0].anchors.find(entry => entry.anchor === anchor)
    item.rendered.anchorOffset.x -= 4 * 1.2; item.rendered.placementOffset.x += 4 * 1.2
    assert.throws(() => assertFoldedCylinderEvidence(current), /independent PGF/u)
  }))
}
test('synthetic folded cylinder distinguishes the placed DOM body origin from the unplaced empty PGF box', () => fixture(({ evidence }) => {
  const current = structuredClone(evidence), bottom = current.cases[0].anchors.find(entry => entry.anchor === 'bottom')
  assert.ok(Math.abs(bottom.rendered.bodyOrigin.x + 4.6 * 1.2) < .025 * 1.2)
  bottom.rendered.bodyOrigin = { x: 0, y: 0 }
  assert.throws(() => assertFoldedCylinderEvidence(current), /anchor matches/u)
}))
test('synthetic folded cylinder distinguishes the placed mid-anchor baseline from the unplaced empty PGF baseline', () => fixture(({ evidence }) => {
  const current = structuredClone(evidence), mid = current.cases[0].anchors.find(entry => entry.anchor === 'mid')
  assert.ok(Math.abs(mid.rendered.baseline - 2.15277 * 1.2) < .025 * 1.2)
  mid.rendered.baseline = 0
  assert.throws(() => assertFoldedCylinderEvidence(current), /placed body frame/u)
}))
for (const [name, mutate] of [
  ['missing named anchor', value => value.cases[0].anchors.splice(5, 1)],
  ['stale reference bytes', value => { value.reference.sha256 = '0'.repeat(64) }],
  ['untrusted Inspector input', value => { value.cases[0].anchors[1].field.events[0].trusted = false }],
  ['raw negative padding lost', value => { const item = value.cases[0].anchors[0], model = JSON.parse(item.state.runtimeDiagramJson); model.strata[0].style.layout.innerXSep = 30; item.state.runtimeDiagramJson = JSON.stringify(model) }],
  ['native picked another owner', value => { value.cases[0].final.rendered.nativeSelection.selected.id = 'foreign' }],
  ['stale native request', value => { value.cases[0].anchors[1].rendered.bodyRequest = 'stale' }],
  ['invented warning', value => { value.cases[0].anchors[0].rendered.warningCount = 1 }],
  ['lost seam', value => { value.cases[0].anchors[0].rendered.seams = [] }],
]) test(`synthetic folded cylinder rejects ${name}`, () => fixture(({ evidence }) => {
  const current = structuredClone(evidence); mutate(current); assert.throws(() => assertFoldedCylinderEvidence(current))
}))
for (const [name, mutate] of [
  ['missing outline', value => value.replace(/<path[^>]+\/>/u, '')],
  ['changed seam', value => value.replace('M 0.72 -6 A 6 6 0 0 0 0.72 6', 'M 0.72 -6 L 0.72 6')],
  ['missing empty title', value => value.replace('<title/>', '')],
  ['extra glyph paint', value => value.replace('<g/></g></g>', '<g><text>fake</text></g></g></g>')],
  ['foreign root transform', value => value.replace('<svg ', '<svg transform="translate(2 0)" ')],
]) test(`synthetic folded cylinder file rejects ${name}`, () => fixture(({ pair }) => {
  assert.throws(() => assertFoldedCylinderSvg(pair[0].raw, mutate(pair[0].raw.xml)))
}))
test('synthetic folded cylinder rejects valid retained matrix belonging to another file placement', () => fixture(({ pair }) => {
  const raw = structuredClone(pair[0].raw)
  raw.reopened[0].matrices.seamScreenCTM.e += 1
  assert.throws(() => assertFoldedCylinderSvg(raw, raw.xml), /file-local/u)
}))
test('synthetic folded cylinder rejects actual PNG bytes replaced after retained observations', () => fixture(({ pair, directory, evidence }) => {
  const bytes = Buffer.from(pair[0].png); bytes[bytes.length - 10] ^= 1; writeFileSync(pair[0].pngPath, bytes)
  assert.throws(() => assertFoldedCylinderStandaloneEvidence(evidence, pair[0].raw, directory, 2))
}))
