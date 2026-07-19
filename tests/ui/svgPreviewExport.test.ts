import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { emptyTwoDimensionalDiagram } from '../../src/examples/index.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  defaultSvgPreviewBackgroundMode,
  defaultSvgPreviewExportFilename,
  prepareSvgPreviewExportClone,
  sanitizeSvgPreviewExportTree,
  svgPreviewBackgroundModeFromSelectValue,
  svgPreviewBackgroundModeOptions,
  svgPreviewExportBackgroundSelectLabel,
  svgPreviewExportButtonLabel,
  svgPreviewExportMimeType,
  svgPreviewExportSuccessMessage,
  type SvgPreviewExportAttributeLike,
  type SvgPreviewExportElementLike,
  type SvgPreviewExportOptions,
} from '../../src/ui/svgPreviewExport.ts'

const appSource = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
)
const appCss = readFileSync(new URL('../../src/App.css', import.meta.url), 'utf8')
const svgDiagramSource = readFileSync(
  new URL('../../src/rendering/SvgDiagram.tsx', import.meta.url),
  'utf8',
)
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
  assert.match(appSource, /edgeActions=\{\s*<div className="svg-export-control">/)
  assert.match(appSource, /className="preview-overlay-button preview-edge-action-button svg-export-button"/)
  assert.match(appSource, /aria-label=\{svgPreviewExportButtonLabel\}/)
  assert.match(appSource, />\s*Export SVG\s*<\/button>/)
})

