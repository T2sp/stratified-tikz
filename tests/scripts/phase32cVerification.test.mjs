import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runPointDashCapMechanismChecks } from '../../scripts/checkPointDashCapMechanism.mjs'
import { dashCapMechanismStem } from '../../scripts/pointDashCapMechanismContract.mjs'
import { phase32cProfile, resolveVerificationProfile, mechanismNotRun, assertScopedMechanismEvidence,
  assertNamedStrict32BFailure, retainedLiteralOmissions } from '../../scripts/automation/phase32c-profile.mjs'
import { phase32CDispositionMatchesCheckout, pointNodeScenarioArtifacts, allPointNodeScenarios,
  runPhaseVerification, runPhase32CReviewVerification } from '../../scripts/automation/phase-verification.mjs'
import { geometricShapeManifest, geometricBodyVariants, geometricShapeScenarios, geometricShapeGroup,
  assertGeometricShapeEvidence } from '../../scripts/pointGeometricShapesContract.mjs'
import { syntheticMechanismEvidence } from './pointDashCapMechanismFixture.mjs'
import { selectGeometricPoint, installGeometricSelectionObserver, observeGeometricSelection,
  removeGeometricSelectionObserver } from '../../scripts/pointGeometricSelection.mjs'

// Controlled event-delivery boundaries exercise error ownership, not native
// acceptance. The real reused App sequence remains in the eleven-shape loop.
function selectionDeliveryControl(options = {}) {
  const { observationFailure, evidenceFailure, cleanupFailure, mouseFailure } = options
  const calls = [], observations = [], secondaryErrors = []
  const rendered = { shape: 'circle', source: 'native shape', center: { x: 1250, y: 270 }, boundary: { x: 1190, y: 280 } }
  const page = {
    getByRole: () => ({ click: async () => { calls.push('Select') } }),
    locator: () => ({ scrollIntoViewIfNeeded: async () => { calls.push('scroll') } }),
    mouse: { click: async (x, y) => { calls.push(['native click', x, y]); if (mouseFailure) throw mouseFailure } },
    evaluate: async (operation, argument) => {
      if (operation === installGeometricSelectionObserver) { calls.push('install'); return }
      if (operation === removeGeometricSelectionObserver) { calls.push('cleanup'); if (cleanupFailure) throw cleanupFailure; return }
      assert.equal(operation, observeGeometricSelection)
      calls.push('snapshot')
      if (observationFailure) throw observationFailure
      return { errors: [], layout: { shape: 'circle', source: 'native shape' }, requestedClick: argument.click,
        selection: options.selection, elementFromPoint: { drawer: !options.selection },
        events: calls.some(Array.isArray) ? ['pointerdown', 'pointerup', 'click'].map((type) => ({ type, trusted: true })) : [] }
    },
  }
  return { calls, observations, secondaryErrors, rendered, page,
    readState: async () => { calls.push('state'); return { selection: options.selection } },
    observePoint: async () => { calls.push('rendered after scroll'); return rendered },
    diagnose: async (details) => {
      calls.push(details.boundary)
      observations.push(structuredClone(details))
      if (evidenceFailure) throw evidenceFailure
    } }
}
test('selection diagnostics on one controlled page preserve successful then failed circle setup', async () => {
  const current = { selection: { id: 'app-point' } }, control = selectionDeliveryControl(current)
  assert.equal(await selectGeometricPoint({ ...control, scenario: 'point-geometric-ellipse', sequence: 1 }), control.rendered)
  current.selection = undefined
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2 }), (error) => {
    assert.equal(error.code, 'ERR_ASSERTION'); assert.equal(error.actual, undefined); assert.equal(error.expected, 'app-point')
    assert.match(error.message, /^Native contour click selects its point/)
    return true
  })
  const expectedCalls = ['Select', 'scroll', 'rendered after scroll', 'install', 'snapshot', 'before-native-click',
    ['native click', 1250, 270], 'state', 'snapshot', 'after-native-click-before-assertion', 'cleanup', 'selection-finished']
  assert.deepEqual(control.calls, [...expectedCalls, ...expectedCalls])
  for (const index of [0, 3]) {
    assert.equal(control.observations[index].observation.before.layout.shape, 'circle')
    assert.equal(control.observations[index + 1].observation.clickKind, 'center')
    assert.equal(control.observations[index + 1].result, undefined)
  }
  assert.equal(control.observations[4].observation.after.elementFromPoint.drawer, true)
  assert.match(control.observations.at(-1).primary.message, /^Native contour click selects its point/)
})
for (const failure of ['observationFailure', 'evidenceFailure', 'cleanupFailure']) {
  test(`failed native selection retains its assertion through ${failure}`, async () => {
    const control = selectionDeliveryControl({ [failure]: new Error(`controlled ${failure}`) })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2 }), (error) => {
      assert.equal(error.expected, 'app-point'); assert.match(error.message, /^Native contour click selects its point/); return true
    })
    assert.equal(control.calls.filter((call) => Array.isArray(call) && call[0] === 'native click').length, 1)
    assert.ok(control.calls.includes('cleanup'))
    assert.ok(control.secondaryErrors.some((message) => message.includes(failure)))
  })
  test(`successful selection cannot hide ${failure}`, async () => {
    const control = selectionDeliveryControl({ selection: { id: 'app-point' }, [failure]: new Error(`controlled ${failure}`) })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-ellipse', sequence: 1 }))
    assert.ok(control.secondaryErrors.some((message) => message.includes(failure)))
  })
}
test('boundary selection keeps measured boundary input and native action failure ownership', async () => {
  const primary = new Error('native mouse action failed'), control = selectionDeliveryControl({ mouseFailure: primary,
    observationFailure: new Error('observation failed'), cleanupFailure: new Error('cleanup failed') })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12,
    boundary: true }), (error) => error === primary)
  assert.deepEqual(control.calls.find(Array.isArray), ['native click', 1190, 280])
  assert.equal(control.observations[0].observation.clickKind, 'boundary')
  assert.equal(control.observations.at(-1).primary.message, primary.message)
})

