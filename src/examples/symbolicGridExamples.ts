import {
  createConcatenatedPathStratum,
  createEmptyDiagram,
  createGridStratum,
  createPointStratum,
  createTextLabel,
} from '../model/constructors.ts'
import {
  createNumericScalarInputValue,
  workPlaneGridFrame,
  xyGridFrame,
} from '../model/grids.ts'
import {
  cloneStylePreset,
  curveStylePresets,
  pointStylePresets,
} from '../model/styles.ts'
import type {
  CoordinateComponent,
  CurveStyle,
  Diagram,
  GridParameterRange,
  GridRectangleClip,
  PointStyle,
  SymbolicVariable,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../model/types.ts'

const solidCurveStyle = cloneStylePreset(curveStylePresets[0])
const gridCurveStyle: CurveStyle = {
  ...solidCurveStyle,
  strokeColor: '#4D9DE0',
  strokeOpacity: 0.55,
  lineWidth: 0.5,
}
const highlightedCurveStyle: CurveStyle = {
  ...solidCurveStyle,
  strokeColor: '#C44536',
  lineWidth: 1.3,
}
const filledPointStyle = cloneStylePreset(pointStylePresets[0])
const highlightedPointStyle: PointStyle = {
  ...filledPointStyle,
  color: '#C44536',
  size: 4,
}

export const symbolicCirclePointExample: Diagram =
  createSymbolicCirclePointExample()

export const symbolicPathExample: Diagram = createSymbolicPathExample()

export const twoDimensionalGridExample: Diagram =
  createTwoDimensionalGridExample()

export const threeDimensionalWorkPlaneGridExample: Diagram =
  createThreeDimensionalWorkPlaneGridExample()

export const symbolicGridExampleDiagrams = [
  symbolicCirclePointExample,
  symbolicPathExample,
  twoDimensionalGridExample,
  threeDimensionalWorkPlaneGridExample,
] as const satisfies readonly Diagram[]

function createSymbolicCirclePointExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.variables = symbolicPolarVariables()

  diagram.strata.push(
    createPointStratum({
      ambientDimension: 2,
      id: 'symbolic-orbit-point',
      name: 'Symbolic orbit point',
      style: highlightedPointStyle,
      position: symbolicVec3(
        symbolicComponent('R*cos(q)', Math.SQRT2),
        symbolicComponent('R*sin(q)', Math.SQRT2),
        numericComponent(0),
      ),
      layer: 1,
    }),
  )

  diagram.labels.push(
    createTextLabel({
      ambientDimension: 2,
      id: 'symbolic-orbit-label',
      name: 'Symbolic orbit label',
      text: '$p(q)$',
      position: { x: 1.65, y: 1.65, z: 0 },
      layer: 2,
    }),
  )

  return diagram
}

function createSymbolicPathExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.variables = symbolicPolarVariables()

  diagram.strata.push(
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'symbolic-radius-path',
      name: 'Symbolic radius path',
      style: highlightedCurveStyle,
      segments: [
        {
          kind: 'line',
          start: { x: 0, y: 0, z: 0 },
          end: symbolicVec3(
            symbolicComponent('R*cos(q)', Math.SQRT2),
            symbolicComponent('R*sin(q)', Math.SQRT2),
            numericComponent(0),
          ),
        },
        {
          kind: 'line',
          start: symbolicVec3(
            symbolicComponent('R*cos(q)', Math.SQRT2),
            symbolicComponent('R*sin(q)', Math.SQRT2),
            numericComponent(0),
          ),
          end: symbolicVec3(
            symbolicComponent('R', 2),
            numericComponent(0),
            numericComponent(0),
          ),
        },
      ],
      layer: 1,
    }),
  )

  return diagram
}

function createTwoDimensionalGridExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push(
    createGridStratum({
      ambientDimension: 2,
      id: 'foreach-grid-2d',
      name: '2D foreach grid',
      style: gridCurveStyle,
      frame: xyGridFrame(),
      uRange: gridRange(-2, 2, 0.5),
      vRange: gridRange(-2, 2, 0.5),
      clip: gridClip(-2, 2, -2, 2),
      layer: 0,
    }),
  )

  return diagram
}

function createThreeDimensionalWorkPlaneGridExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata.push(
    createGridStratum({
      ambientDimension: 3,
      id: 'work-plane-grid-3d',
      name: '3D work-plane grid',
      style: gridCurveStyle,
      frame: workPlaneGridFrame(xzFrameAtY(1)),
      uRange: gridRange(-1.5, 1.5, 0.5),
      vRange: gridRange(-1.5, 1.5, 0.5),
      clip: gridClip(-1.5, 1.5, -1.5, 1.5),
      layer: 0,
    }),
  )

  return diagram
}

function symbolicPolarVariables(): SymbolicVariable[] {
  return [
    {
      id: 'symbolic-var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
    {
      id: 'symbolic-var-q',
      name: 'q',
      macroName: 'q',
      expression: '45',
      previewValue: 45,
    },
  ]
}

function gridRange(min: number, max: number, step: number): GridParameterRange {
  return {
    min: createNumericScalarInputValue(min),
    max: createNumericScalarInputValue(max),
    step: createNumericScalarInputValue(step),
  }
}

function gridClip(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
): GridRectangleClip {
  return {
    kind: 'rectangle',
    uMin: createNumericScalarInputValue(uMin),
    uMax: createNumericScalarInputValue(uMax),
    vMin: createNumericScalarInputValue(vMin),
    vMax: createNumericScalarInputValue(vMax),
  }
}

function symbolicVec3(
  x: CoordinateComponent,
  y: CoordinateComponent,
  z: CoordinateComponent,
): Vec3 {
  return {
    x: componentPreviewValue(x),
    y: componentPreviewValue(y),
    z: componentPreviewValue(z),
    symbolic: { x, y, z },
  }
}

function numericComponent(value: number): CoordinateComponent {
  return { kind: 'numeric', value }
}

function symbolicComponent(
  expression: string,
  previewValue: number,
): CoordinateComponent {
  return { kind: 'symbolic', expression, previewValue }
}

function componentPreviewValue(component: CoordinateComponent): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}

function xzFrameAtY(y: number): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y, z: 0 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
  }
}
