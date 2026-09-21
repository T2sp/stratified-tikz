/** Native-DOM regression for the production settled render/parse/replace path.
 * These assertions intentionally inspect the chosen label and final document,
 * never the presence of paths somewhere in a server-rendered string. */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SvgTexLabelView } from '../../src/rendering/svgLabelView.ts'
import type { ValidatedSvgElement } from '../../src/rendering/labels/labelSvg.ts'
import type { SvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { placeSvgLabel } from '../../src/rendering/labels/svgLabelLayout.ts'
import { captureSvgExportSnapshot, prepareSettledSvgExport, releaseSvgExportSnapshot,
  renderSettledSvgLabelDocument, extractSettledSvgLabel } from '../../src/ui/svgSettledExport.ts'
import { createSvgPreviewExportText } from '../../src/ui/svgPreviewExport.ts'
import { checkSettledSvgLabelControls, hasExpectedSettledMath, inspectSettledSvgLabel,
  exportOracleSvgNamespace as svgNamespace } from './settledSvgExportOracle.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Settled render boundary: ${message}`)
}
const serialize = (node: Node) => new XMLSerializer().serializeToString(node)
const parse = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml')
const pathData = (root: Element) => Array.from(root.querySelectorAll('path'), (path) => path.getAttribute('d'))
function effectiveOpacity(node: Element, ownOpacity = 1): number {
  let opacity = ownOpacity
  for (let current: Element | null = node; current; current = current.parentElement) {
    if (current.hasAttribute('opacity')) opacity *= Number(current.getAttribute('opacity'))
  }
  return opacity
}
function geometryPaths(node: ValidatedSvgElement): string[] {
  return [...(node.tag === 'path' ? [String(node.attributes.d)] : []),
    ...node.children.flatMap((child) => typeof child === 'string' ? [] : geometryPaths(child))]
}

