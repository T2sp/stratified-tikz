import type { PointStratum, PointStyle } from '../model/types.ts'
import { literalSvgLabelLayout, placeSvgLabel, svgLabelLayoutSettings } from './labels/svgLabelLayout.ts'
import { svgLabelRequestIdentity, type SvgLabelState } from './labels/svgLabelRuntime.ts'
import { svgPointNodeGeometry } from './svgPointNodeGeometry.ts'
import { svgPointNodeTextFontFamily, svgPointNodeTextFontSize, svgPointNodeTexPointScale } from './svgPointNodeText.ts'
import { getPointPaint } from '../model/styles.ts'
import { createPolygonStrokeRegion } from '../geometry/polygonStroke.ts'

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
  // Bounds, selection decoration and exterior picking share the actual union
  // of strips and joins, including overlapping wide strokes (miter limit 10).
  const strokeRegion = geometry.kind === 'polygon'
    ? createPolygonStrokeRegion(geometry.vertices, stroke, strokeJoin) : null
  const paintedBounds = geometry.kind === 'circle' ? {
    minX: geometry.bounds.minX - stroke / 2, minY: geometry.bounds.minY - stroke / 2,
    maxX: geometry.bounds.maxX + stroke / 2, maxY: geometry.bounds.maxY + stroke / 2,
  } : { ...(strokeRegion?.bounds ?? geometry.bounds) }
  const selectionRadius = geometry.kind === 'circle' ? geometry.radius + stroke / 2
    : Math.max(geometry.radius, strokeRegion?.radius ?? 0)
  return { body, geometry, paintedBounds, anchorClearanceBounds: { ...paintedBounds }, stroke, strokeJoin,
    strokeRegion, selectionRadius }
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
