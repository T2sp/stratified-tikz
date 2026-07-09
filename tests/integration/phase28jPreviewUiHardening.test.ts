import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import {
  defaultCurveStyle,
} from '../../src/model/styles.ts'
import type {
  ArrowHeadKind,
  CurveStratum,
  Diagram,
  UserStylePreset,
  Vec2,
  Vec3,
  WorkPlane,
} from '../../src/model/types.ts'
import {
  curveArrowheadsForSvgPreview,
} from '../../src/rendering/svgArrows.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  applyContextQuickStyleField,
  applyContextQuickStylePreset,
} from '../../src/ui/contextQuickStyleBar.ts'
import {
  addPointStratumFromDirectInput,
} from '../../src/ui/diagramUpdates.ts'
import {
  addSheetMenuItems,
  closeToolbarPalette,
  shouldCloseCoonsPatchDirectionPanelForSheetMenuItem,
  shouldCloseCoonsPatchDirectionPanelForWorkflow,
  togglePreviewToolbarState,
  toggleToolbarPalette,
} from '../../src/ui/previewToolbar.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  sanitizeSvgPreviewExportTree,
  svgPreviewExportButtonLabel,
  type SvgPreviewExportAttributeLike,
  type SvgPreviewExportElementLike,
} from '../../src/ui/svgPreviewExport.ts'
import {
  applyCustomOriginNormalThetaPhiWorkPlaneInput,
  workPlaneNormalVectorPreviewGeometryFromInput,
  workPlaneSetupMethodOptions,
} from '../../src/ui/workPlaneControls.ts'

const appSource = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
)
const appCss = readFileSync(
  new URL('../../src/App.css', import.meta.url),
  'utf8',
)
const layerManagerSource = readFileSync(
  new URL('../../src/ui/LayerManager.tsx', import.meta.url),
  'utf8',
)
const quickBarSource = readFileSync(
  new URL('../../src/ui/ContextQuickStyleBar.tsx', import.meta.url),
  'utf8',
)
const editingDocs = readFileSync(
  new URL('../../docs/EDITING.md', import.meta.url),
  'utf8',
)
const previewUiDocs = readFileSync(
  new URL('../../docs/PREVIEW_UI.md', import.meta.url),
  'utf8',
)
const tikzOutputDocs = readFileSync(
  new URL('../../docs/TIKZ_OUTPUT.md', import.meta.url),
  'utf8',
)

test('Phase 28 style-reference docs distinguish local and imported references', () => {
  assert.doesNotMatch(editingDocs, /style preset\/import references/)
  assert.match(editingDocs, /`stylePresetId`/)
  assert.match(editingDocs, /`importedTikzStyleReferenceId`/)
  assert.match(
    editingDocs,
    /Imported TikZ style references are preserved when possible/,
  )
  assert.match(editingDocs, /explicit override/)
  assert.match(
    previewUiDocs,
    /keeps the imported TikZ style reference where possible/,
  )
  assert.match(previewUiDocs, /avoiding duplicated options/)
})

test('Phase 28 arrow-preview docs describe differentiated SVG arrowheads', () => {
  assert.match(
    tikzOutputDocs,
    /SVG preview draws approximate arrowhead families/,
  )

  for (const arrowHead of [
    '`>`',
    '`Stealth`',
    '`Latex`',
    '`Stealth[harpoon]`',
    '`Stealth[harpoon,swap]`',
  ]) {
    assert.equal(tikzOutputDocs.includes(arrowHead), true)
  }

  assert.doesNotMatch(tikzOutputDocs, /approximate\s+triangular\s+arrowheads/)
  assert.equal(
    /does\s+not\s+attempt[\s\S]{0,80}(Stealth|Latex|harpoon)/.test(
      tikzOutputDocs,
    ),
    false,
  )
  assert.match(tikzOutputDocs, /source of truth/)
  assert.match(previewUiDocs, /SVG Preview draws path arrowheads/)
  assert.match(previewUiDocs, /harpoon side/)
})

