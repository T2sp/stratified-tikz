import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { cleanupPointCheck, boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { assertPositionedLiteral } from './fixtures/positionedLiteralAssertions.ts'
export { assertPositionedLiteral }

// Inject the same test-only native SVG observer into live and file:// documents.
// No network/module requests, app stylesheet, or DOM script elements are needed.
let observerCode
async function evaluateOracle(page, { id, source, standalone = false } = {}, mode) {
  observerCode ??= readFile(new URL('./fixtures/labelBrowserOracle.ts', import.meta.url), 'utf8').then((text) =>
    ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
      .outputText.replace(/^export /gm, '') + '\nreturn { inspectPositionedLiteral, inspectOracleDocumentContext };')
  return page.evaluate(({ code, id, source, standalone, mode }) => {
    const oracle = new Function(code)()
    let body
    if (standalone) {
      const titles = [...document.querySelectorAll('g > title')].filter((title) => title.textContent === source.replace(/\r\n?/g, '\n'))
      if (titles.length === 1) body = titles[0].parentElement
      else if (mode !== 'context') throw new Error('Standalone point body is missing or ambiguous')
    } else body = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-label-state]`)
    if (mode === 'context') return { ...oracle.inspectOracleDocumentContext(body ?? document.documentElement), bodyFound: Boolean(body) }
    if (!body) return null
    // Compare in one synchronous evaluation so App updates cannot race the
    // check. Include the whole document, after temporary SVG probes are removed.
    const serialize = () => new XMLSerializer().serializeToString(document)
    const before = serialize()
    let point, collectionError
    try {
      point = oracle.inspectPositionedLiteral(body, source ?? body.getAttribute('data-label-source'), standalone, standalone && !body.hasAttribute('data-label-request'))
    } catch (error) { collectionError = { message: error.message, stack: error.stack, name: error.name } }
    return { point, collectionError, documentUnchanged: before === serialize() }
  }, { code: await observerCode, id, source, standalone, mode })
}

export function capturePointLiteralDocument(page, options, { timeoutMs = 2000 } = {}) {
  return boundedPointDiagnostic(() => evaluateOracle(page, options, 'context'), 'point literal document context', timeoutMs)
}

export function assertOracleCanvasDocument(context, standalone = false) {
  const canvas = context.canvas
  assert.equal(canvas.namespaceURI, 'http://www.w3.org/1999/xhtml', 'Oracle Canvas uses XHTML')
  assert.equal(canvas.localName, 'canvas')
  assert.equal(canvas.htmlCanvasElement, true, 'Native HTMLCanvasElement interface')
  assert.equal(canvas.ownerDocumentMatches, true, 'Canvas uses the observed document')
  assert.equal(canvas.isConnected, false, 'Canvas stays detached')
  assert.equal(canvas.parentNodePresent, false)
  assert.equal(canvas.getContext, 'function')
  assert.equal(canvas.context2dAvailable, true, 'Native 2D context is usable')
  assert.equal(canvas.measureText, 'function')
  assert.equal(context.bodyFound, true)
  if (standalone) {
    assert.ok(context.url.startsWith('file://'), 'Observe the saved file directly')
    assert.equal(context.contentType, 'image/svg+xml')
    assert.equal(context.root.localName, 'svg')
    assert.equal(context.root.namespaceURI, 'http://www.w3.org/2000/svg')
    assert.equal(context.body, null)
  } else {
    assert.equal(context.contentType, 'text/html')
    assert.equal(context.root.localName, 'html')
  }
}

export async function observePointLiteral(page, { diagnose, ...options } = {}) {
  const documentContext = await capturePointLiteralDocument(page, options)
  // Persist native document/Canvas properties before metrics can throw.
  if (diagnose) await boundedPointDiagnostic(() => diagnose({ boundary: 'before-literal-metrics', documentContext }), 'point literal context evidence')
  let result
  try {
    result = await evaluateOracle(page, options, 'metrics')
    if (!result) return null
    if (result.collectionError) {
      const error = new Error(result.collectionError.message)
      error.name = result.collectionError.name
      error.stack = result.collectionError.stack
      throw error
    }
    assertOracleCanvasDocument(documentContext, options.standalone)
    assert.equal(result.documentUnchanged, true, 'Literal observation leaves the document unchanged')
  } catch (error) {
    if (diagnose) {
      try {
        await boundedPointDiagnostic(() => diagnose({ boundary: 'literal-collection-failure', documentContext,
          documentUnchanged: result?.documentUnchanged, captureError: { message: error.message, stack: error.stack } }), 'point literal failure evidence')
      } catch (diagnosticError) { console.error('Point literal failure diagnostics:', diagnosticError) }
    }
    throw error
  }
  return { ...result.point, documentContext, documentUnchanged: result.documentUnchanged }
}

/** Save the actual file-page context before cleanup even if geometry, evidence
 * writing, or image capture fails. Never replace the original exception. */
export async function diagnoseStandalonePointFailure({ page, source, svgPath, primary, diagnose, timeoutMs = 2000 }) {
  const details = { boundary: 'standalone-failure', source, svgPath,
    error: { message: primary.message, stack: primary.stack } }
  try { details.documentContext = await capturePointLiteralDocument(page, { source, standalone: true }, { timeoutMs }) }
  catch (error) { details.contextError = { message: error.message, stack: error.stack } }
  try { await boundedPointDiagnostic(() => diagnose(details), 'standalone point failure evidence', timeoutMs) }
  catch (error) { console.error('Standalone point failure diagnostics:', error) }
}

export async function inspectStandalonePoint(page, source) {
  return page.evaluate((source) => {
    const titles = [...document.querySelectorAll('g > title')].filter((e) => e.textContent === source.replace(/\r\n?/g, '\n'))
    if (titles.length !== 1) throw new Error('Missing/ambiguous standalone point source')
    const body = titles[0].parentElement, point = body.parentElement
    const contour = [...point.children].find((e) => ['circle', 'polygon'].includes(e.localName))
    if (!contour) throw new Error('Standalone contour missing')
    const paint = [...body.children].find((e) => e.localName === 'g'), content = [...paint.children].at(-1)
    const b = body.getBBox(), c = contour.getBBox()
    return { source: titles[0].textContent, transform: point.getAttribute('transform'), contourKind: contour.localName,
      contour: contour.outerHTML, radius: Number(contour.getAttribute('r')),
      body: { x: b.x, y: b.y, width: b.width, height: b.height },
      shape: { x: c.x, y: c.y, width: c.width, height: c.height },
      math: [...content.children].filter((e) => e.localName === 'svg').length,
      paths: content.querySelectorAll('svg path').length,
      texts: [...content.children].filter((e) => e.localName === 'text').map((e) => e.textContent),
      opacity: contour.getAttribute('opacity'), parentOpacity: point.parentElement.getAttribute('opacity'),
      paints: { fill: contour.getAttribute('fill'), stroke: contour.getAttribute('stroke'), text: paint.getAttribute('fill') },
      // Sanitization removes all runtime markers, including the background marker.
      backgrounds: [...document.documentElement.children].filter((e) => e.localName === 'rect' && e.getAttribute('fill') === '#ffffff').length,
      forbidden: document.querySelectorAll('parsererror, script, style, image, foreignObject, [data-svg-export-exclude]').length,
      unresolvedPaint: [...document.querySelectorAll('*')].some((e) => [...e.attributes].some((a) => /currentColor/i.test(a.value))),
      externalReferences: [...document.querySelectorAll('[href]')].map((e) => e.getAttribute('href')).filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1))),
    }
  }, source)
}

/** Deliberately corrupt only foreground DOM while leaving source/request intact. */
export async function pointLiteralNegativeControls(page, id, source, diagnose) {
  const controls = []
  for (const kind of ['missing-fragment', 'edge-spaces', 'tab-collapse', 'line-collapse', 'line-displaced-inside-bounds', 'stale-content']) {
    const original = await page.evaluate(({ id, kind }) => {
      const body = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-label-state]`)
      const content = body.querySelector('[data-label-content]'), saved = content.innerHTML
      const texts = content.querySelectorAll('text')
      if (kind === 'missing-fragment') texts[1].remove()
      if (kind === 'edge-spaces') texts[0].textContent = texts[0].textContent.trimStart()
      if (kind === 'tab-collapse') texts[1].setAttribute('x', texts[0].getAttribute('x'))
      if (kind === 'line-collapse') texts[2].setAttribute('y', texts[0].getAttribute('y'))
      // Move the final line upward by one local unit. The unchanged enclosing
      // box still contains it; only the declared baseline contract rejects it.
      if (kind === 'line-displaced-inside-bounds') texts[2].setAttribute('y', String(Number(texts[2].getAttribute('y')) - 1))
      if (kind === 'stale-content') texts[0].textContent = '$obsoletePoint$'
      return saved
    }, { id, kind })
    let primary
    try {
      const observation = await observePointLiteral(page, { id, source })
      await diagnose(kind, observation)
      let rejected = false, reason
      try { assertPositionedLiteral(observation, source) } catch (error) { rejected = true; reason = error.message }
      if (!rejected) throw new Error(`Point whitespace control was accepted: ${kind}`)
      if (kind === 'line-displaced-inside-bounds' && !reason.includes('y (line baseline)')) throw new Error(`Displaced line rejected for wrong reason: ${reason}`)
      controls.push({ kind, rejected, reason, observation })
    } catch (error) { primary = error; throw error }
    finally {
      await cleanupPointCheck(primary, () => page.evaluate(({ id, original }) => {
        document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-label-content]`).innerHTML = original
      }, { id, original }))
    }
  }
  return controls
}
