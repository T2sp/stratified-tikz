import {
  createCurveStratum,
  createCurvedSheetStratum,
  createEmptyDiagram,
  createFilledRegion2DStratum,
  createPointStratum,
  createTextLabel,
} from '../model/constructors.ts'
import { symbolicGridExampleDiagrams } from './symbolicGridExamples.ts'
import {
  cloneStylePreset,
  curveStylePresets,
  pointStylePresets,
  regionStylePresets,
  sheetStylePresets,
} from '../model/styles.ts'
import type {
  ClosedPathBoundary,
  CurveStyle,
  Diagram,
  PointStyle,
  SurfaceFrame,
  Vec3,
} from '../model/types.ts'

const xySurfaceFrame: SurfaceFrame = {
  origin: { x: 0, y: 0, z: 0 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
}

const blueRegionStyle = cloneStylePreset(regionStylePresets[0])
const redRegionStyle = cloneStylePreset(regionStylePresets[1])
const blueSheetStyle = cloneStylePreset(sheetStylePresets[0])
const redSheetStyle = cloneStylePreset(sheetStylePresets[1])
const solidCurveStyle = cloneStylePreset(curveStylePresets[0])
const dottedCurveStyle = cloneStylePreset(curveStylePresets[1])
const filledPointStyle = cloneStylePreset(pointStylePresets[0])
const hollowPointStyle = cloneStylePreset(pointStylePresets[1])

export const translucentFilledStrataExample: Diagram =
  createTranslucentFilledStrataExample()

export const hemispherePatchExample: Diagram = createHemispherePatchExample()

export const saddlePatchExample: Diagram = createSaddlePatchExample()

export const evenOddFilledBoundaryExample: Diagram =
  createEvenOddFilledBoundaryExample()

export const referenceExampleDiagrams = [
  translucentFilledStrataExample,
  hemispherePatchExample,
  saddlePatchExample,
  evenOddFilledBoundaryExample,
  ...symbolicGridExampleDiagrams,
] as const satisfies readonly Diagram[]

function createTranslucentFilledStrataExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push(
    createFilledRegion2DStratum({
      id: 'reference-blue-region',
      name: 'Blue translucent region',
      style: blueRegionStyle,
      boundaries: [lensBoundary2D('blue-region-boundary')],
      layer: 0,
    }),
    createFilledRegion2DStratum({
      id: 'reference-red-region',
      name: 'Red translucent region',
      style: redRegionStyle,
      boundaries: [
        polygonBoundary2D('red-region-boundary', [
          vec3(-0.6, -1.2),
          vec3(2.2, -0.75),
          vec3(1.65, 1.25),
          vec3(-1.25, 0.95),
        ]),
      ],
      layer: 1,
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'reference-solid-curve',
      name: 'Solid reference curve',
      style: solidCurveStyle,
      points: [
        vec3(-2.35, -0.15),
        vec3(-0.9, 0.45),
        vec3(0.4, 0.05),
        vec3(2.45, 0.65),
      ],
      layer: 2,
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'reference-dotted-curve',
      name: 'Dotted overlap curve',
      style: dottedCurveStyle,
      points: [
        vec3(-2.2, 0.9),
        vec3(-0.6, 0.15),
        vec3(0.8, 0.58),
        vec3(2.15, -0.55),
      ],
      layer: 3,
    }),
    createPointStratum({
      ambientDimension: 2,
      id: 'reference-filled-point',
      name: 'Filled endpoint',
      style: filledPointStyle,
      position: vec3(-0.9, 0.45),
      layer: 4,
    }),
    createPointStratum({
      ambientDimension: 2,
      id: 'reference-hollow-point',
      name: 'Hollow endpoint',
      style: hollowPointStyle,
      position: vec3(0.8, 0.58),
      layer: 5,
    }),
  )

  diagram.labels.push(
    createTextLabel({
      ambientDimension: 2,
      id: 'reference-region-label',
      name: 'Region label',
      text: '$A$',
      position: vec3(-1.35, -0.55),
      layer: 6,
    }),
    createTextLabel({
      ambientDimension: 2,
      id: 'reference-curve-label',
      name: 'Curve label',
      text: '$f$',
      position: vec3(1.45, 0.92),
      layer: 6,
    }),
  )

  return diagram
}

function createHemispherePatchExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata.push(
    createCurvedSheetStratum({
      id: 'hemisphere-reference-sheet',
      name: 'Hemisphere patch',
      style: blueSheetStyle,
      primitive: {
        kind: 'hemisphere',
        center: vec3(0, 0, 0),
        radius: 1.4,
        frame: xySurfaceFrame,
        hemisphereSide: 'positive',
        sampling: { uSegments: 8, vSegments: 4 },
      },
      layer: 0,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'hemisphere-rim-path',
      name: 'Hemisphere rim path',
      style: solidCurveStyle,
      points: circlePolylinePoints(1.4, 0, 12),
      layer: 1,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'hemisphere-hidden-meridian',
      name: 'Hidden meridian',
      style: dottedCurveStyle,
      points: [
        vec3(-1.4, 0, 0),
        vec3(-0.72, 0, 1.2),
        vec3(0, 0, 1.4),
        vec3(0.72, 0, 1.2),
        vec3(1.4, 0, 0),
      ],
      layer: 2,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'hemisphere-top-point',
      name: 'Apex point',
      style: filledPointStyle,
      position: vec3(0, 0, 1.4),
      layer: 3,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'hemisphere-rim-point',
      name: 'Rim point',
      style: hollowPointStyle,
      position: vec3(1.4, 0, 0),
      layer: 3,
    }),
  )

  diagram.labels.push(
    createTextLabel({
      ambientDimension: 3,
      id: 'hemisphere-sheet-label',
      name: 'Hemisphere sheet label',
      text: '$H$',
      position: vec3(-0.95, -0.95, 0.75),
      layer: 4,
    }),
    createTextLabel({
      ambientDimension: 3,
      id: 'hemisphere-path-label',
      name: 'Hemisphere path label',
      text: '$\\gamma$',
      position: vec3(0.35, 0, 1.62),
      layer: 4,
    }),
  )

  return diagram
}

function createSaddlePatchExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const saddleCurveStyle: CurveStyle = {
    ...solidCurveStyle,
    strokeColor: '#1A1A1A',
  }
  const saddlePointStyle: PointStyle = {
    ...filledPointStyle,
    size: 3.4,
  }

  diagram.strata.push(
    createCurvedSheetStratum({
      id: 'saddle-reference-sheet',
      name: 'Saddle patch',
      style: redSheetStyle,
      primitive: {
        kind: 'saddle',
        frame: xySurfaceFrame,
        width: 4,
        depth: 3,
        height: 0.8,
        sampling: { uSegments: 6, vSegments: 5 },
      },
      layer: 0,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'saddle-solid-diagonal',
      name: 'Solid saddle diagonal',
      style: saddleCurveStyle,
      points: [
        vec3(-2, -1.5, 0.8),
        vec3(-1, -0.75, 0.2),
        vec3(0, 0, 0),
        vec3(1, 0.75, 0.2),
        vec3(2, 1.5, 0.8),
      ],
      layer: 1,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'saddle-dotted-diagonal',
      name: 'Dotted saddle diagonal',
      style: dottedCurveStyle,
      points: [
        vec3(-2, 1.5, -0.8),
        vec3(-1, 0.75, -0.2),
        vec3(0, 0, 0),
        vec3(1, -0.75, -0.2),
        vec3(2, -1.5, -0.8),
      ],
      layer: 2,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'saddle-center-point',
      name: 'Saddle center point',
      style: saddlePointStyle,
      position: vec3(0, 0, 0),
      layer: 3,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'saddle-corner-point',
      name: 'Saddle corner point',
      style: hollowPointStyle,
      position: vec3(2, 1.5, 0.8),
      layer: 3,
    }),
  )

  diagram.labels.push(
    createTextLabel({
      ambientDimension: 3,
      id: 'saddle-sheet-label',
      name: 'Saddle sheet label',
      text: '$S$',
      position: vec3(-1.75, -1.35, 0.95),
      layer: 4,
    }),
    createTextLabel({
      ambientDimension: 3,
      id: 'saddle-center-label',
      name: 'Saddle center label',
      text: '$p$',
      position: vec3(0.2, 0.15, 0.35),
      layer: 4,
    }),
  )

  return diagram
}

function createEvenOddFilledBoundaryExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push(
    createFilledRegion2DStratum({
      id: 'even-odd-annulus',
      name: 'Even-odd annulus',
      style: blueRegionStyle,
      boundaries: [
        polygonBoundary2D('outer-boundary', [
          vec3(-2, -1.6),
          vec3(2, -1.6),
          vec3(2, 1.6),
          vec3(-2, 1.6),
        ]),
        polygonBoundary2D('inner-boundary', [
          vec3(-0.85, -0.55),
          vec3(0.85, -0.55),
          vec3(0.85, 0.55),
          vec3(-0.85, 0.55),
        ]),
      ],
      fillRule: 'evenOdd',
      layer: 0,
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'even-odd-boundary-curve',
      name: 'Boundary curve',
      style: solidCurveStyle,
      points: [
        vec3(-2, -1.6),
        vec3(2, -1.6),
        vec3(2, 1.6),
        vec3(-2, 1.6),
        vec3(-2, -1.6),
      ],
      layer: 1,
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'even-odd-inner-dotted-curve',
      name: 'Inner dotted boundary',
      style: dottedCurveStyle,
      points: [
        vec3(-0.85, -0.55),
        vec3(0.85, -0.55),
        vec3(0.85, 0.55),
        vec3(-0.85, 0.55),
        vec3(-0.85, -0.55),
      ],
      layer: 2,
    }),
    createPointStratum({
      ambientDimension: 2,
      id: 'even-odd-marked-point',
      name: 'Marked boundary point',
      style: filledPointStyle,
      position: vec3(2, 1.6),
      layer: 3,
    }),
  )

  diagram.labels.push(
    createTextLabel({
      ambientDimension: 2,
      id: 'even-odd-label',
      name: 'Even-odd label',
      text: 'even odd',
      position: vec3(0, 1.95),
      layer: 4,
    }),
    createTextLabel({
      ambientDimension: 2,
      id: 'hole-label',
      name: 'Hole label',
      text: '$\\emptyset$',
      position: vec3(0, 0),
      layer: 4,
    }),
  )

  return diagram
}

function lensBoundary2D(id: string): ClosedPathBoundary {
  return {
    id,
    segments: [
      {
        kind: 'cubicBezier',
        start: vec3(-2.15, -0.55),
        control1: vec3(-1.35, 1.35),
        control2: vec3(1.25, 1.25),
        end: vec3(2.1, -0.45),
      },
      {
        kind: 'cubicBezier',
        start: vec3(2.1, -0.45),
        control1: vec3(1.1, -1.4),
        control2: vec3(-1.15, -1.35),
        end: vec3(-2.15, -0.55),
      },
    ],
  }
}

function polygonBoundary2D(
  id: string,
  points: [Vec3, Vec3, Vec3, ...Vec3[]],
): ClosedPathBoundary {
  return {
    id,
    segments: points.map((point, index) => ({
      kind: 'line',
      start: point,
      end: points[(index + 1) % points.length],
    })),
  }
}

function circlePolylinePoints(radius: number, z: number, segments: number): Vec3[] {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2

    return vec3(radius * Math.cos(angle), radius * Math.sin(angle), z)
  })
}

function vec3(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}
