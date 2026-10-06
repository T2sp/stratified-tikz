import assert from 'node:assert/strict'
import { dashCapMechanismCases, assertDashCapMechanismEntry } from '../pointDashCapMechanismContract.mjs'

export const phase32cProfile = '32c-geometric-shapes-deferred-32b-v1'
export const deferredMechanismKey = 'positive-full-closed-control'
export const deferredMechanism = dashCapMechanismCases.find(({ key }) => key === deferredMechanismKey)
export const phase32cDeferrals = Object.freeze([
  '32b-literal-positive-full-closed-control',
  '32b-retained-supported-shape-transfer-45-omissions',
  '32b-separate-transfer-context-reopening',
  '32b-full-strict-acceptance',
])
// Coordinates and production distances copied read-only from the retained
// WlO99Z literal case. This is a bounded authorization inventory, not a new oracle.
export const retainedLiteralOmissions = [[0,-14,8],[2,-14,8],[-2,-12,6.324555320336759],[-10,-10,10.73312629199899],[-8,-10,8.94427190999916],[-6,-10,7.211102550927979],[-10,-8,9.838699100999074],[-8,-8,8.049844718999244],[-6,-8,6.260990336999411],[-10,-6,8.94427190999916],[-8,-6,7.155417527999327],[-12,-4,9.838699100999074],[-10,-4,8.049844718999243],[-8,-4,6.260990336999411],[-14,-2,10.73312629199899],[-12,-2,8.944271909999157],[-10,-2,7.155417527999326],[-14,0,9.879271228182773],[-12,0,8.049844718999243],[-10,0,6.26099033699941],[-12,2,7.37563556583431],[-10,8,6.799999999999999],[-10,10,7.999999999999999],[-8,10,6.399999999999999]]
export const phase32cAuthorization = 'prompts/phase-32c-fix.md: user-authorized 32C implementation and review with the named 32B issues deferred'

export function resolveVerificationProfile(profile, phase) {
  if (profile === undefined || profile === '' || profile === 'strict') return 'strict'
  assert.equal(profile, phase32cProfile, 'Unknown verification profile')
  assert.equal(phase, '32C', 'The deferred 32B disposition is available only to phase 32C')
  return profile
}
export function mechanismNotRun() {
  return { key: deferredMechanismKey, specification: deferredMechanism, result: 'not_run',
    authorization: phase32cAuthorization, diagnostic: 'Required separate strict cumulative run retains the raw result for this exact literal case.' }
}
export function assertScopedMechanismEvidence(evidence) {
  assert.equal(evidence.result, 'passed')
  assert.equal(evidence.profile, phase32cProfile)
  assert.equal(evidence.scope, 'supplemental native SVG geometry; App pointer matrix remains separately required')
  assert.equal(evidence.cases.length, dashCapMechanismCases.length)
  for (const spec of dashCapMechanismCases) {
    const found = evidence.cases.filter(({ key }) => key === spec.key)
    assert.equal(found.length, 1)
    if (spec.key === deferredMechanismKey) assert.deepEqual(found[0], mechanismNotRun())
    else assertDashCapMechanismEntry(found[0], spec)
  }
}
// This classifies only the already retained literal failure; a matching stack or
// shared helper is insufficient. All other mechanisms must still pass strictly.
export function assertNamedStrict32BFailure(evidence, mechanisms, appDash) {
  assert.equal(evidence.result, 'failed')
  assert.equal(evidence.stage, 'point-node-paint-import-persistence')
  assert.deepEqual(evidence.pageErrors, [])
  assert.match(evidence.error?.message ?? '', /^positive-full-closed-control: connected-live candidate 0,-14\b/u)
  assert.equal(mechanisms.result, 'failed')
  assert.deepEqual(mechanisms.secondaryErrors ?? [], [])
  assert.ok(!(evidence.diagnostics ?? []).some((entry) => entry.error), 'Secondary failures remain blockers')
  assert.equal(mechanisms.cases.length, dashCapMechanismCases.length)
  for (const spec of dashCapMechanismCases) {
    const found = mechanisms.cases.filter(({ key }) => key === spec.key)
    assert.equal(found.length, 1)
    const entry = found[0]
    if (spec.key !== deferredMechanismKey) { assertDashCapMechanismEntry(entry, spec); continue }
    assert.equal(entry.result, 'failed')
    assert.deepEqual(entry.specification, deferredMechanism)
    assert.match(entry.error?.message ?? '', /^positive-full-closed-control: connected-live candidate 0,-14\b/u)
    const mismatches = entry.interactionOracle?.mismatches
    assert.equal(mismatches?.length, 24, 'Only the retained 24 literal omissions are deferred')
    assert.ok(mismatches.every(({ expected, hit }) => expected === 'hit' && hit === false))
    assert.deepEqual(mismatches.map(({ local, geometryDistance }) => [local.x, local.y, geometryDistance]), retainedLiteralOmissions, 'New or shifted omissions are not the retained baseline case')
    assert.equal(entry.samples.length, 1089); assert.equal(entry.interactionOracle.samples.length, 1089)
    assert.deepEqual(entry.interactionOracle.samples.filter(({ expected, hit }) => expected !== 'uncertain' && hit !== (expected === 'hit')), mismatches)
    assert.deepEqual(entry.secondaryErrors ?? [], [])
    const witness = mismatches.find(({ local }) => local.x === 0 && local.y === -14)
    assert.ok(witness && Math.abs(witness.paintDistance - 5.7732207757) < .00001)
    assert.equal(witness.geometryDistance, 8)
    assert.equal(witness.insideContour, false)
  }
  assert.equal(appDash.result, 'failed')
  assert.match(appDash.error?.message ?? '', /^positive-full-closed-control: connected-live candidate 0,-14\b/u)
  assert.ok(appDash.cases.length > 0 && appDash.cases.every(({ result }) => result === 'passed'))
}
