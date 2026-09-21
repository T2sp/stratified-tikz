/** Development-fixture browser coverage; imported by checkFreeLabels.mjs. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'

export const applyMatrix = ({ a, b, c, d, e, f }, { x, y }) => ({ x: a * x + c * y + e, y: b * x + d * y + f })
export const inspectContent = (page, id) => page.evaluate((labelId) => window.stzLabels.inspectContent(labelId), id)
const eventList = (state) => state.callbackEvents ?? state.selectionEvents

/** Clicks are genuine mouse events. Reset via the canvas before EVERY probe;
 * neither a preexisting selection nor a selected drag handle can mask a miss. */
export async function probePoint({ page, point, expected, state, alt = false, resetPoint }) {
  const blank = resetPoint ?? await page.evaluate(() => {
    const svg = document.querySelector('svg.svg-diagram')
    const point = new DOMPoint(30, 30).matrixTransform(svg.getScreenCTM())
    return { x: point.x, y: point.y }
  })
  await page.mouse.click(blank.x, blank.y)
  const reset = await state()
  assert.equal(reset.selection, null, 'Blank canvas click clears selection before probe')
  const before = eventList(reset).length
  if (alt) await page.keyboard.down('Alt')
  try { await page.mouse.click(point.x, point.y) } finally { if (alt) await page.keyboard.up('Alt') }
  const after = await state()
  assert.deepEqual(after.selection, expected, `${alt ? 'Alt' : 'normal'} pointer ${JSON.stringify(point)} selection`)
  const callbacks = eventList(after).slice(before)
  assert.equal(callbacks.length, 1, 'Exactly one production selection callback for one pointer click')
  return { point, mode: alt ? 'alt' : 'normal', expected, selected: after.selection, callbacks,
    reset: { point: blank, selected: reset.selection } }
}

export async function probeLabelBoundaries({ page, id, evidence, state, resetPoint }) {
  const box = evidence.published
  const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }
  const inside = Math.min(1, (box.maxX - box.minX) / 4, (box.maxY - box.minY) / 4)
  const probes = []
  for (const alt of [false, true]) {
    probes.push({ kind: 'center', ...await probePoint({ page, state, alt, resetPoint,
      point: applyMatrix(evidence.localToClient, center), expected: { kind: 'label', id } }) })
    for (const edge of ['west', 'east', 'north', 'south']) {
      const horizontal = edge === 'west' || edge === 'east'
      const low = edge === 'west' || edge === 'north'
      const coordinate = horizontal ? 'x' : 'y'
      const boundary = horizontal ? (low ? box.minX : box.maxX) : (low ? box.minY : box.maxY)
      // Normal events target the SVG hit rectangle. Alt cycling additionally
      // allows 6/4 padding + 8 tolerance. Each outside probe clears its
      // applicable policy by two SVG units.
      const tolerance = horizontal ? evidence.tolerances.altPointerPadding.x : evidence.tolerances.altPointerPadding.y
      const outsideDistance = (alt ? tolerance : 0) + 2
      for (const within of [true, false]) {
        const local = { ...center, [coordinate]: boundary + (low ? 1 : -1) * (within ? inside : -outsideDistance) }
        probes.push({ edge, kind: within ? 'inside' : 'outside', local, distanceFromPublishedEdge: within ? inside : outsideDistance,
          applicableTolerance: alt ? tolerance : 0,
          ...await probePoint({ page, state, alt, resetPoint, point: applyMatrix(evidence.localToClient, local),
            expected: within ? { kind: 'label', id } : null }) })
      }
      // Also verify a point just INSIDE the outer Alt tolerance, so padding is
      // actually observed rather than only avoiding it on all outside probes.
      if (alt) {
        const local = { ...center, [coordinate]: boundary + (low ? -1 : 1) * (tolerance - 1) }
        probes.push({ edge, kind: 'inside-alt-tolerance', local, distanceFromPublishedEdge: tolerance - 1, applicableTolerance: tolerance,
          ...await probePoint({ page, state, alt, resetPoint, point: applyMatrix(evidence.localToClient, local), expected: { kind: 'label', id } }) })
      }
    }
  }
  return probes
}

