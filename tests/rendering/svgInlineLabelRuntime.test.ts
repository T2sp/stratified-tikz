import assert from 'node:assert/strict'
import test from 'node:test'
import { pathInlineNodePlacements } from '../../src/model/types.ts'
import {
  placementOffset, svgPathInlineNodeLabelAnchor, svgPathInlineNodeLabelIdentity,
} from '../../src/rendering/svgPathInlineNodes.ts'
import { createLabelService, type LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { loadMathJaxEngine } from '../../src/rendering/labels/mathjaxEngine.ts'
import { placeSvgLabel, svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import {
  createSvgLabelController, createSvgLabelRuntime, initialSvgLabelState,
  svgLabelRequestIdentity, type SvgLabelRequest,
} from '../../src/rendering/labels/svgLabelRuntime.ts'

const measurement: TextMeasurementProvider = {
  identity: 'inline-label-runtime-test',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2,
    ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}
const settings = svgLabelLayoutSettings(12)
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
const owner = (document: number | string, path: string, node = 'shared') =>
  svgPathInlineNodeLabelIdentity(document, path, node)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

test('inline placements use complete real tall-fraction/multi-run bounds at the marker offset', async () => {
  const service = createLabelService({ measurement })
  for (const source of ['$$\\frac{1}{\\frac{x_i}{y^2}}$$', '射 $\\frac{a}{b}$ and $g_i$\n next']) {
    const result = await service.convert(source, settings)
    assert.equal(result.kind, 'success')
    if (result.kind !== 'success') assert.fail('Expected real typesetting')
    for (const placement of pathInlineNodePlacements) {
      const { bounds } = placeSvgLabel(result.layout, 12, svgPathInlineNodeLabelAnchor(placement))
      const offset = placementOffset(placement)
      const width = (result.layout.bounds.maxX - result.layout.bounds.minX) * 12
      const height = (result.layout.bounds.maxY - result.layout.bounds.minY) * 12
      assert.ok(Math.abs(bounds.maxX - bounds.minX - width) < 1e-9)
      assert.ok(Math.abs(bounds.maxY - bounds.minY - height) < 1e-9)
      if (placement === 'above') assert.equal(bounds.maxY + offset.y, -14)
      if (placement === 'below') assert.equal(bounds.minY + offset.y, 14)
      if (placement === 'left') assert.equal(bounds.maxX + offset.x, -14)
      if (placement === 'right') assert.equal(bounds.minX + offset.x, 14)
      if (placement === 'above' || placement === 'below' || placement === 'center') {
        assert.equal(bounds.minX + bounds.maxX, 0)
      }
      if (placement === 'left' || placement === 'right' || placement === 'center') {
        assert.equal(bounds.minY + bounds.maxY, 0)
      }
    }
  }
  service.invalidate()
})

test('free and inline owners share immutable conversion geometry while retaining unique requests', async () => {
  let conversions = 0
  const service = createLabelService({ measurement, loadEngine: async (signal) => {
    const engine = await loadMathJaxEngine(signal)
    return { ...engine, convert: (runs) => { conversions++; return engine.convert(runs) } }
  } })
  const runtime = createSvgLabelRuntime({ measurement, service })
  for (const source of ['ordinary', '日本語の領域', '$F^{(1)}L$', '射 $\\alpha$ と $g_i$']) {
    await service.convert(source, settings)
    const a = initialSvgLabelState({ source, settings, ownerIdentity: owner(1, 'path-a') }, runtime)
    const b = initialSvgLabelState({ source, settings, ownerIdentity: owner(1, 'path-b') }, runtime)
    const free = initialSvgLabelState({ source, settings, ownerIdentity: JSON.stringify(['free-label', 1, 'shared']) }, runtime)
    assert.equal(a.status, 'ready')
    assert.equal(a.result, b.result)
    assert.equal(b.result, free.result)
    assert.equal(new Set([a.requestIdentity, b.requestIdentity, free.requestIdentity]).size, 3)
  }
  const compiled = conversions
  await service.convert('射 $\\alpha$ と $g_i$', svgLabelLayoutSettings(24, 'serif', 1))
  assert.equal(conversions, compiled, 'Font/layout changes reuse compiled formula geometry')
  service.invalidate()
})

test('ownership tuples cannot alias path-local IDs, document revisions or delimiter-like IDs', () => {
  const identities = [owner(0, 'a', 'b'), owner('0', 'a', 'b'), owner(1, 'a', 'b'),
    owner(0, 'b', 'b'), owner(0, 'a:b', 'c'), owner(0, 'a', 'b:c')]
  assert.equal(new Set(identities).size, identities.length)
  assert.notEqual(svgLabelRequestIdentity({ source: '$x$', settings, ownerIdentity: identities[0] }),
    svgLabelRequestIdentity({ source: '$x$', settings, ownerIdentity: identities[1] }))
})

test('replacing a node owner or font request cancels delayed results with the same source', async () => {
  const base = createLabelService({ measurement })
  const source = '日本語 $x$'
  const old = deferred<LabelConversionResult>()
  const newer = deferred<LabelConversionResult>()
  const oldResult = await base.convert(source, settings)
  const newSettings = svgLabelLayoutSettings(24, 'serif', 2)
  const newResult = await base.convert(source, newSettings)
  const runtime = createSvgLabelRuntime({ measurement, service: {
    peek: () => undefined,
    convert: (_source, layout) => layout.font.sizePx === 12 ? old.promise : newer.promise,
  } })
  const controller = createSvgLabelController(runtime)
  const first: SvgLabelRequest = { source, settings, ownerIdentity: owner(1, 'path') }
  const second: SvgLabelRequest = { source, settings: newSettings, ownerIdentity: owner(2, 'path') }
  const cleanup = controller.start(first)
  await tick()
  cleanup()
  controller.start(second)
  assert.equal(controller.getSnapshot()?.source, source)
  assert.equal(controller.getSnapshot()?.status, 'pending')
  await tick()
  newer.resolve(newResult)
  await tick()
  old.resolve(oldResult)
  await tick()
  assert.equal(controller.getSnapshot()?.requestIdentity, svgLabelRequestIdentity(second))
  assert.equal(controller.getSnapshot()?.result, newResult)
  base.invalidate()
})

test('invalid/unsupported inline sources preserve all raw whitespace without suppressing sibling labels', async () => {
  const service = createLabelService({ measurement })
  const runtime = createSvgLabelRuntime({ measurement, service })
  const siblingRequest = { source: 'Sibling $g$', settings, ownerIdentity: owner(1, 'sibling') }
  await service.convert(siblingRequest.source, settings)
  const sibling = createSvgLabelController(runtime)
  sibling.start(siblingRequest)
  const siblingState = sibling.getSnapshot()
  const failed = createSvgLabelController(runtime)
  for (const source of ['  $unclosed\t\r\n  tail ', '  \\textbf{A} $x$\t\n ', ' $\\notACommand{x}$ ']) {
    await service.convert(source, settings)
    failed.start({ source, settings, ownerIdentity: owner(1, 'failed') })
    await tick()
    const snapshot = failed.getSnapshot()!
    assert.equal(snapshot.status, 'fallback')
    assert.equal(snapshot.source, source)
    assert.equal(snapshot.layout.placements.map((item) => item.kind === 'math' ? '' : item.text).join(''), source)
    assert.equal(sibling.getSnapshot(), siblingState)
  }
  service.invalidate()
})
