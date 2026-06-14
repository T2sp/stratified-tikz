import type { Vec2 } from '../model/types'

export function formatSvgNumber(value: number): string {
  if (Object.is(value, -0)) {
    return '0'
  }

  const rounded = Number(value.toFixed(3))
  return String(rounded)
}

export function svgPoint(point: Vec2): string {
  return `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`
}

export function svgPointList(points: readonly Vec2[]): string {
  return points.map(svgPoint).join(' ')
}

export function polylineToSvgPath(points: readonly Vec2[]): string {
  if (points.length === 0) {
    return ''
  }

  const [firstPoint, ...rest] = points
  return [`M ${svgPoint(firstPoint)}`, ...rest.map((point) => `L ${svgPoint(point)}`)].join(
    ' ',
  )
}

export function cubicBezierToSvgPath(points: readonly Vec2[]): string {
  if (points.length !== 4) {
    return polylineToSvgPath(points)
  }

  const [start, firstControl, secondControl, end] = points
  return [
    `M ${svgPoint(start)}`,
    `C ${svgPoint(firstControl)} ${svgPoint(secondControl)} ${svgPoint(end)}`,
  ].join(' ')
}

export function regularPolygonPoints(
  center: Vec2,
  radius: number,
  sides: number,
  rotationRadians: number,
): Vec2[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotationRadians + (index * Math.PI * 2) / sides
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    }
  })
}

export function starPolygonPoints(
  center: Vec2,
  outerRadius: number,
  innerRadius: number,
): Vec2[] {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = -Math.PI / 2 + (index * Math.PI) / 5
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    }
  })
}
