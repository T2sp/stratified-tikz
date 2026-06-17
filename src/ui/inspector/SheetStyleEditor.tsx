import { useEffect, useState } from 'react'
import type { HexColor, SheetStratum } from '../../model/types.ts'
import {
  cloneStylePreset,
  sheetStylePresets,
} from '../../model/styles.ts'
import { updateStratumStyleById } from '../diagramUpdates.ts'
import {
  updateSheetFillColor,
  updateSheetStrokeColor,
} from '../sheetStyleSync.ts'
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
  const [linkStrokeToFill, setLinkStrokeToFill] = useState(false)

  useEffect(() => {
    setLinkStrokeToFill(false)
  }, [sheet.id])

  return (
    <section className="inspector-section">
      <h3>Style</h3>
      <div className="inspector-form">
        <div className="inspector-field">
          <span className="inspector-field-label">Preset</span>
          <div className="style-preset-buttons">
            {sheetStylePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="style-preset-button"
                onClick={() =>
                  onDiagramChange((diagram) =>
                    updateStratumStyleById(diagram, sheet.id, (style) =>
                      style.kind === 'sheetStyle'
                        ? cloneStylePreset(preset)
                        : style,
                    ),
                  )
                }
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
        <label className="inspector-field inspector-checkbox-field">
          <span className="inspector-field-label">Color link</span>
          <span className="inspector-checkbox-control">
            <input
              type="checkbox"
              checked={linkStrokeToFill}
              onChange={(event) =>
                setLinkStrokeToFill(event.currentTarget.checked)
              }
            />
            <span>Link stroke to fill</span>
          </span>
        </label>
        <EditableColorField
          label="Fill color"
          value={sheet.style.fillColor}
          onChange={(fillColor) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, sheet.id, (style) =>
                style.kind === 'sheetStyle'
                  ? updateSheetFillColor(
                      style,
                      fillColor as HexColor,
                      linkStrokeToFill,
                    )
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
          onChange={(strokeColor) => {
            setLinkStrokeToFill(false)
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, sheet.id, (style) =>
                style.kind === 'sheetStyle'
                  ? updateSheetStrokeColor(style, strokeColor as HexColor)
                  : style,
              ),
            )
          }}
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
