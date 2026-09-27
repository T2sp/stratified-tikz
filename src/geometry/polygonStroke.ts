import type { Vec2 } from '../model/types.ts'

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

/** A union, not an outline: wide edge strips may overlap other edges/joins. */
export type PolygonStrokeRegion = {
  polygons: Vec2[][]
  disks: { center: Vec2; radius: number }[]
  bounds: Bounds | null
  radius: number
}

/**
 * Solid closed SVG stroke in path-local units. Each edge contributes a butt
 * strip; only the outside of each local turn needs a join. In particular a
 * concave corner uses the opposite side from its neighboring convex corners.
 * No polygon clipping/intersection work is needed to measure this union.
 */
export function createPolygonStrokeRegion(
  input: readonly Vec2[], width: number, lineJoin: 'miter' | 'bevel' | 'round', miterLimit = 10,
): PolygonStrokeRegion {
  const region: PolygonStrokeRegion = { polygons: [], disks: [], bounds: null, radius: 0 }
  if (!Number.isFinite(width) || width <= 0) return region
  const vertices: Vec2[] = []
  for (const point of input) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return region
    const previous = vertices.at(-1)
    if (!previous || point.x !== previous.x || point.y !== previous.y) vertices.push(point)
  }
  if (vertices.length > 1 && vertices[0].x === vertices.at(-1)!.x
    && vertices[0].y === vertices.at(-1)!.y) vertices.pop()
  if (vertices.length < 2) return region

  const half = width / 2
  const directions = vertices.map((start, index) => {
    const end = vertices[(index + 1) % vertices.length]
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    return { x: (end.x - start.x) / length, y: (end.y - start.y) / length }
  })
  if (directions.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return region
  const offset = (point: Vec2, normal: Vec2, sign: number): Vec2 =>
    ({ x: point.x + sign * normal.x * half, y: point.y + sign * normal.y * half })
  const normals = directions.map(({ x, y }) => ({ x: -y, y: x }))
  for (let index = 0; index < vertices.length; index++) {
    const vertex = vertices[index]
    const next = vertices[(index + 1) % vertices.length]
    const normal = normals[index]
    region.polygons.push([offset(vertex, normal, 1), offset(next, normal, 1),
      offset(next, normal, -1), offset(vertex, normal, -1)])
    if (lineJoin === 'round') {
      // The strips already cover the inner part of this disk. Its remaining
      // sector is exactly the round join, even at reflex/reversing corners.
      region.disks.push({ center: vertex, radius: half })
      continue
    }
    const previousIndex = (index + vertices.length - 1) % vertices.length
    const incoming = directions[previousIndex]
    const outgoing = directions[index]
    const turn = incoming.x * outgoing.y - incoming.y * outgoing.x
    if (turn === 0) continue // Straight/reversing bevels add no area.
    const sign = turn > 0 ? -1 : 1
    const previousNormal = normals[previousIndex]
    const first = offset(vertex, previousNormal, sign)
    const last = offset(vertex, normal, sign)
    const join = [vertex, first]
    const bisector = { x: previousNormal.x + normal.x, y: previousNormal.y + normal.y }
    const length = Math.hypot(bisector.x, bisector.y)
    // SVG's miter ratio is 1 / sin(interiorAngle/2). A rejected miter
    // becomes a bevel; it does not remove the bevel wedge as well.
    const ratio = length > 0 ? 2 / length : Infinity
    if (lineJoin === 'miter' && ratio <= miterLimit) {
      join.push({ x: vertex.x + sign * bisector.x / length * half * ratio,
        y: vertex.y + sign * bisector.y / length * half * ratio })
    }
    join.push(last)
    region.polygons.push(join)
  }
  const include = (x: number, y: number) => {
    if (!region.bounds) region.bounds = { minX: x, minY: y, maxX: x, maxY: y }
    else {
      region.bounds.minX = Math.min(region.bounds.minX, x)
      region.bounds.minY = Math.min(region.bounds.minY, y)
      region.bounds.maxX = Math.max(region.bounds.maxX, x)
      region.bounds.maxY = Math.max(region.bounds.maxY, y)
    }
  }
  for (const polygon of region.polygons) for (const { x, y } of polygon) {
    include(x, y)
    region.radius = Math.max(region.radius, Math.hypot(x, y))
  }
  for (const { center, radius } of region.disks) {
    include(center.x - radius, center.y - radius)
    include(center.x + radius, center.y + radius)
    region.radius = Math.max(region.radius, Math.hypot(center.x, center.y) + radius)
  }
  return region
}

/** Euclidean distance to the union (zero on paint), independent of its box. */
export function distanceToPolygonStroke(point: Vec2, region: PolygonStrokeRegion): number {
  let distance = Infinity
  for (const polygon of region.polygons) {
    let inside = false
    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy)
      const along = length === 0 ? 0 : Math.max(0, Math.min(length,
        (point.x - start.x) * (dx / length) + (point.y - start.y) * (dy / length)))
      distance = Math.min(distance, Math.hypot(point.x - start.x - (length ? dx / length * along : 0),
        point.y - start.y - (length ? dy / length * along : 0)))
      if ((start.y > point.y) !== (end.y > point.y)
        && point.x < start.x + (point.y - start.y) / dy * dx) inside = !inside
    }
    if (inside || distance === 0) return 0
  }
  for (const { center, radius } of region.disks) {
    distance = Math.min(distance, Math.max(0, Math.hypot(point.x - center.x, point.y - center.y) - radius))
  }
  return distance
}
