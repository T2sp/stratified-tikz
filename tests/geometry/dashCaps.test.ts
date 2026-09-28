import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import { createPolygonStrokeRegion, distanceToPolygonStroke } from '../../src/geometry/polygonStroke.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { pendingSvgPointNodeLayout } from '../../src/rendering/svgPointNodeLayout.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { createDashCaps, distanceToDashCaps } from '../../src/geometry/dashCaps.ts'

const contour = { kind: 'polygon' as const, radius: 0,
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10,
  `${actual} differs from ${expected}`)

function endpoints(pattern: readonly number[], phase: number) {
  return createDashCaps(contour, 36, pattern, phase, 'square').families.map((family) => {
    assert.equal(family.kind, 'line')
    if (family.kind !== 'line') throw new Error('Polygon requires line cap families')
    close(family.first, family.last)
    return { x: family.origin.x + family.first * family.tangent.x,
      y: family.origin.y + family.first * family.tangent.y, sign: family.sign, tangent: family.tangent }
  })
}

for (const pattern of [[5, 10, 1e20, 1e19], [5, 10, 1e308, 1e308]]) {
  test(`huge period ${pattern[2]} preserves small endpoints, bounds and cap distances`, () => {
    // Along this 40-unit closed square, only on [0,5] and on [15,40] occur.
    // They join through the closepath seam; the only caps are at lengths 5/15.
    const caps = createDashCaps(contour, 36, pattern, 0, 'square')
    const actual = endpoints(pattern, 0)
    assert.equal(actual.length, 2)
    close(actual[0].x, 5); close(actual[0].y, 0); assert.equal(actual[0].sign, 1)
    close(actual[1].x, 10); close(actual[1].y, 5); assert.equal(actual[1].sign, -1)
    assert.deepEqual(caps.bounds, { minX: -8, minY: -18, maxX: 28, maxY: 18 })
    close(caps.radius, Math.hypot(28, 13))
    close(distanceToDashCaps({ x: 23, y: 18 }, caps), 0)
    close(distanceToDashCaps({ x: 23, y: 25 }, caps), 7)
    close(distanceToDashCaps({ x: 40, y: 0 }, caps), 12)
    assert.ok(caps.families.every((family) => Number.isFinite(family.first) && Number.isFinite(family.last)))
    if (!Number.isFinite(pattern.reduce((sum, part) => sum + part, 0))) {
      assert.ok(caps.families.every((family) => family.step === Infinity))
    }
  })

  test(`huge period ${pattern[2]} preserves positive and negative small phase at corners and seam`, () => {
    const shifted = endpoints(pattern, .125)
    assert.equal(shifted.length, 2)
    close(shifted[0].x, 4.875); close(shifted[0].y, 0)
    close(shifted[1].x, 10); close(shifted[1].y, 4.875)
    // Negative phase introduces a five-unit initial gap: caps at 5,10,20,40.
    // Exact positive endpoints both use the incoming tangent, as independently
    // observed by the ordinary-size corner fixtures below.
    const negative = endpoints(pattern, -5)
    assert.equal(negative.length, 4)
    const expected = [
      { x: 5, y: 0, sign: -1, tangent: { x: 1, y: 0 } },
      { x: 10, y: 0, sign: 1, tangent: { x: 1, y: 0 } },
      { x: 10, y: 10, sign: -1, tangent: { x: 0, y: 1 } },
      { x: 0, y: 0, sign: 1, tangent: { x: 0, y: -1 } },
    ]
    negative.forEach((actual, index) => {
      close(actual.x, expected[index].x); close(actual.y, expected[index].y)
      assert.equal(actual.sign, expected[index].sign)
      assert.deepEqual(actual.tangent, expected[index].tangent)
    })
  })
}

