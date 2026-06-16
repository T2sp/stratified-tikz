import {
  absoluteCubicBezierPointsFromControlMode,
  relativeCartesianControlModeFromPoints,
  relativePolarControlModeFromPoints,
} from '../../geometry/bezierControls.ts'
import type {
  AmbientDimension,
  CubicBezierControlMode,
  CurveStratum,
  Diagram,
  Vec3,
} from '../../model/types.ts'
import {
  type CoordinateAxis,
  updateStratumById,
  updateVec3Coordinate,
} from '../diagramUpdates.ts'
import { describeCurvePoints } from '../inspectorSummary.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import {
  EditableNumberField,
  EditableSelectField,
  ReadOnlyField,
} from './InspectorField.tsx'
import { formatSelectedGeometry } from './geometryPreview.ts'
import type { DiagramChangeHandler } from './types.ts'

type InspectorBezierControlMode = CubicBezierControlMode['kind']

export type CurveGeometryEditorProps = {
  diagram: Diagram
  curve: CurveStratum
  onDiagramChange: DiagramChangeHandler
}

export function CurveGeometryEditor({
  diagram,
  curve,
  onDiagramChange,
}: CurveGeometryEditorProps) {
  const bezierControlMode = curve.bezierControls?.kind ?? 'absolute'

  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        <ReadOnlyField label="Curve kind" value={curve.kind} />
        {curve.kind === 'cubicBezier' && (
          <EditableSelectField
            label="Bezier control mode"
            value={bezierControlMode}
            options={bezierControlModeOptions(diagram.ambientDimension)}
            onChange={(value) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, curve.id, (current) => {
                  if (
                    current.geometricKind !== 'curve' ||
                    current.kind !== 'cubicBezier'
                  ) {
                    return current
                  }

                  return updateCubicBezierControlMode(
                    current,
                    currentDiagram.ambientDimension,
                    value,
                  )
                }),
              )
            }
          />
        )}
        <ReadOnlyField
          label="Style segments"
          value={String(curve.styleSegments.length)}
        />
        {renderCurveCoordinateEditors(curve, diagram, onDiagramChange)}
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(curve, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}

