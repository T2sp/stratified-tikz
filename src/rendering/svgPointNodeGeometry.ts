import type { PointStyle, Vec2 } from '../model/types'
import { solvePointNodeShape, type PointNodeShapeSolution } from '../geometry/pointNodeShapes/index.ts'
import { resolvePointShapeParameters } from '../model/pointShapeParameters.ts'

export type SvgPointNodeContentSize = {
  width: number
  /** The complete text box height, including any depth below its baseline. */
  height: number
  /** Depth below the measured first baseline, in the same units. */
  depth?: number
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
  /** Present for the geometric solver path, shared by live/export/hit layout. */
  solution?: PointNodeShapeSolution
  /** Explicit bounded-preview failure; the model and raw TikZ intent survive. */
  limitation?: string
}

/** Keep the existing 12-unit preview text at the default TeX size of 10pt. */
export const svgPointNodeTexPointScale = 1.2

/**
 * Match the shapes emitted by pointShapeOptions in the TikZ generator.
 * Content measurements and the returned geometry use SVG units; style.size
 * remains in TeX points. Outer sep affects PGF anchors, not the drawn shape.
 */
export function svgPointNodeGeometry(
  style: Pick<PointStyle, 'shape' | 'size' | 'shapeParameters'>,
  contentSize: SvgPointNodeContentSize,
  texPointScale = svgPointNodeTexPointScale,
  lineWidth = 0.4 * texPointScale,
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

  // Preserve the accepted empty/default legacy contours, including their exact
  // vertex order and floating-point dash perimeter. New parameters use PGF's
  // shape-specific solver rather than generic bounding-box scaling.
  const parameters = resolvePointShapeParameters(style.shapeParameters)
  const legacy = style.shape === 'circle'
    || (parameters.borderRotate === 0 && (style.shape === 'square' || style.shape === 'triangle'
      || (style.shape === 'star' && parameters.starPoints === 5
        && parameters.starPointMode === 'ratio' && parameters.starPointRatio === 1.5)))
  if (!legacy) {
    const depth = Math.min(nonnegativeFinite(contentSize.depth ?? 0), 2 * halfHeight)
    try {
      const solution = solvePointNodeShape({ shape: style.shape, unitScale: scale,
        body: { width: 2 * halfWidth, height: 2 * halfHeight - depth, depth },
        innerXSep: innerSep, innerYSep: innerSep, outerXSep: lineWidth / 2, outerYSep: lineWidth / 2,
        minimumWidth: scale, minimumHeight: scale, lineWidth,
        parameters: { ...parameters, starPointHeight: parameters.starPointHeight * scale },
      })
      return { kind: 'polygon', radius: solution.radius, vertices: solution.contours[0].vertices,
        bounds: solution.bounds, contentBounds: solution.bodyBounds, innerSep, solution }
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      // Keep the upright body selectable; this rectangle is a body hit region,
      // never rendered as the requested shape or exported as invented TikZ.
      const bounds = { ...contentBounds, minX: Math.min(contentBounds.minX, -5),
        minY: Math.min(contentBounds.minY, -8), maxX: Math.max(contentBounds.maxX, 5),
        maxY: Math.max(contentBounds.maxY, 8) }
      const vertices = [{ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY }]
      return { kind: 'polygon', vertices, bounds, contentBounds, innerSep,
        radius: Math.max(...vertices.map(({ x, y }) => Math.hypot(x, y))), limitation: error.message }
    }
  }

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
