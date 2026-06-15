import type { Diagram, SheetStratum } from '../../model/types.ts'
import { sheetVertices, updateSheetVertex } from '../../model/sheets.ts'
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
        {sheetVertices(sheet).map((vertex, vertexIndex) => (
          <CoordinateEditor
            key={`sheet-vertex-${vertexIndex}`}
            label={`${sheet.kind === 'quadSheet' ? 'Corner' : 'Vertex'} ${vertexIndex + 1}`}
            point={vertex}
            ambientDimension={diagram.ambientDimension}
            onCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, sheet.id, (current) => {
                  if (current.geometricKind !== 'sheet') {
                    return current
                  }

                  return updateSheetVertex(current, vertexIndex, (currentVertex) =>
                    updateVec3Coordinate(
                      currentVertex,
                      axis,
                      value,
                      currentDiagram.ambientDimension,
                    ),
                  )
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
