import { labelAnchors } from '../../model/types.ts'
import type { HexColor, LabelAnchor, TextLabel } from '../../model/types.ts'
import { updateLabelStyleById } from '../diagramUpdates.ts'
import {
  EditableColorField,
  EditableOpacityField,
  EditablePositiveNumberField,
  EditableSelectField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type LabelStyleEditorProps = {
  label: TextLabel
  onDiagramChange: DiagramChangeHandler
}

export function LabelStyleEditor({
  label,
  onDiagramChange,
}: LabelStyleEditorProps) {
  return (
    <section className="inspector-section">
      <h3>Style</h3>
      <div className="inspector-form">
        <EditableColorField
          label="Text color"
          value={label.style.color}
          onChange={(color) =>
            onDiagramChange((diagram) =>
              updateLabelStyleById(diagram, label.id, (style) => ({
                ...style,
                color: color as HexColor,
              })),
            )
          }
        />
        <EditableOpacityField
          label="Opacity"
          value={label.style.opacity}
          onChange={(opacity) =>
            onDiagramChange((diagram) =>
              updateLabelStyleById(diagram, label.id, (style) => ({
                ...style,
                opacity,
              })),
            )
          }
        />
        <EditablePositiveNumberField
          label="Font size"
          value={label.style.fontSize}
          onChange={(fontSize) =>
            onDiagramChange((diagram) =>
              updateLabelStyleById(diagram, label.id, (style) => ({
                ...style,
                fontSize,
              })),
            )
          }
        />
        <EditableSelectField<LabelAnchor>
          label="Anchor"
          value={label.style.anchor}
          options={labelAnchors}
          onChange={(anchor) =>
            onDiagramChange((diagram) =>
              updateLabelStyleById(diagram, label.id, (style) => ({
                ...style,
                anchor,
              })),
            )
          }
        />
      </div>
    </section>
  )
}
