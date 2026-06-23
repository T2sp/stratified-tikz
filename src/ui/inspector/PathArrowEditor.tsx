import { resolvePathArrowOptions } from '../../model/pathArrows.ts'
import {
  canReverseCurvePathDirection,
  reverseCurvePathDirection,
} from '../../model/paths.ts'
import {
  arrowHeadKinds,
  endpointArrowModes,
  midArrowDirections,
} from '../../model/types.ts'
import type {
  ArrowHeadKind,
  CurveStratum,
  EndpointArrowMode,
  MidArrowDirection,
} from '../../model/types.ts'
import { updateStratumById } from '../diagramUpdates.ts'
import {
  isPathArrowEditableCurve,
  updatePathEndpointArrow,
  updatePathMidArrowDirection,
  updatePathMidArrowEnabled,
  updatePathMidArrowHead,
  updatePathMidArrowPosition,
} from '../pathArrowEditing.ts'
import { EditableNumberField, ReadOnlyField } from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

type MidArrowEnabledMode = 'off' | 'on'

const midArrowEnabledModes: readonly MidArrowEnabledMode[] = ['off', 'on']

const arrowHeadLabels: Readonly<Record<ArrowHeadKind, string>> = {
  standard: '>',
  stealth: 'Stealth',
  latex: 'Latex',
  stealthHarpoon: 'Stealth[harpoon]',
  stealthHarpoonSwap: 'Stealth[harpoon,swap]',
}

export type PathArrowEditorProps = {
  curve: CurveStratum
  onDiagramChange: DiagramChangeHandler
}

export function PathArrowEditor({
  curve,
  onDiagramChange,
}: PathArrowEditorProps) {
  if (!isPathArrowEditableCurve(curve)) {
    return null
  }

  const arrows = resolvePathArrowOptions(curve.arrows)
  const reverseSupported = canReverseCurvePathDirection(curve)

  return (
    <section className="inspector-section">
      <h3>Arrows</h3>
      <div className="inspector-form">
        <LabeledSelectField<EndpointArrowMode>
          label="Endpoint"
          value={arrows.endpoint}
          options={endpointArrowModes}
          optionLabel={(option) => option}
          onChange={(endpoint) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, curve.id, (current) =>
                updatePathEndpointArrow(current, endpoint),
              ),
            )
          }
        />
        <LabeledSelectField<MidArrowEnabledMode>
          label="Mid arrow"
          value={arrows.mid.enabled ? 'on' : 'off'}
          options={midArrowEnabledModes}
          optionLabel={(option) => option}
          onChange={(value) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, curve.id, (current) =>
                updatePathMidArrowEnabled(current, value === 'on'),
              ),
            )
          }
        />
        <EditableNumberField
          label="Position"
          value={arrows.mid.position}
          onChange={(position) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, curve.id, (current) =>
                updatePathMidArrowPosition(current, position),
              ),
            )
          }
        />
        <LabeledSelectField<MidArrowDirection>
          label="Direction"
          value={arrows.mid.direction}
          options={midArrowDirections}
          optionLabel={(option) => option}
          onChange={(direction) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, curve.id, (current) =>
                updatePathMidArrowDirection(current, direction),
              ),
            )
          }
        />
        <LabeledSelectField<ArrowHeadKind>
          label="Head"
          value={arrows.mid.head}
          options={arrowHeadKinds}
          optionLabel={(option) => arrowHeadLabels[option]}
          onChange={(head) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, curve.id, (current) =>
                updatePathMidArrowHead(current, head),
              ),
            )
          }
        />
        <div className="inspector-field">
          <span className="inspector-field-label">Path direction</span>
          <button
            type="button"
            className="toolbar-button"
            disabled={!reverseSupported}
            title={
              reverseSupported
                ? 'Reverse path direction'
                : reverseUnsupportedMessage(curve)
            }
            onClick={() =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, curve.id, (current) => {
                  if (current.geometricKind !== 'curve') {
                    return current
                  }

                  return reverseCurvePathDirection(current) ?? current
                }),
              )
            }
          >
            Reverse path direction
          </button>
        </div>
        {!reverseSupported && (
          <ReadOnlyField
            label="Reverse support"
            value={reverseUnsupportedMessage(curve)}
          />
        )}
        <ReadOnlyField
          label="Preview"
          value="SVG arrowheads are approximate."
        />
      </div>
    </section>
  )
}

function LabeledSelectField<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  optionLabel: (value: T) => string
  onChange: (value: T) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <select
        className="inspector-input"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function reverseUnsupportedMessage(curve: CurveStratum): string {
  return curve.kind === 'templatePath'
    ? 'Template paths have no orientation metadata yet.'
    : 'This curve kind cannot be reversed.'
}
