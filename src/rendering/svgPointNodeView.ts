import { createElement, type ReactElement, type Ref } from 'react'
import type { SvgLabelState } from './labels/svgLabelRuntime.ts'
import type { SvgLabelExportCapture } from './svgLabelExportRegistry.ts'
import { SvgTexLabelView } from './svgLabelView.ts'
import { svgPointNodeLayout } from './svgPointNodeLayout.ts'
import { pointStyleToSvgPaint } from './svgPointPaint.ts'
import { getPointPaint } from '../model/styles.ts'
import { resolvePointShapeParameters } from '../model/pointShapeParameters.ts'

/** Pure whole-node view shared by preview and detached settled export. */
export function SvgPointNodeView({ capture, state, selected = false, elementRef }: {
  capture: SvgLabelExportCapture; state: SvgLabelState; selected?: boolean; elementRef?: Ref<SVGGElement>
}): ReactElement {
  if (!capture.pointStyle) throw new Error('Missing point style')
  const style = capture.pointStyle
  const layout = svgPointNodeLayout(style, state)
  const { geometry, strokeContour } = layout
  const textPaint = getPointPaint(style).text
  const parameters = resolvePointShapeParameters(style.shapeParameters)
  const offsetTransform = layout.placementOffset.x === 0 && layout.placementOffset.y === 0 ? undefined
    : `translate(${layout.placementOffset.x} ${layout.placementOffset.y})`
  const paint = { ...pointStyleToSvgPaint(style),
    transform: offsetTransform,
    'data-point-contour': 'true',
    ...(geometry.kind === 'circle' ? { 'data-point-circle-radius': geometry.radius } : {}) }
  return createElement('g', { ref: elementRef,
    transform: `translate(${capture.position.x} ${capture.position.y})`,
    'data-point-node': capture.ownerIdentity, 'data-point-request': state.requestIdentity,
    'data-point-shape': style.shape,
    'data-point-shape-parameters': JSON.stringify(parameters),
    ...(geometry.limitation ? { 'data-point-shape-limitation': geometry.limitation } : {}),
    'data-point-layout': JSON.stringify(layout.layoutOptions),
    'data-point-anchor': layout.layoutOptions.anchor,
    'data-point-anchor-offset': `${layout.selectedAnchor.x} ${layout.selectedAnchor.y}`,
    'data-point-body-origin': `${layout.bodyOrigin.x} ${layout.bodyOrigin.y}`,
    'data-point-text-origin': `${layout.textOrigin.x} ${layout.textOrigin.y}`,
    'data-point-body-baseline': layout.baseline,
    'data-point-body-bounds': Object.values(layout.body.bounds).join(' '),
    'data-point-anchor-bounds': Object.values(layout.anchorClearanceBounds).join(' '),
    'data-point-shape-bounds': Object.values(layout.shapeBounds).join(' '),
    'data-point-painted-bounds': Object.values(layout.paintedBounds).join(' '),
  }, selected ? createElement('circle', { r: layout.selectionRadius + 6,
    cx: layout.placementOffset.x, cy: layout.placementOffset.y, fill: 'none', stroke: '#F4B400',
    strokeOpacity: 0.85, strokeWidth: 3, vectorEffect: 'non-scaling-stroke', pointerEvents: 'none',
    'data-svg-export-exclude': 'true' }) : null,
  ...(!geometry.limitation && style.shape === 'cylinder' && parameters.cylinderUsesCustomFill
    ? (geometry.solution?.paintRegions ?? []).map((region) => createElement('path', {
      key: region.role, d: region.path, 'data-point-paint-region': region.role,
      transform: offsetTransform,
      fill: region.role === 'body' ? parameters.cylinderBodyFill : parameters.cylinderEndFill,
      fillOpacity: paint.fillOpacity, stroke: 'none',
    })) : []),
  geometry.limitation && layout.warningBounds ? createElement('path', {
    d: `M ${layout.warningBounds.minX} ${layout.warningBounds.minY} h 2 v 7 h -2 Z M ${layout.warningBounds.minX} ${layout.warningBounds.minY + 10} h 2 v 2 h -2 Z`,
    fill: '#B45309',
    'aria-label': `Shape preview unavailable: ${geometry.limitation}`, 'data-point-shape-warning': 'true',
  }, createElement('title', {}, `Shape preview unavailable: ${geometry.limitation}`))
    : strokeContour.kind === 'circle' ? createElement('circle', { ...paint, r: geometry.radius })
    : geometry.solution && geometry.kind !== 'circle' ? createElement('path', { ...paint, d: geometry.solution.contours[0].path })
    : createElement('polygon', { ...paint, points: strokeContour.vertices.map(({ x, y }) => `${x},${y}`).join(' ') }),
  ...(!geometry.limitation ? geometry.solution?.contours.slice(1).map((contour, index) => createElement('path', {
    ...paint, key: `seam-${index}`, d: contour.path, fill: 'none',
    'data-point-contour': undefined, 'data-point-internal-border': 'true',
  })) ?? [] : []),
  createElement(SvgTexLabelView, { capture: { ...capture, color: textPaint.color,
    opacity: style.opacity * textPaint.opacity, position: layout.placementOffset }, state }))
}
