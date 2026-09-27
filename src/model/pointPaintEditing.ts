import { createImportedTikzResolutionContext, importedTikzStylePresetStyle } from './importedTikzStyles.ts'
import { changedPointPaintFields, createImportedPointPaintSnapshot, markPointPaintOverrides, pointStyleForImportedReference } from './styles.ts'
import type { Diagram, PointStyle } from './types.ts'

/** Upgrade historical point styles when edited, retaining every distinguishable edit.
 * Historical equal-valued edits cannot be recovered because old files omitted intent.
 */
export function preparePointStyleForImportedEdit(
  diagram: Diagram, style: PointStyle, referenceId: string | undefined,
): PointStyle {
  const clean = pointStyleForImportedReference(style, referenceId)
  if (referenceId === undefined || clean.importedPaint !== undefined) return clean
  const reference = diagram.importedTikzStyleReferences?.find((entry) => entry.id === referenceId)
  if (reference === undefined) return clean
  const context = createImportedTikzResolutionContext(diagram)
  // Unsupported source execution invalidates historical fallback comparisons.
  // Start from the saved paint so this edit claims only its accepted fields.
  if (context.sourceDiagnostics?.length) return createImportedPointPaintSnapshot(clean, referenceId)
  const baseline = importedTikzStylePresetStyle('point', reference, context)
  const snapshot = createImportedPointPaintSnapshot(baseline, referenceId)
  return markPointPaintOverrides({ ...clean, importedPaint: snapshot.importedPaint }, changedPointPaintFields(baseline, clean))
}
