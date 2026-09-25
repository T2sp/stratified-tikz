import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pointImportedPaintSources as sources } from './fixtures/pointImportedPaint.mjs'
import { observePointPaint, assertPointPaint, observePostExternalPointPaint, assertPostExternalPointPaint,
  observeLiteralPointPaint, assertExplicitPointPaint } from './pointPaintOracle.mjs'
import { saveAppJson, checkAppJsonReload } from './appJsonPersistence.mjs'
import { captureStandaloneSvg } from './standaloneSvgCapture.mjs'
import { cleanupPointCheck } from './pointCheckDiagnostics.mjs'
import { resolvePointInspectorField } from './pointInspectorFields.mjs'

/** Every mutation below is an existing native import/preset/Inspector/history
 * event; the fixture API is used only to observe the resulting production model. */
export async function runPointImportedPaintChecks(context) {
  const { browser, page, artifactDir, inspector, legacy, state, model, point, load, settle, select,
    eventAction, edit, undo, redo, tikz, owned, begin, saved, diagnose } = context
  let scenario
  const start = async (name) => { scenario = name; begin(name); await load(legacy); await settle(); await select() }
  async function importSource(filename, source, key) {
    await writeFile(resolve(artifactDir, `${scenario}-${filename}`), source)
    const before = await model()
    const { event } = await eventAction(`${scenario}-${filename}`, 'filechooser',
      () => page.getByRole('button', { name: 'Choose .sty/.tex', exact: true }).click())
    await event.setFiles({ name: filename, mimeType: 'text/plain', buffer: Buffer.from(source) })
    await page.waitForFunction(({ count, key }) => {
      const diagram = JSON.parse(window.stzAppLabels.state().json).diagram
      return diagram.externalTikzStyleSources?.length > count && diagram.importedTikzStyleReferences?.some((reference) => reference.key === key)
    }, { count: before.externalTikzStyleSources?.length ?? 0, key })
    await diagnose({ boundary: 'native-import', filename, source, state: await state(), inspector: await inspector.innerText() })
  }
  async function apply(key) {
    const button = inspector.locator('.style-preset-list-item').filter({ hasText: key })
    assert.equal(await button.count(), 1, `One imported native preset ${key}`)
    await button.click(); await inspector.getByRole('button', { name: 'Apply', exact: true }).click()
  }
  async function snapshot(boundary, key) {
    const output = await tikz(), current = await point(), diagram = await model()
    const result = { boundary, key, current, diagram, state: await state(), output,
      modelDiagnostics: await page.evaluate(() => window.stzAppLabels.pointPaintModelDiagnostics()),
      observation: await observePointPaint(page, { id: 'app-point' }),
      warnings: await inspector.locator('.style-preset-warning').allTextContents(), inspector: await inspector.innerText() }
    // Preserve the actual output before the output oracle can reject it.
    await diagnose(result)
    result.postExternal = Object.fromEntries(Object.entries(output).map(([mode, code]) => [mode, observePostExternalPointPaint(code, key)]))
    await diagnose({ boundary: `${boundary}-post-external`, postExternal: result.postExternal })
    return result
  }
  function assertOutput(entry, expected) {
    for (const actual of Object.values(entry.postExternal)) assertPostExternalPointPaint(actual, expected)
  }
  async function writeOutput(entry, suffix = '') {
    for (const [mode, code] of Object.entries(entry.output)) await writeFile(resolve(artifactDir, `${scenario}${suffix}-${mode}.tex`), code)
  }
  async function persist(key, expected) {
    const download = await saveAppJson({ page, artifactDir, name: `${scenario}-saved`, owned, diagnose })
    await load(download.json); await settle(); await select()
    const reload = await checkAppJsonReload({ page, saved: download, diagnose })
    const reloaded = await snapshot('reloaded', key); assertOutput(reloaded, expected)
    await writeOutput(reloaded)
    return { download, reload, reloaded }
  }
  async function downloadSvg(expected, suffix = '', extraPoints = []) {
    const source = (await point()).text
    await page.getByLabel('SVG export background', { exact: true }).selectOption('transparent')
    const { event } = await eventAction(`${scenario}-svg`, 'download',
      () => page.getByRole('button', { name: 'Export current diagram view as SVG', exact: true }).click())
    const path = resolve(artifactDir, `${scenario}${suffix}.svg`)
    await event.saveAs(path)
    const xml = await readFile(path, 'utf8')
    const standalone = await browser.newPage({ viewport: { width: 1000, height: 800 } })
    const pageErrors = [], requests = []; let failure
    standalone.on('pageerror', (error) => pageErrors.push(error.message))
    standalone.on('request', (request) => requests.push(request.url()))
    try {
      await standalone.goto(pathToFileURL(path).href)
      const observation = await observePointPaint(standalone, { source, standalone: true })
      const points = []
      for (const entry of extraPoints) points.push({ ...entry, observation: await observePointPaint(standalone, { source: entry.source, standalone: true }) })
      const details = { source, path, observation, points, pageErrors, requests }
      const persist = async (capture) => writeFile(resolve(artifactDir, `${scenario}${suffix}-standalone.json`), JSON.stringify({ ...details, capture }, null, 2) + '\n')
      await persist(); await diagnose({ boundary: 'standalone-before-assertions', ...details, xml })
      assertPointPaint(observation, expected)
      for (const entry of points) assertPointPaint(entry.observation, entry.expected)
      assert.equal(observation.forbidden, 0); assert.deepEqual(observation.externalReferences, [])
      assert.deepEqual(pageErrors, []); assert.deepEqual(requests, [pathToFileURL(path).href])
      await captureStandaloneSvg(standalone, resolve(artifactDir, `${scenario}${suffix}.png`), persist)
      return details
    } catch (error) { failure = error; throw error }
    finally { await cleanupPointCheck(failure, () => standalone.close()) }
  }

  await start('point-paint-local-override-intent')
  await importSource('intent.sty', sources.intent, 'example'); await apply('example')
  const untouched = await snapshot('untouched-macro', 'example')
  assertOutput(untouched, { fill: null, text: '#ff0000' }); await writeOutput(untouched, '-untouched')
  await edit('Fill color', '#123456')
  const away = await snapshot('fill-away', 'example'); assertOutput(away, { fill: '#123456' })
  await edit('Fill color', '#000000')
  const back = await snapshot('fill-back', 'example'); assertOutput(back, { fill: '#000000', text: '#ff0000' })
  assertPointPaint(back.observation, { fill: 'rgb(0, 0, 0)', text: 'rgb(255, 0, 0)', textAlpha: 1 })
  await undo(); const undone = await snapshot('undo-fill-back', 'example'); assertOutput(undone, { fill: '#123456' })
  await redo(); const redone = await snapshot('redo-fill-back', 'example'); assertOutput(redone, { fill: '#000000' })
  const persistence = await persist('example', { fill: '#000000', text: '#ff0000' })
  const standalone = await downloadSvg({ fill: 'rgb(0, 0, 0)', text: 'rgb(255, 0, 0)', textAlpha: 1 })
  await apply('example')
  const reset = await snapshot('reapplied-preset', 'example'); assertOutput(reset, { fill: null })
  await apply('unknown controls')
  const settingsBefore = await snapshot('unknown-settings-untouched', 'unknown controls')
  assertOutput(settingsBefore, { fill: null, text: null, draw: null, 'fill opacity': null, 'line width': null })
  const focusBlurControls = []
  for (const name of ['Fill opacity', 'Border width']) {
    const control = await resolvePointInspectorField(page, name, 'input[type="text"]')
    const before = await control.inputValue()
    await control.focus()
    const focused = await control.evaluate((element) => document.activeElement === element)
    await control.press('Tab')
    focusBlurControls.push({ name, before, after: await control.inputValue(), focused,
      blurred: await control.evaluate((element) => document.activeElement !== element) })
  }
  const settingsFocusBlur = await snapshot('unknown-settings-unedited-focus-blur', 'unknown controls')
  settingsFocusBlur.focusBlurControls = focusBlurControls
  await diagnose({ boundary: 'native-unedited-focus-blur-before-assertions', settingsBefore, settingsFocusBlur })
  assertOutput(settingsFocusBlur, { fill: null, text: null, draw: null, 'fill opacity': null, 'line width': null })
  assert.deepEqual(settingsFocusBlur.current.style.importedPaint.overriddenFields, [], 'Focus/blur without input creates no local paint intent')
  assert.equal(settingsFocusBlur.state.json, settingsBefore.state.json, 'Unedited numeric focus/blur preserves the model')
  assert.equal(settingsFocusBlur.state.history, settingsBefore.state.history, 'Unedited numeric focus/blur creates no history entry')
  for (const control of focusBlurControls) {
    assert.equal(control.focused, true); assert.equal(control.blurred, true); assert.equal(control.after, control.before)
  }
  await edit('Fill opacity', '.25'); await edit('Fill opacity', '1')
  await edit('Border width', '2'); await edit('Border width', '.4')
  const settingsBack = await snapshot('unknown-settings-return', 'unknown controls')
  assertOutput(settingsBack, { fill: null, text: null, draw: null, 'fill opacity': '1', 'line width': '0.4pt' })
  await saved({ untouched, away, back, undone, redone, reset, settingsBefore, settingsFocusBlur, settingsBack, ...persistence, standalone })

  await start('point-paint-cross-file-resolution')
  await importSource('base.sty', sources.base, 'base'); await importSource('outer.sty', sources.outer, 'outer'); await apply('outer')
  const crossFile = await snapshot('cross-file-applied', 'outer')
  assertOutput(crossFile, { fill: '#ff0000', text: '#00ff00', draw: '#0000ff' })
  assertPointPaint(crossFile.observation, { fill: 'rgb(255, 0, 0)', text: 'rgb(0, 255, 0)', textAlpha: 1, stroke: 'rgb(0, 0, 255)' })
  const reference = crossFile.diagram.importedTikzStyleReferences.find((entry) => entry.id === crossFile.current.importedTikzStyleReferenceId)
  assert.deepEqual(reference.previewDiagnostics, [])
  assert.equal(crossFile.warnings.some((warning) => /unsupported.*base/i.test(warning)), false)
  for (const output of Object.values(crossFile.output)) {
    assert.equal(output.match(/%\s+\\input\{base\.sty\}/g)?.length, 1)
    assert.equal(output.match(/%\s+\\input\{outer\.sty\}/g)?.length, 1)
    assert.ok(output.indexOf('\\input{base.sty}') < output.indexOf('\\input{outer.sty}'), 'Dependency hints follow source load order')
  }
  const crossPersistence = await persist('outer', { fill: '#ff0000', text: '#00ff00', draw: '#0000ff' })
  const crossStandalone = await downloadSvg({ fill: 'rgb(255, 0, 0)', text: 'rgb(0, 255, 0)', textAlpha: 1, stroke: 'rgb(0, 0, 255)' })
  await load(legacy); await settle(); await select()
  await importSource('base-colors.sty', sources.colorBase, 'base'); await importSource('outer-colors.sty', sources.outer, 'outer'); await apply('outer')
  const priorColor = await snapshot('prior-file-color', 'outer'); assertOutput(priorColor, { fill: '#123456', text: '#00ff00', draw: '#0000ff' })
  assertPointPaint(priorColor.observation, { fill: 'rgb(18, 52, 86)' })
  await importSource('redefined.sty', sources.redefined, '/tikz/outer')
  const redefined = await snapshot('canonical-root-redefined', 'outer')
  assertOutput(redefined, { fill: '#ffff00', text: '#0000ff', draw: '#00ff00' })
  assert.equal(redefined.current.importedTikzStyleReferenceId, priorColor.current.importedTikzStyleReferenceId, 'Old ID invokes the later canonical root')
  await load(legacy); await settle(); await select()
  await importSource('missing.sty', sources.missing, 'outer'); await apply('outer')
  const missing = await snapshot('truly-missing-dependency', 'outer'); assertOutput(missing, { fill: null, text: null, draw: '#0000ff' })
  assert.ok(missing.warnings.some((warning) => warning.includes('absent base')))
  await edit('Fill color', '#123456'); await edit('Fill color', '#000000')
  await importSource('later.sty', sources.later, 'absent base')
  const later = await snapshot('later-known-preserves-local', 'outer')
  assertOutput(later, { fill: '#000000', text: '#00ff00', draw: '#0000ff' })
  assertPointPaint(later.observation, { fill: 'rgb(0, 0, 0)', text: 'rgb(0, 255, 0)', textAlpha: 1 })
  await undo(); const laterUndone = await snapshot('undo-later-import', 'outer'); assertOutput(laterUndone, { fill: '#000000', text: null })
  await redo(); const laterRedone = await snapshot('redo-later-import', 'outer'); assertOutput(laterRedone, { fill: '#000000', text: '#00ff00' })
  const laterDownload = await saveAppJson({ page, artifactDir, name: `${scenario}-later-saved`, owned, diagnose })
  await load(laterDownload.json); await settle(); await select()
  const laterReload = await checkAppJsonReload({ page, saved: laterDownload, diagnose })
  const laterReloaded = await snapshot('later-import-reloaded', 'outer'); assertOutput(laterReloaded, { fill: '#000000', text: '#00ff00', draw: '#0000ff' })
  await saved({ crossFile, priorColor, redefined, missing, later, laterUndone, laterRedone, laterDownload, laterReload, laterReloaded,
    ...crossPersistence, standalone: crossStandalone })

  await start('point-paint-unsupported-color-bindings')
  await importSource('unsupported.sty', sources.unsupported, 'myPoint'); await apply('myPoint')
  const unsupported = await snapshot('unsupported-red-untouched', 'myPoint')
  assertOutput(unsupported, { fill: null, text: null, draw: '#000000' }); await writeOutput(unsupported, '-untouched')
  assertPointPaint(unsupported.observation, { fill: 'rgb(0, 0, 0)', text: 'rgb(0, 0, 0)', textAlpha: 1 })
  assert.ok(unsupported.warnings.some((warning) => warning.includes('red')), 'Unsupported color use is visible in the Inspector')
  assert.ok(unsupported.inspector.includes('red'))
  await edit('Fill color', '#123456')
  const unsupportedAway = await snapshot('unsupported-fill-away', 'myPoint'); assertOutput(unsupportedAway, { fill: '#123456', text: null })
  await edit('Fill color', '#000000')
  const unsupportedBack = await snapshot('unsupported-fill-back', 'myPoint'); assertOutput(unsupportedBack, { fill: '#000000', text: null })
  await undo(); const unsupportedUndone = await snapshot('unsupported-undo', 'myPoint'); assertOutput(unsupportedUndone, { fill: '#123456', text: null })
  await redo(); const unsupportedRedone = await snapshot('unsupported-redo', 'myPoint'); assertOutput(unsupportedRedone, { fill: '#000000', text: null })
  const unsupportedPersistence = await persist('myPoint', { fill: '#000000', text: null, draw: '#000000' })
  const unsupportedStandalone = await downloadSvg({ fill: 'rgb(0, 0, 0)', text: 'rgb(0, 0, 0)', textAlpha: 1 })
  await saved({ unsupported, away: unsupportedAway, back: unsupportedBack, undone: unsupportedUndone, redone: unsupportedRedone,
    ...unsupportedPersistence, standalone: unsupportedStandalone })

  await start('point-paint-unsupported-mutations')
  await importSource('mutation.sty', sources.mutation, 'myPoint'); await apply('myPoint')
  const mutation = await snapshot('unsupported-mutation-untouched', 'myPoint')
  assertOutput(mutation, { fill: null, text: null, draw: null }); await writeOutput(mutation, '-untouched')
  assertPointPaint(mutation.observation, { fill: 'rgb(255, 0, 0)', text: 'rgb(255, 0, 0)', textAlpha: 1 })
  assert.ok(mutation.warnings.some((warning) => warning.includes('.append style')), 'The mutation warning is visible in the production Inspector')
  assert.ok(mutation.modelDiagnostics.reference.previewDiagnostics.some((warning) => warning.includes('.append style')))
  for (const field of ['fillColor', 'textColor']) assert.ok(mutation.modelDiagnostics.resolution.unresolvedFields.includes(field))
  await edit('Fill color', '#123456')
  const mutationAway = await snapshot('mutation-fill-away', 'myPoint'); assertOutput(mutationAway, { fill: '#123456', text: null })
  await edit('Fill color', '#ff0000')
  const mutationBack = await snapshot('mutation-fill-back', 'myPoint'); assertOutput(mutationBack, { fill: '#ff0000', text: null })
  await undo(); const mutationUndone = await snapshot('mutation-undo', 'myPoint'); assertOutput(mutationUndone, { fill: '#123456', text: null })
  await redo(); const mutationRedone = await snapshot('mutation-redo', 'myPoint'); assertOutput(mutationRedone, { fill: '#ff0000', text: null })
  const mutationPersistence = await persist('myPoint', { fill: '#ff0000', text: null, draw: null })
  assert.ok(mutationPersistence.reloaded.diagram.externalTikzStyleSources.some((entry) => entry.rawSource === sources.mutation), 'Raw unsupported source survives native persistence')
  const mutationStandalone = await downloadSvg({ fill: 'rgb(255, 0, 0)', text: 'rgb(255, 0, 0)', textAlpha: 1 })
  await saved({ mutation, away: mutationAway, back: mutationBack, undone: mutationUndone, redone: mutationRedone,
    ...mutationPersistence, standalone: mutationStandalone })

  async function clearSnapshot(boundary) {
    const output = await tikz(), diagram = await model(), snapshotState = await state()
    const points = []
    for (const entry of diagram.strata) if (entry.geometricKind === 'point') points.push({ current: entry,
      observation: await observePointPaint(page, { id: entry.id }) })
    const entry = { boundary, output, diagram, state: snapshotState, points,
      modelDiagnostics: await page.evaluate(() => window.stzAppLabels.pointPaintModelDiagnostics()) }
    await diagnose(entry)
    assert.equal(entry.modelDiagnostics.validation.valid, true, JSON.stringify(entry.modelDiagnostics.validation))
    return entry
  }
  async function clearNative() {
    const menu = page.locator('details.context-quick-style-preset-menu')
    if (!await menu.evaluate((element) => element.open)) await page.getByLabel('TikZ style selector', { exact: true }).click()
    await page.getByRole('button', { name: 'Clear TikZ style', exact: true }).click()
    return { selector: 'TikZ style selector', action: 'Clear TikZ style' }
  }
  function clearCheck(before, after, ids) {
    for (const entry of before.points) {
      const actual = after.points.find((point) => point.current.id === entry.current.id)
      const expected = structuredClone(entry.current)
      if (ids.includes(expected.id)) {
        assert.ok(expected.importedTikzStyleReferenceId && expected.style.importedPaint)
        const key = before.diagram.importedTikzStyleReferences.find((ref) => ref.id === expected.importedTikzStyleReferenceId).key
        delete expected.stylePresetId; delete expected.importedTikzStyleReferenceId; delete expected.style.importedPaint
        for (const code of Object.values(after.output)) {
          const paint = observeLiteralPointPaint(code, expected.text)
          assert.equal(paint.options.includes(key), false, `Cleared ${expected.id} has no external invocation`)
          assertExplicitPointPaint(paint, expected.style)
        }
      }
      assert.deepEqual(actual.current, expected, `Clear changes only references/provenance on ${expected.id}`)
      for (const field of ['contour', 'bodyBounds', 'shapeBounds', 'leaves']) assert.deepEqual(actual.observation[field], entry.observation[field], `Clear preserves ${expected.id} ${field}`)
    }
    assert.deepEqual(after.diagram.userStylePresets, before.diagram.userStylePresets)
    assert.deepEqual(after.diagram.externalTikzStyleSources, before.diagram.externalTikzStyleSources)
    assert.deepEqual(after.diagram.importedTikzStyleReferences, before.diagram.importedTikzStyleReferences)
  }
  async function clearCase(ids, suffix) {
    const before = await clearSnapshot(`${suffix}-before`), nativeAction = await clearNative(), cleared = await clearSnapshot(`${suffix}-cleared`)
    clearCheck(before, cleared, ids)
    const previous = JSON.parse(before.state.history), committed = JSON.parse(cleared.state.history)
    assert.ok(previous.present && committed.present, 'Clear history includes both current diagrams')
    // The editor retains at most 100 undo entries. At capacity a commit evicts
    // only the oldest entry; the complete retained stack must still match.
    assert.equal(committed.past.length, Math.min(previous.past.length + 1, 100), 'One effective native clear action')
    assert.deepEqual(committed.past, [...previous.past, previous.present].slice(-100), 'Clear retains earlier history and appends its exact undo state')
    assert.notDeepEqual(committed.present, previous.present, 'Clear changes the current diagram')
    assert.deepEqual(committed.future, [], 'Clear discards redo history')
    await undo(); const undone = await clearSnapshot(`${suffix}-undone`)
    assert.deepEqual(undone.diagram.strata, before.diagram.strata)
    await redo(); const redone = await clearSnapshot(`${suffix}-redone`); clearCheck(before, redone, ids)
    const download = await saveAppJson({ page, artifactDir, name: `${scenario}${suffix}-saved`, owned, diagnose })
    await load(download.json); await settle(); await select()
    const reload = await checkAppJsonReload({ page, saved: download, diagnose })
    const reloaded = await clearSnapshot(`${suffix}-reloaded`); clearCheck(before, reloaded, ids)
    for (const [mode, code] of Object.entries(reloaded.output)) await writeFile(resolve(artifactDir, `${scenario}${suffix}-${mode}.tex`), code)
    return { ids, nativeAction, before, cleared, undone, redone, reloaded, download, reload }
  }

  await start('point-paint-clear-imported-style')
  await importSource('clear.sty', sources.clear, 'redpoint'); await apply('redpoint')
  await edit('Node text', '  $F$  '); await settle()
  const single = await clearCase(['app-point'], '')
  single.standalone = await downloadSvg({ fill: 'rgb(255, 0, 0)', text: 'rgb(0, 0, 0)', textAlpha: 1 })
  await load(legacy); await settle(); await select()
  await importSource('independent.sty', sources.clearIndependent, 'independent point')
  for (const [id, source] of [['app-point', 'Clear target'], ['bulk-point', 'Clear second'], ['copy-point', 'Control point']]) {
    await select(id); await apply('independent point'); await edit('Node text', source)
  }
  await select()
  for (const [name, value] of [['Fill color', '#123456'], ['Text color', '#654321'], ['Border color', '#008000'],
    ['Fill opacity', '.25'], ['Text opacity', '.5'], ['Border opacity', '.75'], ['Border width', '3']]) await edit(name, value)
  await settle(); await select('bulk-point', true)
  const multiple = await clearCase(['app-point', 'bulk-point'], '-multi')
  multiple.standalone = await downloadSvg({ fill: 'rgb(18, 52, 86)', fillAlpha: .25, text: 'rgb(101, 67, 33)', textAlpha: .5,
    stroke: 'rgb(0, 128, 0)', strokeAlpha: .75, strokeWidth: 3.6, dashed: true, cap: 'round', join: 'bevel', dashOffset: 1.2 }, '-multi',
  [{ id: 'bulk-point', source: 'Clear second', expected: { fill: 'rgb(0, 0, 255)', fillAlpha: .35, text: 'rgb(255, 0, 0)', textAlpha: .6,
    stroke: 'rgb(0, 255, 0)', strokeAlpha: .7, strokeWidth: 2.4, dashed: true, cap: 'round', join: 'bevel', dashOffset: 1.2 } }])
  await saved({ single, multiple })
}
