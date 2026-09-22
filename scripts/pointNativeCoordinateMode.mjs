import assert from 'node:assert/strict'
import { cleanupPointCheck } from './pointCheckDiagnostics.mjs'
import { diagnoseNativePointFailure } from './pointNativeSetupDiagnostics.mjs'

// The wrapping label includes option descendants in Playwright's label text.
// Scope to the active form; do not depend on an exact label or the default value.
export async function selectPointCoordinateMode(form, value = 'global') {
  assert.equal(await form.count(), 1, 'One direct point creation form')
  assert.equal(await form.isVisible(), true, 'Visible direct point creation form')
  const control = form.locator('.direct-coordinate-mode-field select')
  assert.equal(await control.count(), 1, 'One scoped coordinate-mode select')
  assert.equal(await control.isVisible(), true, 'Visible coordinate-mode select')
  assert.equal(await control.isEnabled(), true, 'Enabled coordinate-mode select')
  const options = await control.locator('option').evaluateAll((elements) => elements.map((option) => option.value))
  assert.deepEqual(options, ['global', 'workPlaneLocal'], '3D coordinate-mode option values')
  assert.ok(options.includes(value), `Valid coordinate-mode option: ${value}`)
  assert.deepEqual(await control.selectOption(value, { timeout: 5000 }), [value])
  assert.equal(await control.inputValue(), value, 'Selected coordinate mode')
}

/** Real browser regression using the actual rendered App form's HTML. This is
 * isolated from App state; the original page still creates points natively. */
export async function checkPointCoordinateModeBoundary({ browser, form, diagnose }) {
  const html = await form.evaluate((element) => element.outerHTML)
  const page = await browser.newPage()
  let primary
  try {
    const reset = () => page.setContent(`<div class="direct-coordinate-mode-field"><select><option value="decoy">Unrelated control</option></select></div><section id="direct-input-drawer">${html}</section>`)
    await reset()
    const clone = page.locator('.direct-input-drawer-form')
    const select = clone.locator('.direct-coordinate-mode-field select')
    const boundary = {
      html,
      exactLabelCount: await clone.getByLabel('Coordinate mode', { exact: true }).count(),
      prefixLabelCount: await clone.getByLabel(/^Coordinate mode/).count(),
      scopedCount: await select.count(),
      globalCount: await page.locator('.direct-coordinate-mode-field select').count(),
    }
    await diagnose({ boundary: 'wrapped-coordinate-mode-select', ...boundary })
    assert.equal(boundary.exactLabelCount, 0, 'Reproduce wrapped label text mismatch')
    assert.equal(boundary.prefixLabelCount, 1)
    assert.equal(boundary.scopedCount, 1)
    assert.equal(boundary.globalCount, 2, 'Out-of-form select cannot be selected')
    await selectPointCoordinateMode(clone, 'workPlaneLocal')
    await selectPointCoordinateMode(clone, 'global')
    assert.equal(await page.locator('div.direct-coordinate-mode-field select').inputValue(), 'decoy')
    await assert.rejects(selectPointCoordinateMode(clone, 'invalid'), /Valid coordinate-mode option/)
    await select.evaluate((element) => element.remove())
    await assert.rejects(selectPointCoordinateMode(clone), /One scoped coordinate-mode select/)
    await reset()
    await select.evaluate((element) => element.after(element.cloneNode(true)))
    await assert.rejects(selectPointCoordinateMode(clone), /One scoped coordinate-mode select/)
    await reset()
    await select.evaluate((element) => { element.disabled = true })
    await assert.rejects(selectPointCoordinateMode(clone), /Enabled coordinate-mode select/)
    await reset()
    await clone.evaluate((element) => element.after(element.cloneNode(true)))
    await assert.rejects(selectPointCoordinateMode(clone), /One direct point creation form/)
    await reset()
    await clone.evaluate((element) => element.remove())
    await assert.rejects(selectPointCoordinateMode(clone), /One direct point creation form/)
    await diagnose({ boundary: 'wrapped-coordinate-mode-regressions-complete', checks: [
      'nested-option-label-text', 'scoped-selection', 'both-valid-options', 'invalid-option',
      'absent-control', 'ambiguous-control', 'disabled-control', 'ambiguous-form', 'absent-form',
    ] })
  } catch (error) {
    primary = error
    await diagnoseNativePointFailure({ page, primary: error, diagnose,
      details: { context: 'coordinate-mode-form-clone' } })
  } finally {
    await cleanupPointCheck(primary, () => page.close())
  }
}
