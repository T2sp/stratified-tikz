import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPendingLayoutFixture, assertPendingLayoutFixture, pendingLayoutPositions,
  resolvePendingLayoutInlineNodes } from '../../scripts/pointLayoutPendingFixture.mjs'
import { layoutShapes, layoutShapeParameters } from '../../scripts/pointLayoutAnchorsContract.mjs'
import { createEmptyDiagram, createPointStratum, createCurveStratum, createTextLabel } from '../../src/model/constructors.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { defaultPointStyle, defaultCurveStyle, defaultLabelStyle } from '../../src/model/styles.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { resolveSvgCamera } from '../../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { createCoordinateAxesGuide } from '../../src/rendering/coordinateAxesGuide.ts'
import { pendingSvgPointNodeLayout } from '../../src/rendering/svgPointNodeLayout.ts'
import { svgPointNodeGeometry } from '../../src/rendering/svgPointNodeGeometry.ts'

const expectedPositions = [[7, 6.5], [19, 13], [23, 13], [27, 13], [31, 13],
  [19, 9], [23, 9], [27, 9], [31, 9], [31, 5], [23, 5], [19, 5], [27, 5], [19, 1], [23, 1]]
  .map(([x, y]) => ({ x, y, z: 0 }))
const shapeOrder = ['circle', 'rectangle', 'square', 'triangle', 'ellipse', 'diamond', 'regular polygon',
  'star', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'circular sector', 'cylinder']
const paint = { text: { color: '#203040', opacity: 1 }, fill: { enabled: true, color: '#d8ecff', opacity: .7 },
  stroke: { enabled: true, color: '#203040', opacity: 1, width: .4, lineStyle: 'solid',
    dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' } }

function inputFixture(captured) {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.layers = [{ value: 0, name: 'Layer 0' }]
  diagram.strata = [createPointStratum({ ambientDimension: 2, id: 'app-point', text: captured,
    position: { x: 3, y: 3, z: 0 }, style: { ...defaultPointStyle, shape: 'circle', size: 8,
      color: '#3870a0', opacity: 1, fill: 'hollow', paint, layout: {}, shapeParameters: {} } }),
  createCurveStratum({ ambientDimension: 2, id: 'export-path', layer: 0,
    points: [{ x: -2, y: -1.8, z: 0 }, { x: 2, y: -1.8, z: 0 }],
    style: { ...defaultCurveStyle, strokeColor: '#008080' }, inlineNodes: [
      { id: 'repeated', text: '$\\frac{x_1}{y^2}$', position: { kind: 'segment', segmentIndex: 0, value: .3 }, options: { placement: 'above', marker: 'dot' } },
      { id: 'mixed', text: '経路 $\\sum_{k=1}^{n}k$', position: { kind: 'segment', segmentIndex: 0, value: .8 }, options: { placement: 'below', marker: 'none' } },
    ] })]
  diagram.labels = [createTextLabel({ ambientDimension: 2, id: 'export-edit', text: 'Before $\\alpha^2$',
    position: { x: -2, y: 1.7, z: 0 }, style: { ...defaultLabelStyle, color: '#c02060', opacity: .65, anchor: 'west' } }),
  createTextLabel({ ambientDimension: 2, id: 'export-ordinary', text: '日本語 Ω ordinary',
    position: { x: -1, y: .9, z: 0 }, style: { ...defaultLabelStyle, color: '#304060', anchor: 'center' } })]
  return JSON.parse(serializeDiagram(diagram))
}

function runtimeDiagram(input) {
  const parsed = parseSavedDiagramJson(JSON.stringify(input))
  assert.equal(parsed.ok, true)
  return parsed.diagram
}

for (const background of ['transparent', 'white']) {
  const captured = `captured ${background} $\\frac{anchor_{32D}}{1+\\frac{x}{y}}$`
  test(`${background} pending fixture declares exact positions and preserves the complete combined model`, () => {
    const input = inputFixture(captured), before = structuredClone(input)
    const result = buildPendingLayoutFixture(input, captured, layoutShapes, layoutShapeParameters)
    assert.deepEqual(input, before, 'Building the fixture does not mutate the loaded input')
    assert.deepEqual(result, buildPendingLayoutFixture(input, captured, layoutShapes, layoutShapeParameters))
    assertPendingLayoutFixture(result, captured, layoutShapes, layoutShapeParameters)
    const loaded = runtimeDiagram(result)
    assert.deepEqual(loaded.strata, result.diagram.strata, 'Native JSON-load normalization preserves the declared strata exactly')
    assert.deepEqual(loaded.labels, result.diagram.labels, 'Native JSON-load normalization preserves both declared free labels')
    assert.deepEqual(layoutShapes, shapeOrder)
    assert.deepEqual(pendingLayoutPositions, expectedPositions)
    assert.deepEqual(result.diagram.labels, before.diagram.labels)
    assert.deepEqual(result.diagram.strata.at(-1), before.diagram.strata[1])
    assert.deepEqual(result.diagram.strata.slice(0, 15).map(({ id }) => id), shapeOrder.map((shape) => `layout-${shape.replaceAll(' ', '-')}`))
    for (const [index, point] of result.diagram.strata.slice(0, 15).entries()) {
      const shape = shapeOrder[index]
      assert.equal(point.text, index === 0 ? captured : `${shape} $x_j$`)
      assert.equal(point.codim, 2); assert.equal(point.geometricKind, 'point'); assert.equal(point.layer, 0)
      assert.deepEqual(point.position, expectedPositions[index])
      assert.deepEqual(point.style, { ...before.diagram.strata[0].style, shape,
        shapeParameters: layoutShapeParameters[shape] ?? {}, layout: { innerXSep: 3, innerYSep: 1,
          outerXSep: 5, outerYSep: 2, minimumWidth: 35, minimumHeight: 25,
          anchor: shape === 'cylinder' ? 'shape center' : 'base' } })
    }
    result.diagram.strata[0].position.x = 999
    result.diagram.strata[1].style.paint.text.color = '#abcdef'
    result.diagram.strata.at(-1).inlineNodes[0].text = 'changed'
    assert.deepEqual(input, before, 'Output model/style/combined siblings are independently cloned')
    assert.equal(pendingLayoutPositions[0].x, 7)
    assert.equal(result.diagram.strata[2].style.paint.text.color, '#203040')
  })

  for (const exportMode of ['standalone', 'inlineMath']) test(`${background} ${exportMode} retains exact declared positions, point layout and all combined sources`, () => {
    const input = inputFixture(captured), fixture = buildPendingLayoutFixture(input, captured, layoutShapes, layoutShapeParameters)
    const before = structuredClone(fixture), output = generateTikz(runtimeDiagram(fixture), { exportMode })
    for (const [index, point] of fixture.diagram.strata.slice(0, 15).entries()) {
      const { x, y } = expectedPositions[index]
      const node = [...output.matchAll(/\] at \(([^)]+)\) \{([\s\S]*?)\};/g)].find((match) => match[2] === point.text)
      assert.ok(node, `Exact ${point.id} raw source is emitted`)
      const terminal = `at (${node[1]}) {${point.text}};`
      assert.ok(output.includes(`\\coordinate (${node[1]}) at (${x},${y});`), `Exact ${point.id} declared placement is emitted`)
      const at = output.indexOf(terminal), start = output.lastIndexOf('\\node[', at), options = output.slice(start, at)
      for (const value of ['inner xsep=3pt', 'inner ysep=1pt', 'outer xsep=5pt', 'outer ysep=2pt',
        'minimum width=35pt', 'minimum height=25pt', `anchor=${index === 14 ? 'shape center' : 'base'}`]) assert.ok(options.includes(value), `${point.id}: ${value}`)
    }
    for (const label of input.diagram.labels) assert.ok(output.includes(label.text))
    for (const node of input.diagram.strata[1].inlineNodes) assert.ok(output.includes(node.text))
    assert.deepEqual(fixture, before, 'TikZ generation leaves immutable fixture expectations intact')
  })
}

