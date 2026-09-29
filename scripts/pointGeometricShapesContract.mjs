import assert from 'node:assert/strict'

export const geometricShapeGroup = 'point-node-geometric-shapes'
export const geometricShapeManifest = [
  { shape: 'ellipse', parameters: {} },
  { shape: 'diamond', parameters: { aspect: 1.8 } },
  { shape: 'regular polygon', parameters: { regularPolygonSides: 7, borderRotate: 23 } },
  { shape: 'star', parameters: { starPoints: 7, starPointMode: 'height', starPointHeight: 8, borderRotate: 17 } },
  { shape: 'trapezium', parameters: { trapeziumLeftAngle: 65, trapeziumRightAngle: 75, trapeziumStretches: true, trapeziumStretchesBody: true } },
  { shape: 'isosceles triangle', parameters: { isoscelesTriangleApexAngle: 65, isoscelesTriangleStretches: true, borderUsesIncircle: true, borderRotate: 31 } },
  { shape: 'kite', parameters: { kiteUpperVertexAngle: 100, kiteLowerVertexAngle: 75, borderUsesIncircle: true, borderRotate: 20 } },
  { shape: 'dart', parameters: { dartTipAngle: 55, dartTailAngle: 125 } },
  { shape: 'semicircle', parameters: { borderUsesIncircle: true, borderRotate: 33 } },
  { shape: 'circular sector', parameters: { circularSectorAngle: 110, borderRotate: 17 } },
  { shape: 'cylinder', parameters: { aspect: .55, cylinderUsesCustomFill: true, cylinderEndFill: '#ffcc66', cylinderBodyFill: '#99ddff' } },
].map((entry) => ({ ...entry, slug: entry.shape.replaceAll(' ', '-') }))
export const geometricBodyVariants = [
  { key: 'empty', source: '' }, { key: 'plain', source: 'Wide plain body' },
  { key: 'math', source: '$\\frac{x_1}{y^2}$' }, { key: 'mixed', source: ' 日本 $x_i$ Ω ' },
]
export const geometricShapeScenarios = [
  ...geometricShapeManifest.map(({ slug }) => `point-geometric-${slug}`),
  'point-geometric-native-contours-2d-3d', 'point-geometric-visibility',
  'point-geometric-download-transparent', 'point-geometric-download-white',
]
export function geometricShapeArtifacts(name) {
  return [`${name}.json`, ...(name.startsWith('point-geometric-download-')
    ? [`${name}.svg`, `${name}.png`, `${name}-standalone.json`] : [])]
}
export function assertGeometricShapeEvidence(evidence, name) {
  assert.equal(evidence.scenario, name); assert.equal(evidence.group, geometricShapeGroup); assert.equal(evidence.result, 'passed')
  assert.deepEqual(evidence.pageErrors, [])
  const spec = geometricShapeManifest.find(({ slug }) => name === `point-geometric-${slug}`)
  if (spec) {
    assert.equal(evidence.shape, spec.shape)
    assert.deepEqual(evidence.parameters, spec.parameters)
    assert.equal(evidence.cases.length, geometricBodyVariants.length * 2)
    for (const mode of ['default', 'configured']) for (const body of geometricBodyVariants) {
      const cases = evidence.cases.filter((entry) => entry.mode === mode && entry.body === body.key)
      assert.equal(cases.length, 1, `Required geometric variant ${spec.shape}/${mode}/${body.key}`)
      const entry = cases[0]
      assert.equal(entry.source, body.source); assert.equal(entry.rendered.source, body.source)
      assert.equal(entry.rendered.shape, spec.shape); assert.equal(entry.rendered.state, 'ready')
      assert.ok(entry.rendered.contourLength > 0)
      assert.ok(entry.rendered.bounds.width > 0 && entry.rendered.bounds.height > 0)
      for (const value of Object.values(entry.rendered.bounds)) assert.ok(Number.isFinite(value))
      for (const [key, value] of Object.entries(mode === 'configured' ? spec.parameters : {})) assert.equal(entry.rendered.parameters[key], value)
      assert.equal(entry.modelUnchanged, true)
      assert.equal(entry.rendered.bodyCorners.length, body.source ? 4 : 0)
      assert.ok(entry.rendered.bodyCorners.every(({ x, y, inside }) => Number.isFinite(x) && Number.isFinite(y) && inside === true))
      if (body.key === 'math' || body.key === 'mixed') assert.ok(entry.rendered.math > 0)
      assert.equal(entry.rendered.bodyUpright, true)
    }
    assert.equal(evidence.nativeShapeControl, true)
    assert.equal(evidence.nativeStyle.shape, spec.shape)
    for (const [key, value] of Object.entries(spec.parameters)) assert.equal(evidence.nativeStyle.shapeParameters[key], value)
  } else if (name === 'point-geometric-native-contours-2d-3d') {
    assert.equal(evidence.cases.length, 8)
    for (const dimension of [2, 3]) for (const shape of ['diamond', 'star', 'semicircle', 'dart']) {
      const entry = evidence.cases.find((item) => item.ambientDimension === dimension && item.shape === shape)
      assert.ok(entry); assert.equal(entry.codim, dimension); assert.equal(entry.selected, true)
      assert.equal(entry.trustedDown, true); assert.equal(entry.trustedMove, true); assert.equal(entry.dragged, true)
      assert.equal(entry.undoRestored, true); assert.equal(entry.redoRestored, true)
    }
  } else if (name === 'point-geometric-visibility') {
    for (const key of ['hiddenAbsent', 'lockedUnchanged', 'lockedNotSelected', 'dimmedVisible', 'dimmedOpacity']) assert.equal(evidence[key], true)
  } else {
    assert.ok(name.startsWith('point-geometric-download-'))
    assert.equal(evidence.background, name.slice('point-geometric-download-'.length))
    assert.deepEqual(evidence.shapes, geometricShapeManifest.map(({ shape }) => shape))
    assert.equal(evidence.reopened, true); assert.equal(evidence.immutableSource, true); assert.equal(evidence.immutableParameters, true)
    assert.equal(evidence.separateCylinderPaints, true); assert.equal(evidence.noExternalAssets, true)
    assert.equal(evidence.actualDownload, true)
    assert.equal(evidence.click.error, undefined)
    assert.equal(evidence.click.snapshot.points.length, geometricShapeManifest.length)
    assert.equal(evidence.expected.length, geometricShapeManifest.length)
    for (const [index, spec] of geometricShapeManifest.entries()) {
      const captured = evidence.click.snapshot.points[index], expected = evidence.expected[index]
      assert.equal(captured.id, `geometric-${spec.slug}`); assert.equal(captured.style.shape, spec.shape)
      assert.deepEqual(captured.style.shapeParameters, spec.parameters)
      assert.equal(expected.id, captured.id); assert.equal(expected.source, captured.source); assert.equal(expected.shape, spec.shape)
      assert.equal(expected.rendered.shape, spec.shape); assert.equal(expected.rendered.state, 'ready')
      assert.ok(expected.rendered.math > 0); assert.ok(expected.rendered.contourLength > 0)
      for (const [key, value] of Object.entries(spec.parameters)) assert.equal(expected.rendered.parameters[key], value)
    }
  }
}
