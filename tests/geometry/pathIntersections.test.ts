import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_INTERSECTION_ARC_SAMPLES,
  DEFAULT_INTERSECTION_CUBIC_SAMPLES,
  DEFAULT_INTERSECTION_TEMPLATE_SAMPLES,
  MAX_INTERSECTION_ARC_SAMPLES,
  MAX_INTERSECTION_CUBIC_SAMPLES,
  MAX_INTERSECTION_TEMPLATE_SAMPLES,
  flattenCurveFor2DIntersections,
  normalizePathIntersectionOptions,
  pathIntersectionCandidatesForDiagram,
} from '../../src/geometry/pathIntersections.ts'
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

test('path intersection option normalization preserves defaults and caps samples', () => {
  const defaults = normalizePathIntersectionOptions()

  assert.equal(defaults.cubicSamples, DEFAULT_INTERSECTION_CUBIC_SAMPLES)
  assert.equal(defaults.arcSamples, DEFAULT_INTERSECTION_ARC_SAMPLES)
  assert.equal(defaults.templateSamples, DEFAULT_INTERSECTION_TEMPLATE_SAMPLES)

  const excessive = normalizePathIntersectionOptions({
    cubicSamples: 1_000_000,
    arcSamples: 1_000_000,
    templateSamples: 1_000_000,
  })

  assert.equal(excessive.cubicSamples, MAX_INTERSECTION_CUBIC_SAMPLES)
  assert.equal(excessive.arcSamples, MAX_INTERSECTION_ARC_SAMPLES)
  assert.equal(excessive.templateSamples, MAX_INTERSECTION_TEMPLATE_SAMPLES)
})

test('path intersection option normalization handles invalid and fractional samples', () => {
  const invalid = normalizePathIntersectionOptions({
    cubicSamples: Number.POSITIVE_INFINITY,
    arcSamples: Number.NaN,
    templateSamples: -1,
  })

  assert.equal(invalid.cubicSamples, DEFAULT_INTERSECTION_CUBIC_SAMPLES)
  assert.equal(invalid.arcSamples, DEFAULT_INTERSECTION_ARC_SAMPLES)
  assert.equal(invalid.templateSamples, DEFAULT_INTERSECTION_TEMPLATE_SAMPLES)

  const fractional = normalizePathIntersectionOptions({
    cubicSamples: 7.9,
    arcSamples: 0.5,
    templateSamples: 12.75,
  })

  assert.equal(fractional.cubicSamples, 7)
  assert.equal(fractional.arcSamples, 1)
  assert.equal(fractional.templateSamples, 12)
  assert.equal(Number.isInteger(fractional.cubicSamples), true)
  assert.equal(Number.isInteger(fractional.arcSamples), true)
  assert.equal(Number.isInteger(fractional.templateSamples), true)
})

test('excessive cubic sampling flattens to the documented cap', () => {
  const flattened = flattenCurveFor2DIntersections(cubicCurve(), 2, {
    cubicSamples: 1_000_000,
  })

  assert.notEqual(flattened, null)
  assert.equal(
    flattened?.segments.length,
    MAX_INTERSECTION_CUBIC_SAMPLES,
  )
})

test('excessive arc sampling flattens to the documented cap', () => {
  const flattened = flattenCurveFor2DIntersections(arcCurve(), 2, {
    arcSamples: 1_000_000,
  })

  assert.notEqual(flattened, null)
  assert.equal(flattened?.segments.length, MAX_INTERSECTION_ARC_SAMPLES)
})

test('excessive template sampling flattens to the documented cap', () => {
  const flattened = flattenCurveFor2DIntersections(circleTemplateCurve(), 2, {
    templateSamples: 1_000_000,
  })

  assert.notEqual(flattened, null)
  assert.equal(
    flattened?.segments.length,
    MAX_INTERSECTION_TEMPLATE_SAMPLES,
  )
})

test('excessive sampling options preserve simple line-line detection', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    lineCurve('line-a', point(-1, 0), point(1, 0)),
    lineCurve('line-b', point(0, -1), point(0, 1)),
  ])
  const defaults = pathIntersectionCandidatesForDiagram(diagram)
  const excessive = pathIntersectionCandidatesForDiagram(diagram, {
    cubicSamples: 1_000_000,
    arcSamples: 1_000_000,
    templateSamples: 1_000_000,
  })

  assert.deepEqual(excessive, defaults)
})

test('detector caps excessive cubic sampling and returns finite candidates', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    cubicCurve(),
    lineCurve('line', point(-0.5, 0), point(1.5, 0)),
  ])
  const candidates = pathIntersectionCandidatesForDiagram(diagram, {
    cubicSamples: 1_000_000,
  })

  assert.equal(candidates.length, 1)
  assert.equal(candidates.every(isFiniteCandidate), true)
  assertNearlyEqual(candidates[0]?.point.x ?? Number.NaN, 0.5, 1e-3)
})

test('detector caps excessive arc sampling and returns finite candidates', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    arcCurve(),
    lineCurve('line', point(0, 0.25), point(0, 1.5)),
  ])
  const candidates = pathIntersectionCandidatesForDiagram(diagram, {
    arcSamples: 1_000_000,
  })

  assert.equal(candidates.length, 1)
  assert.equal(candidates.every(isFiniteCandidate), true)
  assertNearlyEqual(candidates[0]?.point.y ?? Number.NaN, 1, 1e-3)
})

test('detector caps excessive template sampling and returns finite candidates', () => {
  const diagram = twoDimensionalDiagramWithCurves([
    circleTemplateCurve(),
    lineCurve('line', point(-1.5, 0), point(1.5, 0)),
  ])
  const candidates = pathIntersectionCandidatesForDiagram(diagram, {
    templateSamples: 1_000_000,
  })

  assert.equal(candidates.length, 2)
  assert.equal(candidates.every(isFiniteCandidate), true)
  assert.deepEqual(
    candidates.map((candidate) => Number(candidate.point.x.toFixed(3))).sort(),
    [-1, 1],
  )
})

function twoDimensionalDiagramWithCurves(curves: CurveStratum[]): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(...curves)

  return diagram
}

function cubicCurve(): CurveStratum {
  return createCurveStratum({
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
  })
}

function arcCurve(): CurveStratum {
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

  return createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'arc',
    name: 'Arc',
    segments: [arc],
  })
}

function circleTemplateCurve(): CurveStratum {
  return createTemplatePathStratum({
    ambientDimension: 2,
    id: 'circle',
    name: 'Circle',
    template: {
      kind: 'circleTemplate',
      center: point(0, 0),
      radius: 1,
    },
  })
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
