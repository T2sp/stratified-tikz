/** Phase 31F: exercise both label owners in one production preview/runtime.
 * Existing suites retain exhaustive anchor, race, App and export checks. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { applyMatrix, inspectContent, probeLabelBoundaries, probePoint } from './checkFreeLabelGeometry.mjs'

const node = (text, placement = 'above') => ({ id: 'shared', text,
  position: { kind: 'segment', segmentIndex: 0, value: 0.5 }, options: { placement, marker: 'dot' } })
const rawInvariant = (before, after) => {
  for (const key of ['json', 'history', 'tikz', 'inlineTikz']) assert.equal(after[key], before[key], `${key} stays authoritative`)
}

export async function runCombinedLabelChecks({ page, record, observe, artifactDir, startGroup, completeGroup }) {
  await startGroup('combined-free-inline-workflows')
  const state = () => page.evaluate(() => window.stzLabels.state())
  const mount = (options) => page.evaluate((value) => window.stzLabels.mount(value), options)
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  const screenshot = (name) => page.screenshot({ path: resolve(artifactDir, `${name}.png`), fullPage: true })
  const inspect = (id, kind = 'free') => page.evaluate(({ id, kind }) => {
    const selector = kind === 'free' ? `[data-label-id="${id}"]` : `[data-path-inline-node-path-id="${id}"]`
    const outer = document.querySelector(selector)
    const element = outer?.querySelector('[data-label-state]')
    if (!element) return null
    const foreground = element.querySelector('[data-label-content]')
    const paint = element.querySelector(':scope > g')
    return { source: element.getAttribute('data-label-source'), status: element.getAttribute('data-label-state'),
      owner: element.getAttribute('data-label-owner'), request: element.getAttribute('data-label-request'),
      bounds: element.getAttribute('data-label-bounds').split(' ').map(Number), transform: element.getAttribute('transform'),
      math: foreground.querySelectorAll('[data-label-math]').length,
      paths: Array.from(foreground.querySelectorAll('path'), (path) => path.getAttribute('d')),
      texts: Array.from(foreground.querySelectorAll('text'), (text) => ({ source: text.textContent,
        x: text.getAttribute('x'), y: text.getAttribute('y'), whiteSpace: getComputedStyle(text).whiteSpace })),
      literal: Array.from(foreground.querySelectorAll('[data-label-literal]'), (text) => text.textContent),
      paint: paint.getAttribute('color'), opacity: paint.getAttribute('opacity'),
      role: element.getAttribute('role'), name: element.getAttribute('aria-label'),
      titles: Array.from(element.querySelectorAll('title'), (title) => title.textContent),
      roles: element.querySelectorAll('[role="img"],[aria-label]').length,
      pointerEvents: getComputedStyle(element).pointerEvents,
      hitTargets: element.querySelectorAll(':scope > rect[data-svg-export-exclude]').length,
      halo: Array.from(element.querySelectorAll('[data-label-halo]'), (halo) => ({
        hidden: halo.getAttribute('aria-hidden'), titles: halo.querySelectorAll('title,[role="img"],[aria-label]').length })),
      unsafe: element.querySelectorAll('foreignObject,image,script').length }
  }, { id, kind })
  const inline = (id) => page.evaluate(async (pathId) => {
    const { inspectInlineLabel } = await import('./inlineLabelBrowserOracle.ts')
    return inspectInlineLabel(pathId, 'shared')
  }, id)
  const sourceCases = await page.evaluate(async () => (await import('./combinedLabels.ts')).combinedLabelCases)

  // Small paired rows make successful/fallback text visible side by side. Each
  // source goes through both owners, not a synthetic conversion result.
  for (const ambientDimension of [2, 3]) {
    for (let offset = 0; offset < sourceCases.length; offset += 3) {
      const cases = sourceCases.slice(offset, offset + 3)
      const point = (x, row) => ambientDimension === 2 ? { x, y: 1.6 - row * 1.6, z: 0 }
        : { x, y: 0, z: 1.6 - row * 1.6 }
      await mount({ ambientDimension,
        labels: cases.map((entry, row) => ({ id: entry.id, text: entry.source,
          position: point(-2, row), style: { fontSize: 12 } })),
        curves: cases.map((entry, row) => ({ id: `path-${entry.id}`, inlineNodes: [node(entry.source)],
          points: [point(0.4, row), point(3.6, row)] })),
      })
      if (ambientDimension === 3) await page.evaluate(() => window.stzLabels.setProps({ cameraOverride: {
        mode: '3d', kind: 'orthographic', thetaDeg: 90, phiDeg: 0, zoom: 100, pan: { x: 450, y: 350 },
      } }))
      const before = await state()
      await settle()
      const observations = []
      for (const entry of cases) {
        for (const kind of ['free', 'inline']) {
          const id = kind === 'free' ? entry.id : `path-${entry.id}`
          const result = await inspect(id, kind)
          if (kind === 'inline' && entry.source.trim() === '') {
            assert.equal(result, null, 'Existing blank inline-node policy keeps its marker and omits text')
            assert.ok((await inline(id)).marker)
            observations.push({ id, kind, result })
            continue
          }
          assert.ok(result)
          assert.equal(result.source, entry.source)
          assert.equal(result.status, entry.status, `${ambientDimension}D ${id}`)
          assert.equal(JSON.parse(result.request)[0], entry.source)
          assert.equal(result.math, entry.mathRuns)
          assert.ok(result.bounds.every(Number.isFinite))
          assert.equal(result.name, entry.source)
          assert.equal(result.role, 'img')
          assert.deepEqual(result.titles, [entry.source], 'One source title, including a formula with a decorative outline')
          assert.equal(result.roles, 0, 'No nested duplicate accessible formula announcement')
          assert.equal(result.unsafe, 0)
          if (entry.displayedText !== undefined) assert.equal(result.texts.map(({ source }) => source).join(''), entry.displayedText)
          if (entry.status === 'fallback') {
            assert.deepEqual(result.literal, entry.source.split(/\t|\r\n|\n|\r/u))
            assert.ok(result.texts.every(({ whiteSpace }) => whiteSpace === 'pre'))
            assert.deepEqual(result.paths, [], 'A failed label contains no partly compiled or obsolete formula')
          }
          if (kind === 'inline') {
            assert.equal(result.pointerEvents, 'none')
            assert.equal(result.hitTargets, 0)
            assert.deepEqual(result.halo, [{ hidden: 'true', titles: 0 }])
          }
          observations.push({ id, kind, result })
        }
      }
      rawInvariant(before, await state())
      await screenshot(`combined-language-${ambientDimension}d-${offset}`)
      await record(`combined-language-${ambientDimension}d-${offset}`, { cases, observations })
    }
  }

  await page.evaluate(() => window.stzLabels.changeService('real'))
  const repeated = 'Map $\\frac{p_1}{\\sqrt{q}}$'
  const beforeMount = await state()
  await mount({ ambientDimension: 2,
    labels: [
      { id: 'free-a', text: repeated, position: { x: -1.8, y: 1.7, z: 0 }, style: { color: '#c02060', fontSize: 18 } },
      { id: 'free-b', text: repeated, position: { x: 1.8, y: 1.7, z: 0 }, style: { color: '#2040b0', opacity: 0.45, fontSize: 12 } },
    ],
    curves: [
      { id: 'path-a', inlineNodes: [node(repeated)], points: [{ x: -3, y: -0.6, z: 0 }, { x: -0.6, y: -0.6, z: 0 }] },
      { id: 'path-b', inlineNodes: [node(repeated, 'below')], points: [{ x: 0.6, y: -0.6, z: 0 }, { x: 3, y: -0.6, z: 0 }] },
    ],
  })
  await settle()
  const shared = await state()
  assert.equal(shared.invocationCount - beforeMount.invocationCount, 1, 'Free/path subscribers share one real geometry conversion across font sizes')
  const siblingFree = await inspect('free-b'), siblingPath = await inspect('path-b', 'inline')
  const a = await inspect('free-a'), pathA = await inspect('path-a', 'inline')
  assert.deepEqual(a.paths, siblingFree.paths)
  assert.deepEqual(a.paths, pathA.paths)
  assert.equal(a.paint, '#c02060'); assert.equal(siblingFree.paint, '#2040b0')
  assert.equal(siblingFree.opacity, '0.45'); assert.equal(pathA.paint, '#111827')
  assert.equal(new Set([a.owner, siblingFree.owner, pathA.owner, siblingPath.owner]).size, 4)
  await page.evaluate(() => {
    window.stzLabels.mutateLabel('free-a', { style: { fontSize: 23, anchor: 'north west', color: '#178044', opacity: 0.7 } })
    window.stzLabels.mutateInlineNode('path-a', 'shared', { options: { placement: 'right' } })
  })
  await settle()
  assert.equal((await state()).invocationCount, shared.invocationCount)
  assert.deepEqual(await inspect('free-b'), siblingFree, 'A free-label style edit cannot leak into another cache subscriber')
  assert.deepEqual(await inspect('path-b', 'inline'), siblingPath, 'A node placement edit cannot leak into another owner')
  const measured = await inspectContent(page, 'free-a')
  const boundsProbes = await probeLabelBoundaries({ page, id: 'free-a', evidence: measured, state })
  // The last boundary probe may clear selection. Select the actual measured
  // center, then use the existing geometry handle for the user drag gesture.
  const box = measured.published
  await probePoint({ page, state, point: applyMatrix(measured.localToClient,
    { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }), expected: { kind: 'label', id: 'free-a' } })
  const selectedHandle = await page.locator('[aria-label="Selected label drag handles"] circle').boundingBox()
  assert.ok(selectedHandle)
  await page.mouse.move(selectedHandle.x + selectedHandle.width / 2, selectedHandle.y + selectedHandle.height / 2)
  await page.mouse.down()
  await page.mouse.move(selectedHandle.x + selectedHandle.width / 2 + 25, selectedHandle.y + selectedHandle.height / 2 - 20, { steps: 3 })
  await page.mouse.up()
  assert.ok((await state()).dragCount > 0)
  const pathMarker = (await inline('path-a')).marker.client
  const markerProbe = await probePoint({ page, point: pathMarker, expected: { kind: 'stratum', id: 'path-a' }, state, alt: true })
  assert.equal((await state()).invocationCount, shared.invocationCount)
  const edited = 'repair $\\sqrt{r^2+1}$'
  await page.evaluate((source) => {
    window.stzLabels.hold(source)
    window.stzLabels.mutateLabel('free-a', { text: source })
    window.stzLabels.deleteLabel('free-b')
  }, edited)
  await page.waitForFunction((source) => window.stzLabels.state().requests.some((request) => request.source === source && request.phase === 'held'), edited)
  assert.equal((await inspect('free-a')).status, 'pending')
  assert.deepEqual((await inspect('free-a')).literal, [edited])
  const pending = await state()
  await page.evaluate((source) => window.stzLabels.release(source), edited)
  await settle()
  rawInvariant(pending, await state())
  assert.equal(await inspect('free-b'), null)
  assert.equal((await inspect('free-a')).source, edited)
  assert.deepEqual(await inspect('path-b', 'inline'), siblingPath, 'Editing/removing free owners retains the shared path subscriber')
  await screenshot('combined-shared-cache-editing')
  await record('combined-shared-real-conversion-style-placement-bounds-drag-marker-edit-remove', { shared, boundsProbes, markerProbe, current: await state() })

  // Both owner kinds follow the same mounted 3D camera without recompiling or
  // changing source revision. The previous 2D cache remains reusable.
  await mount({ ambientDimension: 3,
    labels: [{ id: 'camera-free', text: repeated, position: { x: -1, y: 0.3, z: 1.2 } }],
    curves: [{ id: 'camera-path', inlineNodes: [node(repeated)],
      points: [{ x: 0.3, y: -0.3, z: 0.2 }, { x: 1.5, y: 0.5, z: 0.4 }] }],
  })
  await settle()
  const cameraBefore = await state(), oldFree = await inspect('camera-free'), oldPath = await inline('camera-path')
  await page.evaluate(() => window.stzLabels.setProps({
    cameraOverride: { mode: '3d', kind: 'orthographic', thetaDeg: 70, phiDeg: 40, zoom: 100, pan: { x: 450, y: 350 } },
    cameraViewAdjustment: { zoom: 1.25, pan: { x: 17, y: -11 } },
  }))
  await settle()
  const cameraAfter = await state(), newFree = await inspect('camera-free'), newPath = await inline('camera-path')
  rawInvariant(cameraBefore, cameraAfter)
  assert.equal(cameraAfter.sourceRevision, cameraBefore.sourceRevision)
  assert.equal(cameraAfter.invocationCount, cameraBefore.invocationCount)
  assert.equal(newFree.request, oldFree.request); assert.equal(newPath.label.request, oldPath.label.request)
  assert.notEqual(newFree.transform, oldFree.transform); assert.notDeepEqual(newPath.marker.client, oldPath.marker.client)
  const projected = cameraAfter.positions['camera-free']
  const translation = /^translate\(([-+\d.eE]+)[ ,]+([-+\d.eE]+)\)$/u.exec(newFree.transform)
  assert.ok(translation)
  assert.ok(Math.abs(Number(translation[1]) - projected.x) < 1e-5 && Math.abs(Number(translation[2]) - projected.y) < 1e-5)
  const projectedNode = cameraAfter.nodePositions[JSON.stringify(['camera-path', 'shared'])]
  assert.ok(Math.abs(newPath.marker.x - projectedNode.x) < 1e-5 && Math.abs(newPath.marker.y - projectedNode.y) < 1e-5)
  await inspectContent(page, 'camera-free')
  await probePoint({ page, state, point: newPath.marker.client, expected: { kind: 'stratum', id: 'camera-path' }, alt: true })
  await screenshot('combined-camera-3d')
  await record('combined-3d-pan-zoom-camera-same-revision-no-conversion', { cameraBefore, cameraAfter, oldFree, newFree, oldPath, newPath })

  await page.evaluate(() => window.stzLabels.changeService('load-error'))
  const retrySource = '$\\frac{retry}{2}$'
  await mount({ labels: [
    { id: 'retry-free', text: 'waiting', position: { x: -1.8, y: 1.6, z: 0 } },
    { id: 'plain-sibling', text: '日本語 text', position: { x: 1.8, y: 1.6, z: 0 } },
  ], curves: [{ id: 'retry-path', inlineNodes: [node('waiting')],
    points: [{ x: -2, y: -1, z: 0 }, { x: 2, y: -1, z: 0 }] }] })
  // Establish usable ordinary content before the failing engine request. This
  // tests that a real mounted sibling survives generation retirement, without
  // depending on which concurrent initial font-measurement promise wins.
  await settle()
  const ordinaryBeforeFailure = await inspect('plain-sibling')
  assert.equal(ordinaryBeforeFailure.status, 'ready')
  const began = Date.now()
  await page.evaluate((source) => {
    window.stzLabels.mutateLabel('retry-free', { text: source })
    window.stzLabels.mutateInlineNode('retry-path', 'shared', { text: source })
  }, retrySource)
  await settle()
  const failed = await state(), failedFree = await inspect('retry-free'), failedPath = await inspect('retry-path', 'inline')
  assert.ok(Date.now() - began < 30_000, 'A resource failure reaches finite exact-source fallback')
  for (const result of [failedFree, failedPath]) {
    assert.equal(result.status, 'fallback'); assert.deepEqual(result.literal, [retrySource]); assert.equal(result.math, 0)
    assert.ok(result.bounds.every(Number.isFinite))
  }
  assert.deepEqual(await inspect('plain-sibling'), ordinaryBeforeFailure, 'Resource retirement preserves the mounted ready sibling')
  const usableGeometry = await probePoint({ page, state, point: (await inline('retry-path')).marker.client,
    expected: { kind: 'stratum', id: 'retry-path' }, alt: true })
  await observe('combined-resource-failure-before-recovery', { failed, failedFree, failedPath, usableGeometry })
  await page.evaluate(() => window.stzLabels.setServiceMode('real'))
  await page.waitForFunction(() => Date.now() >= window.stzLabels.state().serviceStats.retryAfter)
  const beforeRetry = await state()
  // Production font readiness subscription is the existing retry trigger; no
  // page, service, runtime, owner, document or root is replaced during recovery.
  await page.evaluate(() => window.stzLabels.refreshFonts())
  await settle()
  const recovered = await state(), recoveredFree = await inspect('retry-free'), recoveredPath = await inspect('retry-path', 'inline')
  assert.equal(recovered.serviceEpoch, failed.serviceEpoch)
  assert.equal(recovered.sourceRevision, failed.sourceRevision)
  rawInvariant(beforeRetry, recovered)
  assert.deepEqual(recovered.selection, beforeRetry.selection)
  for (const [before, after] of [[failedFree, recoveredFree], [failedPath, recoveredPath]]) {
    assert.equal(after.owner, before.owner); assert.equal(after.source, retrySource)
    assert.equal(after.status, 'ready'); assert.equal(after.math, 1); assert.deepEqual(after.literal, [])
  }
  assert.equal(recovered.invocationCount - failed.invocationCount, 1)
  await screenshot('combined-resource-recovered')
  await record('combined-resource-fallback-geometry-usable-same-service-retry', { failed, beforeRetry, recovered, recoveredFree, recoveredPath })
  await completeGroup('combined-free-inline-workflows')
}
