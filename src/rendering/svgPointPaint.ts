import type { SVGProps } from 'react'
import type { PointStyle } from '../model/types.ts'
import { getPointPaint } from '../model/styles.ts'
import { svgPointNodeTexPointScale } from './svgPointNodeGeometry.ts'

/** PGF paint alpha is applied to each operation, not a composited SVG group. */
export function pointStyleToSvgPaint(style: PointStyle): SVGProps<SVGPathElement> {
  const { fill, stroke } = getPointPaint(style)
  const scale = svgPointNodeTexPointScale
  const pattern = stroke.dashPattern ?? (stroke.lineStyle === 'dashed' ? [3, 3]
    : stroke.lineStyle === 'dotted' ? [stroke.width, 2]
      : stroke.lineStyle === 'denselyDotted' ? [stroke.width, 1] : undefined)
  return {
    fill: fill.enabled ? fill.color : 'none',
    fillOpacity: style.opacity * fill.opacity,
    stroke: stroke.enabled ? stroke.color : 'none',
    strokeOpacity: style.opacity * stroke.opacity,
    strokeWidth: stroke.width * scale,
    strokeDasharray: pattern?.map((part) => part * scale).join(' '),
    strokeDashoffset: stroke.dashPhase * scale,
    strokeLinecap: stroke.lineCap === 'rect' ? 'square' : stroke.lineCap,
    strokeLinejoin: stroke.lineJoin,
    strokeMiterlimit: 10,
    vectorEffect: 'non-scaling-stroke',
  }
}
