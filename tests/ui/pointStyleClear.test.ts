import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import { clonePointStyle, getPointPaint } from '../../src/model/styles.ts'
import { pointPaintFields } from '../../src/model/types.ts'
import type { Diagram, PointStratum, PointStyle, Vec3 } from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { applyContextQuickStyleField, applyContextQuickStylePreset } from '../../src/ui/contextQuickStyleBar.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

test('the reported redpoint clear leaves a valid, reloadable point through commit, undo and redo', () => {
  let diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata = [createPointStratum({
    ambientDimension: 2, id: 'p', position: point(0, 0), text: '  $F$  ',
  })]
  diagram = importTikzStyleFile(diagram, 'paint.sty', String.raw`\tikzstyle{redpoint}=[fill=red]`).diagram
  const preset = diagram.userStylePresets?.find((candidate) => candidate.kind === 'point')
  assert.ok(preset)
  diagram = applyUserStylePresetToStratum(diagram, 'p', preset.id)
  assert.equal(validateDiagram(diagram).valid, true)
  assert.ok(findPoint(diagram, 'p').style.importedPaint)

  const cleared = clearPointsWithHistory(diagram, ['p'])
  assert.deepEqual(getPointPaint(findPoint(cleared, 'p').style), {
    text: { color: '#000000', opacity: 1 },
    fill: { enabled: true, color: '#FF0000', opacity: 1 },
    stroke: { enabled: true, color: '#000000', opacity: 1, width: 0.4,
      lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' },
  })
  assertClearedPointTikz(cleared, 'p', 'redpoint')
})

for (const [fillEnabled, strokeEnabled, customDash] of [
  [true, true, true], [false, true, false], [true, false, true], [false, false, false],
] as const) test(`clearing independently edited point retains paint (fill=${fillEnabled}, border=${strokeEnabled}, custom dash=${customDash})`, () => {
  let diagram = importedPointClearDiagram()
  diagram = updateStratumStyleById(diagram, 'p', (style) => {
    assert.equal(style.kind, 'pointStyle')
    if (style.kind !== 'pointStyle') return style
    return {
      ...clonePointStyle(style), opacity: 0.8, shape: 'square', size: 7.5,
      paint: {
        text: { color: '#123456', opacity: 0.75 },
        fill: { enabled: fillEnabled, color: '#ABCDEF', opacity: 0.5 },
        stroke: { enabled: strokeEnabled, color: '#654321', opacity: 0.25,
          width: 2.3, lineStyle: 'denselyDotted', dashPhase: 1.25,
          lineCap: 'round', lineJoin: 'bevel',
          ...(customDash ? { dashPattern: [2, 1, 4, 3] } : {}),
        },
      },
    }
  }, pointPaintFields)
  const edited = findPoint(diagram, 'p')
  assert.ok(edited.importedTikzStyleReferenceId)
  assert.ok(edited.style.importedPaint)
  assert.deepEqual(edited.style.importedPaint.overriddenFields, [...pointPaintFields])
  const cleared = clearPointsWithHistory(diagram, ['p'])
  assertClearedPointTikz(cleared, 'p', 'redpoint')
  const paint = getPointPaint(findPoint(cleared, 'p').style)
  assert.deepEqual(paint.text, { color: '#123456', opacity: 0.75 })
  assert.deepEqual(paint.fill, { enabled: fillEnabled, color: '#ABCDEF', opacity: 0.5 })
  assert.deepEqual(paint.stroke, { enabled: strokeEnabled, color: '#654321', opacity: 0.25,
    width: 2.3, lineStyle: 'denselyDotted', dashPhase: 1.25, lineCap: 'round', lineJoin: 'bevel',
    ...(customDash ? { dashPattern: [2, 1, 4, 3] } : {}),
  })
})

test('multi-point clear is one immutable action and keeps an unselected imported point and source records', () => {
  const diagram = importedPointClearDiagram()
  const before = structuredClone(diagram)
  const control = findPoint(diagram, 'control')
  const cleared = clearPointsWithHistory(diagram, ['p', 'q'])
  assert.strictEqual(findPoint(cleared, 'control'), control)
  assert.deepEqual(findPoint(cleared, 'control'), findPoint(before, 'control'))
  assert.strictEqual(cleared.userStylePresets, diagram.userStylePresets)
  assert.strictEqual(cleared.importedTikzStyleReferences, diagram.importedTikzStyleReferences)
  assert.strictEqual(cleared.externalTikzStyleSources, diagram.externalTikzStyleSources)
  for (const id of ['p', 'q']) assertClearedPointTikz(cleared, id, 'redpoint')
  for (const mode of ['standalone', 'inlineMath'] as const) {
    const tikz = generateTikz(cleared, { exportMode: mode })
    assert.ok(pointTikzOptions(tikz, control.text ?? '').includes('redpoint'))
  }
})

test('ordinary quick-bar paint edits keep the external association and provenance', () => {
  const diagram = importedPointClearDiagram()
  const before = findPoint(diagram, 'p')
  const edited = applyContextQuickStyleField(diagram, { kind: 'stratum', id: 'p' }, 'point.color', '#123456')
  const after = findPoint(edited, 'p')
  assert.equal(after.stylePresetId, undefined)
  assert.equal(after.importedTikzStyleReferenceId, before.importedTikzStyleReferenceId)
  assert.equal(after.style.importedPaint?.referenceId, before.importedTikzStyleReferenceId)
  assert.deepEqual(after.style.importedPaint?.overriddenFields, ['fill.color', 'stroke.color'])
  assert.deepEqual(before.style.importedPaint?.overriddenFields, [])
  assertValidPointDiagramReload(edited)
})

function importedPointClearDiagram(): Diagram {
  const empty = createEmptyDiagram({ ambientDimension: 2 })
  let diagram: Diagram = {
    ...empty,
    strata: ['p', 'q', 'control'].map((id, index) => createPointStratum({
      ambientDimension: 2, id, name: `Point ${id}`, position: point(index + 1.25, -2),
      text: `  $F_${id}$  `,
    })),
  }
  diagram = importTikzStyleFile(diagram, 'paint.sty', String.raw`\tikzstyle{redpoint}=[fill=red,text=blue,draw=green]`).diagram
  const preset = diagram.userStylePresets?.find((candidate) => candidate.kind === 'point')
  assert.ok(preset)
  const applied = applyContextQuickStylePreset(diagram, {
    kind: 'multi', elements: diagram.strata.map(({ id }) => ({ kind: 'stratum', id })),
  }, preset.id)
  assert.ok(applied.ok)
  return applied.diagram
}

function clearPointsWithHistory(diagram: Diagram, ids: readonly string[]): Diagram {
  const original = structuredClone(diagram)
  const selection: SelectedElement = ids.length === 1
    ? { kind: 'stratum', id: ids[0] }
    : { kind: 'multi', elements: ids.map((id) => ({ kind: 'stratum', id })) }
  const initial = editorState(diagram, selection)
  const initialHistory = structuredClone(initial.history)
  freezeTree(diagram)
  freezeTree(initial.history)
  const result = applyContextQuickStylePreset(diagram, selection, null)
  assert.ok(result.ok)
  assert.equal(result.appliedCount, ids.length)
  assertValidPointDiagramReload(result.diagram)
  const committed = commitDiagramChange(initial, { ...initial, editableDiagram: result.diagram })
  assert.equal(committed.history.past.length, 1)
  assert.equal(committed.history.future.length, 0)
  const repeated = applyContextQuickStylePreset(committed.editableDiagram, selection, null)
  assert.ok(repeated.ok)
  assert.strictEqual(repeated.diagram, committed.editableDiagram)
  const noOp = commitDiagramChange(committed, { ...committed, editableDiagram: repeated.diagram })
  assert.strictEqual(noOp.history, committed.history)
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)
  assert.deepEqual(undone.editableDiagram, original)
  assert.deepEqual(redone.editableDiagram, result.diagram)
  assert.equal(redone.history.past.length, 1)
  assert.equal(redone.history.future.length, 0)
  for (const state of [initial, committed, undone, redone]) {
    for (const snapshot of [state.editableDiagram, state.history.present, ...state.history.past, ...state.history.future]) {
      assertValidPointDiagramReload(snapshot)
    }
  }
  for (const id of ids) {
    const before = findPoint(diagram, id)
    const after = findPoint(result.diagram, id)
    const expected = structuredClone(before)
    delete expected.stylePresetId
    delete expected.importedTikzStyleReferenceId
    delete expected.style.importedPaint
    assert.deepEqual(after, expected, 'only the preset, external association and its provenance are removed')
    assert.notStrictEqual(after.style, before.style)
    assert.notStrictEqual(after.style.paint, before.style.paint)
    assert.notStrictEqual(after.style.paint?.fill, before.style.paint?.fill)
    if (before.style.paint?.stroke.dashPattern !== undefined) {
      assert.notStrictEqual(after.style.paint?.stroke.dashPattern, before.style.paint.stroke.dashPattern)
    }
    assert.deepEqual(findPoint(undone.editableDiagram, id), before)
    assert.notStrictEqual(findPoint(undone.editableDiagram, id).style.importedPaint, before.style.importedPaint)
    assert.deepEqual(findPoint(redone.editableDiagram, id), expected)
    assert.notStrictEqual(findPoint(redone.editableDiagram, id).style.paint, after.style.paint)
  }
  assert.deepEqual(diagram, original)
  assert.deepEqual(initial.history, initialHistory)
  return result.diagram
}

