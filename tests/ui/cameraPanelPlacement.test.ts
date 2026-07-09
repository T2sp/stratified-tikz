import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
)
const appCss = readFileSync(new URL('../../src/App.css', import.meta.url), 'utf8')

test('camera panel is rendered between preview and TikZ source', () => {
  const workspace = appSource.indexOf(
    'aria-label="Preview, inspector, and TikZ source"',
  )
  const previewRow = appSource.indexOf(
    'className="preview-inspector-row preview-shell"',
    workspace,
  )
  const previewStage = appSource.indexOf(
    'className="preview-stage"',
    previewRow,
  )
  const previewArticleEnd = appSource.indexOf('</article>', previewStage)
  const cameraPanel = appSource.indexOf('{renderCameraPanel()}', previewArticleEnd)
  const sourcePanel = appSource.indexOf(
    'className="workspace-panel source-panel"',
    cameraPanel,
  )

  assert.ok(workspace >= 0)
  assert.ok(previewRow > workspace)
  assert.ok(previewStage > previewRow)
  assert.ok(cameraPanel > previewArticleEnd)
  assert.ok(sourcePanel > cameraPanel)
})

test('preview stage does not duplicate camera panel controls', () => {
  const previewStage = appSource.indexOf('className="preview-stage"')
  const previewArticleEnd = appSource.indexOf('</article>', previewStage)
  const previewMarkup = appSource.slice(previewStage, previewArticleEnd)

  assert.equal(previewMarkup.includes('renderCameraPanel()'), false)
  assert.equal(previewMarkup.includes('camera-panel'), false)
  assert.equal(appSource.includes('camera-control'), false)
  assert.equal(appCss.includes('.camera-control'), false)
})

test('camera panel keeps the shared visibility guard', () => {
  const panelStart = appSource.indexOf('function renderCameraPanel()')
  const fieldsStart = appSource.indexOf('function renderCameraSliderField', panelStart)
  const renderCameraPanelSource = appSource.slice(panelStart, fieldsStart)

  assert.match(renderCameraPanelSource, /if \(!showCameraControls\) {\n {6}return null\n {4}}/)
  assert.match(renderCameraPanelSource, /Preview view/)
  assert.match(renderCameraPanelSource, /cameraControlSliderFieldsForAmbientDimension/)
})

test('camera panel collapse state is not serialized as diagram data', () => {
  const saveStart = appSource.indexOf('function downloadJson()')
  const saveEnd = appSource.indexOf('function openLoadJsonPicker()', saveStart)
  const saveSource = appSource.slice(saveStart, saveEnd)

  assert.match(
    saveSource,
    /camera3d: showCameraOrientationPanel \? cameraControl : undefined/,
  )
  assert.equal(saveSource.includes('isCameraDetailsExpanded'), false)
  assert.equal(saveSource.includes('cameraFieldDrafts'), false)
  assert.equal(saveSource.includes('cameraStatus'), false)
})

test('TikZ copy actions are rendered in the source shell before the source textarea', () => {
  const sourcePanel = appSource.indexOf(
    'className="workspace-panel source-panel"',
  )
  const copyControls = appSource.indexOf('className="copy-controls"', sourcePanel)
  const visibilityControls = appSource.indexOf('3D Visibility', copyControls)
  const sourceShell = appSource.indexOf(
    'className="tikz-source-shell"',
    visibilityControls,
  )
  const sourceActions = appSource.indexOf(
    'className="tikz-source-actions"',
    sourceShell,
  )
  const copyButton = appSource.indexOf('Copy TikZ', sourceActions)
  const downloadButton = appSource.indexOf('Download TikZ', sourceActions)
  const sourceTextarea = appSource.indexOf('className="tikz-source"', sourceActions)
  const optionsSource = appSource.slice(copyControls, sourceShell)

  assert.ok(sourcePanel >= 0)
  assert.ok(copyControls > sourcePanel)
  assert.ok(visibilityControls > copyControls)
  assert.ok(sourceShell > visibilityControls)
  assert.ok(sourceActions > sourceShell)
  assert.ok(copyButton > sourceActions)
  assert.ok(downloadButton > copyButton)
  assert.ok(sourceTextarea > downloadButton)
  assert.equal(optionsSource.includes('Copy TikZ'), false)
  assert.equal(optionsSource.includes('Download TikZ'), false)
})

test('TikZ source shell keeps actions fixed above the internally scrolling code area', () => {
  const sourcePanelRule = cssRule('.source-panel')
  const headingRule = cssRule('.source-panel .panel-heading')
  const shellRule = cssRule('.tikz-source-shell')
  const actionRule = cssRule('.tikz-source-actions')
  const textareaRule = cssRule('.tikz-source')

  assert.match(sourcePanelRule, /grid-template-rows:\s*auto minmax\(0, 1fr\);/)
  assert.match(headingRule, /overflow:\s*auto;/)
  assert.match(shellRule, /grid-template-rows:\s*auto minmax\(0, 1fr\);/)
  assert.match(shellRule, /overflow:\s*hidden;/)
  assert.match(actionRule, /flex-wrap:\s*wrap;/)
  assert.match(actionRule, /border-bottom:/)
  assert.match(textareaRule, /overflow:\s*auto;/)
  assert.match(textareaRule, /border:\s*0;/)
})

function cssRule(selector: string): string {
  const start = appCss.indexOf(`${selector} {`)

  assert.notEqual(start, -1, `Missing CSS rule for ${selector}.`)

  const end = appCss.indexOf('\n}', start)

  assert.notEqual(end, -1, `Missing CSS rule end for ${selector}.`)

  return appCss.slice(start, end + 2)
}
