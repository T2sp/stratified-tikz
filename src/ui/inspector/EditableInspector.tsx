import { useEffect, useState } from 'react'
import type { CoordinateAnchor, Diagram } from '../../model/types.ts'
import { coordinateAnchorPositionToVec3 } from '../../model/coordinateAnchors.ts'
import type { TranslationVector } from '../../model/translation.ts'
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
  isMultiSelectedElement,
  type SelectedElement,
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
