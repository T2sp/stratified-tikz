import { useState, type FormEvent } from 'react'
import {
  isZeroTranslationVector,
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../model/translation.ts'
import {
  submitCoonsPatchTranslation,
  type CoonsPatchStratum,
  type CoonsPatchTranslationInput,
  type DuplicateCoonsPatchActionResult,
  type TranslateCoonsPatchActionResult,
} from '../coonsPatchDuplicateTranslation.ts'

export type {
  DuplicateCoonsPatchActionResult,
  TranslateCoonsPatchActionResult,
} from '../coonsPatchDuplicateTranslation.ts'

export type CoonsPatchActionsEditorProps = {
  diagram: Parameters<typeof parseTranslationVectorFromInputs>[0]
  patch: CoonsPatchStratum
  onDuplicate: (patchId: string) => DuplicateCoonsPatchActionResult
  onTranslate: (
    patchId: string,
    translation: TranslationVector,
  ) => TranslateCoonsPatchActionResult
}

export type CoonsPatchActionStatusState = {
  patchId: string
  message: string
}

export type CoonsPatchActionsControlsProps = CoonsPatchActionsEditorProps & {
  input: CoonsPatchTranslationInput
  statusState: CoonsPatchActionStatusState
  onInputChange: (
    field: keyof CoonsPatchTranslationInput,
    value: string,
  ) => void
  onStatusStateChange: (status: CoonsPatchActionStatusState) => void
}

export function CoonsPatchActionsEditor({
  diagram,
  patch,
  onDuplicate,
  onTranslate,
}: CoonsPatchActionsEditorProps) {
  const [input, setInput] = useState<CoonsPatchTranslationInput>({
    dx: '0',
    dy: '0',
    dz: '0',
  })
  const [statusState, setStatusState] = useState<CoonsPatchActionStatusState>({
    patchId: '',
    message: '',
  })

  return (
    <CoonsPatchActionsControls
      diagram={diagram}
      patch={patch}
      onDuplicate={onDuplicate}
      onTranslate={onTranslate}
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

export function CoonsPatchActionsControls({
  diagram,
  patch,
  onDuplicate,
  onTranslate,
  input,
  statusState,
  onInputChange,
  onStatusStateChange,
}: CoonsPatchActionsControlsProps) {
  const parsed = parseTranslationVectorFromInputs(diagram, input)
  const isZero = parsed.ok && isZeroTranslationVector(parsed.translation)
  const errorMessage = parsed.ok
    ? isZero
      ? 'Enter a non-zero translation.'
      : ''
    : parsed.error
  const status = statusState.patchId === patch.id ? statusState.message : ''

  function duplicate(): void {
    const result = onDuplicate(patch.id)

    onStatusStateChange({
      patchId: patch.id,
      message: result.message,
    })
  }

  function submitTranslation(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    const result = submitCoonsPatchTranslation(
      diagram,
      patch.id,
      input,
      onTranslate,
    )

    onStatusStateChange({
      patchId: patch.id,
      message: result.message,
    })
  }

  return (
    <section className="inspector-section">
      <h3>Coons patch actions</h3>
      <div className="inspector-form">
        <div className="inspector-field">
          <span className="inspector-field-label">Duplicate</span>
          <button
            type="button"
            className="toolbar-button"
            aria-label="Duplicate selected Coons patch"
            title="Create an untranslated Coons patch copy using the current patch-only link policy"
            onClick={duplicate}
          >
            Duplicate
          </button>
        </div>
      </div>
      <form className="inspector-form" onSubmit={submitTranslation}>
        <h4>Translate</h4>
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
          <span className="inspector-field-label">Move selected patch</span>
          <button
            type="submit"
            className="toolbar-button"
            aria-label="Translate selected Coons patch"
            disabled={!parsed.ok || isZero}
            title={
              errorMessage ||
              'Translate this Coons patch globally; active boundary links are detached first'
            }
          >
            Translate
          </button>
        </div>
        <p className="inspector-help">
          Translating a linked patch detaches only that patch and makes it
          static. Its boundary sources are not moved.
        </p>
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
