import type { PointStratum, PointStyle } from '../model/types.ts'
import { literalSvgLabelLayout, placeSvgLabel, svgLabelLayoutSettings } from './labels/svgLabelLayout.ts'
import { svgLabelRequestIdentity, type SvgLabelState } from './labels/svgLabelRuntime.ts'
import { svgPointNodeGeometry } from './svgPointNodeGeometry.ts'
import { svgPointNodeTextFontFamily, svgPointNodeTextFontSize, svgPointNodeTexPointScale } from './svgPointNodeText.ts'
import { getPointPaint } from '../model/styles.ts'
import type { Vec2 } from '../model/types.ts'

export function svgPointNodeLayout(style: PointStyle, state: SvgLabelState) {
  const body = placeSvgLabel(state.layout, svgPointNodeTextFontSize, 'center')
  const geometry = svgPointNodeGeometry(style, state.source === '' ? { width: 0, height: 0 } : {
    width: body.bounds.maxX - body.bounds.minX, height: body.bounds.maxY - body.bounds.minY,
  })
  const border = getPointPaint(style).stroke
  // The contour uses ordinary SVG scaling, so this width stays in local units
  // even when a responsive viewport changes its displayed thickness.
  const stroke = border.enabled ? border.width * svgPointNodeTexPointScale : 0
  const strokeJoin = border.lineJoin
  // Miter corners can extend further than half a stroke beyond the path box.
  // Retain these vertices for both bounds and picking (SVG/PGF miter limit 10).
  const miterJoins = strokeJoin === 'miter' ? polygonMiterJoins(geometry.vertices, stroke / 2) : []
  const miterVertices = miterJoins.flat()
  const paintedBounds = {
    minX: geometry.bounds.minX - stroke / 2, minY: geometry.bounds.minY - stroke / 2,
    maxX: geometry.bounds.maxX + stroke / 2, maxY: geometry.bounds.maxY + stroke / 2,
  }
  for (const vertex of miterVertices) {
    paintedBounds.minX = Math.min(paintedBounds.minX, vertex.x)
    paintedBounds.minY = Math.min(paintedBounds.minY, vertex.y)
    paintedBounds.maxX = Math.max(paintedBounds.maxX, vertex.x)
    paintedBounds.maxY = Math.max(paintedBounds.maxY, vertex.y)
  }
  const selectionRadius = Math.max(geometry.radius + stroke / 2,
    ...miterVertices.map(({ x, y }) => Math.hypot(x, y)))
  return { body, geometry, paintedBounds, anchorClearanceBounds: { ...paintedBounds }, stroke, strokeJoin,
    miterVertices, miterJoins, selectionRadius }
}

function polygonMiterJoins(vertices: readonly Vec2[], halfStroke: number): Vec2[][] {
  if (vertices.length < 3 || halfStroke === 0) return []
  return vertices.flatMap((vertex, index) => {
    const previous = vertices[(index + vertices.length - 1) % vertices.length]
    const next = vertices[(index + 1) % vertices.length]
    const firstLength = Math.hypot(vertex.x - previous.x, vertex.y - previous.y)
    const secondLength = Math.hypot(next.x - vertex.x, next.y - vertex.y)
    if (firstLength === 0 || secondLength === 0) return []
    const first = { x: -(vertex.y - previous.y) / firstLength, y: (vertex.x - previous.x) / firstLength }
    const second = { x: -(next.y - vertex.y) / secondLength, y: (next.x - vertex.x) / secondLength }
    const denominator = 1 + first.x * second.x + first.y * second.y
    if (denominator < 1e-10) return []
    const offset = { x: (first.x + second.x) * halfStroke / denominator,
      y: (first.y + second.y) * halfStroke / denominator }
    if (Math.hypot(offset.x, offset.y) > halfStroke * 10) return []
    return [1, -1].map((sign) => [
      { x: vertex.x + sign * first.x * halfStroke, y: vertex.y + sign * first.y * halfStroke },
      { x: vertex.x + sign * offset.x, y: vertex.y + sign * offset.y },
      { x: vertex.x + sign * second.x * halfStroke, y: vertex.y + sign * second.y * halfStroke },
    ])
  })
}
export type SvgPointNodeLayout = ReturnType<typeof svgPointNodeLayout>
export type SvgPointNodeCommit = Readonly<{
  source: string; ownerIdentity: string; fontGeneration: number; shape: PointStyle['shape']; size: number
  requestIdentity: string; layout: SvgPointNodeLayout
}>
export type SvgPointNodeCommits = ReadonlyMap<string, SvgPointNodeCommit>

export function svgPointNodeOwner(documentRevision: number | string, id: string): string {
  return JSON.stringify(['point-node', documentRevision, id])
}

export function currentSvgPointNodeGeometry(point: PointStratum, commits: SvgPointNodeCommits,
  documentRevision: number | string, fontGeneration: number) {
  return currentSvgPointNodeLayout(point, commits, documentRevision, fontGeneration)?.geometry ?? null
}

export function currentSvgPointNodeLayout(point: PointStratum, commits: SvgPointNodeCommits,
  documentRevision: number | string, fontGeneration: number) {
  const entry = commits.get(point.id)
  const border = getPointPaint(point.style).stroke
  return entry?.ownerIdentity === svgPointNodeOwner(documentRevision, point.id)
    && entry.source === (point.text ?? '') && entry.fontGeneration === fontGeneration
    && entry.shape === point.style.shape && entry.size === point.style.size
    && entry.layout.stroke === (border.enabled ? border.width * svgPointNodeTexPointScale : 0)
    && entry.layout.strokeJoin === border.lineJoin ? entry.layout : null
}

/** Nonmounted callers use the same bounded full-source pending policy. */
export function pendingSvgPointNodeGeometry(point: PointStratum) {
  return pendingSvgPointNodeLayout(point).geometry
}

export function pendingSvgPointNodeLayout(point: PointStratum) {
  const request = { source: point.text ?? '',
    settings: svgLabelLayoutSettings(svgPointNodeTextFontSize, svgPointNodeTextFontFamily) }
  const state: SvgLabelState = { source: request.source, requestIdentity: svgLabelRequestIdentity(request),
    status: 'pending', ...literalSvgLabelLayout(request.source, request.settings) }
  return svgPointNodeLayout(point.style, state)
}
