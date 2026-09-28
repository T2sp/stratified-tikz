import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { parseSavedDiagramJson, savedDiagramFormat, serializeDiagram } from '../../src/model/serialization.ts'
import { clonePointStyle, cloneStylePreset, defaultPointStyle, getPointPaint, normalizePointStyle, pointStylesEqual, updatePointColor, updatePointFill } from '../../src/model/styles.ts'
import { applyUserStylePresetToStratum, createUserStylePresetFromStyle } from '../../src/model/stylePresets.ts'
import type { Diagram, PointPaint, PointStratum, PointStyle } from '../../src/model/types.ts'
import { hiddenPointStyleFromBase } from '../../src/model/visibility.ts'
import { applyBulkStyleField, duplicateSelectedElements } from '../../src/ui/bulkEditing.ts'
import { copyStyleFromSelection, pasteStyleClipboardToSelection } from '../../src/ui/styleClipboard.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

const paint: PointPaint = {
  text: { color: '#FF0000', opacity: 0.7 },
  fill: { enabled: true, color: '#0000FF', opacity: 0.35 },
  stroke: { enabled: true, color: '#008000', opacity: 0.8, width: 2.5,
    lineStyle: 'dashed', dashPattern: [2, 1], dashPhase: -0.5, lineCap: 'round', lineJoin: 'bevel' },
}
const source = '  $F$\t\\alpha\n  '
function explicitStyle(): PointStyle { return { ...defaultPointStyle, paint: structuredClone(paint) } }
function point(diagram: Diagram, index = 0): PointStratum {
  const value = diagram.strata[index]
  assert.equal(value.geometricKind, 'point')
  if (value.geometricKind !== 'point') throw new Error('Expected point')
  return value
}
function diagram(): Diagram {
  return { ...createEmptyDiagram({ ambientDimension: 2 }), strata: [
    createPointStratum({ ambientDimension: 2, id: 'a', position: { x: 0, y: 0, z: 0 }, text: source, style: explicitStyle() }),
    createPointStratum({ ambientDimension: 2, id: 'b', position: { x: 1, y: 0, z: 0 } }),
  ] }
}