test('large Preview, Export SVG, and Layer edge actions share a robust layout', () => {
  const previewStageRule = cssRule('.preview-stage')
  const layerControlRule = cssRule('.preview-layer-control')
  const workPlaneControlRule = cssRule('.preview-work-plane-control')
  const edgeActionsRule = cssRule('.preview-edge-actions')
  const svgDiagramRule = cssRule('.svg-diagram')

  assert.match(previewStageRule, /height:\s*min\(90svh,/)
  assert.match(previewStageRule, /height:\s*min\(90dvh,/)
  assert.match(previewStageRule, /overflow:\s*visible;/)
  assert.match(layerControlRule, /position:\s*sticky;/)
  assert.match(layerControlRule, /grid-area:\s*1 \/ 1;/)
  assert.match(layerControlRule, /justify-items:\s*end;/)
  assert.match(workPlaneControlRule, /justify-items:\s*start;/)
  assert.match(edgeActionsRule, /justify-content:\s*flex-end;/)
  assert.match(edgeActionsRule, /transform:\s*translateY\(50%\);/)
  assert.match(svgDiagramRule, /grid-area:\s*1 \/ 1;/)
  assert.match(
    layerManagerSource,
    /<div className="preview-edge-actions" aria-label="Preview edge actions">/,
  )
  assert.match(appSource, /aria-label=\{svgPreviewExportButtonLabel\}/)
  assert.equal(svgPreviewExportButtonLabel, 'Export current diagram view as SVG')
})

test('quick style shortcut edits are preserved by TikZ and SVG export', () => {
  const colorEdited = applyContextQuickStyleField(
    phase28CurveDiagram(),
    curveSelection(),
    'curve.strokeColor',
    '#336699',
  )
  const widthEdited = applyContextQuickStyleField(
    colorEdited,
    curveSelection(),
    'curve.lineWidth',
    2.3,
  )
  const curve = findCurve(widthEdited, 'curve-a')
  const tikz = generateTikz({
    ...widthEdited,
    strata: [curve],
  })
  const svg = new FakeSvgElement('svg', { viewBox: '0 0 100 80' }, [
    new FakeSvgElement('path', {
      'data-svg-hit-target': 'curve-a',
      class: 'svg-curve',
      d: 'M 0,0 L 100,0',
      stroke: curve.style.strokeColor,
      'stroke-width': String(curve.style.lineWidth),
    }),
  ])

  sanitizeSvgPreviewExportTree(svg)

  const exported = svg.serialize()

  assert.match(tikz, /line width=2\.3pt/)
  assert.match(tikz, /\{HTML\}\{336699\}/)
  assert.match(exported, /stroke="#336699"/)
  assert.match(exported, /stroke-width="2.3"/)
  assert.doesNotMatch(exported, /data-svg-hit-target|class="svg-curve"/)
})

test('imported TikZ style shortcut then explicit override keeps export compact', () => {
  const diagram = importedCurveStyleDiagram()
  const preset = importedCurvePreset(diagram)
  const applied = applyContextQuickStylePreset(
    diagram,
    curveSelection(),
    preset.id,
  )

  assert.equal(applied.ok, true)
  if (!applied.ok) {
    throw new Error(applied.message)
  }

  const overridden = applyContextQuickStyleField(
    applied.diagram,
    curveSelection(),
    'curve.lineWidth',
    0.8,
  )
  const curve = findCurve(overridden, 'curve-a')
  const tikz = generateTikz({
    ...overridden,
    strata: [curve],
  })

  assert.equal(curve.stylePresetId, undefined)
  assert.equal(
    curve.importedTikzStyleReferenceId,
    preset.importedTikzStyleReferenceId,
  )
  assert.match(tikz, new RegExp(escapeRegExp(importedCurveKey)))
  assert.match(tikz, /line width=0\.8pt/)
  assert.doesNotMatch(tikz, /draw=stz/)
  assert.doesNotMatch(tikz, /draw opacity=/)
})

test('work-plane polar point creation exports local symbolic coordinates cleanly', () => {
  const result = addPointStratumFromDirectInput(
    symbolicPolarDiagram(),
    { x: 'R', y: 'q', z: '0' },
    {
      id: 'phase28j-polar-point',
      coordinateMode: 'workPlaneLocal',
      workPlaneLocalInputMode: 'polar',
      workPlane: phase28CustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected polar point creation to succeed.')
  }

  const point = result.diagram.strata.find(
    (stratum) => stratum.id === result.id,
  )

  assert.equal(point?.geometricKind, 'point')
  assert.equal(point?.geometricKind === 'point'
    ? point.position.symbolic?.source?.kind
    : undefined, 'workPlaneLocal')

  const inlineTikz = generateTikz(result.diagram, { exportMode: 'inlineMath' })

  assert.match(inlineTikz, /\{\\R \* cos\(\\q\)\}/)
  assert.match(inlineTikz, /\{\\R \* sin\(\\q\)\}/)
  expectNoBlankLines(inlineTikz)
  expectNoTwoSpaceCommandIndent(inlineTikz)
})

test('origin plus normal work-plane setup keeps method order and preview geometry', () => {
  const result = applyCustomOriginNormalThetaPhiWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    {
      origin: { x: '1', y: '2', z: '3' },
      normalThetaDeg: '90',
      normalPhiDeg: '90',
    },
  )
  const preview = workPlaneNormalVectorPreviewGeometryFromInput({
    origin: { x: '1', y: '2', z: '3' },
    normalThetaDeg: '90',
    normalPhiDeg: '90',
  })

  assert.deepEqual(
    workPlaneSetupMethodOptions.map((method) => method.label),
    [
      'Pick 3 existing points',
      'Origin + normal vector',
      'Custom 3 points',
    ],
  )
  assert.equal(result.ok, true)
  assert.equal(result.workPlane.kind, 'custom')
  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected custom work plane.')
  }
  assertVec3Approx(result.workPlane.origin, { x: 1, y: 2, z: 3 })
  assertVec3Approx(result.workPlane.normal, { x: 0, y: 1, z: 0 })
  assert.notEqual(preview, null)
  assert.equal(preview?.normal.label, 'n')
})

test('Coons direction panel auto-closes when leaving the Coons workflow', () => {
  const coonsItem = addSheetMenuItems().find((item) => item.id === 'coonsPatch')
  const ruledItem = addSheetMenuItems().find((item) => item.id === 'ruledSurface')

  assert.notEqual(coonsItem, undefined)
  assert.notEqual(ruledItem, undefined)
  if (coonsItem === undefined || ruledItem === undefined) {
    throw new Error('Expected Coons and Ruled sheet items.')
  }

  assert.equal(shouldCloseCoonsPatchDirectionPanelForSheetMenuItem(coonsItem), false)
  assert.equal(shouldCloseCoonsPatchDirectionPanelForSheetMenuItem(ruledItem), true)
  assert.equal(
    shouldCloseCoonsPatchDirectionPanelForWorkflow({
      ambientDimension: 3,
      tool: 'createSheet',
      sheetCreationKind: 'coonsPatch',
    }),
    false,
  )
  assert.equal(
    shouldCloseCoonsPatchDirectionPanelForWorkflow({
      ambientDimension: 3,
      tool: 'createPath',
      sheetCreationKind: 'coonsPatch',
    }),
    true,
  )
  assert.equal(
    shouldCloseCoonsPatchDirectionPanelForWorkflow({
      ambientDimension: 2,
      tool: 'createSheet',
      sheetCreationKind: 'coonsPatch',
    }),
    true,
  )
})

test('SVG arrow preview keeps TikZ arrow families visually distinct', () => {
  const heads: ArrowHeadKind[] = [
    'standard',
    'stealth',
    'latex',
    'stealthHarpoon',
    'stealthHarpoonSwap',
  ]
  const arrowheads = heads.map((head) =>
    onlyArrowhead(
      curveArrowheadsForSvgPreview(
        arrowPreviewCurve(head),
        2,
        identityProjection,
      ),
    ),
  )

  assert.deepEqual(
    arrowheads.map((arrowhead) => arrowhead.shape),
    heads,
  )
  assert.equal(
    new Set(arrowheads.map((arrowhead) => arrowhead.pathData)).size,
    heads.length,
  )
  assert.equal(
    new Set(arrowheads.map((arrowhead) => arrowhead.className)).size,
    heads.length,
  )
})

test('variable modal remains topmost and focus-managed above preview overlays', () => {
  const appShellRule = cssRule('.app-shell')
  const backdropRule = cssRule('.modal-backdrop')
  const dialogRule = cssRule('.modal-dialog')

  assert.ok(
    cssVariableNumber(appShellRule, '--z-modal-backdrop') >
      cssVariableNumber(appShellRule, '--z-popover'),
  )
  assert.ok(
    cssVariableNumber(appShellRule, '--z-modal') >
      cssVariableNumber(appShellRule, '--z-modal-backdrop'),
  )
  assert.match(backdropRule, /position:\s*fixed;/)
  assert.match(backdropRule, /z-index:\s*var\(--z-modal-backdrop\);/)
  assert.match(dialogRule, /z-index:\s*var\(--z-modal\);/)
  assert.match(appSource, /role="dialog"/)
  assert.match(appSource, /aria-modal="true"/)
  assert.match(appSource, /symbolicImportFirstInputRef\.current\?\.focus\(\)/)
  assert.match(appSource, /modalFocusableElements\(dialog\)/)
  assert.match(appSource, /onKeyDown=\{handleSymbolicImportDialogKeyDown\}/)
})

test('Phase 28 overlay controls expose accessible labels without saving UI state', () => {
  const before = generateTikz(phase28CurveDiagram())

  assert.match(appSource, /aria-label=\{svgPreviewExportButtonLabel\}/)
  assert.match(appSource, /aria-label="Preview work-plane editor"/)
  assert.match(appSource, /aria-label="Work-plane setup"/)
  assert.match(appSource, /aria-label="Work-plane preset"/)
  assert.match(appSource, /aria-label=\{`Fixed \$\{workPlaneFixedAxis\(activeWorkPlane\)\} coordinate`\}/)
  assert.match(appSource, /aria-label=\{`Origin \$\{axis\}`\}/)
  assert.match(appSource, /aria-label=\{`\$\{point\.toUpperCase\(\)\} \$\{axis\}`\}/)
  assert.match(appSource, /aria-label="Apply origin and normal work plane"/)
  assert.match(appSource, /aria-label="Apply custom three-point work plane"/)
  assert.match(quickBarSource, /aria-label=\{field\.label\}/)
  assert.match(quickBarSource, /aria-label=\{`\$\{field\.label\} slider`\}/)
  assert.match(quickBarSource, /aria-label=\{`\$\{field\.label\} value`\}/)
  assert.match(quickBarSource, /aria-label="Search TikZ styles"/)

  assert.equal(togglePreviewToolbarState('expanded'), 'collapsed')
  assert.equal(toggleToolbarPalette(null, 'addPoint'), 'addPoint')
  assert.equal(closeToolbarPalette(), null)
  assert.equal(generateTikz(phase28CurveDiagram()), before)
})

test('Phase 28 style and arrow edits keep inline TikZ compact and four-space indented', () => {
  const diagram = {
    ...phase28CurveDiagram(),
    strata: [
      createCurveStratum({
        ambientDimension: 2,
        id: 'phase28-arrow-path',
        name: 'Phase 28 arrow path',
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        arrows: {
          endpoint: 'both',
          mid: {
            enabled: true,
            head: 'stealthHarpoonSwap',
            position: 0.4,
            direction: 'forward',
          },
        },
      }),
    ],
  }
  const styled = applyContextQuickStyleField(
    diagram,
    { kind: 'stratum', id: 'phase28-arrow-path' },
    'curve.lineWidth',
    1.7,
  )
  const inlineTikz = generateTikz(styled, { exportMode: 'inlineMath' })

  assert.match(inlineTikz, /line width=1\.7pt/)
  assert.match(inlineTikz, /\\arrow\{Stealth\[harpoon,swap\]\}/)
  assert.match(inlineTikz, /\n {4}\\coordinate \(curvePolyPhase28ArrowPath0p0\)/)
  assert.match(inlineTikz, /\n {4}\\begin\{pgfonlayer\}\{stratifiedLayer0\}/)
  expectNoBlankLines(inlineTikz)
  expectNoTwoSpaceCommandIndent(inlineTikz)
})

class FakeSvgElement implements SvgPreviewExportElementLike {
  readonly tagName: string
  readonly childElements: FakeSvgElement[]
  private readonly attributeMap: Map<string, string>
  private parent: FakeSvgElement | null = null

  constructor(
    tagName: string,
    attributes: Readonly<Record<string, string>> = {},
    children: readonly FakeSvgElement[] = [],
  ) {
    this.tagName = tagName
    this.attributeMap = new Map(Object.entries(attributes))
    this.childElements = []
    children.forEach((child) => this.append(child))
  }

  get attributes(): SvgPreviewExportAttributeLike[] {
    return [...this.attributeMap].map(([name, value]) => ({ name, value }))
  }

  get children(): FakeSvgElement[] {
    return this.childElements
  }

  append(child: FakeSvgElement): void {
    child.parent = this
    this.childElements.push(child)
  }

  getAttribute(name: string): string | null {
    return this.attributeMap.get(name) ?? null
  }

  setAttribute(name: string, value: string): void {
    this.attributeMap.set(name, value)
  }

  removeAttribute(name: string): void {
    this.attributeMap.delete(name)
  }

  remove(): void {
    if (this.parent === null) {
      return
    }

    const index = this.parent.childElements.indexOf(this)

    if (index >= 0) {
      this.parent.childElements.splice(index, 1)
    }

    this.parent = null
  }

  serialize(): string {
    const attributes = [...this.attributeMap]
      .map(([name, value]) => ` ${name}="${value}"`)
      .join('')
    const children = this.childElements.map((child) => child.serialize()).join('')

    return `<${this.tagName}${attributes}>${children}</${this.tagName}>`
  }
}

const importedCurveKey = 'phase28/curve/highlight'

const phase28CustomWorkPlane: WorkPlane = {
  kind: 'custom',
  id: 'phase28-custom-plane',
  name: 'Phase 28 plane',
  origin: { x: 10, y: 20, z: 30 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
  source: { kind: 'originNormal' },
}

function phase28CurveDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    strata: [
      createCurveStratum({
        ambientDimension: 2,
        id: 'curve-a',
        name: 'Curve A',
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
      }),
    ],
  }
}

