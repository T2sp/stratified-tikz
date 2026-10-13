import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { assertSingularCylinderEvidence, assertSingularCylinderStandaloneEvidence, assertSingularCylinderNative,
  assertSingularCylinderSvg, singularCylinderScenario, subspCylinderScenario } from '../../scripts/singularCylinderDiagnosticContract.mjs'
import { syntheticSingularCylinderStandalone } from './singularCylinderFixture.mjs'

function fixture(run, scenario = singularCylinderScenario) {
  const directory = mkdtempSync(join(tmpdir(), 'stz-singular-cylinder-policy-'))
  try {
    const pair = [2, 3].map(dimension => syntheticSingularCylinderStandalone(directory, dimension, scenario)), evidence = pair[0].evidence
    evidence.downloads[1] = pair[1].download
    run({ directory, pair, evidence })
  } finally { rmSync(directory, { recursive: true, force: true }) }
}
for (const dimension of [2, 3]) test(`synthetic singular cylinder diagnostic replays exact ${dimension}D empty shell/warning/PNG/TikZ/native bytes`, () => fixture(({ directory, pair, evidence }) => {
  const context = assertSingularCylinderStandaloneEvidence(evidence, pair[dimension - 2].raw, directory, dimension)
  assert.equal(context.schema, 'stz-singular-cylinder-diagnostic-artifact-v1'); assert.equal(context.source, '')
  assert.equal(context.svgPath, pair[dimension - 2].svgPath); assert.match(context.pngSha256, /^[a-f0-9]{64}$/u)
}))
const nativeFaults = [
  ['untrusted warning gesture', value => { value.clicks[1].events.events[0].trusted = false }],
  ['missing warning pointerdown', value => { value.clicks[1].events.events.shift() }],
  ['stale native request', value => { value.clicks[1].events.events[0].identity.pointRequest = 'stale' }],
  ['wrong native ambient dimension', value => { value.clicks[1].events.events[0].identity.ambientDimension = 3 }],
  ['wrong native shape', value => { value.clicks[1].events.events[0].identity.shape = 'ellipse' }],
  ['wrong native source', value => { value.clicks[1].events.events[0].identity.source = 'wrong' }],
  ['wrong native owner', value => { value.clicks[1].events.events[0].identity.ownerToken = 'wrong' }],
  ['wrong native epoch', value => { value.clicks[1].events.events[0].identity.epoch++ }],
  ['duplicate native order', value => { value.clicks[1].events.events[1].order = 0 }],
  ['stale captured down', value => { value.clicks[1].events.events[0].canvasHasPointerCapture = true }],
  ['unreleased click capture', value => { value.clicks[1].events.events[2].canvasHasPointerCapture = true }],
  ['foreign hit canvas token', value => { value.clicks[1].hit.target.canvasToken = 'foreign' }],
  ['obstructing native overlay', value => { value.clicks[1].events.events[0].target.overlay = true }],
  ['missing immediate state', value => { delete value.clicks[1].inputState }],
  ['stale immediate geometry', value => { value.clicks[1].inputObservation.nodeTransform = 'translate(0 0)' }],
  ['missing observer cleanup', value => { delete value.cleanup }],
  ['observer leaked', value => { value.cleanup.observerAbsentAfter = false }],
  ['wrong selected owner', value => { value.clicks[1].after.selection.id = 'foreign' }],
  ['invented cylinder contour', value => { value.clicks[1].observation.contourCount = 1 }],
  ['leaked cylinder seam', value => { value.clicks[1].observation.internalBorderCount = 1 }],
  ['leaked custom cylinder region', value => { value.clicks[1].observation.paintRegionCount = 1 }],
  ['oversized selection ring', value => { value.clicks[2].observation.ring.r = 200 }],
]
for (const [name, mutate] of nativeFaults) test(`synthetic singular cylinder native rejects ${name}`, () => fixture(({ evidence }) => {
  const entry = structuredClone(evidence.cases[0].native); mutate(entry)
  assert.throws(() => assertSingularCylinderNative(entry))
}))
test('synthetic singular native proof cannot come from a different otherwise-valid history', () => fixture(({ evidence }) => {
  const current = structuredClone(evidence), native = current.cases[0].native, visited = new Set()
  const changeHistory = value => {
    if (!value || typeof value !== 'object' || visited.has(value)) return
    visited.add(value)
    if (typeof value.history === 'string' && typeof value.runtimeDiagramJson === 'string') {
      const history = JSON.parse(value.history)
      history.past.push(JSON.parse(value.runtimeDiagramJson)); value.history = JSON.stringify(history)
    }
    for (const child of Object.values(value)) changeHistory(child)
  }
  changeHistory(native)
  assertSingularCylinderNative(native)
  assert.throws(() => assertSingularCylinderEvidence(current), /final recorded Inspector transition/u)
}))
const svgFaults = [
  ['missing warning', xml => xml.replace(/<path\b[\s\S]*?<\/path>/u, '')],
  ['damaged warning paint', xml => xml.replace('fill="#B45309"', 'fill="#FF00FF"')],
  ['damaged warning title', xml => xml.replace('Shape preview unavailable:', 'Unsupported:')],
  ['missing empty source title', xml => xml.replace('<title/>', '')],
  ['dummy body glyph', xml => xml.replace('<g/></g></g>', '<g><text>x</text></g></g></g>')],
  ['leaked requested contour', xml => xml.replace('</path>', '</path><path d="M0 0L1 1"/>')],
  ['extra root shape', xml => xml.replace('</svg>', '<path d="M0 0L1 1"/></svg>')],
  ['foreign inherited root paint', xml => xml.replace('<svg ', '<svg fill="red" ')],
]
for (const [name, mutate] of svgFaults) test(`synthetic singular cylinder SVG rejects ${name}`, () => fixture(({ pair }) => {
  const raw = pair[0].raw
  assert.throws(() => assertSingularCylinderSvg(raw, mutate(raw.xml)))
}))
test('synthetic singular cylinder rejects coherently changed TikZ coordinates', () => fixture(({ directory, pair, evidence }) => {
  const raw = pair[0].raw, download = evidence.downloads[0], source = raw.outputs.standalone.replace('(3,3)', '(9,9)')
  assert.notEqual(source, raw.outputs.standalone)
  raw.outputs.standalone = source; download.outputs.standalone = source
  writeFileSync(join(directory, `${download.scenario}-standalone.tex`), source)
  assert.throws(() => assertSingularCylinderStandaloneEvidence(evidence, raw, directory, 2), /current authored model/u)
}))
test('synthetic singular cylinder rejects a stale retained XML record against correct file bytes', () => fixture(({ directory, pair, evidence }) => {
  pair[0].raw.xml = pair[0].raw.xml.replace('#B45309', '#FFFFFF')
  assert.throws(() => assertSingularCylinderStandaloneEvidence(evidence, pair[0].raw, directory, 2), /Before-assert XML/u)
}))
test('synthetic singular cylinder rejects correct root capture when warning extends beyond the root', () => fixture(({ pair }) => {
  const raw = pair[0].raw
  raw.document.frame.rootBounds = { x: 500, y: 500, width: 520, height: 360 }
  assert.throws(() => assertSingularCylinderSvg(raw, raw.xml), /Every warning edge/u)
}))
test('synthetic singular cylinder rejects a normal PNG from the other owned file', () => fixture(({ directory, pair, evidence }) => {
  writeFileSync(pair[0].pngPath, readFileSync(pair[1].pngPath))
  assert.throws(() => assertSingularCylinderStandaloneEvidence(evidence, pair[0].raw, directory, 2))
}))
test('synthetic singular cylinder requires both real native dimensions', () => fixture(({ evidence }) => {
  evidence.cases.pop(); assert.throws(() => assertSingularCylinderEvidence(evidence))
}))

