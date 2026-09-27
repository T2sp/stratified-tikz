import assert from 'node:assert/strict'

export const polygonJoinScenario = 'point-paint-polygon-joins'
export const polygonJoinCases = [
  { key: 'triangle-miter-wide', shape: 'triangle', join: 'miter', size: 3, widthPt: 30, exact: { x: 0, y: 28 }, edge: 'bottom' },
  { key: 'triangle-bevel-wide', shape: 'triangle', join: 'bevel', size: 3, widthPt: 30, exact: { x: 0, y: -24 }, edge: 'top' },
  { key: 'star-miter-wide', shape: 'star', join: 'miter', size: 35, widthPt: 30, edge: 'concave' },
  { key: 'star-bevel-wide', shape: 'star', join: 'bevel', size: 35, widthPt: 30, edge: 'concave' },
  { key: 'triangle-miter-thin', shape: 'triangle', join: 'miter', size: 3, widthPt: .4, edge: 'top' },
  { key: 'triangle-round-wide', shape: 'triangle', join: 'round', size: 3, widthPt: 30, edge: 'top' },
]
export const polygonJoinScales = [.5, 1.5]
export function polygonJoinProbeKinds(specification) {
  return ['paint', 'within', 'outside', 'interior', ...(specification.exact ? ['exact'] : []),
    ...(specification.key === 'triangle-miter-wide' ? ['miter-tip'] : []),
    ...(specification.key === 'triangle-bevel-wide' ? ['bevel-edge'] : [])]
}
export function polygonJoinArtifacts() {
  return [`${polygonJoinScenario}.json`, ...polygonJoinCases.flatMap((specification) => polygonJoinScales.flatMap((scale) => {
    const stem = `${polygonJoinScenario}-${specification.key}-scale-${scale}`
    return [...['json', 'input.svg', 'raster.png', 'screen.png'].map((suffix) => `${stem}.${suffix}`),
      ...polygonJoinProbeKinds(specification).map((kind) => `${stem}-${kind}.png`)]
  }))]
}

/** Fail closed on omitted exact misses, raster measurements, transformed native
 * clicks, and both candidates in the overlapping positive cycling control. */