function assertValidPointDiagramReload(diagram: Diagram): void {
  const validation = validateDiagram(diagram)
  assert.equal(validation.valid, true, JSON.stringify(validation))
  const loaded = parseSavedDiagramJson(serializeDiagram(diagram))
  assert.ok(loaded.ok, JSON.stringify(loaded))
  assert.equal(validateDiagram(loaded.diagram).valid, true)
  assert.deepEqual(loaded.diagram.strata, diagram.strata)
}

function pointTikzOptions(tikz: string, body: string): string[] {
  const target = [...tikz.matchAll(/\\node\[([\s\S]*?)\] at \([^)]+\) \{([\s\S]*?)\};/g)]
    .filter((match) => match[2] === body)
  assert.equal(target.length, 1, `one target node with raw body ${body}`)
  return target[0][1].split(',').map((option) => option.trim())
}

function assertClearedPointTikz(diagram: Diagram, id: string, importedKey: string): void {
  const target = findPoint(diagram, id)
  const style: PointStyle = target.style
  const paint = getPointPaint(style)
  for (const mode of ['standalone', 'inlineMath'] as const) {
    const tikz = generateTikz(diagram, { exportMode: mode })
    const options = pointTikzOptions(tikz, target.text ?? '')
    assert.ok(!options.includes(importedKey), `${mode}: the cleared target has no external invocation`)
    const colors = new Map([...tikz.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([\dA-Fa-f]{6})\}/g)]
      .map((match) => [match[1], `#${match[2].toUpperCase()}`]))
    const value = (key: string): string | undefined => options.filter((option) => option.startsWith(`${key}=`)).at(-1)?.slice(key.length + 1)
    assert.equal(colors.get(value('text') ?? ''), paint.text.color)
    assert.equal(paint.fill.enabled ? colors.get(value('fill') ?? '') : value('fill'), paint.fill.enabled ? paint.fill.color : 'none')
    assert.equal(paint.stroke.enabled ? colors.get(value('draw') ?? '') : value('draw'), paint.stroke.enabled ? paint.stroke.color : 'none')
    for (const [key, opacity] of [['text', paint.text.opacity], ['fill', paint.fill.opacity], ['draw', paint.stroke.opacity]] as const) {
      assert.ok(Math.abs(Number(value(`${key} opacity`)) - opacity * style.opacity) < 1e-10)
    }
    assert.equal(value('line width'), `${paint.stroke.width}pt`)
    assert.equal(value('dash phase'), `${paint.stroke.dashPhase}pt`)
    assert.equal(value('line cap'), paint.stroke.lineCap)
    assert.equal(value('line join'), paint.stroke.lineJoin)
    assert.equal(value('inner sep'), `${style.size / 2}pt`)
    if (style.shape === 'square') {
      assert.ok(options.includes('regular polygon'))
      assert.equal(value('regular polygon sides'), '4')
    } else {
      assert.ok(options.includes('circle'))
    }
    if (paint.stroke.dashPattern !== undefined) {
      assert.equal(value('dash pattern'), paint.stroke.dashPattern.map((length, index) => `${index % 2 === 0 ? 'on' : 'off'} ${length}pt`).join(' '))
    } else {
      assert.ok(options.includes(paint.stroke.lineStyle === 'denselyDotted' ? 'densely dotted' : paint.stroke.lineStyle))
    }
  }
}

function freezeTree(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  Object.freeze(value)
  for (const child of Object.values(value)) freezeTree(child)
}

function editorState(editableDiagram: Diagram, selectedElement: SelectedElement): UndoableEditorState {
  return { editableDiagram, selectedElement, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null,
    history: createDiagramHistory(editableDiagram),
  }
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)
  assert.ok(stratum?.geometricKind === 'point', `Expected point ${id}.`)
  return stratum
}

function point(x: number, y: number): Vec3 {
  return { x, y, z: 0 }
}
