import type { Diagram, WorkPlane } from '../../model/types.ts'
import { findSelectedElement, type SelectedElement } from '../selection.ts'
import { StratumInspector } from './StratumInspector.tsx'
import { TextLabelInspector } from './TextLabelInspector.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type EditableInspectorProps = {
  diagram: Diagram
  selectedElement: SelectedElement
  activeWorkPlane: WorkPlane
  onDiagramChange: DiagramChangeHandler
}

export function EditableInspector({
  diagram,
  selectedElement,
  activeWorkPlane,
  onDiagramChange,
}: EditableInspectorProps) {
  const selected = findSelectedElement(diagram, selectedElement)

  if (selected === null) {
    return (
      <div className="empty-inspector">
        <h3>No selection</h3>
        <p>Click a stratum or free text label in the SVG preview.</p>
      </div>
    )
  }

  return selected.kind === 'stratum' ? (
    <StratumInspector
      diagram={diagram}
      stratum={selected.element}
      activeWorkPlane={activeWorkPlane}
      onDiagramChange={onDiagramChange}
    />
  ) : (
    <TextLabelInspector
      diagram={diagram}
      label={selected.element}
      onDiagramChange={onDiagramChange}
    />
  )
}
