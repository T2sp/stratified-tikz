import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layerManagerSource = readFileSync(
  new URL('../../src/ui/LayerManager.tsx', import.meta.url),
  'utf8',
)
const appCss = readFileSync(new URL('../../src/App.css', import.meta.url), 'utf8')

test('layer palette keeps View, New, and Actions in the footer', () => {
  const bodyStart = layerManagerSource.indexOf('className="layer-palette-body"')
  const footerStart = layerManagerSource.indexOf(
    'className="layer-palette-footer"',
  )
  const footerEnd = layerManagerSource.indexOf('</div>', footerStart)
  const footerSource = layerManagerSource.slice(footerStart, footerEnd)

  assert.ok(bodyStart >= 0)
  assert.ok(footerStart > bodyStart)
  assert.match(footerSource, /<span>View<\/span>/)
  assert.match(footerSource, /className="layer-palette-new-layer-form"/)
  assert.match(footerSource, /layer-palette-actions-toggle/)
})

test('layer palette keeps close controls in the header and actions above the footer', () => {
  const headerStart = layerManagerSource.indexOf(
    'className="layer-palette-heading"',
  )
  const bodyStart = layerManagerSource.indexOf('className="layer-palette-body"')
  const footerStart = layerManagerSource.indexOf(
    'className="layer-palette-footer"',
  )
  const closeButton = layerManagerSource.indexOf(
    'className="preview-overlay-button layer-palette-close-button"',
    headerStart,
  )
  const actionsPanel = layerManagerSource.indexOf(
    '<SelectedLayerActions',
    bodyStart,
  )

  assert.ok(headerStart >= 0)
  assert.ok(closeButton > headerStart)
  assert.ok(closeButton < bodyStart)
  assert.ok(actionsPanel > bodyStart)
  assert.ok(actionsPanel < footerStart)
})

test('layer palette CSS reserves an inspector-safe top area and bounds the window', () => {
  const previewStageRule = cssRule('.preview-stage')
  const controlRule = cssRule('.preview-layer-control')
  const windowRule = cssRule('.layer-palette-window')

  assert.match(previewStageRule, /--preview-overlay-top-safe-area:\s*52px;/)
  assert.match(previewStageRule, /--preview-layer-toggle-offset:\s*42px;/)
  assert.match(controlRule, /position:\s*sticky;/)
  assert.match(controlRule, /grid-area:\s*1 \/ 1;/)
  assert.match(controlRule, /bottom:\s*12px;/)
  assert.match(
    controlRule,
    /margin:\s*var\(--preview-overlay-top-safe-area\) 12px 0;/,
  )
  assert.match(windowRule, /bottom:\s*var\(--preview-layer-toggle-offset\);/)
  assert.match(windowRule, /display:\s*flex;/)
  assert.match(windowRule, /flex-direction:\s*column;/)
  assert.match(
    windowRule,
    /max-height:\s*calc\(100% - var\(--preview-layer-toggle-offset\)\);/,
  )
  assert.match(windowRule, /overflow:\s*hidden;/)
})

test('layer palette CSS scrolls the layer list between fixed header and footer', () => {
  const headingRule = cssRule('.layer-palette-heading')
  const bodyRule = cssRule('.layer-palette-body')
  const listRule = cssRule('.layer-palette-list')
  const footerRule = cssRule('.layer-palette-footer')

  assert.match(headingRule, /flex:\s*0 0 auto;/)
  assert.match(bodyRule, /flex:\s*1 1 auto;/)
  assert.match(bodyRule, /min-height:\s*0;/)
  assert.match(bodyRule, /overflow:\s*hidden;/)
  assert.match(listRule, /min-height:\s*0;/)
  assert.match(listRule, /overflow-y:\s*auto;/)
  assert.match(listRule, /overflow-x:\s*hidden;/)
  assert.match(footerRule, /display:\s*flex;/)
  assert.match(footerRule, /flex:\s*0 0 auto;/)
  assert.match(footerRule, /flex-wrap:\s*wrap;/)
})

test('layer actions panel is styled as a translucent overlay', () => {
  const panelRule = cssRule('.layer-palette-action-panel')
  const overlayRule = cssRule('.layer-palette-action-overlay')
  const backgroundOpacity = panelRule.match(
    /background:\s*color-mix\(in srgb, #ffffff (\d+)%, transparent\);/,
  )?.[1]

  assert.match(
    layerManagerSource,
    /className="layer-palette-action-panel layer-palette-action-overlay"/,
  )
  assert.notEqual(backgroundOpacity, undefined)
  assert.ok(Number(backgroundOpacity) >= 60)
  assert.ok(Number(backgroundOpacity) <= 75)
  assert.match(panelRule, /box-shadow:\s*rgba\(30, 34, 44, 0\.18\) 0 10px 28px;/)
  assert.match(panelRule, /backdrop-filter:\s*blur\(12px\) saturate\(115%\);/)
  assert.match(overlayRule, /isolation:\s*isolate;/)
})

test('layer actions toggle exposes active state while keeping action handlers wired', () => {
  assert.match(layerManagerSource, /actionsExpanded \? 'is-selected' : ''/)
  assert.match(layerManagerSource, /aria-pressed=\{actionsExpanded\}/)
  assert.match(layerManagerSource, /onRenameLayer\(layerValue, draftName\)/)
  assert.match(layerManagerSource, /onDuplicateLayer\(layerValue, targetLayer\.targetLayerValue\)/)
  assert.match(layerManagerSource, /onTranslateLayer\(layerValue, parsed\.translation\)/)
  assert.match(layerManagerSource, /onClick=\{\(\) => onDeleteLayer\(layer\.value\)\}/)
})

function cssRule(selector: string): string {
  const start = appCss.indexOf(`${selector} {`)

  assert.notEqual(start, -1, `Missing CSS rule for ${selector}.`)

  const end = appCss.indexOf('\n}', start)

  assert.notEqual(end, -1, `Missing CSS rule end for ${selector}.`)

  return appCss.slice(start, end + 2)
}
