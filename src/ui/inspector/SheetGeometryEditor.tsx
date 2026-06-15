import type { Diagram, SheetStratum } from '../../model/types.ts'
import {
  updateStratumById,
  updateVec3Coordinate,
} from '../diagramUpdates.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import { ReadOnlyField } from './InspectorField.tsx'
import { formatSelectedGeometry } from './geometryPreview.ts'
import type { DiagramChangeHandler } from './types.ts'

export type SheetGeometryEditorProps = {
  diagram: Diagram
  sheet: SheetStratum
  onDiagramChange: DiagramChangeHandler
}

export function SheetGeometryEditor({
  diagram,
  sheet,
  onDiagramChange,
}: SheetGeometryEditorProps) {
  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        {sheet.corners.map((corner, cornerIndex) => (
          <CoordinateEditor
            key={`corner-${cornerIndex}`}
            label={`Corner ${cornerIndex + 1}`}
            point={corner}
            ambientDimension={diagram.ambientDimension}
            onCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, sheet.id, (current) => {
                  if (current.geometricKind !== 'sheet') {
                    return current
                  }

                  const corners = current.corners.map((currentCorner, index) =>
                    index === cornerIndex
                      ? updateVec3Coordinate(
                          currentCorner,
                          axis,
                          value,
                          currentDiagram.ambientDimension,
                        )
                      : currentCorner,
                  ) as SheetStratum['corners']

                  return { ...current, corners }
                }),
              )
            }
          />
        ))}
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(sheet, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}