export async function runSettledSvgBoundaryRegression(svg: SVGSVGElement) {
  const snapshot = captureSvgExportSnapshot(svg, { backgroundMode: 'transparent' })
  const captured = snapshot.labels.map(({ capture, target }) => ({
    source: capture.source, ownerIdentity: capture.ownerIdentity, position: capture.position,
    color: capture.color, opacity: capture.opacity, outline: capture.outline,
    effectiveOpacity: effectiveOpacity(target, capture.opacity),
    requestIdentity: target.getAttribute('data-label-request'), status: target.getAttribute('data-label-state'),
  }))
  const states = new Map<string, SvgLabelState>()
  const selected: { requestIdentity: string; markup: string }[] = []
  let detached = '', serialized: string | null = null, liveBeforeRendering: string | undefined, liveAfterRendering: string | undefined
  try {
    serialized = await prepareSettledSvgExport(snapshot, undefined, { observe(event) {
      if (event.kind === 'label-settled') states.set(event.requestIdentity, event.state)
      if (event.kind === 'label-rendered') {
        liveBeforeRendering ??= svg.outerHTML
        selected.push({ requestIdentity: event.requestIdentity, markup: event.markup })
      }
      if (event.kind === 'preparation-completed') {
        detached = serialize(snapshot.root)
        liveAfterRendering = svg.outerHTML
      }
    } })
    assert(serialized !== null, 'actual preparation succeeded')
    assert(liveBeforeRendering === undefined || liveBeforeRendering === liveAfterRendering, 'detached rendering preserves live SVG')
    assert(selected.length === snapshot.labels.length, 'every captured replacement was observed')
    const final = parse(serialized)
    assert(final.documentElement.namespaceURI === svgNamespace && !final.querySelector('parsererror'), 'final native XML document')
    const finalLabels = Array.from(final.querySelectorAll('g > title'), (title) => title.parentElement!)
    const replaced = Array.from(snapshot.root.querySelectorAll('[data-label-state]'))
    assert(finalLabels.length === snapshot.labels.length && replaced.length === snapshot.labels.length, 'captured owners survive replacement and sanitization')
    const labels = snapshot.labels.map(({ capture, target }, index) => {
      const state = states.get(target.getAttribute('data-label-request')!)
      assert(state, `captured settlement ${index}`)
      const chosen = parse(`<svg xmlns="${svgNamespace}">${selected[index].markup}</svg>`).documentElement.firstElementChild!
      assert(chosen.localName === 'g' && chosen.namespaceURI === svgNamespace, `selected element ${index} is the owning SVG group`)
      assert(chosen.getAttribute('data-label-request') === state.requestIdentity, `selected captured identity ${index}`)
      assert(chosen.getAttribute('data-label-owner') === (capture.ownerIdentity ?? null), `selected owner ${index}`)
      assert(serialize(chosen) === serialize(replaced[index]), `selected subtree ${index} is the replacement`)
      const label = finalLabels[index]
      assert(label.querySelector(':scope > title')?.textContent === capture.source, `exact final source ${index}`)
      assert(label.getAttribute('transform') === `translate(${capture.position.x} ${capture.position.y})`, `captured position ${index}`)
      const paint = Array.from(label.children).find((child) => child.localName === 'g')!
      assert(paint, `paint group ${index}`)
      assert(paint.getAttribute('color') === capture.color && paint.getAttribute('fill') === capture.color, `explicit captured color ${index}`)
      assert(Number(paint.getAttribute('opacity')) === capture.opacity, `captured opacity ${index}`)
      const placement = placeSvgLabel(state.layout, capture.fontSize, capture.anchor)
      assert(paint.getAttribute('transform') === `translate(${placement.offsetX} ${placement.offsetY})`, `layout transform ${index}`)
      const foreground = paint.lastElementChild!
      assert(foreground?.localName === 'g' && foreground.namespaceURI === svgNamespace, `foreground group ${index}`)
      assert(effectiveOpacity(foreground) === captured[index].effectiveOpacity, `captured ancestor dimming ${index}`)
      assert(!foreground.hasAttribute('aria-hidden'), `foreground is separate from halo ${index}`)
      const texts = Array.from(foreground.querySelectorAll('text'))
      const textPlacements = state.layout.placements.filter((item) => item.kind === 'text')
      assert(JSON.stringify(texts.map((text) => text.textContent)) === JSON.stringify(textPlacements.map((item) => item.text)), `complete visible text fragments ${index}`)
      texts.forEach((text, textIndex) => {
        const item = textPlacements[textIndex]
        assert(Number(text.getAttribute('x')) === item.x * capture.fontSize && Number(text.getAttribute('y')) === item.baseline * capture.fontSize,
          `tabs and physical newlines retain placement ${index}/${textIndex}`)
        assert(text.getAttribute('xml:space') === 'preserve' && text.getAttribute('style')?.includes('white-space:pre'), `literal whitespace style ${index}`)
      })
      const expectedPaths = state.status === 'ready' && state.result?.kind === 'success'
        ? state.result.runs.flatMap((run) => run.geometry ? geometryPaths(run.geometry.svg) : []) : []
      assert(JSON.stringify(pathData(foreground)) === JSON.stringify(expectedPaths), `own source-specific foreground paths ${index}`)
      if (expectedPaths.length > 0) {
        assert(hasExpectedSettledMath(inspectSettledSvgLabel(label, capture.source)), `successful math is not halo or fallback ${index}`)
      } else assert(foreground.querySelectorAll('svg').length === 0, `literal/empty source has no formula substitute ${index}`)
      if (state.status === 'fallback') {
        assert(JSON.stringify(texts.map((text) => text.textContent)) === JSON.stringify(capture.source.split(/\t|\r\n?|\n/u).filter(Boolean)), `full-source fallback ${index}`)
      }
      if (capture.outline) {
        const halo = paint.firstElementChild!
        assert(paint.children.length === 2 && halo !== foreground && halo.getAttribute('aria-hidden') === 'true', `separate inline halo ${index}`)
        assert(JSON.stringify(pathData(halo)) === JSON.stringify(pathData(foreground)), `glyph-local halo geometry ${index}`)
        for (const leaf of halo.querySelectorAll('path,text')) {
          assert(leaf.getAttribute('stroke') === capture.outline.color && Number(leaf.getAttribute('stroke-width')) === capture.outline.width
            && leaf.getAttribute('vector-effect') === 'non-scaling-stroke', `explicit glyph-local outline ${index}`)
        }
      }
      assert(!label.querySelector('script,foreignObject,image,[onload]'), `raw source remains text ${index}`)
      return { ...captured[index], settled: state.status, reason: state.reason, foregroundPaths: expectedPaths.length,
        textFragments: texts.map((text) => text.textContent), finalMarkup: serialize(label) }
    })
    const ids = Array.from(final.querySelectorAll('[id]'), (node) => node.id)
    assert(new Set(ids).size === ids.length, 'collision-free local IDs')
    const references = Array.from(final.querySelectorAll('*')).flatMap((node) => Array.from(node.attributes).flatMap(({ name, value }) =>
      name === 'href' || name === 'xlink:href' ? [value] : Array.from(value.matchAll(/url\(['"]?([^)'"\s]+)/g), (match) => match[1])))
    assert(references.every((reference) => reference.startsWith('#') && ids.includes(reference.slice(1))), 'every reference has a self-contained target')

    const successfulIndex = labels.findIndex((label) => label.foregroundPaths > 0 && labels.filter((other) => other.source === label.source).length === 1)
    let oldBoundary: { selectedName: string; wholeStringHasPaths: boolean; selectedHasMath: boolean; serializedHasMath: boolean; validatorRejected: boolean } | null = null
    const invalidStructures: Record<string, boolean> = {}
    let negativeControls: ReturnType<typeof checkSettledSvgLabelControls> | null = null
    if (successfulIndex >= 0) {
      const { capture } = snapshot.labels[successfulIndex]
      const state = states.get(captured[successfulIndex].requestIdentity!)!
      // Reproduce the old production boundary with the installed renderer and
      // native XML parser. Paths in the whole string did not save the chosen title.
      const bare = renderToStaticMarkup(createElement(SvgTexLabelView, { capture, state }))
      const oldDocument = parse(`<svg xmlns="${svgNamespace}">${bare}</svg>`)
      const oldSelected = oldDocument.documentElement.firstElementChild!
      let validatorRejected = false
      try { extractSettledSvgLabel(oldDocument, capture, state) } catch { validatorRejected = true }
      const oldRoot = snapshot.root.cloneNode(true) as SVGSVGElement
      const oldTarget = Array.from(oldRoot.querySelectorAll('[data-label-request]')).find((node) => node.getAttribute('data-label-request') === state.requestIdentity)
      assert(oldTarget, 'old-boundary control starts with the actual valid captured foreground')
      oldTarget.replaceWith(oldRoot.ownerDocument.importNode(oldSelected, true))
      const oldSerialized = createSvgPreviewExportText(oldRoot, snapshot)
      assert(oldSerialized !== null, 'old title-only control remains syntactically serializable')
      oldBoundary = { selectedName: oldSelected.localName, wholeStringHasPaths: oldDocument.querySelector('path') !== null,
        selectedHasMath: hasExpectedSettledMath(inspectSettledSvgLabel(oldSelected, capture.source)),
        serializedHasMath: hasExpectedSettledMath(inspectSettledSvgLabel(parse(oldSerialized), capture.source)), validatorRejected }
      assert(oldBoundary.selectedName === 'title' && oldBoundary.wholeStringHasPaths && !oldBoundary.selectedHasMath && !oldBoundary.serializedHasMath && validatorRejected,
        'native control detects React HTML-context title hoisting and the former title-only extraction')
      const validMarkup = renderSettledSvgLabelDocument(capture, state)
      const alterations: Record<string, (document: Document) => void> = {
        titleOnly(document) { document.documentElement.replaceChildren(document.querySelector('title')!) },
        multipleLabels(document) { document.documentElement.append(document.documentElement.firstElementChild!.cloneNode(true)) },
        missingTitle(document) { document.querySelector('title')!.remove() },
        missingPaint(document) { document.querySelector('[data-label-content]')!.parentElement!.remove() },
        missingForeground(document) { document.querySelector('[data-label-content]')!.remove() },
        missingMath(document) { document.querySelector('[data-label-content]')!.replaceChildren() },
        emptyMathViewport(document) { document.querySelector('[data-label-content] > svg')!.replaceChildren() },
        wrongSource(document) { document.querySelector('title')!.textContent = '$other$' },
        wrongOwner(document) { document.documentElement.firstElementChild!.setAttribute('data-label-owner', 'different-owner') },
        wrongRequest(document) { document.documentElement.firstElementChild!.setAttribute('data-label-request', 'different-request') },
        wrongLabelNamespace(document) {
          const foreign = document.createElementNS('http://www.w3.org/1999/xhtml', 'g')
          const label = document.documentElement.firstElementChild!
          Array.from(label.attributes).forEach(({ name, value }) => foreign.setAttribute(name, value))
          foreign.append(...Array.from(label.childNodes))
          label.replaceWith(foreign)
        },
        wrongForegroundNamespace(document) { document.querySelector('[data-label-content]')!.replaceWith(document.createElementNS('http://www.w3.org/1999/xhtml', 'g')) },
      }
      const documents = { malformed: parse('<svg>'), wrongRootNamespace: parse(validMarkup.replace(svgNamespace, 'http://www.w3.org/1999/xhtml')),
        ...Object.fromEntries(Object.entries(alterations).map(([name, alter]) => { const document = parse(validMarkup); alter(document); return [name, document] })) }
      extractSettledSvgLabel(parse(validMarkup), capture, state)
      for (const [name, document] of Object.entries(documents)) {
        try { extractSettledSvgLabel(document, capture, state); invalidStructures[name] = false } catch { invalidStructures[name] = true }
        assert(invalidStructures[name], `invalid ${name} output cannot become successful preparation`)
      }
      negativeControls = checkSettledSvgLabelControls(serialize(finalLabels[successfulIndex]), capture.source)
      assert(Object.values(negativeControls).every((control) => !control.missingControlTarget && control.rejected), 'negative controls corrupt an actual valid foreground')
    }
    return { captured, labels, oldBoundary, invalidStructures, negativeControls, ids, references,
      selected: selected.map((entry) => entry.markup), detached, serialized, livePreservedDuringRendering: liveBeforeRendering === undefined || liveBeforeRendering === liveAfterRendering }
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      boundaryDiagnostic: { captured, selected, detached, serialized },
    })
  } finally { releaseSvgExportSnapshot(snapshot) }
}
