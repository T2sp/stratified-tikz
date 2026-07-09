import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type { Diagram } from '../model/types.ts'
import { normalizeColorInputValue } from './colorInput.ts'
import {
  contextQuickStyleMixedValueLabel,
  createContextQuickStyleBarModel,
  snapContextQuickStyleSliderValue,
  updateContextQuickStyleNumericDraft,
  type ContextQuickStyleChangeOptions,
  type ContextQuickStyleField,
} from './contextQuickStyleBar.ts'
import { formatNumberInput } from './inspector/InspectorField.tsx'
import type { BulkFieldScalarValue, BulkStyleFieldId } from './bulkEditing.ts'
import type { SelectedElement } from './selection.ts'

type SliderDraftState = {
  committedDraft: string
  draft: string
  hasEditedDraft: boolean
}

export type ContextQuickStyleBarProps = {
  diagram: Diagram
  selection: SelectedElement
  onChange: (
    fieldId: BulkStyleFieldId,
    value: BulkFieldScalarValue,
    options?: ContextQuickStyleChangeOptions,
  ) => void
  onSliderInteractionStart: () => void
  onSliderInteractionEnd: () => void
}

export function ContextQuickStyleBar({
  diagram,
  selection,
  onChange,
  onSliderInteractionStart,
  onSliderInteractionEnd,
}: ContextQuickStyleBarProps) {
  const model = createContextQuickStyleBarModel(diagram, selection)

  if (model === null || model.fields.length === 0) {
    return null
  }

  return (
    <section
      className="context-quick-style-bar"
      aria-label="Context quick style"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="context-quick-style-title">{model.label}</span>
      <div className="context-quick-style-fields">
        {model.fields.map((field) => (
          <ContextQuickStyleFieldEditor
            key={field.id}
            field={field}
            onChange={onChange}
            onSliderInteractionStart={onSliderInteractionStart}
            onSliderInteractionEnd={onSliderInteractionEnd}
          />
        ))}
      </div>
    </section>
  )
}

function ContextQuickStyleFieldEditor({
  field,
  onChange,
  onSliderInteractionStart,
  onSliderInteractionEnd,
}: {
  field: ContextQuickStyleField
  onChange: (
    fieldId: BulkStyleFieldId,
    value: BulkFieldScalarValue,
    options?: ContextQuickStyleChangeOptions,
  ) => void
  onSliderInteractionStart: () => void
  onSliderInteractionEnd: () => void
}) {
  switch (field.input) {
    case 'color':
      return <QuickColorField field={field} onChange={onChange} />
    case 'select':
      return <QuickSelectField field={field} onChange={onChange} />
    case 'slider':
      return (
        <QuickSliderField
          field={field}
          onChange={onChange}
          onSliderInteractionStart={onSliderInteractionStart}
          onSliderInteractionEnd={onSliderInteractionEnd}
        />
      )
  }
}

function QuickColorField({
  field,
  onChange,
}: {
  field: Extract<ContextQuickStyleField, { input: 'color' }>
  onChange: (fieldId: BulkStyleFieldId, value: string) => void
}) {
  return (
    <label className="context-quick-style-field context-quick-style-color-field">
      <span>{field.label}</span>
      <span className="context-quick-style-color-control">
        <input
          type="color"
          value={normalizeColorInputValue(
            field.value.kind === 'value' ? field.value.value : undefined,
          )}
          aria-label={field.label}
          onChange={(event) => onChange(field.id, event.currentTarget.value)}
        />
        {field.value.kind === 'mixed' && (
          <span className="context-quick-style-mixed">
            {contextQuickStyleMixedValueLabel}
          </span>
        )}
      </span>
    </label>
  )
}

