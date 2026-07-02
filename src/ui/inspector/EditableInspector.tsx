import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import type { CoordinateAnchor, Diagram } from '../../model/types.ts'
import { coordinateAnchorPositionToVec3 } from '../../model/coordinateAnchors.ts'
import {
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../model/translation.ts'
import {
  createCoordinateAnchorInspectorModel,
  deleteCoordinateAnchorWithDetach,
  updateCoordinateAnchorGlobalCoordinate,
  updateCoordinateAnchorName,
  updateCoordinateAnchorTikzName,
  updateCoordinateAnchorWorkPlaneLocalCoordinate,
} from '../coordinateAnchorEditing.ts'
import { createBulkStyleEditorModel } from '../bulkEditing.ts'
import { createInspectorCompactSummary } from '../inspectorSummary.ts'
import {
  findSelectedElement,
  isCoordinateAnchorSelection,
  isMultiSelectedElement,
  selectedElementCount,
  selectedElements,
  type SelectedElement,
  type MultiSelectedElement,
} from '../selection.ts'
import { BulkSelectionInspector } from './BulkSelectionInspector.tsx'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import {
  EditableTextField,
  ReadOnlyField,
} from './InspectorField.tsx'
import { StratumInspector } from './StratumInspector.tsx'
import { TextLabelInspector } from './TextLabelInspector.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type EditableInspectorProps = {
  diagram: Diagram
  selectedElement: SelectedElement
  onDiagramChange: DiagramChangeHandler
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onBulkLayerChange: (layer: number) => void
  onBulkDelete: () => void
  onBulkDuplicate: () => void
  onBulkTranslate: (translation: TranslationVector) => void
  onCoordinateTranslate: (translation: TranslationVector) => string
  onBulkConcatenatePaths: (
    keepOriginals: boolean,
    directionReversed?: readonly boolean[],
  ) => string
}

