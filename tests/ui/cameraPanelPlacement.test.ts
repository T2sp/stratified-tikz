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
    '<div className="preview-stage">',
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
  const previewStage = appSource.indexOf('<div className="preview-stage">')
  const previewArticleEnd = appSource.indexOf('</article>', previewStage)
  const previewMarkup = appSource.slice(previewStage, previewArticleEnd)

  assert.equal(previewMarkup.includes('renderCameraPanel()'), false)
  assert.equal(previewMarkup.includes('camera-panel'), false)
  assert.equal(appSource.includes('camera-control'), false)
  assert.equal(appCss.includes('.camera-control'), false)
})

test('camera panel is hidden by the existing 3D-only camera policy', () => {
  const panelStart = appSource.indexOf('function renderCameraPanel()')
  const fieldsStart = appSource.indexOf('function renderCameraSliderField', panelStart)
  const renderCameraPanelSource = appSource.slice(panelStart, fieldsStart)

  assert.match(renderCameraPanelSource, /if \(!showCameraControls\) {\n {6}return null\n {4}}/)
})

test('camera panel collapse state is not serialized as diagram data', () => {
  const saveStart = appSource.indexOf('function downloadJson()')
  const saveEnd = appSource.indexOf('function openLoadJsonPicker()', saveStart)
  const saveSource = appSource.slice(saveStart, saveEnd)

  assert.match(saveSource, /camera3d: showCameraControls \? cameraControl : undefined/)
  assert.equal(saveSource.includes('isCameraDetailsExpanded'), false)
  assert.equal(saveSource.includes('cameraFieldDrafts'), false)
  assert.equal(saveSource.includes('cameraStatus'), false)
})
