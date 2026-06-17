import { useEffect, useState } from 'react'
import type { HexColor, RegionStratum } from '../../model/types.ts'
import {
  cloneStylePreset,
  regionStylePresets,
} from '../../model/styles.ts'
import { updateStratumStyleById } from '../diagramUpdates.ts'
import {
  EditableColorField,
  EditableOpacityField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type RegionStyleEditorProps = {
  region: RegionStratum
  onDiagramChange: DiagramChangeHandler
}

export function RegionStyleEditor({
  region,
  onDiagramChange,
}: RegionStyleEditorProps) {
  const [linkStrokeToFill, setLinkStrokeToFill] = useState(false)

  useEffect(() => {
    setLinkStrokeToFill(false)
  }, [region.id])

  return (
    <section className="inspector-section">
      <h3>Style</h3>
      <div className="inspector-form">
        <div className="inspector-field">
          <span className="inspector-field-label">Preset</span>
          <div className="style-preset-buttons">
            {regionStylePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="style-preset-button"
                onClick={() =>
                  onDiagramChange((diagram) =>
                    updateStratumStyleById(diagram, region.id, (style) =>
                      style.kind === 'regionStyle'
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
          value={region.style.fillColor}
          onChange={(fillColor) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, region.id, (style) =>
                style.kind === 'regionStyle'
                  ? {
                      ...style,
                      fillColor: fillColor as HexColor,
                      strokeColor: linkStrokeToFill
                        ? (fillColor as HexColor)
                        : style.strokeColor,
                    }
                  : style,
              ),
            )
          }
        />
        <EditableOpacityField
          label="Fill opacity"
          value={region.style.fillOpacity}
          onChange={(fillOpacity) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, region.id, (style) =>
                style.kind === 'regionStyle' ? { ...style, fillOpacity } : style,
              ),
            )
          }
        />
        <EditableColorField
          label="Stroke color"
          value={region.style.strokeColor}
          onChange={(strokeColor) => {
            setLinkStrokeToFill(false)
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, region.id, (style) =>
                style.kind === 'regionStyle'
                  ? { ...style, strokeColor: strokeColor as HexColor }
                  : style,
              ),
            )
          }}
        />
        <EditableOpacityField
          label="Stroke opacity"
          value={region.style.strokeOpacity}
          onChange={(strokeOpacity) =>
            onDiagramChange((diagram) =>
              updateStratumStyleById(diagram, region.id, (style) =>
                style.kind === 'regionStyle'
                  ? { ...style, strokeOpacity }
                  : style,
              ),
            )
          }
        />
      </div>
    </section>
  )
}
