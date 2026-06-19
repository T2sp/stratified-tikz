import type { Diagram, Stratum } from '../../model/types.ts'
import { CurveStyleEditor } from './CurveStyleEditor.tsx'
import { PointStyleEditor } from './PointStyleEditor.tsx'
import { RegionStyleEditor } from './RegionStyleEditor.tsx'
import { SheetStyleEditor } from './SheetStyleEditor.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type StyleEditorProps = {
  diagram: Diagram
  stratum: Stratum
  onDiagramChange: DiagramChangeHandler
}

export function StyleEditor({
  diagram,
  stratum,
  onDiagramChange,
}: StyleEditorProps) {
  switch (stratum.geometricKind) {
    case 'sheet':
      return (
        <SheetStyleEditor
          diagram={diagram}
          sheet={stratum}
          onDiagramChange={onDiagramChange}
        />
      )
    case 'curve':
      return (
        <CurveStyleEditor
          diagram={diagram}
          curve={stratum}
          onDiagramChange={onDiagramChange}
        />
      )
    case 'point':
      return (
        <PointStyleEditor
          diagram={diagram}
          point={stratum}
          onDiagramChange={onDiagramChange}
        />
      )
    case 'region':
      return (
        <RegionStyleEditor
          diagram={diagram}
          region={stratum}
          onDiagramChange={onDiagramChange}
        />
      )
  }
}
