import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum, createUserStylePresetFromStyle, updateUserStylePresetStyle } from '../../src/model/stylePresets.ts'
import { clonePointStyle, cloneStylePreset, getPointPaint, normalizePointStyle, pointStylePresets, pointStylesEqual, refreshImportedPointPaintSnapshot, updatePointColor, updatePointFill } from '../../src/model/styles.ts'
import { pointPaintFields } from '../../src/model/types.ts'
import type { Diagram, PointPaintField, PointStratum, PointStyle, UserPointStylePreset } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { applyBulkStyleField, duplicateSelectedElements } from '../../src/ui/bulkEditing.ts'
import { cloneDiagram, updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { copyStyleFromSelection, pasteStyleClipboardToSelection } from '../../src/ui/styleClipboard.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

function point(diagram: Diagram, id = 'a'): PointStratum {
  const result = diagram.strata.find((entry) => entry.id === id)
  assert.ok(result?.geometricKind === 'point')
  return result
}
function fixture(source = String.raw`\tikzstyle{example}=[fill=\mycolor,text=red]`): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata = ['a', 'b'].map((id) => createPointStratum({ ambientDimension: 2, id, position: { x: 0, y: 0, z: 0 }, text: '  $F$  ' }))
  const imported = importTikzStyleFile(diagram, 'intent.sty', source)
  return applyUserStylePresetToStratum(imported.diagram, 'a', preset(imported.diagram).id)
}
function preset(diagram: Diagram, key = 'example'): UserPointStylePreset {
  const ref = diagram.importedTikzStyleReferences?.find((entry) => entry.key === key)
  const result = diagram.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === ref?.id)
  assert.ok(result?.kind === 'point')
  return result
}
function edit(diagram: Diagram, field: PointPaintField, change: (style: PointStyle) => void): Diagram {
  return updateStratumStyleById(diagram, 'a', (style) => {
    assert.equal(style.kind, 'pointStyle')
    if (style.kind !== 'pointStyle') return style
    const next = clonePointStyle(style)
    change(next)
    return next
  }, [field])
}
function reload(diagram: Diagram): Diagram {
  const result = parseSavedDiagramJson(serializeDiagram(diagram))
  assert.ok(result.ok)
  return result.diagram
}
function state(diagram: Diagram): UndoableEditorState {
  return { editableDiagram: diagram, selectedElement: { kind: 'stratum', id: 'a' }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(diagram) }
}
function options(diagram: Diagram, mode: 'standalone' | 'inlineMath'): { tail: string; colors: Map<string, string> } {
  const tikz = generateTikz(diagram, { exportMode: mode })
  const line = [...tikz.matchAll(/\\node\[([\s\S]*?)\]/g)].map((match) => match[1]).find((entry) => entry.includes('example,'))
  assert.ok(line, tikz)
  return { tail: line.slice(line.indexOf('example,') + 'example,'.length).split(',').map((entry) => entry.trim()).join(','),
    colors: new Map([...tikz.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([^}]+)\}/g)].map((match) => [match[1], `#${match[2].toUpperCase()}`])) }
}
function assertBlackOverride(diagram: Diagram): void {
  for (const mode of ['standalone', 'inlineMath'] as const) {
    const { tail, colors } = options(diagram, mode)
    const fill = tail.match(/(?:^|,)\s*fill=([^,]+)/)?.[1]
    assert.ok(fill, `${mode}: ${tail}`)
    assert.equal(colors.get(fill), '#000000', `${mode}: ${tail}`)
  }
}

test('macro fill edit away and back records local black through reload and production undo/redo', () => {
  const original = fixture()
  assert.deepEqual(point(original).style.importedPaint?.overriddenFields, [])
  for (const mode of ['standalone', 'inlineMath'] as const) assert.doesNotMatch(options(original, mode).tail, /(?:^|,)\s*fill=/)
  const away = edit(original, 'fill.color', (style) => { getPointPaint(style).fill.color = '#123456' })
  const back = edit(away, 'fill.color', (style) => { getPointPaint(style).fill.color = '#000000' })
  assert.deepEqual(point(back).style.importedPaint?.overriddenFields, ['fill.color'])
  assert.equal(getPointPaint(point(back).style).text.color, '#FF0000')
  let current = state(original)
  current = commitDiagramChange(current, { ...current, editableDiagram: away })
  current = commitDiagramChange(current, { ...current, editableDiagram: back })
  assert.equal(getPointPaint(point(undoLastDiagramChange(current).editableDiagram).style).fill.color, '#123456')
  const redone = redoLastDiagramChange(undoLastDiagramChange(current)).editableDiagram
  assertBlackOverride(redone)
  assertBlackOverride(reload(redone))
  assert.equal(point(reload(redone)).text, '  $F$  ')
})

