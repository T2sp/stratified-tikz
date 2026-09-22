const nativeFormSelector = '#direct-input-drawer .direct-input-drawer-form'

function errorDetails(error) {
  return { message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error ? { stack: error.stack } : {}) }
}

// An evaluate or evidence callback can remain pending after a page failure. Own
// the timer and observe its eventual rejection even after the deadline wins.
async function boundedNativeDiagnostic(operation, name, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Native diagnostic timeout must be finite and positive')
  let timer
  const outcome = Promise.resolve().then(operation).then(
    (value) => ({ ok: true, value }), (error) => ({ ok: false, error }))
  try {
    const result = await Promise.race([outcome, new Promise((resolve) => {
      timer = setTimeout(() => resolve({ ok: false,
        error: new Error(`Timed out after ${timeoutMs}ms during ${name}`) }), timeoutMs)
    })])
    if (!result.ok) throw result.error
    return result.value
  } finally { clearTimeout(timer) }
}

/** Read-only setup evidence from the actual native page, before any assertion
 * about a form or control. This observation is never an acceptance pass. */
export function captureNativePointSetup(page, { timeoutMs = 2000 } = {}) {
  return boundedNativeDiagnostic(() => page.evaluate((formSelector) => {
    const visible = (element) => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden'
        && style.visibility !== 'collapse' && rect.width > 0 && rect.height > 0
    }
    const describe = (element) => ({ tag: element.tagName.toLowerCase(),
      text: element.textContent, ariaLabel: element.getAttribute('aria-label'),
      ariaLabelledby: element.getAttribute('aria-labelledby'),
      outerHTML: element.outerHTML, visible: visible(element),
      enabled: !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true' })
    const labels = (element) => Array.from(element.labels ?? [], (label) => ({
      text: label.textContent, outerHTML: label.outerHTML,
    }))
    const forms = Array.from(document.querySelectorAll(formSelector))
    const controls = forms.flatMap((form, formIndex) => Array.from(
      form.querySelectorAll('.direct-coordinate-mode-field select'), (select) => ({
        ...describe(select), formIndex, labels: labels(select), value: select.value,
        options: Array.from(select.options, (option) => ({ value: option.value,
          text: option.textContent, selected: option.selected, disabled: option.disabled })),
      })))
    let documentState = null, snapshotError
    try {
      const snapshot = window.stzAppLabels.state(), diagram = JSON.parse(snapshot.json).diagram
      documentState = { id: diagram.id ?? null, ambientDimension: diagram.ambientDimension,
        labelDocumentRevision: snapshot.labelDocumentRevision, modelJson: snapshot.json }
    } catch (error) { snapshotError = { message: error instanceof Error ? error.message : String(error) } }
    return {
      document: documentState, ...(snapshotError ? { snapshotError } : {}),
      url: location.href, formSelector, formCount: forms.length,
      forms: forms.map(describe),
      drawers: Array.from(document.querySelectorAll('#direct-input-drawer'), describe),
      drawerHeadings: Array.from(document.querySelectorAll('#direct-input-drawer-heading'), describe),
      activeButtons: Array.from(document.querySelectorAll('button[aria-pressed="true"]'), describe),
      activeToolMenus: Array.from(document.querySelectorAll('.preview-toolbar-menu.is-selected'), (menu) => ({
        ...describe(menu), summary: menu.querySelector('summary')?.textContent,
        summaryAriaLabel: menu.querySelector('summary')?.getAttribute('aria-label'),
      })),
      coordinateMode: { scopedCount: controls.length,
        globalCount: document.querySelectorAll('.direct-coordinate-mode-field select').length, controls },
      fields: forms.flatMap((form, formIndex) => Array.from(form.querySelectorAll('input, textarea'), (field) => ({
        ...describe(field), formIndex, labels: labels(field), value: field.value,
        type: field.getAttribute('type'),
      }))),
    }
  }, nativeFormSelector), 'native point setup capture', timeoutMs)
}

/** Call from the native page catch before its finally closes that page. Capture
 * and evidence writes each have a deadline; neither may replace the UI error. */
export async function diagnoseNativePointFailure({ page, primary, diagnose, details = {}, timeoutMs = 2000 }) {
  const observation = { ...details, boundary: 'native-failure', error: errorDetails(primary) }
  try { observation.nativeSetup = await captureNativePointSetup(page, { timeoutMs }) }
  catch (error) { observation.captureError = errorDetails(error) }
  try {
    await boundedNativeDiagnostic(() => diagnose(observation), 'native point failure observation', timeoutMs)
  } catch (error) { console.error('Native point failure diagnostics:', errorDetails(error)) }
  throw primary
}
