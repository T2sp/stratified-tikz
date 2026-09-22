import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import type { SavedDiagramFile } from '../../src/model/serialization.ts'
import { createSerializeDiagramOptionsForUi } from '../../src/ui/tikzExportMode.ts'
import type { TikzExportUiOptions } from '../../src/ui/tikzExportMode.ts'

/** Input is the independent model snapshot plus observed UI state, never the
 * download. Reuse production normalization ONLY for view metadata; retain every
 * other original document field exactly, including format/version and raw text. */
export function jsonPersistenceExpectation(modelJson: string, settings: TikzExportUiOptions): SavedDiagramFile {
  const original = JSON.parse(modelJson) as SavedDiagramFile
  const parsed = parseSavedDiagramJson(modelJson)
  if (!parsed.ok) throw new Error(parsed.error)
  const normalized = JSON.parse(serializeDiagram(parsed.diagram,
    createSerializeDiagramOptionsForUi(parsed.diagram, settings))) as SavedDiagramFile
  const expected = structuredClone(original)
  if (normalized.diagram.view === undefined) delete expected.diagram.view
  else expected.diagram.view = normalized.diagram.view
  return expected
}
