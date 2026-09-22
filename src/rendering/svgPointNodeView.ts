import { createElement, type ReactElement, type Ref } from 'react'
import type { SvgLabelState } from './labels/svgLabelRuntime.ts'
import type { SvgLabelExportCapture } from './svgLabelExportRegistry.ts'
import { SvgTexLabelView } from './svgLabelView.ts'
import { svgPointNodeLayout } from './svgPointNodeLayout.ts'

/** Pure whole-node view shared by preview and detached settled export. */
export function SvgPointNodeView({ capture, state, selected = false, elementRef }: {
  capture: SvgLabelExportCapture; state: SvgLabelState; selected?: boolean; elementRef?: Ref<SVGGElement>
}): ReactElement {
  if (!capture.pointStyle) throw new Error('Missing point style')
  const style = capture.pointStyle
  const layout = svgPointNodeLayout(style, state)
  const { geometry } = layout
  const paint = { fill: style.fill === 'hollow' ? '#ffffff' : style.color, stroke: style.color,
    strokeWidth: layout.stroke, opacity: style.opacity, vectorEffect: 'non-scaling-stroke',
    'data-point-contour': 'true' }
  return createElement('g', { ref: elementRef,
    transform: `translate(${capture.position.x} ${capture.position.y})`,
    'data-point-node': capture.ownerIdentity, 'data-point-request': state.requestIdentity,
    'data-point-shape-bounds': Object.values(geometry.bounds).join(' '),
    'data-point-painted-bounds': Object.values(layout.paintedBounds).join(' '),
  }, selected ? createElement('circle', { r: geometry.radius + 6, fill: 'none', stroke: '#F4B400',
    strokeOpacity: 0.85, strokeWidth: 3, vectorEffect: 'non-scaling-stroke', pointerEvents: 'none',
    'data-svg-export-exclude': 'true' }) : null,
  geometry.kind === 'circle' ? createElement('circle', { ...paint, r: geometry.radius })
    : createElement('polygon', { ...paint, points: geometry.vertices.map(({ x, y }) => `${x},${y}`).join(' ') }),
  createElement(SvgTexLabelView, { capture: { ...capture, position: { x: 0, y: 0 } }, state }))
}
