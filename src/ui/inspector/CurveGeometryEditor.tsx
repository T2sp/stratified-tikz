import { useState } from 'react'
import {
  cubicBezierControlToRelativeCartesian,
  cubicBezierControlToRelativePolar,
  isEditableCubicBezierCurve,
  planeCoordinateLabels,
  updateCubicBezierControlFromRelativeCartesian,
  updateCubicBezierControlFromRelativePolar,
  type CubicBezierControlPointIndex,
  type RelativeCartesianControl,
  type RelativePolarControl,
} from '../../geometry/bezierControls.ts'
import type { CurveStratum, Diagram, WorkPlane } from '../../model/types.ts'
import {
  parseFiniteNumber,
  updateStratumById,
  updateVec3Coordinate,
  type CoordinateAxis,
} from '../diagramUpdates.ts'
import { describeCurvePoints } from '../inspectorSummary.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import {
  EditableSelectField,
  ReadOnlyField,
  formatNumberInput,
} from './InspectorField.tsx'
import { formatSelectedGeometry } from './geometryPreview.ts'
import type { DiagramChangeHandler } from './types.ts'

type BezierControlEditingMode = 'absolute' | 'relativeCartesian' | 'relativePolar'

const bezierControlEditingModes = [
  'absolute',
  'relativeCartesian',
  'relativePolar',
] as const satisfies readonly BezierControlEditingMode[]

export type CurveGeometryEditorProps = {
  diagram: Diagram
  curve: CurveStratum
  activeWorkPlane: WorkPlane
  onDiagramChange: DiagramChangeHandler
}

