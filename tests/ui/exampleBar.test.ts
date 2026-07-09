import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { emptyTwoDimensionalDiagram } from '../../src/examples/index.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  collapseExampleBarForEditing,
  defaultExampleBarState,
  shouldCollapseExampleBarForDiagramChange,
  toggleExampleDropdown,
} from '../../src/ui/exampleBar.ts'

const appSource = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
)
const appCss = readFileSync(new URL('../../src/App.css', import.meta.url), 'utf8')

test('preview stage uses large viewport-oriented sizing', () => {
  const appShellRule = cssRule('.app-shell')
  const previewStageRule = cssRule('.preview-stage')

  assert.match(appShellRule, /--compact-header-height:\s*96px;/)
  assert.match(appShellRule, /--preview-stage-min-height:\s*640px;/)
  assert.match(previewStageRule, /height:\s*min\(90dvh,/)
  assert.match(
    previewStageRule,
    /calc\(100dvh - var\(--compact-header-height\) - 12px\)/,
  )
  assert.match(previewStageRule, /min-height:\s*var\(--preview-stage-min-height\);/)
  assert.match(previewStageRule, /overflow:\s*visible;/)
})

test('example bar is expanded before editing by default', () => {
  assert.equal(defaultExampleBarState(), 'expanded')
  assert.match(
    appSource,
    /useState<ExampleBarState>\(\(\) => defaultExampleBarState\(\)\)/,
  )
  assert.match(appSource, /effectiveExampleBarState === 'expanded'/)
})

test('editing action collapses example bar to compact mode', () => {
  assert.equal(shouldCollapseExampleBarForDiagramChange(true), false)
  assert.equal(shouldCollapseExampleBarForDiagramChange(false), true)
  assert.equal(collapseExampleBarForEditing(), 'compact')
  assert.match(appSource, /setExampleBarState\(collapseExampleBarForEditing\(\)\)/)
})

test('loading JSON collapses example bar', () => {
  const commitStart = appSource.indexOf('function commitLoadedJsonDiagram')
  const commitEnd = appSource.indexOf('async function loadJsonFile', commitStart)
  const commitSource = appSource.slice(commitStart, commitEnd)
  const symbolicImportSource = appSource.slice(
    appSource.indexOf("if (result.kind === 'needsVariableResolution')"),
    appSource.indexOf('commitLoadedJsonDiagram(result.diagram', commitEnd),
  )

  assert.match(commitSource, /setExampleBarState\(collapseExampleBarForEditing\(\)\)/)
  assert.match(commitSource, /setIsExampleDropdownOpen\(false\)/)
  assert.match(
    symbolicImportSource,
    /setExampleBarState\(collapseExampleBarForEditing\(\)\)/,
  )
  assert.match(symbolicImportSource, /setIsExampleDropdownOpen\(false\)/)
})

test('example dropdown opens without reducing preview height', () => {
  const stackRule = cssRule('.example-control-stack')
  const dropdownRule = cssRule('.example-dropdown-menu')
  const previewStageRule = cssRule('.preview-stage')

  assert.equal(toggleExampleDropdown(false), true)
  assert.equal(toggleExampleDropdown(true), false)
  assert.match(stackRule, /position:\s*relative;/)
  assert.match(dropdownRule, /position:\s*absolute;/)
  assert.match(dropdownRule, /z-index:\s*120;/)
  assert.doesNotMatch(previewStageRule, /example/i)
})

test('switching examples still selects fresh cloned diagram data', () => {
  const selectStart = appSource.indexOf('function selectExample')
  const selectEnd = appSource.indexOf('function updateEditableDiagram', selectStart)
  const selectSource = appSource.slice(selectStart, selectEnd)

  assert.match(selectSource, /const nextExample = getExampleOption\(exampleId\)/)
  assert.match(selectSource, /const nextDiagram = cloneDiagram\(nextExample\.diagram\)/)
  assert.match(selectSource, /setSelectedExampleId\(exampleId\)/)
  assert.match(selectSource, /setIsExampleDropdownOpen\(false\)/)
})

test('preview overlays still render inside preview stage', () => {
  const previewStage = appSource.indexOf('className="preview-stage"')
  const previewArticleEnd = appSource.indexOf('</article>', previewStage)
  const previewMarkup = appSource.slice(previewStage, previewArticleEnd)

  assert.ok(previewStage >= 0)
  assert.match(previewMarkup, /\{renderPreviewToolbarOverlay\(\)\}/)
  assert.match(previewMarkup, /\{renderDirectInputDrawer\(\)\}/)
  assert.match(previewMarkup, /\{renderInspectorDrawer\(\)\}/)
  assert.match(previewMarkup, /\{renderLayerManagerOverlay\(\)\}/)
})

test('TikZ output is unaffected by example bar state', () => {
  const before = generateTikz(emptyTwoDimensionalDiagram)

  assert.equal(defaultExampleBarState(), 'expanded')
  assert.equal(collapseExampleBarForEditing(), 'compact')
  assert.equal(toggleExampleDropdown(false), true)
  assert.equal(generateTikz(emptyTwoDimensionalDiagram), before)
})

test('example bar state is UI-only and not stored in Diagram', () => {
  const serialized = serializeDiagram(emptyTwoDimensionalDiagram)
  const parsed = JSON.parse(serialized) as {
    diagram: Record<string, unknown>
  }

  assert.equal('exampleBarState' in parsed.diagram, false)
  assert.equal('isExampleDropdownOpen' in parsed.diagram, false)
  assert.equal(serialized.includes('exampleDropdown'), false)
})

function cssRule(selector: string): string {
  const start = appCss.indexOf(`${selector} {`)

  assert.notEqual(start, -1, `Missing CSS rule for ${selector}.`)

  const end = appCss.indexOf('\n}', start)

  assert.notEqual(end, -1, `Missing CSS rule end for ${selector}.`)

  return appCss.slice(start, end + 2)
}