test('legacy paint normalization preserves black text, white hollow, 0.4pt border and opacity', () => {
  const old: PointStyle = { ...defaultPointStyle, color: '#AABBCC', opacity: 0.3, shape: 'triangle', fill: 'hollow', size: 7 }
  const normalized = normalizePointStyle(old)
  assert.deepEqual(normalized.paint, {
    text: { color: '#000000', opacity: 1 },
    fill: { enabled: true, color: '#FFFFFF', opacity: 1 },
    stroke: { enabled: true, color: '#AABBCC', opacity: 1, width: 0.4,
      lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' },
  })
  assert.equal(normalized.opacity, 0.3)
  assert.equal(normalized.size, 7)
  assert.equal(normalized.shape, 'triangle')
  assert.equal(old.paint, undefined)
  assert.equal(pointStylesEqual(old, normalized), true)
})

test('authoritative paint ignores legacy color/fill metadata and distinguishes disabled and zero paint', () => {
  const style = explicitStyle()
  style.color = '#FFFFFF'; style.fill = 'hollow'
  assert.deepEqual(getPointPaint(style), paint)
  const changed = clonePointStyle(style)
  assert.ok(changed.paint)
  changed.paint.fill.enabled = false
  assert.equal(pointStylesEqual(style, changed), false)
  changed.paint.fill.enabled = true; changed.paint.fill.opacity = 0
  assert.equal(pointStylesEqual(style, changed), false)
})

test('point clones, normalized styles and built-in clone helper own every nested paint object', () => {
  const style = explicitStyle()
  for (const clone of [clonePointStyle(style), normalizePointStyle(style), cloneStylePreset({ style })]) {
    assert.ok(clone.paint)
    clone.paint.text.color = '#123456'; clone.paint.fill.opacity = 0; clone.paint.stroke.dashPattern?.push(4, 2)
  }
  assert.deepEqual(style.paint, paint)
})

test('v1 documents and point user presets load deterministically and save explicit file v2 paint', () => {
  const oldStyle: PointStyle = { ...defaultPointStyle, fill: 'hollow', color: '#AABBCC', size: 9 }
  const oldDiagram = diagram()
  point(oldDiagram).style = oldStyle
  oldDiagram.userStylePresets = [{ id: 'old', name: 'Old', kind: 'point', style: { ...oldStyle }, tikzStyleName: 'oldPoint' }]
  const loaded = parseSavedDiagramJson(JSON.stringify({ format: savedDiagramFormat, version: 1, diagram: oldDiagram }))
  assert.equal(loaded.ok, true)
  if (!loaded.ok) throw new Error('Expected successful load')
  assert.equal(point(loaded.diagram).text, source)
  assert.equal(point(loaded.diagram).style.paint?.fill.color, '#FFFFFF')
  assert.equal(loaded.diagram.userStylePresets?.[0].style.kind, 'pointStyle')
  const preset = loaded.diagram.userStylePresets?.[0]
  if (preset?.kind !== 'point') throw new Error('Expected point preset')
  assert.equal(preset.style.paint?.stroke.width, 0.4)
  assert.notEqual(preset.style.paint, point(loaded.diagram).style.paint)
  const saved = JSON.parse(serializeDiagram(loaded.diagram)) as { version: number; diagram: Diagram }
  assert.equal(saved.version, 2)
  assert.equal(saved.diagram.version, 1)
  assert.deepEqual(saved.diagram.strata, loaded.diagram.strata)
})

test('new point paint, zero alpha, transparent fill, disabled border and raw text round trip', () => {
  const original = diagram()
  const style = point(original).style
  assert.ok(style.paint)
  style.paint.text.opacity = 0; style.paint.fill.enabled = false; style.paint.stroke.enabled = false
  const loaded = parseSavedDiagramJson(serializeDiagram(original))
  assert.equal(loaded.ok, true)
  if (!loaded.ok) throw new Error('Expected successful load')
  assert.deepEqual(point(loaded.diagram), point(original))
})

for (const [field, invalid] of [
  ['paint', null], ['text', null], ['opacity', 1.1], ['width', 0], ['width', -1], ['dashPattern', [0, 0]], ['dashPattern', [2]], ['lineCap', 'unknown'],
] as const) {
  test(`invalid explicit point paint is rejected visibly: ${field} ${JSON.stringify(invalid)}`, () => {
    const saved: unknown = JSON.parse(serializeDiagram(diagram()))
    const record = saved as { diagram: { strata: { style: Record<string, unknown> }[] } }
    const style = record.diagram.strata[0].style
    const channels = style.paint as Record<string, unknown>
    if (field === 'paint') style.paint = invalid
    else if (field === 'text') channels.text = invalid
    else (channels.stroke as Record<string, unknown>)[field] = invalid
    const result = parseSavedDiagramJson(JSON.stringify(saved))
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /paint/)
  })
}

test('point presets, duplication and clipboard do not share nested mutable paint', () => {
  const original = diagram()
  const created = createUserStylePresetFromStyle(original, 'point', 'Independent', point(original).style)
  assert.ok(created)
  const applied = applyUserStylePresetToStratum(created.diagram, 'b', created.preset.id)
  const copied = copyStyleFromSelection(applied, { kind: 'stratum', id: 'a' })
  assert.equal(copied.ok, true)
  if (!copied.ok) throw new Error('Expected copied style')
  const pasted = pasteStyleClipboardToSelection(applied, { kind: 'stratum', id: 'b' }, copied.clipboard)
  assert.equal(pasted.ok, true)
  const duplicated = duplicateSelectedElements(pasted.diagram, { kind: 'stratum', id: 'b' })
  const last = point(duplicated.diagram, duplicated.diagram.strata.length - 1)
  assert.ok(last.style.paint)
  last.style.paint.text.color = '#FFFFFF'; last.style.paint.stroke.dashPattern?.push(5, 1)
  assert.deepEqual(point(original).style.paint, paint)
  assert.deepEqual(point(pasted.diagram, 1).style.paint, paint)
  assert.equal(copied.clipboard.geometricKind, 'point')
  assert.deepEqual(copied.clipboard.style, point(original).style)
  assert.deepEqual(created.preset.style, point(original).style)
})

