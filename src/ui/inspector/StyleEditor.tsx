import type { Stratum } from '../../model/types.ts'
import { CurveStyleEditor } from './CurveStyleEditor.tsx'
import { PointStyleEditor } from './PointStyleEditor.tsx'
import { RegionStyleEditor } from './RegionStyleEditor.tsx'
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
      return <RegionStyleEditor region={stratum} onDiagramChange={onDiagramChange} />
  }
}
