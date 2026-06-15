import { pointFills, pointShapes } from '../../model/types.ts'
import type {
  HexColor,
  PointFill,
  PointShape,
  PointStratum,
} from '../../model/types.ts'
import { updateStratumStyleById } from '../diagramUpdates.ts'
import {
  EditableColorField,
  EditableOpacityField,
  EditablePositiveNumberField,
  EditableSelectField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type PointStyleEditorProps = {
  point: PointStratum
  onDiagramChange: DiagramChangeHandler
}

export function PointStyleEditor({
  point,
  onDiagramChange,
}: PointStyleEditorProps) {
  return (
    <section className="inspector-section">
      <h3>Style</h3>
      <div className="inspector-form">
        <EditableColorField
          label="Color"
          value={point.style.color}
          onChange={(color) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, point.id, (style) =>
                style.kind === 'pointStyle'
                  ? { ...style, color: color as HexColor }
                  : style,
              ),
            )
          }
        />
        <EditableOpacityField
          label="Opacity"
          value={point.style.opacity}
          onChange={(opacity) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, point.id, (style) =>
                style.kind === 'pointStyle' ? { ...style, opacity } : style,
              ),
            )
          }
        />
        <EditablePositiveNumberField
          label="Size"
          value={point.style.size}
          onChange={(size) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, point.id, (style) =>
                style.kind === 'pointStyle' ? { ...style, size } : style,
              ),
            )
          }
        />
        <EditableSelectField<PointShape>
          label="Shape"
          value={point.style.shape}
          options={pointShapes}
          onChange={(shape) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, point.id, (style) =>
                style.kind === 'pointStyle' ? { ...style, shape } : style,
              ),
            )
          }
        />
        <EditableSelectField<PointFill>
          label="Fill"
          value={point.style.fill}
          options={pointFills}
          onChange={(fill) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, point.id, (style) =>
                style.kind === 'pointStyle' ? { ...style, fill } : style,
              ),
            )
          }
        />
      </div>
    </section>
  )
}
