import type { Diagram } from '../../model/types.ts'
import { createInspectorCompactSummary } from '../inspectorSummary.ts'
import {
  findSelectedElement,
  isMultiSelectedElement,
  type SelectedElement,
} from '../selection.ts'
import { StratumInspector } from './StratumInspector.tsx'
import { TextLabelInspector } from './TextLabelInspector.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type EditableInspectorProps = {
  diagram: Diagram
  selectedElement: SelectedElement
  onDiagramChange: DiagramChangeHandler
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

export function EditableInspector({
  diagram,
  selectedElement,
  onDiagramChange,
  expanded,
  onExpandedChange,
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
        </div>
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