test('subnormal positive periods keep bounded families and finite cap geometry through huge phases', () => {
  for (const small of [Number.MIN_VALUE, 1e-320, 1e-300, 1e-16]) {
    for (const pattern of [[small, small], [0, small], [small, 0, 0, small]]) {
      for (const phase of [0, small, 1e308, -1e308]) {
        const caps = createDashCaps(contour, 1000, pattern, phase, 'square')
        assert.ok(caps.families.length > 0 && caps.families.length <= pattern.length * contour.vertices.length + 4)
        assert.ok(caps.bounds && Object.values(caps.bounds).every(Number.isFinite))
        assert.ok(Number.isFinite(caps.radius))
        assert.ok(caps.families.every((family) => Number.isFinite(family.first) && Number.isFinite(family.last)))
        assert.ok(Number.isFinite(distanceToDashCaps({ x: 1000, y: 1000 }, caps)))
        assert.ok(distanceToDashCaps({ x: 1000, y: 1000 }, caps) > 6)
      }
    }
  }
})

test('extreme scheduling retains caps for tiny positive on and gap entries', () => {
  for (const pattern of [[Number.MIN_VALUE, 10, 1e308, 1e308], [5, Number.MIN_VALUE, 1e308, 1e308]]) {
    const caps = createDashCaps(contour, 36, pattern, 0, 'square')
    assert.ok(caps.families.length >= 2)
    assert.ok(caps.bounds && Object.values(caps.bounds).every(Number.isFinite))
    assert.ok(Number.isFinite(distanceToDashCaps({ x: -25, y: -25 }, caps)))
  }
  assert.equal(createDashCaps(contour, 36, [Number.MIN_VALUE, 0], 0, 'square').families.length, 0,
    'all-zero off entries retain the continuous-stroke policy')
})


test('exact extreme scheduling retains small prefix after huge phase cancellation', () => {
  for (const [large, off] of [[1e20, 1e19], [1e308, 1e308]]) {
    // The long on interval begins at 15 and ends at large + 15. At phase=large
    // there are exactly 15 local units left, even when a Number sum loses 15.
    const actual = endpoints([5, 10, large, off], large)
    assert.equal(actual.length, 2)
    close(actual[0].x, 10); close(actual[0].y, 5); assert.equal(actual[0].sign, 1)
    close(actual[1].x, 0); close(actual[1].y, 0); assert.equal(actual[1].sign, -1)
    assert.equal(createDashCaps(contour, 36, [5, 10, large, off], -off, 'square').families.length, 0,
      'phase at the true long-on end starts the long gap')
  }
  // The rounded total 1.1e20 is 15 units before the exact pattern period.
  const wrapped = endpoints([5, 10, 1e20, 1e19], 1.1e20)
  const expected = [{ x: 10, y: 5, sign: -1 }, { x: 10, y: 10, sign: 1 },
    { x: 0, y: 10, sign: -1 }, { x: 0, y: 0, sign: 1 }]
  assert.equal(wrapped.length, expected.length)
  wrapped.forEach((value, index) => {
    close(value.x, expected[index].x); close(value.y, expected[index].y)
    assert.equal(value.sign, expected[index].sign)
  })
})

test('exact corner ownership preserves a subnormal positive gap beside huge intervals', () => {
  const caps = createDashCaps(contour, 36, [10, Number.MIN_VALUE, 1e308, 1e308], 0, 'square')
  assert.equal(caps.families.length, 2)
  const [incoming, outgoing] = caps.families
  assert.equal(incoming.kind, 'line'); assert.equal(outgoing.kind, 'line')
  if (incoming.kind !== 'line' || outgoing.kind !== 'line') throw new Error('Expected line caps')
  assert.deepEqual(incoming.tangent, { x: 1, y: 0 })
  assert.deepEqual(outgoing.tangent, { x: 0, y: 1 })
  assert.equal(incoming.first, 10)
  assert.equal(outgoing.first, Number.MIN_VALUE)
  assert.equal(incoming.sign, 1); assert.equal(outgoing.sign, -1)
})


for (const cap of ['square', 'round'] as const) {
  test(`zero-on ${cap} full corner dots preserve nearby exterior negatives and six-unit allowance`, () => {
    const caps = createDashCaps(contour, 36, [0, 10], 0, cap)
    const solid = createPolygonStrokeRegion(contour.vertices, 36, 'bevel')
    const point = { x: 25, y: 35 }
    const interactionDistance = Math.min(distanceToDashCaps(point, caps), distanceToPolygonStroke(point, solid))
    // Four width-36 full dots have centers at the four literal vertices.
    // (25,25), called exterior by Cairo's split corner caps, is within the
    // full-dot region/allowance; (25,35) is seven units beyond square paint.
    assert.ok(interactionDistance > 6)
    close(distanceToDashCaps(point, caps), cap === 'square' ? 7 : Math.hypot(15, 25) - 18)
    assert.ok(distanceToDashCaps({ x: 25, y: 25 }, caps) < 6)
    assert.equal(distanceToDashCaps({ x: 5, y: 5 }, caps), 0,
      'inside cap paint remains available; exterior rejection does not disable dots')
  })
}