function verifyIndependentAnchor(measurement, anchor, projected) {
  const { inkSvg, localToSvg, tolerances } = measurement
  const translation = /^translate\(([-+\d.eE]+)[ ,]+([-+\d.eE]+)\)$/u.exec(measurement.anchorTransform)
  assert.ok(translation, 'Rendered anchor has a single translation')
  const authored = { x: Number(translation[1]), y: Number(translation[2]) }
  assert.ok(Math.abs(authored.x - projected.x) < 1e-5 && Math.abs(authored.y - projected.y) < 1e-5,
    'Authored anchor follows projected model coordinates')
  // Chrome exposes SVG matrices with float32-rounded translations. Keep the
  // authored-coordinate check strict and bound only this native readback by
  // one float32 ULP at the coordinate magnitude (about 0.00006 at x=533).
  const nativeAllowance = Object.fromEntries(['x', 'y'].map((axis) =>
    [axis, 2 ** (Math.floor(Math.log2(Math.max(1, Math.abs(projected[axis])))) - 23) + 1e-5]))
  assert.ok(Math.abs(localToSvg.e - projected.x) <= nativeAllowance.x && Math.abs(localToSvg.f - projected.y) <= nativeAllowance.y,
    'Native rendered anchor follows projected model coordinates within SVG matrix precision')
  const measuredX = anchor.includes('west') ? inkSvg.minX : anchor.includes('east') ? inkSvg.maxX : (inkSvg.minX + inkSvg.maxX) / 2
  const measuredY = anchor.includes('north') ? inkSvg.minY : anchor.includes('south') ? inkSvg.maxY : (inkSvg.minY + inkSvg.maxY) / 2
  assert.ok(Math.abs(measuredX - projected.x) <= tolerances.horizontal, `${anchor} ink horizontal placement within documented advance allowance`)
  assert.ok(Math.abs(measuredY - projected.y) <= tolerances.vertical, `${anchor} ink vertical placement within documented leading allowance`)
  return { projected, authored, nativeAllowance, measuredInkAnchor: { x: measuredX, y: measuredY },
    deviations: { x: measuredX - projected.x, y: measuredY - projected.y }, tolerances }
}

async function negativeControls(page, id) {
  return page.evaluate(async (labelId) => {
    const { inspectLabelContent, assertLabelContent } = await import('./labelBrowserOracle.ts')
    const node = document.querySelector(`[data-label-id="${labelId}"] [data-label-state]`)
    const hit = node.querySelector(':scope > rect[data-svg-export-exclude]')
    const saved = { published: node.getAttribute('data-label-bounds'), x: hit.getAttribute('x'), y: hit.getAttribute('y'),
      width: hit.getAttribute('width'), height: hit.getAttribute('height') }
    const fontSize = window.stzLabels.state().labels.find(({ id }) => id === labelId).style.fontSize * 1.35
    const original = await inspectLabelContent(labelId, { fontSize })
    const results = []
    try {
      for (const kind of ['inflated', 'displaced']) {
        const b = original.published, delta = fontSize * 8
        const bad = kind === 'inflated'
          ? { minX: b.minX - delta, minY: b.minY - delta, maxX: b.maxX + delta, maxY: b.maxY + delta }
          : { minX: b.minX + delta, minY: b.minY + delta, maxX: b.maxX + delta, maxY: b.maxY + delta }
        node.setAttribute('data-label-bounds', `${bad.minX} ${bad.minY} ${bad.maxX} ${bad.maxY}`)
        hit.setAttribute('x', String(bad.minX)); hit.setAttribute('y', String(bad.minY))
        hit.setAttribute('width', String(bad.maxX - bad.minX)); hit.setAttribute('height', String(bad.maxY - bad.minY))
        const observed = await inspectLabelContent(labelId, { fontSize })
        let rejection = null
        try { assertLabelContent(observed) } catch (error) { rejection = String(error) }
        results.push({ kind, original, observed, rejection })
      }
    } finally {
      node.setAttribute('data-label-bounds', saved.published)
      for (const key of ['x', 'y', 'width', 'height']) hit.setAttribute(key, saved[key])
    }
    assertLabelContent(await inspectLabelContent(labelId, { fontSize }))
    return results
  }, id)
}

