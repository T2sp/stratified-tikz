/**
 * Actual-browser Phase 31C checks against production SvgDiagram and its event
 * handlers. Uses the existing external-Playwright convention; adds no package.
 *
 * STZ_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
 * STZ_BROWSER_EXECUTABLE=/absolute/path/to/chrome node scripts/checkFreeLabels.mjs
 */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { runGeometryChecks } from './checkFreeLabelGeometry.mjs'
import { runRaceChecks } from './checkFreeLabelRaces.mjs'
import { runAppChecks } from './checkFreeLabelsApp.mjs'
import { runInlineLabelChecks } from './checkInlineLabels.mjs'
import { runPointNodeChecks } from './checkPointNodes.mjs'
import { pointNodeScenarios } from './automation/phase-verification.mjs'
import { runCombinedLabelChecks } from './checkCombinedLabels.mjs'
import { runSettledSvgExportChecks, runSettledSvgVisibilityChecks } from './checkSettledSvgExports.mjs'

const artifactDir = resolve(process.env.STZ_SMOKE_ARTIFACT_DIR ?? '/private/tmp/stz-free-labels-' + Date.now())
await mkdir(artifactDir, { recursive: true })
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
const diff = git('diff', 'HEAD', '--binary')
const untrackedNames = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)
const untracked = Object.fromEntries(await Promise.all(untrackedNames.map(async (file) => [file, await readFile(file, 'utf8')])))
const checkout = { revision: git('rev-parse', 'HEAD').trim(), status: git('status', '--short'),
  trackedDiffSha256: createHash('sha256').update(diff).digest('hex'),
  untrackedSha256: Object.fromEntries(Object.entries(untracked).map(([file, text]) =>
    [file, createHash('sha256').update(text).digest('hex')])) }
await writeFile(resolve(artifactDir, 'checkout.diff'), diff)
await writeFile(resolve(artifactDir, 'checkout-untracked.json'), JSON.stringify(untracked, null, 2))
const scenarios = [
  'existing-renderer-regressions', 'independent-oracle-negative-controls', 'boundary-anchor-camera-matrix',
  'inverted-success-and-failure-races', 'pending-lock-and-autohide', 'deletion-and-unmount',
  'real-App-input-JSON-history-reused-ID-load', 'current-SVG-cloning',
  'inline-node-rendering-placement-halo-picking', 'inline-node-lifecycle-path-operations-export',
  'settled-SVG-export-standalone',
  'combined-free-inline-workflows',
  ...Object.keys(pointNodeScenarios),
]
const completed = []
const started = []
const checkpoints = []
const diagnostics = []
const evidence = []
const pageErrors = []
const environment = { nodeVersion: process.version, browserVersion: null,
  playwrightModule: process.env.STZ_PLAYWRIGHT_MODULE ?? 'playwright',
  browserExecutable: process.env.STZ_BROWSER_EXECUTABLE ?? null,
  serverKind: 'Vite development server (production renderer and development fixtures)',
  baseUrl: process.env.STZ_BROWSER_BASE_URL ?? null }