for (const dimension of [2, 3]) test(`synthetic sub-scaled-point cylinder replays exact ${dimension}D authored tiny dimension, warning-only file/native/PNG/TikZ proof`, () => fixture(({ directory, pair, evidence }) => {
  const context = assertSingularCylinderStandaloneEvidence(evidence, pair[dimension - 2].raw, directory, dimension)
  assert.equal(context.schema, 'stz-singular-cylinder-diagnostic-artifact-v1')
  const model = JSON.parse(pair[dimension - 2].raw.savedJson).diagram.strata[0]
  assert.equal(model.style.layout.innerYSep, .000001); assert.equal(model.style.layout.units.innerYSep.source, '0.000001pt')
  assert.equal(model.style.layout.minimumHeight, 80)
  assert.ok(pair[dimension - 2].raw.outputs.standalone.includes('inner ysep=0.000001pt'))
}, subspCylinderScenario))
for (const [name, mutate] of [
  ['original raw-zero scenario transplanted', value => { value.scenario = singularCylinderScenario }],
  ['invented narrow contour', value => { value.cases[0].native.clicks[1].observation.contourCount = 1 }],
  ['hidden seam', value => { value.cases[0].native.clicks[1].observation.internalBorderCount = 1 }],
  ['hidden custom paint regions', value => { value.cases[0].native.clicks[1].observation.paintRegionCount = 2 }],
  ['ninety-six-unit hidden painted bounds', value => { value.cases[0].native.clicks[1].observation.paintedBounds.maxX = 48 }],
  ['large hidden selection region', value => { value.cases[0].native.clicks[2].observation.ring.r = 48.4594 }],
]) test(`synthetic sub-scaled-point cylinder rejects ${name}`, () => fixture(({ evidence }) => {
  const current = structuredClone(evidence); mutate(current); assert.throws(() => assertSingularCylinderEvidence(current))
}, subspCylinderScenario))