const mechanisms = syntheticMechanismEvidence()
test('supplemental primary and independent cleanup failures remain structured and unclassifiable', async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-32c-secondary-control-'))
  const page = { viewportSize: () => ({ width: 800, height: 600 }),
    setViewportSize: async () => {}, context: () => ({ browser: () => ({ version: () => 'controlled-failure' }) }),
    evaluate: async () => { throw new Error('controlled native and cleanup failure') } }
  try {
    await assert.rejects(runPointDashCapMechanismChecks({ page, artifactDir, profile: phase32cProfile }), (error) => {
      assert.ok(error instanceof AggregateError)
      assert.match(error.message, /^Additional dash mechanism failures/)
      assert.match(error.cause.message, /controlled native/)
      return true
    })
    const evidence = JSON.parse(await readFile(join(artifactDir, `${dashCapMechanismStem}.json`), 'utf8'))
    assert.equal(evidence.result, 'failed')
    assert.ok(evidence.secondaryErrors.some(({ stage }) => stage === 'cleanup'))
    assert.throws(() => assertScopedMechanismEvidence(evidence))
  } finally { await rm(artifactDir, { recursive: true, force: true }) }
})
function scoped() {
  return { ...structuredClone(mechanisms), profile: phase32cProfile,
    cases: mechanisms.cases.map((entry) => entry.key === 'positive-full-closed-control' ? mechanismNotRun() : entry) }
}
function literalFailure() {
  const observed = structuredClone(mechanisms)
  observed.result = 'failed'
  const literal = observed.cases.find(({ key }) => key === 'positive-full-closed-control')
  const error = { message: 'positive-full-closed-control: connected-live candidate 0,-14\n\nfalse !== true\n' }
  literal.result = 'failed'; literal.error = error
  const mismatches = retainedLiteralOmissions.map(([x, y, geometryDistance]) => ({ local: { x, y }, expected: 'hit', hit: false,
    geometryDistance, paintDistance: 5.7732207757, insideContour: false }))
  literal.interactionOracle.mismatches = mismatches
  literal.interactionOracle.samples = [...mismatches, ...Array.from({ length: 1089 - mismatches.length }, () => ({ expected: 'hit', hit: true }))]
  return { evidence: { result: 'failed', stage: 'point-node-paint-import-persistence', pageErrors: [], error }, mechanisms: observed,
    app: { result: 'failed', error, cases: [{ result: 'passed' }] } }
}
function shapeEvidence(spec) {
  return { scenario: `point-geometric-${spec.slug}`, group: geometricShapeGroup, result: 'passed', pageErrors: [], shape: spec.shape,
    parameters: spec.parameters, nativeShapeControl: true, nativeStyle: { shape: spec.shape, shapeParameters: spec.parameters },
    nativeColorInputs: spec.shape === 'cylinder' ? [
      ['cylinderEndFill', 'Cylinder end fill hex'], ['cylinderBodyFill', 'Cylinder body fill hex'],
    ].map(([parameter, caption]) => ({ parameter, caption, expectedValue: spec.parameters[parameter],
      inputType: 'text', beforeValue: '#FFFFFF', finalInputType: 'text', finalValue: spec.parameters[parameter],
      finalModelValue: spec.parameters[parameter], events: [{ type: 'input', trusted: true, value: spec.parameters[parameter] }] })) : [],
    cases: ['default', 'configured'].flatMap((mode) => geometricBodyVariants.map(({ key, source }) => ({ mode, body: key, source, modelUnchanged: true,
      rendered: { shape: spec.shape, parameters: mode === 'configured' ? spec.parameters : {}, source, state: 'ready', contourLength: 20,
        bounds: { x: -10, y: -10, width: 20, height: 20 }, math: ['math', 'mixed'].includes(key) ? 1 : 0, bodyUpright: true,
        bodyCorners: source ? Array.from({ length: 4 }, () => ({ x: 0, y: 0, inside: true })) : [] } }))) }
}

