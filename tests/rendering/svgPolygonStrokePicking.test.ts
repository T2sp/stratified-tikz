import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createPolygonStrokeRegion, distanceToPolygonStroke } from '../../src/geometry/polygonStroke.ts'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import type { PointShape, PointStratum, Vec2 } from '../../src/model/types.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { pendingSvgPointNodeLayout, svgPointNodeLayout, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { pointStyleToSvgPaint } from '../../src/rendering/svgPointPaint.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { mapClientPointToViewBox } from '../../src/rendering/svgViewBox.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'

type Join = 'miter' | 'bevel' | 'round'
type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
type RasterObservation = {
  id: string; shape?: PointShape; size?: number; vertices: Vec2[]; width: number; lineJoin: Join
  miterLimit: number; svgSha256: string; pngSha256: string; rasterBounds: Bounds; rasterRadius: number
  probes: { point: Vec2; painted: boolean; nearestPaintCenterDistance: number }[]
}
const fixtureDirectory = new URL('../fixtures/polygon-stroke-svg/', import.meta.url)
const raster = JSON.parse(readFileSync(new URL('observations.json', fixtureDirectory), 'utf8')) as {
  provenance: string; scale: number; distanceUncertainty: number; boundsUncertainty: number
  observations: RasterObservation[]
}
const close = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`)
}
function boundsClose(actual: Bounds, expected: Bounds, tolerance = 1e-9) {
  for (const key of ['minX', 'minY', 'maxX', 'maxY'] as const) close(actual[key], expected[key], tolerance)
}
function fixture(join: Join = 'miter', width = 30, shape: PointShape = 'triangle', size = 3) {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.camera = { mode: '2d', scale: 1, origin: { x: 240, y: 180 } }
  const point = createPointStratum({ ambientDimension: 2, id: 'outline', text: '', position: { x: 0, y: 0, z: 0 } })
  Object.assign(point.style, { shape, size })
  Object.assign(getPointPaint(point.style).stroke, { enabled: true, lineStyle: 'solid', width, lineJoin: join })
  getPointPaint(point.style).fill.enabled = false
  diagram.strata = [point]
  return { diagram, point }
}
const measurement = {
  identity: 'polygon-join-picking',
  measure: (text: string) => ({ width: text.length * 6, ascent: 9, descent: 3 }),
  lineMetrics: () => ({ ascent: 9, descent: 3 }),
}
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
async function committed(point: PointStratum): Promise<SvgPointNodeCommit> {
  const input = captureSvgLabelExport({ runtime, source: point.text ?? '', pointStyle: point.style,
    position: { x: 0, y: 0 }, color: '#000000', opacity: 1, fontSize: 12, anchor: 'center',
    boundsTarget: false, settings: svgLabelLayoutSettings(12), ownerIdentity: svgPointNodeOwner(4, point.id) })
  const [state] = await settleSvgExportLabels([input])
  assert.equal(state.status, 'ready')
  return { source: state.source, ownerIdentity: svgPointNodeOwner(4, point.id), fontGeneration: 0,
    shape: point.style.shape, size: point.style.size, requestIdentity: state.requestIdentity,
    layout: svgPointNodeLayout(point.style, state) }
}
function picked(input: ReturnType<typeof fixture>, local: Vec2, entry?: SvgPointNodeCommit, displayScale = 1) {
  const { diagram, point } = input
  const center = projectToSvgPoint(diagram.camera, point.position, 360)
  const viewBox = { width: 480, height: 360 }
  const rect = { left: 17, top: 29, width: 480 * displayScale, height: 360 * displayScale }
  const client = { x: rect.left + (center.x + local.x) * displayScale,
    y: rect.top + (center.y + local.y) * displayScale }
  const candidatePoint = mapClientPointToViewBox(client, rect, viewBox)
  return collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360,
    point: candidatePoint, ...(entry === undefined ? {} : { pointCommits: new Map([[point.id, entry]]),
      pointDocumentRevision: 4, pointFontGeneration: 0 }) }).some(({ id }) => id === point.id)
}

test('retained polygon stroke oracle contains independently rasterized SVG inputs and binary identities', () => {
  assert.match(raster.provenance, /Independent librsvg/)
  assert.equal(raster.scale, 16)
  assert.equal(raster.observations.length, 18)
  const generator = readFileSync(new URL('generate.mjs', fixtureDirectory), 'utf8')
  assert.doesNotMatch(generator, /(?:import|from).*src\//)
  for (const observation of raster.observations) {
    for (const extension of ['svg', 'png'] as const) {
      const bytes = readFileSync(new URL(`${observation.id}.${extension}`, fixtureDirectory))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), observation[`${extension}Sha256`])
    }
  }
})

for (const observation of raster.observations) {
  test(`${observation.id}: region distance/bounds match independent SVG paint under either winding and explicit closure`, () => {
    for (const vertices of [observation.vertices, [...observation.vertices].reverse(), [...observation.vertices, observation.vertices[0]]]) {
      const region = createPolygonStrokeRegion(vertices, observation.width, observation.lineJoin, observation.miterLimit)
      assert.ok(region.bounds)
      boundsClose(region.bounds, observation.rasterBounds, raster.boundsUncertainty)
      close(region.radius, observation.rasterRadius, raster.distanceUncertainty)
      for (const probe of observation.probes) {
        close(distanceToPolygonStroke(probe.point, region), probe.nearestPaintCenterDistance, raster.distanceUncertainty)
      }
    }
  })
  if (observation.shape !== undefined && observation.size !== undefined) {
    test(`${observation.id}: production empty-node layout and exterior candidates agree with independent raster distance`, () => {
      const input = fixture(observation.lineJoin, observation.width / 1.2, observation.shape, observation.size)
      const layout = pendingSvgPointNodeLayout(input.point)
      boundsClose(layout.paintedBounds, observation.rasterBounds, raster.boundsUncertainty)
      assert.deepEqual(layout.anchorClearanceBounds, layout.paintedBounds)
      close(layout.selectionRadius, observation.rasterRadius, raster.distanceUncertainty)
      for (const probe of observation.probes) {
        // Every point further than the original contour's radius is exterior,
        // independent of the new stroke helper. Interior policy has its own controls.
        if (Math.hypot(probe.point.x, probe.point.y) <= layout.geometry.radius) continue
        if (Math.abs(probe.nearestPaintCenterDistance - 6) <= raster.distanceUncertainty) continue
        assert.equal(picked(input, probe.point), probe.nearestPaintCenterDistance < 6,
          `${observation.id} ${JSON.stringify(probe)}`)
      }
    })
  }
}

const triangleRadius = 3.6 * Math.SQRT2
const triangleBase = triangleRadius / 2
const triangleBottom = triangleBase + 18
const miterTip = -triangleRadius - 36
// The bottom edge's inward strip reaches past the apex bevel when width=36.
const bevelTop = triangleBase - 18
for (const [join, outside, expectedBounds] of [
  ['miter', { x: 0, y: 28 }, { minX: -(triangleRadius + 36) * Math.sqrt(3) / 2,
    maxX: (triangleRadius + 36) * Math.sqrt(3) / 2, minY: miterTip, maxY: triangleBottom }],
  ['bevel', { x: 0, y: -24 }, { minX: -triangleRadius * Math.sqrt(3) / 2 - 9 * Math.sqrt(3),
    maxX: triangleRadius * Math.sqrt(3) / 2 + 9 * Math.sqrt(3), minY: bevelTop, maxY: triangleBottom }],
] as const) {
  test(`${join}: exact reported empty-triangle false positive is rejected with correct pending and committed bounds`, async () => {
    const input = fixture(join)
    const entry = await committed(input.point)
    for (const layout of [pendingSvgPointNodeLayout(input.point), entry.layout]) {
      assert.equal(layout.stroke, 36)
      assert.equal(getPointPaint(input.point.style).fill.enabled, false)
      boundsClose(layout.paintedBounds, expectedBounds)
      boundsClose(layout.anchorClearanceBounds, expectedBounds)
    }
    const independent = raster.observations.find(({ id }) => id === `triangle-${join}-wide`)!
    boundsClose(expectedBounds, independent.rasterBounds, raster.boundsUncertainty)
    const distance = join === 'miter' ? 28 - triangleBottom : bevelTop + 24
    close(distance, join === 'miter' ? 7.454415587728427 : 8.545584412271573)
    for (const layoutEntry of [undefined, entry]) for (const scale of [.5, 1, 2]) {
      assert.equal(picked(input, outside, layoutEntry, scale), false)
      assert.equal(picked(input, { x: 0, y: 0 }, layoutEntry, scale), true)
    }
    assert.equal(pointStyleToSvgPaint(input.point.style).vectorEffect, undefined)
    assert.equal(pointStyleToSvgPaint(input.point.style).strokeMiterlimit, 10)
  })
}

for (const join of ['miter', 'bevel'] as const) {
  test(`${join}: painted corners and just inside/outside six-unit allowance survive pending/committed responsive picking`, async () => {
    const input = fixture(join)
    const entry = await committed(input.point)
    const upperEdge = join === 'miter' ? miterTip : bevelTop
    for (const layoutEntry of [undefined, entry]) for (const scale of [.5, 1, 2]) {
      for (const [distance, expected] of [[0, true], [5.9, true], [6.1, false]] as const) {
        assert.equal(picked(input, { x: 0, y: upperEdge - distance }, layoutEntry, scale), expected)
        assert.equal(picked(input, { x: 0, y: triangleBottom + distance }, layoutEntry, scale), expected)
      }
    }
    if (join === 'miter') assert.ok(-miterTip - triangleRadius > 18)
  })
}

test('wide bevel exposed off-axis face stays painted and preserves its six-unit allowance', async () => {
  const input = fixture('bevel')
  const entry = await committed(input.point)
  // At x=10 the opposite horizontal edge strip ends at x=4.409..., so the
  // upper boundary is the actual apex bevel face, y=-radius-halfWidth/2.
  const face = -triangleRadius - 9
  for (const layoutEntry of [undefined, entry]) for (const scale of [.5, 1, 2]) {
    assert.equal(picked(input, { x: 10, y: -14 }, layoutEntry, scale), true)
    for (const [distance, expected] of [[0, true], [5.9, true], [6.1, false]] as const) {
      assert.equal(picked(input, { x: 10, y: face - distance }, layoutEntry, scale), expected)
    }
  }
})

test('thin bevel edge retains its actual straight face and six-unit tolerance', () => {
  const input = fixture('bevel', 1)
  const top = -triangleRadius - .3
  for (const [distance, expected] of [[0, true], [5.9, true], [6.1, false]] as const) {
    assert.equal(picked(input, { x: 0, y: top - distance }), expected)
  }
})

test('concave star valleys retain six-unit distance from real thin and overlapping wide strokes', () => {
  for (const join of ['miter', 'bevel', 'round'] as const) {
    for (const suffix of ['concave', 'thick-concave'] as const) {
      const observation = raster.observations.find(({ id }) => id === `star-${join}-${suffix}`)!
      const input = fixture(join, observation.width / 1.2, 'star', observation.size)
      // Rays at odd vertices cross concave valleys. They are exterior to the
      // original star once their radius exceeds that valley's original radius.
      const valley = observation.vertices[1]
      const radius = Math.hypot(valley.x, valley.y)
      const rayProbes = observation.probes.filter(({ point }) =>
        Math.abs(point.x * valley.y - point.y * valley.x) < 1e-7
        && point.x * valley.x + point.y * valley.y > radius * radius)
      assert.ok(rayProbes.some(({ nearestPaintCenterDistance: distance }) => distance > 6.2))
      assert.ok(rayProbes.some(({ nearestPaintCenterDistance: distance }) => distance < 5.8))
      for (const probe of rayProbes) {
        if (Math.abs(probe.nearestPaintCenterDistance - 6) < raster.distanceUncertainty) continue
        assert.equal(picked(input, probe.point), probe.nearestPaintCenterDistance < 6, JSON.stringify({ join, suffix, probe }))
      }
    }
  }
})

test('disabled stroke preserves hollow contour-interior picking and excludes the former painted edge', async () => {
  for (const shape of ['triangle', 'star', 'circle'] as const) {
    const input = fixture('miter', 30, shape)
    getPointPaint(input.point.style).stroke.enabled = false
    const entry = await committed(input.point)
    const layout = entry.layout
    assert.equal(layout.stroke, 0)
    assert.deepEqual(layout.paintedBounds, layout.geometry.bounds)
    for (const state of [undefined, entry]) {
      assert.equal(picked(input, { x: 0, y: 0 }, state), true)
      assert.equal(picked(input, { x: 0, y: -24 }, state), false)
    }
    const tip = shape === 'circle' ? { x: 0, y: -layout.geometry.radius } : layout.geometry.vertices[0]
    assert.equal(picked(input, { x: tip.x, y: tip.y - 5.9 }), true)
    assert.equal(picked(input, { x: tip.x, y: tip.y - 6.1 }), false)
  }
})

test('round polygon and circle retain the established rounded exterior neighborhood', () => {
  for (const shape of ['triangle', 'circle'] as const) {
    const input = fixture('round', 30, shape)
    const radius = shape === 'circle' ? 1.8 * Math.SQRT2 : triangleRadius
    for (const [distance, expected] of [[0, true], [5.9, true], [6.1, false]] as const) {
      assert.equal(picked(input, { x: 0, y: -radius - 18 - distance }), expected)
    }
    // The supplied bevel probe is inside the round stroke's tolerance.
    assert.equal(picked(input, { x: 0, y: -24 }), true)
  }
})

test('miter limit clips an acute tip to its bevel while preserving neighboring miter corners', () => {
  const vertices = [{ x: 0, y: -30 }, { x: -1, y: 20 }, { x: 1, y: 20 }]
  const limited = createPolygonStrokeRegion(vertices, 4, 'miter', 10)
  const bevel = createPolygonStrokeRegion(vertices, 4, 'bevel', 10)
  const extended = createPolygonStrokeRegion(vertices, 4, 'miter', 100)
  assert.ok(limited.bounds && bevel.bounds && extended.bounds)
  close(limited.bounds.minY, bevel.bounds.minY)
  assert.ok(extended.bounds.minY < -120)
  close(distanceToPolygonStroke({ x: 0, y: -60 }, limited), distanceToPolygonStroke({ x: 0, y: -60 }, bevel))
  assert.equal(distanceToPolygonStroke({ x: 0, y: -60 }, extended), 0)
})

test('empty, repeated, near-collinear and closed polygons stay finite without synthetic distant miters', () => {
  for (const vertices of [[], [{ x: 1, y: 1 }], [{ x: 1, y: 1 }, { x: 1, y: 1 }]]) {
    const region = createPolygonStrokeRegion(vertices, 36, 'miter')
    assert.equal(region.bounds, null)
    assert.equal(region.radius, 0)
    assert.equal(distanceToPolygonStroke({ x: 0, y: 0 }, region), Infinity)
  }
  const polygon = [{ x: -10, y: -10 }, { x: 0, y: -10 }, { x: 10, y: -10 + 1e-12 }, { x: 10, y: 10 }, { x: -10, y: 10 }]
  const repeated = polygon.flatMap((point) => [point, point]).concat(polygon[0])
  for (const join of ['miter', 'bevel', 'round'] as const) {
    const region = createPolygonStrokeRegion(repeated, 6, join)
    assert.ok(region.bounds)
    assert.ok(Object.values(region.bounds).every(Number.isFinite))
    assert.ok(Number.isFinite(region.radius))
    assert.ok(region.radius < 20)
    const original = createPolygonStrokeRegion(polygon, 6, join)
    boundsClose(region.bounds, original.bounds!)
    for (const probe of [{ x: 0, y: -13 }, { x: 0, y: 0 }, { x: 20, y: 20 }]) {
      close(distanceToPolygonStroke(probe, region), distanceToPolygonStroke(probe, original))
    }
  }
  assert.equal(createPolygonStrokeRegion(polygon, 0, 'miter').bounds, null)
})
