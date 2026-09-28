import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { literalSvgLabelLayout, svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { createSvgLabelRuntime, svgLabelRequestIdentity } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { observeCircleSelection, assertCircleSelection } from '../../scripts/pointSelectionOracle.mjs'
import { createPointDiagnostics } from '../../scripts/pointCheckDiagnostics.mjs'

const legacyStyle = { color: '#000000', opacity: 1, shape: 'circle', fill: 'filled', size: 3 }
const explicitStyle = (enabled, width, opacity) => ({ ...legacyStyle, paint: {
  text: { color: '#000000', opacity: 1 }, fill: { enabled: true, color: '#4D9DE0', opacity: .35 },
  stroke: { enabled, width, opacity, color: '#008000', lineStyle: 'solid',
    dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' },
} })

// Expected paint is declared independently from the rendered attributes and
// production resolvers. Legacy paint absence explicitly means an enabled 0.4pt
// border. Disabled borders retain their stored width but contribute no geometry.
const fixtures = [
  { name: 'legacy 0.4pt', style: legacyStyle, border: { enabled: true, widthPt: .4, opacity: 1 },
    svgWidth: .48, halfWidth: .24 },
  { name: 'wider enabled 4pt', style: explicitStyle(true, 4, .65),
    border: { enabled: true, widthPt: 4, opacity: .65 }, svgWidth: 4.8, halfWidth: 2.4 },
  { name: 'disabled positive stored 4pt', style: explicitStyle(false, 4, .65),
    border: { enabled: false, widthPt: 4, opacity: .65 }, svgWidth: 4.8, halfWidth: 0 },
  { name: 'enabled zero-opacity 4pt', style: explicitStyle(true, 4, 0),
    border: { enabled: true, widthPt: 4, opacity: 0 }, svgWidth: 4.8, halfWidth: 2.4 },
]
const decode = (value) => value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const attribute = (tag, name) => {
  const match = tag.match(new RegExp(` ${name}="([^"]*)"`))
  return match ? decode(match[1]) : null
}

/** Restricted SSR observation adapter, not a native DOM/font measurement claim.
 * Only the actual selected view supplies contour/highlight attributes. The body
 * measurement provider is deterministic; browser acceptance owns FontFace work. */
function rendered(style, { characterWidth = 6, fontGeneration = 0 } = {}) {
  const source = 'Font readiness WWW iii'
  const settings = svgLabelLayoutSettings(12, 'Times New Roman', fontGeneration)
  const measurement = { identity: `selection-font-${fontGeneration}`,
    measure: (text) => ({ width: text.length * characterWidth, ascent: 9, descent: 3 }),
    lineMetrics: () => ({ ascent: 9, descent: 3 }) }
  const runtime = createSvgLabelRuntime({ measurement })
  const capture = { runtime, source, settings, fontSize: 12, fontFamily: settings.font.family,
    pointStyle: style, position: { x: 0, y: 0 }, boundsTarget: false, anchor: 'center',
    opacity: 1, color: '#000000', ownerIdentity: 'selection-oracle-owner' }
  const state = { source, status: 'fallback', requestIdentity: svgLabelRequestIdentity(capture),
    ...literalSvgLabelLayout(source, settings, measurement) }
  const markup = renderToStaticMarkup(createElement(SvgPointNodeView, { capture, state, selected: true }))
  const circles = [...markup.matchAll(/<circle\b[^>]*>/g)].map(([tag]) => tag)
  assert.equal(circles.length, 2)
  const contour = circles.find((tag) => attribute(tag, 'data-point-contour') === 'true')
  const highlight = circles.find((tag) => attribute(tag, 'data-svg-export-exclude') === 'true')
  assert.ok(contour); assert.ok(highlight)
  // The selection's own 3-unit outline is distinct from the model node border.
  assert.equal(attribute(highlight, 'stroke-width'), '3')
  const radius = attribute(contour, 'r')
  assert.ok(radius !== null && radius.trim() !== '' && Number.isFinite(Number(radius)))
  const observation = {
    source: attribute(markup, 'data-label-source'), owner: attribute(markup, 'data-point-node'),
    request: attribute(markup, 'data-label-request'), pointRequest: attribute(markup, 'data-point-request'),
    runtime: { fontGeneration }, style, radius: Number(radius),
    contourAttributes: { kind: 'circle', radius, stroke: attribute(contour, 'stroke'),
      strokeWidth: attribute(contour, 'stroke-width'), strokeOpacity: attribute(contour, 'stroke-opacity') },
    highlight: attribute(highlight, 'r'),
  }
  assert.equal(observation.source, source)
  assert.equal(observation.request, state.requestIdentity)
  assert.equal(observation.pointRequest, state.requestIdentity)
  return observation
}

for (const fixture of fixtures) {
  test(`selected production circle and independent oracle agree for ${fixture.name}`, () => {
    const point = rendered(fixture.style)
    assert.equal(Number(point.contourAttributes.strokeWidth), fixture.svgWidth)
    assert.equal(point.contourAttributes.stroke === 'none', !fixture.border.enabled)
    assert.equal(Number(point.contourAttributes.strokeOpacity), fixture.border.opacity)
    assert.equal(Number(point.highlight), point.radius + fixture.halfWidth + 6)
    const evidence = observeCircleSelection(point, fixture.border)
    assert.equal(evidence.contourRadius, point.radius)
    assert.equal(evidence.expectedBorderWidth, fixture.border.enabled ? fixture.svgWidth : 0)
    assert.equal(evidence.expectedHalfWidth, fixture.halfWidth)
    assert.equal(evidence.expectedHighlightRadius, point.radius + fixture.halfWidth + 6)
    assert.equal(evidence.actualHighlightRadius, Number(point.highlight))
    assert.equal(evidence.delta, 0)
    assert.doesNotThrow(() => assertCircleSelection(evidence))
  })

  if (fixture.border.enabled) {
    for (const multiplier of [0, 2]) {
      test(`${fixture.name} rejects ${multiplier === 0 ? 'missing' : 'doubled'} border half-width in selected-view observation`, () => {
        const point = rendered(fixture.style)
        const incorrect = { ...point, highlight: String(point.radius + fixture.halfWidth * multiplier + 6) }
        const evidence = observeCircleSelection(incorrect, fixture.border)
        assert.notEqual(evidence.delta, 0)
        assert.throws(() => assertCircleSelection(evidence))
      })
    }
  }
}

test('disabled positive-width border cannot expand selection even though SVG retains its width attribute', () => {
  const fixture = fixtures[2], point = rendered(fixture.style)
  assert.equal(point.contourAttributes.strokeWidth, '4.8')
  assert.throws(() => assertCircleSelection(observeCircleSelection({ ...point,
    highlight: String(point.radius + 2.4 + 6) }, fixture.border)))
})

test('current selected view rejects a stale pre-font-change radius and accepts restored geometry', () => {
  const fixture = fixtures[0]
  const before = rendered(fixture.style)
  const after = rendered(fixture.style, { characterWidth: 9, fontGeneration: 1 })
  assert.equal(before.source, after.source); assert.equal(before.owner, after.owner)
  assert.notEqual(before.request, after.request)
  assert.notEqual(before.radius, after.radius); assert.notEqual(before.highlight, after.highlight)
  assert.doesNotThrow(() => assertCircleSelection(observeCircleSelection(after, fixture.border)))
  assert.throws(() => assertCircleSelection(observeCircleSelection({ ...after, highlight: before.highlight }, fixture.border)))
  const restored = rendered(fixture.style, { fontGeneration: 2 })
  assert.notEqual(restored.request, before.request)
  assert.equal(restored.radius, before.radius)
  assert.doesNotThrow(() => assertCircleSelection(observeCircleSelection(restored, fixture.border)))
})

test('an incorrect rendered border cannot redefine its declared width using a self-consistent highlight', () => {
  const fixture = fixtures[0], point = rendered(fixture.style)
  const incorrect = { ...point, contourAttributes: { ...point.contourAttributes, strokeWidth: '.96' },
    highlight: String(point.radius + .48 + 6) }
  assert.throws(() => assertCircleSelection(observeCircleSelection(incorrect, fixture.border)))
})

test('circle oracle rejects missing, blank and nonfinite native numeric measurements', () => {
  const fixture = fixtures[0], point = rendered(fixture.style)
  for (const invalid of [null, undefined, NaN, Infinity, -Infinity]) {
    assert.throws(() => assertCircleSelection(observeCircleSelection({ ...point, radius: invalid }, fixture.border)))
  }
  for (const invalid of [null, undefined, '', ' ', 'NaN', 'Infinity', '-Infinity']) {
    assert.throws(() => assertCircleSelection(observeCircleSelection({ ...point, highlight: invalid }, fixture.border)))
    for (const field of ['radius', 'strokeWidth', 'strokeOpacity']) {
      const incorrect = { ...point, contourAttributes: { ...point.contourAttributes, [field]: invalid } }
      assert.throws(() => assertCircleSelection(observeCircleSelection(incorrect, fixture.border)))
    }
  }
})

test('circle oracle checks actual stroke presence and opacity independently of highlight arithmetic', () => {
  for (const fixture of fixtures) {
    const point = rendered(fixture.style)
    const wrongStroke = fixture.border.enabled ? 'none' : '#008000'
    for (const stroke of [null, undefined, '', ' ', wrongStroke]) {
      const incorrect = { ...point, contourAttributes: { ...point.contourAttributes, stroke } }
      assert.throws(() => assertCircleSelection(observeCircleSelection(incorrect, fixture.border)))
    }
    const incorrect = { ...point, contourAttributes: { ...point.contourAttributes,
      strokeOpacity: String(fixture.border.opacity === 0 ? 1 : 0) } }
    assert.throws(() => assertCircleSelection(observeCircleSelection(incorrect, fixture.border)))
  }
})

test('failed selected-view assertion retains its current identity, paint and expected components before aborting', async (t) => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-selection-oracle-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const observations = [], passingRecords = []
  const diagnose = createPointDiagnostics({ artifactDir,
    observe: async (name, details) => observations.push({ name, ...details }) })
  const fixture = fixtures[0]
  const current = rendered(fixture.style, { characterWidth: 9, fontGeneration: 1 })
  const incorrect = { ...current, highlight: String(current.radius + 6) }
  const circleSelection = observeCircleSelection(incorrect, fixture.border)
  const state = { json: JSON.stringify({ text: current.source, style: fixture.style }),
    history: { past: ['before-model-edit'], present: 'current-model', future: [] } }
  await assert.rejects(async () => {
    await diagnose('point-node-body-layout-lifecycle', 'point-resource-retry-font-readiness',
      { circleSelection, state })
    assertCircleSelection(circleSelection)
    passingRecords.push('point-resource-retry-font-readiness')
  })
  assert.deepEqual(passingRecords, [])
  assert.equal(observations.length, 1)
  const saved = JSON.parse(await readFile(join(artifactDir, observations[0].artifact), 'utf8'))
  assert.equal(saved.result, 'observed')
  assert.deepEqual(saved.state, state)
  assert.deepEqual(saved.circleSelection, circleSelection)
  assert.equal(saved.circleSelection.source, current.source)
  assert.equal(saved.circleSelection.owner, current.owner)
  assert.equal(saved.circleSelection.request, current.request)
  assert.equal(saved.circleSelection.pointRequest, current.pointRequest)
  assert.equal(saved.circleSelection.fontGeneration, 1)
  assert.deepEqual(saved.circleSelection.declaredBorder, { enabled: true, widthPt: .4, opacity: 1 })
  assert.equal(saved.circleSelection.contourRadius, current.radius)
  assert.equal(saved.circleSelection.contourAttributes.strokeWidth, '0.48')
  assert.equal(saved.circleSelection.expectedBorderWidth, .48)
  assert.equal(saved.circleSelection.expectedHalfWidth, .24)
  assert.equal(saved.circleSelection.expectedHighlightRadius, current.radius + .24 + 6)
  assert.equal(saved.circleSelection.actualHighlight, incorrect.highlight)
  assert.equal(saved.circleSelection.delta, current.radius + 6 - (current.radius + .24 + 6))
})
