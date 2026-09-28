// Offline comparison only. Neither importing nor rendering executes TeX.
import assert from 'node:assert/strict'
import { createEmptyDiagram, createPointStratum } from '../../../../src/model/constructors.ts'
import {
  createImportedTikzResolutionContext,
  importTikzStyleFile,
  resolveImportedTikzStyle,
} from '../../../../src/model/importedTikzStyles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../../../src/model/serialization.ts'
import { applyUserStylePresetToStratum } from '../../../../src/model/stylePresets.ts'
import { getPointPaint } from '../../../../src/model/styles.ts'

export const executionCases = ['macro', 'conditional', 'groupedColor', 'bounds']

export function buildExecutionFixture(name, source) {
  assert.ok(executionCases.includes(name))
  const original = createEmptyDiagram({ ambientDimension: 2 })
  original.strata = [createPointStratum({ ambientDimension: 2, id: 'p', text: 'APP', position: { x: 0, y: 0, z: 0 } })]
  const originalJson = serializeDiagram(original)
  const rejected = importTikzStyleFile(original, `${name}.sty`, source)
  assert.equal(rejected.diagram, original)
  assert.equal(serializeDiagram(original), originalJson)
  assert.equal(rejected.references.length, 0)
  assert.equal(rejected.parseResult.styles.length, 0)
  assert.equal(rejected.parseResult.declarations.length, 0)
  assert.deepEqual(rejected.parseResult.colors, {})
  assert.equal(Object.keys(rejected.parseResult.rawOptions).length, 0)
  assert.ok(rejected.parseResult.executionDiagnostics.length > 0)

  // Recreate the pre-fix wrong snapshot through the real import/application
  // path. Substitute only the retained independent source for JSON reload.
  const oldWrongColor = name === 'bounds' ? 'blue' : 'red'
  const imported = importTikzStyleFile(original, `${name}.sty`, String.raw`\tikzset{myPoint/.style={text=${oldWrongColor}}}`)
  const reference = imported.references.find((entry) => entry.key === 'myPoint')
  assert.ok(reference)
  const preset = imported.diagram.userStylePresets.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference.id)
  assert.ok(preset)
  const applied = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
  const stale = {
    ...applied,
    externalTikzStyleSources: applied.externalTikzStyleSources.map((entry) => ({ ...entry, rawSource: source })),
    importedTikzStyleReferences: applied.importedTikzStyleReferences.map((entry) => ({
      ...entry,
      rawOptions: name === 'groupedColor' ? 'text=Custom' : 'text=red',
      previewDiagnostics: [],
    })),
  }
  const staleJson = serializeDiagram(stale)
  const loaded = parseSavedDiagramJson(staleJson)
  assert.equal(loaded.ok, true)
  assert.equal(loaded.diagram.externalTikzStyleSources[0].rawSource, source)
  const reloadedReference = loaded.diagram.importedTikzStyleReferences.find((entry) => entry.id === reference.id)
  assert.ok(reloadedReference)
  const resolved = resolveImportedTikzStyle(reloadedReference, createImportedTikzResolutionContext(loaded.diagram))
  assert.ok(resolved.unresolvedFields.includes('textColor'))
  assert.ok(resolved.diagnostics.length > 0)
  const reapplied = applyUserStylePresetToStratum(loaded.diagram, 'p', preset.id)
  const reappliedJson = serializeDiagram(reapplied)
  const roundTrip = parseSavedDiagramJson(reappliedJson)
  assert.equal(roundTrip.ok, true)
  assert.equal(roundTrip.diagram.externalTikzStyleSources[0].rawSource, source)
  return {
    diagram: loaded.diagram,
    reapplied: roundTrip.diagram,
    staleJson,
    observations: {
      rejected: {
        sameDiagramIdentity: rejected.diagram === original,
        unchangedJson: serializeDiagram(original) === originalJson,
        references: rejected.references.length,
        styles: rejected.parseResult.styles.length,
        declarations: rejected.parseResult.declarations.length,
        colors: rejected.parseResult.colors,
        rawOptions: rejected.parseResult.rawOptions,
        diagnostics: rejected.parseResult.executionDiagnostics,
      },
      reloaded: {
        rawSourceUnchanged: loaded.diagram.externalTikzStyleSources[0].rawSource === source,
        reference: reloadedReference,
        resolution: resolved,
        previewFallback: getPointPaint(loaded.diagram.strata[0].style),
        presetReapplicationRoundTrip: roundTrip.ok,
      },
    },
  }
}