test('positive-on dash endpoints just after corners preserve ordinary cap directions', () => {
  const caps = createDashCaps(contour, 36, [10, 10], -.25, 'square')
  // Independent phase -.25 raster paints this probe. The on interval starts
  // just after (10,10), on the third (-x) edge, with its start cap pointing right.
  close(distanceToDashCaps({ x: 25, y: 25 }, caps), 0)
})

test('actual square point includes full zero-on corner paint and rejects nearby exterior App candidates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.camera = { mode: '2d', scale: 1, origin: { x: 240, y: 180 } }
  const point = createPointStratum({ ambientDimension: 2, id: 'zero-corner-square', text: '', position: { x: 0, y: 0, z: 0 } })
  point.style.shape = 'square'
  point.style.size = 5.892556509887896
  const paint = getPointPaint(point.style)
  paint.fill.enabled = false
  Object.assign(paint.stroke, { enabled: true, width: 30, lineStyle: 'solid', dashPattern: [0, 10 / 1.2],
    dashPhase: 0, lineCap: 'rect', lineJoin: 'bevel' })
  diagram.strata = [point]
  const layout = pendingSvgPointNodeLayout(point)
  assert.equal(layout.stroke, 36)
  const reference = cornerRaster.observations.find((observation) => observation.id === 'production-zero-exact-corner')!
  assert.equal(layout.geometry.vertices.length, reference.vertices.length)
  layout.geometry.vertices.forEach((vertex, index) => {
    close(vertex.x, reference.vertices[index].x); close(vertex.y, reference.vertices[index].y)
  })
  const center = projectToSvgPoint(diagram.camera, point.position, 360)
  const picked = (local: { x: number; y: number }) => collectSvgPreviewSelectionCandidates({ diagram,
    camera: diagram.camera, viewportHeight: 360, point: { x: center.x + local.x, y: center.y + local.y },
    showCoordinateAnchors: false }).some((candidate) => candidate.id === point.id)
  assert.equal(picked({ x: 0, y: 0 }), true, 'hollow original contour interior remains selectable')
  assert.equal(picked({ x: 20, y: 20 }), true, 'retained Chrome paint disproves the former Cairo exterior classification')
  assert.equal(picked({ x: 25, y: 25 }), true, 'within six units of the full square corner')
  assert.equal(picked({ x: -22, y: -30 }), false, 'seven units beyond full square paint')
  for (const probe of reference.probes.filter((probe) => probe.painted)) assert.equal(picked(probe.point), true)
})


type CornerObservation = {
  id: string; coordinateSpace: 'cartesian' | 'production-local'; vertices: { x: number; y: number }[]
  width: number; lineJoin: 'bevel'; lineCap: 'square' | 'round'; dashPattern: number[]; dashPhase: number
  svgFile: string; pngFile: string; svgSha256: string; pngSha256: string
  rasterBounds: { minX: number; minY: number; maxX: number; maxY: number }; rasterRadius: number
  probes: { point: { x: number; y: number }; alpha: number; painted: boolean; nearestPaintCenterDistance: number }[]
}
const cornerDirectory = new URL('../fixtures/dash-cap-svg/', import.meta.url)
const cornerRaster = JSON.parse(readFileSync(new URL('corner-observations.json', cornerDirectory), 'utf8')) as {
  provenance: string; scale: number; boundsUncertainty: number; distanceUncertainty: number
  observations: CornerObservation[]
}

