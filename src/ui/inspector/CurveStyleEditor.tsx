import { lineStyles } from '../../model/types.ts'
import type { CurveStratum, HexColor, LineStyle } from '../../model/types.ts'
import { updateStratumStyleById } from '../diagramUpdates.ts'
import {
  EditableColorField,
  EditableOpacityField,
  EditablePositiveNumberField,
  EditableSelectField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type CurveStyleEditorProps = {
  curve: CurveStratum
  onDiagramChange: DiagramChangeHandler
}

export function CurveStyleEditor({
  curve,
  onDiagramChange,
}: CurveStyleEditorProps) {
  return (
    <section className="inspector-section">
      <h3>Style</h3>
      <div className="inspector-form">
        <EditableColorField
          label="Stroke color"
          value={curve.style.strokeColor}
          onChange={(strokeColor) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, curve.id, (style) =>
                style.kind === 'curveStyle'
                  ? { ...style, strokeColor: strokeColor as HexColor }
                  : style,
              ),
            )
          }
        />
        <EditableOpacityField
          label="Stroke opacity"
          value={curve.style.strokeOpacity}
          onChange={(strokeOpacity) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, curve.id, (style) =>
                style.kind === 'curveStyle' ? { ...style, strokeOpacity } : style,
              ),
            )
          }
        />
        <EditablePositiveNumberField
          label="Line width"
          value={curve.style.lineWidth}
          onChange={(lineWidth) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, curve.id, (style) =>
                style.kind === 'curveStyle' ? { ...style, lineWidth } : style,
              ),
            )
          }
        />
        <EditableSelectField<LineStyle>
          label="Line style"
          value={curve.style.lineStyle}
          options={lineStyles}
          onChange={(lineStyle) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, curve.id, (style) =>
                style.kind === 'curveStyle' ? { ...style, lineStyle } : style,
              ),
            )
          }
        />
      </div>
    </section>
  )
}
