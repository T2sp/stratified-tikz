import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
export const rawDashCapSquarePoints = '5.000000000000001,-5 -5,-5.000000000000001 -5.000000000000002,5 5,5.000000000000002'
export const dashCapScenario = 'point-paint-dash-caps'
export const dashCapScales = [.5, 1.5]
export const dashCapCases = [
  { key: 'triangle-square-wide', shape: 'triangle', size: 3, widthPt: 30, lineStyle: 'dashed', phase: 0, exterior: { x: 0, y: -40 }, exact: [{ x: 0, y: -24 }, { x: -6, y: -28 }] },
  { key: 'circle-square-wide', shape: 'circle', size: 3, widthPt: 60, lineStyle: 'dashed', phase: 0, exterior: { x: 9, y: -62 }, exact: [{ x: 9, y: -50 }] },
  { key: 'circle-square-gap', shape: 'circle', size: 30, widthPt: 1, lineStyle: 'solid', pattern: [2, 8], phase: 4, exterior: { x: 0, y: -36 }, gap: true },
  { key: 'star-concave-square', shape: 'star', size: 35, widthPt: 30, lineStyle: 'dashed', phase: 2, exterior: { x: 0, y: -80 } },
  { key: 'square-exact-zero', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [0, 10 / 1.2], phase: 0, exterior: { x: -22, y: -30 }, exact: [{ x: -22, y: -22 }, { x: 20, y: 20 }], audit: true },
  { key: 'square-terminal-zero', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [0, 15 / 1.2], phase: 5 / 1.2, exterior: { x: -32, y: 32 }, exact: [{ x: 21, y: -21 }, { x: 22, y: -22 }, { x: -22, y: -22 }, { x: 22, y: -18 }], exactMissIndices: [0, 1, 3], audit: true },
  { key: 'square-positive-corner', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [10 / 1.2, 10 / 1.2], phase: 0, exterior: { x: -22, y: -30 }, exact: [{ x: 20, y: 20 }, { x: 16, y: -22 }, { x: 22, y: -22 }], audit: true },
  { key: 'square-later-zero-phase-10', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [5 / 1.2, 5 / 1.2, 0, 15 / 1.2], phase: 10 / 1.2, exterior: { x: -32, y: 32 }, audit: true },
  { key: 'square-later-zero-phase-0', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [5 / 1.2, 5 / 1.2, 0, 15 / 1.2], phase: 0, exterior: { x: -32, y: 32 }, audit: true },
  { key: 'square-zero-off', shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [10 / 1.2, 0], phase: 0, exterior: { x: -22, y: -30 }, exact: [{ x: -22, y: -22 }, { x: 16, y: -22 }], exactProximityIndices: [1], audit: true, livePaint: true },
  { key: 'square-positive-before-corner', exactMissIndices: [1], shape: 'square', size: 5.892556509887896, widthPt: 30, lineStyle: 'solid', pattern: [10 / 1.2, 10 / 1.2], phase: .25 / 1.2, exterior: { x: -22, y: -30 }, exact: [{ x: -22, y: -22 }, { x: 16, y: -22 }], audit: true, livePaint: true },
]
export const triangleDashPhaseNegatives = [{ x: -6, y: -34 }, { x: 0, y: -32 }]
export const dashCapEditFields = ['lineStyle', 'lineCap', 'dashPattern', 'dashPhase', 'restore']
// Retain the historical exact-N artifacts while recording the witnesses' corrected roles.
export function dashCapProbeIsMiss(spec, kind) { return ['outside', 'audit-outside'].includes(kind) || kind.startsWith('phase-outside-') || (kind.startsWith('exact-') && (spec.exactMissIndices ?? []).includes(Number(kind.slice(6)))) }
// A point within the picking tolerance remains reachable through Alt cycling,
// but an ordinary SVG click on its unpainted gap targets the painted control.
export function dashCapProbeIsProximityHit(spec, kind) { return kind.startsWith('exact-') && (spec.exactProximityIndices ?? []).includes(Number(kind.slice(6))) }
export function dashCapProbeKinds(spec) { return ['paint', 'outside', 'interior', ...(spec.exact ?? []).map((_, i) => `exact-${i}`), ...(spec.gap ? ['gap'] : []), ...(spec.audit ? ['audit-cap', 'audit-outside'] : [])] }
export function dashCapArtifacts() {
  return [`${dashCapScenario}.json`, ...dashCapCases.flatMap((spec) => dashCapScales.flatMap((scale) => {
    const stem = `${dashCapScenario}-${spec.key}-scale-${scale}`
    return [...['json', 'input.svg', 'raster.png', 'screen.png'].map((suffix) => `${stem}.${suffix}`),
      ...dashCapProbeKinds(spec).map((kind) => `${stem}-${kind}.png`),
      ...(spec.livePaint ? [`${stem}-live.screen.png`, `${stem}-live-zoom.screen.png`] : []),
      ...(spec.audit ? [`${stem}-solid.input.svg`, `${stem}-solid.raster.png`, `${stem}-engine-audit.json`] : []),
      ...(spec.key === 'triangle-square-wide' ? triangleDashPhaseNegatives.map((_, index) => `${stem}-edit-dashPhase-outside-${index}.screen.png`) : []),
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
    assertDashCapEntry(entry, spec, scale)
  }
}

export function assertDashCapEntry(entry, spec, scale) {
  assert.deepEqual(entry.specification, spec); assert.equal(entry.modelUnchanged, true); assert.equal(entry.result, 'passed')
  assert.deepEqual(entry.probes.map(({ kind }) => kind).sort(), dashCapProbeKinds(spec).sort())
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
    assertTrianglePhaseNegativeProbes(entry.edits.find((edit) => edit.field === 'dashPhase'), scale)
    assert.equal(entry.edits[0].observation.cap, 'butt'); assert.equal(entry.edits[1].observation.cap, 'square')
    assert.notDeepEqual(entry.edits[0].observation.declaredBounds, entry.edits[1].observation.declaredBounds)
    assert.notEqual(entry.edits[1].observation.pattern, entry.edits[2].observation.pattern)
    assert.notEqual(entry.edits[2].observation.phase, entry.edits[3].observation.phase)
  }
  if (spec.livePaint) assertDashCapLivePaint(entry, spec, scale)
  if (spec.audit) assertDashCapEngineAudit(entry, spec, scale)
  if (spec.key === 'circle-square-wide') assert.ok(observation.rasterRadius > 51 && observation.selectionRadius > 51)
  for (const kind of dashCapProbeKinds(spec)) {
    const probe = entry.probes.find((p) => p.kind === kind); assert.ok(probe)
    assert.equal(probe.screenshot, `${dashCapScenario}-${spec.key}-scale-${scale}-${kind}.png`)
    const miss = dashCapProbeIsMiss(spec, kind), proximity = dashCapProbeIsProximityHit(spec, kind)
    if (!spec.livePaint && !miss && (kind === 'paint' || kind === 'audit-cap' || kind.startsWith('exact'))) { assert.equal(probe.alpha, 255); assertDashCapPaintContainment(probe, entry) }
    if (kind.startsWith('exact')) assert.deepEqual(probe.local, spec.exact[Number(kind.slice(6))])
    if (kind === 'outside') assert.deepEqual(probe.local, spec.exterior)
    if (!spec.livePaint && miss) { assert.equal(probe.alpha, 0); assert.equal(probe.nativeStrokeContains, false); assert.ok(probe.rasterDistance > 6.14); if (spec.audit) assert.ok(probe.solidDistance > 6.14) }
    if (kind === 'gap') { assert.equal(probe.alpha, 0); assert.equal(probe.nativeStrokeContains, false); assert.ok(Math.abs(Math.hypot(probe.local.x, probe.local.y) - observation.radius) < 1e-8) }
    if (spec.livePaint) assertLiveProbe(probe, entry, miss)
    if (proximity) {
      assert.equal(spec.livePaint, true); assert.equal(miss, false)
      assert.equal(probe.nativeStrokeContains, false); assert.equal(probe.live.insideContour, false)
      assert.equal(probe.live.expected, 'hit'); assert.equal(probe.live.paintCore, false)
      assert.ok(probe.live.paintDistance > .14 && probe.live.paintDistance < 6 - .14, 'Unpainted proximity witness remains within picking tolerance')
      for (const pixel of [probe.live, probe.liveCapture.samples[0]]) assert.ok(pixel.rgba[3] === 255 && pixel.rgba.slice(0, 3).every((channel) => channel >= 230), 'Proximity witness is background in connected paint')
    }
    assert.equal(probe.selectionCleared, true)
    assert.deepEqual(probe.actions.map((action) => action.alt), [false, true, true, true])
    const expected = miss ? ['control'] : ['control', 'p'], matrix = probe.transform.ctm
    assert.ok(Object.values(matrix).every(Number.isFinite)); assert.ok(Math.abs(matrix.a - scale) < 1e-8 && Math.abs(matrix.d - scale) < 1e-8)
    for (const action of probe.actions) {
      assert.equal(action.trusted, true); assert.equal(action.overlayExcluded, true)
      assert.deepEqual([...action.candidates].sort(), expected)
      assert.ok(Math.abs(action.screen.x - (matrix.a * probe.local.x + matrix.c * probe.local.y + matrix.e)) < .01)
      assert.ok(Math.abs(action.screen.y - (matrix.b * probe.local.x + matrix.d * probe.local.y + matrix.f)) < .01)
      assert.ok(Math.abs(action.point.x - 450 - probe.local.x) < .01 && Math.abs(action.point.y - 350 - probe.local.y) < .01)
      if (!action.alt && (kind === 'paint' || kind === 'audit-cap' || kind.startsWith('exact') || ['outside', 'audit-outside'].includes(kind))) assert.equal(action.selection?.id, miss || proximity ? 'control' : 'p')
    }
    assert.deepEqual([...new Set(probe.actions.filter((a) => a.alt).map((a) => a.selection?.id))].sort(), expected)
  }
}


export const dashCapAuditGrid = Object.freeze({ min: -32, max: 32, step: 2, size: 33, samples: 1089, uncertainty: .14 })
export function assertDashCapEngineAudit(entry, spec, scale) {
  const audit = entry.observation.engineAudit
  assert.ok(audit, 'Required independent native engine audit')
  assert.deepEqual(audit.grid, dashCapAuditGrid)
  assert.equal(audit.modelUnchanged, true)
  assert.equal(audit.model.id, 'p'); assert.equal(audit.model.geometricKind, 'point'); assert.equal(audit.model.codim, 2); assert.equal(audit.model.text, '')
  assert.equal(audit.model.style.shape, spec.shape); assert.equal(audit.model.style.size, spec.size)
  assert.deepEqual(audit.model.style.paint, { text: { color: '#000000', opacity: 1 }, fill: { enabled: false, color: '#000000', opacity: 1 },
    stroke: { enabled: true, color: '#000000', opacity: 1, width: spec.widthPt, lineStyle: spec.lineStyle, dashPattern: spec.pattern, dashPhase: spec.phase, lineCap: 'rect', lineJoin: 'bevel' } })
  assert.equal(audit.rawPoints, rawDashCapSquarePoints)
  assert.ok(Math.abs(audit.pathLength - 40) < 1e-8)
  assert.deepEqual(audit.raster, { resolution: 16, half: 90, side: 2880, uncertainty: .14, alphaThreshold: 128 })
  assert.equal(typeof audit.browser.version, 'string'); assert.ok(audit.browser.version.length > 0); assert.notEqual(audit.browser.version, 'unavailable')
  assert.equal(typeof audit.browser.userAgent, 'string'); assert.ok(audit.browser.userAgent.length > 0)
  assert.equal(audit.samples.length, dashCapAuditGrid.samples)
  assert.equal(audit.solidControl.fill, 'none'); assert.equal(audit.solidControl.pattern, 'none')
  assert.equal(audit.solidControl.strokeWidth, 36); assert.equal(audit.solidControl.join, 'bevel')
  assert.deepEqual(audit.solidControl.vertices, audit.originalVertices)
  assert.equal(audit.originalVertices.length, 4)
  assert.ok(audit.originalVertices.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(Math.abs(x) - 5) < 1e-8 && Math.abs(Math.abs(y) - 5) < 1e-8))
  if (!spec.livePaint) assert.equal(audit.mismatches.length, 0, 'Native paint plus intentional continuous-gap selection must match picking')
  else assert.deepEqual(audit.mismatches, audit.samples.filter((sample) => sample.expected !== 'uncertain' && (sample.candidates.includes('p') !== (sample.expected === 'hit') || sample.candidates.some((id) => id !== 'p'))).map(({ local, expected, candidates }) => ({ local, expected, candidates })), 'Clone disagreement stays visible')
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
    if (sample.paintCore) { assert.equal(sample.paintAlpha, 255); assertDashCapPaintContainment(sample, entry) }
    const interactionExpected = spec.livePaint ? entry.observation.livePaint.interaction.samples[index].expected : expected
    if (interactionExpected === 'hit') assert.deepEqual(sample.candidates, ['p'])
    else if (interactionExpected === 'miss') assert.deepEqual(sample.candidates, [])
    if (expected === 'hit') hits++
    else if (expected === 'miss') misses++
    else uncertain++
  }
  assert.ok(hits > 100 && misses > 50 && uncertain < 200)
  assert.deepEqual(audit.counts, { hits, misses, uncertain })
  for (const [index, local] of (spec.exact ?? []).entries()) {
    const probe = entry.probes.find((probe) => probe.kind === `exact-${index}`)
    assert.ok(probe); assert.ok(Number.isFinite(probe.solidDistance) && probe.solidDistance > 6.14)
    const sample = audit.samples.find((sample) => sample.local.x === local.x && sample.local.y === local.y)
    if (sample) {
      assert.equal(sample.insideContour, false); assert.ok(sample.solidDistance > 6.14)
      assert.equal(probe.rasterDistance, sample.paintDistance); assert.equal(probe.solidDistance, sample.solidDistance)
      assert.equal(probe.alpha, sample.paintAlpha); assert.equal(probe.nativeStrokeContains, sample.nativeStrokeContains)
      if (spec.livePaint) { assert.equal(probe.live.expected, dashCapProbeIsMiss(spec, probe.kind) ? 'miss' : 'hit') }
      else if (dashCapProbeIsMiss(spec, probe.kind)) { assert.equal(sample.expected, 'miss'); assert.deepEqual(sample.candidates, []) }
      else { assert.equal(sample.paintCore, true); assert.equal(sample.paintAlpha, 255); assertDashCapPaintContainment(sample, entry); assert.deepEqual(sample.candidates, ['p']) }
    }
  }
  if (['square-exact-zero', 'square-positive-corner', 'square-zero-off', 'square-positive-before-corner'].includes(spec.key)) {
    const sample = audit.samples.find((sample) => sample.local.x === spec.exterior.x && sample.local.y === spec.exterior.y)
    assert.ok(sample); assert.equal(sample.paintAlpha, 0); assert.equal(sample.nativeStrokeContains, false); assert.equal(sample.insideContour, false)
    assert.ok(sample.paintDistance > 6.2 && sample.paintDistance < 8 && sample.solidDistance > 6.14); assert.deepEqual(sample.candidates, [])
    const probe = entry.probes.find((probe) => probe.kind === 'outside')
    assert.ok(probe); assert.equal(probe.rasterDistance, sample.paintDistance); assert.equal(probe.solidDistance, sample.solidDistance)
  }
  for (const kind of ['audit-cap', 'audit-outside']) {
    const probe = entry.probes.find((probe) => probe.kind === kind)
    assert.ok(probe, 'Required actual native audit pointer witness')
    const sample = audit.samples.find((sample) => sample.local.x === probe.local.x && sample.local.y === probe.local.y)
    assert.ok(sample)
    assert.equal(probe.alpha, sample.paintAlpha); assert.equal(probe.nativeStrokeContains, sample.nativeStrokeContains)
    assert.equal(probe.rasterDistance, sample.paintDistance); assert.equal(probe.solidDistance, sample.solidDistance)
    if (spec.livePaint) { assert.equal(probe.live.expected, kind === 'audit-cap' ? 'hit' : 'miss'); if (kind === 'audit-cap') assert.equal(probe.live.paintCore, true) }
    else if (kind === 'audit-cap') { assert.equal(sample.paintCore, true); assert.equal(sample.paintAlpha, 255); assert.ok(sample.solidDistance > .3); assert.equal(sample.insideContour, false) }
    else { assert.equal(sample.expected, 'miss'); assert.equal(sample.paintAlpha, 0); assert.ok(sample.paintDistance > 6.14 && sample.solidDistance > 6.14); assert.ok(Math.min(sample.paintDistance, sample.solidDistance) < 8) }
    assert.equal(probe.screenshot, `${dashCapScenario}-${spec.key}-scale-${scale}-${kind}.png`)
  }
}

function assertDashCapPaintContainment(sample, entry) {
  assert.equal(typeof sample.nativeStrokeContains, 'boolean')
  if (sample.nativeStrokeContains) return
  assert.ok(entry.specification.livePaint, 'Unexpected native containment exclusion')
  assert.ok(sample.local.x > 5 && sample.local.y < -5 && sample.local.x - sample.local.y > 28, 'Exclusion is in the retained seam region')
  const pixel = entry.observation.livePaint.captures[1].samples.find((pixel) => pixel.local.x === sample.local.x && pixel.local.y === sample.local.y)
  assert.ok(pixel, 'Retain connected App observation separately from cloned paint')
  assert.ok(pixel.rgba.slice(0, 3).every((channel) => channel >= 230), 'Connected App background disproves this cloned opaque seam')
}

function assertLiveProbe(probe, entry, miss) {
  const live = entry.observation.livePaint, sample = live.interaction.samples.find((sample) => sample.local.x === probe.local.x && sample.local.y === probe.local.y)
  assert.ok(sample); assert.deepEqual(probe.live, Object.fromEntries(Object.entries(sample).filter(([key]) => key !== 'candidates')))
  assert.equal(sample.expected, miss ? 'miss' : 'hit', 'Live paint, solid neighborhood and interior determine the independent interaction role')
  if (['paint', 'audit-cap'].includes(probe.kind)) assert.equal(sample.paintCore, true)
  const capture = probe.liveCapture, reference = live.captures[0]
  assert.ok(capture, 'Action has a source-bound pre-click connected screenshot')
  assertConnectedIsolationCapture(capture)
  assert.equal(capture.source, reference.source); assert.equal(capture.sourceSha256, reference.sourceSha256)
  assert.deepEqual(capture.stroke, reference.stroke); assert.deepEqual(capture.ctm, probe.transform.ctm)
  assert.equal(capture.selection, null); assert.equal(capture.screenshot, probe.screenshot)
  assert.match(capture.sha256, /^[a-f0-9]{64}$/u); assert.ok(capture.bytes > 24)
  assert.deepEqual(capture.viewport, { width: capture.width, height: capture.height })
  assert.deepEqual(capture.samples, capture.pixelDistances.samples)
  assert.equal(capture.samples.length, 1); assert.deepEqual(capture.samples[0].local, probe.local)
  if (['paint', 'audit-cap', 'exact-0'].includes(probe.kind)) assert.deepEqual(capture.samples[0].rgba, [0, 0, 0, 255])
}

export function assertDashCapLivePaint(entry, spec, scale) {
  const live = entry.observation.livePaint, audit = entry.observation.engineAudit
  assert.ok(live); assert.equal(live.modelUnchanged, true); assert.equal(live.restored, true)
  assert.deepEqual(live.restoredCtm, entry.observation.ctm)
  assert.deepEqual(live.captures.map((capture) => capture.zoom), [false, true])
  assert.deepEqual(live.disagreements, audit.samples.filter((sample) => sample.paintCore && !sample.nativeStrokeContains).map(({ local }) => local))
  for (const capture of live.captures) {
    assertConnectedIsolationCapture(capture)
    assert.equal(capture.screenshot, `${dashCapScenario}-${spec.key}-scale-${scale}-${capture.zoom ? 'live-zoom' : 'live'}.screen.png`)
    assert.equal(capture.method, 'actual App screenshot PNG; no SVG reconstruction')
    assert.ok(Number.isInteger(capture.bytes) && capture.bytes > 24); assert.match(capture.sha256, /^[a-f0-9]{64}$/u)
    assert.equal(capture.status, 'inspected'); assert.deepEqual(capture.afterCtm, capture.ctm)
    assert.equal(capture.sourceUnchanged, true); assert.equal(capture.rawPoints, audit.rawPoints)
    assert.deepEqual(capture.vertices, audit.originalVertices); assert.equal(capture.pathLength, audit.pathLength)
    assert.equal(capture.selection, null); assert.equal(capture.overlays, 0)
    assert.deepEqual(capture.stroke, { width: 36, pattern: entry.observation.pattern, phase: spec.phase * 1.2, cap: 'square', join: 'bevel', fill: 'none', miterLimit: 10, color: 'rgb(0, 0, 0)', opacity: 1 })
    assert.equal(typeof capture.source, 'string'); assert.ok(capture.source.includes(rawDashCapSquarePoints))
    assert.equal(capture.source, live.captures[0].source)
    assert.deepEqual(capture.samples, capture.pixelDistances.samples)
    assert.equal(capture.sourceSha256, createHash('sha256').update(capture.source).digest('hex'))
    assert.deepEqual(capture.viewport, { width: capture.width, height: capture.height })
    assert.equal(capture.calibration.threshold, 127); assert.equal(capture.calibration.pixelCenters, true)
    assert.ok(capture.boundaryPixelCount > 0); assert.deepEqual(capture.calibration.positiveControl.rgba, [0, 0, 0, 255])
    assert.ok(capture.calibration.backgroundControl.rgba.slice(0, 3).every((channel) => channel >= 230))
    const matrix = capture.ctm
    assert.ok(Object.values(matrix).every(Number.isFinite)); assert.equal(matrix.a, capture.zoom ? 16 : scale); assert.equal(matrix.d, matrix.a); assert.equal(matrix.b, 0); assert.equal(matrix.c, 0)
    assert.ok(Number.isInteger(capture.width) && capture.width >= 1088 && Number.isInteger(capture.height) && capture.height >= 1088)
    assert.equal(capture.samples.length, dashCapAuditGrid.samples)
    const background = capture.samples[0].rgba
    assert.equal(background[3], 255); assert.ok(background.slice(0, 3).every((channel) => channel >= 230))
    for (const [index, pixel] of capture.samples.entries()) {
      const sample = audit.samples[index]
      assert.deepEqual(pixel.local, sample.local)
      assert.deepEqual(pixel.screen, { x: matrix.a * sample.local.x + matrix.c * sample.local.y + matrix.e, y: matrix.b * sample.local.x + matrix.d * sample.local.y + matrix.f })
      assert.deepEqual(pixel.pixel, { x: Math.floor(pixel.screen.x), y: Math.floor(pixel.screen.y) })
      assert.ok(pixel.pixel.x >= 0 && pixel.pixel.x < capture.width && pixel.pixel.y >= 0 && pixel.pixel.y < capture.height)
      assert.equal(pixel.rgba.length, 4); assert.ok(pixel.rgba.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255))
      assert.ok(Number.isFinite(pixel.paintDistance) && pixel.paintDistance >= 0)
      if (pixel.paintCore) assert.deepEqual(pixel.rgba, [0, 0, 0, 255])
      // The existing coordinate axes cross x/y=0; retain their actual pixels but
      // do not mistake them for contour paint. Every other distant pixel is checked.

    }
    for (const [local, expected] of [[spec.exact[0], [0, 0, 0, 255]], [spec.exact[1], background], [spec.exterior, background]]) {
      const pixel = capture.samples.find((pixel) => pixel.local.x === local.x && pixel.local.y === local.y)
      assert.ok(pixel); assert.deepEqual(pixel.rgba, expected, 'Actual responsive App paint retains positive and genuine negative controls')
    }
  }
  const interaction = live.interaction
  assert.equal(interaction.method, 'connected live paint plus continuous stroke and contour interior')
  assert.equal(interaction.tolerance, 6); assert.equal(interaction.uncertainty, .14); assert.equal(interaction.selectionDecorationAllowance, 0)
  assert.equal(interaction.screenshot, live.captures[1].screenshot); assert.equal(interaction.sha256, live.captures[1].sha256)
  assert.equal(interaction.samples.length, audit.samples.length)
  for (const [index, sample] of interaction.samples.entries()) {
    const original = audit.samples[index], pixel = live.captures[1].samples[index]
    const minimum = Math.min(pixel.paintDistance, original.solidDistance)
    const expected = original.insideContour || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain'
    assert.deepEqual(sample, { ...pixel, insideContour: original.insideContour, solidDistance: original.solidDistance, expected, candidates: original.candidates })
    if (expected === 'hit') assert.deepEqual(sample.candidates, ['p'])
    else if (expected === 'miss') assert.deepEqual(sample.candidates, [])
  }
  assert.deepEqual(interaction.mismatches, [], 'Definite live interaction discrepancies remain strict failures')
  assert.ok(Array.isArray(entry.observation.cloneProbes), 'Superseded clone witnesses remain diagnostic')
}

