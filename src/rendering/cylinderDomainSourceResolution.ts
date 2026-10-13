import type { Diagram, PointStratum, PointStyle } from '../model/types.ts'
import { createImportedTikzResolutionContext, importedTikzStylePresetStyle, resolveImportedTikzStyle } from '../model/importedTikzStyles.ts'
import { changedPointLayoutFields, clonePointNodeDimensionSource } from '../model/pointNodeLayout.ts'
import { stylePresetStylesEqual } from '../model/stylePresets.ts'
import { changedPointShapeFields } from '../model/pointShapeParameters.ts'
import { cylinderDomainContextForStyle, type CylinderDomainContext } from '../geometry/pointNodeShapes/cylinderDomain.ts'

/** Mirror the existing exporter option ordering for cylinder division only.
 * The current named reference follows initial numeric literals; local override
 * literals follow the reference. Historical snapshots cannot replace current
 * raw source, and legacy points may inherit through a matching imported preset.
 * The returned map is runtime-only; the Diagram and explicit style stay intact. */
export function resolveCylinderDomainContext(diagram: Diagram, point: PointStratum, style: PointStyle = point.style): CylinderDomainContext | undefined {
  if (style.shape !== 'cylinder') return undefined
  const local = cylinderDomainContextForStyle({ ...style, importedLayout: undefined })
  const preset = diagram.userStylePresets?.find(value => value.id === point.stylePresetId && value.kind === 'point'
    && stylePresetStylesEqual(style, value.style))
  const referenceId = point.importedTikzStyleReferenceId ?? preset?.importedTikzStyleReferenceId
  const reference = diagram.importedTikzStyleReferences?.find(value => value.id === referenceId
    && (value.targets.includes('point') || value.targets.includes('node')))
  if (!reference) return local
  const context = createImportedTikzResolutionContext(diagram)
  const preview = resolveImportedTikzStyle(reference, context)
  const baseline = importedTikzStylePresetStyle('point', reference, context)
  const intent = style.importedLayout?.referenceId === reference.id ? style.importedLayout : undefined
  const fields = new Set(intent?.overriddenFields ?? [])
  if (!preview.executionUncertain) {
    const comparison = intent === undefined ? baseline : { ...baseline, layout: intent.baseline }
    for (const field of changedPointLayoutFields(comparison, style)) fields.add(field)
    if (style.size !== baseline.size) {
      if (style.layout?.innerXSep === undefined) fields.add('innerXSep')
      if (style.layout?.innerYSep === undefined) fields.add('innerYSep')
    }
  }
  for (const field of ['innerXSep', 'innerYSep', 'minimumWidth'] as const) {
    const source = !fields.has(field) ? preview.pointLayout?.units?.[field] : undefined
    if (source) local.dimensionSources[field] = clonePointNodeDimensionSource(source, preview.pointLayout?.fontContext)
  }
  const shapeIntent = style.importedShape?.referenceId === reference.id ? style.importedShape : undefined
  const shapeFields = new Set(shapeIntent?.overriddenFields ?? [])
  if (!preview.executionUncertain) {
    const comparison = shapeIntent === undefined ? baseline : { ...baseline,
      shape: shapeIntent.baselineShape, shapeParameters: shapeIntent.baselineParameters }
    for (const field of changedPointShapeFields(comparison, style)) shapeFields.add(field)
  }
  if (!shapeFields.has('borderRotate') && preview.shapeParameters?.borderRotate !== undefined) local.borderRotate = preview.shapeParameters.borderRotate
  if (!shapeFields.has('borderUsesIncircle') && preview.shapeParameters?.borderUsesIncircle !== undefined) local.borderUsesIncircle = preview.shapeParameters.borderUsesIncircle
  return local
}
