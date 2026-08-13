import { useMemo, useState, type FormEvent } from 'react'
import {
  isZeroTranslationVector,
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../model/translation.ts'
import {
  submitCoonsPatchDuplicateTranslation,
  type CoonsPatchStratum,
  type DuplicateAndTranslateCoonsPatchActionResult,
} from '../coonsPatchDuplicateTranslation.ts'

export type { DuplicateAndTranslateCoonsPatchActionResult } from '../coonsPatchDuplicateTranslation.ts'

export type CoonsPatchDuplicateTranslateEditorProps = {
  diagram: Parameters<typeof parseTranslationVectorFromInputs>[0]
  patch: CoonsPatchStratum
  onDuplicateAndTranslate: (
    patchId: string,
    translation: TranslationVector,
  ) => DuplicateAndTranslateCoonsPatchActionResult
}

export function CoonsPatchDuplicateTranslateEditor({
  diagram,
  patch,
  onDuplicateAndTranslate,
}: CoonsPatchDuplicateTranslateEditorProps) {
  const [dxInput, setDxInput] = useState('0')
  const [dyInput, setDyInput] = useState('0')
  const [dzInput, setDzInput] = useState('0')
  const [statusState, setStatusState] = useState({
    patchId: '',
    message: '',
  })
  const parsed = useMemo(
    () =>
      parseTranslationVectorFromInputs(diagram, {
        dx: dxInput,
        dy: dyInput,
        dz: dzInput,
      }),
    [diagram, dxInput, dyInput, dzInput],
  )
  const isZero = parsed.ok && isZeroTranslationVector(parsed.translation)
  const errorMessage = parsed.ok
    ? isZero
      ? 'Enter a non-zero translation.'
      : ''
    : parsed.error
  const status =
    statusState.patchId === patch.id ? statusState.message : ''

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (!parsed.ok) {
      setStatusState({ patchId: patch.id, message: parsed.error })
      return
    }

    if (isZero) {
      setStatusState({
        patchId: patch.id,
        message: 'Enter a non-zero translation.',
      })
      return
    }

    const result = submitCoonsPatchDuplicateTranslation(
      diagram,
      patch.id,
      { dx: dxInput, dy: dyInput, dz: dzInput },
      onDuplicateAndTranslate,
    )

    setStatusState({
      patchId: result.ok ? result.duplicatedPatchId : patch.id,
      message: result.message,
    })
  }

  return (
    <section className="inspector-section">
      <h3>Duplicate &amp; translate</h3>
      <form className="inspector-form" onSubmit={submit}>
        <TranslationInput
          label="dx"
          value={dxInput}
          invalid={!parsed.ok && parsed.error.startsWith('dx:')}
          onChange={(value) => {
            setDxInput(value)
            setStatusState({ patchId: '', message: '' })
          }}
        />
        <TranslationInput
          label="dy"
          value={dyInput}
          invalid={!parsed.ok && parsed.error.startsWith('dy:')}
          onChange={(value) => {
            setDyInput(value)
            setStatusState({ patchId: '', message: '' })
          }}
        />
        <TranslationInput
          label="dz"
          value={dzInput}
          invalid={!parsed.ok && parsed.error.startsWith('dz:')}
          onChange={(value) => {
            setDzInput(value)
            setStatusState({ patchId: '', message: '' })
          }}
        />
        <div className="inspector-field">
          <span className="inspector-field-label">Create static copy</span>
          <button
            type="submit"
            className="toolbar-button"
            disabled={!parsed.ok || isZero}
            title={
              errorMessage ||
              'Duplicate this Coons patch as an independent static copy and translate it globally'
            }
          >
            Duplicate &amp; translate
          </button>
        </div>
        {(status !== '' || errorMessage !== '') && (
          <p className="inspector-status" role="status" aria-live="polite">
            {errorMessage || status}
          </p>
        )}
      </form>
    </section>
  )
}

function TranslationInput({
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
        aria-label={`Coons patch translation ${label}`}
        aria-invalid={invalid}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}