test('synthetic production projection controls isolate the retained pending contour point from every estimated sibling envelope', () => {
  // Retained 0496 supplies only the actual circle box/local .23 point. These
  // fixed controls do not invent native sibling bounds, native CTMs or hits.
  // Sibling emergency literal layouts exercise production pure geometry; the
  // fresh browser must independently measure every current sibling and top hit.
  const captured = 'captured transparent $\\frac{anchor_{32D}}{1+\\frac{x}{y}}$'
  const fixture = buildPendingLayoutFixture(inputFixture(captured), captured, layoutShapes, layoutShapeParameters)
  const diagram = runtimeDiagram(fixture), fit = (value) => resolveSvgCamera(value, 520, 360,
    { fitToView: true, extraPointsForFit: createCoordinateAxesGuide(2).fitPoints })
  const camera = fit(diagram), placement = projectToSvgPoint(camera, diagram.strata[0].position, 360)
  assert.equal(camera.scale, 448 / 33)
  assert.ok(Math.abs(placement.x - 158.1818181818182) < 1e-10)
  assert.ok(Math.abs(placement.y - 167.78181818181818) < 1e-10)
  const circle = svgPointNodeGeometry(diagram.strata[0].style, { width: 298.25390625, height: 14, depth: 3 })
  assert.equal(circle.radius, 152.72695312500002)
  const anchor = circle.solution.placementAnchor, local = { x: 19.088226318359375, y: 151.5294189453125 }
  const target = { x: placement.x - anchor.x + local.x, y: placement.y - anchor.y + local.y }
  for (const [axis, extent] of [['x', 520], ['y', 360]]) {
    assert.ok(target[axis] > 6 && target[axis] < extent - 6)
    assert.ok(placement[axis] - anchor[axis] - circle.radius > 0)
    assert.ok(placement[axis] - anchor[axis] + circle.radius < extent)
  }
  const gap = (point, pointCamera, candidate) => {
    const origin = projectToSvgPoint(pointCamera, point.position, 360), layout = pendingSvgPointNodeLayout(point)
    return Math.max(...[layout.paintedBounds, layout.body.bounds].map((bounds) => Math.max(
      bounds.minX + origin.x - candidate.x, candidate.x - bounds.maxX - origin.x,
      bounds.minY + origin.y - candidate.y, candidate.y - bounds.maxY - origin.y)))
  }
  for (const point of diagram.strata.slice(1, 15)) {
    const origin = projectToSvgPoint(camera, point.position, 360), layout = pendingSvgPointNodeLayout(point)
    for (const bounds of [layout.paintedBounds, layout.body.bounds]) assert.ok(Math.max(
      bounds.minX + origin.x - target.x, target.x - bounds.maxX - origin.x,
      bounds.minY + origin.y - target.y, target.y - bounds.maxY - origin.y) > 6, `${point.id} estimated envelope clears the contour target`)
  }
  const oldGrid = structuredClone(diagram)
  oldGrid.strata.slice(0, 15).forEach((point, index) => { point.position = { x: (index % 4) * 4, y: 13 - Math.floor(index / 4) * 4, z: 0 } })
  const oldCamera = fit(oldGrid), oldPlacement = projectToSvgPoint(oldCamera, oldGrid.strata[0].position, 360)
  const oldTarget = { x: oldPlacement.x - anchor.x + local.x, y: oldPlacement.y - anchor.y + local.y }
  assert.ok(gap(oldGrid.strata[8], oldCamera, oldTarget) < 0, 'Old trapezium estimated envelopes overlap the fixed contour control')
})

