import { PointPaintFields } from './PointPaintFields.tsx'
import { pointFills, pointShapes, pointPaintFields } from '../../model/types.ts'
import type {
  Diagram,
  HexColor,
  PointFill,
  PointShape,
  PointStratum,
} from '../../model/types.ts'
import {
  cloneStylePreset,
  pointStylePresets,
  getPointPaint,
  updatePointColor,
  updatePointFill,
} from '../../model/styles.ts'
import { updateStratumStyleById } from '../diagramUpdates.ts'
import {
  EditableColorField,
  EditableOpacityField,
  EditablePositiveNumberField,
  EditableSelectField,
} from './InspectorField.tsx'
import { UserStylePresetControls } from './UserStylePresetControls.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type PointStyleEditorProps = {
  diagram: Diagram
  point: PointStratum
  onDiagramChange: DiagramChangeHandler
}

export function PointStyleEditor({
  diagram,
  point,
  onDiagramChange,
}: PointStyleEditorProps) {
  const diagnostics = (diagram.importedTikzStyleReferences ?? [])
    .find((reference) => reference.id === point.importedTikzStyleReferenceId)?.previewDiagnostics ?? []
  return (
    <section className="inspector-section">
      <h3>Style</h3>
      {diagnostics.map((message, index) => <p key={`${index}-${message}`} className="style-preset-warning">{message}</p>)}
      <div className="inspector-form">
        <div className="inspector-field">
          <span className="inspector-field-label">Built-in presets</span>
          <div className="style-preset-buttons">
            {pointStylePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="style-preset-button"
                onClick={() =>
                  onDiagramChange((diagram) =>
                    updateStratumStyleById(diagram, point.id, (style) =>
                      style.kind === 'pointStyle'
                        ? cloneStylePreset(preset)
                        : style,
                      pointPaintFields,
                    ),
                  )
                }
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
        <UserStylePresetControls
          diagram={diagram}
          kind="point"
          currentStyle={point.style}
          target={{ kind: 'stratum', id: point.id }}
          onDiagramChange={onDiagramChange}
        />
        <EditableColorField
          label="Color"
          value={getPointPaint(point.style).stroke.color}
          onChange={(color) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, point.id, (style) =>
                style.kind === 'pointStyle'
                  ? updatePointColor(style, color as HexColor)
                  : style,
              ),
            )
          }
        />
        <PointPaintFields style={point.style} onChange={(next, fields) =>
          onDiagramChange((diagram) => updateStratumStyleById(diagram, point.id, () => next, fields))} />
        <EditableOpacityField
          label="Opacity"
          value={point.style.opacity}
          onChange={(opacity) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, point.id, (style) =>
                style.kind === 'pointStyle' ? { ...style, opacity } : style,
                ['opacity'],
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
                style.kind === 'pointStyle' ? updatePointFill(style, fill) : style,
              ),
            )
          }
        />
      </div>
    </section>
  )
}