function importedCurveStyleDiagram(): Diagram {
  return importTikzStyleFile(
    phase28CurveDiagram(),
    'phase28-styles.sty',
    String.raw`\tikzset{phase28/.cd, curve/highlight/.style={red!60,decorate,decoration={snake}}}`,
  ).diagram
}

function importedCurvePreset(diagram: Diagram): UserStylePreset {
  const preset = (diagram.userStylePresets ?? []).find(
    (candidate) =>
      candidate.kind === 'curve' && candidate.name === 'phase28: curve/highlight',
  )

  if (preset === undefined) {
    throw new Error('Expected imported curve preset.')
  }

  return preset
}

function curveSelection(): SelectedElement {
  return { kind: 'stratum', id: 'curve-a' }
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const curve = diagram.strata.find(
    (stratum): stratum is CurveStratum =>
      stratum.id === id && stratum.geometricKind === 'curve',
  )

  if (curve === undefined) {
    throw new Error(`Expected curve ${id}.`)
  }

  return curve
}

function symbolicPolarDiagram(): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '2',
        previewValue: 2,
      },
      {
        id: 'var-q',
        name: 'q',
        macroName: 'q',
        expression: '30',
        previewValue: 30,
      },
    ],
  }
}

function arrowPreviewCurve(head: ArrowHeadKind): CurveStratum {
  return createCurveStratum({
    ambientDimension: 2,
    id: `arrow-${head}`,
    name: `Arrow ${head}`,
    style: {
      ...defaultCurveStyle,
      lineWidth: 1.6,
    },
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ],
    arrows: {
      endpoint: 'none',
      mid: {
        enabled: true,
        head,
        position: 0.5,
        direction: 'forward',
      },
    },
  })
}

