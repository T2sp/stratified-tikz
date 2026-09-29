import type { Vec2 } from '../../model/types.ts'
import type { PointShapeBounds, PointShapeContour } from './types.ts'

const radians = Math.PI / 180
const sampleSagitta = 0.005
const maximumArcSamples = 2048

/** Convert PGF's positive-up frame to SVG, applying border rotation only. */
export function svgPoint(point: Vec2, rotation = 0): Vec2 {
  const angle = rotation * radians
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: -(point.x * Math.sin(angle) + point.y * Math.cos(angle)),
  }
}

function number(value: number): string {
  return String(Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12)))
}

function pointText(point: Vec2): string {
  return `${number(point.x)} ${number(point.y)}`
}

export function boundsOfPoints(points: readonly Vec2[]): PointShapeBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { minX, minY, maxX, maxY }
}

/** PGF-space path builder. Arc extrema are retained for exact analytic bounds. */
export class ShapeContourBuilder {
  private readonly commands: string[] = []
  private readonly points: Vec2[] = []
  private isClosed = false
  private readonly rotation: number

  constructor(rotation = 0) {
    this.rotation = rotation
  }

  move(point: Vec2): this {
    const svg = svgPoint(point, this.rotation)
    this.commands.push(`M ${pointText(svg)}`)
    this.append(svg)
    return this
  }

  line(point: Vec2): this {
    const svg = svgPoint(point, this.rotation)
    this.commands.push(`L ${pointText(svg)}`)
    this.append(svg)
    return this
  }

  arc(center: Vec2, rx: number, ry: number, start: number, end: number): this {
    // SVG arc syntax cannot describe a full revolution in one command.
    const parts = Math.max(1, Math.ceil(Math.abs(end - start) / 180))
    for (let part = 0; part < parts; part += 1) {
      const from = start + ((end - start) * part) / parts
      const to = start + ((end - start) * (part + 1)) / parts
      const target = svgPoint(ellipsePoint(center, rx, ry, to), this.rotation)
      this.commands.push(
        `A ${number(rx)} ${number(ry)} ${number(-this.rotation)} 0 ${to > from ? 0 : 1} ${pointText(target)}`,
      )
      const span = Math.abs(to - from) * radians
      const radius = Math.max(rx, ry)
      const step = radius <= sampleSagitta
        ? Math.PI / 2
        : 2 * Math.acos(Math.max(-1, 1 - sampleSagitta / radius))
      const requestedSamples = Math.ceil(span / step)
      if (!Number.isFinite(requestedSamples) || requestedSamples > maximumArcSamples) {
        throw new RangeError('Curved shape exceeds the bounded 2048-sample arc budget at 0.005-unit hit precision.')
      }
      const samples = Math.max(2, requestedSamples)
      const fractions = Array.from({ length: samples + 1 }, (_, index) => index / samples)
      const rotation = this.rotation * radians
      const xCritical = Math.atan2(-ry * Math.sin(rotation), rx * Math.cos(rotation)) / radians
      const yCritical = Math.atan2(ry * Math.cos(rotation), rx * Math.sin(rotation)) / radians
      for (const critical of [xCritical, xCritical + 180, yCritical, yCritical + 180]) {
        for (let cycle = -3; cycle <= 3; cycle += 1) {
          const fraction = (critical + cycle * 360 - from) / (to - from)
          if (fraction > 0 && fraction < 1) fractions.push(fraction)
        }
      }
      fractions.sort((a, b) => a - b)
      for (const fraction of fractions) {
        this.append(svgPoint(ellipsePoint(center, rx, ry, from + (to - from) * fraction), this.rotation))
      }
    }
    return this
  }

  close(): this {
    this.commands.push('Z')
    this.isClosed = true
    return this
  }

  finish(): PointShapeContour {
    const points = [...this.points]
    if (this.isClosed && points.length > 1 && distance(points[0]!, points.at(-1)!) < 1e-10) points.pop()
    return {
      path: this.commands.join(' '),
      vertices: points,
      closed: this.isClosed,
      bounds: boundsOfPoints(points),
    }
  }

  private append(point: Vec2): void {
    if (!this.points.length || distance(point, this.points.at(-1)!) > 1e-10) this.points.push(point)
  }
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function ellipsePoint(center: Vec2, rx: number, ry: number, angle: number): Vec2 {
  return { x: center.x + rx * Math.cos(angle * radians), y: center.y + ry * Math.sin(angle * radians) }
}

export function polygonContour(vertices: readonly Vec2[], rotation = 0): PointShapeContour {
  const builder = new ShapeContourBuilder(rotation).move(vertices[0]!)
  for (const vertex of vertices.slice(1)) builder.line(vertex)
  return builder.close().finish()
}

export function ellipseContour(rx: number, ry: number, center: Vec2 = { x: 0, y: 0 }, rotation = 0): PointShapeContour {
  return new ShapeContourBuilder(rotation)
    .move(ellipsePoint(center, rx, ry, 0))
    .arc(center, rx, ry, 0, 360)
    .close()
    .finish()
}
