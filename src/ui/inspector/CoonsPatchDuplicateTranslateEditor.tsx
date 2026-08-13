import { useState, type FormEvent } from 'react'
import {
  isZeroTranslationVector,
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../model/translation.ts'
import {
  submitCoonsPatchDuplicateTranslation,
  type CoonsPatchDuplicateTranslationInput,
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

export type CoonsPatchDuplicateTranslateStatusState = {
  patchId: string
  message: string
}

export type CoonsPatchDuplicateTranslateFormProps =
  CoonsPatchDuplicateTranslateEditorProps & {
    input: CoonsPatchDuplicateTranslationInput
    statusState: CoonsPatchDuplicateTranslateStatusState
    onInputChange: (
      field: keyof CoonsPatchDuplicateTranslationInput,
      value: string,
    ) => void
    onStatusStateChange: (
      status: CoonsPatchDuplicateTranslateStatusState,
    ) => void
  }

export function CoonsPatchDuplicateTranslateEditor({
  diagram,
  patch,
  onDuplicateAndTranslate,
}: CoonsPatchDuplicateTranslateEditorProps) {
  const [input, setInput] = useState<CoonsPatchDuplicateTranslationInput>({
    dx: '0',
    dy: '0',
    dz: '0',
  })
  const [statusState, setStatusState] =
    useState<CoonsPatchDuplicateTranslateStatusState>({
      patchId: '',
      message: '',
    })

  return (
    <CoonsPatchDuplicateTranslateForm
      diagram={diagram}
      patch={patch}
      onDuplicateAndTranslate={onDuplicateAndTranslate}
      input={input}
      statusState={statusState}
      onInputChange={(field, value) => {
        setInput((current) => ({ ...current, [field]: value }))
        setStatusState({ patchId: '', message: '' })
      }}
      onStatusStateChange={setStatusState}
    />
  )
}

export function CoonsPatchDuplicateTranslateForm({
  diagram,
  patch,
  onDuplicateAndTranslate,
  input,
  statusState,
  onInputChange,
  onStatusStateChange,
}: CoonsPatchDuplicateTranslateFormProps) {
  const parsed = parseTranslationVectorFromInputs(diagram, input)
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
      onStatusStateChange({ patchId: patch.id, message: parsed.error })
      return
    }

    if (isZero) {
      onStatusStateChange({
        patchId: patch.id,
        message: 'Enter a non-zero translation.',
      })
      return
    }

    const result = submitCoonsPatchDuplicateTranslation(
      diagram,
      patch.id,
      input,
      onDuplicateAndTranslate,
    )

    onStatusStateChange({
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
          value={input.dx}
          invalid={!parsed.ok && parsed.error.startsWith('dx:')}
          onChange={(value) => onInputChange('dx', value)}
        />
        <TranslationInput
          label="dy"
          value={input.dy}
          invalid={!parsed.ok && parsed.error.startsWith('dy:')}
          onChange={(value) => onInputChange('dy', value)}
        />
        <TranslationInput
          label="dz"
          value={input.dz}
          invalid={!parsed.ok && parsed.error.startsWith('dz:')}
          onChange={(value) => onInputChange('dz', value)}
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
