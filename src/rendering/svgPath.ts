import type { Vec2 } from '../model/types'

export type SvgLinePathSegment = {
  kind: 'line'
  start: Vec2
  end: Vec2
}

export type SvgCubicBezierPathSegment = {
  kind: 'cubicBezier'
  start: Vec2
  control1: Vec2
  control2: Vec2
  end: Vec2
}

export type SvgPathSegment =
  | SvgLinePathSegment
  | SvgCubicBezierPathSegment

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

export function pathSegmentsToSvgPath(
  segments: readonly SvgPathSegment[],
): string {
  if (segments.length === 0) {
    return ''
  }

  const [firstSegment, ...restSegments] = segments
  const commands = [
    `M ${svgPoint(firstSegment.start)}`,
    svgCommandForPathSegment(firstSegment),
    ...restSegments.map(svgCommandForPathSegment),
  ]

  return commands.join(' ')
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

function svgCommandForPathSegment(segment: SvgPathSegment): string {
  switch (segment.kind) {
    case 'line':
      return `L ${svgPoint(segment.end)}`
    case 'cubicBezier':
      return `C ${svgPoint(segment.control1)} ${svgPoint(
        segment.control2,
      )} ${svgPoint(segment.end)}`
  }
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
