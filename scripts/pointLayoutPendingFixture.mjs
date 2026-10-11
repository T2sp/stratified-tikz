import assert from 'node:assert/strict'

// Declared before JSON load, never adjusted in response to picking. The held
// circle needs a full literal-sized footprint to the left of the combined grid.
// The incircle triangle and semicircle use the far columns, with the compact
// dart in the near column. Shape/id/list order, labels and inline path stay unchanged.
export const pendingLayoutPositions = [
  [7, 6.5],
  [19, 13], [23, 13], [27, 13], [31, 13],
  [19, 9], [23, 9], [27, 9], [31, 9],
  [31, 5], [23, 5], [19, 5], [27, 5],
  [19, 1], [23, 1],
].map(([x, y]) => Object.freeze({ x, y, z: 0 }))
Object.freeze(pendingLayoutPositions)

export function buildPendingLayoutFixture(input, captured, shapes, shapeParameters) {
  assert.equal(input.diagram.ambientDimension, 2)
  assert.equal(shapes.length, pendingLayoutPositions.length)
  assert.equal(shapes[0], 'circle')
  const fixture = structuredClone(input), template = fixture.diagram.strata[0]
  const siblings = fixture.diagram.strata.slice(1)
  fixture.diagram.strata = [...shapes.map((shape, index) => ({
    ...structuredClone(template), id: `layout-${shape.replaceAll(' ', '-')}`,
    text: index === 0 ? captured : `${shape} $x_j$`, position: { ...pendingLayoutPositions[index] },
    style: { ...structuredClone(template.style), shape,
      shapeParameters: structuredClone(shapeParameters[shape] ?? {}),
      layout: { innerXSep: 3, innerYSep: 1, outerXSep: 5, outerYSep: 2,
        minimumWidth: 35, minimumHeight: 25, anchor: shape === 'cylinder' ? 'shape center' : 'base' } },
  })), ...siblings]
  return fixture
}

export function assertPendingLayoutFixture(input, captured, shapes, shapeParameters) {
  assert.equal(input.diagram.ambientDimension, 2)
  const points = input.diagram.strata.filter(({ geometricKind }) => geometricKind === 'point')
  assert.equal(points.length, pendingLayoutPositions.length)
  assert.equal(shapes.length, pendingLayoutPositions.length)
  for (const [index, point] of points.entries()) {
    const shape = shapes[index]
    assert.equal(input.diagram.strata[index], point, 'All fifteen captured points precede the combined path')
    assert.equal(point.id, `layout-${shape.replaceAll(' ', '-')}`)
    assert.equal(point.codim, 2); assert.equal(point.style.shape, shape)
    assert.equal(point.text, index === 0 ? captured : `${shape} $x_j$`)
    assert.deepEqual(point.position, pendingLayoutPositions[index])
    assert.deepEqual(point.style.shapeParameters, shapeParameters[shape] ?? {})
    assert.deepEqual(point.style.layout, { innerXSep: 3, innerYSep: 1, outerXSep: 5, outerYSep: 2,
      minimumWidth: 35, minimumHeight: 25, anchor: shape === 'cylinder' ? 'shape center' : 'base' })
  }
  assert.equal(input.diagram.labels.length, 2)
  assert.equal(input.diagram.strata.length, points.length + 1)
  const path = input.diagram.strata.at(-1)
  assert.equal(path.id, 'export-path'); assert.equal(path.geometricKind, 'curve')
  assert.equal(path.inlineNodes.length, 2)
}