test('legacy diagrams initialize intent at the editing boundary, preserving distinguishable saved edits', () => {
  const old = fixture()
  delete point(old).style.importedPaint
  const importedPreset = preset(old)
  delete importedPreset.style.importedPaint
  getPointPaint(point(old).style).stroke.width = 2.5
  const loaded = reload(old)
  assert.equal(point(loaded).style.importedPaint, undefined)
  const away = edit(loaded, 'fill.color', (style) => { getPointPaint(style).fill.color = '#123456' })
  const back = edit(away, 'fill.color', (style) => { getPointPaint(style).fill.color = '#000000' })
  assert.deepEqual(point(back).style.importedPaint?.overriddenFields, ['fill.color', 'stroke.width'])
  assertBlackOverride(reload(back))
  const equal = edit(loaded, 'fill.color', () => {})
  assertBlackOverride(equal)
})

for (const [field, away, back, expected] of [
  ['fill.opacity', (p: PointStyle) => { getPointPaint(p).fill.opacity = .3 }, (p: PointStyle) => { getPointPaint(p).fill.opacity = 1 }, /fill opacity=1/],
  ['stroke.width', (p: PointStyle) => { getPointPaint(p).stroke.width = 2 }, (p: PointStyle) => { getPointPaint(p).stroke.width = .4 }, /line width=0\.4pt/],
  ['stroke.lineStyle', (p: PointStyle) => { getPointPaint(p).stroke.lineStyle = 'dashed' }, (p: PointStyle) => { getPointPaint(p).stroke.lineStyle = 'solid' }, /(?:^|,)\s*solid(?:,|$)/],
  ['fill.enabled', (p: PointStyle) => { getPointPaint(p).fill.enabled = false }, (p: PointStyle) => { getPointPaint(p).fill.enabled = true }, /(?:^|,)\s*fill(?:,|$)/],
  ['opacity', (p: PointStyle) => { p.opacity = .3 }, (p: PointStyle) => { p.opacity = 1 }, /draw opacity=1/],
] as const) test(`accepted ${field} edit returning to fallback remains authoritative and isolated`, () => {
  const original = fixture(String.raw`\tikzstyle{example}=[fill=\macro,draw=\border,text=\text,fill opacity=\alpha,line width=\width,dash pattern=\dash,opacity=\opacity]`)
  const changed = edit(edit(original, field, away), field, back)
  assert.deepEqual(point(changed).style.importedPaint?.overriddenFields, [field])
  for (const mode of ['standalone', 'inlineMath'] as const) {
    const tail = options(reload(changed), mode).tail
    assert.match(tail, expected)
    assert.doesNotMatch(tail, /(?:^|,)\s*text=/)
    assert.doesNotMatch(tail, /(?:^|,)\s*draw=/)
    assert.doesNotMatch(tail, /(?:^|,)\s*fill=/)
  }
})

test('coupled controls mark only the channels they intentionally edit, including equal values', () => {
  const original = fixture()
  const combined = updateStratumStyleById(original, 'a', (style) => style.kind === 'pointStyle' ? updatePointColor(style, '#000000') : style)
  assert.deepEqual(point(combined).style.importedPaint?.overriddenFields, ['fill.color', 'stroke.color'])
  const hollow = updateStratumStyleById(original, 'a', (style) => style.kind === 'pointStyle' ? updatePointFill(style, 'hollow') : style)
  assert.deepEqual(point(hollow).style.importedPaint?.overriddenFields, ['fill.enabled', 'fill.color', 'fill.opacity'])
})

test('bulk and quick-control production boundary retain returned values and do not claim other channels', () => {
  const original = fixture()
  const away = applyBulkStyleField(original, { kind: 'stratum', id: 'a' }, 'point.fillColor', '#123456')
  const back = applyBulkStyleField(away, { kind: 'stratum', id: 'a' }, 'point.fillColor', '#000000')
  assertBlackOverride(back)
  assert.deepEqual(point(back).style.importedPaint?.overriddenFields, ['fill.color'])
  const line = applyBulkStyleField(original, { kind: 'stratum', id: 'a' }, 'point.strokeLineStyle', 'solid')
  assert.deepEqual(point(line).style.importedPaint?.overriddenFields, ['stroke.lineStyle', 'stroke.dashPattern'])
})

test('reapplying imported preset resets point overrides; editing imported presets stores their own intent', () => {
  const original = fixture()
  const changed = edit(original, 'fill.color', () => {})
  const reset = applyUserStylePresetToStratum(changed, 'a', preset(changed).id)
  assert.deepEqual(point(reset).style.importedPaint?.overriddenFields, [])
  const editedPreset = updateUserStylePresetStyle(original, preset(original).id, preset(original).style, ['fill.color'])
  assert.deepEqual(preset(editedPreset).style.importedPaint?.overriddenFields, ['fill.color'])
  assertBlackOverride(editedPreset)
  assert.deepEqual(preset(reload(editedPreset)).style.importedPaint?.overriddenFields, ['fill.color'])
})