export async function runGeometryChecks({ page, record, artifactDir, startGroup, completeGroup }) {
  const state = () => page.evaluate(() => window.stzLabels.state())
  const mount = (options) => page.evaluate((next) => window.stzLabels.mount(next), options)
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'))
  const screenshot = async (name) => {
    if (!artifactDir) return null
    const path = resolve(artifactDir, `geometry-${name}.png`)
    await page.screenshot({ path, fullPage: true })
    return path
  }
  await startGroup('independent-oracle-negative-controls')
  const anchors = ['center', 'north', 'south', 'east', 'west', 'north east', 'north west', 'south east', 'south west']
  const tall = '$\\frac{1}{1+\\frac{x}{1+\\frac{y}{z}}}$'
  const compact = '$\\mathord{\\mathord{\\mathord{\\alpha}}}$'
  for (const anchor of anchors) {
    await mount({ labels: [{ id: 'allAnchors', text: tall, position: { x: 0.2, y: 0.1, z: 0 }, style: { anchor, fontSize: 22 } }] })
    await settle()
    const measurement = await inspectContent(page, 'allAnchors'), current = await state()
    const placement = verifyIndependentAnchor(measurement, anchor, current.positions.allAnchors)
    await record(`independent-content-nine-anchors/${anchor}`, { source: tall, anchor, camera: current.camera, measurement, placement })
  }
  const controls = await negativeControls(page, 'allAnchors')
  for (const item of controls) {
    assert.ok(item.rejection, `${item.kind} published/hit box rejected by independent painted content`)
    assert.deepEqual(item.observed.ink, item.original.ink, 'Negative control leaves actual painted ink unchanged')
  }
  await record('independent-content-negative-controls-inflation-and-displacement', { controls,
    screenshot: await screenshot('negative-controls-restored') })

  await completeGroup('independent-oracle-negative-controls')
  await startGroup('boundary-anchor-camera-matrix')

  // A pointer physically over filled glyph ink still produces exactly one
  // outer-label callback: internal MathJax paths are not independent targets.
  await mount({ labels: [{ id: 'glyph', text: tall, position: { x: 0, y: 0, z: 0 }, style: { fontSize: 30 } }] })
  await settle()
  const glyphPoint = await page.evaluate(() => {
    for (const path of document.querySelectorAll('[data-label-id="glyph"] [data-label-math] path')) {
      const box = path.getBBox()
      for (let row = 1; row < 10; row++) for (let column = 1; column < 10; column++) {
        const local = new DOMPoint(box.x + box.width * column / 10, box.y + box.height * row / 10)
        if (!path.isPointInFill(local)) continue
        const point = local.matrixTransform(path.getScreenCTM())
        return { point: { x: point.x, y: point.y }, pathPoint: { x: local.x, y: local.y },
          pathTransform: Array.from(['a', 'b', 'c', 'd', 'e', 'f'], (key) => path.getScreenCTM()[key]),
          pathFill: getComputedStyle(path).fill, pointerEvents: getComputedStyle(path).pointerEvents }
      }
    }
    throw new Error('Could not find a native filled point inside an actual MathJax path')
  })
  const glyphClicks = []
  for (const alt of [false, true]) glyphClicks.push(await probePoint({ page, point: glyphPoint.point,
    expected: { kind: 'label', id: 'glyph' }, state, alt }))
  await record('internal-MathJax-path-real-pointer-single-callback', { source: tall, glyphPoint, glyphClicks,
    measurement: await inspectContent(page, 'glyph'), screenshot: await screenshot('internal-path') })

  await mount({ labels: [
    { id: 'mixedMath', text: compact, position: { x: 0, y: 0, z: 0 }, style: { fontSize: 24 } },
    { id: 'mixedFallback', text: 'invalid $', position: { x: 0, y: 0, z: 0 }, style: { fontSize: 24 } },
  ] })
  await settle()
  const mixedMath = await inspectContent(page, 'mixedMath'), mixedFallback = await inspectContent(page, 'mixedFallback')
  assert.equal(mixedMath.status, 'ready'); assert.equal(mixedFallback.status, 'fallback')
  const overlap = { minX: Math.max(mixedMath.published.minX, mixedFallback.published.minX),
    minY: Math.max(mixedMath.published.minY, mixedFallback.published.minY),
    maxX: Math.min(mixedMath.published.maxX, mixedFallback.published.maxX),
    maxY: Math.min(mixedMath.published.maxY, mixedFallback.published.maxY) }
  assert.ok(overlap.maxX > overlap.minX && overlap.maxY > overlap.minY)
  const point = applyMatrix(mixedMath.localToClient, { x: (overlap.minX + overlap.maxX) / 2, y: (overlap.minY + overlap.maxY) / 2 })
  const normal = await probePoint({ page, point, expected: { kind: 'label', id: 'mixedFallback' }, state })
  const cycles = []
  await page.keyboard.down('Alt')
  try {
    for (let index = 0; index < 2; index++) {
      const before = eventList(await state()).length
      await page.mouse.click(point.x, point.y)
      const after = await state(), callbacks = eventList(after).slice(before)
      assert.equal(callbacks.length, 1, 'One callback per mixed-overlap Alt click')
      cycles.push({ point, selected: after.selection, callbacks })
    }
  } finally { await page.keyboard.up('Alt') }
  assert.deepEqual(new Set(cycles.map(({ selected }) => selected?.id)), new Set(['mixedMath', 'mixedFallback']))
  await record('mixed-compiled-fallback-production-overlap-cycling', { measurements: [mixedMath, mixedFallback], overlap, normal, cycles,
    screenshot: await screenshot('mixed-overlap') })

  for (const [formula, source] of [['tall', tall], ['compact', compact]]) for (const anchor of ['center', 'north', 'east']) {
    const id = 'boundary'
    await mount({ labels: [{ id, text: source, position: { x: 0.45, y: 0.2, z: 0 }, style: { anchor, fontSize: 24 } }] })
    await settle()
    const conversionCount = (await state()).invocationCount
    for (const scenario of ['2d', '2d-panzoom', '3d-changed-camera']) {
      if (scenario === '2d-panzoom') await page.evaluate(() => window.stzLabels.setProps({ cameraViewAdjustment: { zoom: 1.7, pan: { x: 47, y: -29 } } }))
      if (scenario === '3d-changed-camera') {
        await mount({ ambientDimension: 3, labels: [{ id, text: source, position: { x: 0.6, y: 0.4, z: 0.7 }, style: { anchor, fontSize: 24 } }] })
        await settle()
        const count = (await state()).invocationCount
        await page.evaluate(() => window.stzLabels.setProps({ cameraOverride: { mode: '3d', kind: 'orthographic', thetaDeg: 70, phiDeg: 40, zoom: 130, pan: { x: 440, y: 320 } } }))
        assert.equal((await state()).invocationCount, count, '3D camera update did not recompile')
      }
      const measurement = await inspectContent(page, id), current = await state()
      const placement = verifyIndependentAnchor(measurement, anchor, current.positions[id])
      const probes = await probeLabelBoundaries({ page, id, evidence: measurement, state })
      assert.equal((await state()).invocationCount, conversionCount, 'Camera/selection-only changes reuse conversion')
      const obsoleteRawWidth = source.length * measurement.fontSize * 0.58
      const inkWidth = measurement.ink.maxX - measurement.ink.minX
      let obsoleteEstimateProbes = []
      if (formula === 'compact') {
        assert.ok(obsoleteRawWidth > inkWidth * 6, 'Compact formula strongly distinguishes source length from display width')
        const box = measurement.published
        const local = { x: anchor === 'east' ? box.minX - 30 : box.maxX + 30, y: (box.minY + box.maxY) / 2 }
        const old = anchor === 'east' ? { minX: -obsoleteRawWidth, maxX: 0 } : { minX: -obsoleteRawWidth / 2, maxX: obsoleteRawWidth / 2 }
        assert.ok(local.x > old.minX && local.x < old.maxX, 'Probe lies inside obsolete raw-source estimate')
        for (const alt of [false, true]) obsoleteEstimateProbes.push({ local, old, ...await probePoint({ page, state, alt,
          point: applyMatrix(measurement.localToClient, local), expected: null }) })
      }
      await record(`boundary-matrix/${formula}/${anchor}/${scenario}`, { source, rawLength: source.length, formula, anchor, scenario,
        camera: current.camera, position: current.labels[0].position, measurement, placement, inkWidth, obsoleteRawWidth,
        probes, obsoleteEstimateProbes, conversionCount, screenshot: await screenshot(`${formula}-${anchor}-${scenario}`) })
    }
    // Paint/position are tested separately so reuse cannot be inferred only
    // from camera and selection, and transformed boundaries are rechecked.
    await page.evaluate(() => window.stzLabels.mutateLabel('boundary', { position: { x: -0.4, y: 0.7, z: 1.1 },
      style: { color: '#bb276b', opacity: 0.43 } }))
    await settle()
    const moved = await inspectContent(page, id)
    const probes = await probeLabelBoundaries({ page, id, evidence: moved, state })
    assert.equal((await state()).invocationCount, conversionCount, 'Position/paint/opacity do not recompile')
    await record(`boundary-position-paint-reuse/${formula}/${anchor}`, { source, anchor, measurement: moved, probes, conversionCount })
  }
  await completeGroup('boundary-anchor-camera-matrix')
}
