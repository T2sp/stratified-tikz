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
import type { Diagram, Vec3 } from '../../model/types.ts'
import {
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../model/translation.ts'
import { normalizeColorInputValue } from '../colorInput.ts'
import { parseFiniteNumber, parseOpacity, parsePositiveFiniteNumber } from '../diagramUpdates.ts'
import {
  createPathConcatenationDirectionDraft,
  orientPathsForConcatenation,
  resolveSelectedPathSnapshotsForConcatenation,
  type PathConcatenationDirectionDraft,
  type PathLikeSnapshot,
} from '../pathConcatenation.ts'
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
  onBulkConcatenatePaths: (
    keepOriginals: boolean,
    directionReversed?: readonly boolean[],
  ) => string
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
  onBulkConcatenatePaths,
}: BulkSelectionInspectorProps) {
  const layerValue = bulkLayerFieldValue(diagram, selection)
  const selectionMessage = bulkSelectionMessage(
    model?.geometricKind ?? null,
    model?.count ?? selection.elements.length,
  )

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
          <ReadOnlyField
            label="Bulk edits"
            value={selectionMessage}
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

      <BulkPathConcatenationSection
        diagram={diagram}
        selection={selection}
        enabled={model?.geometricKind === 'curve' && selection.elements.length >= 2}
        onBulkConcatenatePaths={onBulkConcatenatePaths}
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
                title={`Duplicate ${selection.elements.length} selected ${objectCountLabel(
                  selection.elements.length,
                )}`}
                onClick={onBulkDuplicate}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="toolbar-button bulk-delete-button"
                title={`Delete ${selection.elements.length} selected ${objectCountLabel(
                  selection.elements.length,
                )}`}
                onClick={onBulkDelete}
              >
                Delete...
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function bulkSelectionMessage(
  geometricKind: string | null,
  count: number,
): string {
  if (geometricKind === null) {
    return 'Style edits unavailable'
  }

  return `${count} ${geometricKind} ${objectCountLabel(count)}`
}

function objectCountLabel(count: number): string {
  return count === 1 ? 'object' : 'objects'
}

function BulkPathConcatenationSection({
  diagram,
  selection,
  enabled,
  onBulkConcatenatePaths,
}: {
  diagram: Diagram
  selection: MultiSelectedElement
  enabled: boolean
  onBulkConcatenatePaths: (
    keepOriginals: boolean,
    directionReversed?: readonly boolean[],
  ) => string
}) {
  const [keepOriginals, setKeepOriginals] = useState(true)
  const [status, setStatus] = useState('')
  const [directionPanelOpen, setDirectionPanelOpen] = useState(false)
  const [manualDirectionState, setManualDirectionState] =
    useState<ManualDirectionState | null>(null)
  const sourceResult = useMemo(
    () =>
      enabled
        ? resolveSelectedPathSnapshotsForConcatenation(diagram, selection)
        : null,
    [diagram, enabled, selection],
  )
  const sourceSnapshots = sourceResult?.ok
    ? sourceResult.sources.map((source) => source.snapshot)
    : []
  const sourceKey = sourceSnapshots.map(pathSnapshotKey).join('|')
  const autoOrientation = useMemo(
    () =>
      sourceSnapshots.length >= 2
        ? orientPathsForConcatenation(sourceSnapshots)
        : null,
    [sourceSnapshots],
  )
  const defaultDirectionReversed =
    autoOrientation?.ok === true
      ? autoOrientation.reversed
      : sourceSnapshots.map(() => false)
  const manualDirectionReversed =
    manualDirectionState?.key === sourceKey
      ? normalizeDirectionFlags(
          manualDirectionState.reversed,
          sourceSnapshots.length,
        )
      : defaultDirectionReversed
  const directionDraft =
    sourceSnapshots.length >= 2
      ? createPathConcatenationDirectionDraft(
          sourceSnapshots,
          manualDirectionReversed,
        )
      : null
  const directionControlsVisible =
    sourceResult?.ok === true &&
    (directionPanelOpen || autoOrientation?.ok === false)
  const autoReversalCount =
    autoOrientation?.ok === true
      ? autoOrientation.reversed.filter(Boolean).length
      : 0
  const createDisabled =
    !enabled ||
    (directionControlsVisible && directionDraft?.canCreate !== true)

  function concatenate(): void {
    setStatus(
      onBulkConcatenatePaths(
        keepOriginals,
        directionControlsVisible ? directionDraft?.reversed : undefined,
      ),
    )
  }

  function toggleDirection(pathIndex: number): void {
    const nextReversed = manualDirectionReversed.map((reversed, index) =>
      index === pathIndex ? !reversed : reversed,
    )

    setManualDirectionState({
      key: sourceKey,
      reversed: nextReversed,
    })
  }

  function resetDirections(): void {
    setManualDirectionState({
      key: sourceKey,
      reversed: defaultDirectionReversed,
    })
  }

  return (
    <section className="inspector-section">
      <h3>Concatenate paths</h3>
      <div className="inspector-form">
        <label className="inspector-field inspector-checkbox-field">
          <span className="inspector-field-label">Keep original paths</span>
          <span className="inspector-checkbox-control">
            <input
              type="checkbox"
              checked={keepOriginals}
              onChange={(event) => setKeepOriginals(event.currentTarget.checked)}
            />
            <span>{keepOriginals ? 'On' : 'Off'}</span>
          </span>
        </label>
        <div className="inspector-field">
          <span className="inspector-field-label">Create</span>
          <button
            type="button"
            className="toolbar-button"
            disabled={createDisabled}
            title={
              enabled
                ? 'Concatenate selected paths; the new path uses the first path style.'
                : 'Select at least two curves'
            }
            onClick={concatenate}
          >
            Concatenate
          </button>
        </div>
        <div className="inspector-field">
          <span className="inspector-field-label">Direction</span>
          <button
            type="button"
            className="toolbar-button"
            disabled={sourceResult?.ok !== true}
            aria-pressed={directionControlsVisible}
            onClick={() => setDirectionPanelOpen((open) => !open)}
          >
            Adjust
          </button>
        </div>
        {autoReversalCount > 0 && !directionControlsVisible && (
          <p className="inspector-status" role="status">
            Auto orientation will reverse {autoReversalCount}{' '}
            {autoReversalCount === 1 ? 'path' : 'paths'}.
          </p>
        )}
        {directionControlsVisible && directionDraft !== null && (
          <PathConcatenationDirectionControls
            draft={directionDraft}
            onToggleDirection={toggleDirection}
            onResetDirections={resetDirections}
            onCreate={concatenate}
          />
        )}
        {status !== '' && (
          <p className="inspector-status" role="status" aria-live="polite">
            {status}
          </p>
        )}
      </div>
    </section>
  )
}

type ManualDirectionState = {
  key: string
  reversed: boolean[]
}

function PathConcatenationDirectionControls({
  draft,
  onToggleDirection,
  onResetDirections,
  onCreate,
}: {
  draft: PathConcatenationDirectionDraft
  onToggleDirection: (pathIndex: number) => void
  onResetDirections: () => void
  onCreate: () => void
}) {
  return (
    <div className="path-concat-direction-controls">
      <div className="path-concat-direction-list">
        {draft.paths.map((path, index) => (
          <div
            className="path-concat-direction-row"
            key={path.id ?? `path-${index}`}
          >
            <span className="path-concat-direction-label">
              {index + 1}. {path.name ?? path.id ?? `path ${index + 1}`}
            </span>
            <span className="path-concat-direction-text">
              {path.reversed ? 'end -> start' : 'start -> end'}:{' '}
              {formatEndpoint(path.start)}
              {' -> '}
              {formatEndpoint(path.end)}
            </span>
            <button
              type="button"
              className="toolbar-button path-concat-reverse-button"
              aria-pressed={path.reversed}
              onClick={() => onToggleDirection(index)}
            >
              Reverse
            </button>
          </div>
        ))}
      </div>
      <div className="path-concat-endpoint-check-list">
        {draft.endpointChecks.map((check) => (
          <div
            className={
              check.matches
                ? 'path-concat-endpoint-check path-concat-endpoint-check-ok'
                : 'path-concat-endpoint-check path-concat-endpoint-check-fail'
            }
            key={check.index}
          >
            <span className="path-concat-endpoint-state">
              {check.matches ? 'OK' : 'Mismatch'}
            </span>
            <span>
              {check.equation}: {formatEndpoint(check.previousEnd)} ={' '}
              {formatEndpoint(check.nextStart)}
            </span>
          </div>
        ))}
      </div>
      <div className="path-concat-direction-actions">
        <button
          type="button"
          className="toolbar-button"
          onClick={onResetDirections}
        >
          Reset directions
        </button>
        <button
          type="button"
          className="toolbar-button"
          disabled={!draft.canCreate}
          onClick={onCreate}
        >
          Create concatenated path
        </button>
      </div>
    </div>
  )
}

function normalizeDirectionFlags(
  reversed: readonly boolean[],
  count: number,
): boolean[] {
  return Array.from({ length: count }, (_, index) => reversed[index] === true)
}

function pathSnapshotKey(snapshot: PathLikeSnapshot): string {
  return [
    snapshot.id ?? '',
    snapshot.segments.length,
    formatEndpointForKey(snapshot.segments[0]?.start ?? null),
    formatEndpointForKey(snapshot.segments[snapshot.segments.length - 1]?.end ?? null),
  ].join(':')
}

function formatEndpoint(point: Vec3 | null): string {
  if (point === null) {
    return '(unavailable)'
  }

  return `(${formatCoordinate(point.x)},${formatCoordinate(
    point.y,
  )},${formatCoordinate(point.z)})`
}

function formatEndpointForKey(point: Vec3 | null): string {
  return point === null ? '' : `${point.x},${point.y},${point.z}`
}

function formatCoordinate(value: number): string {
  if (!Number.isFinite(value)) {
    return 'NaN'
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
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
