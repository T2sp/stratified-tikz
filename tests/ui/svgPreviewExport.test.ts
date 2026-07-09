import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { emptyTwoDimensionalDiagram } from '../../src/examples/index.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  defaultSvgPreviewExportFilename,
  sanitizeSvgPreviewExportTree,
  svgPreviewExportButtonLabel,
  svgPreviewExportMimeType,
  type SvgPreviewExportAttributeLike,
  type SvgPreviewExportElementLike,
} from '../../src/ui/svgPreviewExport.ts'

const appSource = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
)
const appCss = readFileSync(new URL('../../src/App.css', import.meta.url), 'utf8')
const layerManagerSource = readFileSync(
  new URL('../../src/ui/LayerManager.tsx', import.meta.url),
  'utf8',
)

test('Export SVG button is rendered as a preview edge action', () => {
  assert.match(layerManagerSource, /edgeActions\?: ReactNode/)
  assert.match(
    layerManagerSource,
    /<div className="preview-edge-actions" aria-label="Preview edge actions">/,
  )
  assert.match(appSource, /edgeActions=\{\s*<button/)
  assert.match(appSource, /className="preview-overlay-button preview-edge-action-button svg-export-button"/)
  assert.match(appSource, /aria-label=\{svgPreviewExportButtonLabel\}/)
  assert.match(appSource, />\s*Export SVG\s*<\/button>/)
})

test('Export SVG edge action is placed at the sticky right-bottom below the frame', () => {
  const previewStageRule = cssRule('.preview-stage')
  const layerControlRule = cssRule('.preview-layer-control')
  const edgeActionsRule = cssRule('.preview-edge-actions')
  const svgDiagramRule = cssRule('.svg-diagram')

  assert.match(previewStageRule, /overflow:\s*visible;/)
  assert.match(layerControlRule, /position:\s*sticky;/)
  assert.match(layerControlRule, /grid-area:\s*1 \/ 1;/)
  assert.match(layerControlRule, /bottom:\s*12px;/)
  assert.match(layerControlRule, /justify-items:\s*end;/)
  assert.match(edgeActionsRule, /justify-content:\s*flex-end;/)
  assert.match(edgeActionsRule, /flex-wrap:\s*wrap;/)
  assert.match(edgeActionsRule, /transform:\s*translateY\(50%\);/)
  assert.match(svgDiagramRule, /grid-area:\s*1 \/ 1;/)
})

test('SVG preview export sanitizer removes editor chrome and metadata', () => {
  const svg = new FakeSvgElement('svg', {
    'aria-label': 'Interactive preview',
    class: 'svg-diagram',
    role: 'img',
    viewBox: '0 0 520 360',
  })
  const toolbarChrome = new FakeSvgElement('g', {
    class: 'svg-coordinate-anchors',
    'data-svg-export-exclude': 'true',
  }, [
    new FakeSvgElement('foreignObject', {}, [
      new FakeSvgElement('button', { class: 'toolbar-button' }),
    ]),
  ])

  svg.append(toolbarChrome)
  svg.append(new FakeSvgElement('path', { d: 'M 10,10 L 40,40' }))

  sanitizeSvgPreviewExportTree(svg)

  const exported = svg.serialize()

  assert.doesNotMatch(exported, /toolbar-button|foreignObject|button/)
  assert.doesNotMatch(exported, /aria-label|role|class|data-svg-export-exclude/)
  assert.match(exported, /<path d="M 10,10 L 40,40"><\/path>/)
  assert.match(exported, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(exported, /width="520"/)
  assert.match(exported, /height="360"/)
})

test('SVG preview export preserves diagram primitives and current view coordinates', () => {
  const svg = new FakeSvgElement('svg', { viewBox: '0 0 520 360' }, [
    new FakeSvgElement('polygon', { points: '100,250 260,210 240,90' }),
    new FakeSvgElement('path', { d: 'M 140,210 L 300,130' }),
    new FakeSvgElement('circle', { cx: '300', cy: '130', r: '5.4' }),
    new FakeSvgElement('text', { x: '168', y: '184' }),
  ])

  sanitizeSvgPreviewExportTree(svg)

  const exported = svg.serialize()

  assert.match(exported, /viewBox="0 0 520 360"/)
  assert.match(exported, /points="100,250 260,210 240,90"/)
  assert.match(exported, /d="M 140,210 L 300,130"/)
  assert.match(exported, /cx="300"/)
  assert.match(exported, /x="168"/)
})

test('SVG preview export keeps arrow preview geometry while dropping editor data attributes', () => {
  const svg = new FakeSvgElement('svg', { viewBox: '0 0 520 360' }, [
    new FakeSvgElement('polygon', {
      'data-svg-arrow-preview': 'endpoint',
      'data-svg-arrow-head': 'stealth',
      fill: '#111111',
      points: '300,130 288,124 288,136',
    }),
  ])

  sanitizeSvgPreviewExportTree(svg)

  const exported = svg.serialize()

  assert.match(exported, /<polygon fill="#111111" points="300,130 288,124 288,136"><\/polygon>/)
  assert.doesNotMatch(exported, /data-svg-arrow/)
})

test('SVG preview export uses the SVG diagram only, not the surrounding UI', () => {
  assert.match(appSource, /querySelector<SVGSVGElement>\('svg\.svg-diagram'\)/)
  assert.match(appSource, /filename: defaultSvgPreviewExportFilename/)
  assert.match(appSource, /mimeType: svgPreviewExportMimeType/)
  assert.equal(defaultSvgPreviewExportFilename, 'stratified-tikz-preview.svg')
  assert.equal(svgPreviewExportMimeType, 'image/svg+xml;charset=utf-8')
  assert.equal(svgPreviewExportButtonLabel, 'Export current diagram view as SVG')
})

test('SVG preview export helpers do not affect TikZ export modes', () => {
  const standaloneBefore = generateTikz(emptyTwoDimensionalDiagram, {
    exportMode: 'standalone',
  })
  const inlineBefore = generateTikz(emptyTwoDimensionalDiagram, {
    exportMode: 'inlineMath',
  })

  sanitizeSvgPreviewExportTree(
    new FakeSvgElement('svg', { viewBox: '0 0 520 360' }, [
      new FakeSvgElement('path', { d: 'M 0,0 L 1,1' }),
    ]),
  )

  assert.equal(
    generateTikz(emptyTwoDimensionalDiagram, { exportMode: 'standalone' }),
    standaloneBefore,
  )
  assert.equal(
    generateTikz(emptyTwoDimensionalDiagram, { exportMode: 'inlineMath' }),
    inlineBefore,
  )
  assert.doesNotMatch(inlineBefore, /\n\s*\n/)
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

function cssRule(selector: string): string {
  const start = appCss.indexOf(`${selector} {`)

  assert.notEqual(start, -1, `Missing CSS rule for ${selector}.`)

  const end = appCss.indexOf('\n}', start)

  assert.notEqual(end, -1, `Missing CSS rule end for ${selector}.`)

  return appCss.slice(start, end + 2)
}
