import { fillRules } from '../../model/types.ts'
import type { Diagram } from '../../model/types.ts'
import { updateFilledStratumFillRule } from '../filledStratumEditing.ts'
import type { FilledBoundaryStratum } from '../filledStratumEditing.ts'
import { createFilledBoundaryGeometryFields } from '../inspectorSummary.ts'
import {
  EditableSelectField,
  ReadOnlyField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type FilledBoundaryGeometryEditorProps = {
  diagram: Diagram
  stratum: FilledBoundaryStratum
  onDiagramChange: DiagramChangeHandler
}

export function FilledBoundaryGeometryEditor({
  diagram,
  stratum,
  onDiagramChange,
}: FilledBoundaryGeometryEditorProps) {
  const fields = createFilledBoundaryGeometryFields(
    stratum,
    diagram.ambientDimension,
  )

  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        {fields.map((field) =>
          field.label === 'Fill rule' ? (
            <EditableSelectField
              key={field.label}
              label={field.label}
              value={stratum.fillRule}
              options={fillRules}
              onChange={(fillRule) =>
                onDiagramChange((currentDiagram) =>
                  updateFilledStratumFillRule(
                    currentDiagram,
                    stratum.id,
                    fillRule,
                  ),
                )
              }
            />
          ) : (
            <ReadOnlyField
              key={field.label}
              label={field.label}
              value={field.value}
            />
          ),
        )}
      </div>
    </section>
  )
}
