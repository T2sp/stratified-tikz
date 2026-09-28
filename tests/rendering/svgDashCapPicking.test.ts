import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import type { PointShape, PointStratum, Vec2 } from '../../src/model/types.ts'
import { collectSvgPreviewSelectionCandidates, nextSvgPreviewSelectionCycle } from '../../src/rendering/svgHitTesting.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { currentSvgPointNodeLayout, pendingSvgPointNodeLayout, svgPointNodeLayout, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { pointStyleToSvgPaint } from '../../src/rendering/svgPointPaint.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { mapClientPointToViewBox } from '../../src/rendering/svgViewBox.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'

type Stroke = ReturnType<typeof getPointPaint>['stroke']
type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
const close = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`)
}
function boundsClose(actual: Bounds, expected: Bounds, tolerance = 1e-9) {
  for (const key of ['minX', 'minY', 'maxX', 'maxY'] as const) close(actual[key], expected[key], tolerance)
}
function fixture(shape: PointShape = 'triangle', stroke: Partial<Stroke> = {}, size = 3) {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.camera = { mode: '2d', scale: 1, origin: { x: 240, y: 180 } }
  const point = createPointStratum({ ambientDimension: 2, id: 'dash-outline', text: '', position: { x: 0, y: 0, z: 0 } })
  Object.assign(point.style, { shape, size })
  Object.assign(getPointPaint(point.style).stroke, { enabled: true, lineStyle: 'dashed', width: 30,
    dashPhase: 0, lineCap: 'rect', lineJoin: 'bevel', ...stroke })
  getPointPaint(point.style).fill.enabled = false
  diagram.strata = [point]
  return { diagram, point }
}
const measurement = {
  identity: 'dash-cap-picking',
  measure: (text: string) => ({ width: text.length * 6, ascent: 9, descent: 3 }),
  lineMetrics: () => ({ ascent: 9, descent: 3 }),
}
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
function capture(point: PointStratum) {
  return captureSvgLabelExport({ runtime, source: point.text ?? '', pointStyle: point.style,
    position: { x: 0, y: 0 }, color: '#000000', opacity: 1, fontSize: 12, anchor: 'center',
    boundsTarget: false, settings: svgLabelLayoutSettings(12), ownerIdentity: svgPointNodeOwner(4, point.id) })
}
async function committed(point: PointStratum): Promise<SvgPointNodeCommit> {
  const input = capture(point)
  const [state] = await settleSvgExportLabels([input])
  assert.equal(state.status, 'ready')
  return { source: state.source, ownerIdentity: svgPointNodeOwner(4, point.id), fontGeneration: 0,
    shape: point.style.shape, size: point.style.size, requestIdentity: state.requestIdentity,
    layout: svgPointNodeLayout(input.pointStyle!, state) }
}
function candidates(input: ReturnType<typeof fixture>, local: Vec2, entry?: SvgPointNodeCommit, displayScale = 1) {
  const { diagram, point } = input
  const center = projectToSvgPoint(diagram.camera, point.position, 360)
  const viewBox = { width: 480, height: 360 }
  const rect = { left: 17, top: 29, width: 480 * displayScale, height: 360 * displayScale }
  const client = { x: rect.left + (center.x + local.x) * displayScale,
    y: rect.top + (center.y + local.y) * displayScale }
  return collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360,
    point: mapClientPointToViewBox(client, rect, viewBox), showCoordinateAnchors: false,
    ...(entry === undefined ? {} : { pointCommits: new Map([[point.id, entry]]),
      pointDocumentRevision: 4, pointFontGeneration: 0 }) })
}
function picked(input: ReturnType<typeof fixture>, local: Vec2, entry?: SvgPointNodeCommit, displayScale = 1) {
  return candidates(input, local, entry, displayScale).some(({ id }) => id === input.point.id)
}

test('reported dashed square triangle cap paint survives pending, committed, responsive and selection geometry', async () => {
  const input = fixture()
  const entry = await committed(input.point)
  const pending = pendingSvgPointNodeLayout(input.point)
  assert.deepEqual(pending.geometry, entry.layout.geometry)
  boundsClose(pending.paintedBounds, entry.layout.paintedBounds)
  assert.equal(pending.stroke, 36)
  assert.equal(pointStyleToSvgPaint(input.point.style).strokeLinecap, 'square')
  // Retained independent reviewer raster at 16 pixels/local unit. These are
  // measurements, not values obtained from the production stroke helper.
  close(pending.paintedBounds.minY, -29.65625, 1 / 16)
  close(pending.selectionRadius, 30.3804328989, 2 / 16)
  assert.deepEqual(pending.anchorClearanceBounds, pending.paintedBounds)
  for (const state of [undefined, entry]) for (const scale of [.5, 1, 2]) {
    for (const local of [{ x: 0, y: -24 }, { x: -6, y: -28 }]) assert.equal(picked(input, local, state, scale), true)
    for (const local of [{ x: 0, y: -45 }, { x: 45, y: 0 }, { x: -45, y: 0 }, { x: 0, y: 45 }]) {
      assert.equal(picked(input, local, state, scale), false)
    }
  }
  const captured = capture(input.point)
  const [state] = await settleSvgExportLabels([captured])
  const selected = renderToStaticMarkup(createElement(SvgPointNodeView, { capture: captured, state, selected: true }))
  const selectedRadius = Number(/<circle r="([^"]+)"/.exec(selected)?.[1])
  close(selectedRadius, pending.selectionRadius + 6)
  assert.ok(selectedRadius > 36)
  assert.equal(pointStyleToSvgPaint(input.point.style).vectorEffect, undefined)
})

test('square cap correction retains the exact solid bevel and solid miter exterior misses', () => {
  const bevel = fixture('triangle', { lineStyle: 'solid' })
  assert.equal(picked(bevel, { x: 0, y: -24 }), false)
  const miter = fixture('triangle', { lineStyle: 'solid', lineJoin: 'miter' })
  assert.equal(picked(miter, { x: 0, y: 28 }), false)
  assert.equal(picked(miter, { x: 0, y: -40 }), true)
  assert.equal(picked(fixture(), { x: 0, y: -24 }), true)
})

test('named dash lengths, explicit precedence and geometric unit conversion stay shared with emitted paint', () => {
  for (const [lineStyle, expected] of [['dashed', [3.6, 3.6]], ['dotted', [36, 2.4]], ['denselyDotted', [36, 1.2]]] as const) {
    const input = fixture('triangle', { lineStyle, dashPhase: -5 })
    const paint = pointStyleToSvgPaint(input.point.style)
    const emitted = String(paint.strokeDasharray).split(' ').map(Number)
    emitted.forEach((length, index) => close(length, expected[index]))
    close(Number(paint.strokeDashoffset), -6)
    const named = pendingSvgPointNodeLayout(input.point)
    getPointPaint(input.point.style).stroke.dashPattern = lineStyle === 'dashed' ? [3, 3] : [30, lineStyle === 'dotted' ? 2 : 1]
    getPointPaint(input.point.style).stroke.lineStyle = 'solid'
    const explicit = pendingSvgPointNodeLayout(input.point)
    boundsClose(named.paintedBounds, explicit.paintedBounds)
    close(named.selectionRadius, explicit.selectionRadius)
    assert.equal(pointStyleToSvgPaint(input.point.style).strokeDasharray, paint.strokeDasharray)
    getPointPaint(input.point.style).stroke.dashPattern = [2, 7]
    assert.equal(pointStyleToSvgPaint(input.point.style).strokeDasharray, '2.4 8.4')
  }
})

test('wrapped positive and negative phases preserve dash-cap geometry', () => {
  for (const shape of ['triangle', 'circle', 'star'] as const) {
    const input = fixture(shape, { dashPattern: [2, 4], dashPhase: 1.5 })
    const before = pendingSvgPointNodeLayout(input.point)
    for (const phase of [7.5, -4.5, 600001.5, -599998.5]) {
      getPointPaint(input.point.style).stroke.dashPhase = phase
      const after = pendingSvgPointNodeLayout(input.point)
      boundsClose(after.paintedBounds, before.paintedBounds, 1e-8)
      close(after.selectionRadius, before.selectionRadius, 1e-8)
      for (const local of [{ x: 0, y: -24 }, { x: -6, y: -28 }, { x: 45, y: 0 }]) {
        const expected = picked(fixture(shape, { dashPattern: [2, 4], dashPhase: 1.5 }), local)
        assert.equal(picked(input, local), expected)
      }
    }
  }
})

test('finite extreme phases are wrapped before TeX conversion can overflow', () => {
  for (const phase of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
    const input = fixture('triangle', { dashPhase: phase })
    const paint = pointStyleToSvgPaint(input.point.style)
    assert.ok(Number.isFinite(paint.strokeDashoffset))
    close(Number(paint.strokeDashoffset), (phase % 6) * 1.2)
    const equivalent = fixture('triangle', { dashPhase: phase % 6 })
    boundsClose(pendingSvgPointNodeLayout(input.point).paintedBounds, pendingSvgPointNodeLayout(equivalent.point).paintedBounds)
  }
})

test('dash gaps and hollow original interiors retain selection while exterior probes remain misses', () => {
  const input = fixture('square', { width: 1, lineCap: 'butt', dashPattern: [1, 100], dashPhase: 0 }, 20)
  // Square contour has half-side 12*sqrt(2); the midpoint of its bottom edge
  // lies in the 120-local-unit gap after the first 1.2-local-unit dash.
  const bottom = 12 * Math.SQRT2
  assert.equal(picked(input, { x: 0, y: bottom }), true)
  assert.equal(picked(input, { x: 0, y: 0 }), true)
  assert.equal(picked(input, { x: 0, y: bottom + .6 + 5.9 }), true)
  assert.equal(picked(input, { x: 0, y: bottom + .6 + 6.1 }), false)
  assert.equal(picked(input, { x: 40, y: 40 }), false)
})

test('disabled borders drop caps; zero alpha retains the established interaction geometry', async () => {
  for (const shape of ['triangle', 'circle', 'star'] as const) {
    const input = fixture(shape)
    const opaque = pendingSvgPointNodeLayout(input.point)
    const border = getPointPaint(input.point.style).stroke
    border.opacity = 0
    input.point.style.opacity = 0
    assert.deepEqual(pendingSvgPointNodeLayout(input.point), opaque)
    assert.equal(picked(input, { x: 0, y: 0 }), true)
    border.enabled = false
    const disabled = pendingSvgPointNodeLayout(input.point)
    const entry = await committed(input.point)
    assert.equal(disabled.stroke, 0)
    assert.deepEqual(disabled.paintedBounds, disabled.geometry.bounds)
    for (const state of [undefined, entry]) {
      assert.equal(picked(input, { x: 0, y: 0 }, state), true)
      assert.equal(picked(input, { x: -6, y: -28 }, state), false)
    }
  }
})

for (const [name, change] of [
  ['line style', (stroke: Stroke) => { stroke.lineStyle = 'dotted' }],
  ['explicit pattern', (stroke: Stroke) => { stroke.dashPattern = [4, 2] }],
  ['phase', (stroke: Stroke) => { stroke.dashPhase = 1 }],
  ['cap', (stroke: Stroke) => { stroke.lineCap = 'butt' }],
  ['join', (stroke: Stroke) => { stroke.lineJoin = 'miter' }],
] as const) {
  test(`committed geometry rejects stale ${name} and accepts matching refreshed layout`, async () => {
    const input = fixture()
    const old = await committed(input.point)
    const commits = new Map([[input.point.id, old]])
    assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), old.layout)
    change(getPointPaint(input.point.style).stroke)
    assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), null)
    assert.equal(picked(input, { x: 0, y: 0 }, old), false)
    const fresh = await committed(input.point)
    commits.set(input.point.id, fresh)
    assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), fresh.layout)
    assert.equal(picked(input, { x: 0, y: 0 }, fresh), true)
    boundsClose(pendingSvgPointNodeLayout(input.point).paintedBounds, fresh.layout.paintedBounds)
    assert.equal(currentSvgPointNodeLayout(input.point, commits, 5, 0), null)
    assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 1), null)
    assert.equal(currentSvgPointNodeLayout({ ...input.point, text: 'changed' }, commits, 4, 0), null)
  })
}

test('committed patterns compare values and retain an immutable copy against in-place edits', async () => {
  const input = fixture('triangle', { dashPattern: [3, 3] })
  const old = await committed(input.point)
  const commits = new Map([[input.point.id, old]])
  const border = getPointPaint(input.point.style).stroke
  border.dashPattern = [3, 3]
  assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), old.layout)
  border.dashPattern[0] = 5
  assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), null)
  const fresh = await committed(input.point)
  commits.set(input.point.id, fresh)
  assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), fresh.layout)
  border.dashPattern = [5, 3]
  assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), fresh.layout)
})

test('whole-node captured dash geometry and SVG output survive subsequent live pattern, phase and cap edits', async () => {
  const input = fixture('triangle', { dashPattern: [3, 3] })
  const frozen = capture(input.point)
  const [state] = await settleSvgExportLabels([frozen])
  const before = renderSettledSvgLabelDocument(frozen, state)
  const beforeLayout = svgPointNodeLayout(frozen.pointStyle!, state)
  const border = getPointPaint(input.point.style).stroke
  border.dashPattern![0] = 20
  border.dashPhase = 4
  border.lineCap = 'butt'
  border.lineStyle = 'dotted'
  const live = await committed(input.point)
  assert.notDeepEqual(live.layout.paintedBounds, beforeLayout.paintedBounds)
  assert.equal(renderSettledSvgLabelDocument(frozen, state), before)
  assert.deepEqual(svgPointNodeLayout(frozen.pointStyle!, state), beforeLayout)
  assert.ok(Object.isFrozen(frozen.pointStyle!.paint!.stroke.dashPattern))
  assert.match(before, /stroke-linecap="square"/)
  assert.match(before, /stroke-dasharray="3.5999999999999996 3.5999999999999996"/)
  const refreshedCapture = capture(input.point)
  const [refreshedState] = await settleSvgExportLabels([refreshedCapture])
  assert.match(renderSettledSvgLabelDocument(refreshedCapture, refreshedState), /stroke-linecap="butt"/)
})

test('cap-positive overlap candidates include the clicked point and ordinary/Alt candidate cycling reaches it', () => {
  const input = fixture()
  const control = createPointStratum({ ambientDimension: 2, id: 'control', text: '', position: { x: 0, y: 24, z: 0 } })
  control.style.size = 20
  input.diagram.strata.push(control)
  const local = { x: 0, y: -24 }
  const found = candidates(input, local)
  assert.deepEqual(new Set(found.map(({ id }) => id)), new Set([input.point.id, control.id]))
  assert.equal(found[0].id, control.id)
  let cycle = nextSvgPreviewSelectionCycle(null, local, found)
  const reached = new Set([cycle.candidate?.id])
  for (let index = 0; index < found.length; index += 1) {
    cycle = nextSvgPreviewSelectionCycle(cycle.state, local, found)
    reached.add(cycle.candidate?.id)
  }
  assert.ok(reached.has(input.point.id))
  assert.ok(reached.has(control.id))
})

test('zero entries, short positive periods, long patterns, wide borders and huge phases keep finite bounded geometry', () => {
  const patterns = [[0, 6], [6, 0], [0, 0, 2, 2], [0, 2, 0, 4], [1e-6, 2e-6], Array.from({ length: 64 }, (_, index) => index % 3 ? .01 : 0)]
  for (const shape of ['triangle', 'circle', 'star'] as const) for (const dashPattern of patterns) {
    for (const dashPhase of [0, 1e12, -1e12, 1e200, -1e200]) {
      const input = fixture(shape, { dashPattern, dashPhase, width: 100 })
      const layout = pendingSvgPointNodeLayout(input.point)
      assert.ok(Object.values(layout.paintedBounds).every(Number.isFinite), JSON.stringify({ shape, dashPattern, dashPhase }))
      assert.ok(Number.isFinite(layout.selectionRadius))
      assert.ok(layout.selectionRadius < 200)
      assert.equal(picked(input, { x: 0, y: 0 }), true)
      assert.equal(picked(input, { x: 1000, y: -1000 }), false)
    }
  }
})


type RasterObservation = {
  id: string; shape: PointShape; size: number; vertices?: Vec2[]; radius?: number
  width: number; lineStyle: Stroke['lineStyle']; lineJoin: Stroke['lineJoin']; lineCap: 'square' | 'butt' | 'round'
  dashPattern: number[]; dashPhase: number; rasterBounds: Bounds; rasterRadius: number
  svgSha256: string; pngSha256: string
  probes: { point: Vec2; alpha: number; painted: boolean; nearestPaintCenterDistance: number }[]
}
const fixtureDirectory = new URL('../fixtures/dash-cap-svg/', import.meta.url)
const raster = JSON.parse(readFileSync(new URL('observations.json', fixtureDirectory), 'utf8')) as {
  provenance: string; scale: number; distanceUncertainty: number; boundsUncertainty: number
  observations: RasterObservation[]
}
function rasterFixture(observation: RasterObservation) {
  return fixture(observation.shape, { width: observation.width / 1.2, lineStyle: observation.lineStyle,
    lineJoin: observation.lineJoin, lineCap: observation.lineCap === 'square' ? 'rect' : observation.lineCap,
    dashPattern: observation.dashPattern.map((part) => part / 1.2), dashPhase: observation.dashPhase / 1.2 }, observation.size)
}
// This conservative exterior criterion is independent of the implementation:
// bevel/round solid strokes lie in the half-width neighborhood of path edges.
// It deliberately cannot call a genuine dash gap an exterior negative.
function outsideContinuousNeighborhood(observation: RasterObservation, point: Vec2) {
  if (observation.radius !== undefined) return Math.hypot(point.x, point.y) > observation.radius + observation.width / 2 + 6
  const vertices = observation.vertices!
  if (point.x >= Math.min(...vertices.map(({ x }) => x)) && point.x <= Math.max(...vertices.map(({ x }) => x))
    && point.y >= Math.min(...vertices.map(({ y }) => y)) && point.y <= Math.max(...vertices.map(({ y }) => y))) return false
  return vertices.every((start, index) => {
    const end = vertices[(index + 1) % vertices.length]
    const dx = end.x - start.x, dy = end.y - start.y
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy) > observation.width / 2 + 6
  })
}

test('dash paint oracle retains independent SVG sources, raster settings, binary hashes and probes', () => {
  assert.match(raster.provenance, /Independent librsvg/)
  assert.equal(raster.scale, 16)
  assert.equal(raster.boundsUncertainty, 1 / 16)
  assert.equal(raster.distanceUncertainty, 2 / 16)
  assert.equal(raster.observations.length, 19)
  const generator = readFileSync(new URL('generate.mjs', fixtureDirectory), 'utf8')
  assert.doesNotMatch(generator, /(?:import|from).*src\//)
  for (const observation of raster.observations) {
    for (const extension of ['svg', 'png'] as const) {
      assert.equal(createHash('sha256').update(readFileSync(new URL(`${observation.id}.${extension}`, fixtureDirectory))).digest('hex'), observation[`${extension}Sha256`])
    }
  }
  const triangle = raster.observations.find(({ id }) => id === 'triangle-square-wide')!
  for (const point of [{ x: 0, y: -24 }, { x: -6, y: -28 }]) {
    assert.equal(triangle.probes.find(({ point: observed }) => observed.x === point.x && observed.y === point.y)?.alpha, 255)
  }
})

const correctedCircles = JSON.parse(readFileSync(new URL('corrected-circle-observations.json', fixtureDirectory), 'utf8')) as {
  segments: number; boundsUncertainty: number; distanceUncertainty: number
  observations: (RasterObservation & { strokeVertices: Vec2[]; centerlineErrorBound: number; tangentAngleErrorBound: number })[]
}
const productionObservations = [...raster.observations.filter((observation) => observation.shape !== 'circle' || observation.lineCap !== 'square'),
  ...correctedCircles.observations]

for (const observation of productionObservations) {
  test(`${observation.id}: independent visible paint, six-unit neighbors and exterior controls agree with pending/committed picking`, async () => {
    const input = rasterFixture(observation)
    const entry = await committed(input.point)
    const layout = pendingSvgPointNodeLayout(input.point)
    boundsClose(layout.paintedBounds, entry.layout.paintedBounds)
    assert.deepEqual(layout.anchorClearanceBounds, layout.paintedBounds)
    const uncertainty = raster.boundsUncertainty
    assert.ok(layout.paintedBounds.minX <= observation.rasterBounds.minX + uncertainty)
    assert.ok(layout.paintedBounds.minY <= observation.rasterBounds.minY + uncertainty)
    assert.ok(layout.paintedBounds.maxX >= observation.rasterBounds.maxX - uncertainty)
    assert.ok(layout.paintedBounds.maxY >= observation.rasterBounds.maxY - uncertainty)
    assert.ok(layout.selectionRadius >= observation.rasterRadius - raster.distanceUncertainty)
    // The entire continuous contour remains interactive, even in gaps. Only
    // exterior probes independently beyond that neighborhood are negatives.
    let positive = 0, negative = 0
    for (const probe of observation.probes) {
      const expected = probe.nearestPaintCenterDistance < 6 - raster.distanceUncertainty ? true
        : probe.nearestPaintCenterDistance > 6 + raster.distanceUncertainty && outsideContinuousNeighborhood(observation, probe.point) ? false : undefined
      if (expected === undefined) continue
      if (expected) positive += 1
      else negative += 1
      for (const state of [undefined, entry]) for (const scale of [.5, 2]) {
        assert.equal(picked(input, probe.point, state, scale), expected, JSON.stringify({ id: observation.id, probe, scale }))
      }
    }
    assert.ok(positive > 0)
    assert.ok(negative > 0)
  })
}

test('independent square-circle tangential caps exceed radius plus half-width while butt and round controls do not', () => {
  const square = correctedCircles.observations.find(({ id }) => id === 'circle-square-wide-linearized')!
  const layout = pendingSvgPointNodeLayout(rasterFixture(square).point)
  const conventionalRadius = square.radius! + square.width / 2
  const analyticSquareRadius = Math.hypot(conventionalRadius, square.width / 2)
  // A chord changes cap orientation by at most half a segment angle plus
  // the arc/chord length deficit accumulated before an endpoint. This is a
  // mathematical error bound, independently checked below against the path.
  const halfAngle = Math.PI / 256
  const lengthDeficit = 2 * Math.PI * square.radius! - 512 * square.radius! * Math.sin(halfAngle)
  const angleError = halfAngle + lengthDeficit / square.radius!
  const capError = square.centerlineErrorBound + lengthDeficit + Math.SQRT2 * square.width * Math.sin(angleError / 2)
  close(layout.selectionRadius, analyticSquareRadius, capError)
  close(layout.selectionRadius, square.rasterRadius, correctedCircles.distanceUncertainty)
  // Two pixels cover the alpha-threshold loss at a sharp square-cap corner.
  boundsClose(layout.paintedBounds, square.rasterBounds, correctedCircles.distanceUncertainty)
  assert.ok(square.rasterRadius > conventionalRadius + 10)
  const capPositive = square.probes.find(({ painted, point }) => painted && Math.hypot(point.x, point.y) > conventionalRadius + 6)!
  assert.ok(capPositive)
  assert.equal(picked(rasterFixture(square), capPositive.point), true)
  for (const cap of ['butt', 'round']) {
    const control = raster.observations.find(({ id }) => id === `circle-${cap}-wide`)!
    const controlLayout = pendingSvgPointNodeLayout(rasterFixture(control).point)
    close(controlLayout.selectionRadius, conventionalRadius)
    assert.equal(picked(rasterFixture(control), capPositive.point), false)
    assert.ok(control.rasterRadius <= conventionalRadius + raster.distanceUncertainty)
  }
})

test('uninterrupted dashes acquire neither caps at crossed corners nor an artificial closed-path seam', () => {
  for (const shape of ['triangle', 'circle', 'square', 'star'] as const) {
    const solid = fixture(shape, { lineStyle: 'solid', lineCap: 'rect' })
    const expected = pendingSvgPointNodeLayout(solid.point)
    for (const dashPattern of [[6, 0], [0, 0, 6, 0], [1000, 1]]) {
      const input = fixture(shape, { dashPattern, dashPhase: 1 })
      const dashed = pendingSvgPointNodeLayout(input.point)
      boundsClose(dashed.paintedBounds, expected.paintedBounds)
      close(dashed.selectionRadius, expected.selectionRadius)
      for (const local of [{ x: 0, y: -24 }, { x: 0, y: 28 }, { x: -6, y: -28 }]) {
        assert.equal(picked(input, local), picked(solid, local), JSON.stringify({ shape, dashPattern, local }))
      }
    }
  }
  const observation = raster.observations.find(({ id }) => id === 'triangle-zero-off')!
  const layout = pendingSvgPointNodeLayout(rasterFixture(observation).point)
  boundsClose(layout.paintedBounds, observation.rasterBounds, raster.boundsUncertainty)
  close(layout.selectionRadius, observation.rasterRadius, raster.distanceUncertainty)
})

test('wide polygon cap bounds and radius agree with independent corner/seam paint, not synthetic corner caps', () => {
  for (const id of ['triangle-square-wide', 'triangle-explicit-corner', 'triangle-explicit-seam', 'star-concave-square']) {
    const observation = raster.observations.find((entry) => entry.id === id)!
    const layout = pendingSvgPointNodeLayout(rasterFixture(observation).point)
    boundsClose(layout.paintedBounds, observation.rasterBounds, raster.boundsUncertainty)
    close(layout.selectionRadius, observation.rasterRadius, raster.distanceUncertainty)
  }
})

test('effective-pattern equality accepts equivalent explicit styles and repaint without bypassing revision guards', async () => {
  const input = fixture('triangle', { dashPattern: [3, 3] })
  const entry = await committed(input.point)
  const commits = new Map([[input.point.id, entry]])
  const paint = getPointPaint(input.point.style)
  paint.stroke.lineStyle = 'dotted'
  paint.stroke.color = '#224466'
  paint.stroke.opacity = .1
  paint.fill.color = '#EECCBB'
  input.point.style.opacity = .5
  assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), entry.layout)
  paint.stroke.dashPattern = [3, 3, 3, 4]
  assert.equal(currentSvgPointNodeLayout(input.point, commits, 4, 0), null)
})

test('cap extension does not bypass point visibility, layer locking or layer filters', () => {
  const input = fixture()
  const { diagram, point } = input
  const center = projectToSvgPoint(diagram.camera, point.position, 360)
  point.layer = 2
  const options = { diagram, camera: diagram.camera, viewportHeight: 360,
    point: { x: center.x, y: center.y - 24 }, showCoordinateAnchors: false }
  const ids = (extra = {}) => collectSvgPreviewSelectionCandidates({ ...options, ...extra }).map(({ id }) => id)
  diagram.layers = [{ value: 2, name: 'caps', locked: true }]
  assert.deepEqual(ids(), [])
  diagram.layers = [{ value: 2, name: 'caps', visible: false }]
  assert.deepEqual(ids(), [])
  diagram.layers = [{ value: 2, name: 'caps', visible: true }]
  assert.deepEqual(ids({ layerFilter: { kind: 'layer', layer: 0 } }), [])
  assert.deepEqual(ids({ visibility: { hiddenPointIds: new Set([point.id]) } }), [])
  assert.deepEqual(ids(), [point.id])
})


test('retained native-circle repro and corrected circle sources are distinct authenticated evidence', () => {
  assert.equal(correctedCircles.observations.length, 3)
  for (const observation of correctedCircles.observations) {
    assert.equal(observation.strokeVertices.length, 256)
    for (const extension of ['svg', 'png'] as const) {
      assert.equal(createHash('sha256').update(readFileSync(new URL(`${observation.id}.${extension}`, fixtureDirectory))).digest('hex'), observation[`${extension}Sha256`])
    }
    const original = raster.observations.find(({ id }) => id === observation.id.replace('-linearized', ''))!
    assert.ok(original)
    assert.notEqual(observation.svgSha256, original.svgSha256)
    assert.match(readFileSync(new URL(`${original.id}.svg`, fixtureDirectory), 'utf8'), /<circle /)
    assert.match(readFileSync(new URL(`${observation.id}.svg`, fixtureDirectory), 'utf8'), /<polygon /)
  }
})

test('dashed square circles share a fixed finite contour with independently bounded centerline and tangent error', async () => {
  for (const observation of correctedCircles.observations) {
    const input = rasterFixture(observation)
    const layout = pendingSvgPointNodeLayout(input.point)
    assert.equal(layout.geometry.kind, 'circle')
    assert.equal(layout.strokeContour.kind, 'polygon')
    assert.equal(layout.strokeContour.vertices.length, 256)
    const radius = observation.radius!, halfAngle = Math.PI / 256
    close(observation.centerlineErrorBound, radius * (1 - Math.cos(halfAngle)))
    close(observation.tangentAngleErrorBound, halfAngle)
    layout.strokeContour.vertices.forEach((start, index, vertices) => {
      close(start.x, observation.strokeVertices[index].x)
      close(start.y, observation.strokeVertices[index].y)
      close(Math.hypot(start.x, start.y), radius)
      const end = vertices[(index + 1) % vertices.length]
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      close(radius - Math.hypot(midpoint.x, midpoint.y), observation.centerlineErrorBound)
      const chordAngle = Math.atan2(end.y - start.y, end.x - start.x)
      const tangentAngle = Math.atan2(start.x, -start.y)
      const error = Math.abs(Math.atan2(Math.sin(chordAngle - tangentAngle), Math.cos(chordAngle - tangentAngle)))
      close(error, halfAngle)
    })
    const frozen = capture(input.point)
    const [state] = await settleSvgExportLabels([frozen])
    const markup = renderSettledSvgLabelDocument(frozen, state)
    assert.match(markup, /<polygon /)
    close(Number(/data-point-circle-radius="([^"]+)"/.exec(markup)?.[1]), radius)
    close(Number(/stroke-width="([^"]+)"/.exec(markup)?.[1]), observation.width)
    assert.match(markup, /stroke-linecap="square"/)
    assert.match(markup, /stroke-linejoin="bevel"/)
    assert.equal(picked(input, { x: 0, y: 0 }), true)
  }
})


test('round dash caps use their outward half-disc without restoring a full-circle false positive', () => {
  const input = fixture('triangle', { lineCap: 'round', dashPattern: [5 / 1.2, 10 / 1.2] })
  // The inward half of an endpoint disk points across an earlier corner and
  // is not painted. It must not be added as if it were an isolated round dot.
  assert.equal(picked(input, { x: 27, y: -2.5 }), false)
  assert.equal(picked(input, { x: 0, y: 0 }), true)
})

type PhaseRasterObservation = RasterObservation & {
  variant: 'original' | 'corrected'; rawPhase: number; convertedPhase: number; emittedPhase: number
  svgFile: string; pngFile: string; reviewedSvgSha256: string; reviewedPngSha256: string
}
const phaseRasters = JSON.parse(readFileSync(new URL('large-phase-observations.json', fixtureDirectory), 'utf8')) as {
  boundsUncertainty: number; distanceUncertainty: number; observations: PhaseRasterObservation[]
}
test('independent large-phase failed and corrected paint observations remain distinct and byte-preserved', () => {
  assert.equal(phaseRasters.observations.length, 6)
  for (const observation of phaseRasters.observations) {
    for (const extension of ['svg', 'png'] as const) {
      const hash = createHash('sha256').update(readFileSync(new URL(observation[`${extension}File`], fixtureDirectory))).digest('hex')
      assert.equal(hash, observation[`${extension}Sha256`])
      assert.equal(hash, observation[extension === 'svg' ? 'reviewedSvgSha256' : 'reviewedPngSha256'])
    }
  }
  for (const rawPhase of [1e12, 1e20, 1e200]) {
    const original = phaseRasters.observations.find((entry) => entry.rawPhase === rawPhase && entry.variant === 'original')!
    const corrected = phaseRasters.observations.find((entry) => entry.rawPhase === rawPhase && entry.variant === 'corrected')!
    assert.equal(original.emittedPhase, original.convertedPhase)
    assert.ok(Math.abs(corrected.emittedPhase) < 7.2)
    assert.notDeepEqual(original.rasterBounds, corrected.rasterBounds)
  }
})
for (const observation of phaseRasters.observations.filter((entry) => entry.variant === 'corrected')) {
  test(`${observation.rawPhase}: shared canonical SVG phase matches independent paint with unchanged raw style`, async () => {
    const input = fixture('triangle', { dashPhase: observation.rawPhase })
    const paint = pointStyleToSvgPaint(input.point.style)
    assert.equal(paint.strokeDashoffset, observation.emittedPhase)
    assert.equal(paint.strokeDasharray, observation.dashPattern.join(' '))
    assert.equal(getPointPaint(input.point.style).stroke.dashPhase, observation.rawPhase)
    const entry = await committed(input.point)
    for (const layout of [pendingSvgPointNodeLayout(input.point), entry.layout]) {
      boundsClose(layout.paintedBounds, observation.rasterBounds, phaseRasters.boundsUncertainty)
      close(layout.selectionRadius, observation.rasterRadius, phaseRasters.distanceUncertainty)
    }
    for (const state of [undefined, entry]) {
      for (const probe of observation.probes.filter((item) => item.painted)) assert.equal(picked(input, probe.point, state), true)
      assert.equal(picked(input, { x: 65, y: 65 }, state), false)
    }
  })
}
