import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pointNodeScenarioArtifacts } from './automation/phase-verification.mjs'
import { observePointLiteral, assertPositionedLiteral, pointLiteralNegativeControls } from './pointLiteralOracle.mjs'
import { createPointDiagnostics, capturePointCheck } from './pointCheckDiagnostics.mjs'
import { runNativePointChecks } from './checkPointNodesApp.mjs'
import { withOwnedFontFace, observeOwnedFontFace, assertRestoredPointFont } from './ownedFontFace.mjs'
import { observeCircleSelection, assertCircleSelection } from './pointSelectionOracle.mjs'

// Independent declaration for the resource/font fixture below, including its
// legacy border contract. Do not resolve this expectation from production paint.
const resourceBorder = Object.freeze({ enabled: true, widthPt: .4, opacity: 1 })

export async function inspectPoint(page, id) {
  const point = await page.evaluate((id) => {
    const outer = document.querySelector(`[data-point-id="${CSS.escape(id)}"]`)
    const point = outer?.querySelector('[data-point-node]')
    if (!point) return null
    const body = point.querySelector('[data-label-state]')
    const contour = point.querySelector('[data-point-contour]')
    const matrix = point.getScreenCTM()
    const b = body.getBBox()
    const bounds = body.getAttribute('data-label-bounds').split(' ').map(Number)
    const shape = contour.getBBox()
    const radiusAttribute = contour.getAttribute('r')
    const coord = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(matrix); return { x: p.x, y: p.y } }
    const east = contour.localName === 'circle' ? { x: Number(contour.getAttribute('r')), y: 0 }
      : { x: contour.points.getItem(0).x, y: contour.points.getItem(0).y }
    const model = JSON.parse((window.stzLabels ?? window.stzAppLabels).state().json).diagram
    const stratum = model.strata.find((item) => item.id === id)
    return { ambientDimension: model.ambientDimension, pointShape: stratum?.style.shape, style: stratum?.style,
      runtime: (window.stzLabels ?? window.stzAppLabels).pointRuntime(), modelSource: stratum?.text ?? '',
      source: body.getAttribute('data-label-source'), request: body.getAttribute('data-label-request'),
      pointRequest: point.getAttribute('data-point-request'), owner: point.getAttribute('data-point-node'),
      status: body.getAttribute('data-label-state'), math: body.querySelectorAll('[data-label-math]').length,
      texts: [...body.querySelectorAll('text')].map((e) => e.textContent),
      bounds, body: { x: b.x, y: b.y, width: b.width, height: b.height },
      shape: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
      radius: contour.localName === 'circle' && radiusAttribute?.trim() ? Number(radiusAttribute) : null,
      contourAttributes: { kind: contour.localName, radius: radiusAttribute, stroke: contour.getAttribute('stroke'),
        strokeWidth: contour.getAttribute('stroke-width'), strokeOpacity: contour.getAttribute('stroke-opacity') },
      contour: contour.outerHTML, center: coord(0, 0), inside: coord(east.x * .98, east.y * .98),
      outside: coord(shape.x + shape.width + 9, 0), transform: point.getAttribute('transform'),
      opacity: String(Number(getComputedStyle(contour).fillOpacity) * Number(getComputedStyle(contour).opacity)), outerOpacity: outer.getAttribute('opacity'),
      pointerEvents: getComputedStyle(outer).pointerEvents,
      highlight: point.querySelector('[data-svg-export-exclude]')?.getAttribute('r') ?? null,
    }
  }, id)
  if (point) point.literalObservation = await observePointLiteral(page, { id })
  return point
}
export function assertPointLayout(point) {
  assert.ok(point)
  assert.equal(point.pointRequest, point.request, 'Contour and body share the same committed request')
  assert.equal(JSON.parse(point.request)[0], point.source)
  assert.equal(point.modelSource, point.source, 'Exact model/editor source including structural whitespace')
  assert.ok([...point.bounds, ...Object.values(point.shape)].every(Number.isFinite))
  const [x0, y0, x1, y1] = point.bounds
  // Native SVG bounds, not another invocation of the layout helper.
  if (point.source.trim()) {
    assert.ok(point.body.x >= x0 - 1 && point.body.y >= y0 - 1, JSON.stringify(point))
    assert.ok(point.body.x + point.body.width <= x1 + 1 && point.body.y + point.body.height <= y1 + 1, JSON.stringify(point))
  }
  assert.ok(point.shape.x <= x0 + .01 && point.shape.y <= y0 + .01)
  assert.ok(point.shape.x + point.shape.width >= x1 - .01 && point.shape.y + point.shape.height >= y1 - .01)
}
export async function runPointNodeChecks(context) {
  const { page, artifactDir, startGroup, completeGroup, record, observe } = context
  const bodyGroup = 'point-node-body-layout-lifecycle', pickingGroup = 'point-node-picking-visibility'
  const state = () => page.evaluate(() => window.stzLabels.state())
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  const mount = (points, extra = {}) => page.evaluate((options) => window.stzLabels.mount(options), { labels: [], points, ...extra })
  const diagnose = createPointDiagnostics(context)
  let scenario = 'point-language-shapes-2d-3d', caseDetails = {}
  const inspect = async () => {
    return capturePointCheck(() => inspectPoint(page, 'p'), async (details) => {
      // Persist the complete selection calculation and model/history identity
      // before any lifecycle assertion, including failures during restoration.
      const selectionDetails = scenario === 'point-resource-retry-font-readiness' ? {
        circleSelection: observeCircleSelection(details.point, resourceBorder), state: await state(),
      } : {}
      return diagnose(scenario.startsWith('point-contour') || scenario.startsWith('point-camera') || scenario.startsWith('point-hidden') ? pickingGroup : bodyGroup,
        scenario, { ...caseDetails, ...details, ...selectionDetails })
    })
  }
  const mutate = (change) => page.evaluate((change) => window.stzLabels.mutatePoint('p', change), change)
  const invariant = (a, b) => { for (const key of ['json', 'history', 'tikz', 'inlineTikz']) assert.equal(a[key], b[key], key) }
  async function saved(name, details, group) {
    const artifact = `${name}.json`
    await writeFile(resolve(artifactDir, artifact), JSON.stringify(details, null, 2) + '\n')
    await observe(`${name}-observed`, { artifact })
    await record(name, { group, result: 'passed', artifacts: pointNodeScenarioArtifacts(name) })
  }
  context.setStage?.(bodyGroup)
  await startGroup(bodyGroup)
  await page.evaluate(() => window.stzLabels.changeService('real'))
  const language = ['', '   ', 'plain gyp', '日本語', '$x_1^2$', '\\(\\sqrt{x}\\)', '$$\\frac{a}{b}$$', '\\[g_j\\]',
    ' 日本 $\\frac{a_1}{\\sqrt{b}}$ + \\(y^2\\)\n尾', '  $\\unknownPointMacro$\t\\slash\n tail  ']
  const observed = []
  for (const ambientDimension of [2, 3]) for (const shape of ['circle', 'square', 'triangle', 'star']) {
    for (const text of language) {
      caseDetails = { ambientDimension, shape, source: text }
      await mount([{ id: 'p', text, style: { shape } }], { ambientDimension })
      const before = await state()
      await settle()
      const point = await inspect(); assertPointLayout(point)
      assert.equal(point.source, text)
      assert.equal(point.status, text.includes('unknown') ? 'fallback' : 'ready')
      if (point.status === 'fallback') assertPositionedLiteral(point.literalObservation, text)
      invariant(before, await state())
      observed.push({ ambientDimension, shape, text, point })
    }
  }
  for (const text of ['  $bad\t\tend  ', '\n\t$bad\r\n\r tail  \t\n', '\t\n\r\n\r\t',
    '  $\\missingNativePoint$\t\n tail  ', '$bad\nA\u0302\u0301\t\n\n日g\r\n \t\r\t']) {
    caseDetails = { ambientDimension: 2, shape: 'circle', source: text }
    await mount([{ id: 'p', text }]); await settle()
    const point = await inspect(); assertPointLayout(point)
    assertPositionedLiteral(point.literalObservation, text)
    observed.push({ ...caseDetails, point })
  }
  const controlSource = language.at(-1)
  await mount([{ id: 'p', text: controlSource }]); await settle()
  const controls = await pointLiteralNegativeControls(page, 'p', controlSource,
    (control, observation) => diagnose(bodyGroup, scenario, { control, observation }))
  await saved('point-language-shapes-2d-3d', { cases: observed, controls }, bodyGroup)
  scenario = 'point-valid-invalid-valid-exact-source'; caseDetails = {}
  await mount([{ id: 'p', text: '$x$' }]); await settle()
  const repairs = []
  for (const text of ['$x$', '  $\\unknownPointMacro$\t\\slash\n tail  ', '$\\frac{g_j}{\\sqrt{x}}$']) {
    await mutate({ text }); await settle()
    const point = await inspect(); assertPointLayout(point)
    assert.equal(point.source, text)
    if (text.includes('unknown')) { assertPositionedLiteral(point.literalObservation, text); assert.equal(point.math, 0) }
    else assert.equal(point.math, 1)
    repairs.push(point)
  }
  await saved('point-valid-invalid-valid-exact-source', repairs, bodyGroup)
  scenario = 'point-A-B-C-delete-duplicate-history-load'
  const sources = ['  $pointA$\t\t end  ', '$\\frac{pointB}{2}$\r\n\r next ', '$pointC_j$\n\n\ttail']
  await page.evaluate((sources) => sources.forEach((s) => window.stzLabels.hold(s)), sources)
  for (const text of sources) {
    await mutate({ text })
    await page.waitForFunction((s) => window.stzLabels.state().requests.some((r) => r.source === s && r.phase === 'held'), text)
    const pending = await inspect(); assert.equal(pending.status, 'pending'); assertPointLayout(pending); assertPositionedLiteral(pending.literalObservation, text)
  }
  for (const text of [sources[2], sources[0], sources[1]]) {
    await page.evaluate((s) => window.stzLabels.release(s), text)
    assert.equal((await inspect()).source, sources[2])
  }
  await page.evaluate(() => window.stzLabels.duplicateCurve('p')); await settle()
  let current = await state()
  assert.equal(current.points.length, 2)
  const cloneId = current.points.find((p) => p.id !== 'p').id
  assert.notEqual((await inspectPoint(page, cloneId)).owner, (await inspect()).owner)
  const old = '$deletedPoint$'
  await page.evaluate((s) => window.stzLabels.hold(s), old); await mutate({ text: old })
  await page.waitForFunction((s) => window.stzLabels.state().requests.some((r) => r.source === s && r.phase === 'held'), old)
  await page.evaluate(() => window.stzLabels.deleteCurve('p'))
  assert.equal(await inspect(), null)
  await page.evaluate(() => window.stzLabels.undo()); assert.equal((await inspect()).source, old)
  await page.evaluate(() => window.stzLabels.redo()); assert.equal(await inspect(), null)
  await mount([{ id: 'p', text: '$replacementPoint$' }]); await settle()
  await page.evaluate((s) => window.stzLabels.release(s), old)
  assert.equal((await inspect()).source, '$replacementPoint$')
  await page.evaluate(() => window.stzLabels.roundTrip()); await settle()
  current = await state()
  await page.evaluate(() => window.stzLabels.unmount()); assert.equal(await inspect(), null)
  await page.evaluate(() => window.stzLabels.remount()); await settle()
  invariant(current, await state())
  await saved('point-A-B-C-delete-duplicate-history-load', { sources, current, point: await inspect() }, bodyGroup)

  scenario = 'point-resource-retry-font-readiness'
  await page.evaluate(() => window.stzLabels.changeService('load-error'))
  await mount([{ id: 'p', text: '  $resourcePoint$\t\t\r\n\tend  \r\n' }]); await settle()
  const failed = await inspect(); assert.equal(failed.status, 'fallback'); assertPositionedLiteral(failed.literalObservation, failed.source); assertPointLayout(failed)
  await page.evaluate(() => window.stzLabels.setServiceMode('real'))
  await page.waitForFunction(() => Date.now() >= window.stzLabels.state().serviceStats.retryAfter)
  const beforeFont = await state()
  await page.evaluate(() => window.stzLabels.refreshFonts()); await settle()
  const recovered = await inspect(); assert.equal(recovered.status, 'ready'); assertPointLayout(recovered)
  assert.notEqual(recovered.request, failed.request); invariant(beforeFont, await state())
  await page.mouse.click(recovered.inside.x, recovered.inside.y)
  const recoveredSelection = await inspect()
  assert.deepEqual((await state()).selection, { kind: 'stratum', id: 'p' })
  assertCircleSelection(observeCircleSelection(recoveredSelection, resourceBorder))
  assert.equal(recoveredSelection.request, recovered.request)
  assert.equal(recoveredSelection.radius, recovered.radius)
  // A late native font changes actual ordinary-text width, not just a counter.
  await mutate({ text: 'mmmm WWWW $unclosed' }); await settle()
  const beforeFontFace = await inspect(), beforeFontModel = await state()
  assertPositionedLiteral(beforeFontFace.literalObservation, beforeFontFace.source)
  const settleFont = async () => {
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await page.waitForFunction(() => {
      const point = document.querySelector('[data-point-id="p"] [data-point-node]')
      const body = point?.querySelector('[data-label-state]')
      const request = body?.getAttribute('data-label-request')
      const runtime = window.stzLabels.pointRuntime()
      return document.fonts.status === 'loaded' && body?.getAttribute('data-label-state') !== 'pending'
        && request && JSON.parse(request)[5] === runtime.fontGeneration
        && point.getAttribute('data-point-request') === request
        && JSON.parse(request)[8] === point.getAttribute('data-point-node')
        && JSON.parse(point.getAttribute('data-point-node'))[1] === runtime.documentRevision
    }, undefined, { timeout: 30_000 })
  }
  let beforeOwnership, afterFontFace, afterOwnership, afterFontRemoval, restoredOwnership, laterReference, fontSelection
  const lifecycle = await withOwnedFontFace(page, {
    family: 'Times New Roman', source: 'local("Courier New")',
    acquired: async (handle) => {
      beforeOwnership = await observeOwnedFontFace(handle)
      await diagnose(bodyGroup, scenario, { boundary: 'before-injected-font', beforeFontFace, beforeOwnership, beforeFontModel })
    },
    use: async (handle) => {
      await settleFont()
      afterFontFace = await inspect()
      afterOwnership = await observeOwnedFontFace(handle)
      await diagnose(bodyGroup, scenario, { boundary: 'after-injected-font', beforeFontFace, afterFontFace, beforeOwnership, afterOwnership, state: await state() })
      assertPointLayout(afterFontFace)
      assertPositionedLiteral(afterFontFace.literalObservation, afterFontFace.source)
      assert.equal(afterOwnership.ownedFacePresent, true)
      assert.ok(afterOwnership.previousFaces.every((face) => face.present))
      assert.equal(afterOwnership.sameDocument, true)
      assert.equal(afterFontFace.runtime.identity, beforeFontFace.runtime.identity)
      assert.equal(afterFontFace.runtime.documentRevision, beforeFontFace.runtime.documentRevision)
      assert.equal(JSON.parse(afterFontFace.request)[5], afterFontFace.runtime.fontGeneration)
      assert.notEqual(afterFontFace.request, beforeFontFace.request)
      assert.notEqual(afterFontFace.literalObservation.lines[0].width, beforeFontFace.literalObservation.lines[0].width, 'Owned native font changes actual width')
      assert.notEqual(afterFontFace.radius, beforeFontFace.radius, 'Font-ready ink measurement changes the contour')
      await page.mouse.click(afterFontFace.outside.x, afterFontFace.outside.y)
      await inspect()
      assert.equal((await state()).selection, null)
      await page.mouse.click(afterFontFace.inside.x, afterFontFace.inside.y)
      fontSelection = await inspect()
      assert.deepEqual((await state()).selection, { kind: 'stratum', id: 'p' })
      assertCircleSelection(observeCircleSelection(fontSelection, resourceBorder))
      assert.equal(fontSelection.request, afterFontFace.request)
      assert.equal(fontSelection.radius, afterFontFace.radius)
      invariant(beforeFontModel, await state())
    },
    restore: async (removal, handle) => {
      await settleFont()
      afterFontRemoval = await inspect()
      restoredOwnership = await observeOwnedFontFace(handle)
      const restoredModel = await state()
      await diagnose(bodyGroup, scenario, { boundary: 'after-injected-font-removal', beforeFontFace, afterFontFace,
        afterFontRemoval, beforeOwnership, afterOwnership, restoredOwnership, removal, beforeFontModel, restoredModel })
      assertPointLayout(afterFontRemoval)
      assertPositionedLiteral(afterFontRemoval.literalObservation, afterFontRemoval.source)
      assert.equal(restoredOwnership.ownedFacePresent, false)
      assert.ok(restoredOwnership.previousFaces.every((face) => face.present))
      assert.equal(restoredOwnership.sameDocument, true)
      assert.equal(restoredOwnership.sameFontFaceSet, true)
      assertRestoredPointFont(beforeFontFace, afterFontRemoval)
      assert.notEqual(afterFontRemoval.request, afterFontFace?.request ?? beforeFontFace.request)
      invariant(beforeFontModel, restoredModel)
      if (restoredModel.selection?.kind === 'stratum' && restoredModel.selection.id === 'p') {
        assertCircleSelection(observeCircleSelection(afterFontRemoval, resourceBorder))
      }
      // mount() deliberately reuses this document and runtime. A later reference
      // must retain the restored native measurements under its new owner.
      await mount([{ id: 'p', text: beforeFontFace.source, style: beforeFontFace.style }])
      await settleFont()
      laterReference = await inspect()
      const referenceOwnership = await observeOwnedFontFace(handle)
      await diagnose(bodyGroup, scenario, { boundary: 'later-reference-same-page', beforeFontFace, afterFontRemoval,
        laterReference, referenceOwnership, state: await state() })
      assertPointLayout(laterReference)
      assertPositionedLiteral(laterReference.literalObservation, laterReference.source)
      assertRestoredPointFont(beforeFontFace, laterReference, { sameOwner: false })
      assert.notEqual(laterReference.owner, beforeFontFace.owner)
      assert.equal(referenceOwnership.sameDocument, true)
      assert.equal(referenceOwnership.ownedFacePresent, false)
      return { restoredModel, referenceOwnership }
    },
    diagnoseFailure: ({ primary, cleanupErrors, removal }) => diagnose(bodyGroup, scenario, {
      boundary: 'injected-font-lifecycle-failure', beforeFontFace, afterFontFace, afterFontRemoval, laterReference,
      beforeOwnership, afterOwnership, restoredOwnership, removal,
      error: { message: primary.message, stack: primary.stack },
      cleanupErrors: cleanupErrors.map((error) => ({ message: error.message, stack: error.stack })) }),
  })
  await saved('point-resource-retry-font-readiness', { failed, recovered, beforeFontFace, afterFontFace, afterFontRemoval,
    laterReference, recoveredSelection, fontSelection, declaredBorder: resourceBorder,
    beforeOwnership, afterOwnership, restoredOwnership, lifecycle, state: await state() }, bodyGroup)


  context.setStage?.(pickingGroup)
  await startGroup(pickingGroup)
  scenario = 'point-contour-boundaries-cycling'
  const probes = []
  for (const shape of ['circle', 'square', 'triangle', 'star']) {
    await mount([{ id: 'p', text: '$\\frac{wide}{g_j}$', style: { shape } }]); await settle()
    const point = await inspect(); assertPointLayout(point)
    for (const alt of [false, true]) {
      if (alt) await page.keyboard.down('Alt')
      try {
        await page.mouse.click(point.outside.x, point.outside.y); assert.equal((await state()).selection, null)
        await page.mouse.click(point.inside.x, point.inside.y); assert.deepEqual((await state()).selection, { kind: 'stratum', id: 'p' })
      } finally { if (alt) await page.keyboard.up('Alt') }
    }
    probes.push(point)
  }
  await mount([{ id: 'p', text: '$x$' }, { id: 'q', text: '$x$' }]); await settle()
  const center = (await inspect()).center
  const cycles = []
  for (const alt of [false, true]) {
    if (alt) await page.keyboard.down('Alt')
    try { for (let i = 0; i < 4; i++) { await page.mouse.click(center.x, center.y); cycles.push((await state()).selection) } }
    finally { if (alt) await page.keyboard.up('Alt') }
  }
  assert.deepEqual(new Set(cycles.map((c) => c.id)), new Set(['p', 'q']))
  await saved('point-contour-boundaries-cycling', { probes, cycles }, pickingGroup)
  scenario = 'point-camera-pan-zoom-drag'
  await mount([{ id: 'p', text: '$cameraPoint$', position: { x: 1, y: .4, z: .7 } }], { ambientDimension: 3 }); await settle()
  const beforeCamera = await state(), oldPoint = await inspect()
  await page.evaluate(() => window.stzLabels.setProps({ cameraOverride: { mode: '3d', kind: 'orthographic', thetaDeg: 65, phiDeg: 35, zoom: 90, pan: { x: 450, y: 350 } },
    cameraViewAdjustment: { zoom: 1.2, pan: { x: 12, y: -8 } } }))
  const moved = await inspect(); assertPointLayout(moved)
  assert.equal(moved.request, oldPoint.request); assert.notEqual(moved.transform, oldPoint.transform)
  assert.equal((await state()).invocationCount, beforeCamera.invocationCount)
  await page.mouse.click(moved.inside.x, moved.inside.y); assert.deepEqual((await state()).selection, { kind: 'stratum', id: 'p' })
  const handle = await page.locator('[aria-label="Selected point drag handles"] circle').first().boundingBox()
  // The point's own geometry handle is the native drag target.
  const dragHandle = handle ?? await page.locator('.svg-geometry-handle').first().boundingBox()
  assert.ok(dragHandle)
  await page.mouse.move(dragHandle.x + dragHandle.width / 2, dragHandle.y + dragHandle.height / 2)
  await page.mouse.down(); await page.mouse.move(dragHandle.x + dragHandle.width / 2 + 20, dragHandle.y + dragHandle.height / 2 - 10, { steps: 3 }); await page.mouse.up()
  assert.ok((await state()).dragCount > 0)
  const dragged = await state()
  await mutate({ position: { x: .5, y: .2, z: .1 }, style: { ...dragged.points[0].style, opacity: .45, paint: { ...dragged.points[0].style.paint, fill: { ...dragged.points[0].style.paint.fill, color: '#804080' }, stroke: { ...dragged.points[0].style.paint.stroke, color: '#804080' } } } })
  await settle()
  assert.equal((await state()).invocationCount, beforeCamera.invocationCount)
  assert.equal((await inspect()).request, oldPoint.request)
  assert.equal(Number((await inspect()).opacity), .45)
  await saved('point-camera-pan-zoom-drag', { beforeCamera, oldPoint, moved, dragged, after: await state() }, pickingGroup)

  scenario = 'point-hidden-filtered-locked-dimmed-siblings'
  await mount([{ id: 'p', text: '$policyPoint$', layer: 0 }], { labels: [{ id: 'free', text: '$free$', position: { x: 2, y: 2, z: 0 } }],
    curves: [{ id: 'path', inlineNodes: [{ id: 'inline', text: '$inline$', position: { kind: 'segment', segmentIndex: 0, value: .5 }, options: { placement: 'above', marker: 'dot' } }] }] })
  await settle()
  const siblingRequests = await page.locator('[data-label-id="free"] [data-label-state], [data-path-inline-node-path-id="path"] [data-label-state]').evaluateAll((es) => es.map((e) => e.getAttribute('data-label-request')))
  await page.evaluate(() => window.stzLabels.setLayers([{ value: 0, name: 'locked', visible: true, locked: true }]))
  const locked = await inspect(); await page.mouse.click(locked.center.x, locked.center.y); assert.equal((await state()).selection, null)
  await page.evaluate(() => window.stzLabels.setLayers([{ value: 0, name: 'hidden', visible: false }]))
  assert.equal(await inspect(), null)
  await page.evaluate(() => window.stzLabels.setLayers([{ value: 0, name: 'visible', visible: true }]))
  await page.evaluate(() => window.stzLabels.filter(1)); const filtered = await inspect()
  assert.ok(Number(filtered.outerOpacity) < 1); assert.equal(filtered.pointerEvents, 'none')
  assert.deepEqual(await page.locator('[data-label-id="free"] [data-label-state], [data-path-inline-node-path-id="path"] [data-label-state]').evaluateAll((es) => es.map((e) => e.getAttribute('data-label-request'))), siblingRequests)
  await mount([{ id: 'p', text: '$behind$', position: { x: 0, y: -1, z: 0 } }], { ambientDimension: 3, occlusion: 'autoDim' }); await settle()
  const dimmed = await inspect(); assert.ok(Number(dimmed.opacity) < 1)
  await page.evaluate(() => window.stzLabels.setProps({ visibilityOptions: { enabled: true, pointVisibility: 'hideHidden' } }))
  assert.equal(await inspect(), null)
  await saved('point-hidden-filtered-locked-dimmed-siblings', { locked, filtered, dimmed, siblingRequests }, pickingGroup)
  await completeGroup(pickingGroup)
  await runNativePointChecks({ ...context, saved, diagnose })
  await completeGroup(bodyGroup)
}

/** Keep the later App group honestly unexecuted if a point assertion fails. */
export async function runPointThenAppChecks(context, runAppChecks) {
  context.setStage('point-node-checks')
  await runPointNodeChecks(context)
  context.setStage('real-App-workflows')
  const group = 'real-App-input-JSON-history-reused-ID-load'
  await context.startGroup(group)
  await runAppChecks(context)
  await context.completeGroup(group)
}
