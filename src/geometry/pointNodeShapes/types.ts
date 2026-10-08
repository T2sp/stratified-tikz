import type { PointShape, PointShapeParameters, Vec2 } from '../../model/types.ts'

export type PointShapeBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** All lengths use one caller-selected unit (normally SVG units or TeX pt). */
export type PointNodeShapeInput = {
  shape: PointShape
  body: { width: number; height: number; depth: number; originX?: number }
  innerXSep: number
  innerYSep: number
  outerXSep: number
  outerYSep: number
  minimumWidth: number
  minimumHeight: number
  /** Cylinder axial fitting depends on PGF's current line width, even without draw. */
  lineWidth?: number
  /** Geometry units per TeX point; preserves PGF fixed-point minimum arithmetic. */
  unitScale?: number
  /** Dimensional parameters, particularly starPointHeight, use the same unit. */
  parameters?: PointShapeParameters
  /** Placement anchor; preserved source is diagnosed when unsupported. */
  anchor?: string
  /** Current font dimensions, in the same geometry units (used by mid anchors). */
  fontContext?: { em: number; ex: number }
}

export type PointShapeContour = {
  /** True SVG arcs retain the curved boundary rather than painting a polygon. */
  path: string
  /** Bounded adaptive boundary samples for the shared native picking path. */
  vertices: Vec2[]
  closed: boolean
  bounds: PointShapeBounds
}

export type PointShapePaintRegion = PointShapeContour & {
  role: 'body' | 'end'
}

export type PointNodeShapeSolution = {
  /** The outer closed contour is first; cylinder adds its open end seam. */
  contours: PointShapeContour[]
  /** Cylinder supplies two independent regions; ordinary shapes supply one. */
  paintRegions: PointShapePaintRegion[]
  bounds: PointShapeBounds
  bodyBounds: PointShapeBounds
  /** Top-left origin; upright glyphs are never transformed with the border. */
  bodyOrigin: Vec2
  /** SVG y coordinate of the baseline, relative to the body-center node anchor. */
  baseline: number
  /** Clearance is separate from the path and paint and is never a hit region. */
  anchorBounds: PointShapeBounds
  /** Supported named anchors, relative to the upright text-box center, SVG y down. */
  anchors: Readonly<Record<string, Vec2>>
  placementAnchor: Vec2
  anchorDiagnostic?: string
  textCenter: Vec2
  shapeCenter: Vec2
  /** Effective PGF border angle, in degrees (possibly rounded). */
  rotation: number
  radius: number
}

export type PointNodeAnchorResolution = {
  supported: boolean
  position: Vec2
  diagnostic?: string
}
