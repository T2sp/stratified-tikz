import type { PointStratum, PointStyle } from '../model/types.ts'
import { literalSvgLabelLayout, placeSvgLabel, svgLabelLayoutSettings } from './labels/svgLabelLayout.ts'
import { svgLabelRequestIdentity, type SvgLabelState } from './labels/svgLabelRuntime.ts'
import { svgPointNodeGeometry } from './svgPointNodeGeometry.ts'
import { svgPointNodeTextFontFamily, svgPointNodeTextFontSize, svgPointNodeTexPointScale } from './svgPointNodeText.ts'
import { createPolygonStrokeRegion } from '../geometry/polygonStroke.ts'
import { createDashCaps } from '../geometry/dashCaps.ts'
import { effectiveSvgPointStroke, sameSvgPointStroke } from './svgPointStroke.ts'
import { circleStrokeVertices } from '../geometry/circleStrokeContour.ts'
import { resolvePointShapeParameters } from '../model/pointShapeParameters.ts'
import { defaultPointNodeFontContext, pointLayoutIdentity, resolvePointNodeLayoutOptions } from '../model/pointNodeLayout.ts'
import { solvePointNodeShape } from '../geometry/pointNodeShapes/index.ts'

export function svgPointNodeLayout(style: PointStyle, state: SvgLabelState) {
  const centeredBody = placeSvgLabel(state.layout, svgPointNodeTextFontSize, 'center')
  const strokeSettings = effectiveSvgPointStroke(style)
  const geometry = svgPointNodeGeometry(style, state.source === '' ? { width: 0, height: 0 } : {
    width: centeredBody.bounds.maxX - centeredBody.bounds.minX, height: centeredBody.bounds.maxY - centeredBody.bounds.minY,
    depth: Math.max(0, state.layout.bounds.maxY * svgPointNodeTextFontSize),
    originX: centeredBody.offsetX,
  }, undefined, strokeSettings.width)
  const layoutOptions = resolvePointNodeLayoutOptions(style, strokeSettings.width / svgPointNodeTexPointScale)
  // Legacy paths keep their exact accepted vertex/perimeter arithmetic. Their
  // anchor clearance still comes from the same PGF resolver as edited nodes.
  const anchorSolution = geometry.solution ?? solveLegacyAnchorLayout(style, state, geometry, strokeSettings.width, centeredBody.offsetX)
  const selectedAnchor = anchorSolution?.placementAnchor ?? { x: 0, y: 0 }
  const placementOffset = { x: -selectedAnchor.x || 0, y: -selectedAnchor.y || 0 }
  const body = { ...centeredBody,
    offsetX: centeredBody.offsetX + placementOffset.x,
    offsetY: centeredBody.offsetY + placementOffset.y,
    bounds: translateBounds(centeredBody.bounds, placementOffset) }
  // A diagnostic replaces the requested contour. Its small, explicit SVG
  // mark stays beside the visible body, even if the hidden shape is very large.
  const warningBounds = geometry.limitation ? {
    minX: geometry.contentBounds.minX - 8, maxX: geometry.contentBounds.minX - 6,
    minY: geometry.contentBounds.minY - 2, maxY: geometry.contentBounds.minY + 10,
  } : undefined
  // The contour uses ordinary SVG scaling, so this width stays in local units
  // even when a responsive viewport changes its displayed thickness.
  const stroke = strokeSettings.enabled && !geometry.limitation ? strokeSettings.width : 0
  const strokeJoin = strokeSettings.join
  const circleCaps = geometry.kind === 'circle' && stroke > 0 && strokeSettings.cap === 'square'
    ? createDashCaps(geometry, stroke, strokeSettings.pattern, strokeSettings.phase, strokeSettings.cap) : null
  // Seam-only caps have the exact native circle tangent. Interior dash
  // endpoints still need the established finite contour to share SVG paint's
  // endpoint subdivision; a fully covered dash must retain its circle source.
  const strokeContour = circleCaps?.families.length && !circleCaps.seamOnly
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
  const bodyRadius = state.source === '' ? 0 : Math.max(...[
    [centeredBody.bounds.minX, centeredBody.bounds.minY], [centeredBody.bounds.maxX, centeredBody.bounds.minY],
    [centeredBody.bounds.minX, centeredBody.bounds.maxY], [centeredBody.bounds.maxX, centeredBody.bounds.maxY],
  ].map(([x, y]) => Math.hypot(x, y)))
  const warningRadius = warningBounds ? Math.max(Math.hypot(warningBounds.minX, warningBounds.minY),
    Math.hypot(warningBounds.minX, warningBounds.maxY), Math.hypot(warningBounds.maxX, warningBounds.minY),
    Math.hypot(warningBounds.maxX, warningBounds.maxY)) : 0
  const selectionRadius = geometry.limitation ? Math.max(bodyRadius, warningRadius)
    : Math.max(bodyRadius, dashCaps.radius, strokeRegion?.radius ?? 0, geometry.kind === 'circle' ? geometry.radius + stroke / 2
      : Math.max(geometry.radius, strokeRegion?.radius ?? 0))
  return { body, geometry, placementOffset, selectedAnchor,
    shapeBounds: translateBounds(geometry.bounds, placementOffset),
    bodyOrigin: { x: body.bounds.minX, y: body.bounds.minY },
    textOrigin: { x: body.offsetX, y: body.offsetY },
    baseline: state.source === '' ? placementOffset.y : centeredBody.offsetY + placementOffset.y,
    layoutOptions,
    layoutIdentity: pointLayoutIdentity(style),
    paintedBounds: translateBounds(geometry.limitation ? { minX: 0, minY: 0, maxX: 0, maxY: 0 } : paintedBounds, placementOffset),
    warningBounds: warningBounds ? translateBounds(warningBounds, placementOffset) : undefined,
    anchorClearanceBounds: translateBounds(anchorSolution?.anchorBounds ?? paintedBounds, placementOffset), stroke, strokeJoin,
    shapeParametersIdentity: svgPointShapeParametersIdentity(style),
    strokeContour, strokeRegion, strokeSettings, dashCaps, selectionRadius }
}
function solveLegacyAnchorLayout(style: PointStyle, state: SvgLabelState,
  geometry: ReturnType<typeof svgPointNodeGeometry>, lineWidth: number, originX: number) {
  const scale = svgPointNodeTexPointScale
  const layout = resolvePointNodeLayoutOptions(style, lineWidth / scale)
  const bodyWidth = geometry.contentBounds.maxX - geometry.contentBounds.minX
  const bodyHeight = geometry.contentBounds.maxY - geometry.contentBounds.minY
  const depth = state.source === '' ? 0 : Math.min(bodyHeight, Math.max(0, state.layout.bounds.maxY * svgPointNodeTextFontSize))
  const parameters = resolvePointShapeParameters(style.shapeParameters)
  try {
    return solvePointNodeShape({ shape: style.shape, unitScale: scale,
      body: { width: bodyWidth, height: bodyHeight - depth, depth, originX },
      innerXSep: geometry.innerSep, innerYSep: geometry.innerSep,
      outerXSep: layout.outerXSep * scale, outerYSep: layout.outerYSep * scale,
      minimumWidth: layout.minimumWidth * scale, minimumHeight: layout.minimumHeight * scale,
      anchor: layout.anchor, lineWidth, fontContext: { em: defaultPointNodeFontContext.fontSizePt * scale,
        ex: defaultPointNodeFontContext.xHeightPt * scale },
      parameters: { ...parameters, starPointHeight: parameters.starPointHeight * scale } })
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return undefined
  }
}
function translateBounds(bounds: { minX: number; minY: number; maxX: number; maxY: number }, offset: { x: number; y: number }) {
  return { minX: bounds.minX + offset.x, minY: bounds.minY + offset.y,
    maxX: bounds.maxX + offset.x, maxY: bounds.maxY + offset.y }
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
    && entry.layout.layoutIdentity === pointLayoutIdentity(point.style)
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