// Literal zero-dot centers for these finite square fixtures. This independent
// analytic delta retains every Cairo observation, while avoiding treating
// Cairo's split incoming/outgoing caps as a Chrome oracle. Native acceptance
// of the other zero patterns remains required by the browser mechanism matrix.
function fullDotDistance(point: { x: number; y: number }, centers: readonly { x: number; y: number }[],
  width: number, cap: 'square' | 'round'): number {
  const half = width / 2
  return Math.min(...centers.map((center) => cap === 'square'
    ? Math.hypot(Math.max(0, Math.abs(point.x - center.x) - half), Math.max(0, Math.abs(point.y - center.y) - half))
    : Math.max(0, Math.hypot(point.x - center.x, point.y - center.y) - half)))
}

function assertCairoExteriorWithDotDelta(point: { x: number; y: number }, actual: number,
  centers: readonly { x: number; y: number }[], observation: Pick<CornerObservation, 'width' | 'lineCap'>) {
  const delta = fullDotDistance(point, centers, observation.width, observation.lineCap)
  assert.equal(actual <= 6, delta <= 6,
    `${JSON.stringify(point)}: retained Cairo exterior; full-dot analytic distance ${delta}`)
}

test('independent corner fixture inventory retains both cap types, thin/wide paint, actual point and positive-on controls', () => {
  assert.match(cornerRaster.provenance, /Independent librsvg/)
  assert.equal(cornerRaster.scale, 16)
  assert.equal(cornerRaster.boundsUncertainty, 1 / 16)
  assert.equal(cornerRaster.distanceUncertainty, 2 / 16)
  assert.deepEqual(cornerRaster.observations.map(({ id }) => id).sort(), [
    'cartesian-zero-corner-6-square', 'cartesian-zero-corner-6-round',
    'cartesian-zero-corner-36-square', 'cartesian-zero-corner-36-round',
    'production-zero-exact-corner',
    ...[6, 36].flatMap((width) => ['square', 'round'].flatMap((cap) =>
      ['corner', 'before-corner', 'after-corner'].map((placement) => `cartesian-positive-${placement}-${width}-${cap}`))),
  ].sort())
})

for (const observation of cornerRaster.observations) {
  test(`${observation.id}: authenticated Cairo controls and explicit full-dot geometry delta`, () => {
    for (const [file, hash] of [[observation.svgFile, observation.svgSha256], [observation.pngFile, observation.pngSha256]]) {
      assert.equal(createHash('sha256').update(readFileSync(new URL(file, cornerDirectory))).digest('hex'), hash)
    }
    const solid = createPolygonStrokeRegion(observation.vertices, observation.width, observation.lineJoin)
    const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices: observation.vertices }, observation.width,
      observation.dashPattern, observation.dashPhase, observation.lineCap)
    const distance = (point: { x: number; y: number }) => Math.min(distanceToPolygonStroke(point, solid), distanceToDashCaps(point, caps))
    const positives = observation.probes.filter(({ painted, alpha }) => painted && alpha >= 128)
    assert.ok(positives.length > 0)
    for (const probe of positives) assert.ok(distance(probe.point) <= cornerRaster.distanceUncertainty,
      `${JSON.stringify(probe.point)} is independently painted`)
    const xs = observation.vertices.map(({ x }) => x), ys = observation.vertices.map(({ y }) => y)
    const contourBox = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    const negatives = observation.probes.filter((probe) => {
      if (probe.painted || probe.nearestPaintCenterDistance <= 6 + cornerRaster.distanceUncertainty) return false
      const { x, y } = probe.point
      // These selected corner probes are retained independent failure controls.
      if (x === 25 && y === 25) return true
      if (observation.coordinateSpace === 'production-local' && x === 20 && y === 20) return true
      // Else require a conservative independent bound beyond the entire
      // continuous half-width neighborhood, so a dash gap is never a miss oracle.
      return Math.hypot(Math.max(0, contourBox.minX - x, x - contourBox.maxX),
        Math.max(0, contourBox.minY - y, y - contourBox.maxY)) > observation.width / 2 + 6 + cornerRaster.distanceUncertainty
    })
    assert.ok(negatives.length > 0)
    const dotCenters = observation.dashPattern[0] === 0 ? observation.vertices : []
    for (const probe of negatives) assertCairoExteriorWithDotDelta(probe.point, distance(probe.point), dotCenters, observation)
    assert.ok(negatives.some((probe) => fullDotDistance(probe.point, dotCenters, observation.width, observation.lineCap) > 6),
      'Retain genuine exterior controls beyond the new full dots')
    const target = observation.probes.find(({ point }) => point.x === 25 && point.y === 25)!
    if (target.painted) close(distance(target.point), 0)
    else if (target.nearestPaintCenterDistance > 6 + cornerRaster.distanceUncertainty) {
      assert.equal(target.alpha, 0)
      assertCairoExteriorWithDotDelta(target.point, distance(target.point), dotCenters, observation)
    } else if (target.nearestPaintCenterDistance < 6 - cornerRaster.distanceUncertainty) {
      assert.ok(distance(target.point) <= 6, 'actual paint within six units remains selectable')
    }
    const bounds = { minX: Math.min(solid.bounds!.minX, caps.bounds!.minX), minY: Math.min(solid.bounds!.minY, caps.bounds!.minY),
      maxX: Math.max(solid.bounds!.maxX, caps.bounds!.maxX), maxY: Math.max(solid.bounds!.maxY, caps.bounds!.maxY) }
    assert.ok(bounds.minX <= observation.rasterBounds.minX + cornerRaster.boundsUncertainty)
    assert.ok(bounds.minY <= observation.rasterBounds.minY + cornerRaster.boundsUncertainty)
    assert.ok(bounds.maxX >= observation.rasterBounds.maxX - cornerRaster.boundsUncertainty)
    assert.ok(bounds.maxY >= observation.rasterBounds.maxY - cornerRaster.boundsUncertainty)
    assert.ok(Math.max(caps.radius, solid.radius) >= observation.rasterRadius - cornerRaster.distanceUncertainty)
  })
}