function QuickSelectField({
  field,
  onChange,
}: {
  field: Extract<ContextQuickStyleField, { input: 'select' }>
  onChange: (fieldId: BulkStyleFieldId, value: string) => void
}) {
  const selectedValue = field.value.kind === 'value' ? field.value.value : '__mixed__'

  return (
    <label className="context-quick-style-field context-quick-style-select-field">
      <span>{field.label}</span>
      <select
        className="context-quick-style-select"
        value={selectedValue}
        aria-label={field.label}
        onChange={(event) => onChange(field.id, event.currentTarget.value)}
      >
        {field.value.kind === 'mixed' && (
          <option value="__mixed__" disabled>
            {contextQuickStyleMixedValueLabel}
          </option>
        )}
        {field.options.map((option) => (
          <option key={option} value={option}>
            {field.optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function QuickSliderField({
  field,
  onChange,
  onSliderInteractionStart,
  onSliderInteractionEnd,
}: {
  field: Extract<ContextQuickStyleField, { input: 'slider' }>
  onChange: (
    fieldId: BulkStyleFieldId,
    value: number,
    options?: ContextQuickStyleChangeOptions,
  ) => void
  onSliderInteractionStart: () => void
  onSliderInteractionEnd: () => void
}) {
  const committedDraft =
    field.value.kind === 'value' ? formatNumberInput(field.value.value) : ''
  const [draftState, setDraftState] = useState<SliderDraftState>({
    committedDraft,
    draft: committedDraft,
    hasEditedDraft: false,
  })
  const [sliderSessionActive, setSliderSessionActive] = useState(false)
  const draft =
    draftState.committedDraft === committedDraft
      ? draftState.draft
      : committedDraft
  const hasEditedDraft =
    draftState.committedDraft === committedDraft
      ? draftState.hasEditedDraft
      : false
  const warningId = useId()
  const draftUpdate = updateContextQuickStyleNumericDraft(field, draft)
  const showWarning = hasEditedDraft && draftUpdate.warning !== null
  const sliderValue =
    field.value.kind === 'value'
      ? field.value.value
      : field.slider.fallbackValue

  useEffect(() => {
    if (!sliderSessionActive) {
      return undefined
    }

    function endWindowSliderSession(): void {
      setSliderSessionActive(false)
      onSliderInteractionEnd()
    }

    window.addEventListener('pointerup', endWindowSliderSession)
    window.addEventListener('pointercancel', endWindowSliderSession)

    return () => {
      window.removeEventListener('pointerup', endWindowSliderSession)
      window.removeEventListener('pointercancel', endWindowSliderSession)
    }
  }, [onSliderInteractionEnd, sliderSessionActive])

  function beginSliderSession(): void {
    if (sliderSessionActive) {
      return
    }

    setSliderSessionActive(true)
    onSliderInteractionStart()
  }

  function endSliderSession(): void {
    if (!sliderSessionActive) {
      return
    }

    setSliderSessionActive(false)
    onSliderInteractionEnd()
  }

  function commitDraftIfValid(canonicalize: boolean): void {
    const nextUpdate = updateContextQuickStyleNumericDraft(field, draft)

    if (nextUpdate.commitValue === null) {
      return
    }

    onChange(field.id, nextUpdate.commitValue)

    if (canonicalize) {
      setDraftState({
        committedDraft,
        draft: formatNumberInput(nextUpdate.commitValue),
        hasEditedDraft: false,
      })
    }
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      commitDraftIfValid(true)
    }
  }

  return (
    <label className="context-quick-style-field context-quick-style-slider-field">
      <span>{field.label}</span>
      <span className="context-quick-style-slider-control">
        <input
          className="context-quick-style-range"
          type="range"
          min={field.slider.min}
          max={field.slider.max}
          step={field.slider.step}
          value={snapContextQuickStyleSliderValue(sliderValue, field.slider)}
          aria-label={`${field.label} slider`}
          onFocus={beginSliderSession}
          onBlur={endSliderSession}
          onPointerDown={beginSliderSession}
          onPointerUp={endSliderSession}
          onPointerCancel={endSliderSession}
          onChange={(event) => {
            const nextValue = snapContextQuickStyleSliderValue(
              Number(event.currentTarget.value),
              field.slider,
            )

            onChange(field.id, nextValue, { coalesceUndo: true })
            setDraftState({
              committedDraft,
              draft: formatNumberInput(nextValue),
              hasEditedDraft: false,
            })
          }}
        />
        <span className="context-quick-style-number-wrap">
          <input
            className="context-quick-style-number"
            type="text"
            inputMode="decimal"
            spellCheck={false}
            value={draft}
            placeholder={
              field.value.kind === 'mixed'
                ? contextQuickStyleMixedValueLabel
                : undefined
            }
            aria-label={`${field.label} value`}
            aria-invalid={showWarning}
            aria-describedby={showWarning ? warningId : undefined}
            onChange={(event) => {
              setDraftState({
                committedDraft,
                draft: event.currentTarget.value,
                hasEditedDraft: true,
              })
            }}
            onBlur={() => commitDraftIfValid(true)}
            onKeyDown={handleInputKeyDown}
          />
          {field.slider.unit !== undefined && (
            <span className="context-quick-style-unit">{field.slider.unit}</span>
          )}
        </span>
      </span>
      {showWarning && (
        <span id={warningId} className="context-quick-style-warning" role="status">
          {draftUpdate.warning}
        </span>
      )}
    </label>
  )
}
