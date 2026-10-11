import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import type { AmbientDimension, Vec2 } from '../../src/model/types.ts'
import { createLabelService, type LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { svgPointNodeOwner } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { updateSelectionForBackgroundClick, updateSelectionForClick, type SelectedElement, type SelectionClickMode } from '../../src/ui/selection.ts'
import { createDiagramHistory } from '../../src/ui/undo.ts'

type Props = Readonly<Record<string, unknown>>
type Component = (props: Props) => unknown
type Element = { type: unknown; props: Props; key?: string | null }
type NativeNode = { type: string; props: Props; parent: NativeNode | null; children: NativeNode[] }
type HookSlot = { value?: unknown; dependencies?: readonly unknown[]; cleanup?: () => void }
type Context = { slots: HookSlot[]; cursor: number }

function isElement(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && 'type' in value && 'props' in value
    && typeof value.props === 'object' && value.props !== null
}

/** Executes the real production components and event callbacks. Hook state and
 * SVG hit/event propagation below are controlled Node fixtures, never trusted
 * native input. The cumulative browser body/far/warning evidence remains required. */
class ProductionRenderer {
  private contexts = new Map<string, Context>()
  private effects: (() => void)[] = []
  private visited = new Set<string>()
  render(Component: Component, props: Props): NativeNode {
    this.visited.clear()
    this.effects = []
    const nodes = this.expand({ type: Component, props }, null, 'root')
    for (const [key, context] of this.contexts) if (!this.visited.has(key)) {
      for (const slot of context.slots) slot.cleanup?.()
      this.contexts.delete(key)
    }
    for (const effect of this.effects) effect()
    assert.equal(nodes.length, 1)
    return nodes[0]
  }
  dispose(): void {
    for (const context of this.contexts.values()) for (const slot of context.slots) slot.cleanup?.()
    this.contexts.clear()
  }
  private expand(value: unknown, parent: NativeNode | null, path: string): NativeNode[] {
    if (Array.isArray(value)) return value.flatMap((child, i) => this.expand(child, parent, `${path}/${i}`))
    if (!isElement(value)) return []
    if (typeof value.type === 'function') {
      const key = `${path}/${value.key ?? 'component'}`
      const context = this.contexts.get(key) ?? { slots: [], cursor: 0 }
      this.contexts.set(key, context)
      this.visited.add(key)
      context.cursor = 0
      const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } })
        .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
      const previous = internals.H
      const nextSlot = () => context.slots[context.cursor++] ??= {}
      const memo = <T,>(create: () => T, dependencies: readonly unknown[]) => {
        const slot = nextSlot()
        if (!slot.dependencies || dependencies.some((item, i) => !Object.is(item, slot.dependencies?.[i]))) {
          slot.value = create()
          slot.dependencies = dependencies
        }
        return slot.value as T
      }
      internals.H = {
        useMemo: memo,
        useCallback: <T,>(callback: T, dependencies: readonly unknown[]) => memo(() => callback, dependencies),
        useRef: <T,>(initial: T) => {
          const slot = nextSlot()
          slot.value ??= { current: initial }
          return slot.value as { current: T }
        },
        useState: <T,>(initial: T | (() => T)) => {
          const slot = nextSlot()
          if (!('value' in slot)) slot.value = typeof initial === 'function' ? (initial as () => T)() : initial
          return [slot.value as T, (next: T | ((previous: T) => T)) => {
            slot.value = typeof next === 'function' ? (next as (previous: T) => T)(slot.value as T) : next
          }]
        },
        useEffect: () => { nextSlot() },
        useLayoutEffect: (effect: () => (() => void) | void, dependencies: readonly unknown[]) => {
          const slot = nextSlot()
          if (!slot.dependencies || dependencies.some((item, i) => !Object.is(item, slot.dependencies?.[i]))) {
            this.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() ?? undefined })
            slot.dependencies = dependencies
          }
        },
        useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => { nextSlot(); return snapshot() },
      }
      try { return this.expand((value.type as Component)(value.props), parent, `${key}/view`) }
      finally { internals.H = previous }
    }
    if (typeof value.type !== 'string') return this.expand(value.props.children, parent, `${path}/fragment`)
    const node: NativeNode = { type: value.type, props: value.props, parent, children: [] }
    node.children = this.expand(value.props.children, node, `${path}/${value.key ?? value.type}`)
    return [node]
  }
}