const terminalRaster = JSON.parse(readFileSync(new URL('terminal-dot-observations.json', cornerDirectory), 'utf8')) as typeof cornerRaster

test('independent terminal-only dot fixture inventory retains both cap types and thin/wide paint', () => {
  assert.match(terminalRaster.provenance, /Independent librsvg/)
  assert.equal(terminalRaster.scale, 16)
  assert.equal(terminalRaster.boundsUncertainty, 1 / 16)
  assert.equal(terminalRaster.distanceUncertainty, 2 / 16)
  assert.deepEqual(terminalRaster.observations.map(({ id }) => id).sort(),
    [...[6, 36].flatMap((width) => ['square', 'round'].map((cap) => `cartesian-terminal-dot-${width}-${cap}`)), 'production-terminal-dot'].sort())
})

for (const observation of terminalRaster.observations) {
  test(`${observation.id}: terminal policy retains Cairo evidence and explicit interior full-dot delta`, () => {
    if (observation.coordinateSpace === 'cartesian') assert.deepEqual(observation.vertices, contour.vertices)
    assert.deepEqual(observation.dashPattern, [0, 15])
    assert.equal(observation.dashPhase, 5)
    assert.equal(observation.lineJoin, 'bevel')
    for (const [file, hash] of [[observation.svgFile, observation.svgSha256], [observation.pngFile, observation.pngSha256]]) {
      assert.equal(createHash('sha256').update(readFileSync(new URL(file, cornerDirectory))).digest('hex'), hash)
    }
    const solid = createPolygonStrokeRegion(observation.vertices, observation.width, observation.lineJoin)
    const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices: observation.vertices }, observation.width, observation.dashPattern, observation.dashPhase, observation.lineCap)
    // Perimeter 40 plus phase 5 reaches the next zero-on entry (45); the
    // initial parameter is in the gap. The terminal dot uses both halves of
    // the incoming final edge's cap, even without an initial dot to join it.
    const lastVertex = observation.vertices.at(-1)!, firstVertex = observation.vertices[0]
    const finalEdgeLength = Math.hypot(firstVertex.x - lastVertex.x, firstVertex.y - lastVertex.y)
    const terminal = caps.families.filter((family) => family.kind === 'line'
      && family.origin.x === lastVertex.x && family.origin.y === lastVertex.y
      && Math.abs(family.first - finalEdgeLength) < 1e-10 && Math.abs(family.last - finalEdgeLength) < 1e-10)
    assert.equal(terminal.length, 2)
    assert.deepEqual(terminal.map(({ sign }) => sign).sort(), [-1, 1])
    for (const family of terminal) if (family.kind === 'line') {
      close(family.tangent.x, (firstVertex.x - lastVertex.x) / finalEdgeLength)
      close(family.tangent.y, (firstVertex.y - lastVertex.y) / finalEdgeLength)
    }
    const distance = (point: { x: number; y: number }) => Math.min(distanceToPolygonStroke(point, solid), distanceToDashCaps(point, caps))
    const positives = observation.probes.filter(({ alpha, painted }) => painted && alpha >= 128)
    assert.ok(positives.length > 0)
    for (const probe of positives) assert.ok(distance(probe.point) <= terminalRaster.distanceUncertainty,
      `${JSON.stringify(probe.point)} is independently painted`)
    // Use an independent conservative distance from the original square for
    // exterior controls, preserving continuous stroke-neighborhood gap selection.
    const xs = observation.vertices.map(({ x }) => x), ys = observation.vertices.map(({ y }) => y)
    const contourBox = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    const negatives = observation.probes.filter(({ point, painted, nearestPaintCenterDistance }) => !painted
      && nearestPaintCenterDistance > 6 + terminalRaster.distanceUncertainty
      && Math.hypot(Math.max(0, contourBox.minX - point.x, point.x - contourBox.maxX),
        Math.max(0, contourBox.minY - point.y, point.y - contourBox.maxY))
        > observation.width / 2 + 6 + terminalRaster.distanceUncertainty)
    assert.ok(negatives.length > 0)
    // Scalar positions 10 and 25 are interior zero-on intervals; position 40
    // is the retained terminal policy, separately questioned by native checks.
    const [v0, v1, v2, v3] = observation.vertices
    const dotCenters = [v0, v1, { x: (v2.x + v3.x) / 2, y: (v2.y + v3.y) / 2 }]
    for (const probe of negatives) assertCairoExteriorWithDotDelta(probe.point, distance(probe.point), dotCenters, observation)
    assert.ok(negatives.some((probe) => fullDotDistance(probe.point, dotCenters, observation.width, observation.lineCap) > 6),
      'Retain genuine exterior controls beyond the new full dots')
    const bounds = { minX: Math.min(solid.bounds!.minX, caps.bounds!.minX), minY: Math.min(solid.bounds!.minY, caps.bounds!.minY),
      maxX: Math.max(solid.bounds!.maxX, caps.bounds!.maxX), maxY: Math.max(solid.bounds!.maxY, caps.bounds!.maxY) }
    assert.ok(bounds.minX <= observation.rasterBounds.minX + terminalRaster.boundsUncertainty)
    assert.ok(bounds.minY <= observation.rasterBounds.minY + terminalRaster.boundsUncertainty)
    assert.ok(bounds.maxX >= observation.rasterBounds.maxX - terminalRaster.boundsUncertainty)
    assert.ok(bounds.maxY >= observation.rasterBounds.maxY - terminalRaster.boundsUncertainty)
    assert.ok(Math.max(caps.radius, solid.radius) >= observation.rasterRadius - terminalRaster.distanceUncertainty)
  })
}

