// Production-path fixture setup only. TeX execution belongs to the offline
// compiler commands; neither this helper nor its registered tests executes it.
import assert from 'node:assert/strict'
import { createEmptyDiagram, createPointStratum } from '../../../../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../../../../src/model/importedTikzStyles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../../../../src/model/serialization.ts'
import { applyUserStylePresetToStratum } from '../../../../../src/model/stylePresets.ts'
import { clonePointStyle, getPointPaint } from '../../../../../src/model/styles.ts'
import type { Diagram, HexColor } from '../../../../../src/model/types.ts'
import { updateStratumStyleById } from '../../../../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../../../../src/ui/layerFilter.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../../../../src/ui/undo.ts'

export const exactSource = String.raw`\tikzset{myPoint/.style={line width={+1pt\relax\globalcolorstrue\definecolor{red}{HTML}{0000FF}},text=red}}`
export interface PaintValueVariant {
  name: string
  diagram: Diagram
  local?: Partial<Record<'text' | 'fill', HexColor>>
}
export function point(diagram: Diagram) {
  const value = diagram.strata[0]
  assert.ok(value?.geometricKind === 'point')
  return value
}
export function reload(diagram: Diagram): Diagram {
  const result = parseSavedDiagramJson(serializeDiagram(diagram))
  assert.ok(result.ok)
  assert.ok(result.diagram.externalTikzStyleSources?.every((source) => source.rawSource === exactSource))
  return result.diagram
}
export function edit(diagram: Diagram, channel: 'text' | 'fill', color: HexColor): Diagram {
  return updateStratumStyleById(diagram, 'p', (style) => {
    assert.ok(style.kind === 'pointStyle')
    const next = clonePointStyle(style)
    getPointPaint(next)[channel].color = color
    return next
  }, [`${channel}.color`])
}
function apply(diagram: Diagram): Diagram {
  const reference = diagram.importedTikzStyleReferences?.find((entry) => entry.key === 'myPoint')
  assert.ok(reference)
  const preset = diagram.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference.id)
  assert.ok(preset)
  return applyUserStylePresetToStratum(diagram, 'p', preset.id)
}
function state(diagram: Diagram): UndoableEditorState {
  return { editableDiagram: diagram, selectedElement: { kind: 'stratum', id: 'p' }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(diagram) }
}
export function createPaintValueExecutionVariants(): { variants: PaintValueVariant[]; stale: Diagram } {
  const original = createEmptyDiagram({ ambientDimension: 2 })
  original.strata = [createPointStratum({ ambientDimension: 2, id: 'p', text: 'APP', position: { x: 0, y: 0, z: 0 } })]
  const applied = apply(importTikzStyleFile(original, 'runtime.sty', exactSource).diagram)
  // Build an old resolved red snapshot using the supported production path,
  // then restore authoritative raw source. An old value is not an authored edit.
  const stale = apply(importTikzStyleFile(original, 'runtime.sty', String.raw`\tikzset{myPoint/.style={text=red}}`).diagram)
  assert.equal(getPointPaint(point(stale).style).text.color, '#FF0000')
  for (const source of stale.externalTikzStyleSources ?? []) source.rawSource = exactSource
  for (const reference of stale.importedTikzStyleReferences ?? []) reference.previewDiagnostics = ['Retained saved diagnostic.']
  const staleLoaded = reload(stale)
  const fallback = getPointPaint(point(applied).style)
  assert.equal(fallback.text.color, '#000000')
  assert.equal(fallback.fill.color, '#000000')
  const textEdited = edit(applied, 'text', '#FF0000')
  const bothEdited = edit(textEdited, 'fill', '#FFFF00')
  let current = state(applied)
  current = commitDiagramChange(current, { ...current, editableDiagram: textEdited })
  current = commitDiagramChange(current, { ...current, editableDiagram: bothEdited })
  assert.equal(current.history.past.length, 2)
  const undo = undoLastDiagramChange(undoLastDiagramChange(current))
  assert.equal(serializeDiagram(undo.editableDiagram), serializeDiagram(applied))
  const redo = redoLastDiagramChange(redoLastDiagramChange(undo))
  const refreshed = importTikzStyleFile(applied, 'runtime.sty', exactSource).diagram
  const editedRefreshed = importTikzStyleFile(bothEdited, 'runtime.sty', exactSource).diagram
  return { stale, variants: [
    { name: 'untouched', diagram: applied },
    { name: 'reloaded', diagram: reload(applied) },
    { name: 'stale-reloaded', diagram: staleLoaded },
    { name: 'preset-reapplied', diagram: reload(apply(staleLoaded)) },
    { name: 'refreshed', diagram: reload(refreshed) },
    { name: 'local-text-red', diagram: reload(textEdited), local: { text: '#FF0000' } },
    { name: 'local-text-fallback', diagram: reload(edit(applied, 'text', fallback.text.color)), local: { text: '#000000' } },
    { name: 'local-fill-yellow', diagram: reload(edit(applied, 'fill', '#FFFF00')), local: { fill: '#FFFF00' } },
    { name: 'local-fill-fallback', diagram: reload(edit(applied, 'fill', fallback.fill.color)), local: { fill: '#000000' } },
    { name: 'edited-refreshed', diagram: reload(editedRefreshed), local: { text: '#FF0000', fill: '#FFFF00' } },
    { name: 'undo', diagram: reload(undo.editableDiagram) },
    { name: 'redo', diagram: reload(redo.editableDiagram), local: { text: '#FF0000', fill: '#FFFF00' } },
  ] }
}