function all(root: NativeNode): NativeNode[] { return [root, ...root.children.flatMap(all)] }
function one(root: NativeNode, attribute: string, value: unknown = 'true'): NativeNode {
  const matches = all(root).filter(node => node.props[attribute] === value)
  assert.equal(matches.length, 1, `Exactly one current production ${attribute}=${String(value)}`)
  return matches[0]
}
function path(node: NativeNode): NativeNode[] { return node.parent ? [...path(node.parent), node] : [node] }
function selectable(node: NativeNode): boolean { return path(node).every(item => item.props.pointerEvents !== 'none') }
function rectBounds(node: NativeNode) {
  assert.equal(node.type, 'rect')
  const { x, y, width, height } = node.props
  assert.equal(typeof x, 'number'); assert.equal(typeof y, 'number')
  assert.equal(typeof width, 'number'); assert.equal(typeof height, 'number')
  assert.ok([x, y, width, height].every(value => Number.isFinite(value)))
  assert.ok(Number(width) > 0 && Number(height) > 0)
  return { minX: Number(x), minY: Number(y), maxX: Number(x) + Number(width), maxY: Number(y) + Number(height) }
}
function nodeToRoot(node: NativeNode, local: Vec2): Vec2 {
  const transform = String(node.props.transform).match(/^translate\(([^ ]+) ([^)]+)\)$/)
  assert.ok(transform)
  return { x: Number(transform[1]) + local.x, y: Number(transform[2]) + local.y }
}
function bodyHit(root: NativeNode, pointId: string, position: Vec2): NativeNode {
  const owner = all(root).find(node => node.props['data-point-id'] === pointId)
  const targets = owner ? all(owner).filter(node => node.props['data-point-body-target'] === 'true') : []
  const target = targets.find(node => {
    const bounds = rectBounds(node)
    return selectable(node) && position.x >= bounds.minX && position.x <= bounds.maxX
      && position.y >= bounds.minY && position.y <= bounds.maxY
  })
  return target ?? one(root, 'data-svg-background')
}
function click(root: NativeNode, target: NativeNode, point: Vec2, altKey = false): string[] {
  let stopped = false
  const delivered: string[] = []
  const event = {
    target, currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 520, height: 360 }) },
    clientX: point.x, clientY: point.y, altKey, shiftKey: false, metaKey: false, ctrlKey: false,
    button: 0, isTrusted: false,
    stopPropagation() { stopped = true }, preventDefault() {},
  }
  const invoke = (node: NativeNode, name: 'onClick' | 'onClickCapture') => {
    const handler = node.props[name]
    if (typeof handler === 'function') {
      delivered.push(node.props['data-point-id'] ? `point:${String(node.props['data-point-id'])}` : node.type)
      const callback = handler as (event: unknown) => void
      callback(event)
    }
  }
  const route = path(target)
  assert.equal(route[0], root)
  for (const node of route) { invoke(node, 'onClickCapture'); if (stopped) return delivered }
  for (const node of route.reverse()) { invoke(node, 'onClick'); if (stopped) break }
  return delivered
}

const measurement = { identity: 'production-body-interaction-fixed-font',
  measure: (text: string, font: { sizePx: number }) => ({ width: text.length * font.sizePx / 2, ascent: .8 * font.sizePx, descent: .2 * font.sizePx }),
  lineMetrics: (font: { sizePx: number }) => ({ ascent: .8 * font.sizePx, descent: .2 * font.sizePx }) }
function fixture(ambientDimension: AmbientDimension) {
  const diagram = createEmptyDiagram({ ambientDimension })
  const point = createPointStratum({ ambientDimension, id: 'app-point', text: 'WWWW diagnostic', position: { x: 1, y: 2, z: ambientDimension === 2 ? 0 : 3 } })
  point.style.shape = 'ellipse'
  point.style.layout = { anchor: 'not a PGF anchor', minimumWidth: 1000, minimumHeight: 1000 }
  diagram.strata = [point]
  const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  return { diagram, point, runtime }
}
const tick = () => new Promise<void>(done => setImmediate(done))