// The fake browser schedules the ordinary UI/input/observer path; it never
// supplies native acceptance. It catches preparation and error-ownership bugs.
async function nativeWorkflowFixture({ collapsed, diagnosticFailure, nativeFailure } = {}) {
  const { runSingularCylinderNative, observeSingularCylinderPoint, observeSingularCylinderUi, observeSingularCylinderHit } = await import('../../scripts/singularCylinderDiagnostic.mjs')
  const directory = mkdtempSync(join(tmpdir(), 'stz-cylinder-native-control-'))
  try {
    const fixture = syntheticSingularCylinderStandalone(directory, 2), original = fixture.evidence.cases[0].native
    const current = structuredClone(original.before), ui = { inspectorOpen: true, toolbarCollapsed: collapsed }, controls = []
    let installed = false, active = false, index = 0, clicked = false, selectPressed = false
    const action = () => original.clicks[index]
    const page = {
      evaluate: async (fn, input) => {
        if (fn.name === 'installUnsupportedDiagnosticObserver') { installed = true; return }
        if (fn.name === 'removeUnsupportedDiagnosticObserver') { installed = false; return }
        if (fn === observeSingularCylinderPoint) {
          const raw = structuredClone(clicked ? original.clicks[index - 1].afterObservation : action().observation)
          raw.ring = current.selection ? { r: 19, cx: 0, cy: 0 } : null
          return raw
        }
        if (fn === observeSingularCylinderUi) return structuredClone(ui)
        if (fn === observeSingularCylinderHit) return { screen: structuredClone(action().screen), hit: structuredClone(action().hit) }
        if (fn.name === 'unsupportedDiagnosticEvents') {
          if (input.active) { active = true; clicked = false; return }
          active = false; return structuredClone(original.clicks[index - 1].events)
        }
        if (String(fn).includes('observer') || String(fn).includes('__stzUnsupportedDiagnostics')) return String(fn).includes('!== true') ? !installed : installed
        throw new Error(`Unexpected controlled page observation ${fn.name}`)
      },
      getByRole: (_role, { name }) => ({ count: async () => name === 'Select' && ui.toolbarCollapsed ? 0 : 1,
        getAttribute: async () => selectPressed ? 'true' : 'false', click: async () => {
          controls.push(name)
          if (name === 'Close inspector drawer') ui.inspectorOpen = false
          if (name === 'Open inspector drawer') ui.inspectorOpen = true
          if (name === 'Collapse preview toolbar') ui.toolbarCollapsed = true
          if (name === 'Expand preview toolbar') ui.toolbarCollapsed = false
          if (name === 'Select') { assert.equal(ui.toolbarCollapsed, false); selectPressed = true }
        } }),
      locator: () => ({ count: async () => 1, waitFor: async () => {}, scrollIntoViewIfNeeded: async () => {} }),
      mouse: { click: async () => {
        assert.equal(active, true)
        if (nativeFailure) throw nativeFailure
        current.selection = structuredClone(action().after.selection); index++; clicked = true
      } },
    }
    const secondary = []
    const promise = runSingularCylinderNative({ page, readState: async () => structuredClone(current), id: 'singular-cylinder', token: original.token,
      secondaryErrors: secondary, diagnose: async ({ stage }) => { if (stage === 'finished' && diagnosticFailure) throw diagnosticFailure } })
    if (nativeFailure) {
      await assert.rejects(promise, error => error === nativeFailure)
      assert.equal(installed, false); assert.deepEqual(ui, { inspectorOpen: true, toolbarCollapsed: collapsed })
      assert.deepEqual(secondary, [diagnosticFailure.message])
      return
    }
    const entry = await promise
    assert.equal(installed, false); assert.deepEqual(ui, { inspectorOpen: true, toolbarCollapsed: collapsed })
    assert.equal(controls.includes('Select'), true)
    if (collapsed) assert.ok(controls.indexOf('Expand preview toolbar') < controls.indexOf('Select'))
    assert.equal(entry.result, 'passed')
  } finally { rmSync(directory, { recursive: true, force: true }) }
}
for (const collapsed of [false, true]) test(`controlled singular native preparation restores inherited ${collapsed ? 'collapsed' : 'expanded'} toolbar and Inspector`, () => nativeWorkflowFixture({ collapsed }))
test('controlled singular native cleanup retains exact primary error when final evidence rejects', () => nativeWorkflowFixture({ collapsed: true,
  nativeFailure: new Error('actual native mouse failure'), diagnosticFailure: new Error('secondary finished evidence failure') }))
