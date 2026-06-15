import type { CurveStratum, Diagram } from '../../model/types.ts'
import {
  updateStratumById,
  updateVec3Coordinate,
} from '../diagramUpdates.ts'
import { describeCurvePoints } from '../inspector.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import { ReadOnlyField } from './InspectorField.tsx'
import { formatSelectedGeometry } from './geometryPreview.ts'
import type { DiagramChangeHandler } from './types.ts'

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
  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        <ReadOnlyField label="Curve kind" value={curve.kind} />
        <ReadOnlyField
          label="Style segments"
          value={String(curve.styleSegments.length)}
        />
        {describeCurvePoints(curve).map((description, pointIndex) => (
          <CoordinateEditor
            key={`${description.label}-${pointIndex}`}
            label={description.label}
            point={description.point}
            ambientDimension={diagram.ambientDimension}
            onCoordinateChange={(axis, value) =>
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
          />
        ))}
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(curve, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}