test('copy, paste, duplicate, history and normalization own independent override lists and baseline paint', () => {
  const original = edit(fixture(), 'fill.color', () => {})
  const copied = copyStyleFromSelection(original, { kind: 'stratum', id: 'a' })
  assert.ok(copied.ok && copied.clipboard.geometricKind === 'point')
  const pasted = pasteStyleClipboardToSelection(original, { kind: 'stratum', id: 'b' }, copied.clipboard)
  assert.ok(pasted.ok)
  assert.deepEqual(point(pasted.diagram, 'b').style.importedPaint, point(original).style.importedPaint)
  const duplicated = duplicateSelectedElements(original, { kind: 'stratum', id: 'a' })
  const styles = [clonePointStyle(point(original).style), normalizePointStyle(point(original).style), cloneStylePreset({ style: point(original).style }),
    point(cloneDiagram(original)).style, point(duplicated.diagram, duplicated.idChanges[0].copiedId).style, point(pasted.diagram, 'b').style, copied.clipboard.style,
    point(createDiagramHistory(original).present).style]
  for (const style of styles) {
    assert.ok(style.importedPaint)
    style.importedPaint.overriddenFields.push('text.color')
    style.importedPaint.baseline.fill.color = '#ABCDEF'
  }
  assert.deepEqual(point(original).style.importedPaint?.overriddenFields, ['fill.color'])
  assert.equal(point(original).style.importedPaint?.baseline.fill.color, '#000000')
  assert.equal(pointStylesEqual(point(original).style, styles[0]), false)
})

test('replacement imported references and detached presets/clipboard cannot inherit unrelated intent', () => {
  const changed = edit(fixture(), 'fill.color', () => {})
  const imported = importTikzStyleFile(changed, 'second.sty', String.raw`\tikzstyle{other}=[fill=blue]`)
  const replaced = applyUserStylePresetToStratum(imported.diagram, 'a', preset(imported.diagram, 'other').id)
  assert.deepEqual(point(replaced).style.importedPaint?.overriddenFields, [])
  assert.equal(point(replaced).style.importedPaint?.referenceId, point(replaced).importedTikzStyleReferenceId)
  const detached = createUserStylePresetFromStyle(changed, 'point', 'Saved explicit', point(changed).style)
  assert.ok(detached?.preset.kind === 'point')
  assert.equal(detached.preset.style.importedPaint, undefined)
  const copied = copyStyleFromSelection(changed, { kind: 'stratum', id: 'a' })
  assert.ok(copied.ok)
  const clean = createEmptyDiagram({ ambientDimension: 2 })
  clean.strata = [createPointStratum({ ambientDimension: 2, id: 'b', position: { x: 0, y: 0, z: 0 } })]
  const pasted = pasteStyleClipboardToSelection(clean, { kind: 'stratum', id: 'b' }, copied.clipboard)
  assert.ok(pasted.ok)
  assert.equal(point(pasted.diagram, 'b').style.importedPaint, undefined)
  assert.equal(point(pasted.diagram, 'b').importedTikzStyleReferenceId, undefined)
})

for (const [name, invalid] of [
  ['null', null], ['empty', {}], ['invalid property', { overriddenFields: ['text'] }],
  ['duplicate fields', { overriddenFields: ['fill.color', 'fill.color'] }],
  ['wrong reference', { referenceId: 'unrelated' }], ['invalid baseline', { baseline: null }],
] as const) test(`invalid intent metadata rejects visibly: ${name}`, () => {
  const saved = JSON.parse(serializeDiagram(fixture())) as { diagram: Diagram }
  const style = point(saved.diagram).style
  const record = style as unknown as Record<string, unknown>
  record.importedPaint = invalid === null ? null : name === 'empty' ? {} : { ...style.importedPaint, ...invalid }
  const result = parseSavedDiagramJson(JSON.stringify(saved))
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /importedPaint/)
})

test('missing paint with invalid provenance is validated without throwing during legacy normalization', () => {
  const saved = JSON.parse(serializeDiagram(fixture())) as { diagram: Diagram }
  const record = point(saved.diagram).style as unknown as Record<string, unknown>
  delete record.paint
  record.importedPaint = null
  const result = parseSavedDiagramJson(JSON.stringify(saved))
  assert.equal(result.ok, false)
})

test('snapshot refresh preserves explicit/manual local values and leaves untracked historical styles alone', () => {
  const old = point(fixture()).style
  const resolved = clonePointStyle(old)
  getPointPaint(resolved).fill.color = '#FF0000'
  getPointPaint(resolved).text.color = '#00FF00'
  const explicit = clonePointStyle(old)
  getPointPaint(explicit).stroke.width = 2
  const refreshed = refreshImportedPointPaintSnapshot(explicit, resolved, old.importedPaint!.referenceId)
  assert.equal(getPointPaint(refreshed).fill.color, '#FF0000')
  assert.equal(getPointPaint(refreshed).stroke.width, 2)
  assert.deepEqual(refreshed.importedPaint?.overriddenFields, ['stroke.width'])
  delete explicit.importedPaint
  assert.equal(refreshImportedPointPaintSnapshot(explicit, resolved, 'unknown'), explicit)
})


test('built-in preset selection explicitly chooses all paint settings even equal fallback colors', () => {
  const original = fixture()
  const changed = updateStratumStyleById(original, 'a', () => cloneStylePreset(pointStylePresets[0]), pointPaintFields)
  assert.deepEqual(point(changed).style.importedPaint?.overriddenFields, [...pointPaintFields])
  assertBlackOverride(changed)
})
