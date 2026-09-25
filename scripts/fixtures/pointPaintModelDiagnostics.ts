import { createImportedTikzResolutionContext, resolveImportedTikzStyle } from '../../src/model/importedTikzStyles.ts'
import type { Diagram } from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'

/** Read the App's detached runtime snapshot without saved-file normalization.
 * The input is JSON.stringify(editableDiagram), not serializeDiagram output. */
export function pointPaintModelDiagnostics(runtimeDiagramJson: string, id = 'app-point') {
  const diagram = JSON.parse(runtimeDiagramJson) as Diagram
  const point = diagram.strata.find((entry) => entry.id === id)
  const reference = diagram.importedTikzStyleReferences?.find((entry) => entry.id === point?.importedTikzStyleReferenceId)
  return { validation: validateDiagram(diagram), reference,
    resolution: reference ? resolveImportedTikzStyle(reference, createImportedTikzResolutionContext(diagram)) : null }
}