export function assertPolygonJoinEvidence(evidence) {
  assert.equal(evidence.scenario, polygonJoinScenario)
  assert.equal(evidence.group, 'point-node-paint-import-persistence')
  assert.equal(evidence.result, 'passed')
  assert.equal(evidence.cases?.length, polygonJoinCases.length * polygonJoinScales.length)
  for (const specification of polygonJoinCases) for (const scale of polygonJoinScales) {
    const matches = evidence.cases.filter((entry) => entry.key === specification.key && entry.scale === scale)
    assert.equal(matches.length, 1, `Unique polygon join case ${specification.key} at ${scale}`)
    const entry = matches[0]
    assert.deepEqual(entry.specification, specification)
    assert.equal(entry.observation.source, '')
    assert.equal(entry.observation.bodyStatus, 'ready')
    assert.equal(entry.observation.vertices?.length, specification.shape === 'star' ? 10 : 3)
    assert.ok(entry.observation.vertices.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)))
    if (specification.shape === 'star') {
      const vertices = entry.observation.vertices
      const turns = vertices.map((vertex, index) => {
        const previous = vertices[(index + vertices.length - 1) % vertices.length]
        const next = vertices[(index + 1) % vertices.length]
        return (vertex.x - previous.x) * (next.y - vertex.y) - (vertex.y - previous.y) * (next.x - vertex.x)
      })
      assert.ok(turns.every((turn) => Number.isFinite(turn) && Math.abs(turn) > 1e-8))
      assert.equal(turns.filter((turn) => turn > 0).length, 5)
      assert.equal(turns.filter((turn) => turn < 0).length, 5)
      assert.ok(turns.every((turn, index) => Math.sign(turn) !== Math.sign(turns[(index + 1) % turns.length])),
        'Native star vertices must alternate convex and concave local turns')
    }
    assert.equal(entry.observation.strokeWidth, specification.widthPt * 1.2)
    assert.equal(entry.observation.fill, 'none')
    assert.equal(entry.observation.join, specification.join)
    assert.equal(entry.observation.miterLimit, 10)
    assert.equal(entry.observation.resolution, 16)
    assert.ok(entry.observation.boundaryPixelCount > 0)
    assert.equal(entry.observation.boundsMatch, true)
    assert.ok(Object.values(entry.observation.rasterBounds).every(Number.isFinite))
    assert.equal(entry.observation.declaredBounds?.length, 4)
    for (const [index, key] of ['minX', 'minY', 'maxX', 'maxY'].entries()) {
      assert.ok(Math.abs(entry.observation.rasterBounds[key] - entry.observation.declaredBounds[index]) < .14)
    }
    assert.ok(Object.values(entry.observation.ctm).every(Number.isFinite))
    assert.ok(Math.abs(entry.observation.ctm.a - scale) < 1e-8)
    for (const kind of polygonJoinProbeKinds(specification)) {
      const probe = entry.probes.find((probe) => probe.kind === kind)
      assert.ok(probe, `Required ${kind} probe`)
      assert.equal(probe.screenshot, `${polygonJoinScenario}-${specification.key}-scale-${scale}-${kind}.png`)
      if (kind === 'within') assert.ok(probe.rasterDistance > 5.3 && probe.rasterDistance < 5.7)
      if (kind === 'outside') assert.ok(probe.rasterDistance > 6.3 && probe.rasterDistance < 6.7)
      if (kind === 'exact') {
        assert.deepEqual(probe.local, specification.exact)
        const expectedDistance = specification.join === 'miter' ? 7.4544155877 : 8.5455844123
        assert.ok(Math.abs(probe.rasterDistance - expectedDistance) < .14)
        const paintEdge = specification.join === 'miter' ? entry.observation.rasterBounds.maxY : entry.observation.rasterBounds.minY
        assert.ok(Math.abs(paintEdge - (specification.join === 'miter' ? 20.5455844123 : -15.4544155877)) < .07)
      }
      if (kind === 'miter-tip') assert.deepEqual(probe.local, { x: 0, y: -40.8 })
      if (kind === 'bevel-edge') assert.deepEqual(probe.local, { x: 10, y: -14 })
      if (['paint', 'miter-tip', 'bevel-edge'].includes(kind)) {
        assert.equal(probe.nativeStrokeContains, true)
        assert.equal(probe.rasterDistance, 0)
      }
      assert.equal(probe.selectionCleared, true)
      assert.deepEqual(probe.actions.map((action) => action.alt), [false, true, true, true], 'Ordinary plus three Alt observations')
      const matrix = probe.transform?.ctm
      assert.ok(matrix && Object.values(matrix).every(Number.isFinite))
      assert.ok(Math.abs(matrix.a - scale) < 1e-8 && Math.abs(matrix.d - scale) < 1e-8)
      const expectedCandidates = ['outside', 'exact'].includes(kind) ? ['control'] : ['control', 'p']
      for (const action of probe.actions) {
        assert.equal(action.trusted, true)
        assert.equal(action.overlayExcluded, true)
        assert.deepEqual([...action.candidates].sort(), expectedCandidates)
        if (!action.alt && ['paint', 'miter-tip', 'bevel-edge'].includes(kind)) assert.equal(action.selection?.id, 'p')
        if (!action.alt && ['outside', 'exact'].includes(kind)) assert.equal(action.selection?.id, 'control')
        assert.ok(Number.isFinite(action.screen.x) && Number.isFinite(action.screen.y))
        assert.ok(Math.abs(action.screen.x - (matrix.a * probe.local.x + matrix.c * probe.local.y + matrix.e)) < .01)
        assert.ok(Math.abs(action.screen.y - (matrix.b * probe.local.x + matrix.d * probe.local.y + matrix.f)) < .01)
        assert.ok(Math.abs(action.point.x - 450 - probe.local.x) < .01 && Math.abs(action.point.y - 350 - probe.local.y) < .01)
      }
      const cycled = new Set(probe.actions.filter((action) => action.alt).map((action) => action.selection?.id))
      assert.deepEqual([...cycled].sort(), expectedCandidates, 'Alt cycling must expose the exact candidate set')
    }
    assert.equal(entry.modelUnchanged, true)
  }
}