test('bulk and quick legacy paint controls preserve independent channels and own targets', () => {
  const original = diagram()
  const selection = { kind: 'multi', elements: [{ kind: 'stratum', id: 'a' }, { kind: 'stratum', id: 'b' }] } as const
  const changed = applyBulkStyleField(original, { ...selection, elements: [...selection.elements] }, 'point.textColor', '#ABCDEF')
  assert.equal(point(changed).style.paint?.text.color, '#ABCDEF')
  assert.equal(point(changed, 1).style.paint?.text.color, '#ABCDEF')
  assert.notEqual(point(changed).style.paint, point(changed, 1).style.paint)
  assert.deepEqual(point(original).style.paint, paint)
  assert.equal(applyBulkStyleField(changed, { kind: 'stratum', id: 'a' }, 'point.strokeOpacity', Infinity), changed)
  assert.equal(applyBulkStyleField(changed, { kind: 'stratum', id: 'a' }, 'point.strokeWidth', 0), changed)
  const recolored = updatePointColor(point(changed).style, '#123456')
  assert.equal(recolored.paint?.text.color, '#ABCDEF')
  assert.equal(recolored.paint?.stroke.color, '#123456')
  const hollow = updatePointFill(recolored, 'hollow')
  assert.deepEqual(hollow.paint?.fill, { enabled: true, color: '#FFFFFF', opacity: 1 })
})

test('one paint edit is one undo entry and redo retains source and other channels', () => {
  const original = diagram()
  const initial: UndoableEditorState = { editableDiagram: original, selectedElement: { kind: 'stratum', id: 'a' }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(original) }
  const changed = updateStratumStyleById(original, 'a', (style) => style.kind === 'pointStyle' ? updatePointFill(style, 'hollow') : style)
  const committed = commitDiagramChange(initial, { ...initial, editableDiagram: changed })
  assert.deepEqual(undoLastDiagramChange(committed).editableDiagram, original)
  assert.deepEqual(redoLastDiagramChange(undoLastDiagramChange(committed)).editableDiagram, changed)
  assert.equal(point(changed).text, source)
  assert.deepEqual(point(changed).style.paint?.text, paint.text)
})

test('hidden point dimming changes only overall alpha once and owns captured paint', () => {
  const style = explicitStyle(); style.opacity = 0.5
  const hidden = hiddenPointStyleFromBase(style)
  assert.equal(hidden.opacity, 0.14)
  assert.deepEqual(hidden.paint, paint)
  assert.notEqual(hidden.paint, style.paint)
})


test('tracked legacy point/preset fixture survives edit, duplicate, copy, bulk, undo and reload', () => {
  const loaded = parseSavedDiagramJson(readFileSync(new URL('../fixtures/point-paint/legacy-v1.json', import.meta.url), 'utf8'))
  assert.equal(loaded.ok, true)
  if (!loaded.ok) throw new Error('Expected successful load')
  const legacy = point(loaded.diagram)
  assert.equal(legacy.style.shape, 'square')
  assert.equal(legacy.style.size, 9)
  assert.equal(legacy.style.opacity, 0.5)
  assert.equal(legacy.style.paint?.text.color, '#000000')
  assert.equal(legacy.style.paint?.fill.color, '#FFFFFF')
  const duplicated = duplicateSelectedElements(loaded.diagram, { kind: 'stratum', id: legacy.id })
  const duplicateId = duplicated.idChanges[0].copiedId
  const painted = applyBulkStyleField(duplicated.diagram, { kind: 'stratum', id: legacy.id }, 'point.textColor', '#FF0000')
  const copied = copyStyleFromSelection(painted, { kind: 'stratum', id: legacy.id })
  assert.equal(copied.ok, true)
  if (!copied.ok) throw new Error('Expected copied style')
  const pasted = pasteStyleClipboardToSelection(painted, { kind: 'stratum', id: duplicateId }, copied.clipboard)
  assert.equal(pasted.ok, true)
  const initial: UndoableEditorState = { editableDiagram: loaded.diagram, selectedElement: { kind: 'stratum', id: legacy.id }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(loaded.diagram) }
  const committed = commitDiagramChange(initial, { ...initial, editableDiagram: pasted.diagram })
  assert.deepEqual(undoLastDiagramChange(committed).editableDiagram, loaded.diagram)
  const final = redoLastDiagramChange(undoLastDiagramChange(committed)).editableDiagram
  const reloaded = parseSavedDiagramJson(serializeDiagram(final))
  assert.equal(reloaded.ok, true)
  if (!reloaded.ok) throw new Error('Expected successful reload')
  assert.deepEqual(reloaded.diagram.strata, final.strata)
  assert.deepEqual(reloaded.diagram.userStylePresets, loaded.diagram.userStylePresets)
  assert.equal(point(reloaded.diagram).text, source)
  assert.equal(point(reloaded.diagram).style.paint?.stroke.width, 0.4)
  assert.equal(point(reloaded.diagram).style.paint?.fill.color, '#FFFFFF')
})
