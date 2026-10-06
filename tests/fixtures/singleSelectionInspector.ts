import {
  createCurvedSheetStratum,
  createEmptyDiagram,
  createFilledRegion2DStratum,
  createGridStratum,
  createPointStratum,
  createRegionStratum,
  createSheetStratum,
  createTemplatePathStratum,
  createTextLabel,
  createWorkPlaneFilledSheet3DStratum,
} from '../../src/model/constructors.ts'
import { createNumericScalarInputValue, xyGridFrame } from '../../src/model/grids.ts'
import { ensureLayerMetadata } from '../../src/model/layers.ts'
import { defaultPointStyle, defaultRegionStyle, defaultSheetStyle } from '../../src/model/styles.ts'
import { pointShapes } from '../../src/model/types.ts'
import type {
  BoundaryPathSnapshot,
  ClosedPathBoundary,
  Diagram,
  PointShape,
  PointStyle,
  Stratum,
  TextLabel,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import type { SingleSelectedElement } from '../../src/ui/selection.ts'

export type SingleSelectionInspectorCase = {
  name: string
  diagram: Diagram
  selection: SingleSelectedElement
  targetName: 'point' | 'path' | 'sheet' | 'region' | 'free text label'
  movable: boolean
  coons?: boolean
}

/** Fresh, small models for shared Inspector SSR and actual App interaction checks. */
export function createSingleSelectionInspectorCases(): SingleSelectionInspectorCase[] {
  const cases: SingleSelectionInspectorCase[] = []
  for (const ambientDimension of [2, 3] as const) {
    for (const shape of pointShapes) {
      cases.push(oneObjectCase(
        `${ambientDimension}D point ${shape}`,
        ambientDimension,
        createPointStratum({
          ambientDimension,
          id: 'point',
          name: `${shape} point`,
          text: 'A $x$',
          position: point(0, 0),
          style: pointStyle(shape),
        }),
        'point',
      ))
    }
    cases.push(oneObjectCase(
      `${ambientDimension}D free text label`,
      ambientDimension,
      createTextLabel({
        ambientDimension,
        id: 'free-label',
        text: 'A $x$',
        position: point(0, 0),
        style: { kind: 'labelStyle', color: '#123456', opacity: .8, fontSize: 12, anchor: 'center' },
      }),
      'free text label',
    ))

    for (const templateKind of ['circleTemplate', 'ellipseTemplate'] as const) {
      cases.push(oneObjectCase(
        `${ambientDimension}D ${templateKind}`,
        ambientDimension,
        createTemplatePathStratum({
          ambientDimension,
          id: 'template-path',
          pathLabel: 'template source',
          template: templateKind === 'circleTemplate'
            ? { kind: templateKind, center: point(0, 0), radius: 1, frame: xyFrame() }
            : { kind: templateKind, center: point(0, 0), radiusX: 1, radiusY: .6, rotationDeg: 17, frame: xyFrame() },
        }),
        'path',
      ))
    }

    for (const latticePattern of ['rectangular', 'honeycomb'] as const) {
      cases.push(oneObjectCase(
        `${ambientDimension}D ${latticePattern} grid`,
        ambientDimension,
        createGridStratum({
          ambientDimension,
          id: 'grid',
          latticePattern,
          pathLabel: 'grid source',
          frame: ambientDimension === 2 ? xyGridFrame() : { kind: 'workPlane', frame: xyFrame() },
          uRange: { min: scalar(-1), max: scalar(1), step: scalar(.5) },
          vRange: { min: scalar(-1), max: scalar(1), step: scalar(.5) },
          clip: { kind: 'rectangle', uMin: scalar(-1), uMax: scalar(1), vMin: scalar(-1), vMax: scalar(1) },
        }),
        'path',
      ))
    }

    for (const representation of ['legacy', 'explicit'] as const) {
      const ambient = createRegionStratum({
        ambientDimension,
        id: 'ambient',
        name: `${representation} ambient region`,
        style: { ...defaultRegionStyle, fillColor: '#C4DCF4', fillOpacity: .2 },
      })
      cases.push(oneObjectCase(
        `${ambientDimension}D ${representation} ambient region`,
        ambientDimension,
        representation === 'explicit' ? { ...ambient, kind: 'ambientRegion' } : ambient,
        'region',
        false,
      ))
    }
  }

  cases.push(oneObjectCase(
    '2D filled region', 2,
    createFilledRegion2DStratum({
      id: 'filled-region',
      boundaries: [rectangleBoundary()],
      style: { ...defaultRegionStyle, fillColor: '#C4DCF4', fillOpacity: .4, strokeColor: '#123456', strokeOpacity: 1, lineWidth: 1.2 },
    }),
    'region',
  ))
  cases.push(oneObjectCase(
    '3D quad sheet', 3,
    createSheetStratum({ ambientDimension: 3, id: 'quad-sheet', corners: [point(-1, -1), point(1, -1), point(1, 1), point(-1, 1)] }),
    'sheet',
  ))
  cases.push(oneObjectCase(
    '3D polygon sheet', 3,
    { id: 'polygon-sheet', geometricKind: 'sheet', codim: 1, kind: 'polygonSheet', name: 'Polygon sheet', layer: 0, style: { ...defaultSheetStyle }, pathLabel: 'polygon source', vertices: [point(-1, -1), point(1, -1), point(.7, 1), point(-.7, 1)] },
    'sheet',
  ))
  cases.push(oneObjectCase(
    '3D work-plane filled sheet', 3,
    createWorkPlaneFilledSheet3DStratum({ id: 'work-plane-sheet', planeFrame: xyFrame(), boundaries: [rectangleBoundary()] }),
    'sheet',
  ))
  cases.push(oneObjectCase(
    '3D hemisphere sheet', 3,
    createCurvedSheetStratum({ id: 'hemisphere-sheet', primitive: { kind: 'hemisphere', center: point(0, 0), radius: 1, frame: xyFrame(), hemisphereSide: 'positive', sampling: { uSegments: 6, vSegments: 3 } } }),
    'sheet',
  ))
  cases.push(oneObjectCase(
    '3D saddle sheet', 3,
    createCurvedSheetStratum({ id: 'saddle-sheet', primitive: { kind: 'saddle', frame: xyFrame(), width: 2, depth: 2, height: .5, sampling: { uSegments: 4, vSegments: 4 } } }),
    'sheet',
  ))
  cases.push(oneObjectCase(
    '3D ruled surface sheet', 3,
    createCurvedSheetStratum({ id: 'ruled-sheet', primitive: { kind: 'ruledSurface', boundary0: lineBoundary('bottom', point(-1, -1), point(1, -1)), boundary1: lineBoundary('top', point(-1, 1, .4), point(1, 1, .4)), sampling: { segments: 4 } } }),
    'sheet',
  ))
  cases.push({
    ...oneObjectCase(
      '3D static Coons patch control', 3,
      createCurvedSheetStratum({
        id: 'coons-patch',
        primitive: {
          kind: 'coonsPatch',
          bottom: lineBoundary('bottom', point(-1, -1), point(1, -1)),
          right: lineBoundary('right', point(1, -1), point(1, 1)),
          top: lineBoundary('top', point(-1, 1), point(1, 1)),
          left: lineBoundary('left', point(-1, -1), point(-1, 1)),
          sampling: { uSegments: 3, vSegments: 3 },
        },
      }),
      'sheet',
    ),
    coons: true,
  })
  return cases
}

function oneObjectCase(
  name: string,
  ambientDimension: 2 | 3,
  object: Stratum | TextLabel,
  targetName: SingleSelectionInspectorCase['targetName'],
  movable = true,
): SingleSelectionInspectorCase {
  const diagram = ensureLayerMetadata({
    ...createEmptyDiagram({ ambientDimension }),
    strata: object.geometricKind === 'label' ? [] : [object],
    labels: object.geometricKind === 'label' ? [object] : [],
  })
  return { name, diagram, selection: { kind: object.geometricKind === 'label' ? 'label' : 'stratum', id: object.id }, targetName, movable }
}

function pointStyle(shape: PointShape): PointStyle {
  return {
    ...defaultPointStyle,
    shape,
    size: 12,
    opacity: .9,
    shapeParameters: { aspect: 1.3, borderRotate: 17, regularPolygonSides: 6, starPoints: 6, starPointRatio: 2, isoscelesTriangleApexAngle: 55, kiteUpperVertexAngle: 110, dartTipAngle: 40, dartTailAngle: 140, circularSectorAngle: 80, cylinderUsesCustomFill: true, cylinderEndFill: '#88CCEE', cylinderBodyFill: '#CCEEFF' },
    paint: {
      text: { color: '#123456', opacity: .9 },
      fill: { enabled: true, color: '#DDEEFF', opacity: .6 },
      stroke: { enabled: true, color: '#336699', opacity: .9, width: 1.5, lineStyle: 'solid', dashPhase: 0, lineCap: 'round', lineJoin: 'bevel' },
    },
  }
}

function point(x: number, y: number, z = 0): Vec3 { return { x, y, z } }
function scalar(value: number) { return createNumericScalarInputValue(value) }
function xyFrame(): WorkPlaneFrameSnapshot { return { origin: point(0, 0), u: point(1, 0), v: point(0, 1), normal: point(0, 0, 1) } }
function lineBoundary(id: string, start: Vec3, end: Vec3): BoundaryPathSnapshot { return { id, segments: [{ kind: 'line', start, end }] } }
function rectangleBoundary(): ClosedPathBoundary {
  return { id: 'boundary', segments: [
    { kind: 'line', start: point(-1, -1), end: point(1, -1) },
    { kind: 'line', start: point(1, -1), end: point(1, 1) },
    { kind: 'line', start: point(1, 1), end: point(-1, 1) },
    { kind: 'line', start: point(-1, 1), end: point(-1, -1) },
  ] }
}
