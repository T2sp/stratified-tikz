import { useState } from 'react'
import { labelAnchors, lineStyles, pointFills, pointShapes } from '../../model/types.ts'
import type {
  Diagram,
  HexColor,
  LabelAnchor,
  LineStyle,
  PointFill,
  PointShape,
  StylePresetKind,
  UserStylePreset,
} from '../../model/types.ts'
import {
  applyUserStylePresetToLabel,
  applyUserStylePresetToStratum,
  createUserStylePresetFromStyle,
  deleteUserStylePreset,
  normalizeStylePresetName,
  renameUserStylePreset,
  updateUserStylePresetStyle,
  type StylePresetStyle,
} from '../../model/stylePresets.ts'
import {
  EditableColorField,
  EditableOpacityField,
  EditablePositiveNumberField,
  EditableSelectField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type StylePresetTarget =
  | { kind: 'stratum'; id: string }
  | { kind: 'label'; id: string }

export type UserStylePresetControlsProps = {
  diagram: Diagram
  kind: StylePresetKind
  currentStyle: StylePresetStyle
  target: StylePresetTarget
  onDiagramChange: DiagramChangeHandler
}

export function UserStylePresetControls({
  diagram,
  kind,
  currentStyle,
  target,
  onDiagramChange,
}: UserStylePresetControlsProps) {
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const userPresets = (diagram.userStylePresets ?? []).filter(
    (preset) => preset.kind === kind,
  )
  const activePresetId = userPresets.some(
    (preset) => preset.id === selectedPresetId,
  )
    ? selectedPresetId
    : userPresets[0]?.id ?? ''
  const selectedPreset =
    userPresets.find((preset) => preset.id === activePresetId) ?? null

  function createPreset(): void {
    const name = window.prompt(
      'Preset name',
      normalizeStylePresetName('', kind),
    )

    if (name === null) {
      return
    }

    onDiagramChange((currentDiagram) => {
      const result = createUserStylePresetFromStyle(
        currentDiagram,
        kind,
        name,
        currentStyle,
      )

      return result?.diagram ?? currentDiagram
    })
  }

  function applyPreset(): void {
    if (selectedPreset === null) {
      return
    }

    onDiagramChange((currentDiagram) =>
      target.kind === 'label'
        ? applyUserStylePresetToLabel(
            currentDiagram,
            target.id,
            selectedPreset.id,
          )
        : applyUserStylePresetToStratum(
            currentDiagram,
            target.id,
            selectedPreset.id,
          ),
    )
  }

  function renamePreset(): void {
    if (selectedPreset === null) {
      return
    }

    const name = window.prompt('Preset name', selectedPreset.name)

    if (name === null) {
      return
    }

    onDiagramChange((currentDiagram) =>
      renameUserStylePreset(currentDiagram, selectedPreset.id, name),
    )
  }

  function deletePreset(): void {
    if (selectedPreset === null) {
      return
    }

    if (!window.confirm(`Delete preset "${selectedPreset.name}"?`)) {
      return
    }

    onDiagramChange((currentDiagram) =>
      deleteUserStylePreset(currentDiagram, selectedPreset.id),
    )
  }

  function updatePresetStyle(style: StylePresetStyle): void {
    if (selectedPreset === null) {
      return
    }

    onDiagramChange((currentDiagram) =>
      updateUserStylePresetStyle(currentDiagram, selectedPreset.id, style),
    )
  }

  return (
    <>
      <div className="inspector-field">
        <span className="inspector-field-label">Saved presets</span>
        <div className="style-preset-manager">
          <button
            type="button"
            className="style-preset-button"
            onClick={createPreset}
          >
            Save current
          </button>
          {userPresets.length > 0 && (
            <>
              <select
                className="inspector-input style-preset-select"
                value={activePresetId}
                onChange={(event) =>
                  setSelectedPresetId(event.currentTarget.value)
                }
              >
                {userPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <div className="style-preset-buttons">
                <button
                  type="button"
                  className="style-preset-button"
                  onClick={applyPreset}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="style-preset-button"
                  onClick={renamePreset}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="style-preset-button"
                  onClick={deletePreset}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {selectedPreset !== null && (
        <PresetStyleFields
          preset={selectedPreset}
          onChange={updatePresetStyle}
        />
      )}
    </>
  )
}

function PresetStyleFields({
  preset,
  onChange,
}: {
  preset: UserStylePreset
  onChange: (style: StylePresetStyle) => void
}) {
  switch (preset.kind) {
    case 'region':
      return (
        <>
          <EditableColorField
            label="Preset fill"
            value={preset.style.fillColor}
            onChange={(fillColor) =>
              onChange({ ...preset.style, fillColor: fillColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset fill opacity"
            value={preset.style.fillOpacity}
            onChange={(fillOpacity) => onChange({ ...preset.style, fillOpacity })}
          />
          <EditableColorField
            label="Preset stroke"
            value={preset.style.strokeColor}
            onChange={(strokeColor) =>
              onChange({ ...preset.style, strokeColor: strokeColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset stroke opacity"
            value={preset.style.strokeOpacity}
            onChange={(strokeOpacity) =>
              onChange({ ...preset.style, strokeOpacity })
            }
          />
        </>
      )
    case 'sheet':
      return (
        <>
          <EditableColorField
            label="Preset fill"
            value={preset.style.fillColor}
            onChange={(fillColor) =>
              onChange({ ...preset.style, fillColor: fillColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset fill opacity"
            value={preset.style.fillOpacity}
            onChange={(fillOpacity) => onChange({ ...preset.style, fillOpacity })}
          />
          <EditableColorField
            label="Preset stroke"
            value={preset.style.strokeColor}
            onChange={(strokeColor) =>
              onChange({ ...preset.style, strokeColor: strokeColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset stroke opacity"
            value={preset.style.strokeOpacity}
            onChange={(strokeOpacity) =>
              onChange({ ...preset.style, strokeOpacity })
            }
          />
        </>
      )
    case 'curve':
      return (
        <>
          <EditableColorField
            label="Preset stroke"
            value={preset.style.strokeColor}
            onChange={(strokeColor) =>
              onChange({ ...preset.style, strokeColor: strokeColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset opacity"
            value={preset.style.strokeOpacity}
            onChange={(strokeOpacity) =>
              onChange({ ...preset.style, strokeOpacity })
            }
          />
          <EditablePositiveNumberField
            label="Preset width"
            value={preset.style.lineWidth}
            onChange={(lineWidth) => onChange({ ...preset.style, lineWidth })}
          />
          <EditableSelectField<LineStyle>
            label="Preset line"
            value={preset.style.lineStyle}
            options={lineStyles}
            onChange={(lineStyle) => onChange({ ...preset.style, lineStyle })}
          />
        </>
      )
    case 'point':
      return (
        <>
          <EditableColorField
            label="Preset color"
            value={preset.style.color}
            onChange={(color) =>
              onChange({ ...preset.style, color: color as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset opacity"
            value={preset.style.opacity}
            onChange={(opacity) => onChange({ ...preset.style, opacity })}
          />
          <EditablePositiveNumberField
            label="Preset size"
            value={preset.style.size}
            onChange={(size) => onChange({ ...preset.style, size })}
          />
          <EditableSelectField<PointShape>
            label="Preset shape"
            value={preset.style.shape}
            options={pointShapes}
            onChange={(shape) => onChange({ ...preset.style, shape })}
          />
          <EditableSelectField<PointFill>
            label="Preset fill"
            value={preset.style.fill}
            options={pointFills}
            onChange={(fill) => onChange({ ...preset.style, fill })}
          />
        </>
      )
    case 'label':
      return (
        <>
          <EditableColorField
            label="Preset text"
            value={preset.style.color}
            onChange={(color) =>
              onChange({ ...preset.style, color: color as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset opacity"
            value={preset.style.opacity}
            onChange={(opacity) => onChange({ ...preset.style, opacity })}
          />
          <EditablePositiveNumberField
            label="Preset font"
            value={preset.style.fontSize}
            onChange={(fontSize) => onChange({ ...preset.style, fontSize })}
          />
          <EditableSelectField<LabelAnchor>
            label="Preset anchor"
            value={preset.style.anchor}
            options={labelAnchors}
            onChange={(anchor) => onChange({ ...preset.style, anchor })}
          />
        </>
      )
  }
}