test('32C profile is explicit, phase-specific, and never an alias for strict', () => {
  assert.equal(resolveVerificationProfile(undefined), 'strict')
  assert.equal(resolveVerificationProfile('strict', '32B'), 'strict')
  assert.equal(resolveVerificationProfile(phase32cProfile, '32C'), phase32cProfile)
  for (const phase of ['32A', '32B', '32D', undefined]) assert.throws(() => resolveVerificationProfile(phase32cProfile, phase))
  for (const profile of ['stz-32b-core-v1', 'allow-nonzero', '32c']) assert.throws(() => resolveVerificationProfile(profile, '32C'))
  assert.throws(() => runPhaseVerification({ phase: '32C', env: { STZ_VERIFICATION_PROFILE: phase32cProfile } }), /Strict verifier/)
  assert.throws(() => runPhase32CReviewVerification({ phase: '32B' }), /only to phase 32C/)
})
test('scoped mechanism report explicitly leaves only named literal not_run', () => {
  const evidence = scoped()
  assertScopedMechanismEvidence(evidence)
  assert.equal(evidence.cases.filter(({ result }) => result === 'not_run').length, 1)
  const strictArtifacts = pointNodeScenarioArtifacts('point-paint-dash-caps')
  const scopedArtifacts = pointNodeScenarioArtifacts('point-paint-dash-caps', phase32cProfile)
  assert.equal(strictArtifacts.length - scopedArtifacts.length, 8)
  assert.ok(strictArtifacts.filter((file) => !scopedArtifacts.includes(file)).every((file) => file.includes('positive-full-closed-control.')))
})
for (const fault of ['another-skip', 'wrong-specification', 'result-passed', 'missing-case', 'failed-nondeferred', 'wrong-profile']) {
  test(`32C mechanism evidence rejects ${fault}`, () => {
    const evidence = scoped()
    if (fault === 'another-skip') evidence.cases[0] = { ...mechanismNotRun(), key: evidence.cases[0].key }
    if (fault === 'wrong-specification') evidence.cases.at(-1).specification = { ...evidence.cases.at(-1).specification, width: 13 }
    if (fault === 'result-passed') evidence.cases.at(-1).result = 'passed'
    if (fault === 'missing-case') evidence.cases.pop()
    if (fault === 'failed-nondeferred') evidence.cases[0] = { ...evidence.cases[0], result: 'failed' }
    if (fault === 'wrong-profile') evidence.profile = 'strict'
    assert.throws(() => assertScopedMechanismEvidence(evidence))
  })
}
test('raw diagnostic classifier binds the exact retained literal case without changing failed records', () => {
  const input = literalFailure(), before = JSON.stringify(input)
  assertNamedStrict32BFailure(input.evidence, input.mechanisms, input.app)
  assert.equal(JSON.stringify(input), before)
})
for (const fault of ['same-stack-new-shape', 'changed-angle', 'shifted-omission', 'extra-omission', 'other-case', 'page-error', 'cleanup-error', 'not-run-app', 'wrong-stage']) {
  test(`named 32B classifier rejects unrelated failure disguised as ${fault}`, () => {
    const { evidence, mechanisms, app } = literalFailure(), literal = mechanisms.cases.at(-1)
    if (fault === 'same-stack-new-shape') literal.specification.points = '0,0 28,0 12,16'
    if (fault === 'changed-angle') literal.specification.join = 'miter'
    if (fault === 'shifted-omission') literal.interactionOracle.mismatches[1].local.x = 4
    if (fault === 'extra-omission') literal.interactionOracle.mismatches.push({ ...literal.interactionOracle.mismatches[0] })
    if (fault === 'other-case') mechanisms.cases[0].result = 'failed'
    if (fault === 'page-error') evidence.pageErrors.push('unexpected asynchronous rejection')
    if (fault === 'cleanup-error') mechanisms.secondaryErrors = ['context closed unexpectedly']
    if (fault === 'not-run-app') app.cases[0].result = 'not_run'
    if (fault === 'wrong-stage') evidence.stage = 'point-node-geometric-shapes'
    assert.throws(() => assertNamedStrict32BFailure(evidence, mechanisms, app))
  })
}
test('eleven-shape finite manifest has all terminal variants and no count-only acceptance', () => {
  assert.equal(geometricShapeManifest.length, 11)
  assert.equal(new Set(geometricShapeManifest.map(({ shape }) => shape)).size, 11)
  assert.deepEqual(allPointNodeScenarios[geometricShapeGroup], geometricShapeScenarios)
  for (const spec of geometricShapeManifest) assertGeometricShapeEvidence(shapeEvidence(spec), `point-geometric-${spec.slug}`)
})
for (const fault of ['missing-body', 'duplicate-body', 'missing-parameter', 'out-of-shape-body', 'unrotated-border-rotates-glyph', 'missing-native-control', 'page-error', 'wrong-shape', 'nonterminal']) {
  test(`32C shape manifest rejects ${fault}`, () => {
    const spec = geometricShapeManifest.find(({ shape }) => shape === 'star'), evidence = shapeEvidence(spec)
    if (fault === 'missing-body') evidence.cases.pop()
    if (fault === 'duplicate-body') evidence.cases[1] = structuredClone(evidence.cases[0])
    if (fault === 'missing-parameter') evidence.cases.at(-1).rendered.parameters = { starPoints: 7 }
    if (fault === 'out-of-shape-body') evidence.cases[1].rendered.bodyCorners[0].inside = false
    if (fault === 'unrotated-border-rotates-glyph') evidence.cases[2].rendered.bodyUpright = false
    if (fault === 'missing-native-control') evidence.nativeStyle = { shape: 'circle' }
    if (fault === 'page-error') evidence.pageErrors.push('unexpected')
    if (fault === 'wrong-shape') evidence.shape = 'circle'
    if (fault === 'nonterminal') evidence.result = 'started'
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
for (const fault of ['missing-color', 'duplicate-key', 'wrong-key', 'wrong-value', 'untrusted-input', 'no-input',
  'wrong-event-type', 'wrong-control-type', 'changed-control-type', 'already-configured', 'wrong-final-control', 'wrong-final-model', 'action-failed']) {
  test(`32C cylinder native color evidence rejects ${fault}`, () => {
    const spec = geometricShapeManifest.find(({ shape }) => shape === 'cylinder'), evidence = shapeEvidence(spec)
    const input = evidence.nativeColorInputs[0]
    if (fault === 'missing-color') evidence.nativeColorInputs.pop()
    if (fault === 'duplicate-key') evidence.nativeColorInputs[1] = structuredClone(input)
    if (fault === 'wrong-key') input.parameter = 'cylinderUsesCustomFill'
    if (fault === 'wrong-value') input.expectedValue = '#123456'
    if (fault === 'untrusted-input') input.events[0].trusted = false
    if (fault === 'no-input') input.events = []
    if (fault === 'wrong-event-type') input.events[0].type = 'change'
    if (fault === 'wrong-control-type') input.inputType = 'color'
    if (fault === 'changed-control-type') input.finalInputType = 'color'
    if (fault === 'already-configured') input.beforeValue = input.expectedValue
    if (fault === 'wrong-final-control') input.finalValue = '#123456'
    if (fault === 'wrong-final-model') input.finalModelValue = '#123456'
    if (fault === 'action-failed') input.actionError = { message: 'native input failed' }
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
test('32C cylinder model equality alone cannot replace final-valued trusted input', () => {
  const spec = geometricShapeManifest.find(({ shape }) => shape === 'cylinder'), evidence = shapeEvidence(spec)
  const input = evidence.nativeColorInputs[0]
  input.events = [{ type: 'input', trusted: true, value: '#FFFFFF' }]
  assert.equal(input.finalValue, input.expectedValue)
  assert.equal(input.finalModelValue, input.expectedValue)
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
test('32C cylinder evidence rejects a synthetic final event after a trusted intermediate edit', () => {
  const spec = geometricShapeManifest.find(({ shape }) => shape === 'cylinder'), evidence = shapeEvidence(spec)
  evidence.nativeColorInputs[0].events.push({ type: 'input', trusted: false, value: spec.parameters.cylinderEndFill })
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
test('32C cylinder evidence rejects an untrusted intermediate event before a trusted final edit', () => {
  const spec = geometricShapeManifest.find(({ shape }) => shape === 'cylinder'), evidence = shapeEvidence(spec)
  evidence.nativeColorInputs[0].events.unshift({ type: 'input', trusted: false, value: '#123456' })
  assert.equal(evidence.nativeColorInputs[0].events.at(-1).trusted, true)
  assert.equal(evidence.nativeColorInputs[0].events.at(-1).value, spec.parameters.cylinderEndFill)
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
test('32C non-cylinder scenarios cannot carry unrelated color input observations', () => {
  const spec = geometricShapeManifest.find(({ shape }) => shape === 'ellipse'), evidence = shapeEvidence(spec)
  evidence.nativeColorInputs = shapeEvidence(geometricShapeManifest.find(({ shape }) => shape === 'cylinder')).nativeColorInputs
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
test('review-only disposition rejects malformed, wrong-profile, failed, incomplete, or stale envelopes', () => {
  for (const response of [{}, { report: {} }, { report: { kind: 'phase32c-review-only', phase: '32B' }, disposition: { status: 'accepted' } },
    { report: { kind: 'phase32c-review-only', phase: '32C', profile: phase32cProfile }, disposition: { phase: '32C', status: 'accepted', profile: 'strict' } }]) {
    assert.equal(phase32CDispositionMatchesCheckout(response), false)
  }
})