function renderCurveCoordinateEditors(
  curve: CurveStratum,
  diagram: Diagram,
  onDiagramChange: DiagramChangeHandler,
) {
  if (curve.kind !== 'cubicBezier' || curve.points.length !== 4) {
    return describeCurvePoints(curve).map((description, pointIndex) => (
      <AbsoluteCurvePointEditor
        key={`${description.label}-${pointIndex}`}
        diagram={diagram}
        curve={curve}
        label={description.label}
        point={description.point}
        pointIndex={pointIndex}
        onDiagramChange={onDiagramChange}
      />
    ))
  }

  if (curve.bezierControls?.kind === 'relativeCartesian') {
    return [
      <RelativeEndpointEditor
        key="start"
        diagram={diagram}
        curve={curve}
        label="Start"
        pointIndex={0}
        onDiagramChange={onDiagramChange}
      />,
      <CoordinateEditor
        key="first-control-offset"
        label="Control 1 offset from start"
        point={curve.bezierControls.firstControlOffset}
        ambientDimension={diagram.ambientDimension}
        onCoordinateChange={(axis, value) =>
          updateRelativeCartesianOffset(
            diagram,
            curve,
            'firstControlOffset',
            axis,
            value,
            onDiagramChange,
          )
        }
      />,
      <CoordinateEditor
        key="second-control-offset"
        label="Control 2 offset from end"
        point={curve.bezierControls.secondControlOffset}
        ambientDimension={diagram.ambientDimension}
        onCoordinateChange={(axis, value) =>
          updateRelativeCartesianOffset(
            diagram,
            curve,
            'secondControlOffset',
            axis,
            value,
            onDiagramChange,
          )
        }
      />,
      <RelativeEndpointEditor
        key="end"
        diagram={diagram}
        curve={curve}
        label="End"
        pointIndex={3}
        onDiagramChange={onDiagramChange}
      />,
    ]
  }

  if (curve.bezierControls?.kind === 'relativePolar') {
    return [
      <RelativeEndpointEditor
        key="start"
        diagram={diagram}
        curve={curve}
        label="Start"
        pointIndex={0}
        onDiagramChange={onDiagramChange}
      />,
      <EditableNumberField
        key="first-angle"
        label="Control 1 angle"
        value={curve.bezierControls.firstControl.angleDegrees}
        onChange={(value) =>
          updateRelativePolarControl(
            curve,
            'firstControl',
            'angleDegrees',
            value,
            onDiagramChange,
          )
        }
      />,
      <EditableNumberField
        key="first-radius"
        label="Control 1 radius"
        value={curve.bezierControls.firstControl.radius}
        onChange={(value) =>
          updateRelativePolarControl(
            curve,
            'firstControl',
            'radius',
            value,
            onDiagramChange,
          )
        }
      />,
      <EditableNumberField
        key="second-angle"
        label="Control 2 angle"
        value={curve.bezierControls.secondControl.angleDegrees}
        onChange={(value) =>
          updateRelativePolarControl(
            curve,
            'secondControl',
            'angleDegrees',
            value,
            onDiagramChange,
          )
        }
      />,
      <EditableNumberField
        key="second-radius"
        label="Control 2 radius"
        value={curve.bezierControls.secondControl.radius}
        onChange={(value) =>
          updateRelativePolarControl(
            curve,
            'secondControl',
            'radius',
            value,
            onDiagramChange,
          )
        }
      />,
      <RelativeEndpointEditor
        key="end"
        diagram={diagram}
        curve={curve}
        label="End"
        pointIndex={3}
        onDiagramChange={onDiagramChange}
      />,
    ]
  }

  return describeCurvePoints(curve).map((description, pointIndex) => (
    <AbsoluteCurvePointEditor
      key={`${description.label}-${pointIndex}`}
      diagram={diagram}
      curve={curve}
      label={description.label}
      point={description.point}
      pointIndex={pointIndex}
      onDiagramChange={onDiagramChange}
    />
  ))
}

function AbsoluteCurvePointEditor({
  diagram,
  curve,
  label,
  point,
  pointIndex,
  onDiagramChange,
}: {
  diagram: Diagram
  curve: CurveStratum
  label: string
  point: Vec3
  pointIndex: number
  onDiagramChange: DiagramChangeHandler
}) {
  return (
    <CoordinateEditor
      label={label}
      point={point}
      ambientDimension={diagram.ambientDimension}
      onCoordinateChange={(axis, value) =>
        onDiagramChange((currentDiagram) =>
          updateStratumById(currentDiagram, curve.id, (current) => {
            if (current.geometricKind !== 'curve') {
              return current
            }

            return {
              ...current,
              bezierControls:
                current.kind === 'cubicBezier' ? { kind: 'absolute' } : undefined,
              points: current.points.map((currentPoint, index) =>
                index === pointIndex
                  ? updateVec3Coordinate(
                      currentPoint,
                      axis,
                      value,
                      currentDiagram.ambientDimension,
                    )
                  : currentPoint,
              ),
            }
          }),
        )
      }
    />
  )
}

function RelativeEndpointEditor({
  diagram,
  curve,
  label,
  pointIndex,
  onDiagramChange,
}: {
  diagram: Diagram
  curve: CurveStratum
  label: string
  pointIndex: 0 | 3
  onDiagramChange: DiagramChangeHandler
}) {
  return (
    <CoordinateEditor
      label={label}
      point={curve.points[pointIndex]}
      ambientDimension={diagram.ambientDimension}
      onCoordinateChange={(axis, value) =>
        onDiagramChange((currentDiagram) =>
          updateStratumById(currentDiagram, curve.id, (current) => {
            if (
              current.geometricKind !== 'curve' ||
              current.kind !== 'cubicBezier'
            ) {
              return current
            }

            return updateRelativeCubicBezierEndpoint(
              current,
              currentDiagram.ambientDimension,
              pointIndex,
              axis,
              value,
            )
          }),
        )
      }
    />
  )
}