export function EditableInspector({
  diagram,
  selectedElement,
  onDiagramChange,
  expanded,
  onExpandedChange,
  onBulkLayerChange,
  onBulkDelete,
  onBulkDuplicate,
  onBulkTranslate,
  onCoordinateTranslate,
  onBulkConcatenatePaths,
}: EditableInspectorProps) {
  if (isMultiSelectedElement(selectedElement)) {
    const summary = createInspectorCompactSummary(diagram, selectedElement)

    if (summary === null) {
      return (
        <div className="empty-inspector">
          <h3>No selection</h3>
          <p>Click a stratum or free text label in the SVG preview.</p>
        </div>
      )
    }

    const bulkStyleModel = createBulkStyleEditorModel(diagram, selectedElement)

    return (
      <div className="editable-inspector-shell">
        <div
          className="inspector-summary"
          aria-label="Selected elements summary"
        >
          <div className="inspector-summary-copy">
            <span className="inspector-summary-title">{summary.title}</span>
            <span className="inspector-summary-meta">
              {summary.layer !== null && <span>Layer: {summary.layer}</span>}
              {summary.detail !== null && <span>{summary.detail}</span>}
            </span>
          </div>
          <button
            type="button"
            className="toolbar-button inspector-toggle-button"
            aria-expanded={expanded}
            aria-controls="inspector-details"
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {expanded && (
          <div id="inspector-details" className="inspector-details-scroll">
            {isCoordinateAnchorSelection(selectedElement) ? (
              <CoordinateAnchorMultiSelectionInspector
                diagram={diagram}
                selection={selectedElement}
                count={selectedElementCount(selectedElement)}
                onCoordinateTranslate={onCoordinateTranslate}
              />
            ) : (
              <BulkSelectionInspector
                diagram={diagram}
                selection={selectedElement}
                model={bulkStyleModel}
                onDiagramChange={onDiagramChange}
                onBulkLayerChange={onBulkLayerChange}
                onBulkDelete={onBulkDelete}
                onBulkDuplicate={onBulkDuplicate}
                onBulkTranslate={onBulkTranslate}
                onBulkConcatenatePaths={onBulkConcatenatePaths}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  const selected = findSelectedElement(diagram, selectedElement)

  if (selected === null) {
    return (
      <div className="empty-inspector">
        <h3>No selection</h3>
        <p>Click a stratum or free text label in the SVG preview.</p>
      </div>
    )
  }

  const summary = createInspectorCompactSummary(diagram, selectedElement)
  const details =
    selected.kind === 'stratum' ? (
      <StratumInspector
        diagram={diagram}
        stratum={selected.element}
        onDiagramChange={onDiagramChange}
      />
    ) : selected.kind === 'coordinate' ? (
      <CoordinateAnchorInspector
        diagram={diagram}
        anchor={selected.element}
        onDiagramChange={onDiagramChange}
      />
    ) : (
      <TextLabelInspector
        diagram={diagram}
        label={selected.element}
        onDiagramChange={onDiagramChange}
      />
    )

  return (
    <div className="editable-inspector-shell">
      {summary !== null && (
        <div className="inspector-summary" aria-label="Selected element summary">
          <div className="inspector-summary-copy">
            <span className="inspector-summary-title">{summary.title}</span>
            <span className="inspector-summary-meta">
              {summary.layer !== null && <span>Layer: {summary.layer}</span>}
              {summary.detail !== null && <span>{summary.detail}</span>}
            </span>
          </div>
          <button
            type="button"
            className="toolbar-button inspector-toggle-button"
            aria-expanded={expanded}
            aria-controls="inspector-details"
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      )}

      {expanded && (
        <div id="inspector-details" className="inspector-details-scroll">
          {details}
        </div>
      )}
    </div>
  )
}

function CoordinateAnchorMultiSelectionInspector({
  diagram,
  selection,
  count,
  onCoordinateTranslate,
}: {
  diagram: Diagram
  selection: MultiSelectedElement
  count: number
  onCoordinateTranslate: (translation: TranslationVector) => string
}) {
  const [dxInput, setDxInput] = useState('0')
  const [dyInput, setDyInput] = useState('0')
  const [dzInput, setDzInput] = useState('0')
  const [statusState, setStatusState] = useState({
    selectionKey: '',
    message: '',
  })
  const selectionKey = selectedElements(selection)
    .map((element) => `${element.kind}:${element.id}`)
    .join('|')
  const status =
    statusState.selectionKey === selectionKey ? statusState.message : ''
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
      setStatusState({
        selectionKey,
        message: parsed.error,
      })
      return
    }

    if (isZero) {
      setStatusState({
        selectionKey,
        message: 'Enter a non-zero translation.',
      })
      return
    }

    setStatusState({
      selectionKey,
      message: onCoordinateTranslate(parsed.translation),
    })
  }

  return (
    <div className="inspector-content editable-inspector">
      <section className="inspector-section">
        <h3>Coordinates</h3>
        <div className="inspector-form">
          <ReadOnlyField
            label="Selected"
            value={`${count} ${count === 1 ? 'coordinate' : 'coordinates'}`}
          />
        </div>
      </section>
      <section className="inspector-section">
        <h3>Translate selected coordinates</h3>
        <form className="inspector-form" onSubmit={submitTranslation}>
          <CoordinateTranslationInput
            label="dx"
            value={dxInput}
            invalid={!parsed.ok && parsed.error.startsWith('dx:')}
            onChange={setDxInput}
          />
          <CoordinateTranslationInput
            label="dy"
            value={dyInput}
            invalid={!parsed.ok && parsed.error.startsWith('dy:')}
            onChange={setDyInput}
          />
          {diagram.ambientDimension === 3 ? (
            <CoordinateTranslationInput
              label="dz"
              value={dzInput}
              invalid={!parsed.ok && parsed.error.startsWith('dz:')}
              onChange={setDzInput}
            />
          ) : (
            <CoordinateTranslationInput
              label="dz"
              value="0"
              invalid={false}
              disabled={true}
              onChange={() => undefined}
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
          {diagram.ambientDimension === 2 && (
            <p className="inspector-status">2D coordinates keep z = 0.</p>
          )}
          {(status !== '' || errorMessage !== '') && (
            <p className="inspector-status" role="status" aria-live="polite">
              {status || errorMessage}
            </p>
          )}
        </form>
      </section>
    </div>
  )
}

function CoordinateTranslationInput({
  label,
  value,
  invalid,
  disabled = false,
  onChange,
}: {
  label: 'dx' | 'dy' | 'dz'
  value: string
  invalid: boolean
  disabled?: boolean
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
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

function CoordinateAnchorInspector({
  diagram,
  anchor,
  onDiagramChange,
}: {
  diagram: Diagram
  anchor: CoordinateAnchor
  onDiagramChange: DiagramChangeHandler
}) {
  const model = createCoordinateAnchorInspectorModel(diagram, anchor)
  const positionPoint = coordinateAnchorPointForInspector(diagram, anchor)
  const [tikzDraft, setTikzDraft] = useState(anchor.tikzName)
  const [tikzError, setTikzError] = useState('')
  const [deleteStatus, setDeleteStatus] = useState('')

  useEffect(() => {
    setTikzDraft(anchor.tikzName)
    setTikzError('')
    setDeleteStatus('')
  }, [anchor.id, anchor.tikzName])

  return (
    <div className="inspector-content editable-inspector">
      <section className="inspector-section">
        <h3>Coordinate</h3>
        <div className="inspector-form">
          <EditableTextField
            label="Name"
            value={anchor.name}
            onChange={(name) =>
              onDiagramChange((currentDiagram) =>
                updateCoordinateAnchorName(currentDiagram, anchor.id, name),
              )
            }
          />
          <label className="inspector-field inspector-field-with-note">
            <span className="inspector-field-label">TikZ name</span>
            <input
              className="inspector-input"
              type="text"
              value={tikzDraft}
              spellCheck={false}
              aria-invalid={tikzError !== ''}
              onChange={(event) => {
                const nextDraft = event.currentTarget.value
                const result = updateCoordinateAnchorTikzName(
                  diagram,
                  anchor.id,
                  nextDraft,
                )

                setTikzDraft(nextDraft)

                if (!result.ok) {
                  setTikzError(result.error)
                  return
                }

                setTikzError('')
                onDiagramChange(result.diagram)
              }}
            />
            {tikzError !== '' && (
              <span className="inspector-field-error" role="status">
                {tikzError}
              </span>
            )}
          </label>
          <ReadOnlyField
            label="Source"
            value={model.sourceLabel}
          />
          {positionPoint === null ? (
            <ReadOnlyField label="Position" value="unavailable" />
          ) : (
            <CoordinateEditor
              label="Position"
              point={positionPoint}
              ambientDimension={diagram.ambientDimension}
              variables={diagram.variables}
              allowSymbolic
              showWorkPlaneLocalSummary={false}
              onCoordinateChange={(axis, value) =>
                onDiagramChange((currentDiagram) =>
                  updateCoordinateAnchorGlobalCoordinate(
                    currentDiagram,
                    anchor.id,
                    axis,
                    value,
                  ),
                )
              }
              onWorkPlaneLocalCoordinateChange={(axis, value) =>
                onDiagramChange((currentDiagram) =>
                  updateCoordinateAnchorWorkPlaneLocalCoordinate(
                    currentDiagram,
                    anchor.id,
                    axis,
                    value,
                  ),
                )
              }
            />
          )}
          <ReadOnlyField label="Preview" value={model.preview} />
          <ReadOnlyField label="Usage" value={model.usageMessage} />
          <div className="inspector-field inspector-field-with-note">
            <span className="inspector-field-label">Delete coordinate</span>
            <button
              type="button"
              className="toolbar-button coordinate-delete-button"
              disabled={model.deleteDisabled}
              title={
                model.deleteMessage ??
                'Delete this coordinate anchor. This can be undone.'
              }
              onClick={() => {
                const result = deleteCoordinateAnchorWithDetach(diagram, anchor.id)

                if (!result.ok) {
                  setDeleteStatus(result.message)
                  return
                }

                setDeleteStatus(result.message)
                onDiagramChange(result.diagram)
              }}
            >
              Delete coordinate
            </button>
            {(model.deleteMessage !== null || deleteStatus !== '') && (
              <span className="inspector-field-note" role="status">
                {deleteStatus || model.deleteMessage}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function coordinateAnchorPointForInspector(
  diagram: Diagram,
  anchor: CoordinateAnchor,
): ReturnType<typeof coordinateAnchorPositionToVec3> | null {
  try {
    return coordinateAnchorPositionToVec3(
      anchor.position,
      diagram.ambientDimension,
    )
  } catch {
    return null
  }
}
