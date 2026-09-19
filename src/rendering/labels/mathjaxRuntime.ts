import { mathjax } from '@mathjax/src/js/mathjax.js'
import { TeX } from '@mathjax/src/js/input/tex.js'
import { SVG } from '@mathjax/src/js/output/svg.js'
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js'
import { STATE } from '@mathjax/src/js/core/MathItem.js'
import { ColumnParser, type ColumnState } from '@mathjax/src/js/input/tex/ColumnParser.js'
import { EnvironmentMap } from '@mathjax/src/js/input/tex/TokenMap.js'
import ParseMethods from '@mathjax/src/js/input/tex/ParseMethods.js'
import { AmsMethods } from '@mathjax/src/js/input/tex/ams/AmsMethods.js'
import type TexParser from '@mathjax/src/js/input/tex/TexParser.js'
import type { StackItem } from '@mathjax/src/js/input/tex/StackItem.js'
import type { ParseMethod } from '@mathjax/src/js/input/tex/Types.js'
import type { MathItem } from '@mathjax/src/js/core/MathItem.js'
import type { MathDocument } from '@mathjax/src/js/core/MathDocument.js'
import type { MmlNode } from '@mathjax/src/js/core/MmlTree/MmlNode.js'
import type { DynamicFile } from '@mathjax/src/js/output/common/FontData.js'
import type { LiteElement } from '@mathjax/src/js/adaptors/lite/Element.js'
import type { LiteText } from '@mathjax/src/js/adaptors/lite/Text.js'
import type { LiteDocument } from '@mathjax/src/js/adaptors/lite/Document.js'
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js'
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js'
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js'
import type { RawSvgElement } from './labelSvg.ts'
import {
  assertSupportedMathRuns, createMathJaxErrorCapture, MathJaxFailure,
  type EngineMathRun, type EngineMathSvg, type MathLabelEngine,
} from './mathjaxEngine.ts'
import { MATHJAX_EXTENSIONS, MATHJAX_IDENTITY, MATHJAX_LIMITS } from './mathjaxConfig.ts'
import { mathjaxFontImports } from './mathjaxFontImports.generated.ts'

const adaptor = liteAdaptor({ fontSize: 16 })
RegisterHTMLHandler(adaptor)

const fontPrefix = 'stz-mathjax-newcm'
const fontLoads = new Map<string, Promise<unknown>>()
// Never install MathJax's CDN/component loader. The sole asynchronous resource
// boundary accepts the finite package-owned font import map; Vite owns its URLs.
async function loadLocalFontData(name: string): Promise<unknown> {
  const key = name.startsWith(`${fontPrefix}/`) ? name.slice(fontPrefix.length + 1) : ''
  const load = Object.hasOwn(mathjaxFontImports, key) ? mathjaxFontImports[key] : undefined
  if (!load) throw new MathJaxFailure('resource-error', `Unapproved MathJax resource: ${name}`)
  let pending = fontLoads.get(key)
  if (!pending) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new MathJaxFailure('resource-error', 'MathJax font-data timeout')),
        MATHJAX_LIMITS.fontSettlementMs)
    })
    pending = Promise.race([Promise.resolve().then(load), timeout])
      .catch((error: unknown) => {
        if (fontLoads.get(key) === pending) fontLoads.delete(key)
        throw new MathJaxFailure('resource-error', 'MathJax font-data load failed', { cause: error })
      })
      .finally(() => { clearTimeout(timer) })
    fontLoads.set(key, pending)
  }
  return pending
}
mathjax.asyncLoad = loadLocalFontData
mathjax.asyncIsSynchronous = false

type LiteMathItem = MathItem<LiteElement, LiteText, LiteDocument>
type LiteMathDocument = MathDocument<LiteElement, LiteText, LiteDocument>

/** Bound array repetition before MathJax allocates its expanded template. */
class BoundedColumnParser extends ColumnParser {
  constructor() {
    super()
    // The pinned implementation checks n++ > MAXCOLUMNS before processing.
    this.MAXCOLUMNS = MATHJAX_LIMITS.maxArrayColumns - 1
  }

  override repeat(state: ColumnState): void {
    const start = state.i
    const countSource = this.getBraces(state)
    const columns = this.getBraces(state)
    const count = parseInt(countSource)
    if (String(count) === countSource && count >= 0 && (
      count > MATHJAX_LIMITS.maxArrayColumns ||
      count * columns.length + state.template.length - state.i > MATHJAX_LIMITS.maxArrayTemplateLength
    )) {
      throw new MathJaxFailure('limit', 'Array template expansion limit exceeded')
    }
    // Preserve the pinned engine's exact syntax/error behavior for valid-sized
    // and malformed counts; only its unbounded allocation needs interception.
    state.i = start
    super.repeat(state)
  }
}