test('reported terminal square-cap paint is inside interaction geometry before adding the six-unit allowance', () => {
  const observation = terminalRaster.observations.find(({ id }) => id === 'cartesian-terminal-dot-36-square')!
  const probe = observation.probes.find(({ point }) => point.x === -17.96875 && point.y === -17.96875)!
  assert.ok(probe.painted && probe.alpha >= 128)
  const caps = createDashCaps(contour, 36, [0, 15], 5, 'square')
  close(distanceToDashCaps(probe.point, caps), 0)
  // The independent reviewer measured a former 9.96875-unit distance here.
  // A tolerance increase or continuous bevel expansion cannot hide omission.
  assert.ok(distanceToPolygonStroke(probe.point, createPolygonStrokeRegion(contour.vertices, 36, 'bevel')) > 6)
})


test('actual square point includes terminal-only dot paint in App candidates without altering the local allowance', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.camera = { mode: '2d', scale: 1, origin: { x: 240, y: 180 } }
  const point = createPointStratum({ ambientDimension: 2, id: 'terminal-dot-square', text: '', position: { x: 0, y: 0, z: 0 } })
  point.style.shape = 'square'
  point.style.size = 5.892556509887896
  const paint = getPointPaint(point.style)
  paint.fill.enabled = false
  Object.assign(paint.stroke, { enabled: true, width: 30, lineStyle: 'solid', dashPattern: [0, 15 / 1.2],
    dashPhase: 5 / 1.2, lineCap: 'rect', lineJoin: 'bevel' })
  diagram.strata = [point]
  const layout = pendingSvgPointNodeLayout(point)
  const reference = terminalRaster.observations.find(({ id }) => id === 'production-terminal-dot')!
  assert.equal(layout.stroke, 36)
  layout.geometry.vertices.forEach((vertex, index) => {
    close(vertex.x, reference.vertices[index].x); close(vertex.y, reference.vertices[index].y)
  })
  const center = projectToSvgPoint(diagram.camera, point.position, 360)
  const picked = (local: { x: number; y: number }) => collectSvgPreviewSelectionCandidates({ diagram,
    camera: diagram.camera, viewportHeight: 360, point: { x: center.x + local.x, y: center.y + local.y },
    showCoordinateAnchors: false }).some((candidate) => candidate.id === point.id)
  for (const local of [{ x: 21, y: -21 }, { x: 22, y: -22 }]) {
    const probe = reference.probes.find(({ point }) => point.x === local.x && point.y === local.y)!
    assert.equal(probe.alpha, 255)
    close(distanceToDashCaps(local, layout.dashCaps), 0)
    assert.equal(picked(local), true)
  }
  assert.equal(picked({ x: 0, y: 0 }), true)
  assert.equal(picked({ x: 45, y: -45 }), false)
})

