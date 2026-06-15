import type { HexColor, SheetStratum } from '../../model/types.ts'
import { updateStratumStyleById } from '../diagramUpdates.ts'
import {
  EditableColorField,
  EditableOpacityField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type SheetStyleEditorProps = {
  sheet: SheetStratum
  onDiagramChange: DiagramChangeHandler
}

export function SheetStyleEditor({
  sheet,
  onDiagramChange,
}: SheetStyleEditorProps) {
  return (
    <section className="inspector-section">
      <h3>Style</h3>
      <div className="inspector-form">
        <EditableColorField
          label="Fill color"
          value={sheet.style.fillColor}
          onChange={(fillColor) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, sheet.id, (style) =>
                style.kind === 'sheetStyle'
                  ? { ...style, fillColor: fillColor as HexColor }
                  : style,
              ),
            )
          }
        />
        <EditableOpacityField
          label="Fill opacity"
          value={sheet.style.fillOpacity}
          onChange={(fillOpacity) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, sheet.id, (style) =>
                style.kind === 'sheetStyle' ? { ...style, fillOpacity } : style,
              ),
            )
          }
        />
        <EditableColorField
          label="Stroke color"
          value={sheet.style.strokeColor}
          onChange={(strokeColor) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, sheet.id, (style) =>
                style.kind === 'sheetStyle'
                  ? { ...style, strokeColor: strokeColor as HexColor }
                  : style,
              ),
            )
          }
        />
        <EditableOpacityField
          label="Stroke opacity"
          value={sheet.style.strokeOpacity}
          onChange={(strokeOpacity) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, sheet.id, (style) =>
                style.kind === 'sheetStyle' ? { ...style, strokeOpacity } : style,
              ),
            )
          }
        />
      </div>
    </section>
  )
}
