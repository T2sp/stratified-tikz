import assert from 'node:assert/strict'
export const dashCapScenario = 'point-paint-dash-caps'
export const dashCapScales = [.5, 1.5]
export const dashCapCases = [
  { key: 'triangle-square-wide', shape: 'triangle', size: 3, widthPt: 30, lineStyle: 'dashed', phase: 0, exterior: { x: 0, y: -40 }, exact: [{ x: 0, y: -24 }, { x: -6, y: -28 }] },
  { key: 'circle-square-wide', shape: 'circle', size: 3, widthPt: 60, lineStyle: 'dashed', phase: 0, exterior: { x: 9, y: -62 }, exact: [{ x: 9, y: -50 }] },
  { key: 'circle-square-gap', shape: 'circle', size: 30, widthPt: 1, lineStyle: 'solid', pattern: [2, 8], phase: 4, exterior: { x: 0, y: -36 }, gap: true },
  { key: 'star-concave-square', shape: 'star', size: 35, widthPt: 30, lineStyle: 'dashed', phase: 2, exterior: { x: 0, y: -80 } },
  { key: 'square-exact-zero', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [0, 10 / 1.2], phase: 0, exterior: { x: 20, y: 20 }, audit: true },
  { key: 'square-terminal-zero', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [0, 15 / 1.2], phase: 5 / 1.2, exterior: { x: -32, y: 32 }, exact: [{ x: 21, y: -21 }, { x: 22, y: -22 }], audit: true },
  { key: 'square-positive-corner', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [10 / 1.2, 10 / 1.2], phase: 0, exterior: { x: 20, y: 20 }, audit: true },
  { key: 'square-later-zero-phase-10', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [5 / 1.2, 5 / 1.2, 0, 15 / 1.2], phase: 10 / 1.2, exterior: { x: -32, y: 32 }, audit: true },
  { key: 'square-later-zero-phase-0', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [5 / 1.2, 5 / 1.2, 0, 15 / 1.2], phase: 0, exterior: { x: -32, y: 32 }, audit: true },
]
export const dashCapEditFields = ['lineStyle', 'lineCap', 'dashPattern', 'dashPhase', 'restore']
export function dashCapProbeKinds(spec) { return ['paint', 'outside', 'interior', ...(spec.exact ?? []).map((_, i) => `exact-${i}`), ...(spec.gap ? ['gap'] : []), ...(spec.audit ? ['audit-cap', 'audit-outside'] : [])] }
export function dashCapArtifacts() {
  return [`${dashCapScenario}.json`, ...dashCapCases.flatMap((spec) => dashCapScales.flatMap((scale) => {
    const stem = `${dashCapScenario}-${spec.key}-scale-${scale}`
    return [...['json', 'input.svg', 'raster.png', 'screen.png'].map((suffix) => `${stem}.${suffix}`),
      ...dashCapProbeKinds(spec).map((kind) => `${stem}-${kind}.png`),
      ...(spec.audit ? [`${stem}-solid.input.svg`, `${stem}-solid.raster.png`, `${stem}-engine-audit.json`] : []),
      ...(spec.key === 'triangle-square-wide' ? dashCapEditFields.flatMap((field) => ['input.svg', 'raster.png', 'screen.png'].map((suffix) => `${stem}-edit-${field}.${suffix}`)) : [])]
  }))]
}
export function assertDashCapObservation(observation) {
  assert.equal(observation.source, ''); assert.equal(observation.bodyStatus, 'ready')
  assert.equal(observation.resolution, 16); assert.ok(observation.boundaryPixelCount > 0)
  assert.ok(Number.isFinite(observation.rasterRadius) && observation.rasterRadius > 0)
  assert.ok(Number.isFinite(observation.selectionRadius) && observation.selectionRadius + .14 >= observation.rasterRadius)
  assert.equal(observation.boundsEnclosePaint, true)
  assert.equal(observation.declaredBounds.length, 4)
  for (const [i, key] of ['minX', 'minY', 'maxX', 'maxY'].entries()) {
    const raster = observation.rasterBounds[key], declared = observation.declaredBounds[i]
    assert.ok(Number.isFinite(raster) && Number.isFinite(declared))
    assert.ok(i < 2 ? declared <= raster + .14 : declared >= raster - .14, `Paint enclosure ${key}`)
  }
}
export function assertDashCapEvidence(evidence) {
  assert.equal(evidence.scenario, dashCapScenario); assert.equal(evidence.group, 'point-node-paint-import-persistence'); assert.equal(evidence.result, 'passed')
  assert.equal(evidence.cases?.length, dashCapCases.length * dashCapScales.length)
  for (const spec of dashCapCases) for (const scale of dashCapScales) {
    const entries = evidence.cases.filter((entry) => entry.key === spec.key && entry.scale === scale)
    assert.equal(entries.length, 1); const entry = entries[0]
    assert.deepEqual(entry.specification, spec); assert.equal(entry.modelUnchanged, true)
    const observation = entry.observation; assertDashCapObservation(observation)
    assert.equal(observation.strokeWidth, spec.widthPt * 1.2); assert.equal(observation.cap, 'square'); assert.equal(observation.join, 'bevel')
    assert.equal(observation.fill, 'none'); assert.equal(observation.miterLimit, 10)
    assert.equal(observation.contourKind, 'polygon')
    assert.equal(observation.vertexCount, spec.shape === 'circle' ? 256 : spec.shape === 'star' ? 10 : spec.shape === 'square' ? 4 : 3)
    if (spec.shape === 'circle') assert.ok(Math.abs(observation.radius - spec.size * .6 * Math.SQRT2) < 1e-8)
    const expectedPattern = (spec.pattern ?? [3, 3]).map((part) => part * 1.2)
    const actualPattern = observation.pattern.split(/[,\s]+/u).filter(Boolean).map(parseFloat)
    assert.equal(actualPattern.length, expectedPattern.length)
    actualPattern.forEach((part, index) => assert.ok(Math.abs(part - expectedPattern[index]) < 1e-8))
    assert.ok(Math.abs(observation.phase - spec.phase * 1.2) < 1e-8)
    assert.ok(Object.values(observation.ctm).every(Number.isFinite)); assert.ok(Math.abs(observation.ctm.a - scale) < 1e-8)
    if (spec.key === 'triangle-square-wide') {
      assert.ok(Math.abs(observation.rasterBounds.minY + 29.6875) < .14)
      assert.ok(Math.abs(observation.rasterRadius - 30.3804328989) < .14)
      assert.ok(Math.abs(observation.declaredBounds[1] - observation.rasterBounds.minY) < .14)
      assert.deepEqual(entry.edits.map(({ field }) => field), dashCapEditFields)
      for (const edit of entry.edits) {
        assert.equal(edit.sameNode, true); assert.equal(edit.modelChanged, true); assertDashCapObservation(edit.observation)
        const probe = edit.probe, matrix = probe?.transform?.ctm
        assert.ok(probe && matrix && Object.values(matrix).every(Number.isFinite))
        assert.equal(probe.alpha, 255); assert.equal(probe.nativeStrokeContains, true); assert.equal(probe.selectionCleared, true)
        assert.equal(probe.screenshot, `${dashCapScenario}-${spec.key}-scale-${scale}-edit-${edit.field}.screen.png`)
        assert.deepEqual(probe.actions.map((action) => action.alt), [false, true, true, true])
        for (const action of probe.actions) {
          assert.equal(action.trusted, true); assert.equal(action.overlayExcluded, true)
          assert.deepEqual([...action.candidates].sort(), ['control', 'p'])
          if (!action.alt) assert.equal(action.selection?.id, 'p')
          assert.ok(Math.abs(action.screen.x - (matrix.a * probe.local.x + matrix.c * probe.local.y + matrix.e)) < .01)
          assert.ok(Math.abs(action.screen.y - (matrix.b * probe.local.x + matrix.d * probe.local.y + matrix.f)) < .01)
          assert.ok(Math.abs(action.point.x - 450 - probe.local.x) < .01 && Math.abs(action.point.y - 350 - probe.local.y) < .01)
        }
        assert.deepEqual([...new Set(probe.actions.filter((action) => action.alt).map((action) => action.selection?.id))].sort(), ['control', 'p'])
      }
      assert.equal(entry.edits[0].observation.cap, 'butt'); assert.equal(entry.edits[1].observation.cap, 'square')
      assert.notDeepEqual(entry.edits[0].observation.declaredBounds, entry.edits[1].observation.declaredBounds)
      assert.notEqual(entry.edits[1].observation.pattern, entry.edits[2].observation.pattern)
      assert.notEqual(entry.edits[2].observation.phase, entry.edits[3].observation.phase)
    }
    if (spec.audit) assertDashCapEngineAudit(entry, spec, scale)
    if (spec.key === 'circle-square-wide') assert.ok(observation.rasterRadius > 51 && observation.selectionRadius > 51)
    for (const kind of dashCapProbeKinds(spec)) {
      const probe = entry.probes.find((p) => p.kind === kind); assert.ok(probe)
      assert.equal(probe.screenshot, `${dashCapScenario}-${spec.key}-scale-${scale}-${kind}.png`)
      if (kind === 'paint' || kind === 'audit-cap' || kind.startsWith('exact')) { assert.equal(probe.alpha, 255); assert.equal(probe.nativeStrokeContains, true) }
      if (kind.startsWith('exact')) assert.deepEqual(probe.local, spec.exact[Number(kind.slice(6))])
      if (kind === 'outside') { assert.deepEqual(probe.local, spec.exterior); assert.equal(probe.alpha, 0); assert.ok(probe.rasterDistance > 6.2) }
      if (kind === 'gap') { assert.equal(probe.alpha, 0); assert.equal(probe.nativeStrokeContains, false); assert.ok(Math.abs(Math.hypot(probe.local.x, probe.local.y) - observation.radius) < 1e-8) }
      assert.equal(probe.selectionCleared, true)
      assert.deepEqual(probe.actions.map((action) => action.alt), [false, true, true, true])
      const expected = ['outside', 'audit-outside'].includes(kind) ? ['control'] : ['control', 'p'], matrix = probe.transform.ctm
      assert.ok(Object.values(matrix).every(Number.isFinite)); assert.ok(Math.abs(matrix.a - scale) < 1e-8 && Math.abs(matrix.d - scale) < 1e-8)
      for (const action of probe.actions) {
        assert.equal(action.trusted, true); assert.equal(action.overlayExcluded, true)
        assert.deepEqual([...action.candidates].sort(), expected)
        assert.ok(Math.abs(action.screen.x - (matrix.a * probe.local.x + matrix.c * probe.local.y + matrix.e)) < .01)
        assert.ok(Math.abs(action.screen.y - (matrix.b * probe.local.x + matrix.d * probe.local.y + matrix.f)) < .01)
        assert.ok(Math.abs(action.point.x - 450 - probe.local.x) < .01 && Math.abs(action.point.y - 350 - probe.local.y) < .01)
        if (!action.alt && (kind === 'paint' || kind === 'audit-cap' || kind.startsWith('exact') || ['outside', 'audit-outside'].includes(kind))) assert.equal(action.selection?.id, ['outside', 'audit-outside'].includes(kind) ? 'control' : 'p')
      }
      assert.deepEqual([...new Set(probe.actions.filter((a) => a.alt).map((a) => a.selection?.id))].sort(), expected)
    }
  }
}


