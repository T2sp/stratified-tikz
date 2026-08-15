import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import type { Diagram } from '../../model/types.ts'
import {
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../model/translation.ts'

export type SelectionTranslationSectionProps = {
  diagram: Diagram
  heading?: string
  onTranslate: (translation: TranslationVector) => void
}

export function SelectionTranslationSection({
  diagram,
  heading = 'Translate selected',
  onTranslate,
}: SelectionTranslationSectionProps) {
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

    onTranslate(parsed.translation)
    setStatus('')
  }

  return (
    <section className="inspector-section">
      <h3>{heading}</h3>
      <form className="inspector-form" onSubmit={submitTranslation}>
        <SelectionTranslationInput
          label="dx"
          value={dxInput}
          invalid={!parsed.ok && parsed.error.startsWith('dx:')}
          onChange={setDxInput}
        />
        <SelectionTranslationInput
          label="dy"
          value={dyInput}
          invalid={!parsed.ok && parsed.error.startsWith('dy:')}
          onChange={setDyInput}
        />
        {diagram.ambientDimension === 3 && (
          <SelectionTranslationInput
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

function SelectionTranslationInput({
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