type SeamObservation = Omit<CornerObservation, 'probes'> & {
  probes: (CornerObservation['probes'][number] & { reason: string; continuousStrokeDistance: number })[]
}
const seamRaster = JSON.parse(readFileSync(new URL('seam-observations.json', cornerDirectory), 'utf8')) as {
  provenance: string; scale: number; boundsUncertainty: number; distanceUncertainty: number
  viewBox: { minX: number; minY: number; width: number; height: number }
  originalMatrix: { path: string; sha256: string; retainedExcerpt: string }
  continuousStrokeOracle: { description: string; vertices: { x: number; y: number }[] }
  observations: SeamObservation[]
}

test('independent generalized-seam inventory preserves eight reviewer pairs and the continuous bevel oracle', () => {
  assert.match(seamRaster.provenance, /Independent librsvg/)
  assert.equal(seamRaster.scale, 16)
  assert.equal(seamRaster.boundsUncertainty, 1 / 16)
  assert.equal(seamRaster.distanceUncertainty, 2 / 16)
  assert.deepEqual(seamRaster.viewBox, { minX: -30, minY: -30, width: 80, height: 80 })
  assert.deepEqual(seamRaster.continuousStrokeOracle.vertices,
    [{ x: -18, y: 0 }, { x: 0, y: -18 }, { x: 10, y: -18 }, { x: 28, y: 0 },
      { x: 28, y: 10 }, { x: 10, y: 28 }, { x: 0, y: 28 }, { x: -18, y: 10 }])
  assert.deepEqual(seamRaster.observations.map(({ id }) => id).sort(), ['square', 'round'].flatMap((cap) =>
    [`p0-${cap}-phase10`, `p1-${cap}-phase10`, `p5-${cap}-phase0`, `p5-${cap}-phase20`]).sort())
  const retained = JSON.parse(readFileSync(new URL(seamRaster.originalMatrix.retainedExcerpt, cornerDirectory), 'utf8')) as {
    source: string; sourceSha256: string; retainedSourceAndRasterHashes: Record<string, string>
    observations: { id: string; pattern: number[]; phase: number; cap: string; width: number }[]
  }
  assert.equal(retained.source, seamRaster.originalMatrix.path)
  assert.equal(retained.sourceSha256, seamRaster.originalMatrix.sha256)
  assert.equal(retained.observations.length, 8)
  for (const observation of seamRaster.observations) {
    const reviewed = retained.observations.find(({ id }) => id === observation.id)!
    assert.deepEqual(observation.dashPattern, reviewed.pattern)
    assert.equal(observation.dashPhase, reviewed.phase)
    assert.equal(observation.lineCap, reviewed.cap)
    assert.equal(observation.width, reviewed.width)
    assert.equal(observation.svgSha256, retained.retainedSourceAndRasterHashes[`${observation.id}.svg`])
    assert.equal(observation.pngSha256, retained.retainedSourceAndRasterHashes[`${observation.id}.png`])
  }
})

