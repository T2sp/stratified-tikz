import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  applyBulkStyleField,
  bulkLayerFieldValue,
  bulkMixedValueLabel,
  type BulkFieldScalarValue,
  type BulkFieldValue,
  type BulkStyleEditorModel,
  type BulkStyleField,
} from '../bulkEditing.ts'
import type { Diagram } from '../../model/types.ts'
import {
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../model/translation.ts'
import { normalizeColorInputValue } from '../colorInput.ts'
import { parseFiniteNumber, parseOpacity, parsePositiveFiniteNumber } from '../diagramUpdates.ts'
import type { MultiSelectedElement } from '../selection.ts'
import { formatNumberInput, ReadOnlyField } from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type BulkSelectionInspectorProps = {
  diagram: Diagram
  selection: MultiSelectedElement
  model: BulkStyleEditorModel | null
  onDiagramChange: DiagramChangeHandler
  onBulkLayerChange: (layer: number) => void
  onBulkDelete: () => void
  onBulkDuplicate: () => void
  onBulkTranslate: (translation: TranslationVector) => void
}

export function BulkSelectionInspector({
  diagram,
  selection,
  model,
  onDiagramChange,
  onBulkLayerChange,
  onBulkDelete,
  onBulkDuplicate,
  onBulkTranslate,
}: BulkSelectionInspectorProps) {
  const layerValue = bulkLayerFieldValue(diagram, selection)

  return (
    <div className="inspector-content editable-inspector">
      <section className="inspector-section">
        <h3>Selection</h3>
        <div className="inspector-form">
          <ReadOnlyField
            label="Count"
            value={String(model?.count ?? selection.elements.length)}
          />
          <ReadOnlyField
            label="Kind"
            value={model?.geometricKind ?? 'mixed'}
          />
          <BulkNumberField
            label="Layer"
            value={layerValue}
            onChange={onBulkLayerChange}
          />
        </div>
      </section>

      {model === null ? (
        <section className="inspector-section">
          <h3>Style</h3>
          <div className="inspector-form">
            <ReadOnlyField
              label="Bulk style"
              value="Select objects with one geometric kind."
            />
          </div>
        </section>
      ) : (
        <BulkStyleSections
          selection={selection}
          model={model}
          onDiagramChange={onDiagramChange}
        />
      )}

      <BulkTranslationSection
        diagram={diagram}
        onBulkTranslate={onBulkTranslate}
      />

      <section className="inspector-section">
        <h3>Actions</h3>
        <div className="inspector-form">
          <div className="inspector-field">
            <span className="inspector-field-label">Duplicate/delete</span>
            <div className="bulk-action-buttons">
              <button
                type="button"
                className="toolbar-button"
                onClick={onBulkDuplicate}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="toolbar-button bulk-delete-button"
                onClick={onBulkDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function BulkTranslationSection({
  diagram,
  onBulkTranslate,
}: {
  diagram: Diagram
  onBulkTranslate: (translation: TranslationVector) => void
}) {
  const [dxInput, setDxInput] = useState('0')
  const [dyInput, setDyInput] = useState('0')
  const [dzInput, setDzInput] = useState('0')
  const [status, setStatus] = useState('')
  const parsed = useMemo(
    () =>
      parseTranslationVectorFromInputs(diagram, {
        dx: dxInput,
        dy: dyInput,
        dz: dzInput,
      }),
    [diagram, dxInput, dyInput, dzInput],
  )
  const isZero =
    parsed.ok &&
    parsed.preview.x === 0 &&
    parsed.preview.y === 0 &&
    parsed.preview.z === 0
  const canSubmit = parsed.ok && !isZero
  const errorMessage = parsed.ok
    ? isZero
      ? 'Enter a non-zero translation.'
      : ''
    : parsed.error

  function submitTranslation(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (!parsed.ok) {
      setStatus(parsed.error)
      return
    }

    if (isZero) {
      setStatus('Enter a non-zero translation.')
      return
    }

    onBulkTranslate(parsed.translation)
    setStatus('')
  }

  return (
    <section className="inspector-section">
      <h3>Translate selected</h3>
      <form className="inspector-form" onSubmit={submitTranslation}>
        <BulkTranslationInput
          label="dx"
          value={dxInput}
          invalid={!parsed.ok && parsed.error.startsWith('dx:')}
          onChange={setDxInput}
        />
        <BulkTranslationInput
          label="dy"
          value={dyInput}
          invalid={!parsed.ok && parsed.error.startsWith('dy:')}
          onChange={setDyInput}
        />
        {diagram.ambientDimension === 3 && (
          <BulkTranslationInput
            label="dz"
            value={dzInput}
            invalid={!parsed.ok && parsed.error.startsWith('dz:')}
            onChange={setDzInput}
          />
        )}
        <div className="inspector-field">
          <span className="inspector-field-label">Apply</span>
          <button
            type="submit"
            className="toolbar-button"
            disabled={!canSubmit}
            title={errorMessage}
          >
            Apply
          </button>
        </div>
        {(status !== '' || errorMessage !== '') && (
          <p className="inspector-status" role="status" aria-live="polite">
            {status || errorMessage}
          </p>
        )}
      </form>
    </section>
  )
}

function BulkTranslationInput({
  label,
  value,
  invalid,
  onChange,
}: {
  label: 'dx' | 'dy' | 'dz'
  value: string
  invalid: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <input
        className="inspector-input"
        type="text"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

function BulkStyleSections({
  selection,
  model,
  onDiagramChange,
}: {
  selection: MultiSelectedElement
  model: BulkStyleEditorModel
  onDiagramChange: DiagramChangeHandler
}) {
  return (
    <>
      <section className="inspector-section">
        <h3>Style</h3>
        <div className="inspector-form">
          {model.fields.map((field) => (
            <BulkStyleFieldEditor
              key={field.id}
              field={field}
              onChange={(value) =>
                onDiagramChange((currentDiagram) =>
                  applyBulkStyleField(currentDiagram, selection, field.id, value),
                )
              }
            />
          ))}
        </div>
      </section>

      {model.arrowFields.length > 0 && (
        <section className="inspector-section">
          <h3>Arrows</h3>
          <div className="inspector-form">
            {model.arrowFields.map((field) => (
              <BulkStyleFieldEditor
                key={field.id}
                field={field}
                onChange={(value) =>
                  onDiagramChange((currentDiagram) =>
                    applyBulkStyleField(
                      currentDiagram,
                      selection,
                      field.id,
                      value,
                    ),
                  )
                }
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function BulkStyleFieldEditor({
  field,
  onChange,
}: {
  field: BulkStyleField
  onChange: (value: BulkFieldScalarValue) => void
}) {
  switch (field.input) {
    case 'color':
      return (
        <BulkColorField
          label={field.label}
          value={field.value}
          onChange={onChange}
        />
      )
    case 'opacity':
      return (
        <BulkNumberField
          label={field.label}
          value={field.value}
          onChange={onChange}
          parse={parseOpacity}
          min={0}
          max={1}
          step="0.05"
        />
      )
    case 'positiveNumber':
      return (
        <BulkNumberField
          label={field.label}
          value={field.value}
          onChange={onChange}
          parse={parsePositiveFiniteNumber}
          min={0}
        />
      )
    case 'select':
      return (
        <BulkSelectField
          label={field.label}
          value={field.value}
          options={field.options ?? []}
          onChange={onChange}
        />
      )
  }
}

function BulkColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: BulkFieldValue
  onChange: (value: string) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <span className="bulk-field-control">
        <input
          className="inspector-input"
          type="color"
          value={normalizeColorInputValue(
            value.kind === 'value' && typeof value.value === 'string'
              ? value.value
              : undefined,
          )}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        {value.kind === 'mixed' && (
          <span className="bulk-mixed-value">{bulkMixedValueLabel}</span>
        )}
      </span>
    </label>
  )
}

function BulkNumberField({
  label,
  value,
  onChange,
  parse = parseFiniteNumber,
  min,
  max,
  step = 'any',
}: {
  label: string
  value: BulkFieldValue
  onChange: (value: number) => void
  parse?: (rawValue: string) => number | null
  min?: number
  max?: number
  step?: string
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <input
        className="inspector-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={
          value.kind === 'value' && typeof value.value === 'number'
            ? formatNumberInput(value.value)
            : ''
        }
        placeholder={value.kind === 'mixed' ? bulkMixedValueLabel : undefined}
        onChange={(event) => {
          const parsedValue = parse(event.currentTarget.value)

          if (parsedValue !== null) {
            onChange(parsedValue)
          }
        }}
      />
    </label>
  )
}

function BulkSelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: BulkFieldValue
  options: readonly string[]
  onChange: (value: string) => void
}) {
  const selectedValue =
    value.kind === 'value' && typeof value.value === 'string'
      ? value.value
      : '__mixed__'

  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <select
        className="inspector-input"
        value={selectedValue}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {value.kind === 'mixed' && (
          <option value="__mixed__" disabled>
            {bulkMixedValueLabel}
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
