import type { SVGProps } from 'react'
import type { PointStyle } from '../model/types.ts'
import { getPointPaint } from '../model/styles.ts'
import { effectiveSvgPointStroke } from './svgPointStroke.ts'

/**
 * PGF paint alpha is applied to each operation, not a composited SVG group.
 * Contours scale geometrically with the SVG: width, dashes and phase share the
 * local units used by layout, miter bounds, picking and detached export.
 */
export function pointStyleToSvgPaint(style: PointStyle): SVGProps<SVGPathElement> {
  const { fill, stroke } = getPointPaint(style)
  const settings = effectiveSvgPointStroke(style)
  return {
    fill: fill.enabled ? fill.color : 'none',
    fillOpacity: style.opacity * fill.opacity,
    stroke: stroke.enabled ? stroke.color : 'none',
    strokeOpacity: style.opacity * stroke.opacity,
    strokeWidth: settings.width,
    strokeDasharray: settings.pattern?.join(' '),
    strokeDashoffset: settings.phase,
    strokeLinecap: settings.cap,
    strokeLinejoin: settings.join,
    strokeMiterlimit: settings.miterLimit,
  }
}
