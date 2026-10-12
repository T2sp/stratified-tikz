import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { assertZeroAxisCaptureSnapshot, assertZeroAxisCaptureTransition,
  assertZeroAxisLiveCapture } from './zeroAxisLiveCapture.mjs'

// Preserve the original Error object while telling outer diagnostic owners
// that this lifecycle already owns the single image attempt.
const captureFailures = new WeakSet()
export const isZeroAxisLiveCaptureFailure = (error) => captureFailures.has(error)
export const markZeroAxisLiveCaptureFailure = (error) => { captureFailures.add(error) }

/** A capture owns only a measured native toolbar collapse. Interaction cleanup
 * is complete before entry; neither selection nor document/camera is changed. */
export async function captureZeroAxisLive({ page, measure, retain, pngPath, inspect, assertPixels, interaction, live = {} }) {
  const capture = live.capture = { actions: [], restoration: { actions: [] }, secondaryErrors: [], cleanup: {} }
  let primary, collapseAttempted = false
  const bounded = (name, operation) => boundedPointDiagnostic(operation, `Zero-axis live ${name}`, 5000)
  const fail = (operation, error) => {
    if (primary) capture.secondaryErrors.push({ operation, message: error.message })
    else primary = error
  }
  const persist = (boundary) => bounded(`${boundary} evidence`, () => retain(boundary, live))
  const observed = () => bounded('current entire stroke measurement', measure)
  const nativeToggle = async (name, purpose, beforeState, before, actions) => {
    const controlName = `${name === 'collapse' ? 'Collapse' : 'Expand'} preview toolbar`
    const action = { name, purpose, controlName, stateBefore: beforeState, before,
      control: before?.captureGeometry.controls[name][0] }
    actions.push(action)
    let failure
    try {
      const control = page.getByRole('button', { name: controlName, exact: true })
      action.controlCount = await bounded(`${purpose} control count`, () => control.count())
      try { await persist(`${purpose}-${name}-before-native-action`) }
      catch (error) { if (purpose !== 'restore') throw error; failure = error }
      assert.equal(action.controlCount, 1, 'Live capture uses one unique native toolbar control')
      if (purpose !== 'restore') {
        assert.equal(before.captureGeometry.controls[name].length, 1)
        assert.equal(action.control.element.ariaLabel, controlName)
        assert.equal(action.control.visible, true); assert.equal(action.control.disabled, false)
      }
      if (purpose !== 'restore') collapseAttempted = true
      await control.click({ timeout: 5000 })
      const collapsed = name === 'collapse'
      await page.locator('section.preview-floating-toolbar').waitFor({ state: collapsed ? 'detached' : 'visible', timeout: 5000 })
      await page.locator(`.preview-toolbar-overlay-stack${collapsed ? '.is-collapsed' : ':not(.is-collapsed)'}`).waitFor({ state: 'visible', timeout: 5000 })
      const opposite = page.getByRole('button', { name: `${collapsed ? 'Expand' : 'Collapse'} preview toolbar`, exact: true })
      action.oppositeCount = await bounded(`${purpose} opposite control count`, () => opposite.count())
      assert.equal(action.oppositeCount, 1)
      await opposite.waitFor({ state: 'visible', timeout: 5000 })
    } catch (error) {
      if (failure) capture.secondaryErrors.push({ operation: `${purpose} native action`, message: error.message })
      else failure = error
    }
    try {
      const after = await observed()
      action.stateAfter = after.state; action.after = after.snapshot
    } catch (error) {
      if (failure) capture.secondaryErrors.push({ operation: `${purpose} action observation`, message: error.message })
      else failure = error
    }
    try { await persist(`${purpose}-${name}-after-native-action`) }
    catch (error) { if (failure) capture.secondaryErrors.push({ operation: `${purpose} action evidence`, message: error.message }); else failure = error }
    if (failure) { action.error = { message: failure.message, stack: failure.stack }; throw failure }
    assertZeroAxisCaptureTransition(action.stateBefore, action.stateAfter, action.before, action.after)
    assert.equal(action.after.toolbar.collapsed, name === 'collapse')
    return action
  }
  try {
    const inherited = await observed()
    capture.inheritedState = inherited.state; capture.inherited = inherited.snapshot
    await persist('inherited-before-preparation')
    assertZeroAxisCaptureSnapshot(inherited.state, inherited.snapshot)
    const obstructions = inherited.snapshot.captureGeometry.obstructions
    capture.decision = { action: obstructions.length ? 'collapse' : 'none',
      reason: obstructions.length ? 'measured-toolbar-obstruction' : 'already-unobstructed', obstructions }
    await persist('measured-decision')
    if (obstructions.length) {
      assert.equal(inherited.snapshot.toolbar.collapsed, false, 'Only an expanded toolbar obstruction is owned by capture')
      assert.ok(obstructions.every(({ kind, index }) => {
        const geometry = inherited.snapshot.captureGeometry
        if (kind === 'overlay') return ['toolbar', 'toolbar-container', 'quick-style'].includes(geometry.overlays[index]?.kind)
        const target = geometry.samples[index]?.elementFromPoint
        return kind === 'hit-stack' && (target?.creationToolbar === true || (target?.quickStyle === true && target?.toolbarOverlay === true))
      }), 'Unexpected paint obstruction fails before capture')
      await nativeToggle('collapse', 'capture-obstruction', inherited.state, inherited.snapshot, capture.actions)
    }
    // Native UI may legitimately change DOM/viewport placement. Re-measure the
    // canvas and both contours; screenCTM already includes page scroll.
    const prepared = await observed()
    capture.preparedState = live.state = prepared.state; capture.prepared = live.snapshot = prepared.snapshot
    await persist('prepared-before-image')
    assertZeroAxisCaptureSnapshot(prepared.state, prepared.snapshot, { requireClear: true })
    assertZeroAxisCaptureTransition(inherited.state, prepared.state, inherited.snapshot, prepared.snapshot)
    capture.image = { attempts: 1, path: pngPath, fullPage: false, scale: 'css',
      frame: { origin: { x: 0, y: 0 }, viewport: prepared.snapshot.viewport, ctm: prepared.snapshot.geometry.contour.screenCTM } }
    await persist('single-image-attempt')
    let bytes
    try { bytes = await page.screenshot({ path: pngPath, fullPage: false, scale: 'css', timeout: 5000 }) }
    catch (error) { fail('single image', error) }
    try {
      const after = await observed()
      live.afterState = after.state; live.afterSnapshot = after.snapshot
    } catch (error) { fail('post-image measurement', error) }
    if (bytes) {
      Object.assign(capture.image, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        width: bytes.length >= 24 ? bytes.readUInt32BE(16) : null, height: bytes.length >= 24 ? bytes.readUInt32BE(20) : null })
    }
    await persist('bytes-before-inspection')
    if (primary) throw primary
    assertZeroAxisCaptureSnapshot(live.afterState, live.afterSnapshot, { requireClear: true })
    assertZeroAxisCaptureTransition(live.state, live.afterState, live.snapshot, live.afterSnapshot)
    assert.deepEqual(live.afterSnapshot.viewport, live.snapshot.viewport, 'Single PNG retains its actual viewport frame')
    for (const kind of ['canvas', 'point', 'contour']) for (const matrix of ['CTM', 'screenCTM']) {
      assert.deepEqual(live.afterSnapshot.geometry[kind][matrix], live.snapshot.geometry[kind][matrix], 'Single PNG retains fresh capture-frame geometry')
    }
    const file = await bounded('PNG file identity', () => readFile(pngPath))
    assert.deepEqual(file, bytes, 'Actual live PNG file equals returned screenshot bytes')
    live.pixels = inspect(bytes, live.snapshot.geometry.contour.screenCTM)
    await persist('pixels-before-assertion')
    assertPixels(live.pixels)
  } catch (error) { if (error !== primary) fail('image lifecycle', error) }
  finally {
    const restoration = capture.restoration
    if (capture.inherited) {
      try {
        const before = await observed()
        restoration.stateBefore = before.state; restoration.before = before.snapshot
      } catch (error) { fail('before-restoration observation', error) }
      try { await persist('before-restoration') } catch (error) { fail('before-restoration evidence', error) }
      if (collapseAttempted) {
        try {
          restoration.expandCount = await bounded('restoration expand count', () => page.getByRole('button', { name: 'Expand preview toolbar', exact: true }).count())
          restoration.collapseCount = await bounded('restoration collapse count', () => page.getByRole('button', { name: 'Collapse preview toolbar', exact: true }).count())
          assert.ok((restoration.expandCount === 1 && restoration.collapseCount === 0)
            || (restoration.expandCount === 0 && restoration.collapseCount === 1), 'Owned cleanup has one actual native toolbar control')
          if (restoration.expandCount === 1) await nativeToggle('expand', 'restore', restoration.stateBefore, restoration.before, restoration.actions)
        } catch (error) { restoration.error = { message: error.message, stack: error.stack }; fail('toolbar restoration', error) }
      }
      try {
        const after = await observed()
        restoration.stateAfter = after.state; restoration.after = after.snapshot
        assert.equal(after.snapshot.toolbar.collapsed, capture.inherited.toolbar.collapsed, 'Capture restores its inherited toolbar state')
        assertZeroAxisCaptureTransition(capture.inheritedState, after.state, capture.inherited, after.snapshot)
      } catch (error) { restoration.error ??= { message: error.message, stack: error.stack }; fail('restoration observation', error) }
    }
    try {
      capture.cleanup = await bounded('resource observation', () => page.evaluate(() => {
        const registry = (value) => ({ present: value !== undefined, size: value?.size ?? 0 })
        return { observerRegistries: { geometricSelection: registry(window.__stzGeometricSelectionObservers),
          pointNativeDrag: registry(window.__stzPointNativeDragObservers), zeroAxisInput: registry(window.__stzZeroAxisInputs),
          zeroAxisCapture: registry(window.__stzZeroAxisCaptureObservers) }, listenersInstalled: 0,
        altKeyUp: 'completed-by-native-interaction' }
      }))
    } catch (error) { fail('resource observation', error) }
    if (primary) capture.primary = { message: primary.message, stack: primary.stack }
    try { await persist('restored-after-image-attempt') } catch (error) { fail('final evidence', error) }
    if (primary) capture.primary = { message: primary.message, stack: primary.stack }
  }
  if (!primary) {
    try { assertZeroAxisLiveCapture(live, interaction, live.pixels) }
    catch (error) { primary = error; capture.primary = { message: error.message, stack: error.stack }
      try { await persist('lifecycle-assertion-failure') } catch (secondary) { fail('lifecycle failure evidence', secondary) } }
  }
  if (primary) { markZeroAxisLiveCaptureFailure(primary); throw primary }
  return live
}