test('synthetic pending inline binding resolves its complete declared fixture despite a distinct prior async snapshot', () => {
  const captured = 'captured transparent $\\frac{anchor_{32D}}{1+\\frac{x}{y}}$'
  const input = inputFixture(captured), fixture = buildPendingLayoutFixture(input, captured, layoutShapes, layoutShapeParameters)
  const siblings = { labels: [{ id: 'previous-label', text: 'prior async label' }],
    paths: [{ id: 'export-path', geometricKind: 'curve', kind: 'polyline',
      inlineNodes: [{ id: 'prior-inline', text: 'different async source' }] }], rendered: [{ source: '$initial$' }] }
  const before = structuredClone(fixture), prior = structuredClone(siblings)
  const inline = resolvePendingLayoutInlineNodes(fixture)
  assert.equal(inline, fixture.diagram.strata.find(({ id }) => id === 'export-path').inlineNodes)
  assert.deepEqual(inline, input.diagram.strata[1].inlineNodes)
  assert.notDeepEqual(inline, siblings.paths[0].inlineNodes)
  assert.equal(siblings[0], undefined, 'The historical async snapshot is an object, never the pending path array')
  assert.throws(() => resolvePendingLayoutInlineNodes(siblings), /requires declared strata/)
  assert.deepEqual(fixture, before, 'Resolving immutable expectations does not mutate the fixture')
  assert.deepEqual(siblings, prior, 'The successful async-isolation observation remains untouched')
})

const invalidInlineBindings = [
  ['missing export-path', (fixture) => { fixture.diagram.strata = fixture.diagram.strata.filter(({ id }) => id !== 'export-path') }],
  ['duplicate export-path', (fixture) => { fixture.diagram.strata.push(structuredClone(fixture.diagram.strata.at(-1))) }],
  ['point geometric kind', (fixture) => { fixture.diagram.strata.at(-1).geometricKind = 'point' }],
  ['wrong curve kind', (fixture) => { fixture.diagram.strata.at(-1).kind = 'cubicBezier' }],
  ['omitted inline nodes', (fixture) => { delete fixture.diagram.strata.at(-1).inlineNodes }],
  ['omitted repeated inline node', (fixture) => { fixture.diagram.strata.at(-1).inlineNodes.shift() }],
  ['omitted mixed inline node', (fixture) => { fixture.diagram.strata.at(-1).inlineNodes.pop() }],
  ['changed repeated content', (fixture) => { fixture.diagram.strata.at(-1).inlineNodes[0].text = '$changed$' }],
  ['changed mixed content', (fixture) => { fixture.diagram.strata.at(-1).inlineNodes[1].text = 'changed $content$' }],
  ['changed inline id', (fixture) => { fixture.diagram.strata.at(-1).inlineNodes[0].id = 'replacement-inline' }],
  ['reversed inline order', (fixture) => { fixture.diagram.strata.at(-1).inlineNodes.reverse() }],
  ['changed inline position', (fixture) => { fixture.diagram.strata.at(-1).inlineNodes[0].position.value = .4 }],
  ['changed inline options', (fixture) => { fixture.diagram.strata.at(-1).inlineNodes[1].options.placement = 'above' }],
]
for (const [name, corrupt] of invalidInlineBindings) test(`synthetic pending inline binding rejects ${name}`, () => {
  const captured = 'captured transparent $\\frac{anchor_{32D}}{1+\\frac{x}{y}}$'
  const fixture = buildPendingLayoutFixture(inputFixture(captured), captured, layoutShapes, layoutShapeParameters)
  corrupt(fixture)
  assert.throws(() => resolvePendingLayoutInlineNodes(fixture))
  assert.throws(() => assertPendingLayoutFixture(fixture, captured, layoutShapes, layoutShapeParameters))
})
