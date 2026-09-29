import type { PointStratum, PointStyle } from '../model/types.ts'
import { literalSvgLabelLayout, placeSvgLabel, svgLabelLayoutSettings } from './labels/svgLabelLayout.ts'
import { svgLabelRequestIdentity, type SvgLabelState } from './labels/svgLabelRuntime.ts'
import { svgPointNodeGeometry } from './svgPointNodeGeometry.ts'
import { svgPointNodeTextFontFamily, svgPointNodeTextFontSize } from './svgPointNodeText.ts'
import { createPolygonStrokeRegion } from '../geometry/polygonStroke.ts'
import { createDashCaps } from '../geometry/dashCaps.ts'
import { effectiveSvgPointStroke, sameSvgPointStroke } from './svgPointStroke.ts'
import { circleStrokeVertices } from '../geometry/circleStrokeContour.ts'
import { resolvePointShapeParameters } from '../model/pointShapeParameters.ts'

export function svgPointNodeLayout(style: PointStyle, state: SvgLabelState) {
  const body = placeSvgLabel(state.layout, svgPointNodeTextFontSize, 'center')
  const strokeSettings = effectiveSvgPointStroke(style)
  const geometry = svgPointNodeGeometry(style, state.source === '' ? { width: 0, height: 0 } : {
    width: body.bounds.maxX - body.bounds.minX, height: body.bounds.maxY - body.bounds.minY,
    depth: Math.max(0, state.layout.bounds.maxY * svgPointNodeTextFontSize),
  }, undefined, strokeSettings.width)
  // The contour uses ordinary SVG scaling, so this width stays in local units
  // even when a responsive viewport changes its displayed thickness.
  const stroke = strokeSettings.enabled && !geometry.limitation ? strokeSettings.width : 0
  const strokeJoin = strokeSettings.join
  const circleCaps = geometry.kind === 'circle' && stroke > 0 && strokeSettings.cap === 'square'
    ? createDashCaps(geometry, stroke, strokeSettings.pattern, strokeSettings.phase, strokeSettings.cap) : null
  const strokeContour = circleCaps?.families.length
    ? { ...geometry, kind: 'polygon' as const, vertices: circleStrokeVertices(geometry.radius) } : geometry
  // Bounds, selection decoration and exterior picking share the actual union
  // of strips and joins, including overlapping wide strokes (miter limit 10).
  const strokeRegion = strokeContour.kind === 'polygon'
    ? createPolygonStrokeRegion(strokeContour.vertices, stroke, strokeJoin) : null
  const dashCaps = createDashCaps(strokeContour, stroke, strokeSettings.pattern, strokeSettings.phase, strokeSettings.cap)
  const paintedBounds = geometry.kind === 'circle' ? {
    minX: geometry.bounds.minX - stroke / 2, minY: geometry.bounds.minY - stroke / 2,
    maxX: geometry.bounds.maxX + stroke / 2, maxY: geometry.bounds.maxY + stroke / 2,
  } : { ...(strokeRegion?.bounds ?? geometry.bounds) }
  for (const bounds of [dashCaps.bounds, strokeRegion?.bounds]) if (bounds) {
    paintedBounds.minX = Math.min(paintedBounds.minX, bounds.minX)
    paintedBounds.minY = Math.min(paintedBounds.minY, bounds.minY)
    paintedBounds.maxX = Math.max(paintedBounds.maxX, bounds.maxX)
    paintedBounds.maxY = Math.max(paintedBounds.maxY, bounds.maxY)
  }
  const selectionRadius = Math.max(dashCaps.radius, strokeRegion?.radius ?? 0, geometry.kind === 'circle' ? geometry.radius + stroke / 2
    : Math.max(geometry.radius, strokeRegion?.radius ?? 0))
  return { body, geometry, paintedBounds, anchorClearanceBounds: geometry.solution?.anchorBounds ?? { ...paintedBounds }, stroke, strokeJoin,
    shapeParametersIdentity: svgPointShapeParametersIdentity(style),
    strokeContour, strokeRegion, strokeSettings, dashCaps, selectionRadius }
}
export function svgPointShapeParametersIdentity(style: Pick<PointStyle, 'shapeParameters'>): string {
  return JSON.stringify(resolvePointShapeParameters(style.shapeParameters))
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
  const strokeSettings = effectiveSvgPointStroke(point.style)
  return entry?.ownerIdentity === svgPointNodeOwner(documentRevision, point.id)
    && entry.source === (point.text ?? '') && entry.fontGeneration === fontGeneration
    && entry.shape === point.style.shape && entry.size === point.style.size
    && entry.layout.shapeParametersIdentity === svgPointShapeParametersIdentity(point.style)
    && sameSvgPointStroke(entry.layout.strokeSettings, strokeSettings) ? entry.layout : null
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