function assertConnectedIsolationCapture(capture) {
  assert.equal(capture.status, 'inspected')
  assert.deepEqual(capture.region, { minX: -34, minY: -34, maxX: 34, maxY: 34 })
  assert.ok(capture.captureState && typeof capture.captureState === 'object', 'Retained capture state')
  const matrix = capture.ctm, region = capture.region
  assert.deepEqual(capture.screenRegion, { minX: region.minX * matrix.a + matrix.e, minY: region.minY * matrix.d + matrix.f,
    maxX: region.maxX * matrix.a + matrix.e, maxY: region.maxY * matrix.d + matrix.f })
  assert.ok(capture.screenRegion.minX >= 0 && capture.screenRegion.minY >= 0 && capture.screenRegion.maxX <= capture.width && capture.screenRegion.maxY <= capture.height,
    'The complete requested capture region is retained')
  for (const name of ['isolation', 'isolationAfter']) {
    const isolation = capture[name]
    assert.ok(isolation, `${name}: retained computed presentation isolation`)
    assert.match(isolation.owner, /^[a-z][a-z0-9-]*$/u)
    for (const key of ['valid', 'connected', 'contourIdentityPreserved', 'sourceUnchanged', 'paintUnchanged', 'pointerEventsUnchanged', 'ctmUnchanged']) assert.equal(isolation[key], true, `${name}: ${key}`)
    assert.equal(isolation.source, capture.source); assert.deepEqual(isolation.ctm, capture.ctm)
    assert.equal(isolation.background, 'rgb(255, 255, 255)')
    for (const element of [isolation.root, isolation.contour]) {
      assert.equal(element.visibility, 'visible'); assert.notEqual(element.display, 'none')
    }
    assert.deepEqual(isolation.visibilityLeaks, [], 'No root-level or point-local decoration contributes capture pixels')
    assert.ok(Array.isArray(isolation.rootDecorationVisibility) && isolation.rootDecorationVisibility.length > 0)
    assert.equal(isolation.rootDecorationVisibility.filter(({ intendedPaint }) => intendedPaint).length, 1)
    for (const element of isolation.rootDecorationVisibility) {
      if (element.intendedPaint) { assert.equal(element.contour, true); assert.equal(element.visibility, 'visible'); assert.notEqual(element.display, 'none') }
      else assert.ok(element.visibility === 'hidden' || element.display === 'none', 'Every unrelated SVG descendant is hidden')
    }
    assert.ok(Array.isArray(isolation.feedback))
    for (const element of isolation.feedback) assert.ok(element.visibility === 'hidden' || element.display === 'none', 'Selection-cycle tooltip is hidden wherever it is owned')
    const support = isolation.paintSupport
    assert.ok(support, 'Independent complete point-paint support is retained')
    assert.equal(support.method, 'native geometric bbox plus square-cap Euclidean support; independent of dash placement and production geometry')
    assert.equal(support.supported, true); assert.equal(support.enclosed, true); assert.deepEqual(support.region, capture.region)
    assert.equal(support.width, capture.stroke.width); assert.equal(support.cap, capture.stroke.cap); assert.equal(support.join, capture.stroke.join)
    assert.equal(support.cap, 'square'); assert.equal(support.join, 'bevel')
    const geometric = support.geometricBounds, expansion = support.width * Math.SQRT2 / 2
    assert.ok(Object.values(geometric).every(Number.isFinite) && geometric.minX < geometric.maxX && geometric.minY < geometric.maxY)
    assert.equal(support.expansion, expansion)
    assert.deepEqual(support.bounds, { minX: geometric.minX - expansion, minY: geometric.minY - expansion, maxX: geometric.maxX + expansion, maxY: geometric.maxY + expansion })
    assert.ok(support.bounds.minX > region.minX && support.bounds.minY > region.minY && support.bounds.maxX < region.maxX && support.bounds.maxY < region.maxY,
      'The independently bounded complete point paint has an exterior region margin')
  }
  assert.equal(capture.isolation.owner, capture.isolationAfter.owner)
  assert.deepEqual(capture.isolation.paintSupport, capture.isolationAfter.paintSupport)
  const restoration = capture.isolationRestoration
  assert.ok(restoration, 'Retained owned capture restoration')
  assert.equal(restoration.owner, capture.isolation.owner)
  for (const key of ['restored', 'removedOwnedStyle', 'connected', 'contourIdentityPreserved', 'sourceUnchanged', 'paintUnchanged', 'backgroundRestored', 'ctmUnchanged', 'rootPresentationRestored', 'rootStyleUnchanged']) assert.equal(restoration[key], true, `isolationRestoration: ${key}`)
  assert.equal(restoration.remainingOwner, false); assert.deepEqual(restoration.changedVisibility, [])
  assert.deepEqual(restoration.ctm, capture.ctm)
  for (const key of ['isolationOperationError', 'isolationAfterError', 'isolationCleanupError', 'isolationPersistenceError']) assert.equal(capture[key], undefined)
}

