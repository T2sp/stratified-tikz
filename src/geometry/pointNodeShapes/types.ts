import type { PointNodeDimensionField, PointNodeDimensionSource, PointShape, PointShapeParameters, Vec2 } from '../../model/types.ts'

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
  /** Effective emitted pt or inherited raw unit/context sources, consulted only
   * for TeX-domain cylinder classification. Authored model/paint stay intact. */
  dimensionSources?: Partial<Record<PointNodeDimensionField, PointNodeDimensionSource>>
  /** Effective inherited/local flags for the domain guard only. Paint retains
   * the caller's construction parameters; no saved shape state is changed. */
  cylinderDomainParameters?: { borderRotate: number; borderUsesIncircle: boolean }
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

/** PGF construction quantities retain their signs independently of paint bounds. */
export type PointPolygonalFitting =
  | { kind: 'regular polygon'; radius: number }
  | { kind: 'star'; innerRadius: number; outerRadius: number }
  | { kind: 'isosceles triangle'; originalHalfAngle: number; effectiveHalfAngle: number }
  | { kind: 'dart'; tipLength: number; tailLength: number; halfSeparation: number; offset: number;
      tipMiter: Vec2; tailCenterMiter: Vec2; leftTailMiter: Vec2; rightTailMiter: Vec2 }

/** Cylinder construction in unrotated PGF coordinates, relative to the upright
 * text-box center (Y up). Anchor conversion applies rotation and the SVG Y reversal once; paint
 * contours independently transform the same construction in their builder.
 * End/base are declared roles, even when axial fitting folds their x ordering. */
export type PointCylinderFitting = {
  rx: number
  ry: number
  halfLength: number
  bodyExtension: number
  endCenter: Vec2
  baseCenter: Vec2
  beforeTop: Vec2
  afterBottom: Vec2
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
  /** Rectangle/ellipse fitted axes retain PGF's signs; painted bounds are only their ordered envelope. */
  signedFittedAxes?: Vec2
  /** Runtime-only PGF parameters; no saved model or history fields are added. */
  polygonalFitting?: PointPolygonalFitting
  /** Runtime-only signed fitting; never reconstructed from ordered paint bounds. */
  cylinderFitting?: PointCylinderFitting
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
