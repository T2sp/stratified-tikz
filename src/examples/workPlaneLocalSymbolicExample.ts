import {
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  createTextLabel,
} from '../model/constructors.ts'
import {
  cloneStylePreset,
  curveStylePresets,
  pointStylePresets,
} from '../model/styles.ts'
import type { ScalarInputValue } from '../model/scalarExpressions.ts'
import type {
  CoordinateComponent,
  CurveStyle,
  Diagram,
  PointStyle,
  SymbolicVariable,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from '../model/types.ts'

const localSymbolicFrame: WorkPlaneFrameSnapshot = {
  origin: { x: 0, y: 0, z: 0 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
}

const highlightedCurveStyle: CurveStyle = {
  ...cloneStylePreset(curveStylePresets[0]),
  strokeColor: '#C44536',
  lineWidth: 1.3,
}
const highlightedPointStyle: PointStyle = {
  ...cloneStylePreset(pointStylePresets[0]),
  color: '#C44536',
  size: 4,
}

export const workPlaneLocalSymbolicExample: Diagram =
  createWorkPlaneLocalSymbolicExample()

function createWorkPlaneLocalSymbolicExample(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.variables = symbolicPolarVariables()

  const origin = localSymbolicPoint('0', 0, '0', 0)
  const orbitPoint = localSymbolicPoint(
    'R*cos(q)',
    Math.SQRT2,
    'R*sin(q)',
    Math.SQRT2,
  )

  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 3,
      id: 'local-symbolic-radius-path',
      name: 'Local symbolic radius path',
      style: highlightedCurveStyle,
      points: [origin, orbitPoint],
      arrows: {
        endpoint: 'forward',
        mid: {
          enabled: true,
          position: 0.5,
          direction: 'forward',
          head: 'stealth',
        },
      },
      layer: 0,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'local-symbolic-point',
      name: 'Local symbolic point',
      style: highlightedPointStyle,
      position: orbitPoint,
      layer: 1,
    }),
  )

  diagram.labels.push(
    createTextLabel({
      ambientDimension: 3,
      id: 'local-symbolic-label',
      name: 'Local symbolic label',
      text: '$p(q)$',
      position: localSymbolicPoint(
        'R*cos(q) + 0.25',
        Math.SQRT2 + 0.25,
        'R*sin(q)',
        Math.SQRT2,
      ),
      layer: 2,
    }),
  )

  return diagram
}

function symbolicPolarVariables(): SymbolicVariable[] {
  return [
    {
      id: 'local-symbolic-var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
    {
      id: 'local-symbolic-var-q',
      name: 'q',
      macroName: 'q',
      expression: '45',
      previewValue: 45,
    },
  ]
}

function localSymbolicPoint(
  aExpression: string,
  aPreview: number,
  bExpression: string,
  bPreview: number,
): Vec3 {
  const point = {
    x: aPreview,
    y: 0,
    z: bPreview,
  }
  const source: WorkPlaneLocalCoordinateSource = {
    kind: 'workPlaneLocal',
    frame: localSymbolicFrame,
    local: {
      a: scalarInput(aExpression, aPreview),
      b: scalarInput(bExpression, bPreview),
    },
  }

  return {
    ...point,
    symbolic: {
      x: numericComponent(point.x),
      y: numericComponent(point.y),
      z: numericComponent(point.z),
      source,
    },
  }
}

function scalarInput(
  expression: string,
  previewValue: number,
): ScalarInputValue {
  const numericValue = Number(expression)

  return Number.isFinite(numericValue) && String(numericValue) === expression
    ? {
        kind: 'numeric',
        value: numericValue,
      }
    : {
        kind: 'symbolic',
        expression,
        previewValue,
      }
}

function numericComponent(value: number): CoordinateComponent {
  return { kind: 'numeric', value }
}