function assertTrianglePhaseNegativeProbes(edit, scale) {
  const support = edit.observation.solidSupport
  assert.ok(support); assert.equal(support.method, 'independent continuous-bevel support bound')
  assert.equal(support.strokeWidth, 36); assert.equal(support.join, 'bevel'); assert.equal(support.halfWidth, 18)
  assert.equal(support.vertices.length, 3)
  const expected = [{ x: 0, y: -5.091168824543141 }, { x: -4.409081537009721, y: 2.545584412271569 }, { x: 4.409081537009718, y: 2.5455844122715727 }]
  support.vertices.forEach((vertex, index) => { for (const axis of ['x', 'y']) assert.ok(Math.abs(vertex[axis] - expected[index][axis]) < 1e-6) })
  assert.equal(support.minVertexY, Math.min(...support.vertices.map(({ y }) => y)))
  assert.equal(support.minY, support.minVertexY - support.halfWidth)
  assert.deepEqual(edit.negativeProbes.map(({ local }) => local), triangleDashPhaseNegatives)
  for (const [index, probe] of edit.negativeProbes.entries()) {
    assert.equal(probe.kind, `phase-outside-${index}`); assert.equal(probe.alpha, 0); assert.equal(probe.nativeStrokeContains, false)
    assert.ok(Number.isFinite(probe.rasterDistance) && probe.rasterDistance > 6.14)
    assert.equal(probe.solidDistanceLowerBound, support.minY - probe.local.y); assert.ok(probe.solidDistanceLowerBound > 6.14)
    assert.equal(probe.selectionCleared, true); assert.equal(probe.screenshot, `${dashCapScenario}-triangle-square-wide-scale-${scale}-edit-dashPhase-outside-${index}.screen.png`)
    assert.deepEqual(probe.actions.map(({ alt }) => alt), [false, true, true, true])
    const matrix = probe.transform.ctm
    assert.ok(Object.values(matrix).every(Number.isFinite)); assert.equal(matrix.a, scale); assert.equal(matrix.d, scale)
    for (const action of probe.actions) {
      assert.equal(action.trusted, true); assert.equal(action.overlayExcluded, true); assert.deepEqual(action.candidates, ['control']); assert.equal(action.selection?.id, 'control')
      assert.ok(Math.abs(action.screen.x - (matrix.a * probe.local.x + matrix.c * probe.local.y + matrix.e)) < .01)
      assert.ok(Math.abs(action.screen.y - (matrix.b * probe.local.x + matrix.d * probe.local.y + matrix.f)) < .01)
      assert.ok(Math.abs(action.point.x - 450 - probe.local.x) < .01 && Math.abs(action.point.y - 350 - probe.local.y) < .01)
    }
  }
}
