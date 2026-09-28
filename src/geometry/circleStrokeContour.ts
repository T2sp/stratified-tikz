import type { Vec2 } from '../model/types.ts'

/**
 * Native SVG curve dash subdivision has renderer-dependent endpoint tangents,
 * amplified by wide square caps. A fixed linear contour makes those endpoints
 * identical in paint and pure geometry without an inflated picking tolerance.
 * The inscribed contour's Hausdorff error is r*(1-cos(pi/256)); its edge tangent
 * differs from the ideal circle by at most pi/256. Count is independent of dash
 * lengths, phase, width and radius. Solid and butt/round circles stay circles.
 */
export const circleStrokeSides = 256
export function circleStrokeVertices(radius: number): Vec2[] {
  return Array.from({ length: circleStrokeSides }, (_, index) => {
    const angle = index * 2 * Math.PI / circleStrokeSides
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
  })
}
