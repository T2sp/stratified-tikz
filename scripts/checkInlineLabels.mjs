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
  const inspect = (pathId, nodeId = 'shared', rasterize = false) => page.evaluate(async (input) => {
    const { inspectInlineLabel } = await import('./inlineLabelBrowserOracle.ts')
    return inspectInlineLabel(input.pathId, input.nodeId, input.rasterize)
  }, { pathId, nodeId, rasterize })
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
      const observed = await inspect(placement, 'shared', true)
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
      assert.ok(raster.maxCompositeError <= 2,
        `${caseName}: independent foreground-over-halo maxCompositeError=${raster.maxCompositeError} must be <=2`)
      assert.ok(raster.addedWhite > 10, `${caseName}: addedWhite=${raster.addedWhite} must exceed 10 visible outline pixels`)
      assert.ok(raster.furthestAddedPixel <= 3,
        `${caseName}: furthestAddedPixel=${raster.furthestAddedPixel} must be <=3 display units`)
      assert.ok(raster.distantClear > 10, `${caseName}: distantClear=${raster.distantClear} must exceed 10 gap pixels`)
      assert.equal(raster.distantFilled, 0, `${caseName}: fraction gaps and text spaces have no opaque background`)
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
  assert.ok(transparent.label.raster.maxCompositeError <= 2,
    `inline-transparent-math: maxCompositeError=${transparent.label.raster.maxCompositeError} must be <=2`)
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
  await hold(oldSource); await hold(newSource)
  await mount([curve('identityA', [node('shared', oldSource)]), curve('identityB', [node('shared', '$b$')], -1)])
  await held(oldSource)
  await mutate('identityA', { text: newSource })
  await held(newSource)
  const pending = await checkStatus('identityA', newSource, 'pending')
  assert.deepEqual(pending.label.literal, [newSource])
  await page.evaluate(() => window.stzLabels.refreshFonts())
  await page.waitForFunction((value) => window.stzLabels.state().requests.filter((entry) => entry.source === value && entry.held).length >= 2, newSource)
  await mutate('identityA', { position: { kind: 'segment', segmentIndex: 0, value: 0.7 }, options: { placement: 'right' } })
  await page.evaluate(() => window.stzLabels.select({ kind: 'stratum', id: 'identityB' }))
  const beforeRelease = await state()
  await release(newSource)
  await settle()
  const newest = await checkStatus('identityA', newSource)
  assert.ok(JSON.parse(newest.label.request)[5] > JSON.parse(pending.label.request)[5], 'Latest font-readiness generation owns the completed layout')
  rawInvariant(beforeRelease, await state())
  await release(oldSource, true)
  assert.deepEqual((await inspect('identityA')).label, newest.label, 'Late obsolete failure cannot change current source/settings/placement')
  rawInvariant(beforeRelease, await state())
  await checkStatus('identityB', '$b$')
  await mutate('identityA', { text: 'current invalid $' })
  assert.equal((await inspect('identityA')).label.math, 0)
  await settle()
  await checkStatus('identityA', 'current invalid $', 'fallback')
  await record('inline-same-node-ID-across-owners-source-font-placement-and-inverted-failure', { pending, newest, requests: (await state()).requests })

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