function identityProjection(point: Vec3): Vec2 {
  return {
    x: point.x,
    y: point.y,
  }
}

function onlyArrowhead(
  arrowheads: ReturnType<typeof curveArrowheadsForSvgPreview>,
): ReturnType<typeof curveArrowheadsForSvgPreview>[number] {
  assert.equal(arrowheads.length, 1)

  const arrowhead = arrowheads[0]

  if (arrowhead === undefined) {
    throw new Error('Expected one arrowhead.')
  }

  return arrowhead
}

function cssRule(selector: string): string {
  const start = appCss.indexOf(`${selector} {`)

  assert.notEqual(start, -1, `Missing CSS rule for ${selector}.`)

  const end = appCss.indexOf('\n}', start)

  assert.notEqual(end, -1, `Missing CSS rule end for ${selector}.`)

  return appCss.slice(start, end + 2)
}

function cssVariableNumber(rule: string, variableName: string): number {
  const match = new RegExp(`${escapeRegExp(variableName)}:\\s*(\\d+);`).exec(rule)

  assert.notEqual(match, null, `Missing CSS variable ${variableName}.`)

  return Number(match?.[1])
}

function assertVec3Approx(actual: Vec3, expected: Vec3): void {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9)
  assert.ok(Math.abs(actual.y - expected.y) < 1e-9)
  assert.ok(Math.abs(actual.z - expected.z) < 1e-9)
}

function expectNoBlankLines(output: string): void {
  assert.doesNotMatch(output, /\n[ \t]*\n/)
}

function expectNoTwoSpaceCommandIndent(output: string): void {
  const twoSpaceCommandIndent =
    /\n {2}\\(?:begin\{pgfonlayer\}|end\{pgfonlayer\}|begin\{scope\}|end\{scope\}|coordinate|definecolor|draw|filldraw|node|path|pgfdeclarelayer|pgfsetlayers|tdplotsetmaincoords|tikzset)/

  assert.doesNotMatch(output, twoSpaceCommandIndent)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