let browser, server, page
let stage = 'playwright-import'
let checkpoint = null
let primaryFailure
async function save(result, error) {
  await writeFile(resolve(artifactDir, 'free-labels-evidence.json'), JSON.stringify({ result, stage, environment, checkout,
    checkpoint, started, checkpoints, completed, incompleteGroups: scenarios.filter((name) => !completed.includes(name)),
    unexecuted: scenarios.filter((name) => !started.includes(name)),
    coverageNote: 'Started/checkpoints and diagnostics describe execution, not passing assertions. Evidence records passed scenarios; groups complete only after all their assertions return.',
    diagnostics, evidence, pageErrors,
    error: error ? { message: error.message, stack: error.stack, code: error.code } : undefined }, null, 2) + '\n')
}
async function startGroup(group, name = group) {
  assert.ok(scenarios.includes(group), `Known scenario group: ${group}`)
  if (!started.includes(group)) started.push(group)
  checkpoint = { group, name }
  checkpoints.push(checkpoint)
  await save('running')
}
async function completeGroup(group) {
  assert.ok(started.includes(group) && !completed.includes(group), `Started, incomplete group: ${group}`)
  if (pointNodeScenarios[group]) {
    for (const name of pointNodeScenarios[group]) {
      assert.ok(evidence.some((entry) => entry.name === name && entry.group === group && entry.result === 'passed'), `Completed scenario: ${name}`)
    }
  }
  completed.push(group)
  await save('running')
}
async function observe(name, details) {
  checkpoint = { group: checkpoint?.group, name }
  checkpoints.push(checkpoint)
  diagnostics.push({ name, ...details })
  await save('running')
}
function secondaryFailure(name, error) {
  diagnostics.push({ name, error: { message: error.message, stack: error.stack } })
  console.error(`Free-label browser ${name}: ${error.message}`)
}
async function saveFailure() {
  try {
    await save('failed', primaryFailure)
  } catch (error) {
    secondaryFailure('failure-evidence-write-failed', error)
  }
}
try {
  const moduleName = environment.playwrightModule
  const { chromium } = await import(isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName)
  stage = 'development-server-listen'
  server = process.env.STZ_BROWSER_BASE_URL ? null
    : await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
  if (server) await server.listen()
  const address = server?.httpServer.address()
  assert.ok(process.env.STZ_BROWSER_BASE_URL || (address && typeof address !== 'string'))
  const origin = process.env.STZ_BROWSER_BASE_URL ?? `http://127.0.0.1:${address.port}`
  environment.baseUrl = origin
  stage = 'browser-launch'
  browser = await chromium.launch({ headless: true,
    ...(process.env.STZ_BROWSER_EXECUTABLE ? { executablePath: process.env.STZ_BROWSER_EXECUTABLE } : {}) })
  environment.browserVersion = browser.version()
  stage = 'renderer-fixture'
  page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`${origin}/stratified-tikz/scripts/fixtures/freeLabels.html`)
  await page.waitForFunction(() => window.stzLabels !== undefined)

  const mount = (labels, extra = {}) => page.evaluate((options) => window.stzLabels.mount(options), { labels, ...extra })
  const state = () => page.evaluate(() => window.stzLabels.state())
  const settled = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  const label = (id) => page.locator(`[data-label-id="${id}"] [data-label-state]`)
  const inspect = (id) => page.evaluate((labelId) => {
    const outer = document.querySelector(`[data-label-id="${labelId}"]`)
    const node = outer?.querySelector('[data-label-state]')
    if (!node) return null
    const box = node.querySelector(':scope > g').getBBox()
    const rect = node.getBoundingClientRect()
    return {
      source: node.getAttribute('data-label-source'), state: node.getAttribute('data-label-state'),
      math: node.querySelectorAll('[data-label-math]').length,
      literal: Array.from(node.querySelectorAll('[data-label-literal]')).map((text) => text.textContent).join(''),
      text: Array.from(node.querySelectorAll('text')).map((text) => text.textContent).join(''),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      transform: node.getAttribute('transform'), color: node.getAttribute('color'), opacity: node.getAttribute('opacity'),
      paint: node.querySelector(':scope > g')?.getAttribute('color'), paintOpacity: node.querySelector(':scope > g')?.getAttribute('opacity'),
      attrs: Object.fromEntries(Array.from(node.attributes, ({ name, value }) => [name, value])),
    }
  }, id)
  const click = async (id) => {
    const found = await inspect(id)
    assert.ok(found, `Rendered label ${id} exists`)
    await page.mouse.click(found.rect.x + found.rect.width / 2, found.rect.y + found.rect.height / 2)
  }
  async function record(name, details = {}) {
    evidence.push({ name, ...details })
    console.log(JSON.stringify({ result: 'passed', name }))
    await save('running')
  }

  const fallbackSource = '  "<>&"  \\textbf{bad}\t keep \\slash\r\n tail  '
  await startGroup('existing-renderer-regressions', 'initial-renderer-source-state-and-whitespace')
  const sources = [
    { id: 'F', text: '$F^{(1)}L$' },
    { id: 'alpha', text: '$\\alpha \\colon f \\Rightarrow g$' },
    { id: 'fraction', text: '$\\frac{1}{1+\\frac{x}{y}}$' },
    { id: 'japanese', text: '日本語 $x_i$ と $\\beta$' },
    { id: 'lines', text: 'first $x$\nsecond $y$' },
    { id: 'matrix', text: '$\\begin{matrix}a & b \\\\\n c & d\\end{matrix}$' },
    { id: 'fallback', text: fallbackSource },
    { id: 'undefined', text: '$\\definitelyUndefinedCommand{x}$' },
    { id: 'parse', text: 'prefix $unclosed' },
  ]
  await mount(sources)
  const initial = await state()
  await settled()
  for (const entry of sources) {
    const displayed = await inspect(entry.id)
    assert.equal(displayed.source, entry.text)
    const fallback = ['fallback', 'undefined', 'parse'].includes(entry.id)
    assert.equal(displayed.state, fallback ? 'fallback' : 'ready', entry.id)
    assert.equal(displayed.math > 0, !fallback, entry.id)
    assert.ok(Object.values(displayed.box).every(Number.isFinite))
  }
  assert.equal((await inspect('japanese')).math, 2)
  assert.equal((await inspect('matrix')).math, 1, 'A physical newline inside math stays in one formula')
  assert.ok((await inspect('lines')).box.height > (await inspect('F')).box.height)
  const after = await state()
  for (const key of ['json', 'history', 'tikz', 'inlineTikz']) assert.equal(after[key], initial[key], `${key} unaffected by arrivals`)
  assert.equal(await page.locator('foreignObject, image').count(), 0)
  assert.equal(await page.locator('script:not([type="module"])').count(), 0)
  async function checkLiteralFont(name) {
    const observation = await page.evaluate(async () => {
      const { measureSvgTextAdvance, measureSvgTabStop } = await import('./labelBrowserOracle.ts')
      const node = document.querySelector('[data-label-id="fallback"] [data-label-state]')
      const fragments = Array.from(node.querySelectorAll('text'), (text) => {
        const value = text.textContent
        const style = getComputedStyle(text)
        const space = measureSvgTextAdvance(text, ' ')
        const leading = measureSvgTextAdvance(text, value.match(/^\s*/u)[0])
        const trailing = measureSvgTextAdvance(text, value.match(/\s*$/u)[0])
        // These deliberately broken Canvas measurements are negative controls,
        // never the oracle. Exercise empty/invalid input even on browsers that
        // can serialize this particular computed font shorthand.
        const canvasAttempts = [style.font, '', 'not-a-valid-font'].map((assignedFont) => {
          const context = document.createElement('canvas').getContext('2d')
          const initialFont = context.font
          context.font = assignedFont
          return { assignedFont, initialFont, acceptedFont: context.font,
            spaceWidth: context.measureText(' ').width,
            leadingWidth: context.measureText(leading.text).width,
            trailingWidth: context.measureText(trailing.text).width }
        })
        return { text: value, whiteSpace: style.whiteSpace, xmlSpace: text.getAttribute('xml:space'),
          x: text.x.baseVal.getItem(0).value, y: text.y.baseVal.getItem(0).value,
          width: text.getComputedTextLength(), space, leading, trailing, canvasAttempts,
          tspans: Array.from(text.querySelectorAll('tspan'), (span) => ({ text: span.textContent, x: span.getAttribute('x'), y: span.getAttribute('y') })) }
      })
      const first = fragments[0], actualX = fragments[1]?.x
      const tab = measureSvgTabStop(node.querySelector('text'), first.x + first.width)
      const stop = tab.interval.advance
      const expectedX = tab.advance
      const roundedSingleSpaceStop = first.space.advance * 4
      const roundedSingleSpaceExpectedX = (Math.floor((first.x + first.width) / roundedSingleSpaceStop) + 1) * roundedSingleSpaceStop
      const negativeControls = first.canvasAttempts.map((attempt) => {
        const wrongStop = attempt.spaceWidth * 4
        const wrongExpectedX = (Math.floor((first.x + first.width) / wrongStop) + 1) * wrongStop
        return { ...attempt, expectedX: wrongExpectedX, actualX, delta: actualX - wrongExpectedX }
      })
      return { source: node.getAttribute('data-label-source'), fragments, tab, stop, expectedX, actualX,
        roundedSingleSpaceExpectedX, roundedSingleSpaceDelta: actualX - roundedSingleSpaceExpectedX,
        delta: actualX - expectedX, tolerance: 0.5, negativeControls,
        remainingMeasurementClones: node.querySelectorAll('[data-label-oracle-measurement]').length }
    })
    // Persist observations BEFORE the tab assertion (and separately from PASS
    // records), so a partial renderer failure still has its complete font data.
    await observe(name, observation)
    observation.content = await page.evaluate(async () => {
      const { inspectLabelContent } = await import('./labelBrowserOracle.ts')
      return inspectLabelContent('fallback')
    })
    await observe(`${name}-independent-content`, observation)
    const { fragments, content } = observation
    assert.equal(observation.source, fallbackSource, 'Complete raw source including tab and CRLF remains authoritative')
    assert.ok(fragments.every((text) => /pre|break-spaces/.test(text.whiteSpace) || text.xmlSpace === 'preserve'))
    assert.deepEqual(fragments.map(({ text }) => text), fallbackSource.split(/\t|\r\n/u), 'Complete literal fragments preserve edge/repeated whitespace')
    assert.equal(fragments.length, 3, 'Tab and CRLF split the literal into positioned fragments')
    assert.equal(observation.tab.method, 'svg-whitespace-grid')
    assert.equal(observation.tab.next.text.length, observation.tab.index * 4, 'Expected tab position measures the complete space prefix')
    assert.ok(observation.tab.previous.advance <= fragments[0].x + fragments[0].width, 'Preceding tab stop is at or before the current text advance')
    assert.ok(observation.tab.next.advance > fragments[0].x + fragments[0].width, 'A tab advances strictly beyond the current text advance')
    assert.ok(Math.abs(observation.delta) < 0.5, 'Tab advances to a measured four-space stop')
    assert.equal(fragments[0].y, fragments[1].y)
    assert.ok(fragments[2].y > fragments[1].y, 'CRLF is exactly one physical line break')
    assert.equal(observation.remainingMeasurementClones, 0, 'Temporary oracle text is removed')
    for (const fragment of fragments) {
      for (const measurement of [fragment.space, fragment.leading, fragment.trailing]) {
        assert.equal(measurement.method, 'svg-text-clone')
        assert.deepEqual(measurement.effective.properties, measurement.computed.properties, 'Clone uses current displayed font/spacing longhands')
        assert.equal(measurement.effective.xmlSpace, measurement.computed.xmlSpace)
        assert.ok(Number.isFinite(measurement.advance) && measurement.advance >= 0)
      }
      assert.notEqual(Number.parseFloat(fragment.space.computed.properties['font-size']), 10, 'Regression uses the displayed non-default font')
      assert.ok(fragment.space.advance > 0)
      for (const attempt of fragment.canvasAttempts.slice(1)) {
        assert.equal(attempt.acceptedFont, attempt.initialFont, 'Empty/unusable shorthand silently retains unrelated Canvas default')
        assert.ok(Math.abs(fragment.space.advance - attempt.spaceWidth) > 0.5, 'Default 10px space advance is not a valid displayed-font oracle')
        for (const edge of ['leading', 'trailing']) if (fragment[edge].text.length) {
          assert.ok(Math.abs(fragment[edge].advance - attempt[`${edge}Width`]) > 0.5, 'Default font is rejected for literal edge whitespace too')
        }
      }
    }
    for (const control of observation.negativeControls.slice(1)) {
      assert.ok(Math.abs(control.delta) >= 0.5, 'Bad default-font tab oracle fails the unchanged tolerance')
    }
    const edgeAdvance = Math.max(...fragments.flatMap(({ leading, trailing }) => [leading.advance, trailing.advance]))
    assert.equal(content.tolerances.whitespaceAdvance, edgeAdvance, 'Content allowance uses independent displayed-font edge advances')
    assert.equal(content.tolerances.horizontal, content.fontSize * 0.35 + edgeAdvance + 1, 'Finite horizontal allowance is unchanged')
    await page.evaluate(async (measurement) => {
      const { assertLabelContent } = await import('./labelBrowserOracle.ts')
      assertLabelContent(measurement)
    }, content)
    await record(name, observation)
    return observation
  }
  const firstFont = await checkLiteralFont('literal-tab-and-edge-whitespace-displayed-font')
  await page.evaluate(() => window.stzLabels.mutateLabel('fallback', { style: { fontSize: 24 } }))
  await settled()
  const changedFont = await checkLiteralFont('literal-tab-and-edge-whitespace-changed-font')
  assert.notEqual(changedFont.fragments[0].space.computed.properties['font-size'], firstFont.fragments[0].space.computed.properties['font-size'])
  assert.ok(changedFont.fragments[0].space.advance > firstFont.fragments[0].space.advance, 'Oracle remeasures the current font after an edit')
  assert.ok(changedFont.content.tolerances.whitespaceAdvance > firstFont.content.tolerances.whitespaceAdvance, 'Edge allowance follows the current font')
  await record('real MathJax, Japanese/multiple runs/newlines, whole-source failure, raw model/TikZ/history preservation', { mathInvocations: after.invocationCount })

  const anchors = ['center', 'north', 'south', 'east', 'west', 'north east', 'north west', 'south east', 'south west']
  await mount(anchors.map((anchor, index) => ({ id: `anchor${index}`, text: '$\\frac{x_1}{y^2}$', style: { anchor, fontSize: 20, color: '#d02080', opacity: 0.6 } })))
  await settled()
  const anchored = await state()
  for (const [index, anchor] of anchors.entries()) {
    const item = await inspect(`anchor${index}`)
    assert.equal(item.paint, '#d02080')
    assert.equal(item.paintOpacity, '0.6')
    const measured = await page.evaluate((id) => window.stzLabels.inspectContent(id), `anchor${index}`)
    await record(`legacy-anchor-${anchor}`, { measurement: measured, camera: anchored.camera })
  }
  const beforeColor = await state()
  await page.evaluate(() => window.stzLabels.mutateLabel('anchor0', { style: { kind: 'labelStyle', color: '#2040b0', opacity: 0.4, fontSize: 32, anchor: 'center' } }))
  await settled()
  assert.equal((await state()).invocationCount, beforeColor.invocationCount, 'Font/style update reuses math geometry')
  assert.equal((await inspect('anchor0')).paint, '#2040b0')
  assert.equal((await inspect('anchor0')).paintOpacity, '0.4')
  assert.ok((await inspect('anchor0')).rect.height > (await inspect('anchor1')).rect.height)
  await record('all nine measured anchors, tall math, font scaling, explicit paint and opacity')

  await mount([{ id: 'dupA', text: '$\\frac{x}{y}$', position: { x: 0, y: 0, z: 0 } }, { id: 'dupB', text: '$\\frac{x}{y}$', position: { x: 0, y: 0, z: 0 } }])
  await settled()
  assert.equal((await inspect('dupA')).math, 1)
  assert.equal((await inspect('dupB')).math, 1)
  const duplicateIds = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[data-label-state] [id]'), (node) => node.id)
    return ids.length !== new Set(ids).size
  })
  assert.equal(duplicateIds, false)
  await click('dupB')
  assert.equal((await state()).selection.id, 'dupB')
  assert.equal((await state()).selectionEvents.length, 1, 'Formula paths do not create duplicate events')
  await page.keyboard.down('Alt')
  await click('dupA')
  const firstCycle = (await state()).selection.id
  await click('dupA')
  const secondCycle = (await state()).selection.id
  await page.keyboard.up('Alt')
  assert.notEqual(firstCycle, secondCycle, 'Production Alt-click cycles compiled overlap')
  assert.deepEqual(new Set([firstCycle, secondCycle]), new Set(['dupA', 'dupB']))
  await record('duplicate immutable output, native formula click, production overlap cycling')

  const reuseBefore = await state()
  await page.evaluate(() => window.stzLabels.mutateLabel('dupB', { position: { x: 1.2, y: 0.3, z: 0 }, style: { color: '#cc4400' } }))
  await page.evaluate(() => window.stzLabels.setProps({ cameraViewAdjustment: { zoom: 1.7, pan: { x: 25, y: -15 } } }))
  await settled()
  await click('dupB')
  assert.equal((await state()).selection.id, 'dupB')
  await page.keyboard.down('Alt')
  await click('dupB')
  await page.keyboard.up('Alt')
  assert.equal((await state()).selection.id, 'dupB', 'Measured picking follows pan/zoom')
  assert.equal((await state()).invocationCount, reuseBefore.invocationCount, 'Moves/paint/selection/pan/zoom reuse conversion')
  const dragHandle = page.locator('[aria-label="Selected label drag handles"] circle')
  const handle = await dragHandle.boundingBox()
  assert.ok(handle)
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2 - 20, { steps: 3 })
  await page.mouse.up()
  const dragged = await state()
  assert.ok(dragged.dragCount > 0)
  assert.notDeepEqual(dragged.labels[1].position, { x: 1.2, y: 0.3, z: 0 })
  assert.equal(dragged.invocationCount, reuseBefore.invocationCount)
  await page.evaluate(() => window.stzLabels.undo())
  assert.deepEqual((await state()).labels[1].position, { x: 1.2, y: 0.3, z: 0 })
  await page.evaluate(() => window.stzLabels.redo())
  assert.deepEqual((await state()).labels[1].position, dragged.labels[1].position)
  await record('2D pan/zoom measured picking, selection markers, production drag/history, conversion reuse', { mathInvocations: dragged.invocationCount })

  await mount([{ id: 'threeD', text: '$\\alpha \\Rightarrow \\beta$', position: { x: 0.6, y: 0.4, z: 0.7 } }], { ambientDimension: 3 })
  await settled()
  const before3d = await state()
  await page.evaluate(() => window.stzLabels.setProps({ cameraOverride: { mode: '3d', kind: 'orthographic', thetaDeg: 70, phiDeg: 40, zoom: 130, pan: { x: 440, y: 320 } } }))
  await click('threeD')
  await page.keyboard.down('Alt')
  await click('threeD')
  await page.keyboard.up('Alt')
  assert.equal((await state()).selection.id, 'threeD')
  assert.equal((await state()).invocationCount, before3d.invocationCount)
  await record('3D camera projection and production measured picking reuse geometry')

  await mount([{ id: 'fallbackA', text: 'bad $', position: { x: 0, y: 0, z: 0 } }, { id: 'fallbackB', text: 'bad $', position: { x: 0, y: 0, z: 0 } }])
  await settled()
  await click('fallbackB')
  assert.equal((await state()).selection.id, 'fallbackB')
  await page.keyboard.down('Alt')
  await click('fallbackA')
  const fallbackCycleA = (await state()).selection.id
  await click('fallbackA')
  const fallbackCycleB = (await state()).selection.id
  await page.keyboard.up('Alt')
  assert.deepEqual(new Set([fallbackCycleA, fallbackCycleB]), new Set(['fallbackA', 'fallbackB']))
  await record('literal fallback labels retain native click and measured overlap cycling')

  await mount([
    { id: 'visible', text: '$x$', layer: 1, position: { x: -2, y: 0, z: 0 } },
    { id: 'locked', text: '$y$', layer: 2, position: { x: 0, y: 0, z: 0 } },
    { id: 'hidden', text: '$z$', layer: 3, position: { x: 2, y: 0, z: 0 } },
  ], { layers: [{ value: 1, name: 'visible' }, { value: 2, name: 'locked', locked: true }, { value: 3, name: 'hidden', visible: false }] })
  await settled()
  assert.equal(await label('hidden').count(), 0)
  await click('locked')
  assert.equal((await state()).selection, null)
  await page.keyboard.down('Alt')
  await click('locked')
  await page.keyboard.up('Alt')
  assert.equal((await state()).selection, null)
  await page.evaluate(() => window.stzLabels.filter(2))
  await click('visible')
  assert.equal((await state()).selection, null)
  for (const policy of ['autoHide', 'autoDim']) {
    // Match the sheet's layer so layerThenDepth can apply depth occlusion.
    await mount([{ id: 'occluded', text: '$x$', layer: 0, position: { x: 0, y: -1, z: 0 } }], { ambientDimension: 3, occlusion: policy })
    await settled()
    await observe(`settled-${policy}-visibility`, { state: await state(), visibility: await page.locator('[data-label-id="occluded"]').getAttribute('data-label-visibility') })
    assert.equal(await page.locator(`[data-label-visibility="${policy === 'autoHide' ? 'hidden' : 'dimmed'}"]`).count(), 1)
    assert.equal(await page.locator('[data-label-id="occluded"]').getAttribute('data-occluding-surface-id'), 'sheet')
    if (policy === 'autoHide') {
      assert.equal(await label('occluded').count(), 0)
      await page.keyboard.down('Alt')
      await page.mouse.click(450, 350)
      await page.keyboard.up('Alt')
      assert.notEqual((await state()).selection?.kind, 'label')
    } else {
      await click('occluded')
      assert.equal((await state()).selection.id, 'occluded')
    }
  }
  await record('locked/hidden/filtered layers and autoHide/autoDim preserve picking policy')

  stage = 'independent-geometry-and-boundary-picking'
  await runGeometryChecks({ page, record, artifactDir, startGroup, completeGroup })
  stage = 'controlled-races-and-pending-policy'
  await runRaceChecks({ page, record, artifactDir, startGroup, completeGroup })

  stage = 'renderer-failure-isolation'
  await startGroup('existing-renderer-regressions', 'mounted-load-output-and-input-limit-failures')

  for (const mode of ['load-error', 'output-error']) {
    await page.evaluate((value) => window.stzLabels.changeService(value), mode)
    await mount([{ id: 'failed', text: '$x$' }, { id: 'sibling', text: 'ordinary 日本語' }])
    await settled()
    assert.equal((await inspect('failed')).state, 'fallback')
    assert.equal((await inspect('failed')).source, '$x$')
    assert.equal((await inspect('failed')).math, 0)
    assert.equal((await inspect('sibling')).state, 'ready')
  }
  await page.evaluate(() => window.stzLabels.changeService('real'))
  const longSource = 'x'.repeat(16_385)
  await mount([{ id: 'limit', text: longSource }, { id: 'good', text: '$x^2$' }])
  await settled()
  assert.equal((await inspect('limit')).state, 'fallback')
  assert.equal((await inspect('limit')).source, longSource)
  assert.equal((await inspect('good')).state, 'ready')
  await record('actual mounted load/output/input-limit failures remain isolated exact-source fallback')

  await completeGroup('existing-renderer-regressions')
  stage = 'current-SVG-cloning'
  await startGroup('current-SVG-cloning')
  await mount([{ id: 'exportMath', text: '$\\frac{a}{b}$' }, { id: 'exportFallback', text: fallbackSource }])
  await settled()
  await page.evaluate(() => window.stzLabels.select({ kind: 'label', id: 'exportMath' }))
  for (const background of ['transparent', 'white']) {
    const exported = await page.evaluate((value) => window.stzLabels.export(value), background)
    assert.ok(exported && exported.includes('<path'))
    assert.ok(exported.includes('&lt;&gt;&amp;'))
    assert.ok(!exported.includes('svg-geometry-handle'))
    assert.ok(!exported.includes('data-svg-export-exclude'))
    const parsed = await page.evaluate((source) => {
      const svg = new DOMParser().parseFromString(source, 'image/svg+xml')
      return { errors: svg.querySelectorAll('parsererror').length, paths: svg.querySelectorAll('path').length, foreign: svg.querySelectorAll('foreignObject,image').length }
    }, exported)
    assert.equal(parsed.errors, 0)
    assert.ok(parsed.paths > 0)
    assert.equal(parsed.foreign, 0)
  }
  await record('currently visible transparent/white SVG export retains settled geometry and literal fallback; editor overlays removed')
  await page.screenshot({ path: resolve(artifactDir, 'settled-export.png'), fullPage: true })
  await completeGroup('current-SVG-cloning')
  stage = 'inline-node-production-rendering-and-path-lifecycle'
  await runInlineLabelChecks({ page, record, observe, artifactDir, startGroup, completeGroup })
  stage = 'combined-free-inline-workflows'
  await runCombinedLabelChecks({ page, record, observe, artifactDir, startGroup, completeGroup })
  stage = 'real-App-workflows'
  await startGroup('real-App-input-JSON-history-reused-ID-load')
  await runPointNodeChecks({ page, browser, origin, record, observe, artifactDir, startGroup, completeGroup })
  await runAppChecks({ browser, origin, record, artifactDir })
  await completeGroup('real-App-input-JSON-history-reused-ID-load')
  stage = 'settled-SVG-export-standalone'
  await startGroup('settled-SVG-export-standalone')
  await runSettledSvgVisibilityChecks({ browser, page, record, observe, artifactDir })
  await runSettledSvgExportChecks({ browser, origin, record, observe, artifactDir })
  await completeGroup('settled-SVG-export-standalone')
  assert.deepEqual(pageErrors, [], 'Browser raised no uncaught errors')
  assert.deepEqual(new Set(completed), new Set(scenarios), 'All required groups completed')
  stage = 'resource-cleanup'
} catch (error) {
  primaryFailure = error
  // Failure observations must survive even if optional image capture stalls or
  // rejects. No diagnostic or teardown error may replace the scenario error.
  await saveFailure()
  console.error(`Free-label browser acceptance failed at ${stage}; evidence: ${artifactDir}`)
  if (page) {
    try {
      await page.screenshot({ path: resolve(artifactDir, 'failure.png'), fullPage: false, timeout: 5_000 })
    } catch (screenshotError) {
      secondaryFailure('failure-screenshot-failed', screenshotError)
    }
  }
} finally {
  // Attempt both owned resources even when one close fails. A teardown failure
  // after otherwise successful checks is still a failed verification.
  for (const [name, resource] of [['browser', browser], ['server', server]]) {
    if (!resource) continue
    try {
      await resource.close()
    } catch (error) {
      if (!primaryFailure) {
        primaryFailure = error
        stage = `${name}-cleanup`
      } else {
        secondaryFailure(`${name}-cleanup-failed`, error)
      }
      await saveFailure()
    }
  }
  if (primaryFailure) await saveFailure()
}
if (primaryFailure) throw primaryFailure
stage = 'complete'
checkpoint = { name: 'complete' }
await save('passed')
console.log(JSON.stringify({ result: 'free-label-browser-check-passed', environment, checks: evidence.length, artifactDir }))