test('SVG export background selector defaults to transparent component state', () => {
  assert.equal(defaultSvgPreviewBackgroundMode, 'transparent')
  assert.deepEqual(svgPreviewBackgroundModeOptions, [
    { value: 'transparent', label: 'Transparent background' },
    { value: 'white', label: 'White background' },
  ])
  assert.equal(svgPreviewBackgroundModeFromSelectValue('white'), 'white')
  assert.equal(
    svgPreviewBackgroundModeFromSelectValue('unexpected'),
    'transparent',
  )
  assert.match(
    appSource,
    /useState<SvgPreviewBackgroundMode>\(defaultSvgPreviewBackgroundMode\)/,
  )
  assert.match(appSource, /aria-label=\{svgPreviewExportBackgroundSelectLabel\}/)
  assert.match(appSource, /value=\{svgPreviewBackgroundMode\}/)
  assert.equal(svgPreviewExportBackgroundSelectLabel, 'SVG export background')
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

test('transparent export removes root gray styles and the editor background only', () => {
  const liveSvg = new FakeSvgElement(
    'svg',
    {
      background: '#d1d5db',
      'background-color': '#cbd5e1',
      class: 'svg-diagram gray-workspace',
      style:
        'background:#d1d5db; background-color:rgb(203, 213, 225); color:#334155; fill:#abcdef',
      viewBox: '0 0 520 360',
    },
    [
      new FakeSvgElement('rect', {
        'data-svg-background': 'true',
        fill: 'currentColor',
        height: '360',
        width: '520',
      }),
      new FakeSvgElement('path', {
        d: 'M 10,10 L 40,40',
        fill: '#fedcba',
      }),
    ],
  )

  const exported = exportCloneText(liveSvg, { backgroundMode: 'transparent' })

  assert.doesNotMatch(exported, /background(?:-color)?\s*[:=]/i)
  assert.doesNotMatch(exported, /#d1d5db|#cbd5e1|rgb\(203, 213, 225\)/)
  assert.doesNotMatch(exported, /data-svg-background|fill="currentColor"/)
  assert.doesNotMatch(
    exported,
    /data-stratified-tikz-export-background/,
  )
  assert.match(exported, /style="color:#334155;fill:#abcdef;font-family:/)
  assert.match(exported, /<path d="M 10,10 L 40,40" fill="#fedcba">/)
})

test('white export inserts exactly one viewBox rectangle behind geometry and preserves defs', () => {
  const liveSvg = new FakeSvgElement(
    'svg',
    {
      class: 'svg-diagram',
      style: 'background:gray;color:#64748b',
      viewBox: '-12.5 8 520.25 360.5',
    },
    [
      new FakeSvgElement('defs', {}, [
        new FakeSvgElement('marker', { id: 'arrowhead' }),
        new FakeSvgElement('clipPath', { id: 'sheet-clip' }),
      ]),
      new FakeSvgElement('path', {
        d: 'M 0,0 L 20,20',
        'marker-end': 'url(#arrowhead)',
      }),
    ],
  )

  const exportedClone = exportClone(liveSvg, { backgroundMode: 'white' })
  const exported = exportedClone.serialize()

  assert.equal(
    countMatches(exported, /data-stratified-tikz-export-background="white"/g),
    1,
  )
  assert.match(
    exported,
    /<rect x="-12.5" y="8" width="520.25" height="360.5" fill="#ffffff" data-stratified-tikz-export-background="white"><\/rect>/,
  )
  assert.ok(exported.indexOf('<rect') < exported.indexOf('<path'))
  assert.match(exported, /<defs><marker id="arrowhead">/)
  assert.match(exported, /<clipPath id="sheet-clip">/)
  assert.doesNotMatch(exported, /background:gray/)

  assert.equal(
    sanitizeSvgPreviewExportTree(exportedClone, { backgroundMode: 'white' }),
    true,
  )
  assert.equal(
    countMatches(
      exportedClone.serialize(),
      /data-stratified-tikz-export-background="white"/g,
    ),
    1,
  )
})

test('white export safely falls back to numeric root dimensions', () => {
  const svg = new FakeSvgElement('svg', {
    height: '360px',
    width: '520px',
  })

  assert.equal(
    sanitizeSvgPreviewExportTree(svg, { backgroundMode: 'white' }),
    true,
  )
  assert.match(
    svg.serialize(),
    /<rect x="0" y="0" width="520" height="360" fill="#ffffff"/,
  )

  const invalid = new FakeSvgElement('svg', {
    height: '100%',
    width: '100%',
  })

  assert.equal(
    sanitizeSvgPreviewExportTree(invalid, { backgroundMode: 'white' }),
    false,
  )
  assert.doesNotMatch(invalid.serialize(), /fill="#ffffff"/)
})

test('preparing either export mode never mutates the live Preview SVG', () => {
  const liveSvg = representativePreviewSvg('translate(18 24) scale(1.4)')
  const before = liveSvg.serialize()
  const invalidLiveSvg = new FakeSvgElement(
    'svg',
    { class: 'svg-diagram', height: '100%', width: '100%' },
    [editorBackground(520, 360)],
  )
  const invalidBefore = invalidLiveSvg.serialize()

  exportClone(liveSvg, { backgroundMode: 'transparent' })
  exportClone(liveSvg, { backgroundMode: 'white' })
  assert.equal(
    prepareSvgPreviewExportClone(invalidLiveSvg, { backgroundMode: 'white' }),
    null,
  )

  assert.equal(liveSvg.serialize(), before)
  assert.equal(invalidLiveSvg.serialize(), invalidBefore)
  assert.match(before, /class="svg-diagram"/)
  assert.match(before, /data-svg-background="true"/)
  assert.doesNotMatch(before, /data-stratified-tikz-export-background/)
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

test('transparent export preserves sheets, paths, labels, arrows, styles, and images', () => {
  const svg = new FakeSvgElement('svg', { viewBox: '0 0 520 360' }, [
    new FakeSvgElement('defs', {}, [
      new FakeSvgElement('style'),
      new FakeSvgElement('marker', { id: 'arrow' }),
    ]),
    new FakeSvgElement('polygon', {
      fill: '#4d9de0',
      points: '20,20 80,20 50,70',
    }),
    new FakeSvgElement('path', {
      d: 'M 10,100 C 40,20 80,180 120,100',
      fill: 'none',
      'marker-end': 'url(#arrow)',
      stroke: '#111111',
    }),
    new FakeSvgElement('text', { x: '64', y: '88' }),
    new FakeSvgElement('image', {
      height: '24',
      href: 'data:image/png;base64,AAAA',
      width: '24',
    }),
  ])

  const exported = exportCloneText(svg, { backgroundMode: 'transparent' })

  for (const content of [
    '<defs>',
    '<style>',
    '<marker id="arrow">',
    '<polygon fill="#4d9de0"',
    '<path d="M 10,100 C 40,20 80,180 120,100"',
    'marker-end="url(#arrow)"',
    '<text x="64" y="88">',
    '<image height="24" href="data:image/png;base64,AAAA" width="24">',
  ]) {
    assert.match(exported, new RegExp(escapeRegExp(content)))
  }
})

test('Preview wash remains available on screen while exports normalize it per mode', () => {
  const svgDiagramRule = cssRule('.svg-diagram')
  const liveSvg = representativePreviewSvg('translate(12 9) scale(1.25)')
  const transparent = exportCloneText(liveSvg, {
    backgroundMode: 'transparent',
  })
  const white = exportCloneText(liveSvg, { backgroundMode: 'white' })

  assert.match(svgDiagramRule, /background:\s*#ffffff;/)
  assert.match(svgDiagramSource, /fill="currentColor"/)
  assert.match(svgDiagramSource, /opacity="0\.04"/)
  assert.match(svgDiagramSource, /data-svg-export-exclude="true"/)
  assert.doesNotMatch(transparent, /data-svg-background|fill="currentColor"/)
  assert.doesNotMatch(
    transparent,
    /data-stratified-tikz-export-background/,
  )
  assert.match(
    white,
    /fill="#ffffff" data-stratified-tikz-export-background="white"/,
  )
  assert.doesNotMatch(white, /data-svg-background|fill="currentColor"/)
})

test('switching export modes changes only the cloned SVG background content', () => {
  const liveSvg = representativePreviewSvg('translate(-20 14) scale(0.85)')
  const liveBefore = liveSvg.serialize()
  const transparent = exportClone(liveSvg, { backgroundMode: 'transparent' })
  const white = exportClone(liveSvg, { backgroundMode: 'white' })
  const whiteBackground = white.children[0]

  assert.notEqual(whiteBackground, undefined)
  assert.equal(
    whiteBackground?.getAttribute(
      'data-stratified-tikz-export-background',
    ),
    'white',
  )
  whiteBackground?.remove()

  assert.equal(white.serialize(), transparent.serialize())
  assert.equal(liveSvg.serialize(), liveBefore)
  assert.equal(svgPreviewExportSuccessMessage('transparent'),
    'SVG exported with transparent background.')
  assert.equal(svgPreviewExportSuccessMessage('white'),
    'SVG exported with white background.')
  assert.match(appSource, /setSvgPreviewExportStatus\(\s*downloaded/)
})

test('2D pan and zoom transforms export in transparent and white modes', () => {
  const liveSvg = representativePreviewSvg('translate(32 -14) scale(1.8)')

  for (const backgroundMode of ['transparent', 'white'] as const) {
    const exported = exportCloneText(liveSvg, { backgroundMode })

    assert.match(exported, /transform="translate\(32 -14\) scale\(1\.8\)"/)
    assert.match(exported, /<path d="M 20,30 L 180,220"/)
    assert.match(exported, /<text x="96" y="82">/)
  }
})

test('3D projected surfaces, curves, and arrows export in both modes', () => {
  const liveSvg = new FakeSvgElement(
    'svg',
    { class: 'svg-diagram', viewBox: '0 0 720 480' },
    [
      editorBackground(720, 480),
      new FakeSvgElement('g', {
        transform: 'translate(44 28) scale(1.15)',
      }, [
        new FakeSvgElement('polygon', {
          fill: '#4d9de0',
          points: '90,340 330,270 280,80',
        }),
        new FakeSvgElement('path', {
          d: 'M 80,320 C 210,250 300,180 410,100',
          stroke: '#111111',
        }),
        new FakeSvgElement('polygon', {
          'data-svg-arrow-preview': 'endpoint',
          fill: '#111111',
          points: '410,100 394,96 400,112',
        }),
      ]),
    ],
  )

  for (const backgroundMode of ['transparent', 'white'] as const) {
    const exported = exportCloneText(liveSvg, { backgroundMode })

    assert.match(exported, /viewBox="0 0 720 480"/)
    assert.match(exported, /transform="translate\(44 28\) scale\(1\.15\)"/)
    assert.match(exported, /points="90,340 330,270 280,80"/)
    assert.match(exported, /d="M 80,320 C 210,250 300,180 410,100"/)
    assert.match(exported, /points="410,100 394,96 400,112"/)
    assert.doesNotMatch(exported, /data-svg-arrow-preview/)
  }
})

test('SVG preview export uses the SVG diagram only, not the surrounding UI', () => {
  assert.match(appSource, /querySelector<SVGSVGElement>\('svg\.svg-diagram'\)/)
  assert.match(
    appSource,
    /createSvgPreviewExportText\(previewSvg, \{\s*backgroundMode: svgPreviewBackgroundMode,/,
  )
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

  const liveSvg = new FakeSvgElement('svg', { viewBox: '0 0 520 360' }, [
    new FakeSvgElement('path', { d: 'M 0,0 L 1,1' }),
  ])

  exportClone(liveSvg, { backgroundMode: 'transparent' })
  exportClone(liveSvg, { backgroundMode: 'white' })

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

test('SVG background mode is absent from saved diagram JSON', () => {
  const before = serializeDiagram(emptyTwoDimensionalDiagram)

  exportClone(representativePreviewSvg('scale(1)'), {
    backgroundMode: 'transparent',
  })
  exportClone(representativePreviewSvg('scale(1)'), {
    backgroundMode: 'white',
  })

  const after = serializeDiagram(emptyTwoDimensionalDiagram)

  assert.equal(after, before)
  assert.doesNotMatch(after, /svgPreviewBackground|backgroundMode/)
  assert.doesNotMatch(appSource, /editableDiagram[^\n]*backgroundMode/)
})

class FakeSvgElement implements SvgPreviewExportElementLike {
  readonly tagName: string
  readonly childElements: FakeSvgElement[]
  readonly ownerDocument = {
    createElementNS: (_namespace: string, tagName: string) =>
      new FakeSvgElement(tagName),
  }
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
    child.remove()
    child.parent = this
    this.childElements.push(child)
  }

  insertBefore(
    child: FakeSvgElement,
    referenceChild: FakeSvgElement | null,
  ): FakeSvgElement {
    child.remove()
    const index =
      referenceChild === null
        ? this.childElements.length
        : this.childElements.indexOf(referenceChild)

    if (index < 0) {
      throw new Error('Reference child is not attached to this fake SVG node.')
    }

    child.parent = this
    this.childElements.splice(index, 0, child)
    return child
  }

  cloneNode(deep = false): FakeSvgElement {
    return new FakeSvgElement(
      this.tagName,
      Object.fromEntries(this.attributeMap),
      deep ? this.childElements.map((child) => child.cloneNode(true)) : [],
    )
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

function exportClone(
  svg: FakeSvgElement,
  options: SvgPreviewExportOptions,
): FakeSvgElement {
  const clone = prepareSvgPreviewExportClone(svg, options)

  assert.notEqual(clone, null)
  assert.equal(clone instanceof FakeSvgElement, true)

  return clone as FakeSvgElement
}

function exportCloneText(
  svg: FakeSvgElement,
  options: SvgPreviewExportOptions,
): string {
  return exportClone(svg, options).serialize()
}

function editorBackground(width: number, height: number): FakeSvgElement {
  return new FakeSvgElement('rect', {
    'data-svg-background': 'true',
    'data-svg-export-exclude': 'true',
    fill: 'currentColor',
    height: String(height),
    opacity: '0.04',
    width: String(width),
  })
}

function representativePreviewSvg(transform: string): FakeSvgElement {
  return new FakeSvgElement(
    'svg',
    {
      'aria-label': 'Interactive Preview',
      class: 'svg-diagram',
      role: 'img',
      style: 'background:#ffffff;color:#94a3b8',
      viewBox: '0 0 520 360',
    },
    [
      editorBackground(520, 360),
      new FakeSvgElement('g', { transform }, [
        new FakeSvgElement('polygon', {
          fill: '#4d9de0',
          points: '40,280 260,220 180,40',
        }),
        new FakeSvgElement('path', {
          d: 'M 20,30 L 180,220',
          stroke: '#111111',
        }),
        new FakeSvgElement('text', { x: '96', y: '82' }),
      ]),
    ],
  )
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cssRule(selector: string): string {
  const start = appCss.indexOf(`${selector} {`)

  assert.notEqual(start, -1, `Missing CSS rule for ${selector}.`)

  const end = appCss.indexOf('\n}', start)

  assert.notEqual(end, -1, `Missing CSS rule end for ${selector}.`)

  return appCss.slice(start, end + 2)
}
