import type { PointStyle, Vec2 } from '../model/types'

export type SvgPointNodeContentSize = {
  width: number
  /** The complete text box height, including any depth below its baseline. */
  height: number
}

export type SvgPointNodeBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type SvgPointNodeGeometry = {
  kind: 'circle' | 'polygon'
  /** The outer radius also encloses polygons, for selection highlighting. */
  radius: number
  /** Polygon vertices relative to the node center, with SVG's downward y axis. */
  vertices: Vec2[]
  /** Bounds of the shape path; stroke width and outer sep are not included. */
  bounds: SvgPointNodeBounds
  contentBounds: SvgPointNodeBounds
  innerSep: number
}

/** Keep the existing 12-unit preview text at the default TeX size of 10pt. */
export const svgPointNodeTexPointScale = 1.2

/**
 * Match the shapes emitted by pointShapeOptions in the TikZ generator.
 * Content measurements and the returned geometry use SVG units; style.size
 * remains in TeX points. Outer sep affects PGF anchors, not the drawn shape.
 */
export function svgPointNodeGeometry(
  style: Pick<PointStyle, 'shape' | 'size'>,
  contentSize: SvgPointNodeContentSize,
  texPointScale = svgPointNodeTexPointScale,
): SvgPointNodeGeometry {
  const scale =
    Number.isFinite(texPointScale) && texPointScale > 0
      ? texPointScale
      : svgPointNodeTexPointScale
  const halfWidth = nonnegativeFinite(contentSize.width) / 2
  const halfHeight = nonnegativeFinite(contentSize.height) / 2
  const innerSep = (nonnegativeFinite(style.size) * scale) / 2
  const paddedHalfWidth = halfWidth + innerSep
  const paddedHalfHeight = halfHeight + innerSep
  const minimumRadius = 0.5 * scale
  const contentBounds = centeredBounds(halfWidth, halfHeight)

  if (style.shape === 'circle') {
    // PGF's circle encloses every corner of the padded text rectangle.
    const radius = Math.max(
      Math.hypot(paddedHalfWidth, paddedHalfHeight),
      minimumRadius,
    )

    return {
      kind: 'circle',
      radius,
      vertices: [],
      bounds: centeredBounds(radius, radius),
      contentBounds,
      innerSep,
    }
  }

  // pgflibraryshapes.geometric.code.tex uses sqrt(2) * max(x, y),
  // rather than hypot(x, y), for regular polygon and star node radii.
  const innerRadius = Math.SQRT2 * Math.max(paddedHalfWidth, paddedHalfHeight)
  let radius: number
  let vertices: Vec2[]

  if (style.shape === 'star') {
    // PGF initializes starouterradiususesratio=true. Its default ratio is 1.5;
    // the stored default star point height is inactive until explicitly set.
    radius = Math.max(innerRadius * 1.5, minimumRadius)
    vertices = Array.from({ length: 10 }, (_, index) =>
      polarVertex(
        index % 2 === 0 ? radius : radius / 1.5,
        -Math.PI / 2 - (index * Math.PI) / 5,
      ),
    )
  } else {
    // "square" exports as regular polygon sides=4, not as a rectangle.
    const sides = style.shape === 'square' ? 4 : 3
    radius = Math.max(innerRadius / Math.cos(Math.PI / sides), minimumRadius)
    const startAngle = sides === 4 ? -Math.PI / 4 : -Math.PI / 2
    vertices = Array.from({ length: sides }, (_, index) =>
      polarVertex(radius, startAngle - (index * Math.PI * 2) / sides),
    )
  }

  return {
    kind: 'polygon',
    radius,
    vertices,
    bounds: {
      minX: Math.min(...vertices.map((vertex) => vertex.x)),
      minY: Math.min(...vertices.map((vertex) => vertex.y)),
      maxX: Math.max(...vertices.map((vertex) => vertex.x)),
      maxY: Math.max(...vertices.map((vertex) => vertex.y)),
    },
    contentBounds,
    innerSep,
  }
}

function centeredBounds(
  halfWidth: number,
  halfHeight: number,
): SvgPointNodeBounds {
  return {
    minX: -halfWidth,
    minY: -halfHeight,
    maxX: halfWidth,
    maxY: halfHeight,
  }
}

function polarVertex(radius: number, angle: number): Vec2 {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
}

function nonnegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