for (const observation of seamRaster.observations) {
  test(`${observation.id}: generalized seam retains Cairo probes with explicit isolated-dot delta`, () => {
    assert.deepEqual(observation.vertices, contour.vertices)
    assert.equal(observation.width, 36)
    assert.equal(observation.lineJoin, 'bevel')
    for (const [file, hash] of [[observation.svgFile, observation.svgSha256], [observation.pngFile, observation.pngSha256]]) {
      assert.equal(createHash('sha256').update(readFileSync(new URL(file, cornerDirectory))).digest('hex'), hash)
    }
    const solid = createPolygonStrokeRegion(observation.vertices, observation.width, observation.lineJoin)
    const caps = createDashCaps(contour, observation.width, observation.dashPattern, observation.dashPhase, observation.lineCap)
    const distance = (point: { x: number; y: number }) => Math.min(distanceToPolygonStroke(point, solid), distanceToDashCaps(point, caps))
    const positives = observation.probes.filter(({ painted, alpha }) => painted && alpha >= 128)
    assert.ok(positives.some(({ continuousStrokeDistance }) => continuousStrokeDistance > seamRaster.distanceUncertainty))
    for (const probe of positives) assert.ok(distance(probe.point) <= seamRaster.distanceUncertainty,
      `${JSON.stringify(probe.point)} is independently painted (${probe.reason})`)
    // The literal octagon distance comes from the independent generator, not
    // either production geometry helper. Requiring both distances preserves
    // intentional continuous-stroke selection through native dash gaps.
    const negatives = observation.probes.filter(({ painted, nearestPaintCenterDistance, continuousStrokeDistance }) => !painted
      && nearestPaintCenterDistance > 6 + seamRaster.distanceUncertainty
      && continuousStrokeDistance > 6 + seamRaster.distanceUncertainty)
    assert.ok(negatives.length > 0)
    // The p5 pattern's isolated interior dots occur at scalar 30 (phase 0)
    // or 10 (phase 20). Positive intervals and the seam policy are unchanged.
    const dotCenters = observation.id.startsWith('p5-')
      ? [contour.vertices[observation.dashPhase === 0 ? 3 : 1]] : []
    for (const probe of negatives) assertCairoExteriorWithDotDelta(probe.point, distance(probe.point), dotCenters, observation)
    assert.ok(negatives.some((probe) => fullDotDistance(probe.point, dotCenters, observation.width, observation.lineCap) > 6),
      'Retain genuine exterior controls beyond the new full dots')
    const corner = observation.probes.find(({ point }) => point.x === -28 && point.y === -28)!
    close(corner.continuousStrokeDistance, 38 / Math.SQRT2)
    const bounds = { minX: Math.min(solid.bounds!.minX, caps.bounds!.minX), minY: Math.min(solid.bounds!.minY, caps.bounds!.minY),
      maxX: Math.max(solid.bounds!.maxX, caps.bounds!.maxX), maxY: Math.max(solid.bounds!.maxY, caps.bounds!.maxY) }
    assert.ok(bounds.minX <= observation.rasterBounds.minX + seamRaster.boundsUncertainty)
    assert.ok(bounds.minY <= observation.rasterBounds.minY + seamRaster.boundsUncertainty)
    assert.ok(bounds.maxX >= observation.rasterBounds.maxX - seamRaster.boundsUncertainty)
    assert.ok(bounds.maxY >= observation.rasterBounds.maxY - seamRaster.boundsUncertainty)
    assert.ok(Math.max(solid.radius, caps.radius) >= observation.rasterRadius - seamRaster.distanceUncertainty)
  })
}
