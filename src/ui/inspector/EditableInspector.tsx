import type { CoordinateAnchor, Diagram } from '../../model/types.ts'
import { coordinateAnchorPositionPreview } from '../../model/coordinateAnchors.ts'
import type { TranslationVector } from '../../model/translation.ts'
import { createBulkStyleEditorModel } from '../bulkEditing.ts'
import { createInspectorCompactSummary } from '../inspectorSummary.ts'
import {
  findSelectedElement,
  isMultiSelectedElement,
  type SelectedElement,
} from '../selection.ts'
import { BulkSelectionInspector } from './BulkSelectionInspector.tsx'
import { ReadOnlyField } from './InspectorField.tsx'
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
              <span>Layer: {summary.layer}</span>
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
      <CoordinateAnchorInspector diagram={diagram} anchor={selected.element} />
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
              <span>Layer: {summary.layer}</span>
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
}: {
  diagram: Diagram
  anchor: CoordinateAnchor
}) {
  return (
    <div className="inspector-content editable-inspector">
      <section className="inspector-section">
        <h3>Coordinate</h3>
        <div className="inspector-form">
          <ReadOnlyField label="Type" value="coordinate anchor" />
          <ReadOnlyField label="ID" value={anchor.id} />
          <ReadOnlyField label="Name" value={anchor.name} />
          <ReadOnlyField label="TikZ name" value={anchor.tikzName} />
          <ReadOnlyField label="Layer" value="none (global)" />
          <ReadOnlyField
            label="Source"
            value={
              anchor.position.kind === 'workPlaneLocal'
                ? 'active work-plane local'
                : 'global xyz'
            }
          />
          <ReadOnlyField
            label="Preview"
            value={coordinateAnchorPreviewLabel(diagram, anchor)}
          />
        </div>
      </section>
    </div>
  )
}

function coordinateAnchorPreviewLabel(
  diagram: Diagram,
  anchor: CoordinateAnchor,
): string {
  try {
    const point = coordinateAnchorPositionPreview(
      anchor.position,
      diagram.ambientDimension,
    )
    const values =
      diagram.ambientDimension === 2
        ? [point.x, point.y]
        : [point.x, point.y, point.z]

    return `(${values.join(', ')})`
  } catch {
    return 'unavailable'
  }
}