test('production preview body targets deliver ordinary owned point selection', async t => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'stz-point-body-production-'))
  const server = await createServer({ root: process.cwd(), appType: 'custom', cacheDir,
    logLevel: 'silent', server: { middlewareMode: true, ws: false }, configFile: false })
  try {
    const { SvgDiagram } = await server.ssrLoadModule('/src/rendering/SvgDiagram.tsx') as { SvgDiagram: Component }
    function mounted(ambientDimension: AmbientDimension) {
      const value = fixture(ambientDimension)
      const renderer = new ProductionRenderer()
      const history = createDiagramHistory(value.diagram)
      let selection: SelectedElement = null
      let revision = 397
      let props: Props = {}
      const render = () => renderer.render(SvgDiagram, { diagram: structuredClone(value.diagram), labelRuntime: value.runtime,
        labelDocumentRevision: revision, selectedElement: selection, showCoordinateAnchors: false,
        onSelectionChange: (next: SelectedElement, options: { mode: SelectionClickMode }) => {
          assert.ok(next?.kind !== 'multi')
          selection = next === null ? updateSelectionForBackgroundClick(selection, options.mode)
            : updateSelectionForClick(value.diagram, selection, next, options.mode)
        }, ...props })
      return { ...value, history, renderer, render, selected: () => selection,
        setProps: (next: Props) => { props = next }, setRevision: (next: number) => { revision = next },
        dispose: () => { renderer.dispose(); value.runtime.dispose() } }
    }

    for (const ambientDimension of [2, 3] as const) await t.test(`${ambientDimension}D literal body → far → warning uses the actual production callbacks`, () => {
      const f = mounted(ambientDimension)
      try {
        const before = [serializeDiagram(f.diagram), JSON.stringify(f.history)]
        let root = f.render()
        const body = one(root, 'data-point-body-target')
        const node = one(root, 'data-point-node', svgPointNodeOwner(397, f.point.id))
        const bounds = rectBounds(body)
        assert.equal(body.parent, node)
        assert.equal(body.props.fill, 'transparent')
        assert.equal(body.props['data-svg-export-exclude'], 'true')
        assert.equal(body.props.transform, undefined)
        assert.deepEqual(Object.values(bounds), String(node.props['data-point-body-bounds']).split(' ').map(Number))
        assert.ok(bounds.maxX - bounds.minX < 200 && bounds.maxY - bounds.minY < 30)
        assert.equal(all(root).filter(item => item.props['data-point-contour'] === 'true').length, 0)
        assert.equal(one(root, 'data-label-owner', node.props['data-point-node']).props['data-label-request'], node.props['data-point-request'])
        const input = { x: bounds.minX + 2, y: (bounds.minY + bounds.maxY) / 2 }
        const target = bodyHit(root, f.point.id, input)
        assert.equal(target, body, 'A visible body point has a reachable owned hit element')
        assert.deepEqual(click(root, target, nodeToRoot(node, input)), ['svg', 'point:app-point'])
        assert.deepEqual(f.selected(), { kind: 'stratum', id: f.point.id })
        root = f.render()
        const ring = all(root).find(item => item.type === 'circle' && item.props['data-svg-export-exclude'] === 'true')
        assert.ok(ring && Number(ring.props.r) < 100)
        const far = { x: bounds.maxX + 40, y: bounds.maxY + 40 }
        const background = bodyHit(root, f.point.id, far)
        assert.equal(background.props['data-svg-background'], 'true')
        assert.deepEqual(click(root, background, nodeToRoot(one(root, 'data-point-node', node.props['data-point-node']), far)), ['svg', 'svg'])
        assert.equal(f.selected(), null)
        root = f.render()
        assert.equal(all(root).filter(item => item.type === 'circle' && item.props['data-svg-export-exclude'] === 'true').length, 0)
        const warning = one(root, 'data-point-shape-warning')
        const warningStart = String(warning.props.d).match(/^M ([^ ]+) ([^ ]+)/)
        assert.ok(warningStart)
        const warningPoint = { x: Number(warningStart[1]) + 1, y: Number(warningStart[2]) + 3 }
        assert.deepEqual(click(root, warning, nodeToRoot(warning.parent!, warningPoint)), ['svg', 'point:app-point'])
        assert.deepEqual(f.selected(), { kind: 'stratum', id: f.point.id })
        assert.deepEqual([serializeDiagram(f.diagram), JSON.stringify(f.history)], before)
      } finally { f.dispose() }
    })

    await t.test('a disconnected body route remains background and cannot manufacture successful selection', () => {
      const f = mounted(2)
      try {
        const root = f.render()
        const target = one(root, 'data-point-body-target')
        target.parent!.children = target.parent!.children.filter(child => child !== target)
        const background = bodyHit(root, f.point.id, { x: 0, y: 0 })
        assert.equal(background.props['data-svg-background'], 'true')
        click(root, background, { x: 0, y: 0 })
        assert.equal(f.selected(), null, 'Production background callbacks do not select a body through the Alt collector')
      } finally { f.dispose() }
    })

    await t.test('hidden, locked, filtered and empty points do not gain an ordinary selectable body', () => {
      for (const condition of ['hidden', 'locked', 'filtered', 'empty', 'whitespace'] as const) {
        const f = mounted(3)
        try {
          f.point.layer = 2
          f.diagram.layers = [{ value: 2, name: 'body', ...(condition === 'hidden' ? { visible: false } : {}),
            ...(condition === 'locked' ? { locked: true } : {}) }]
          if (condition === 'filtered') f.setProps({ layerFilter: { kind: 'layer', layer: 0 } })
          if (condition === 'empty') f.point.text = ''
          if (condition === 'whitespace') f.point.text = ' \t\n '
          const root = f.render()
          const target = bodyHit(root, f.point.id, { x: 0, y: 0 })
          assert.equal(target.props['data-svg-background'], 'true', condition)
          click(root, target, { x: 0, y: 0 })
          assert.equal(f.selected(), null, condition)
          if (condition === 'empty' || condition === 'whitespace') assert.equal(all(root).filter(node => node.props['data-point-body-target'] === 'true').length, 0)
          if (condition === 'locked' || condition === 'filtered') assert.equal(selectable(one(root, 'data-point-body-target')), false)
        } finally { f.dispose() }
      }
    })

    await t.test('source edits, undo-like replacement and reused document IDs replace the current body request and bounds', async () => {
      const f = mounted(2)
      try {
        f.render()
        await tick()
        let root = f.render()
        const first = one(root, 'data-point-node', svgPointNodeOwner(397, f.point.id))
        const firstRequest = first.props['data-point-request']
        const firstWidth = Number(one(root, 'data-point-body-target').props.width)
        f.point.text = 'wide replacement body with a different current request'
        root = f.render()
        assert.notEqual(one(root, 'data-point-node', first.props['data-point-node']).props['data-point-request'], firstRequest)
        assert.ok(Number(one(root, 'data-point-body-target').props.width) > firstWidth)
        f.point.text = 'WWWW diagnostic'
        f.setRevision(398)
        root = f.render()
        assert.equal(all(root).filter(node => node.props['data-point-node'] === first.props['data-point-node']).length, 0)
        const current = one(root, 'data-point-node', svgPointNodeOwner(398, f.point.id))
        assert.notEqual(current.props['data-point-request'], firstRequest)
        await tick()
        root = f.render()
        assert.equal(one(root, 'data-label-owner', current.props['data-point-node']).props['data-label-source'], f.point.text)
        const target = one(root, 'data-point-body-target')
        assert.equal(target.parent?.props['data-point-request'], current.props['data-point-request'])
        assert.equal(Number(target.props.width), firstWidth)
        f.diagram.strata = []
        root = f.render()
        assert.equal(all(root).filter(node => node.props['data-point-body-target'] === 'true').length, 0)
      } finally { f.dispose() }
    })

    await t.test('pending, fallback and successful live bodies replace targets without late old-source delivery', async () => {
      const f = mounted(2)
      const releases = new Map<string, (result: LabelConversionResult) => void>()
      const delayed = createSvgLabelRuntime({ measurement, service: { peek: () => undefined,
        convert: source => new Promise(resolve => releases.set(source, resolve)) } })
      const service = createLabelService({ measurement })
      const sources = ['WWWW diagnostic', '$\\badPointBodyMacro$', 'current successful body']
      const results = await Promise.all(sources.map(source => service.convert(source, svgLabelLayoutSettings(12, svgPointNodeTextFontFamily))))
      f.setProps({ labelRuntime: delayed })
      try {
        let root = f.render()
        const oldRequest = one(root, 'data-point-node', svgPointNodeOwner(397, f.point.id)).props['data-point-request']
        assert.equal(one(root, 'data-label-owner', svgPointNodeOwner(397, f.point.id)).props['data-label-state'], 'pending')
        await tick()
        f.point.text = sources[1]
        root = f.render()
        const fallbackRequest = one(root, 'data-point-node', svgPointNodeOwner(397, f.point.id)).props['data-point-request']
        assert.notEqual(fallbackRequest, oldRequest)
        await tick()
        releases.get(sources[1])!(results[1]); await tick()
        root = f.render()
        assert.equal(one(root, 'data-label-owner', svgPointNodeOwner(397, f.point.id)).props['data-label-state'], 'fallback')
        const fallbackBounds = rectBounds(one(root, 'data-point-body-target'))
        releases.get(sources[0])!(results[0]); await tick()
        root = f.render()
        assert.equal(one(root, 'data-point-node', svgPointNodeOwner(397, f.point.id)).props['data-point-request'], fallbackRequest)
        assert.deepEqual(rectBounds(one(root, 'data-point-body-target')), fallbackBounds)
        f.point.text = sources[2]
        f.render(); await tick()
        releases.get(sources[2])!(results[2]); await tick()
        root = f.render()
        assert.equal(one(root, 'data-label-owner', svgPointNodeOwner(397, f.point.id)).props['data-label-state'], 'ready')
        const body = one(root, 'data-point-body-target')
        assert.equal(body.parent?.props['data-point-request'], one(root, 'data-label-owner', svgPointNodeOwner(397, f.point.id)).props['data-label-request'])
        assert.notDeepEqual(rectBounds(body), fallbackBounds)
        f.point.text = ''
        root = f.render()
        assert.equal(all(root).filter(node => node.props['data-point-body-target'] === 'true').length, 0)
      } finally { f.dispose(); delayed.dispose() }
    })

    await t.test('negative-padding overflow keeps the body route, contour callback and Alt owner cycle', () => {
      const f = mounted(2)
      try {
        f.point.style.shape = 'rectangle'
        f.point.style.layout = { innerXSep: -10, innerYSep: -2, anchor: 'center' }
        const overlap = { ...structuredClone(f.point), id: 'overlap-point' }
        f.diagram.strata.push(overlap)
        let root = f.render()
        const node = one(root, 'data-point-node', svgPointNodeOwner(397, f.point.id))
        const target = all(node).find(item => item.props['data-point-body-target'] === 'true')!
        const bounds = rectBounds(target)
        const shapeBounds = String(node.props['data-point-shape-bounds']).split(' ').map(Number)
        assert.ok(bounds.minX < shapeBounds[0])
        const bodyPoint = { x: bounds.minX + 1, y: 0 }
        click(root, bodyHit(root, f.point.id, bodyPoint), nodeToRoot(node, bodyPoint))
        assert.deepEqual(f.selected(), { kind: 'stratum', id: f.point.id })
        root = f.render()
        const owner = one(root, 'data-point-id', f.point.id)
        const contour = all(owner).find(item => item.props['data-point-contour'] === 'true')!
        click(root, contour, nodeToRoot(contour.parent!, { x: shapeBounds[0], y: 0 }))
        assert.deepEqual(f.selected(), { kind: 'stratum', id: f.point.id })
        // Alt still invokes production candidate ordering. Ordinary body clicks
        // above never invoke this collector branch.
        const projected = nodeToRoot(node, bodyPoint)
        click(root, all(one(root, 'data-point-id', f.point.id)).find(item => item.props['data-point-body-target'] === 'true')!, projected, true)
        assert.deepEqual(f.selected(), { kind: 'stratum', id: overlap.id })
        root = f.render()
        click(root, all(one(root, 'data-point-id', f.point.id)).find(item => item.props['data-point-body-target'] === 'true')!, projected, true)
        assert.deepEqual(f.selected(), { kind: 'stratum', id: f.point.id })
      } finally { f.dispose() }
    })
  } finally { await server.close(); rmSync(cacheDir, { recursive: true, force: true }) }
})