export const dashCapAuditGrid = Object.freeze({ min: -32, max: 32, step: 2, size: 33, samples: 1089, uncertainty: .14 })
export function assertDashCapEngineAudit(entry, spec, scale) {
  const audit = entry.observation.engineAudit
  assert.ok(audit, 'Required independent native engine audit')
  assert.deepEqual(audit.grid, dashCapAuditGrid)
  assert.equal(audit.modelUnchanged, true)
  assert.equal(audit.samples.length, dashCapAuditGrid.samples)
  assert.equal(audit.solidControl.fill, 'none'); assert.equal(audit.solidControl.pattern, 'none')
  assert.equal(audit.solidControl.strokeWidth, 36); assert.equal(audit.solidControl.join, 'bevel')
  assert.deepEqual(audit.solidControl.vertices, audit.originalVertices)
  assert.equal(audit.originalVertices.length, 4)
  assert.ok(audit.originalVertices.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(Math.abs(x) - 5) < 1e-8 && Math.abs(Math.abs(y) - 5) < 1e-8))
  assert.equal(audit.mismatches.length, 0, 'Native paint plus intentional continuous-gap selection must match picking')
  let hits = 0, misses = 0, uncertain = 0
  for (const [index, sample] of audit.samples.entries()) {
    const local = { x: -32 + index % 33 * 2, y: -32 + Math.floor(index / 33) * 2 }
    assert.deepEqual(sample.local, local, 'Complete ordered bounded grid, no omitted samples')
    assert.deepEqual(sample.point, { x: 450 + local.x, y: 350 + local.y })
    for (const key of ['paintDistance', 'solidDistance']) assert.ok(Number.isFinite(sample[key]) && sample[key] >= 0)
    for (const key of ['paintAlpha', 'solidAlpha']) assert.ok(Number.isInteger(sample[key]) && sample[key] >= 0 && sample[key] <= 255)
    assert.equal(typeof sample.insideContour, 'boolean')
    if (sample.paintAlpha >= 128) assert.equal(sample.paintDistance, 0)
    if (sample.solidAlpha >= 128) assert.equal(sample.solidDistance, 0)
    const distance = Math.min(sample.paintDistance, sample.solidDistance)
    const expected = sample.insideContour || distance < 6 - .14 ? 'hit' : distance > 6 + .14 ? 'miss' : 'uncertain'
    assert.equal(sample.expected, expected)
    assert.equal(typeof sample.nativeStrokeContains, 'boolean'); assert.equal(typeof sample.paintCore, 'boolean')
    if (sample.paintDistance > .14) assert.equal(sample.nativeStrokeContains, false)
    if (sample.paintCore) { assert.equal(sample.paintAlpha, 255); assert.equal(sample.nativeStrokeContains, true) }
    if (expected === 'hit') { hits++; assert.deepEqual(sample.candidates, ['p']) }
    else if (expected === 'miss') { misses++; assert.deepEqual(sample.candidates, []) }
    else uncertain++
  }
  assert.ok(hits > 100 && misses > 50 && uncertain < 200)
  assert.deepEqual(audit.counts, { hits, misses, uncertain })
  for (const kind of ['audit-cap', 'audit-outside']) {
    const probe = entry.probes.find((probe) => probe.kind === kind)
    assert.ok(probe, 'Required actual native audit pointer witness')
    const sample = audit.samples.find((sample) => sample.local.x === probe.local.x && sample.local.y === probe.local.y)
    assert.ok(sample)
    assert.equal(probe.alpha, sample.paintAlpha); assert.equal(probe.nativeStrokeContains, sample.nativeStrokeContains)
    assert.equal(probe.rasterDistance, sample.paintDistance)
    if (kind === 'audit-cap') { assert.equal(sample.paintCore, true); assert.equal(sample.paintAlpha, 255); assert.ok(sample.solidDistance > .3); assert.equal(sample.insideContour, false) }
    else { assert.equal(sample.expected, 'miss'); assert.equal(sample.paintAlpha, 0); assert.ok(sample.paintDistance > 6.14 && sample.solidDistance > 6.14); assert.ok(Math.min(sample.paintDistance, sample.solidDistance) < 8) }
    assert.equal(probe.screenshot, `${dashCapScenario}-${spec.key}-scale-${scale}-${kind}.png`)
  }
}
