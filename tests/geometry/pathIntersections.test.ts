import assert from 'node:assert/strict'
import test from 'node:test'
import { pathIntersectionCandidatesForDiagram } from '../../src/geometry/pathIntersections.ts'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createTemplatePathStratum,
} from '../../src/model/constructors.ts'
import { createArcPathSegmentFromAngles } from '../../src/model/paths.ts'
import type {
  CurveStratum,
  Diagram,
  PathIntersectionCandidate,
  Vec3,
} from '../../src/model/types.ts'

test('two straight 2D lines crossing produce one candidate', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    lineCurve('line-a', point(-1, 0), point(1, 0)),
    lineCurve('line-b', point(0, -1), point(0, 1)),
  ])
  const candidates = pathIntersectionCandidatesForDiagram(diagram)

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0]?.pathAId, 'line-a')
  assert.equal(candidates[0]?.pathBId, 'line-b')
  assert.equal(candidates[0]?.crossingSign, 'positive')
  assertNearlyEqual(candidates[0]?.point.x ?? Number.NaN, 0)
  assertNearlyEqual(candidates[0]?.point.y ?? Number.NaN, 0)
  assertNearlyEqual(candidates[0]?.point.z ?? Number.NaN, 0)
  assertNearlyEqual(candidates[0]?.parameterA ?? Number.NaN, 0.5)
  assertNearlyEqual(candidates[0]?.parameterB ?? Number.NaN, 0.5)
})

test('parallel 2D lines produce no candidates', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    lineCurve('line-a', point(0, 0), point(1, 0)),
    lineCurve('line-b', point(0, 1), point(1, 1)),
  ])

  assert.equal(pathIntersectionCandidatesForDiagram(diagram).length, 0)
})

test('shared endpoints are ignored', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    lineCurve('line-a', point(0, 0), point(1, 0)),
    lineCurve('line-b', point(1, 0), point(1, 1)),
  ])

  assert.equal(pathIntersectionCandidatesForDiagram(diagram).length, 0)
})

test('sampled cubic and line crossing is detected', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    createCurveStratum({
      ambientDimension: 2,
      id: 'cubic',
      kind: 'cubicBezier',
      name: 'Cubic',
      points: [
        point(0, -1),
        point(0.5, -1),
        point(0.5, 1),
        point(1, 1),
      ],
    }),
    lineCurve('line', point(-0.5, 0), point(1.5, 0)),
  ])
  const candidates = pathIntersectionCandidatesForDiagram(diagram, {
    cubicSamples: 64,
  })

  assert.equal(candidates.length, 1)
  assertNearlyEqual(candidates[0]?.point.x ?? Number.NaN, 0.5, 1e-3)
  assertNearlyEqual(candidates[0]?.point.y ?? Number.NaN, 0, 1e-3)
})

test('sampled arc and line crossing is detected', () => {
  const arc = createArcPathSegmentFromAngles({
    center: point(0, 0),
    radius: 1,
    startAngleDeg: 0,
    endAngleDeg: 180,
    direction: 'counterclockwise',
    ambientDimension: 2,
  })

  if (arc === null) {
    throw new Error('Expected a valid arc segment.')
  }

  const diagram = twoDimensionalDiagramWithCurves([
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'arc',
      name: 'Arc',
      segments: [arc],
    }),
    lineCurve('line', point(0, 0.25), point(0, 1.5)),
  ])
  const candidates = pathIntersectionCandidatesForDiagram(diagram, {
    arcSamples: 64,
  })

  assert.equal(candidates.length, 1)
  assertNearlyEqual(candidates[0]?.point.x ?? Number.NaN, 0, 1e-3)
  assertNearlyEqual(candidates[0]?.point.y ?? Number.NaN, 1, 1e-3)
})

test('circle template and line crossing produces two candidates', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    createTemplatePathStratum({
      ambientDimension: 2,
      id: 'circle',
      name: 'Circle',
      template: {
        kind: 'circleTemplate',
        center: point(0, 0),
        radius: 1,
      },
    }),
    lineCurve('line', point(-1.5, 0), point(1.5, 0)),
  ])
  const candidates = pathIntersectionCandidatesForDiagram(diagram, {
    templateSamples: 96,
  })

  assert.equal(candidates.length, 2)
  assert.deepEqual(
    candidates.map((candidate) => Number(candidate.point.x.toFixed(3))).sort(),
    [-1, 1],
  )
  assert.equal(candidates.every(isFiniteCandidate), true)
})

test('collinear overlap is skipped', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    lineCurve('line-a', point(0, 0), point(2, 0)),
    lineCurve('line-b', point(1, 0), point(3, 0)),
  ])

  assert.equal(pathIntersectionCandidatesForDiagram(diagram).length, 0)
})

test('3D diagrams produce no path intersection candidates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 3,
      id: 'line-a',
      name: 'Line A',
      points: [point(-1, 0, 0), point(1, 0, 0)],
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'line-b',
      name: 'Line B',
      points: [point(0, -1, 0), point(0, 1, 0)],
    }),
  )

  assert.equal(pathIntersectionCandidatesForDiagram(diagram).length, 0)
})

test('candidate IDs are deterministic for a simple crossing', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    lineCurve('line-a', point(-1, 0), point(1, 0)),
    lineCurve('line-b', point(0, -1), point(0, 1)),
  ])
  const first = pathIntersectionCandidatesForDiagram(diagram)
  const second = pathIntersectionCandidatesForDiagram(diagram)

  assert.equal(first.length, 1)
  assert.equal(first[0]?.id, 'crossing:line-a:line-b:0p500000:0p500000')
  assert.equal(first[0]?.id, second[0]?.id)
})

test('non-finite path data does not produce non-finite candidates', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    lineCurve('line-a', point(-1, 0), point(1, 0)),
    lineCurve('line-b', point(0, -1), point(0, 1)),
    lineCurve('bad-line', point(Number.POSITIVE_INFINITY, 0), point(0, 0)),
  ])
  const candidates = pathIntersectionCandidatesForDiagram(diagram)

  assert.equal(candidates.length, 1)
  assert.equal(candidates.every(isFiniteCandidate), true)
})

function twoDimensionalDiagramWithCurves(curves: CurveStratum[]): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(...curves)

  return diagram
}

function lineCurve(id: string, start: Vec3, end: Vec3): CurveStratum {
  return createCurveStratum({
    ambientDimension: 2,
    id,
    name: id,
    points: [start, end],
  })
}

function point(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

function isFiniteCandidate(candidate: PathIntersectionCandidate): boolean {
  return (
    Number.isFinite(candidate.point.x) &&
    Number.isFinite(candidate.point.y) &&
    Number.isFinite(candidate.point.z) &&
    Number.isFinite(candidate.parameterA) &&
    Number.isFinite(candidate.parameterB) &&
    Number.isFinite(candidate.tangentA.x) &&
    Number.isFinite(candidate.tangentA.y) &&
    Number.isFinite(candidate.tangentB.x) &&
    Number.isFinite(candidate.tangentB.y)
  )
}

function assertNearlyEqual(
  actual: number,
  expected: number,
  epsilon = 1e-9,
): void {
  assert.equal(Number.isFinite(actual), true)
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}.`,
  )
}