test('preview-only body targets do not alter detached settled node source, paint or placement', async () => {
  const f = fixture(3)
  try {
    const capture = captureSvgLabelExport({ runtime: f.runtime, source: f.point.text!, position: { x: 247.3, y: 34.8 },
      pointStyle: f.point.style, ownerIdentity: svgPointNodeOwner(397, f.point.id), fontSize: 12,
      fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center', boundsTarget: false,
      settings: svgLabelLayoutSettings(12, svgPointNodeTextFontFamily) })
    const [state] = await settleSvgExportLabels([capture])
    const detached = renderToStaticMarkup(React.createElement(SvgPointNodeView, { capture, state }))
    const preview = renderToStaticMarkup(React.createElement(SvgPointNodeView, { capture, state, previewBodyTarget: true }))
    assert.equal(preview.replace(/<rect[^>]*data-point-body-target="true"[^>]*><\/rect>/, ''), detached)
    assert.doesNotMatch(detached, /data-point-body-target/)
    assert.doesNotMatch(renderSettledSvgLabelDocument(capture, state), /data-point-body-target/)
    assert.match(detached, /data-label-source="WWWW diagnostic"/)
    assert.match(detached, /translate\(247.3 34.8\)/)
    for (const maxX of [Number.NaN, Number.POSITIVE_INFINITY, state.layout.bounds.minX]) {
      const invalidBody = { ...state, layout: { ...state.layout, bounds: { ...state.layout.bounds, maxX } } }
      const view = SvgPointNodeView({ capture, state: invalidBody, previewBodyTarget: true })
      assert.ok(isElement(view))
      const children: unknown = view.props.children
      assert.ok(Array.isArray(children))
      assert.equal(children.filter(isElement).filter(child => child.props['data-point-body-target'] === 'true').length, 0,
        'Nonfinite or empty current body bounds produce no interactive rect')
    }
  } finally { f.runtime.dispose() }
})