// The AMS alignat methods expand their numeric count with an unbounded loop,
// independent of maxMacros/maxBuffer. Intercept the same raw argument before
// invoking the stock method, without changing any shared MathJax method/map.
function checkAlignmentCount(parser: TexParser, begin: StackItem, optionalAlignment: boolean): void {
  const start = parser.i
  const name = `\\begin{${begin.getName()}}`
  try {
    if (optionalAlignment) parser.GetBrackets(name)
    const source = parser.GetArgument(name)
    if (/^\d+$/u.test(source) && Number(source) > MATHJAX_LIMITS.maxArrayColumns / 2) {
      throw new MathJaxFailure('limit', 'AMS alignment column limit exceeded')
    }
  } finally {
    parser.i = start
  }
}

function boundedAlignAt(parser: TexParser, begin: StackItem, numbered: boolean, taggable: boolean) {
  checkAlignmentCount(parser, begin, !taggable)
  return AmsMethods.AlignAt(parser, begin, numbered, taggable)
}

function boundedXalignAt(parser: TexParser, begin: StackItem, numbered: boolean, padded: boolean) {
  checkAlignmentCount(parser, begin, false)
  return AmsMethods.XalignAt(parser, begin, numbered, padded)
}

// EnvironmentMap invokes these with a string environment name / begin StackItem;
// the upstream generic ParseMethod signature also covers unrelated token maps.
new EnvironmentMap('stz-bounded-ams', ParseMethods.environment as ParseMethod, {
  alignat: [boundedAlignAt as ParseMethod, null, true, true],
  'alignat*': [boundedAlignAt as ParseMethod, null, false, true],
  alignedat: [boundedAlignAt as ParseMethod, null, false, false],
  xalignat: [boundedXalignAt as ParseMethod, null, true, true],
  'xalignat*': [boundedXalignAt as ParseMethod, null, false, true],
  xxalignat: [boundedXalignAt as ParseMethod, null, false, false],
})

/** A fresh whole-label input/document/output state; only code and fonts are reused. */
export function createMathJaxEngine(options: Readonly<{
  /** Deterministic resource-failure fixtures; production uses only local imports. */
  loadFontData?: (name: string, load: () => Promise<unknown>) => Promise<unknown>
}> = {}): MathLabelEngine {
  class LocalFont extends MathJaxNewcmFont {
    override async loadDynamicFile(dynamic: DynamicFile): Promise<void> {
      const name = this.dynamicFileName(dynamic)
      try {
        const load = () => loadLocalFontData(name)
        await (options.loadFontData ? options.loadFontData(name, load) : load())
        // MathJax's stock method permanently records shared `failed` state on
        // resource rejection. Bypass that state; setup data/module code alone is
        // shared, and each isolated font instance receives its own glyph maps.
        dynamic.setup(this)
      } catch (error) {
        throw new MathJaxFailure('resource-error', 'MathJax font-data load failed', { cause: error })
      }
    }
  }
  return Object.freeze({
    identity: MATHJAX_IDENTITY,
    convert: (runs: readonly EngineMathRun[]) => convert(runs, LocalFont),
  })
}