export function CurveGeometryEditor({
  diagram,
  curve,
  activeWorkPlane,
  onDiagramChange,
}: CurveGeometryEditorProps) {
  const [bezierControlEditingMode, setBezierControlEditingMode] =
    useState<BezierControlEditingMode>('absolute')
  const descriptions = describeCurvePoints(curve)
  const editPointCoordinate = (
    pointIndex: number,
    axis: CoordinateAxis,
    value: number,
  ) => {
    onDiagramChange((currentDiagram) =>
      updateStratumById(currentDiagram, curve.id, (current) => {
        if (current.geometricKind !== 'curve') {
          return current
        }

        return {
          ...current,
          points: current.points.map((point, index) =>
            index === pointIndex
              ? updateVec3Coordinate(
                  point,
                  axis,
                  value,
                  currentDiagram.ambientDimension,
                )
              : point,
          ),
        }
      }),
    )
  }

  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        <ReadOnlyField label="Curve kind" value={curve.kind} />
        <ReadOnlyField
          label="Style segments"
          value={String(curve.styleSegments.length)}
        />
        {isEditableCubicBezierCurve(curve) && (
          <EditableSelectField
            label="Control input"
            value={bezierControlEditingMode}
            options={bezierControlEditingModes}
            onChange={setBezierControlEditingMode}
          />
        )}
        {isEditableCubicBezierCurve(curve) &&
        bezierControlEditingMode !== 'absolute' &&
        diagram.ambientDimension === 3 ? (
          <ReadOnlyField
            label="Control plane"
            value={activeWorkPlane.kind}
          />
        ) : null}
        {renderCurvePointEditors({
          diagram,
          curve,
          activeWorkPlane,
          descriptions,
          bezierControlEditingMode,
          editPointCoordinate,
          onDiagramChange,
        })}
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(curve, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}

function renderCurvePointEditors({
  diagram,
  curve,
  activeWorkPlane,
  descriptions,
  bezierControlEditingMode,
  editPointCoordinate,
  onDiagramChange,
}: {
  diagram: Diagram
  curve: CurveStratum
  activeWorkPlane: WorkPlane
  descriptions: ReturnType<typeof describeCurvePoints>
  bezierControlEditingMode: BezierControlEditingMode
  editPointCoordinate: (
    pointIndex: number,
    axis: CoordinateAxis,
    value: number,
  ) => void
  onDiagramChange: DiagramChangeHandler
}) {
  if (!isEditableCubicBezierCurve(curve) || bezierControlEditingMode === 'absolute') {
    return descriptions.map((description, pointIndex) => (
      <CoordinateEditor
        key={`${description.label}-${pointIndex}`}
        label={description.label}
        point={description.point}
        ambientDimension={diagram.ambientDimension}
        onCoordinateChange={(axis, value) =>
          editPointCoordinate(pointIndex, axis, value)
        }
      />
    ))
  }

  return descriptions.map((description, pointIndex) => {
    const controlIndex = controlIndexFromPointIndex(pointIndex)

    if (controlIndex === null) {
      return (
        <CoordinateEditor
          key={`${description.label}-${pointIndex}`}
          label={description.label}
          point={description.point}
          ambientDimension={diagram.ambientDimension}
          onCoordinateChange={(axis, value) =>
            editPointCoordinate(pointIndex, axis, value)
          }
        />
      )
    }

    return bezierControlEditingMode === 'relativeCartesian' ? (
      <RelativeCartesianControlEditor
        key={`${description.label}-${pointIndex}`}
        label={description.label}
        diagram={diagram}
        curve={curve}
        controlIndex={controlIndex}
        activeWorkPlane={activeWorkPlane}
        onDiagramChange={onDiagramChange}
      />
    ) : (
      <RelativePolarControlEditor
        key={`${description.label}-${pointIndex}`}
        label={description.label}
        diagram={diagram}
        curve={curve}
        controlIndex={controlIndex}
        activeWorkPlane={activeWorkPlane}
        onDiagramChange={onDiagramChange}
      />
    )
  })
}

function RelativeCartesianControlEditor({
  label,
  diagram,
  curve,
  controlIndex,
  activeWorkPlane,
  onDiagramChange,
}: {
  label: string
  diagram: Diagram
  curve: CurveStratum
  controlIndex: CubicBezierControlPointIndex
  activeWorkPlane: WorkPlane
  onDiagramChange: DiagramChangeHandler
}) {
  const relative = cubicBezierControlToRelativeCartesian(
    curve.points,
    controlIndex,
    diagram.ambientDimension,
    activeWorkPlane,
  )
  const labels = planeCoordinateLabels(diagram.ambientDimension, activeWorkPlane)

  if (relative === null) {
    return null
  }

  return (
    <fieldset className="coordinate-group">
      <legend>{label} relative</legend>
      <div className="coordinate-grid">
        {(['u', 'v'] as const).map((coordinate) => (
          <RelativeControlInput
            key={coordinate}
            label={`d${labels[coordinate]}`}
            value={relative[coordinate]}
            parse={parseFiniteNumber}
            onChange={(value) =>
              updateRelativeCartesianControl({
                curve,
                controlIndex,
                activeWorkPlane,
                relative: { ...relative, [coordinate]: value },
                onDiagramChange,
              })
            }
          />
        ))}
      </div>
    </fieldset>
  )
}

function RelativePolarControlEditor({
  label,
  diagram,
  curve,
  controlIndex,
  activeWorkPlane,
  onDiagramChange,
}: {
  label: string
  diagram: Diagram
  curve: CurveStratum
  controlIndex: CubicBezierControlPointIndex
  activeWorkPlane: WorkPlane
  onDiagramChange: DiagramChangeHandler
}) {
  const relative = cubicBezierControlToRelativePolar(
    curve.points,
    controlIndex,
    diagram.ambientDimension,
    activeWorkPlane,
  )

  if (relative === null) {
    return null
  }

  return (
    <fieldset className="coordinate-group">
      <legend>{label} polar</legend>
      <div className="coordinate-grid">
        <RelativeControlInput
          label="angle"
          value={relative.angleDegrees}
          parse={parseFiniteNumber}
          onChange={(angleDegrees) =>
            updateRelativePolarControl({
              curve,
              controlIndex,
              activeWorkPlane,
              relative: { ...relative, angleDegrees },
              onDiagramChange,
            })
          }
        />
        <RelativeControlInput
          label="radius"
          value={relative.radius}
          parse={parseNonnegativeFiniteNumber}
          onChange={(radius) =>
            updateRelativePolarControl({
              curve,
              controlIndex,
              activeWorkPlane,
              relative: { ...relative, radius },
              onDiagramChange,
            })
          }
        />
      </div>
    </fieldset>
  )
}

function RelativeControlInput({
  label,
  value,
  parse,
  onChange,
}: {
  label: string
  value: number
  parse: (value: string) => number | null
  onChange: (value: number) => void
}) {
  return (
    <label className="coordinate-input-row">
      <span>{label}</span>
      <input
        className="inspector-input"
        type="number"
        min={label === 'radius' ? '0' : undefined}
        step="any"
        value={formatNumberInput(value)}
        onChange={(event) => {
          const parsedValue = parse(event.currentTarget.value)

          if (parsedValue !== null) {
            onChange(parsedValue)
          }
        }}
      />
    </label>
  )
}

function updateRelativeCartesianControl({
  curve,
  controlIndex,
  activeWorkPlane,
  relative,
  onDiagramChange,
}: {
  curve: CurveStratum
  controlIndex: CubicBezierControlPointIndex
  activeWorkPlane: WorkPlane
  relative: RelativeCartesianControl
  onDiagramChange: DiagramChangeHandler
}) {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, curve.id, (current) => {
      if (current.geometricKind !== 'curve') {
        return current
      }

      return {
        ...current,
        points: updateCubicBezierControlFromRelativeCartesian(
          current.points,
          controlIndex,
          relative,
          currentDiagram.ambientDimension,
          activeWorkPlane,
        ),
      }
    }),
  )
}

function updateRelativePolarControl({
  curve,
  controlIndex,
  activeWorkPlane,
  relative,
  onDiagramChange,
}: {
  curve: CurveStratum
  controlIndex: CubicBezierControlPointIndex
  activeWorkPlane: WorkPlane
  relative: RelativePolarControl
  onDiagramChange: DiagramChangeHandler
}) {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, curve.id, (current) => {
      if (current.geometricKind !== 'curve') {
        return current
      }

      return {
        ...current,
        points: updateCubicBezierControlFromRelativePolar(
          current.points,
          controlIndex,
          relative,
          currentDiagram.ambientDimension,
          activeWorkPlane,
        ),
      }
    }),
  )
}

function controlIndexFromPointIndex(
  pointIndex: number,
): CubicBezierControlPointIndex | null {
  return pointIndex === 1 || pointIndex === 2 ? pointIndex : null
}

function parseNonnegativeFiniteNumber(rawValue: string): number | null {
  const value = parseFiniteNumber(rawValue)

  if (value === null || value < 0) {
    return null
  }

  return value
}
