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
  const paint = { ...pointStyleToSvgPaint(style),
    'data-point-contour': 'true',
    ...(geometry.kind === 'circle' ? { 'data-point-circle-radius': geometry.radius } : {}) }
  return createElement('g', { ref: elementRef,
    transform: `translate(${capture.position.x} ${capture.position.y})`,
    'data-point-node': capture.ownerIdentity, 'data-point-request': state.requestIdentity,
    'data-point-shape': style.shape,
    'data-point-shape-parameters': JSON.stringify(parameters),
    ...(geometry.limitation ? { 'data-point-shape-limitation': geometry.limitation } : {}),
    'data-point-shape-bounds': Object.values(geometry.bounds).join(' '),
    'data-point-painted-bounds': Object.values(layout.paintedBounds).join(' '),
  }, selected ? createElement('circle', { r: layout.selectionRadius + 6, fill: 'none', stroke: '#F4B400',
    strokeOpacity: 0.85, strokeWidth: 3, vectorEffect: 'non-scaling-stroke', pointerEvents: 'none',
    'data-svg-export-exclude': 'true' }) : null,
  ...(style.shape === 'cylinder' && parameters.cylinderUsesCustomFill
    ? (geometry.solution?.paintRegions ?? []).map((region) => createElement('path', {
      key: region.role, d: region.path, 'data-point-paint-region': region.role,
      fill: region.role === 'body' ? parameters.cylinderBodyFill : parameters.cylinderEndFill,
      fillOpacity: paint.fillOpacity, stroke: 'none',
    })) : []),
  geometry.limitation ? createElement('text', {
    x: geometry.bounds.minX, y: geometry.bounds.minY + 10, fill: '#B45309', fontSize: 12,
    'aria-label': `Shape preview unavailable: ${geometry.limitation}`, 'data-point-shape-warning': 'true',
  }, '!', createElement('title', {}, `Shape preview unavailable: ${geometry.limitation}`))
    : geometry.solution ? createElement('path', { ...paint, d: geometry.solution.contours[0].path })
    : strokeContour.kind === 'circle' ? createElement('circle', { ...paint, r: geometry.radius })
    : createElement('polygon', { ...paint, points: strokeContour.vertices.map(({ x, y }) => `${x},${y}`).join(' ') }),
  ...(geometry.solution?.contours.slice(1).map((contour, index) => createElement('path', {
    ...paint, key: `seam-${index}`, d: contour.path, fill: 'none',
    'data-point-contour': undefined, 'data-point-internal-border': 'true',
  })) ?? []),
  createElement(SvgTexLabelView, { capture: { ...capture, color: textPaint.color,
    opacity: style.opacity * textPaint.opacity, position: { x: 0, y: 0 } }, state }))
}