function updateCubicBezierControlMode(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
  mode: InspectorBezierControlMode,
): CurveStratum {
  if (mode === 'absolute') {
    return { ...curve, bezierControls: { kind: 'absolute' } }
  }

  const bezierControls =
    mode === 'relativeCartesian'
      ? relativeCartesianControlModeFromPoints(ambientDimension, curve.points)
      : relativePolarControlModeFromPoints(ambientDimension, curve.points)

  return bezierControls === null ? curve : { ...curve, bezierControls }
}

function updateRelativeCubicBezierEndpoint(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
  pointIndex: 0 | 3,
  axis: CoordinateAxis,
  value: number,
): CurveStratum {
  const bezierControls = curve.bezierControls

  if (
    bezierControls?.kind !== 'relativeCartesian' &&
    bezierControls?.kind !== 'relativePolar'
  ) {
    return curve
  }

  const nextPoints = curve.points.map((point, index) =>
    index === pointIndex
      ? updateVec3Coordinate(point, axis, value, ambientDimension)
      : point,
  )
  const absolutePoints = absoluteCubicBezierPointsFromControlMode(
    ambientDimension,
    nextPoints[0],
    nextPoints[3],
    bezierControls,
  )

  return absolutePoints === null ? curve : { ...curve, points: absolutePoints }
}

function updateRelativeCartesianOffset(
  diagram: Diagram,
  curve: CurveStratum,
  offsetKey: 'firstControlOffset' | 'secondControlOffset',
  axis: CoordinateAxis,
  value: number,
  onDiagramChange: DiagramChangeHandler,
): void {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, curve.id, (current) => {
      if (
        current.geometricKind !== 'curve' ||
        current.kind !== 'cubicBezier' ||
        current.bezierControls?.kind !== 'relativeCartesian'
      ) {
        return current
      }

      const bezierControls: CubicBezierControlMode = {
        ...current.bezierControls,
        [offsetKey]: updateVec3Coordinate(
          current.bezierControls[offsetKey],
          axis,
          value,
          diagram.ambientDimension,
        ),
      }
      const absolutePoints = absoluteCubicBezierPointsFromControlMode(
        currentDiagram.ambientDimension,
        current.points[0],
        current.points[3],
        bezierControls,
      )

      return absolutePoints === null
        ? current
        : { ...current, points: absolutePoints, bezierControls }
    }),
  )
}

function updateRelativePolarControl(
  curve: CurveStratum,
  controlKey: 'firstControl' | 'secondControl',
  valueKey: 'angleDegrees' | 'radius',
  value: number,
  onDiagramChange: DiagramChangeHandler,
): void {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, curve.id, (current) => {
      if (
        current.geometricKind !== 'curve' ||
        current.kind !== 'cubicBezier' ||
        current.bezierControls?.kind !== 'relativePolar'
      ) {
        return current
      }

      const bezierControls: CubicBezierControlMode = {
        ...current.bezierControls,
        [controlKey]: {
          ...current.bezierControls[controlKey],
          [valueKey]: value,
        },
      }
      const absolutePoints = absoluteCubicBezierPointsFromControlMode(
        currentDiagram.ambientDimension,
        current.points[0],
        current.points[3],
        bezierControls,
      )

      return absolutePoints === null
        ? current
        : { ...current, points: absolutePoints, bezierControls }
    }),
  )
}

function bezierControlModeOptions(
  ambientDimension: AmbientDimension,
): readonly InspectorBezierControlMode[] {
  return ambientDimension === 2
    ? ['absolute', 'relativeCartesian', 'relativePolar']
    : ['absolute', 'relativeCartesian']
}
