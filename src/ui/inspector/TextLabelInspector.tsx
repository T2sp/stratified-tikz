import type { Diagram, TextLabel } from '../../model/types.ts'
import {
  updateLabelById,
  updateVec3Coordinate,
  updateWorkPlaneLocalCoordinate,
} from '../diagramUpdates.ts'
import {
  formatVec3,
} from '../inspectorSummary.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import {
  EditableLongTextField,
  EditableNumberField,
  ReadOnlyField,
} from './InspectorField.tsx'
import { LabelStyleEditor } from './LabelStyleEditor.tsx'
import { StyleClipboardControls } from './StyleClipboardControls.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type TextLabelInspectorProps = {
  diagram: Diagram
  label: TextLabel
  onDiagramChange: DiagramChangeHandler
  styleClipboardSummary: string
  styleClipboardStatus: string
  onCopyStyle: () => void
  onPasteStyle: () => void
  pasteStyleDisabled?: boolean
}

export function TextLabelInspector({
  diagram,
  label,
  onDiagramChange,
  styleClipboardSummary,
  styleClipboardStatus,
  onCopyStyle,
  onPasteStyle,
  pasteStyleDisabled = false,
}: TextLabelInspectorProps) {
  return (
    <div className="inspector-content editable-inspector">
      <section className="inspector-section">
        <h3>Selection</h3>
        <div className="inspector-form">
          <ReadOnlyField label="Type" value="free text label" />
          <ReadOnlyField label="ID" value={label.id} />
          <ReadOnlyField label="Name" value={label.name} />
          <EditableLongTextField
            label="Text"
            value={label.text}
            onChange={(text) =>
              onDiagramChange((currentDiagram) =>
                updateLabelById(currentDiagram, label.id, (current) => ({
                  ...current,
                  text,
                })),
              )
            }
          />
          <EditableNumberField
            label="Layer"
            value={label.layer}
            onChange={(layer) =>
              onDiagramChange((currentDiagram) =>
                updateLabelById(currentDiagram, label.id, (current) => ({
                  ...current,
                  layer,
                })),
              )
            }
          />
        </div>
      </section>

      <section className="inspector-section">
        <h3>Geometry</h3>
        <div className="inspector-form">
          <CoordinateEditor
            label="Position"
            point={label.position}
            ambientDimension={diagram.ambientDimension}
            variables={diagram.variables}
            allowSymbolic
            onCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateLabelById(currentDiagram, label.id, (current) => ({
                  ...current,
                  position: updateVec3Coordinate(
                    current.position,
                    axis,
                    value,
                    currentDiagram.ambientDimension,
                  ),
                })),
              )
            }
            onWorkPlaneLocalCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateLabelById(currentDiagram, label.id, (current) => {
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
            value={formatVec3(label.position, diagram.ambientDimension)}
          />
        </div>
      </section>

      <StyleClipboardControls
        clipboardSummary={styleClipboardSummary}
        status={styleClipboardStatus}
        pasteDisabled={pasteStyleDisabled}
        onCopyStyle={onCopyStyle}
        onPasteStyle={onPasteStyle}
      />

      <LabelStyleEditor
        diagram={diagram}
        label={label}
        onDiagramChange={onDiagramChange}
      />
    </div>
  )
}
