import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readEvidenceDocumentSync } from './evidencePublication.mjs'
import { decodeConnectedPaintPng } from './connectedLivePaintOracle.mjs'
import { assertGeometricSelectionEvidence } from './pointGeometricShapesContract.mjs'
import { assertStandaloneReopeningRecord, validateStandaloneSvgCaptureEvidence } from './standaloneSvgCaptureContract.mjs'
import { generateTikzForUi } from '../src/ui/tikzExportMode.ts'
import { parseSignedPointSvg, signedPointStandaloneRootAttributes } from './signedPointStandaloneAssociation.mjs'
import { resolveSvgCamera } from '../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../src/rendering/svgProjection.ts'
import { createCoordinateAxesGuide } from '../src/rendering/coordinateAxesGuide.ts'
import { cameraOrientationForPreview, cameraViewAdjustmentFromControls } from '../src/ui/cameraControls.ts'

export const conformanceCases = ['diamond-small-aspect', 'ellipse-signed-dashes']
export const conformanceStem = (key, ambientDimension) => `point-layout-conformance-${key}-${ambientDimension}d`
export const conformanceArtifacts = () => [2, 3].flatMap(dimension => conformanceCases.flatMap(key => {
  const stem = conformanceStem(key, dimension)
  return [`${stem}.json`, `${stem}-standalone.json`, `${stem}.svg`, `${stem}.png`, `${stem}-live.png`, `${stem}-saved.json`, `${stem}-standalone.tex`, `${stem}-inlineMath.tex`,
    ...['live', 'reopened'].flatMap(stage => ['actual', 'pgf', 'old'].flatMap(kind => [`${stem}-${stage}-${kind}.input.svg`, `${stem}-${stage}-${kind}.png`]))]
}))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
export function conformanceProbeSvg(key, path, attributes) {
  const paint = Object.fromEntries(Object.entries(attributes).filter(([name]) => name !== 'd' && name !== 'transform'))
  const viewBox = key === 'diamond-small-aspect' ? '-15 -130 30 260' : '-48 -48 96 96'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="${viewBox}"><path ${Object.entries({ ...paint, d: path }).map(([name, value]) => `${name}="${escape(value)}"`).join(' ')}/></svg>`
}
export function oldConformancePath(key, actual) {
  if (key === 'diamond-small-aspect') return 'M 12 0 L 0 -120.66 L -12 0 L 0 120.66 Z'
  return actual.replace(/(A [\d.]+ [\d.]+ [\d.-]+ [01] )1/gu, '$10')
}
const references = {
  'diamond-small-aspect': ['diamond-aspect-scanning', 'native-empty-width-minimum'],
  'ellipse-signed-dashes': ['signed-traversal', 'native-empty-mixed-axes'],
}
export function conformanceReference(key) {
  const [directory, id] = references[key]
  const path = new URL(`../tests/fixtures/point-node-anchors/${directory}/references.json`, import.meta.url)
  const bytes = readFileSync(path), reference = JSON.parse(bytes)
  assert.equal(reference.pgfVersion, '3.1.11a')
  assert.ok(reference.engine && reference.command.length > 0)
  for (const [file, expected] of Object.entries(reference.artifactHashes)) assert.equal(hash(readFileSync(new URL(file, path))), expected, `Independent PGF artifact ${file}`)
  const control = (reference.cases ?? reference.controls).find(entry => entry.id === id)
  assert.ok(control, `Independent native case ${id}`)
  return { file: `tests/fixtures/point-node-anchors/${directory}/references.json`, sha256: hash(bytes), pgfVersion: reference.pgfVersion,
    engine: reference.engine, command: reference.command, control }
}
export function conformanceSpec(key) {
  if (key === 'diamond-small-aspect') return { shape: 'diamond', parameters: { aspect: .01 },
    layout: { innerXSep: 1, innerYSep: .55, outerXSep: 0, outerYSep: 0, minimumWidth: 20, minimumHeight: 1, anchor: 'north' } }
  assert.equal(key, 'ellipse-signed-dashes')
  return { shape: 'ellipse', parameters: {}, layout: { innerXSep: -20, innerYSep: 7.5, outerXSep: 0, outerYSep: 0, minimumWidth: -2, minimumHeight: -5, anchor: 'center' } }
}
export function conformancePaint(key) {
  return { text: { color: '#000000', opacity: 1 }, fill: { enabled: false, color: '#FFFFFF', opacity: 1 },
    stroke: { enabled: true, color: '#000000', opacity: 1, width: .4, lineStyle: key === 'ellipse-signed-dashes' ? 'dashed' : 'solid',
      ...(key === 'ellipse-signed-dashes' ? { dashPattern: [2, 5] } : {}), dashPhase: key === 'ellipse-signed-dashes' ? -2.7 : 0, lineCap: 'butt', lineJoin: 'miter' } }
}
// Raw PGF soft-path tokens are already reflected into SVG's Y-down frame by
// the independent generator. Cubic handles retain PGF's actual traversal.
export function pgfConformancePath(reference) {
  const paints = reference.control.paints ?? reference.control.paths
  const tokens = paints[0].tokens, commands = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], pair = value => `${value.x * 1.2} ${value.y * 1.2}`
    if (token.kind === 'movetotoken') commands.push(`M ${pair(token)}`)
    else if (token.kind === 'linetotoken') commands.push(`L ${pair(token)}`)
    else if (token.kind === 'curvetosupportatoken') {
      assert.equal(tokens[index + 1].kind, 'curvetosupportbtoken'); assert.equal(tokens[index + 2].kind, 'curvetotoken')
      commands.push(`C ${pair(token)} ${pair(tokens[++index])} ${pair(tokens[++index])}`)
    } else { assert.equal(token.kind, 'closepathtoken'); commands.push('Z') }
  }
  return commands.join(' ')
}
function near(actual, expected, tolerance = .025 * 1.2) {
  assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) <= tolerance,
    `Native fitted placement ${JSON.stringify(actual)} matches independent PGF ${JSON.stringify(expected)}`)
}
export function assertConformancePlacement(entry, reference = conformanceReference(entry.key)) {
  const spec = conformanceSpec(entry.key), observed = entry.rendered, state = entry.state, diagram = JSON.parse(state.runtimeDiagramJson)
  const point = diagram.strata[0]
  assert.equal(diagram.ambientDimension, entry.ambientDimension); assert.equal(diagram.strata.length, 1)
  assert.equal(point.id, 'app-point'); assert.equal(point.codim, entry.ambientDimension); assert.equal(point.text, '')
  assert.deepEqual(point.position, { x: 3, y: 3, z: entry.ambientDimension === 3 ? .5 : 0 })
  assert.equal(point.style.shape, spec.shape); assert.deepEqual(point.style.shapeParameters, spec.parameters)
  assert.deepEqual(point.style.layout, spec.layout); assert.deepEqual(point.style.paint, conformancePaint(entry.key))
  assert.deepEqual(JSON.parse(state.json).diagram.strata, diagram.strata); assert.deepEqual(JSON.parse(state.history).present, diagram)
  assert.equal(observed.source, ''); assert.equal(observed.state, 'ready'); assert.equal(observed.shape, spec.shape)
  assert.deepEqual(JSON.parse(observed.pointOwner), ['point-node', state.labelDocumentRevision, point.id])
  assert.equal(observed.pointRequest, observed.bodyRequest); assert.equal(observed.warningCount, 0); assert.deepEqual(observed.seams, [])
  const expected = reference.control.expectedAnchors[spec.layout.anchor]
  const translated = expected.x !== 0 || expected.y !== 0
  const attributes = observed.contour.attributes
  assert.equal(attributes.fill, 'none'); assert.equal(attributes.stroke, '#000000')
  assert.equal(Number(attributes['stroke-width']), .48); assert.equal(Number(attributes['stroke-opacity']), 1)
  assert.equal(Number(attributes['fill-opacity']), 1); assert.equal(Number(attributes['stroke-miterlimit']), 10)
  assert.equal(attributes['stroke-linecap'], 'butt'); assert.equal(attributes['stroke-linejoin'], 'miter')
  assert.deepEqual(Object.keys(attributes).sort(), ['d', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dashoffset',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', ...(entry.key === 'ellipse-signed-dashes' ? ['stroke-dasharray'] : []),
    ...(translated ? ['transform'] : [])].sort(), 'Actual contour cannot hide independent paint behind inherited/unsupported SVG options')
  // Attribute presence belongs to the geometric anchor, not a node-inverse CTM
  // product whose nominal identity can contain native floating-point residue.
  // The renderer serializes the actual selected anchor offset exactly; retain
  // independent PGF proximity and the existing measured-placement checks too.
  if (translated) assert.equal(attributes.transform, `translate(${-observed.anchorOffset.x || 0} ${-observed.anchorOffset.y || 0})`, 'Actual contour serializes its geometric anchor translation exactly')
  else assert.deepEqual(observed.anchorOffset, { x: expected.x * 1.2, y: expected.y * 1.2 }, 'Independent center anchor has no geometric translation')
  if (entry.key === 'diamond-small-aspect') { assert.equal(attributes['stroke-dasharray'], undefined); assert.equal(Number(attributes['stroke-dashoffset']), 0) }
  near(observed.anchorOffset, { x: expected.x * 1.2, y: expected.y * 1.2 })
  near(observed.placementOffset, { x: -observed.anchorOffset.x, y: -observed.anchorOffset.y }, .0001)
  near(observed.placement, observed.placedAnchor, .0001)
  const ui = JSON.parse(state.uiSettings), projection = resolveSvgCamera(diagram, 520, 360, { fitToView: true,
    extraPointsForFit: createCoordinateAxesGuide(diagram.ambientDimension).fitPoints,
    ...(ui.camera3d ? { cameraOverride: cameraOrientationForPreview(ui.camera3d), viewAdjustment: cameraViewAdjustmentFromControls(ui.camera3d) } : {}) })
  const projected = projectToSvgPoint(projection, point.position, 360)
  assert.equal(observed.nodeTransform, `translate(${projected.x} ${projected.y})`, 'Native conformance node stays at the authoritative projected model coordinate')
  assertGeometricSelectionEvidence(observed.nativeSelection, 'app-point')
  assert.equal(observed.nativeSelection.scenario, 'point-layout-signed-polygonal-zero-axis')
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) assert.equal(observed.nativeSelection.stateAfter[field], state[field], `Native gesture belongs to current conformance ${field}`)
  if (entry.key === 'ellipse-signed-dashes') {
    assert.match(observed.contour.attributes.d, /^M -1\.2 0 A /u)
    const flags = [...observed.contour.attributes.d.matchAll(/A [\d.]+ [\d.]+ [\d.-]+ [01] ([01])/gu)].map(match => Number(match[1]))
    assert.deepEqual(flags, [1, 1], 'One negative ellipse axis reverses SVG sweep under the PGF reflection')
    assert.equal(observed.contour.attributes['stroke-dasharray'], '2.4 6')
    assert.equal(observed.contour.attributes['stroke-dashoffset'], '-3.24')
    assert.ok(observed.nativeTraversal[1].y < -.9 * 10.60661 * 1.2, 'Ordered first quarter visits PGF north')
    assert.ok(observed.nativeTraversal[3].y > .9 * 10.60661 * 1.2, 'Ordered third quarter visits PGF south')
  }
}
export function compareConformancePng(actual, expected) {
  const left = decodeConnectedPaintPng(actual), right = decodeConnectedPaintPng(expected)
  assert.equal(left.width, right.width); assert.equal(left.height, right.height)
  let mismatches = 0, actualDark = 0, expectedDark = 0
  const dark = (rgba, at) => rgba[at + 3] > 128 && rgba[at] < 128 && rgba[at + 1] < 128 && rgba[at + 2] < 128
  // Each raster cell center has half a pixel diagonal of location uncertainty.
  // Comparing two independently rasterized boundaries therefore contributes
  // sqrt(2) pixels, plus the unchanged .03pt contour tolerance in this fixed
  // 800px/96-SVG-unit frame (1.2 SVG units/pt). No mismatch-count budget, frame,
  // threshold, authored paint or geometry tolerance is fitted to an observation.
  const boundPixels = Math.SQRT2 + .03 * 1.2 * 800 / 96
  const radius = Math.ceil(boundPixels), actualMask = new Uint8Array(left.width * left.height), expectedMask = new Uint8Array(right.width * right.height)
  for (let at = 0; at < left.rgba.length; at += 4) { const a = dark(left.rgba, at), b = dark(right.rgba, at); actualDark += Number(a); expectedDark += Number(b); mismatches += Number(a !== b) }
  for (let index = 0; index < actualMask.length; index++) { actualMask[index] = Number(dark(left.rgba, index * 4)); expectedMask[index] = Number(dark(right.rgba, index * 4)) }
  let maxWithinBound = 0
  const outside = (mask, other) => {
    let count = 0
    for (let index = 0; index < mask.length; index++) if (mask[index] && !other[index]) {
      const x = index % left.width, y = Math.floor(index / left.width)
      let nearest = Infinity
      // Fixed radius bounds work even for a blank or globally corrupted mask;
      // no quadratic all-dark-pixel search can exceed the capture budget.
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx, py = y + dy
        if (px >= 0 && px < left.width && py >= 0 && py < left.height && other[py * left.width + px]) nearest = Math.min(nearest, Math.hypot(dx, dy))
      }
      if (nearest > boundPixels) count++
      else maxWithinBound = Math.max(maxWithinBound, nearest)
    }
    return count
  }
  const actualOutside = outside(actualMask, expectedMask), expectedOutside = outside(expectedMask, actualMask)
  return { width: left.width, height: left.height, mismatches, actualDark, expectedDark, actualSha256: hash(actual), expectedSha256: hash(expected),
    spatial: { boundPixels, maxDistancePixels: actualOutside + expectedOutside ? null : maxWithinBound, actualOutside, expectedOutside, outside: actualOutside + expectedOutside } }
}

/** Independent endpoint-form SVG decoding and raw PGF cubic integration. The
 * production solver/contour builder never supplies this traversal oracle. */
export function measureConformanceTraversal(path, reference) {
  const maximumPoints = 2048, unitScale = 1.2
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const finite = point => { assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), 'Independent traversal points are finite'); return point }
  const append = (points, point) => { assert.ok(points.length < maximumPoints, 'Independent traversal stays within 2048 points'); points.push(finite(point)) }
  assert.ok(typeof path === 'string' && path.length < 4096, 'Bounded actual ellipse path')
  const words = path.trim().split(/\s+/u)
  assert.ok(words.length <= 64)
  let offset = 0
  const number = () => { const token = words[offset++]; assert.match(token ?? '', /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/u, 'SVG numeric token uses decimal syntax'); const value = Number(token); assert.ok(Number.isFinite(value)); return value }
  assert.equal(words[offset++], 'M')
  let cursor = { x: number(), y: number() }
  const actual = []; append(actual, cursor)
  for (let arc = 0; arc < 2; arc++) {
    assert.equal(words[offset++], 'A', 'Full native ellipse retains two ordered half-arcs')
    let rx = number(), ry = number()
    const phi = number() * Math.PI / 180, large = number(), sweep = number(), end = { x: number(), y: number() }
    assert.ok(rx > 0 && ry > 0); assert.ok([0, 1].includes(large) && [0, 1].includes(sweep))
    const cos = Math.cos(phi), sin = Math.sin(phi), dx = (cursor.x - end.x) / 2, dy = (cursor.y - end.y) / 2
    const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy
    const correction = Math.sqrt(xp * xp / (rx * rx) + yp * yp / (ry * ry))
    if (correction > 1) { rx *= correction; ry *= correction }
    const divisor = rx * rx * yp * yp + ry * ry * xp * xp
    assert.ok(Number.isFinite(divisor) && divisor > 0, 'Nondegenerate SVG ellipse endpoint conversion')
    const ratio = Math.max(0, (rx * rx * ry * ry - divisor) / divisor)
    const coefficient = (large === sweep ? -1 : 1) * Math.sqrt(ratio)
    const cxp = coefficient * rx * yp / ry, cyp = -coefficient * ry * xp / rx
    const center = { x: cos * cxp - sin * cyp + (cursor.x + end.x) / 2, y: sin * cxp + cos * cyp + (cursor.y + end.y) / 2 }
    const start = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx), finish = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx)
    let span = finish - start
    if (sweep === 0 && span > 0) span -= 2 * Math.PI
    if (sweep === 1 && span < 0) span += 2 * Math.PI
    for (let index = 1; index <= 512; index++) {
      const angle = start + span * index / 512, x = rx * Math.cos(angle), y = ry * Math.sin(angle)
      append(actual, { x: center.x + cos * x - sin * y, y: center.y + sin * x + cos * y })
    }
    cursor = end
  }
  assert.equal(words[offset++], 'Z'); assert.equal(offset, words.length)
  assert.ok(distance(actual[0], actual.at(-1)) < 1e-8, 'Native ellipse closes without an extra stroke')
  const tokens = reference.control.paints[0].tokens
  assert.ok(tokens.length <= 32); assert.equal(tokens[0].kind, 'movetotoken')
  const expected = [], scaled = token => finite({ x: token.x * unitScale, y: token.y * unitScale })
  cursor = scaled(tokens[0]); append(expected, cursor)
  let tokenIndex = 1
  for (let curve = 0; curve < 4; curve++) {
    const a = tokens[tokenIndex++], b = tokens[tokenIndex++], end = tokens[tokenIndex++]
    assert.equal(a.kind, 'curvetosupportatoken'); assert.equal(b.kind, 'curvetosupportbtoken'); assert.equal(end.kind, 'curvetotoken')
    const controlA = scaled(a), controlB = scaled(b), target = scaled(end)
    for (let index = 1; index <= 256; index++) {
      const t = index / 256, u = 1 - t
      append(expected, { x: u ** 3 * cursor.x + 3 * u * u * t * controlA.x + 3 * u * t * t * controlB.x + t ** 3 * target.x,
        y: u ** 3 * cursor.y + 3 * u * u * t * controlA.y + 3 * u * t * t * controlB.y + t ** 3 * target.y })
    }
    cursor = target
  }
  assert.equal(tokens[tokenIndex++].kind, 'closepathtoken')
  assert.ok(tokens.slice(tokenIndex).every(token => token.kind === 'movetotoken'), 'Only PGF nonpainting reset moves follow the closed ellipse')
  assert.ok(distance(expected[0], expected.at(-1)) < 1e-8)
  const table = points => { let length = 0; const lengths = [0]; for (let index = 1; index < points.length; index++) lengths.push(length += distance(points[index - 1], points[index])); assert.ok(Number.isFinite(length) && length > 0); return { points, lengths, length } }
  const at = (table, fraction) => {
    const target = fraction * table.length; let low = 0, high = table.points.length - 1
    while (high - low > 1) { const middle = Math.floor((low + high) / 2); if (table.lengths[middle] <= target) low = middle; else high = middle }
    const a = table.points[low], b = table.points[high], t = (target - table.lengths[low]) / (table.lengths[high] - table.lengths[low])
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }
  const left = table(actual), right = table(expected)
  const tangent = (from, to) => { const a = at(left, from), b = at(left, to), c = at(right, from), d = at(right, to); return (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y) }
  return { actualSamples: actual.length, pgfSamples: expected.length, actualLengthPt: left.length / unitScale, pgfLengthPt: right.length / unitScale,
    lengthDifferencePt: Math.abs(left.length - right.length) / unitScale,
    maxOrderedDistancePt: Math.max(...Array.from({ length: 129 }, (_, index) => distance(at(left, index / 128), at(right, index / 128)))) / unitScale,
    startTangentDot: tangent(0, 1 / 128), endTangentDot: tangent(127 / 128, 1) }
}
export function assertConformancePaintProbe(probe, artifactDir, stem, stage) {
  assert.equal(probe.oldPath, oldConformancePath(probe.key, probe.actualPath), 'Negative control restores exactly the reviewed old arithmetic/sweep')
  for (const kind of ['actual', 'pgf', 'old']) {
    const svg = readFileSync(resolve(artifactDir, `${stem}-${stage}-${kind}.input.svg`)), png = readFileSync(resolve(artifactDir, `${stem}-${stage}-${kind}.png`))
    assert.equal(hash(svg), probe[kind].svgSha256); assert.equal(hash(png), probe[kind].pngSha256)
    assert.equal(svg.toString(), probe[kind].svg); assert.equal(png.length, probe[kind].bytes)
    assert.equal(probe[kind].svg, conformanceProbeSvg(probe.key, probe[`${kind === 'actual' ? 'actual' : kind === 'pgf' ? 'pgf' : 'old'}Path`], probe.observedContour.attributes), 'Each rendered SVG binds exact actual paint and independently required path')
  }
  const actual = readFileSync(resolve(artifactDir, `${stem}-${stage}-actual.png`)), pgf = readFileSync(resolve(artifactDir, `${stem}-${stage}-pgf.png`)), old = readFileSync(resolve(artifactDir, `${stem}-${stage}-old.png`))
  assert.deepEqual(compareConformancePng(actual, pgf), probe.comparison)
  assert.deepEqual(compareConformancePng(old, pgf), probe.negativeControl)
  assert.ok(probe.comparison.actualDark > 0 && probe.comparison.expectedDark > 0)
  assert.equal(probe.comparison.width, 800); assert.equal(probe.comparison.height, 800)
  if (probe.key === 'diamond-small-aspect') assert.equal(probe.comparison.mismatches, 0, 'Independent PGF-token and actual diamond have identical dark pixels')
  else {
    assert.equal(probe.key, 'ellipse-signed-dashes')
    assert.equal(probe.comparison.spatial.outside, 0, 'All directed mask differences remain within the unchanged contour tolerance and raster-cell uncertainty')
    const traversal = measureConformanceTraversal(probe.actualPath, probe.reference)
    assert.ok(traversal.maxOrderedDistancePt <= .03 && traversal.lengthDifferencePt <= .03, 'Actual ordered ellipse traversal and length match raw PGF within unchanged .03pt')
    assert.ok(traversal.startTangentDot > 0 && traversal.endTangentDot > 0, 'Actual ellipse endpoint tangents retain PGF direction')
    const oldTraversal = measureConformanceTraversal(probe.oldPath, probe.reference)
    assert.ok(oldTraversal.maxOrderedDistancePt > .03 || oldTraversal.lengthDifferencePt > .03 || oldTraversal.startTangentDot <= 0 || oldTraversal.endTangentDot <= 0,
      'Restoring old traversal fails the same independent geometric acceptance')
    assert.ok(probe.negativeControl.spatial.outside > 0, 'Restoring old traversal fails the same spatial-mask criterion')
  }
  assert.ok(probe.negativeControl.mismatches > Math.max(30, probe.comparison.mismatches * 3), 'Restoring old arithmetic/traversal fails direction-sensitive pixels')
  assert.equal(probe.actualPath, probe.observedContour.attributes.d)
  assert.equal(probe.pgfPath, pgfConformancePath(probe.reference))
}
export function assertConformanceEvidence(evidence, artifactDir, { checkout } = {}) {
  assert.ok(Array.isArray(evidence.geometryConformance), 'Required geometryConformance native/export inventory')
  assert.equal(evidence.geometryConformance.length, 4, 'Both corrections require fresh native/live/export evidence in both dimensions')
  const authenticated = []
  for (const dimension of [2, 3]) for (const key of conformanceCases) {
    const stem = conformanceStem(key, dimension), found = evidence.geometryConformance.filter(entry => entry.key === key && entry.ambientDimension === dimension)
    assert.equal(found.length, 1)
    const raw = readEvidenceDocumentSync(artifactDir, `${stem}.json`, { checkout }), entry = found[0]
    assert.deepEqual(entry, raw.terminal); assert.equal(raw.result, 'observed'); assert.deepEqual(raw.pageErrors, [])
    assert.equal(raw.key, key); assert.equal(raw.ambientDimension, dimension)
    assert.equal(raw.native.key, key); assert.equal(raw.native.ambientDimension, dimension)
    assert.deepEqual(raw.reference, conformanceReference(key)); assert.deepEqual(raw.live.reference, raw.reference); assert.deepEqual(raw.reopenedPaint.reference, raw.reference)
    assertConformancePlacement(raw.native, raw.reference)
    for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) assert.equal(raw.afterLive[field], raw.native.state[field], `Live capture preserves ${field}`)
    const snapshot = raw.click.snapshot, state = raw.beforeExportState, point = JSON.parse(state.runtimeDiagramJson).strata[0]
    for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) assert.equal(state[field], raw.afterLive[field], `Native-to-export conformance continuity preserves ${field}`)
    for (const field of ['json', 'runtimeDiagramJson', 'history']) assert.equal(snapshot[field], state[field], `Immutable conformance export preserves ${field}`)
    assert.equal(snapshot.runtime.documentRevision, state.labelDocumentRevision, 'Immutable conformance export preserves the authenticated runtime document revision')
    assert.equal(snapshot.points.length, 1); assert.deepEqual(snapshot.points[0].style, point.style); assert.deepEqual(snapshot.points[0].position, point.position)
    assert.equal(snapshot.points[0].owner, raw.native.rendered.pointOwner); assert.equal(snapshot.points[0].request, raw.native.rendered.pointRequest)
    assert.equal(snapshot.points[0].nodeTransform, raw.native.rendered.nodeTransform)
    assert.deepEqual(JSON.parse(raw.savedJson).diagram.strata[0], point)
    assert.equal(readFileSync(resolve(artifactDir, `${stem}-saved.json`), 'utf8'), raw.savedJson)
    for (const mode of ['standalone', 'inlineMath']) {
      assert.equal(raw.outputs[mode], generateTikzForUi(JSON.parse(state.runtimeDiagramJson), { ...JSON.parse(state.uiSettings), exportMode: mode }))
      assert.equal(readFileSync(resolve(artifactDir, `${stem}-${mode}.tex`), 'utf8'), raw.outputs[mode])
    }
    const xml = assertStandaloneReopeningRecord(raw, raw, artifactDir)
    assert.equal(xml, raw.xml); assert.equal(raw.reopened.length, 1)
    const reopened = raw.reopened[0]
    for (const [stage, probe, contour] of [['live', raw.live, raw.native.rendered.contour], ['reopened', raw.reopenedPaint, reopened.contour]]) {
      assert.equal(probe.key, key); assert.equal(probe.stage, stage)
      assert.deepEqual(probe.observedContour, contour, 'Independent paint probe binds the actual current native/file contour')
    }
    assert.equal(reopened.source, ''); assert.equal(reopened.nodeTransform, raw.native.rendered.nodeTransform)
    assert.equal(reopened.bodyTransform, raw.native.rendered.bodyTransform); assert.deepEqual(reopened.contour, raw.native.rendered.contour)
    assert.equal(reopened.errors, 0); assert.equal(raw.document.forbiddenCount, 0); assert.deepEqual(raw.document.externalReferences, [])
    assert.equal(raw.document.backgroundCount, 0); assert.deepEqual(raw.requests, [raw.fileUrl])
    assert.ok(!/\b(?:data-|aria-)/u.test(xml)); assert.ok(xml.includes(raw.native.rendered.contour.attributes.d))
    const parsed = parseSignedPointSvg(xml), paths = [], visit = element => { if (element.tag === 'path') paths.push(element); element.children.forEach(visit) }
    visit(parsed.root); assert.equal(parsed.titles.length, 1); assert.equal(paths.length, 1)
    assert.deepEqual(parsed.root.attributes, signedPointStandaloneRootAttributes, 'Actual root cannot change paint, opacity, viewport or placement')
    assert.deepEqual(raw.document.rootAttributes, parsed.root.attributes)
    assert.deepEqual(paths[0].attributes, reopened.contour.attributes, 'Reopened paint is replayed from actual sanitized file bytes')
    const at = path => path.reduce((element, index) => element.children[index], parsed.root), title = parsed.titles[0]
    const body = at(title.path.slice(0, -1)), node = at(title.path.slice(0, -2))
    assert.deepEqual(node.children, [paths[0], body], 'One file-local owner contains exactly its contour and empty body')
    assert.deepEqual(node.attributes, { transform: reopened.nodeTransform }, 'Actual file owner placement matches native projected placement')
    assert.deepEqual(body.attributes, { transform: reopened.bodyTransform }, 'Actual file body placement matches the selected anchor')
    assert.equal(title.text, '')
    // The selected-point export retains the production selection layer as one
    // trailing empty root group. It must stay empty and unstyled; only the
    // first root branch may contain the exact point owner ancestry.
    assert.deepEqual(node.path, [0, 0, 0], 'Actual file owner retains its production root ancestry')
    assert.deepEqual(parsed.root.children.map(element => element.tag), ['g', 'g'], 'Actual root retains one owner branch and one empty selection layer')
    assert.deepEqual(parsed.root.children[1].attributes, {}, 'Empty selection layer cannot alter paint or placement')
    assert.deepEqual(parsed.root.children[1].children, [], 'Selection layer contains no foreign paint, titles or wrappers')
    assert.equal(parsed.root.children[1].text, '', 'Selection layer retains no text content')
    for (let depth = 1; depth < node.path.length; depth++) {
      const wrapper = at(node.path.slice(0, depth))
      assert.equal(wrapper.children.length, 1, 'File-local owner ancestry has no foreign painted siblings')
      assert.deepEqual(wrapper.attributes, {}, 'Ancestor wrappers cannot change paint or placement')
    }
    const allowed = element => { assert.ok(['svg', 'g', 'path', 'title'].includes(element.tag), 'Empty body export contains only its actual contour'); element.children.forEach(allowed) }
    allowed(parsed.root)
    validateStandaloneSvgCaptureEvidence(raw.capture, { svgPath: raw.svgPath, pngPath: resolve(artifactDir, `${stem}.png`), root: raw.document.root })
    assertConformancePaintProbe(raw.live, artifactDir, stem, 'live'); assertConformancePaintProbe(raw.reopenedPaint, artifactDir, stem, 'reopened')
    assert.deepEqual(raw.live.comparison, raw.reopenedPaint.comparison)
    const livePng = readFileSync(resolve(artifactDir, `${stem}-live.png`))
    assert.equal(hash(livePng), raw.liveCapture.sha256); assert.equal(livePng.length, raw.liveCapture.bytes)
    const decoded = decodeConnectedPaintPng(livePng)
    assert.equal(decoded.width, raw.liveCapture.width); assert.equal(decoded.height, raw.liveCapture.height)
    authenticated.push(`${stem}.svg`, ...['live', 'reopened'].flatMap(stage => ['actual', 'pgf', 'old'].map(kind => `${stem}-${stage}-${kind}.input.svg`)))
  }
  return authenticated
}
