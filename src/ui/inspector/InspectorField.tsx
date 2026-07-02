import { useEffect, useId, useState } from 'react'
import {
  parseFiniteNumber,
  parseOpacity,
  parsePositiveFiniteNumber,
} from '../diagramUpdates.ts'
import { normalizeColorInputValue } from '../colorInput.ts'
import {
  finiteNumberDraftWarning,
  opacityDraftWarning,
  positiveNumberDraftWarning,
  updateInspectorNumericDraft,
  type InspectorNumberParser,
} from './numericInput.ts'

export function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <span className="readonly-value">{value}</span>
    </div>
  )
}

export function EditableTextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <input
        className="inspector-input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export function EditableLongTextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <textarea
        className="inspector-input inspector-textarea"
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export function EditableNumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <EditableParsedNumberField
      label={label}
      value={value}
      parse={parseFiniteNumber}
      invalidMessage={finiteNumberDraftWarning(label)}
      onChange={onChange}
    />
  )
}

export function EditableOpacityField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <EditableParsedNumberField
      label={label}
      value={value}
      parse={parseOpacity}
      invalidMessage={opacityDraftWarning(label)}
      onChange={onChange}
    />
  )
}

export function EditablePositiveNumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <EditableParsedNumberField
      label={label}
      value={value}
      parse={parsePositiveFiniteNumber}
      invalidMessage={positiveNumberDraftWarning(label)}
      onChange={onChange}
    />
  )
}

export function EditableParsedNumberField({
  label,
  value,
  placeholder,
  parse,
  invalidMessage,
  inputMode = 'decimal',
  onChange,
}: {
  label: string
  value: number | null
  placeholder?: string
  parse: InspectorNumberParser
  invalidMessage: string
  inputMode?: 'decimal' | 'numeric'
  onChange: (value: number) => void
}) {
  const committedValue = value === null ? '' : formatNumberInput(value)
  const [draft, setDraft] = useState(committedValue)
  const [hasEditedDraft, setHasEditedDraft] = useState(false)
  const warningId = useId()
  const draftUpdate = updateInspectorNumericDraft(
    draft,
    parse,
    invalidMessage,
  )
  const showWarning = hasEditedDraft && draftUpdate.warning !== null

  useEffect(() => {
    setDraft(committedValue)
    setHasEditedDraft(false)
  }, [committedValue])

  function commitDraftIfValid(nextDraft: string, canonicalize: boolean): void {
    const nextUpdate = updateInspectorNumericDraft(
      nextDraft,
      parse,
      invalidMessage,
    )

    if (nextUpdate.commitValue === null) {
      return
    }

    onChange(nextUpdate.commitValue)

    if (canonicalize) {
      setDraft(formatNumberInput(nextUpdate.commitValue))
      setHasEditedDraft(false)
    }
  }

  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <input
        className="inspector-input"
        type="text"
        inputMode={inputMode}
        spellCheck={false}
        value={draft}
        placeholder={placeholder}
        aria-invalid={showWarning}
        aria-describedby={showWarning ? warningId : undefined}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value

          setDraft(nextDraft)
          setHasEditedDraft(true)
          commitDraftIfValid(nextDraft, false)
        }}
        onBlur={() => commitDraftIfValid(draft, true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitDraftIfValid(draft, true)
          }
        }}
      />
      {showWarning && (
        <span id={warningId} className="inspector-field-error" role="status">
          {draftUpdate.warning}
        </span>
      )}
    </label>
  )
}

export function EditableColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <input
        className="inspector-input"
        type="color"
        value={normalizeColorInputValue(value)}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export function EditableSelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
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
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export function formatNumberInput(value: number): string {
  return Object.is(value, -0) ? '0' : String(value)
}
