import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { cleanupPointCheck } from './pointCheckDiagnostics.mjs'
import { assertPositionedLiteral } from './fixtures/positionedLiteralAssertions.ts'
export { assertPositionedLiteral }

// Inject the same test-only native SVG observer into live and file:// documents.
// No network/module requests, app stylesheet, or DOM script elements are needed.
let observerCode
export async function observePointLiteral(page, { id, source, standalone = false } = {}) {
  observerCode ??= readFile(new URL('./fixtures/labelBrowserOracle.ts', import.meta.url), 'utf8').then((text) =>
    ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
      .outputText.replace(/^export /gm, '') + '\nreturn inspectPositionedLiteral;')
  return page.evaluate(({ code, id, source, standalone }) => {
    let body
    if (standalone) {
      const titles = [...document.querySelectorAll('g > title')].filter((title) => title.textContent === source.replace(/\r\n?/g, '\n'))
      if (titles.length !== 1) throw new Error('Standalone point body is missing or ambiguous')
      body = titles[0].parentElement
    } else body = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-label-state]`)
    if (!body) return null
    const inspect = new Function(code)()
    return inspect(body, source ?? body.getAttribute('data-label-source'), standalone, standalone && !body.hasAttribute('data-label-request'))
  }, { code: await observerCode, id, source, standalone })
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
    return { source: titles[0].textContent, transform: point.getAttribute('transform'),
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
  for (const kind of ['missing-fragment', 'edge-spaces', 'tab-collapse', 'line-collapse', 'stale-content']) {
    const original = await page.evaluate(({ id, kind }) => {
      const body = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-label-state]`)
      const content = body.querySelector('[data-label-content]'), saved = content.innerHTML
      const texts = content.querySelectorAll('text')
      if (kind === 'missing-fragment') texts[1].remove()
      if (kind === 'edge-spaces') texts[0].textContent = texts[0].textContent.trimStart()
      if (kind === 'tab-collapse') texts[1].setAttribute('x', texts[0].getAttribute('x'))
      if (kind === 'line-collapse') texts[2].setAttribute('y', texts[0].getAttribute('y'))
      if (kind === 'stale-content') texts[0].textContent = '$obsoletePoint$'
      return saved
    }, { id, kind })
    let primary
    try {
      const observation = await observePointLiteral(page, { id, source })
      await diagnose(kind, observation)
      let rejected = false
      try { assertPositionedLiteral(observation, source) } catch { rejected = true }
      if (!rejected) throw new Error(`Point whitespace control was accepted: ${kind}`)
      controls.push({ kind, rejected, observation })
    } catch (error) { primary = error; throw error }
    finally {
      await cleanupPointCheck(primary, () => page.evaluate(({ id, original }) => {
        document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-label-content]`).innerHTML = original
      }, { id, original }))
    }
  }
  return controls
}
