import { createImportedTikzResolutionContext, importedTikzStylePresetStyle, resolveImportedTikzStyle } from './importedTikzStyles.ts'
import { changedPointPaintFields, createImportedPointPaintSnapshot, markPointPaintOverrides, pointStyleForImportedReference } from './styles.ts'
import { changedPointLayoutFields, markPointLayoutOverrides } from './pointNodeLayout.ts'
import type { Diagram, PointStyle } from './types.ts'

/** Upgrade historical point styles when edited, retaining every distinguishable edit.
 * Historical equal-valued edits cannot be recovered because old files omitted intent.
 */
export function preparePointStyleForImportedEdit(
  diagram: Diagram, style: PointStyle, referenceId: string | undefined,
): PointStyle {
  const clean = pointStyleForImportedReference(style, referenceId)
  if (referenceId === undefined || (clean.importedPaint !== undefined && clean.importedLayout !== undefined)) return clean
  const reference = diagram.importedTikzStyleReferences?.find((entry) => entry.id === referenceId)
  if (reference === undefined) return clean
  const context = createImportedTikzResolutionContext(diagram)
  // Unsupported source/runtime execution invalidates fallback comparisons.
  // Start from the saved paint so this edit claims only its accepted fields.
  if (resolveImportedTikzStyle(reference, context).executionUncertain) return createImportedPointPaintSnapshot(clean, referenceId)
  const baseline = importedTikzStylePresetStyle('point', reference, context)
  const snapshot = createImportedPointPaintSnapshot(baseline, referenceId)
  return markPointLayoutOverrides(markPointPaintOverrides({ ...clean, importedPaint: clean.importedPaint ?? snapshot.importedPaint,
    importedLayout: snapshot.importedLayout }, changedPointPaintFields(baseline, clean)), changedPointLayoutFields(baseline, clean))
}