async function convert(
  runs: readonly EngineMathRun[], fontData: typeof MathJaxNewcmFont,
): Promise<readonly EngineMathSvg[]> {
  assertSupportedMathRuns(runs)
  const errors = createMathJaxErrorCapture()
  let completedMmlNodes = 0
  let currentMmlNodes = 0
  const svgBudget = { nodes: 0, paths: 0, bytes: 0 }
  const tex = new TeX<LiteElement, LiteText, LiteDocument>({
    packages: [...MATHJAX_EXTENSIONS],
    tags: 'none',
    maxMacros: MATHJAX_LIMITS.maxMacros,
    maxBuffer: MATHJAX_LIMITS.maxBuffer,
    // The misspelling is the public MathJax 4.1.3 option name.
    maxTemplateSubtitutions: MATHJAX_LIMITS.maxTemplateSubstitutions,
    formatError: errors.formatError,
  })
  tex.parseOptions.columnParser = new BoundedColumnParser()
  tex.parseOptions.handlers.add({ environment: ['stz-bounded-ams'] }, {}, 0)
  const output = new SVG<LiteElement, LiteText, LiteDocument>({
    fontCache: 'none',
    fontData,
    dynamicPrefix: fontPrefix,
    mtextInheritFont: false,
    merrorInheritFont: false,
    displayOverflow: 'overflow',
    // MathJax 4 otherwise emits separate SVG siblings at inline break points.
    // A label math run is one reusable image and must retain the whole formula.
    linebreaks: { inline: false },
  })
  const document = mathjax.document('', {
    InputJax: tex,
    OutputJax: output,
    compileError: errors.compileError,
    typesetError: errors.typesetError,
    renderActions: {
      // convertPromise operates on MathItems directly, unlike document.render;
      // route non-retry stage errors through the same document error hooks.
      compile: [STATE.COMPILED, (doc: LiteMathDocument) => { doc.compile(); return false },
        (math: LiteMathItem, doc: LiteMathDocument) => {
          try { math.compile(doc) } catch (error) {
            if (isMathJaxRetry(error)) throw error
            errors.compileError(doc, math, error)
          }
          return false
        }],
      typeset: [STATE.TYPESET, (doc: LiteMathDocument) => { doc.typeset(); return false },
        (math: LiteMathItem, doc: LiteMathDocument) => {
          try { math.typeset(doc) } catch (error) {
            if (isMathJaxRetry(error)) throw error
            errors.typesetError(doc, math, error)
          }
          return false
        }],
      inspectLabelTree: [STATE.CONVERT + 1, () => false,
        (math: LiteMathItem) => {
          currentMmlNodes = inspectMml(math.root, completedMmlNodes)
          return false
        }],
    },
  })
  const result: EngineMathSvg[] = []
  try {
    for (const run of runs) {
      // The async document API retries only for actual local font-data loading.
      const node = await document.convertPromise(run.tex, {
        display: run.display,
        em: 16,
        ex: 8,
        scale: 1,
        containerWidth: 1_000_000,
      }) as LiteElement
      errors.check()
      const roots = adaptor.childNodes(node).filter((child): child is LiteElement =>
        adaptor.kind(child) === 'svg')
      if (roots.length !== 1 || adaptor.getAttribute(node, 'data-mjx-error')) {
        throw new MathJaxFailure('output-error', 'MathJax did not return exactly one SVG formula')
      }
      const root = roots[0]
      completedMmlNodes += currentMmlNodes
      result.push(Object.freeze({ svg: snapshotSvg(root, svgBudget) }))
    }
    return Object.freeze(result)
  } catch (error) {
    errors.check()
    if (error instanceof MathJaxFailure) throw error
    throw new MathJaxFailure('output-error', 'MathJax conversion rejected', { cause: error })
  } finally {
    document.clear()
  }
}

function isMathJaxRetry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && ('retry' in error || 'restart' in error)
}

function inspectMml(root: MmlNode, completedNodes: number): number {
  let count = 0
  // Inspect before SVG rendering, while error markers and intermediate nodes
  // still exist. No successful Promise or stripped metadata can conceal merror.
  root.walkTree((node: MmlNode) => {
    if (++count + completedNodes > MATHJAX_LIMITS.maxMmlNodes) {
      throw new MathJaxFailure('limit', 'MathML node limit exceeded')
    }
    if (node.kind === 'merror') throw new MathJaxFailure('tex-error', 'MathJax returned merror')
  })
  return count
}

function snapshotSvg(root: LiteElement, budget: { nodes: number; paths: number; bytes: number }): RawSvgElement {
  const visit = (node: LiteElement, depth: number): RawSvgElement => {
    if (++budget.nodes > MATHJAX_LIMITS.maxSvgNodes || depth > MATHJAX_LIMITS.maxNesting) {
      throw new MathJaxFailure('limit', 'SVG node/nesting limit exceeded')
    }
    const tag = adaptor.kind(node)
    budget.bytes += 2 * tag.length
    if (tag === 'path' && ++budget.paths > MATHJAX_LIMITS.maxSvgPaths) {
      throw new MathJaxFailure('limit', 'SVG path limit exceeded')
    }
    const attributes: Record<string, string> = {}
    for (const { name, value } of adaptor.allAttributes(node)) {
      budget.bytes += 2 * (name.length + value.length)
      if (budget.bytes > MATHJAX_LIMITS.maxSvgBytes) throw new MathJaxFailure('limit', 'SVG byte limit exceeded')
      attributes[name] = value
    }
    const children = adaptor.childNodes(node).map((child) => {
      if (adaptor.kind(child) !== '#text') return visit(child as LiteElement, depth + 1)
      const text = adaptor.value(child as LiteText)
      budget.bytes += 2 * text.length
      if (budget.bytes > MATHJAX_LIMITS.maxSvgBytes) throw new MathJaxFailure('limit', 'SVG byte limit exceeded')
      return text
    })
    return Object.freeze({ tag, attributes: Object.freeze(attributes), children: Object.freeze(children) })
  }
  return visit(root, 0)
}
