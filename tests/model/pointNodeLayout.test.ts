import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { resolveTikzPaint } from '../../src/model/importedTikzPaint.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { clonePointNodeLayout, defaultPointNodeFontContext, parsePointNodeDimension, pointNodeLayoutIssues, resolvePointNodeLayoutOptions, updateLegacyPointSize, updatePointNodeDimension } from '../../src/model/pointNodeLayout.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum, createUserStylePresetFromStyle } from '../../src/model/stylePresets.ts'
import { clonePointStyle, defaultPointStyle, pointStylesEqual } from '../../src/model/styles.ts'
import type { Diagram, PointStratum, PointStyle } from '../../src/model/types.ts'
import { duplicateSelectedElements } from '../../src/ui/bulkEditing.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { copyStyleFromSelection, pasteStyleClipboardToSelection } from '../../src/ui/styleClipboard.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

function point(diagram: Diagram, index = 0): PointStratum {
  const value = diagram.strata[index]
  if (value.geometricKind !== 'point') throw Error('Expected point')
  return value
}
function styleWith(source: string): PointStyle {
  const result = updatePointNodeDimension(defaultPointStyle, ['innerXSep', 'innerYSep'], source)
  assert.ok(result)
  return result
}

test('omitted axes preserve legacy size/2, 1pt PGF minima and half-border outer separation', () => {
  const resolved = resolvePointNodeLayoutOptions(defaultPointStyle)
  assert.deepEqual(resolved, { innerXSep: 1.5, innerYSep: 1.5, outerXSep: .2, outerYSep: .2, minimumWidth: 1, minimumHeight: 1, anchor: 'center', fontContext: defaultPointNodeFontContext })
  assert.equal(resolvePointNodeLayoutOptions({ ...defaultPointStyle, size: 8, layout: { innerXSep: 0 } }).innerYSep, 4)
  assert.equal(resolvePointNodeLayoutOptions({ ...defaultPointStyle, layout: { outerYSep: -3 } }, 2).outerXSep, 1)
  assert.equal(resolvePointNodeLayoutOptions({ ...defaultPointStyle, layout: { minimumWidth: 0, minimumHeight: -2 } }).minimumWidth, 0)
  assert.equal(pointStylesEqual(defaultPointStyle, { ...defaultPointStyle, layout: { innerXSep: 1.5 } }), false, 'explicit default preserves edit intent')
})
for (const [source, expected] of [['1in', 72.27], ['2.54cm', 72.27], ['25.4mm', 72.27], ['72.27pt', 72.27], ['72bp', 72.27]] as const) test(`physical units use TeX 72.27pt/in: ${source}`, () => {
  assert.ok(Math.abs((parsePointNodeDimension(source)?.texPoints ?? NaN) - expected) < 1e-10)
  assert.notEqual(parsePointNodeDimension(source)?.texPoints, 72, 'CSS/big-point inch is not TeX inch')
})
test('em and ex retain recorded context while direct numeric values remain TeX points', () => {
  const context = { fontSizePt: 12, xHeightPt: 5.2 }
  assert.equal(parsePointNodeDimension('2em', context)?.texPoints, 24)
  assert.equal(parsePointNodeDimension('-2ex', context)?.texPoints, -10.4)
  const preview = resolveTikzPaint('inner xsep=2em,inner ysep=-2ex,minimum width=72bp', { pointFontContext: context })
  assert.deepEqual(preview.pointLayout?.fontContext, context)
  assert.deepEqual(pointNodeLayoutIssues(preview.pointLayout), [])
  assert.equal(preview.pointLayout?.innerXSep, 24)
  assert.equal(preview.pointLayout?.innerYSep, -10.4)
  assert.equal(preview.pointLayout?.minimumWidth, 72.27)
  const saved = styleWith(' .5em ')
  assert.equal(saved.layout?.units?.innerXSep?.source, ' .5em ')
  assert.deepEqual(saved.layout?.fontContext, defaultPointNodeFontContext)
})
test('ordered shorthand sets both axes and later axis values override only that axis', () => {
  const preview = resolveTikzPaint('inner xsep=8pt,inner sep=0pt,inner ysep=-2pt,outer ysep=8pt,outer sep=-1mm,outer xsep=0,minimum height=80pt,minimum size=20pt,minimum width=30pt,anchor=base east')
  assert.equal(preview.diagnostics, undefined)
  const resolved = resolvePointNodeLayoutOptions({ ...defaultPointStyle, layout: preview.pointLayout })
  assert.deepEqual({ x: resolved.innerXSep, y: resolved.innerYSep, ox: resolved.outerXSep, oy: resolved.outerYSep, w: resolved.minimumWidth, h: resolved.minimumHeight, anchor: resolved.anchor },
    { x: 0, y: -2, ox: 0, oy: -72.27 / 25.4, w: 30, h: 20, anchor: 'base east' })
  assert.equal(preview.pointLayout?.units?.innerXSep?.source, '0pt')
  assert.deepEqual(resolveTikzPaint('a,inner xsep=3pt', { styles: [{ key: 'a', options: 'inner sep=2pt,outer sep=-1pt,minimum size=10pt' }] }).pointLayout,
    resolveTikzPaint('inner sep=2pt,outer sep=-1pt,minimum size=10pt,inner xsep=3pt').pointLayout)
})
test('zero and valid negative dimensions are finite explicit values, never positive-only fallbacks', () => {
  for (const source of ['0', '-0pt', '-1mm', '-10000pt', '10000pt']) {
    const style = styleWith(source)
    assert.deepEqual(pointNodeLayoutIssues(style.layout), [])
    assert.equal(resolvePointNodeLayoutOptions(style).innerXSep, parsePointNodeDimension(source)?.texPoints)
  }
  for (const source of ['Infinity', 'NaN', '1e3pt', '1px', '10001pt', String.raw`\padding`, '2pt+1pt']) assert.equal(parsePointNodeDimension(source), null, source)
  const preview = resolveTikzPaint('inner sep=bogus,inner xsep=0pt')
  assert.ok(preview.diagnostics?.length)
  assert.ok(preview.unresolvedFields?.includes('pointLayout.innerYSep'))
  assert.ok(!preview.unresolvedFields?.includes('pointLayout.innerXSep'))
  assert.equal(preview.pointLayout?.innerXSep, 0)
})
test('legacy size editing clears explicit padding and source metadata on both axes', () => {
  const result = updateLegacyPointSize({ ...styleWith('-1ex'), layout: { ...styleWith('-1ex').layout, minimumWidth: 20, outerXSep: 5 } }, 8)
  assert.equal(result.layout?.innerXSep, undefined)
  assert.equal(result.layout?.innerYSep, undefined)
  assert.equal(result.layout?.units?.innerXSep, undefined)
  assert.equal(resolvePointNodeLayoutOptions(result).innerXSep, 4)
  assert.equal(result.layout?.minimumWidth, 20)
  assert.equal(result.layout?.outerXSep, 5)
  const oneAxis = updatePointNodeDimension(styleWith('2pt'), ['innerYSep'], '')
  assert.equal(oneAxis?.layout?.innerXSep, 2)
  assert.equal(oneAxis?.layout?.innerYSep, undefined)
  assert.equal(resolvePointNodeLayoutOptions(oneAxis!).innerYSep, 1.5)
})
test('layout validation rejects forged dimensions or contextual metadata and keeps unsupported literal anchors', () => {
  for (const invalid of [null, [], { innerXSep: NaN }, { innerYSep: Infinity }, { outerXSep: 10001 }, { bad: 2 }, { anchor: String.raw`\macro` },
    { fontContext: { fontSizePt: 10, xHeightPt: 0 } }, { innerXSep: 2, units: { innerXSep: { source: '3pt', unit: 'pt', texPoints: 2 } } },
    { innerXSep: 10, units: { innerXSep: { source: '1em', unit: 'em', texPoints: 10 } } }]) assert.ok(pointNodeLayoutIssues(invalid).length)
  for (const anchor of ['center', 'base west', 'shape center', 'outer point 64', '-37.5', 'unknown anchor']) assert.deepEqual(pointNodeLayoutIssues({ anchor }), [])
  const unsupported = resolveTikzPaint('text height=10pt,text depth=2pt,text width=5cm,align=center')
  assert.equal(unsupported.pointLayout, undefined)
  assert.equal(unsupported.diagnostics?.length, 4)
  for (const key of ['inner sep', 'inner xsep', 'outer sep', 'outer ysep', 'minimum size', 'minimum height', 'anchor']) {
    const imported = importTikzStyleFile(createEmptyDiagram({ ambientDimension: 2 }), 'unsafe.sty', `\\tikzset{${key}/.code={\\def\\unsafe{1}},layout/.style={circle}}`)
    assert.equal(imported.source, null, key)
  }
})
for (const ambientDimension of [2, 3] as const) test(`${ambientDimension}D layout remains explicit through save, presets, clipboard, clone, duplicate and history`, () => {
  const style: PointStyle = { ...styleWith('-1mm'), layout: { ...styleWith('-1mm').layout, innerYSep: 0, outerXSep: 4, outerYSep: -2, minimumWidth: 30, minimumHeight: 7, anchor: 'base east',
    units: { innerXSep: styleWith('-1mm').layout!.units!.innerXSep! } } }
  const diagram = createEmptyDiagram({ ambientDimension })
  diagram.strata = [createPointStratum({ ambientDimension, id: 'p', position: { x: 1, y: 2, z: ambientDimension === 2 ? 0 : 3 }, text: ' \t $F$ \n ', style }), createPointStratum({ ambientDimension, id: 'q', position: { x: 3, y: 2, z: 0 } })]
  const preset = createUserStylePresetFromStyle(diagram, 'point', 'Layout', style); assert.ok(preset)
  const applied = applyUserStylePresetToStratum(preset.diagram, 'q', preset.preset.id)
  const copied = copyStyleFromSelection(applied, { kind: 'stratum', id: 'p' }); assert.ok(copied.ok)
  const pasted = pasteStyleClipboardToSelection(applied, { kind: 'stratum', id: 'q' }, copied.clipboard); assert.ok(pasted.ok)
  const duplicated = duplicateSelectedElements(pasted.diagram, { kind: 'stratum', id: 'p' })
  const loaded = parseSavedDiagramJson(serializeDiagram(duplicated.diagram)); assert.ok(loaded.ok)
  assert.deepEqual(point(loaded.diagram).style.layout, style.layout)
  assert.deepEqual(point(loaded.diagram, 1).style.layout, style.layout)
  assert.equal(point(loaded.diagram).codim, ambientDimension)
  assert.equal(point(loaded.diagram).text, ' \t $F$ \n ')
  const clone = clonePointStyle(point(loaded.diagram).style); clone.layout!.units!.innerXSep!.source = '3pt'; clone.layout!.innerXSep = 3
  assert.equal(point(loaded.diagram).style.layout?.units?.innerXSep?.source, '-1mm')
  assert.equal(pointStylesEqual(clone, style), false)
  const layoutClone = clonePointNodeLayout(style.layout!); layoutClone.minimumWidth = 80; assert.equal(style.layout?.minimumWidth, 30)
  const initial: UndoableEditorState = { editableDiagram: diagram, selectedElement: { kind: 'stratum', id: 'p' }, layerFilter: allLayersFilter, polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(diagram) }
  const committed = commitDiagramChange(initial, { ...initial, editableDiagram: duplicated.diagram })
  assert.deepEqual(undoLastDiagramChange(committed).editableDiagram, diagram)
  assert.deepEqual(redoLastDiagramChange(undoLastDiagramChange(committed)).editableDiagram, duplicated.diagram)
})
test('imported layout provenance refreshes only inherited fields and preserves equal-valued controls', () => {
  const base = createEmptyDiagram({ ambientDimension: 2 })
  base.strata = [createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } })]
  const imported = importTikzStyleFile(base, 'layout.sty', String.raw`\tikzset{layout/.style={rectangle,inner sep=2pt,outer sep=1pt,minimum size=10pt,anchor=base}}`)
  const preset = imported.diagram.userStylePresets?.find((entry) => entry.kind === 'point'); assert.ok(preset)
  const applied = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
  const edited = updateStratumStyleById(applied, 'p', (style) => style.kind === 'pointStyle' ? updatePointNodeDimension(style, ['innerXSep'], '2pt')! : style)
  assert.ok(point(edited).style.importedLayout?.overriddenFields.includes('innerXSep'))
  const refreshed = importTikzStyleFile(edited, 'replacement.sty', String.raw`\tikzset{layout/.style={rectangle,inner sep=7pt,outer sep=3pt,minimum size=12pt,anchor=north}}`).diagram
  assert.equal(point(refreshed).style.layout?.innerXSep, 2)
  assert.equal(point(refreshed).style.layout?.innerYSep, 7)
  assert.equal(point(refreshed).style.layout?.anchor, 'north')
  const loaded = parseSavedDiagramJson(serializeDiagram(refreshed)); assert.ok(loaded.ok)
  assert.deepEqual(point(loaded.diagram).style.importedLayout, point(refreshed).style.importedLayout)
})
for (const [localAxis, inheritedAxis] of [['innerXSep', 'innerYSep'], ['innerYSep', 'innerXSep']] as const) test(`contextual ${localAxis} override and ${inheritedAxis} inheritance keep independent unit contexts through refresh and save/load`, () => {
  const base = createEmptyDiagram({ ambientDimension: 2 })
  base.strata = [createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } })]
  const imported = importTikzStyleFile(base, 'foo.sty', String.raw`\tikzset{foo/.style={rectangle,inner xsep=2pt,inner ysep=1pt}}`)
  const preset = imported.diagram.userStylePresets?.find((entry) => entry.kind === 'point'); assert.ok(preset)
  const applied = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
  const localContext = { fontSizePt: 12, xHeightPt: 5.2 }
  const edited = updateStratumStyleById(applied, 'p', (style) => style.kind === 'pointStyle' ? updatePointNodeDimension({ ...style, layout: { ...style.layout, fontContext: localContext } }, [localAxis], '2em')! : style)
  assert.equal(point(edited).style.layout?.[localAxis], 24)
  assert.deepEqual(point(edited).style.layout?.units?.[localAxis]?.fontContext, localContext)
  const source = localAxis === 'innerXSep' ? String.raw`\tikzset{foo/.style={rectangle,inner xsep=3pt,inner ysep=2em}}` : String.raw`\tikzset{foo/.style={rectangle,inner xsep=2em,inner ysep=3pt}}`
  const refreshed = importTikzStyleFile(edited, 'replacement.sty', source).diagram
  const layout = point(refreshed).style.layout!
  assert.equal(layout[localAxis], 24)
  assert.equal(layout[inheritedAxis], 20)
  assert.equal(layout.units?.[localAxis]?.source, '2em')
  assert.equal(layout.units?.[inheritedAxis]?.source, '2em')
  assert.deepEqual(layout.units?.[localAxis]?.fontContext, localContext)
  assert.deepEqual(layout.units?.[inheritedAxis]?.fontContext, defaultPointNodeFontContext)
  assert.deepEqual(layout.fontContext, defaultPointNodeFontContext)
  assert.deepEqual(pointNodeLayoutIssues(layout), [])
  const loaded = parseSavedDiagramJson(serializeDiagram(refreshed)); assert.ok(loaded.ok)
  assert.deepEqual(point(loaded.diagram).style.layout, layout)
  assert.ok(loaded.diagram.externalTikzStyleSources?.at(-1)?.rawSource?.includes(source))
  const sameAxis = updatePointNodeDimension(point(loaded.diagram).style, [localAxis], '2em')!
  assert.equal(sameAxis.layout?.[localAxis], 24, 'editing the same source retains its recorded axis context')
  assert.equal(sameAxis.layout?.[inheritedAxis], 20)
  const shorthand = updatePointNodeDimension(sameAxis, ['innerXSep', 'innerYSep'], '2em')!
  assert.equal(shorthand.layout?.innerXSep, 20)
  assert.equal(shorthand.layout?.innerYSep, 20)
  assert.deepEqual(shorthand.layout?.units?.innerXSep?.fontContext, defaultPointNodeFontContext)
  assert.deepEqual(shorthand.layout?.units?.innerYSep?.fontContext, defaultPointNodeFontContext)
  const cloned = clonePointStyle(point(loaded.diagram).style)
  cloned.layout!.units![localAxis]!.fontContext!.fontSizePt = 99
  assert.equal(point(loaded.diagram).style.layout?.units?.[localAxis]?.fontContext?.fontSizePt, 12)
})
test('legacy global-only contextual metadata remains valid and captures its own context before mixing axes', () => {
  const legacy = { innerXSep: 24, fontContext: { fontSizePt: 12, xHeightPt: 5.2 }, units: { innerXSep: { source: '2em', unit: 'em' as const, texPoints: 24 } } }
  assert.deepEqual(pointNodeLayoutIssues(legacy), [])
  const cloned = clonePointNodeLayout(legacy)
  assert.equal(Object.hasOwn(legacy.units.innerXSep, 'fontContext'), false)
  assert.deepEqual(cloned.units?.innerXSep?.fontContext, legacy.fontContext)
  cloned.fontContext = { ...defaultPointNodeFontContext }
  assert.deepEqual(pointNodeLayoutIssues(cloned), [], 'per-axis provenance has precedence over the current global context')
  for (const fontContext of [{ fontSizePt: 0, xHeightPt: 5.2 }, { fontSizePt: 12, xHeightPt: Infinity }, { fontSizePt: 12, xHeightPt: 5.2, extra: 1 }]) {
    assert.ok(pointNodeLayoutIssues({ ...cloned, units: { innerXSep: { ...cloned.units!.innerXSep!, fontContext } } }).some((issue) => issue.field === 'units.innerXSep.fontContext'))
  }
})
test('legacy files and presets remain omitted rather than inventing layout axes', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata = [createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 }, style: { ...defaultPointStyle, size: 8 } })]
  const json = JSON.parse(serializeDiagram(diagram)) as { version: number; diagram: { strata: { style: Record<string, unknown> }[] } }
  json.version = 1; delete json.diagram.strata[0].style.paint
  const loaded = parseSavedDiagramJson(JSON.stringify(json)); assert.ok(loaded.ok)
  assert.equal(point(loaded.diagram).style.layout, undefined)
  assert.equal(resolvePointNodeLayoutOptions(point(loaded.diagram).style).innerXSep, 4)
})
test('a layout-omitting imported style inherits the explicit app default that precedes its TikZ key', () => {
  const base = createEmptyDiagram({ ambientDimension: 2 })
  base.strata = [createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } })]
  const imported = importTikzStyleFile(base, 'layout.sty', String.raw`\tikzset{layout/.style={rectangle}}`)
  const preset = imported.diagram.userStylePresets?.find((entry) => entry.kind === 'point'); assert.ok(preset)
  const applied = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
  assert.equal(point(applied).style.layout, undefined)
  assert.deepEqual(point(applied).style.importedLayout?.baseline, {})
  const resolved = resolvePointNodeLayoutOptions(point(applied).style)
  assert.equal(resolved.innerXSep, 1.5)
  assert.equal(resolved.innerYSep, 1.5)
  assert.equal(resolved.outerXSep, .2)
  assert.equal(resolved.outerYSep, .2)
  assert.equal(resolved.minimumWidth, 1)
  assert.equal(resolved.minimumHeight, 1)
  assert.equal(resolved.anchor, 'center')
})
