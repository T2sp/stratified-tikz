import type { Stratum } from '../../model/types.ts'
import { formatStratumStyleSummary } from '../inspectorSummary.ts'
import { CurveStyleEditor } from './CurveStyleEditor.tsx'
import { ReadOnlyField } from './InspectorField.tsx'
import { PointStyleEditor } from './PointStyleEditor.tsx'
import { SheetStyleEditor } from './SheetStyleEditor.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type StyleEditorProps = {
  stratum: Stratum
  onDiagramChange: DiagramChangeHandler
}

export function StyleEditor({
  stratum,
  onDiagramChange,
}: StyleEditorProps) {
  switch (stratum.geometricKind) {
    case 'sheet':
      return <SheetStyleEditor sheet={stratum} onDiagramChange={onDiagramChange} />
    case 'curve':
      return <CurveStyleEditor curve={stratum} onDiagramChange={onDiagramChange} />
    case 'point':
      return <PointStyleEditor point={stratum} onDiagramChange={onDiagramChange} />
    case 'region':
      return (
        <section className="inspector-section">
          <h3>Style</h3>
          <div className="inspector-form">
            <ReadOnlyField
              label={stratum.style.kind}
              value={formatStratumStyleSummary(stratum.style)}
            />
          </div>
        </section>
      )
  }
}
