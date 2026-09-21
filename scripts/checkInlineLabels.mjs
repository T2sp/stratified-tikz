/** Phase 31D browser acceptance through the production SvgDiagram, adapter,
 * path-edit helpers and native pointer handlers. Imported by check:free-labels. */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { probePoint } from './checkFreeLabelGeometry.mjs'

const node = (id, text, placement = 'above', marker = 'none', value = 0.5) => ({
  id, text, position: { kind: 'segment', segmentIndex: 0, value }, options: { placement, marker },
})
const curve = (id, inlineNodes, y = 0, extra = {}) => ({ id, inlineNodes,
  points: [{ x: -2, y, z: 0 }, { x: 2, y, z: 0 }], ...extra })
const selection = (id) => ({ kind: 'stratum', id })
const close = (actual, expected, tolerance = 0.001) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} must equal ${expected} within ${tolerance}`)
const rawInvariant = (before, after) => {
  for (const key of ['json', 'history', 'tikz', 'inlineTikz']) assert.equal(after[key], before[key], `${key} unaffected by label completion`)
  assert.deepEqual(after.selection, before.selection, 'Label completion preserves selection')
}

export async function runInlineLabelChecks({ page, record, observe, artifactDir, startGroup, completeGroup }) {
  const state = () => page.evaluate(() => window.stzLabels.state())
  const mount = (curves, extra = {}) => page.evaluate((value) => window.stzLabels.mount(value), { labels: [], curves, ...extra })
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  const inspect = (pathId, nodeId = 'shared', rasterize = false, controls = false) => page.evaluate(async (input) => {
    const { inspectInlineLabel } = await import('./inlineLabelBrowserOracle.ts')
    return inspectInlineLabel(input.pathId, input.nodeId, input.rasterize, input.controls)
  }, { pathId, nodeId, rasterize, controls })
  const mutate = (pathId, change, nodeId = 'shared') => page.evaluate((input) =>
    window.stzLabels.mutateInlineNode(input.pathId, input.nodeId, input.change), { pathId, nodeId, change })
  const hold = (source) => page.evaluate((value) => window.stzLabels.hold(value), source)
  const held = (source) => page.waitForFunction((value) => window.stzLabels.state().requests.some((request) =>
    request.source === value && request.held && request.phase === 'held'), source)
  const release = (source, fail = false) => page.evaluate((input) => window.stzLabels.release(input.source, input.fail), { source, fail })
  const rendered = (pathId, nodeId = 'shared') => page.locator(
    `[data-path-inline-node-path-id="${pathId}"][data-path-inline-node-id="${nodeId}"]`)
  async function screenshot(name) { await page.screenshot({ path: resolve(artifactDir, `${name}.png`), fullPage: true }) }
  async function retainRaster(name, observed, context) {
    const raster = observed.label.raster
    const artifacts = {}
    for (const [kind, data] of Object.entries(raster.images)) {
      artifacts[kind] = `${name}-${kind}.png`
      await writeFile(resolve(artifactDir, artifacts[kind]), Buffer.from(data.split(',')[1], 'base64'))
    }
    for (const [kind, svg] of Object.entries(raster.svgs)) {
      artifacts[`${kind}Svg`] = `${name}-${kind}.svg`
      await writeFile(resolve(artifactDir, artifacts[`${kind}Svg`]), svg)
    }
    delete raster.images; delete raster.svgs
    artifacts.native = `${name}-native.png`
    await screenshot(`${name}-native`)
    raster.artifacts = artifacts
    await observe(name, { ...context, observed })
  }
  async function checkStatus(pathId, source, expected = 'ready', nodeId = 'shared') {
    const observed = await inspect(pathId, nodeId)
    assert.equal(observed.label.source, source)
    assert.equal(observed.label.status, expected)
    assert.equal(JSON.parse(observed.label.request)[0], source)
    assert.equal(JSON.parse(observed.label.request)[2], 12, 'Inline node retains font size 12')
    const current = await state()
    assert.deepEqual(JSON.parse(observed.label.owner), ['path-inline-node', current.sourceRevision, pathId, nodeId])
    assert.deepEqual(current.layouts[observed.label.owner], { id: nodeId, source,
      requestIdentity: observed.label.request, status: expected }, 'Shared revision-aware layout callback matches visible inline label')
    assert.ok(Object.values(observed.label.bounds).every(Number.isFinite))
    assert.equal(observed.label.pointerEvents, 'none', 'Typeset glyphs remain non-interactive')
    assert.equal(observed.label.hitRectangles, 0, 'Inline label has no free-label picking rectangle')
    if (expected !== 'ready') assert.equal(observed.label.math, 0, 'Failed/pending current source has no obsolete math')
    return observed
  }

  await startGroup('inline-node-rendering-placement-halo-picking')
  const raw = '  "<>&"  \\textbf{bad}\t keep \\slash\r\n tail  '
  const examples = [
    ['math', '$\\frac{x_1}{1+\\frac{a}{b}}$'], ['mixed', 'map $F$ and $\\alpha$'],
    ['ordinary', 'ordinary text'], ['japanese', '日本語 $x_i$ と $\\beta$'],
    ['unclosed', 'unclosed $'], ['undefined', '$\\unknownInlineMacro{x}$'], ['raw', raw],
  ]
  await mount(examples.map(([id, text], index) => curve(id, [node('shared', text)], 2.5 - index * 0.7)))
  const initial = await state()
  await settle()
  const examplesEvidence = []
  for (const [id, text] of examples) examplesEvidence.push(await checkStatus(id, text,
    ['unclosed', 'undefined', 'raw'].includes(id) ? 'fallback' : 'ready'))
  rawInvariant(initial, await state())
  assert.equal(examplesEvidence[0].label.math, 1)
  assert.equal(examplesEvidence[1].label.math, 2)
  assert.equal(examplesEvidence[2].label.math, 0)
  assert.equal(examplesEvidence[3].label.math, 2)
  const literal = examplesEvidence.at(-1).label
  assert.deepEqual(literal.literal, raw.split(/\t|\r\n/u), 'Literal source preserves spaces, tabs and CRLF fragments')
  assert.ok(literal.texts.every(({ whiteSpace, xmlSpace }) => whiteSpace === 'pre' || xmlSpace === 'preserve'))
  assert.equal(literal.texts[0].y, literal.texts[1].y)
  assert.ok(literal.texts[2].y > literal.texts[1].y)
  assert.ok(literal.texts[1].x > literal.texts[0].x, 'Tab places the next complete text fragment to the right')
  assert.equal(await page.locator('foreignObject,image').count(), 0)
  await record('inline-valid-mixed-ordinary-Japanese-whole-source-fallback', { examples: examplesEvidence })

  const placements = ['above', 'below', 'left', 'right', 'center']
  const source = '日本語 $\\frac{O_1}{1+\\frac{a}{b}}$ and $g^2$'
  await mount(placements.map((placement, index) => curve(placement,
    [node('shared', source, placement, index % 2 ? 'none' : 'dot')], 2 - index)))
  await settle()
  const beforeCamera = await state()
  for (const zoom of [1, 1.4]) {
    await page.evaluate((value) => window.stzLabels.setProps({ cameraViewAdjustment: { zoom: value, pan: { x: 0, y: 0 } } }), zoom)
    const placementEvidence = []
    for (const placement of placements) {
      const caseName = `inline-${placement}-zoom-${zoom}`
      await startGroup('inline-node-rendering-placement-halo-picking', caseName)
      const controls = placement === 'above' && zoom === 1
      const observed = await inspect(placement, 'shared', true, controls)
      await retainRaster(caseName, observed, { placement, zoom, source })
      const { label, marker } = observed
      const [offsetX, offsetY] = placement === 'above' ? [0, -14] : placement === 'below' ? [0, 14]
        : placement === 'left' ? [-14, 0] : placement === 'right' ? [14, 0] : [0, 0]
      const translation = /^translate\(([-+\d.eE]+)[ ,]+([-+\d.eE]+)\)$/u.exec(label.transform)
      assert.ok(translation)
      close(Number(translation[1]), marker.x + offsetX)
      close(Number(translation[2]), marker.y + offsetY)
      const { bounds: b, native: ink } = label
      close(placement === 'left' ? b.maxX : placement === 'right' ? b.minX : b.minX + b.maxX, 0)
      close(placement === 'above' ? b.maxY : placement === 'below' ? b.minY : b.minY + b.maxY, 0)
      // Native SVG painted bounds independently verify measured placement.
      assert.ok(ink.minX >= b.minX - 1 && ink.maxX <= b.maxX + 1)
      assert.ok(ink.minY >= b.minY - 1 && ink.maxY <= b.maxY + 1)
      for (const edge of ['minX', 'maxX']) assert.ok(Math.abs(ink[edge] - b[edge]) < 7)
      for (const edge of ['minY', 'maxY']) assert.ok(Math.abs(ink[edge] - b[edge]) < 12)
      assert.equal(label.halos, 1)
      assert.equal(label.haloHidden, 'true')
      assert.equal(label.haloPointerEvents, 'none')
      assert.equal(label.haloTitles, 0, 'Decorative duplicate is not another accessible formula')
      const raster = label.raster
      assert.ok(raster.dark > 10, `${caseName}: dark=${raster.dark} must exceed 10 solid inner glyph pixels`)
      assert.equal(raster.darkPreserved, raster.dark, `${caseName}: white halo preserves all solid inner glyph pixels`)
      assert.ok(raster.compositeCompared > raster.dark,
        `${caseName}: compositeCompared=${raster.compositeCompared} must exceed dark=${raster.dark}`)
      assert.equal(raster.opaqueWhiteCompared + raster.sourceOverCompared, raster.compositeCompared,
        `${caseName}: both references cover the entire original comparison population`)
      assert.ok(raster.maxSourceOverError <= 2,
        `${caseName}: unchanged partial-halo source-over maxSourceOverError=${raster.maxSourceOverError} must be <=2`)
      assert.ok(raster.maxBackdropCompositeError <= 2,
        `${caseName}: independent same-backdrop maxBackdropCompositeError=${raster.maxBackdropCompositeError} must be <=2`)
      assert.ok(raster.maxBackdropPremultipliedError <= 2,
        `${caseName}: all-pixel color/alpha maxBackdropPremultipliedError=${raster.maxBackdropPremultipliedError} must be <=2`)
      assert.ok(raster.addedWhite > 10, `${caseName}: addedWhite=${raster.addedWhite} must exceed 10 visible outline pixels`)
      assert.ok(raster.furthestAddedPixel <= 3,
        `${caseName}: furthestAddedPixel=${raster.furthestAddedPixel} must be <=3 display units`)
      assert.ok(raster.distantClear > 10, `${caseName}: distantClear=${raster.distantClear} must exceed 10 gap pixels`)
      assert.equal(raster.distantFilled, 0, `${caseName}: fraction gaps and text spaces have no opaque background`)
      if (controls) {
        assert.ok(raster.opaqueWhiteCompared > 0 && raster.sourceOverCompared > 0, 'Both independent references are exercised')
        assert.deepEqual(raster.negativeControls.map(({ variant }) => variant), [
          'halo-over-foreground', 'missing-halo', 'oversized-halo', 'rectangular-background', 'wrong-color', 'wrong-opacity',
        ])
        for (const control of raster.negativeControls) {
          assert.ok(control.maxBackdropCompositeError > 2 || control.maxBackdropPremultipliedError > 2,
            `${caseName}: comparator must reject ${control.variant} against unmodified independent references`)
          if (control.variant === 'halo-over-foreground') assert.ok(control.darkPreserved < control.dark)
          if (control.variant === 'missing-halo') assert.equal(control.addedWhite, 0)
          if (control.variant === 'oversized-halo') assert.ok(control.furthestAddedPixel > 3)
          if (control.variant === 'rectangular-background') assert.ok(control.distantFilled > 0)
        }
        assert.deepEqual(raster.experiments.map(({ variant }) => variant), ['no-foreground-stroke', 'isolated-foreground'])
        // The changed references must also agree when thin MathJax strokes are
        // removed or foreground isolation is requested. Their original-layer
        // discrepancies are retained as diagnostics, not passing scenarios.
        for (const experiment of raster.experiments) {
          assert.ok(experiment.maxBackdropCompositeError <= 2 && experiment.maxBackdropPremultipliedError <= 2,
            `${caseName}: independent references disagree in ${experiment.variant}`)
        }
        await record('inline-halo-independent-reference-rejects-six-bad-outputs', {
          controls: raster.negativeControls.map(({ variant, maxBackdropCompositeError, maxBackdropPremultipliedError }) =>
            ({ variant, maxBackdropCompositeError, maxBackdropPremultipliedError })),
        })
      }
      placementEvidence.push(observed)
    }
    assert.equal((await state()).invocationCount, beforeCamera.invocationCount, 'Camera motion reuses unchanged inline conversion')
    await screenshot(`inline-five-placements-zoom-${zoom}`)
    await record(`inline-five-placements-native-geometry-and-pixel-halo-zoom-${zoom}`, { placements: placementEvidence })
  }

  await mount([curve('transparentMath', [node('shared', 'before $\\color{transparent}{WWW}$ after')])])
  await settle()
  await startGroup('inline-node-rendering-placement-halo-picking', 'inline-transparent-math')
  const transparent = await inspect('transparentMath', 'shared', true)
  await retainRaster('inline-transparent-math', transparent, { placement: 'above', zoom: 1, source: transparent.label.source })
  assert.equal(transparent.label.math, 1, 'Transparent supported math remains successfully typeset')
  assert.equal(transparent.label.raster.darkPreserved, transparent.label.raster.dark, 'inline-transparent-math: solid glyph preservation')
  assert.ok(transparent.label.raster.maxSourceOverError <= 2,
    `inline-transparent-math: unchanged partial-halo maxSourceOverError=${transparent.label.raster.maxSourceOverError} must be <=2`)
  assert.ok(transparent.label.raster.maxBackdropCompositeError <= 2,
    `inline-transparent-math: maxBackdropCompositeError=${transparent.label.raster.maxBackdropCompositeError} must be <=2`)
  assert.ok(transparent.label.raster.maxBackdropPremultipliedError <= 2,
    `inline-transparent-math: all-pixel maxBackdropPremultipliedError=${transparent.label.raster.maxBackdropPremultipliedError} must be <=2`)
  assert.ok(transparent.label.raster.furthestAddedPixel <= 3,
    `inline-transparent-math: furthestAddedPixel=${transparent.label.raster.furthestAddedPixel} must be <=3; no white ghost`)
  assert.equal(transparent.label.raster.distantFilled, 0, 'inline-transparent-math: transparent gaps')
  await record('inline-transparent-formula-does-not-produce-white-ghost', transparent)

  for (const ambientDimension of [2, 3]) {
    await page.evaluate(async ({ ambientDimension, inlineNode }) => {
      const { createCurveStratum, createConcatenatedPathStratum, createTemplatePathStratum } = await import('../../src/model/constructors.ts')
      const point = (x, y, z = 0) => ({ x, y, z: ambientDimension === 2 ? 0 : z })
      const common = { ambientDimension, inlineNodes: [inlineNode] }
      window.stzLabels.mount({ labels: [], ambientDimension, paths: [
        createCurveStratum({ ...common, id: 'polyline', points: [point(-2, 1, 0.5), point(1, 1, 0.7)] }),
        createCurveStratum({ ...common, id: 'cubic', kind: 'cubicBezier', points: [point(-2, 0, 0.3), point(-1, 1, 0.5), point(0, -1, 0.8), point(1, 0, 0.2)] }),
        createConcatenatedPathStratum({ ...common, id: 'concatenated', segments: [
          { kind: 'line', start: point(-2, -1, 0.2), end: point(-1, -1, 0.7) },
          { kind: 'line', start: point(-1, -1, 0.7), end: point(1, -1, 0.4) },
        ] }),
        createTemplatePathStratum({ ...common, id: 'circle', template: { kind: 'circleTemplate', center: point(1, 1, 0.2), radius: 0.4 } }),
        createTemplatePathStratum({ ...common, id: 'ellipse', template: { kind: 'ellipseTemplate', center: point(1, -1, 0.4), radiusX: 0.6, radiusY: 0.3 } }),
      ] })
    }, { ambientDimension, inlineNode: node('shared', '$\\frac{p}{q}$', 'above', 'dot', 0.3) })
    await settle()
    const before = await state()
    const projections = []
    for (const id of ['polyline', 'cubic', 'concatenated', 'circle', 'ellipse']) {
      const observed = await inspect(id)
      const expected = before.nodePositions[JSON.stringify([id, 'shared'])]
      close(observed.marker.x, expected.x); close(observed.marker.y, expected.y)
      assert.equal(observed.label.math, 1)
      projections.push({ id, expected, marker: observed.marker })
    }
    if (ambientDimension === 3) {
      await page.evaluate(() => window.stzLabels.setProps({ cameraOverride: {
        mode: '3d', kind: 'orthographic', thetaDeg: 70, phiDeg: 40, zoom: 110, pan: { x: 450, y: 350 },
      } }))
      await settle()
      const after = await state()
      assert.equal(after.invocationCount, before.invocationCount, '3D camera rotations do not recompile inline math')
      for (const id of ['polyline', 'cubic', 'concatenated', 'circle', 'ellipse']) {
        const observed = await inspect(id), expected = after.nodePositions[JSON.stringify([id, 'shared'])]
        close(observed.marker.x, expected.x); close(observed.marker.y, expected.y)
      }
    }
    await screenshot(`inline-path-kinds-${ambientDimension}d`)
    await record(`inline-all-supported-path-kinds-${ambientDimension}d-projected-marker-placement`, { projections })
  }

  await mount([curve('ownerA', [node('shared', source, 'above', 'dot')]), curve('ownerB', [node('shared', '$b$', 'below', 'none')])])
  await settle()
  const a = await inspect('ownerA'), b = await inspect('ownerB')
  assert.notEqual(a.label.request, b.label.request, 'Reused node IDs on different curves are independent requests')
  close(a.marker.r, 4.2); close(b.marker.r, 3.4)
  assert.equal(a.marker.fill, '#000000'); assert.equal(b.marker.fill, '#ffffff')
  const normal = await probePoint({ page, state, point: a.marker.client, expected: selection('ownerB') })
  const cycle = []
  await page.keyboard.down('Alt')
  try {
    for (let index = 0; index < 2; index++) {
      const count = (await state()).callbackEvents.length
      await page.mouse.click(a.marker.client.x, a.marker.client.y)
      const selected = await state()
      assert.equal(selected.callbackEvents.length - count, 1)
      cycle.push(selected.selection)
    }
  } finally { await page.keyboard.up('Alt') }
  assert.deepEqual(new Set(cycle.map(({ id }) => id)), new Set(['ownerA', 'ownerB']), 'Marker overlaps cycle owning curves')
  const selectedId = cycle.at(-1).id
  const selectedMarker = (await inspect(selectedId)).marker
  close(selectedMarker.r, (selectedId === 'ownerA' ? 4.2 : 3.4) + 1.4)
  assert.equal(selectedMarker.strokeWidth, '2')
  const glyphPoint = { x: a.label.rect.x + a.label.rect.width / 2, y: a.label.rect.y + a.label.rect.height / 2 }
  assert.ok(Math.abs(glyphPoint.y - a.marker.client.y) > 10, 'Glyph probe is outside the established marker tolerance')
  const glyphProbes = []
  for (const alt of [false, true]) glyphProbes.push(await probePoint({ page, state, point: glyphPoint, expected: null, alt }))
  await mount([curve('owner', [node('shared', '$x$', 'above', 'dot')])])
  await settle()
  const marker = (await inspect('owner')).marker.client
  const toleranceProbes = []
  for (const [distance, expected] of [[9, selection('owner')], [11, null]]) {
    toleranceProbes.push(await probePoint({ page, state, point: { x: marker.x, y: marker.y + distance }, expected, alt: true }))
  }
  await page.evaluate(() => window.stzLabels.setLayers([{ value: 0, name: 'Locked', locked: true }]))
  for (const alt of [false, true]) await probePoint({ page, state, point: marker, expected: null, alt })
  await record('inline-dot-nondot-highlight-native-pointer-and-marker-centered-Alt-owner-cycling', { normal, cycle, selectedMarker, glyphProbes, toleranceProbes })

  // One continuously mounted 3D document: unique marker probes on each owner,
  // plus a common model point whose markers overlap under both cameras.
  const interactionCurves = [
    curve('pick3dA', [node('shared', 'A $\\frac{P_1}{Q^2}$', 'above', 'dot', 0.2),
      node('overlap', '$a$', 'above', 'dot')], 0,
    { points: [{ x: -2, y: 0, z: 0.2 }, { x: 2, y: 0, z: 1 }] }),
    curve('pick3dB', [node('shared', 'B $\\frac{R_2}{S^3}$', 'below', 'none', 0.2),
      node('overlap', '$b$', 'below', 'none')], 0,
    { points: [{ x: 0, y: -2, z: 1 }, { x: 0, y: 2, z: 0.2 }] }),
  ]
  await startGroup('inline-node-rendering-placement-halo-picking', 'inline-3d-interaction-mount')
  await mount(interactionCurves, { ambientDimension: 3 })
  await settle()
  const mounted3d = await page.evaluateHandle(() => Array.from(document.querySelectorAll(
    'svg.svg-diagram, [data-path-inline-node-path-id], [data-label-state]')))
  const cameraStart = await state()
  const cameras = [null, { mode: '3d', kind: 'orthographic', thetaDeg: 70, phiDeg: 40, zoom: 125, pan: { x: 425, y: 335 } }]
  const ownerIds = ['pick3dA', 'pick3dB']
  const initialMarkers = []
  const initialOwners = []
  for (const [cameraIndex, cameraOverride] of cameras.entries()) {
    const name = `inline-3d-interaction-${cameraIndex === 0 ? 'initial-camera' : 'moved-camera'}`
    await startGroup('inline-node-rendering-placement-halo-picking', name)
    // Every independent probe resets using the actual blank canvas. The
    // consecutive overlap clicks below deliberately have no intervening reset.
    const blank = await page.evaluate(() => {
      const svg = document.querySelector('svg.svg-diagram')
      const point = new DOMPoint(30, 30).matrixTransform(svg.getScreenCTM())
      return { x: point.x, y: point.y }
    })
    await probePoint({ page, state, point: blank, expected: null,
      observe: (stage, details) => observe(`${name}/blank-${stage}`, details) })
    const beforeMovement = await state()
    if (cameraOverride) {
      await page.evaluate((camera) => window.stzLabels.setProps({ cameraOverride: camera }), cameraOverride)
      await settle()
    }
    const current = await state()
    const continuousMount = await page.evaluate((elements) => elements.every((element) => element.isConnected)
      && elements[0] === document.querySelector('svg.svg-diagram'), mounted3d)
    const markers = []
    for (const pathId of ownerIds) for (const nodeId of ['shared', 'overlap']) markers.push(await inspect(pathId, nodeId))
    await screenshot(name)
    const context = { cameraIndex, cameraOverride, camera: current.camera, sourceRevision: current.sourceRevision,
      ambientDimension: JSON.parse(current.json).diagram.ambientDimension, curves: current.curves,
      markers, ownerTuples: markers.map(({ label }) => JSON.parse(label.owner)), continuousMount,
      beforeMovement, current, screenshot: `${name}.png` }
    await observe(name, context)
    assert.equal(context.ambientDimension, 3)
    assert.ok(continuousMount, '3D camera update retains the same SVG, marker owners and label elements')
    assert.equal(current.sourceRevision, cameraStart.sourceRevision)
    assert.equal(current.invocationCount, cameraStart.invocationCount, '3D interaction/camera changes reuse conversions')
    rawInvariant(beforeMovement, current)
    rawInvariant(cameraStart, current)
    if (cameraIndex === 0) {
      initialMarkers.push(...markers.map(({ marker }) => marker))
      initialOwners.push(...markers.map(({ label }) => label.owner))
    } else {
      assert.deepEqual(markers.map(({ label }) => label.owner), initialOwners)
      for (const [index, { marker }] of markers.entries()) assert.ok(
        Math.hypot(marker.x - initialMarkers[index].x, marker.y - initialMarkers[index].y) > 5,
        'Rotation and pan/zoom actually move every 3D marker')
    }
    assert.notEqual(markers[0].label.request, markers[2].label.request, 'Shared local node ID keeps distinct owner/source requests')
    for (const [index, item] of markers.entries()) {
      const { pathId, nodeId, marker, label } = item
      const expected = current.nodePositions[JSON.stringify([pathId, nodeId])]
      close(marker.x, expected.x); close(marker.y, expected.y)
      assert.deepEqual(JSON.parse(label.owner), ['path-inline-node', current.sourceRevision, pathId, nodeId])
      assert.equal(label.pointerEvents, 'none'); assert.equal(label.hitRectangles, 0)
      close(marker.r, index < 2 ? 4.2 : 3.4)
      assert.equal(marker.fill, index < 2 ? '#000000' : '#ffffff')
    }
    const probes = []
    for (const pathId of ownerIds) for (const alt of [false, true]) {
      // Remeasure from the current screen CTM, including after selection redraw.
      const measured = await inspect(pathId)
      const probe = await probePoint({ page, state, point: measured.marker.client, expected: selection(pathId), alt,
        observe: (stage, details) => observe(`${name}/${pathId}-${alt ? 'alt' : 'normal'}-${stage}`, { camera: current.camera, measured, ...details }) })
      const highlighted = await inspect(pathId)
      await observe(`${name}/${pathId}-highlight`, { probe, highlighted })
      close(highlighted.marker.r, (pathId === 'pick3dA' ? 4.2 : 3.4) + 1.4)
      assert.equal(highlighted.marker.strokeWidth, '2')
      assert.equal(highlighted.marker.stroke, '#F4B400')
      probes.push({ ...probe, highlighted: highlighted.marker })
    }
    const overlap = await inspect('pick3dB', 'overlap')
    const overlapNormal = await probePoint({ page, state, point: overlap.marker.client, expected: selection('pick3dB'),
      observe: (stage, details) => observe(`${name}/overlap-normal-${stage}`, { camera: current.camera, overlap, ...details }) })
    await probePoint({ page, state, point: blank, expected: null,
      observe: (stage, details) => observe(`${name}/overlap-blank-${stage}`, details) })
    const cycles = []
    await page.keyboard.down('Alt')
    try {
      for (let index = 0; index < 2; index++) {
        const measured = await inspect('pick3dA', 'overlap'), other = await inspect('pick3dB', 'overlap')
        close(measured.marker.x, other.marker.x); close(measured.marker.y, other.marker.y)
        const before = await state()
        await page.mouse.click(measured.marker.client.x, measured.marker.client.y)
        const after = await state()
        const event = { index, measured, other, selected: after.selection, callbacks: after.callbackEvents.slice(before.callbackEvents.length) }
        await observe(`${name}/overlap-alt-${index}`, { camera: current.camera, ...event })
        assert.equal(event.callbacks.length, 1)
        assert.equal(event.selected?.kind, 'stratum')
        assert.ok(ownerIds.includes(event.selected.id))
        cycles.push(event)
      }
    } finally { await page.keyboard.up('Alt') }
    assert.deepEqual(new Set(cycles.map(({ selected }) => selected.id)), new Set(ownerIds), '3D overlap cycles both curve owners with reused local IDs')
    await screenshot(`${name}-selected`)
    const glyphClicks = []
    for (const alt of [false, true]) {
      const glyph = await page.evaluate(async () => {
        const { inspectInlineGlyphProbe } = await import('./inlineLabelBrowserOracle.ts')
        return inspectInlineGlyphProbe('pick3dA', 'shared')
      })
      await observe(`${name}/glyph-${alt ? 'alt' : 'normal'}-geometry`, glyph)
      assert.equal(glyph.glyph.insideFill, true, 'Probe intersects native filled MathJax glyph ink')
      assert.equal(glyph.glyph.pointerEvents, 'none')
      assert.equal(glyph.markerDistances.length, 4)
      assert.equal(glyph.curveDistances.length, 2)
      assert.ok(glyph.markerDistances.every(({ distance, tolerance }) => distance > tolerance))
      assert.ok(glyph.curveDistances.every(({ distance, tolerance }) => distance > tolerance))
      glyphClicks.push({ glyph, ...await probePoint({ page, state, point: glyph.client, expected: null, alt,
        observe: (stage, details) => observe(`${name}/glyph-${alt ? 'alt' : 'normal'}-${stage}`, { glyph, ...details }) }) })
    }
    rawInvariant(cameraStart, await state())
    assert.equal((await state()).invocationCount, cameraStart.invocationCount)
    await record(name, { ...context, probes, overlapNormal, cycles, glyphClicks, selectedScreenshot: `${name}-selected.png` })
  }
  await mounted3d.dispose()

  for (const mode of ['load-error', 'output-error']) {
    await page.evaluate((value) => window.stzLabels.changeService(value), mode)
    await mount([curve('adapterFailure', [node('shared', '$x$'), node('sibling', 'ordinary 日本語', 'below')])])
    await settle()
    const failed = await checkStatus('adapterFailure', '$x$', 'fallback')
    assert.deepEqual(failed.label.literal, ['$x$'])
    await checkStatus('adapterFailure', 'ordinary 日本語', 'ready', 'sibling')
  }
  await page.evaluate(() => window.stzLabels.changeService('real'))
  await mount([curve('cap', Array.from({ length: 130 }, (_, index) => node(`n${index}`, index < 2 ? (index ? ' \t\r\n ' : '') : '$x$', 'above', 'none', (index + 1) / 131)))])
  await settle()
  assert.equal(await page.locator('[data-path-inline-node-path-id="cap"]').count(), 128)
  assert.equal((await inspect('cap', 'n0')).label, null)
  assert.equal((await inspect('cap', 'n1')).label, null)
  assert.equal(await rendered('cap', 'n128').count(), 0)
  assert.equal((await state()).curves[0].inlineNodes.length, 130, 'Preview cap does not trim saved model')
  await record('inline-adapter-failure-sibling-isolation-preview-cap-and-empty-text')
  await completeGroup('inline-node-rendering-placement-halo-picking')

  await startGroup('inline-node-lifecycle-path-operations-export')
  const oldSource = '$inlineOld_{WWWW}$', newSource = '$inlineNew_i$'
  const invalidSource = '  B <tag> $g$ \\unknownRecovery{bad}\t keep  $broken\r\n tail  '
  const recoveredSource = ' recovered $\\frac{p}{q}$ and $\\Omega^2$ '
  const inlineText = (snapshot) => snapshot.curves.find(({ id }) => id === 'identityA').inlineNodes
    .find(({ id }) => id === 'shared')
  const invariantResults = (before, after) => Object.fromEntries([
    ...['json', 'history', 'tikz', 'inlineTikz'].map((key) => [key, before[key] === after[key]]),
    ['selection', JSON.stringify(before.selection) === JSON.stringify(after.selection)],
  ])
  function assertOnlyTextEdit(before, after, source) {
    const previousSource = inlineText(before).text
    const expected = JSON.parse(before.json)
    expected.diagram.strata.find(({ id }) => id === 'identityA').inlineNodes.find(({ id }) => id === 'shared').text = source
    assert.deepEqual(JSON.parse(after.json), expected, 'Intentional edit changes only the targeted owner text')
    assert.equal(after.sourceRevision, before.sourceRevision, 'Editing does not replace the mounted document')
    assert.deepEqual(after.selection, before.selection, 'Text editing preserves selection')
    const previousHistory = JSON.parse(before.history), currentHistory = JSON.parse(after.history)
    const expectedPresent = structuredClone(previousHistory.present)
    expectedPresent.strata.find(({ id }) => id === 'identityA').inlineNodes.find(({ id }) => id === 'shared').text = source
    assert.deepEqual(currentHistory.past, [...previousHistory.past, previousHistory.present], 'Each text edit records its normal undo entry')
    assert.deepEqual(currentHistory.present, expectedPresent)
    assert.deepEqual(currentHistory.future, [])
    assert.equal(after.tikz, before.tikz.replace(previousSource, source), 'Standalone TikZ changes only the exact current raw text')
    const inlineSource = (text) => text.replace(/\r\n?/gu, '\n').split('\n').filter((line) => !/^\s*$/u.test(line)).join('\n')
    assert.equal(after.inlineTikz, before.inlineTikz.replace(inlineSource(previousSource), inlineSource(source)),
      'Inline TikZ retains current text with only its established physical-line formatting')
  }
  // The synchronous DOM capture is in the same task as flushSync editing. It
  // observes removal of obsolete geometry before conversion can settle.
  const editText = (source) => page.evaluate((text) => {
    window.stzLabels.mutateInlineNode('identityA', 'shared', { text })
    const label = document.querySelector('[data-path-inline-node-path-id="identityA"][data-path-inline-node-id="shared"] [data-label-state]')
    const content = label.querySelector('[data-label-content]')
    return { state: window.stzLabels.state(), immediate: {
      source: label.getAttribute('data-label-source'), status: label.getAttribute('data-label-state'),
      owner: label.getAttribute('data-label-owner'), request: label.getAttribute('data-label-request'),
      math: content.querySelectorAll('[data-label-math]').length,
      literal: Array.from(content.querySelectorAll('[data-label-literal]'), (entry) => entry.textContent),
      tags: Array.from(content.children, (entry) => entry.tagName),
    } }
  }, source)
  await hold(oldSource); await hold(newSource)
  await mount([curve('identityA', [node('shared', oldSource)]), curve('identityB', [node('shared', '$b$')], -1)])
  await held(oldSource)
  const beforeFirstEdit = await state()
  const firstEdit = await editText(newSource)
  await observe('inline-identity-first-intentional-edit', { before: beforeFirstEdit, after: firstEdit })
  assertOnlyTextEdit(beforeFirstEdit, firstEdit.state, newSource)
  await held(newSource)
  const pending = await checkStatus('identityA', newSource, 'pending')
  assert.deepEqual(pending.label.literal, [newSource])
  rawInvariant(firstEdit.state, await state())
  await page.evaluate(() => window.stzLabels.refreshFonts())
  await page.waitForFunction((value) => window.stzLabels.state().requests.filter((entry) => entry.source === value && entry.held).length >= 2, newSource)
  rawInvariant(firstEdit.state, await state())
  await mutate('identityA', { position: { kind: 'segment', segmentIndex: 0, value: 0.7 }, options: { placement: 'right' } })
  await page.evaluate(() => window.stzLabels.select({ kind: 'stratum', id: 'identityB' }))
  const beforeRelease = await state()
  await release(newSource)
  await settle()

  // Keep handles to the actual mounted DOM owners throughout A -> B -> C.
  // Runtime ownership and sourceRevision alone could otherwise miss a remount.
  const recoveryElements = await page.evaluateHandle(() => {
    const outer = document.querySelector('[data-path-inline-node-path-id="identityA"][data-path-inline-node-id="shared"]')
    return { outer, marker: outer.querySelector(':scope > circle'), label: outer.querySelector('[data-label-state]') }
  })
  async function recoveryObservation(stage, source, baseline) {
    const current = await state(), observed = await inspect('identityA'), sibling = await inspect('identityB')
    const continuity = await page.evaluate((elements) => {
      const outer = document.querySelector('[data-path-inline-node-path-id="identityA"][data-path-inline-node-id="shared"]')
      return { outer: elements.outer === outer, marker: elements.marker === outer?.querySelector(':scope > circle'),
        label: elements.label === outer?.querySelector('[data-label-state]') }
    }, recoveryElements)
    const evidence = { stage, expectedSource: source, current, observed, sibling, continuity,
      invariants: invariantResults(baseline, current) }
    await screenshot(`inline-same-owner-recovery-${stage}`)
    await observe(`inline-same-owner-recovery-${stage}`, evidence)
    return evidence
  }
  const aReady = await recoveryObservation('A-ready', newSource, beforeRelease)
  const newest = await checkStatus('identityA', newSource)
  assert.equal(newest.label.math, 1)
  assert.ok(newest.label.mathPaths.length > 0, 'Valid A has actual compiled glyph geometry')
  assert.ok(JSON.parse(newest.label.request)[5] > JSON.parse(pending.label.request)[5], 'Latest font-readiness generation owns the completed layout')
  rawInvariant(beforeRelease, aReady.current)
  await checkStatus('identityB', '$b$')
  function assertRecoveryIdentity(evidence, expectedStatus) {
    const { current, observed, sibling, continuity } = evidence
    assert.deepEqual(continuity, { outer: true, marker: true, label: true }, 'Recovery keeps the same mounted node and marker elements')
    assert.equal(current.sourceRevision, aReady.current.sourceRevision)
    assert.equal(observed.pathId, 'identityA'); assert.equal(observed.nodeId, 'shared')
    assert.equal(observed.label.owner, newest.label.owner)
    assert.equal(observed.label.source, evidence.expectedSource)
    assert.equal(observed.label.status, expectedStatus)
    const request = JSON.parse(observed.label.request), originalRequest = JSON.parse(newest.label.request)
    assert.equal(request[0], evidence.expectedSource)
    assert.deepEqual(request.slice(1), originalRequest.slice(1), 'Current source retains current font/settings and runtime owner identity')
    assert.deepEqual(JSON.parse(observed.label.owner), ['path-inline-node', current.sourceRevision, 'identityA', 'shared'])
    assert.deepEqual(current.layouts[observed.label.owner], { id: 'shared', source: evidence.expectedSource,
      requestIdentity: observed.label.request, status: expectedStatus })
    assert.deepEqual(observed.marker, newest.marker, 'Text editing preserves marker geometry, appearance and identity')
    assert.deepEqual(inlineText(current), { ...inlineText(aReady.current), text: evidence.expectedSource },
      'Position, options, marker setting and local node identity survive recovery')
    assert.deepEqual(sibling, aReady.sibling, 'Sibling with the reused local node ID keeps its own text, status, owner and glyphs')
    assert.deepEqual(current.layouts[sibling.label.owner], aReady.current.layouts[sibling.label.owner])
    assert.equal(observed.label.pointerEvents, 'none')
    assert.equal(observed.label.hitRectangles, 0)
    assert.ok(observed.label.texts.every(({ fontSize }) => fontSize === '12px'))
    const translation = /^translate\(([-+\d.eE]+)[ ,]+([-+\d.eE]+)\)$/u.exec(observed.label.transform)
    assert.ok(translation)
    close(Number(translation[1]), observed.marker.x + 14); close(Number(translation[2]), observed.marker.y)
    const { bounds, native } = observed.label
    assert.ok(Object.values(bounds).every(Number.isFinite))
    close(bounds.minX, 0); close(bounds.minY + bounds.maxY, 0)
    for (const edge of ['minX', 'minY']) assert.ok(native[edge] >= bounds[edge] - 1)
    for (const edge of ['maxX', 'maxY']) assert.ok(native[edge] <= bounds[edge] + 1)
    for (const edge of ['minX', 'maxX']) assert.ok(Math.abs(native[edge] - bounds[edge]) < 7)
    for (const edge of ['minY', 'maxY']) assert.ok(Math.abs(native[edge] - bounds[edge]) < 12)
  }
  function assertWholeLiteral(observed, source) {
    assert.equal(observed.label.math, 0, 'Whole-current-source fallback has no obsolete compiled math')
    assert.deepEqual(observed.label.mathPaths, [])
    assert.deepEqual(observed.label.literal, source.split(/\t|\r\n/u), 'Every complete literal fragment preserves exact whitespace, delimiters and raw text')
    assert.deepEqual(observed.label.texts.map(({ text }) => text), source.split(/\t|\r\n/u), 'Fallback contains only complete current-source text')
    assert.ok(observed.label.texts.every(({ whiteSpace, xmlSpace }) => whiteSpace === 'pre' || xmlSpace === 'preserve'))
  }
  assertRecoveryIdentity(aReady, 'ready')

  const bEdit = await editText(invalidSource)
  await observe('inline-same-owner-recovery-B-immediate', { before: aReady.current, edit: bEdit })
  assertOnlyTextEdit(aReady.current, bEdit.state, invalidSource)
  assert.equal(bEdit.immediate.source, invalidSource)
  assert.equal(bEdit.immediate.owner, newest.label.owner)
  assert.equal(bEdit.immediate.math, 0, 'Invalid B removes valid A glyphs synchronously with its edit')
  assert.deepEqual(bEdit.immediate.literal, invalidSource.split(/\t|\r\n/u))
  assert.deepEqual(bEdit.immediate.tags, ['text', 'text', 'text'], 'Raw markup-like text is never injected as elements')
  await settle()
  const bFallback = await recoveryObservation('B-fallback', invalidSource, bEdit.state)
  assertRecoveryIdentity(bFallback, 'fallback')
  assertWholeLiteral(bFallback.observed, invalidSource)
  const literalTexts = bFallback.observed.label.texts
  close(literalTexts[0].y, literalTexts[1].y)
  assert.ok(literalTexts[1].x > literalTexts[0].x, 'A literal tab advances the complete following fragment')
  assert.ok(literalTexts[2].y > literalTexts[1].y, 'The original CRLF places the complete trailing fragment on its next line')
  assert.notDeepEqual(bFallback.observed.label.bounds, newest.label.bounds, 'Fallback measures current B, not old A')
  rawInvariant(bEdit.state, bFallback.current)

  await hold(recoveredSource)
  const cEdit = await editText(recoveredSource)
  await observe('inline-same-owner-recovery-C-immediate', { before: bFallback.current, edit: cEdit })
  assertOnlyTextEdit(bFallback.current, cEdit.state, recoveredSource)
  assert.equal(cEdit.immediate.math, 0)
  assert.deepEqual(cEdit.immediate.literal, [recoveredSource])
  await held(recoveredSource)
  const cPending = await recoveryObservation('C-pending', recoveredSource, cEdit.state)
  assertRecoveryIdentity(cPending, 'pending')
  assertWholeLiteral(cPending.observed, recoveredSource)
  assert.notEqual(cPending.observed.label.request, newest.label.request)
  assert.notEqual(cPending.observed.label.request, bFallback.observed.label.request)
  assert.notDeepEqual(cPending.observed.label.bounds, bFallback.observed.label.bounds, 'Pending C uses current literal layout, not stale B layout')
  rawInvariant(cEdit.state, cPending.current)
  await release(recoveredSource)
  await settle()
  const cReady = await recoveryObservation('C-ready', recoveredSource, cEdit.state)
  assertRecoveryIdentity(cReady, 'ready')
  assert.equal(cReady.observed.label.request, cPending.observed.label.request, 'Settlement retains the current C request')
  assert.equal(cReady.observed.label.math, 2, 'Recovered C renders both current math runs')
  assert.deepEqual(cReady.observed.label.literal, [])
  assert.deepEqual(cReady.observed.label.texts.map(({ text }) => text), [' recovered ', ' and ', ' '])
  assert.equal(cReady.observed.label.mathPaths.length, 4, 'C contains p, q, Omega and 2 glyph paths')
  assert.ok(cReady.observed.label.mathPaths.every((path) => !newest.label.mathPaths.includes(path)),
    'Distinct C glyphs contain none of the obsolete A glyph geometry')
  assert.notDeepEqual(cReady.observed.label.bounds, cPending.observed.label.bounds, 'Ready C measures compiled current content')
  assert.notDeepEqual(cReady.observed.label.bounds, newest.label.bounds, 'A layout cannot survive valid C recovery')
  rawInvariant(cEdit.state, cReady.current)

  // The original obsolete request completes only after the same owner has fully
  // recovered, so its failure cannot restore either earlier glyphs or bounds.
  await release(oldSource, true)
  const afterObsoleteFailure = await recoveryObservation('C-ready-after-obsolete-failure', recoveredSource, cEdit.state)
  assertRecoveryIdentity(afterObsoleteFailure, 'ready')
  assert.deepEqual(afterObsoleteFailure.observed, cReady.observed, 'Late obsolete failure cannot replace recovered C glyphs, settings, marker or layout')
  rawInvariant(cEdit.state, afterObsoleteFailure.current)
  await record('inline-same-node-ID-across-owners-source-font-placement-and-inverted-failure', {
    pending, newest, recovered: cReady.observed, requests: afterObsoleteFailure.current.requests,
  })
  await record('inline-same-owner-valid-invalid-valid-recovery', { aReady, bEdit, bFallback, cEdit, cPending, cReady, afterObsoleteFailure })
  await recoveryElements.dispose()

  const operationSource = '  raw $\\frac{a}{b}$ text  '
  await mount([curve('operations', [node('shared', operationSource, 'above', 'dot', 0.25), node('late', '日本語 $g$', 'below', 'none', 0.75)])])
  await settle()
  const original = await state()
  const originalMarker = (await inspect('operations')).marker
  await page.evaluate(() => window.stzLabels.reverseCurve('operations'))
  await settle()
  const reversed = await state()
  assert.equal(reversed.curves[0].inlineNodes[0].position.value, 0.75)
  close((await inspect('operations')).marker.x, originalMarker.x)
  close((await inspect('operations')).marker.y, originalMarker.y)
  assert.equal(reversed.invocationCount, original.invocationCount)
  await page.evaluate(() => window.stzLabels.undo())
  assert.deepEqual((await state()).curves, original.curves)
  await page.evaluate(() => window.stzLabels.redo())
  assert.deepEqual((await state()).curves, reversed.curves)
  await page.evaluate(() => window.stzLabels.duplicateCurve('operations'))
  await settle()
  const duplicated = await state()
  assert.equal(duplicated.curves.length, 2)
  const copy = duplicated.curves.find(({ id }) => id !== 'operations')
  assert.equal(copy.inlineNodes[0].text, operationSource)
  await checkStatus(copy.id, operationSource, 'ready', copy.inlineNodes[0].id)
  assert.equal(duplicated.invocationCount, original.invocationCount)
  await page.evaluate(() => window.stzLabels.splitCurve('operations', 0, 0.5))
  await settle()
  const split = await state()
  assert.ok(!split.curves.some(({ id }) => id === 'operations'))
  assert.equal(split.curves.length, 3)
  const fragments = split.curves.filter(({ id }) => id !== copy.id)
  assert.deepEqual(fragments.flatMap(({ inlineNodes }) => inlineNodes.map(({ text }) => text)).sort(), [operationSource, '日本語 $g$'].sort())
  for (const fragment of fragments) for (const item of fragment.inlineNodes) await checkStatus(fragment.id, item.text, 'ready', item.id)
  assert.equal(split.invocationCount, original.invocationCount)
  assert.ok(split.tikz.includes('node[pos='))
  assert.ok(split.tikz.includes(operationSource))
  assert.ok(!/\n\s*\n/u.test(split.inlineTikz))
  await page.evaluate(() => window.stzLabels.roundTrip())
  await settle()
  assert.equal((await state()).json, split.json)
  assert.equal((await state()).tikz, split.tikz)
  await record('inline-production-reversal-duplicate-split-save-load-undo-redo-raw-TikZ', { original: original.curves, reversed: reversed.curves, duplicated: duplicated.curves, split: split.curves })

  for (const operation of ['delete', 'replace', 'split', 'duplicate', 'reverse']) {
    const heldSource = `$inlineHeld_{${operation}}$`
    await hold(heldSource)
    await mount([curve('retired', [node('shared', heldSource, 'above', 'dot', 0.25)])])
    await held(heldSource)
    const retiredOwner = (await inspect('retired')).label.owner
    if (operation === 'delete') await page.evaluate(() => window.stzLabels.deleteCurve('retired'))
    if (operation === 'replace') await mount([curve('retired', [node('shared', '$replacement$')])])
    if (operation === 'split') await page.evaluate(() => window.stzLabels.splitCurve('retired'))
    if (operation === 'reverse') await page.evaluate(() => window.stzLabels.reverseCurve('retired'))
    if (operation === 'duplicate') {
      await page.evaluate(() => window.stzLabels.duplicateCurve('retired'))
      await mutate('retired', { text: '$originalNowDifferent$' })
    }
    const current = await state()
    await release(heldSource)
    await settle()
    rawInvariant(current, await state())
    if (['delete', 'split', 'replace'].includes(operation)) {
      assert.ok(!(retiredOwner in (await state()).layouts), 'Retired node owner leaves the shared settled-layout interface')
    }
    if (['delete', 'split'].includes(operation)) assert.equal(await rendered('retired').count(), 0)
    if (operation === 'replace') await checkStatus('retired', '$replacement$')
    if (operation === 'duplicate') await checkStatus('retired', '$originalNowDifferent$')
    if (operation === 'reverse') assert.equal((await state()).curves[0].inlineNodes[0].position.value, 0.75)
    for (const owner of (await state()).curves) for (const item of owner.inlineNodes ?? []) await checkStatus(owner.id, item.text, 'ready', item.id)
    await record(`inline-delayed-completion-after-${operation}`, { curves: (await state()).curves, requests: (await state()).requests.filter(({ source }) => source === heldSource) })
  }

  await mount([curve('export', [node('shared', '$\\frac{a}{b}$'), node('literal', raw, 'below', 'dot')])])
  await settle()
  await page.evaluate(() => window.stzLabels.select({ kind: 'stratum', id: 'export' }))
  for (const background of ['transparent', 'white']) {
    const exported = await page.evaluate((value) => window.stzLabels.export(value), background)
    const observed = await page.evaluate(({ source, raw }) => {
      const document = new DOMParser().parseFromString(source, 'image/svg+xml')
      // Export deliberately removes editor data attributes; source titles and
      // native geometry identify the two labels in the standalone document.
      const groups = Array.from(document.querySelectorAll('g'))
      const label = groups.find((group) => group.querySelector(':scope > title')?.textContent === '$\\frac{a}{b}$')
      // XML may normalize CRLF in title nodes; visible fragments below still
      // assert every original space/backslash, with source/model equality above.
      const literal = groups.find((group) => group.querySelector(':scope > title')?.textContent
        ?.replace(/\r\n?/gu, '\n') === raw.replace(/\r\n?/gu, '\n'))
      return { errors: document.querySelectorAll('parsererror').length, math: label.querySelectorAll('path').length,
        raw: Array.from(literal.querySelectorAll('text')).filter((text) => !text.closest('[aria-hidden="true"]')).map((text) => text.textContent),
        hiddenHalos: document.querySelectorAll('g[aria-hidden="true"]').length,
        hiddenLiteral: literal.querySelectorAll('g[aria-hidden="true"] text').length,
        overlays: document.querySelectorAll('[data-svg-export-exclude]').length,
        forbidden: document.querySelectorAll('foreignObject,image').length }
    }, { source: exported, raw })
    assert.equal(observed.errors, 0); assert.ok(observed.math > 0)
    assert.deepEqual(observed.raw, raw.split(/\t|\r\n/u)); assert.equal(observed.overlays, 0); assert.equal(observed.forbidden, 0)
    assert.equal(observed.hiddenHalos, 2, 'Standalone decorative halo layers retain aria-hidden')
    assert.equal(observed.hiddenLiteral, 3, 'Outlined fallback text has only one accessible copy')
    await writeFile(resolve(artifactDir, `inline-current-export-${background}.svg`), exported)
  }
  await screenshot('inline-current-export')
  await record('inline-current-SVG-export-settled-formulas-current-literal-and-no-editor-overlays')
  await completeGroup('inline-node-lifecycle-path-operations-export')
}
