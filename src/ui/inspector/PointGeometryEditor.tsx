import type { Diagram, PointStratum } from '../../model/types.ts'
import {
  updateStratumById,
  updateVec3Coordinate,
  updateWorkPlaneLocalCoordinate,
} from '../diagramUpdates.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import { ReadOnlyField } from './InspectorField.tsx'
import { formatSelectedGeometry } from './geometryPreview.ts'
import type { DiagramChangeHandler } from './types.ts'

export type PointGeometryEditorProps = {
  diagram: Diagram
  point: PointStratum
  onDiagramChange: DiagramChangeHandler
}

export function PointGeometryEditor({
  diagram,
  point,
  onDiagramChange,
}: PointGeometryEditorProps) {
  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        <CoordinateEditor
          label="Position"
          point={point.position}
          ambientDimension={diagram.ambientDimension}
          variables={diagram.variables}
          allowSymbolic
          onCoordinateChange={(axis, value) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, point.id, (current) => {
                if (current.geometricKind !== 'point') {
                  return current
                }

                return {
                  ...current,
                  position: updateVec3Coordinate(
                    current.position,
                    axis,
                    value,
                    currentDiagram.ambientDimension,
                  ),
                }
              }),
            )
          }
          onWorkPlaneLocalCoordinateChange={(axis, value) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, point.id, (current) => {
                if (current.geometricKind !== 'point') {
                  return current
                }

                const position = updateWorkPlaneLocalCoordinate(
                  current.position,
                  axis,
                  value,
                  currentDiagram.ambientDimension,
                  { diagram: currentDiagram },
                )

                return position === null ? current : { ...current, position }
              }),
            )
          }
        />
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(point, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}
