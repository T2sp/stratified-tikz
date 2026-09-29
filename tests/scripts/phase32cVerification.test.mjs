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
test('review-only disposition rejects malformed, wrong-profile, failed, incomplete, or stale envelopes', () => {
  for (const response of [{}, { report: {} }, { report: { kind: 'phase32c-review-only', phase: '32B' }, disposition: { status: 'accepted' } },
    { report: { kind: 'phase32c-review-only', phase: '32C', profile: phase32cProfile }, disposition: { phase: '32C', status: 'accepted', profile: 'strict' } }]) {
    assert.equal(phase32CDispositionMatchesCheckout(response), false)
  }
})
