import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  createRegionStratum,
  createSheetStratum,
} from '../../src/model/constructors.ts'
import {
  createCoordinateAnchor,
  symbolicVec3FromVec3,
} from '../../src/model/coordinateAnchors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import {
  defaultCurveStyle,
  defaultPointStyle,
  defaultRegionStyle,
  defaultSheetStyle,
} from '../../src/model/styles.ts'
import type {
  CurveStratum,
  Diagram,
  PointStratum,
  RegionStratum,
  SheetStratum,
  UserStylePreset,
  Vec3,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  applyContextQuickStylePreset,
  applyContextQuickStyleField,
  createContextQuickStyleBarModel,
  createContextQuickStylePresetModel,
  filterContextQuickStylePresetOptions,
  updateRecentContextQuickStylePresetIds,
  updateContextQuickStyleNumericDraft,
  type ContextQuickStyleField,
} from '../../src/ui/contextQuickStyleBar.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

const quickBarSource = readFileSync(
  new URL('../../src/ui/ContextQuickStyleBar.tsx', import.meta.url),
  'utf8',
)
const appSource = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')

type TestEditorState = UndoableEditorState & {
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
}

test('context quick style bar appears for a selected curve', () => {
  const model = createContextQuickStyleBarModel(curveDiagram(), curveASelection())

  assert.equal(model?.geometricKind, 'curve')
  assert.deepEqual(
    model?.fields.map((field) => field.label),
    ['Stroke', 'Width', 'Arrow'],
  )
})

test('context quick style bar source exposes style transfer controls', () => {
  assert.match(quickBarSource, /aria-label="Copy style"/)
  assert.match(quickBarSource, /Paste style; clipboard/)
  assert.match(quickBarSource, /aria-label="Style eyedropper"/)
  assert.match(appSource, /onCopyStyle=\{copyCurrentSelectionStyle\}/)
  assert.match(appSource, /onPasteStyle=\{pasteCurrentSelectionStyle\}/)
  assert.match(appSource, /onStartStyleEyedropper=\{startStyleEyedropper\}/)
})

test('context quick style bar source exposes searchable TikZ style controls', () => {
  assert.match(quickBarSource, /aria-label="TikZ style selector"/)
  assert.match(quickBarSource, /aria-label="Search TikZ styles"/)
  assert.match(quickBarSource, /aria-label="Clear TikZ style"/)
  assert.match(quickBarSource, /label="Recent"/)
  assert.match(quickBarSource, /label="Imported"/)
  assert.match(appSource, /onApplyStylePreset=/)
  assert.match(appSource, /onClearStylePreset=/)
  assert.match(appSource, /recentStylePresetIds=\{recentQuickTikzStylePresetIds\}/)
})

test('stroke width slider uses step 0.1', () => {
  const model = requiredModel(curveDiagram(), curveASelection())
  const field = requiredSliderField(model, 'curve.lineWidth')

  assert.equal(field.slider.step, 0.1)
  assert.equal(field.slider.min, 0.1)
})

test('stroke width numeric draft accepts .5 and commits 0.5', () => {
  const model = requiredModel(curveDiagram(), curveASelection())
  const field = requiredSliderField(model, 'curve.lineWidth')
  const draft = updateContextQuickStyleNumericDraft(field, '.5')

  assert.equal(draft.draft, '.5')
  assert.equal(draft.commitValue, 0.5)
  assert.equal(draft.warning, null)
})

test('invalid numeric draft shows warning and does not mutate diagram', () => {
  const diagram = curveDiagram()
  const model = requiredModel(diagram, curveASelection())
  const field = requiredSliderField(model, 'curve.lineWidth')
  const draft = updateContextQuickStyleNumericDraft(field, '1e')
  const nextDiagram =
    draft.commitValue === null
      ? diagram
      : applyContextQuickStyleField(
          diagram,
          curveASelection(),
          'curve.lineWidth',
          draft.commitValue,
        )

  assert.equal(draft.warning, 'Width must be a finite number greater than 0.')
  assert.equal(findCurve(nextDiagram, 'curve-a').style.lineWidth, 1.2)
})

test('slider update changes curve stroke width', () => {
  const diagram = applyContextQuickStyleField(
    curveDiagram(),
    curveASelection(),
    'curve.lineWidth',
    2.4,
  )

  assert.equal(findCurve(diagram, 'curve-a').style.lineWidth, 2.4)
})

test('coalesced slider drag stores one undo entry', () => {
  let state = editorState(curveDiagram(), curveASelection())
  const undoSource = state.editableDiagram

  for (const width of [1.4, 1.8, 2.2]) {
    const nextDiagram = applyContextQuickStyleField(
      state.editableDiagram,
      state.selectedElement,
      'curve.lineWidth',
      width,
    )

    state = commitDiagramChange(
      state,
      { ...state, editableDiagram: nextDiagram },
      { undoSourceDiagram: undoSource },
    )
  }

  assert.equal(state.history.past.length, 1)
  assert.equal(findCurve(state.editableDiagram, 'curve-a').style.lineWidth, 2.2)

  const undone = undoLastDiagramChange(state)

  assert.equal(findCurve(undone.editableDiagram, 'curve-a').style.lineWidth, 1.2)
})

test('point radius shortcut works with step 0.1', () => {
  const diagram = pointDiagram()
  const model = requiredModel(diagram, pointSelection())
  const field = requiredSliderField(model, 'point.size')
  const updated = applyContextQuickStyleField(
    diagram,
    pointSelection(),
    'point.size',
    4.3,
  )

  assert.equal(field.label, 'Radius')
  assert.equal(field.slider.step, 0.1)
  assert.equal(findPoint(updated, 'point-a').style.size, 4.3)
})

test('sheet and region stroke width and fill opacity shortcuts work', () => {
  const sheetUpdated = applyContextQuickStyleField(
    sheetDiagram(),
    sheetSelection(),
    'sheet.lineWidth',
    2.5,
  )
  const sheetOpacityUpdated = applyContextQuickStyleField(
    sheetUpdated,
    sheetSelection(),
    'sheet.fillOpacity',
    0.5,
  )
  const regionUpdated = applyContextQuickStyleField(
    regionDiagram(),
    regionSelection(),
    'region.lineWidth',
    2.1,
  )
  const regionOpacityUpdated = applyContextQuickStyleField(
    regionUpdated,
    regionSelection(),
    'region.fillOpacity',
    0.45,
  )

  assert.equal(findSheet(sheetOpacityUpdated, 'sheet-a').style.lineWidth, 2.5)
  assert.equal(findSheet(sheetOpacityUpdated, 'sheet-a').style.fillOpacity, 0.5)
  assert.equal(findRegion(regionOpacityUpdated, 'region-a').style.lineWidth, 2.1)
  assert.equal(findRegion(regionOpacityUpdated, 'region-a').style.fillOpacity, 0.45)
})

test('mixed multi-selection shows mixed', () => {
  const model = requiredModel(curveDiagram({ curveBWidth: 2.4 }), curveABSelection())
  const field = requiredSliderField(model, 'curve.lineWidth')

  assert.deepEqual(field.value, { kind: 'mixed' })
})

test('editing mixed width applies to all selected curves', () => {
  const diagram = applyContextQuickStyleField(
    curveDiagram({ curveBWidth: 2.4 }),
    curveABSelection(),
    'curve.lineWidth',
    1.7,
  )

  assert.equal(findCurve(diagram, 'curve-a').style.lineWidth, 1.7)
  assert.equal(findCurve(diagram, 'curve-b').style.lineWidth, 1.7)
})

test('coordinate anchor selection does not show style shortcuts', () => {
  const diagram = coordinateAnchorDiagram()

  assert.equal(
    createContextQuickStyleBarModel(diagram, {
      kind: 'coordinate',
      id: 'coord-a',
    }),
    null,
  )
})

test('imported TikZ style model lists compatible curve presets and filters search', () => {
  const diagram = importedCurveStyleDiagram()
  const model = createContextQuickStylePresetModel(diagram, curveASelection())

  assert.notEqual(model, null)
  if (model === null) {
    throw new Error('Expected imported style model.')
  }

  const importedOption = model.options.find(
    (option) => option.importedKey === importedCurveKey,
  )

  assert.equal(model.geometricKind, 'curve')
  assert.equal(model.current.kind, 'none')
  assert.equal(importedOption?.origin, 'imported')
  assert.equal(importedOption?.sourceName, '3cat.sty')
  assert.deepEqual(
    filterContextQuickStylePresetOptions(model.options, 'phys/1strata').map(
      (option) => option.importedKey,
    ),
    [importedCurveKey],
  )
  assert.equal(filterContextQuickStylePresetOptions(model.options, 'missing').length, 0)
})

test('quick style TikZ style model is empty without saved presets', () => {
  const model = createContextQuickStylePresetModel(
    curveDiagram(),
    curveASelection(),
  )

  assert.notEqual(model, null)
  assert.deepEqual(model?.options, [])
})

test('mixed incompatible selection does not expose quick style controls', () => {
  const diagram = curvePointDiagram()
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'curve-a' },
      { kind: 'stratum', id: 'point-a' },
    ],
  }

  assert.equal(createContextQuickStyleBarModel(diagram, selection), null)
  assert.equal(createContextQuickStylePresetModel(diagram, selection), null)
})

test('applying imported TikZ style from quick bar sets references compactly', () => {
  const diagram = importedCurveStyleDiagram()
  const preset = importedCurvePreset(diagram)
  const result = applyContextQuickStylePreset(
    diagram,
    curveASelection(),
    preset.id,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const curve = findCurve(result.diagram, 'curve-a')
  const tikz = generateTikz({
    ...result.diagram,
    strata: [curve],
  })

  assert.equal(curve.stylePresetId, preset.id)
  assert.equal(
    curve.importedTikzStyleReferenceId,
    preset.importedTikzStyleReferenceId,
  )
  assert.match(tikz, new RegExp(escapeRegExp(importedCurveKey)))
  assert.doesNotMatch(tikz, /stratifiedStyle3catPhys1strataColorX/)
  assert.doesNotMatch(tikz, /draw=stz/)
  assert.doesNotMatch(tikz, /line width=/)
})

test('applying imported TikZ style to same-kind multi-selection is atomic', () => {
  const diagram = importedCurveStyleDiagram()
  const preset = importedCurvePreset(diagram)
  const result = applyContextQuickStylePreset(
    diagram,
    curveABSelection(),
    preset.id,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  assert.equal(findCurve(result.diagram, 'curve-a').stylePresetId, preset.id)
  assert.equal(findCurve(result.diagram, 'curve-b').stylePresetId, preset.id)
})

test('applying imported TikZ style rejects incompatible mixed selection atomically', () => {
  const diagram = importedCurvePointStyleDiagram()
  const original = structuredClone(diagram) as Diagram
  const preset = importedCurvePreset(diagram)
  const result = applyContextQuickStylePreset(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'curve-a' },
        { kind: 'stratum', id: 'point-a' },
      ],
    },
    preset.id,
  )

  assert.equal(result.ok, false)
  assert.deepEqual(result.diagram, original)
})

test('quick style TikZ style model reports current and mixed preset state', () => {
  const firstImport = importedCurveStyleDiagram()
  const secondImport = importTikzStyleFile(
    firstImport,
    'other.sty',
    String.raw`\tikzset{otherCurve/.style={draw=blue,dashed}}`,
  ).diagram
  const firstPreset = importedCurvePreset(secondImport)
  const secondPreset = importedCurvePreset(secondImport, 'otherCurve')
  const bothApplied = applyContextQuickStylePreset(
    secondImport,
    curveABSelection(),
    firstPreset.id,
  )

  assert.equal(bothApplied.ok, true)
  if (!bothApplied.ok) {
    throw new Error(bothApplied.message)
  }

  const currentModel = createContextQuickStylePresetModel(
    bothApplied.diagram,
    curveABSelection(),
  )

  assert.equal(currentModel?.current.kind, 'preset')
  assert.equal(
    currentModel?.current.kind === 'preset'
      ? currentModel.current.presetId
      : undefined,
    firstPreset.id,
  )

  const mixedApplied = applyContextQuickStylePreset(
    bothApplied.diagram,
    { kind: 'stratum', id: 'curve-b' },
    secondPreset.id,
  )

  assert.equal(mixedApplied.ok, true)
  if (!mixedApplied.ok) {
    throw new Error(mixedApplied.message)
  }

  assert.equal(
    createContextQuickStylePresetModel(
      mixedApplied.diagram,
      curveABSelection(),
    )?.current.kind,
    'mixed',
  )
})

test('recent quick TikZ styles are shown first after applying a style', () => {
  const firstImport = importedCurveStyleDiagram()
  const diagram = importTikzStyleFile(
    firstImport,
    'other.sty',
    String.raw`\tikzset{otherCurve/.style={draw=blue,dashed}}`,
  ).diagram
  const firstPreset = importedCurvePreset(diagram)
  const secondPreset = importedCurvePreset(diagram, 'otherCurve')
  const applied = applyContextQuickStylePreset(
    diagram,
    curveASelection(),
    secondPreset.id,
  )

  assert.equal(applied.ok, true)
  if (!applied.ok) {
    throw new Error(applied.message)
  }

  const recentPresetIds = updateRecentContextQuickStylePresetIds(
    updateRecentContextQuickStylePresetIds([], firstPreset.id),
    secondPreset.id,
  )
  const model = createContextQuickStylePresetModel(
    applied.diagram,
    curveASelection(),
    recentPresetIds,
  )

  assert.equal(model?.options[0]?.presetId, secondPreset.id)
  assert.equal(model?.options[0]?.recent, true)
  assert.equal(model?.options[1]?.presetId, firstPreset.id)
  assert.equal(model?.options[1]?.recent, true)
})

test('clearing quick style TikZ style preserves explicit style and removes references', () => {
  const diagram = importedCurveStyleDiagram()
  const preset = importedCurvePreset(diagram)
  const applied = applyContextQuickStylePreset(
    diagram,
    curveASelection(),
    preset.id,
  )

  assert.equal(applied.ok, true)
  if (!applied.ok) {
    throw new Error(applied.message)
  }

  const cleared = applyContextQuickStylePreset(
    applied.diagram,
    curveASelection(),
    null,
  )

  assert.equal(cleared.ok, true)
  if (!cleared.ok) {
    throw new Error(cleared.message)
  }

  const curve = findCurve(cleared.diagram, 'curve-a')

  assert.equal(curve.stylePresetId, undefined)
  assert.equal(curve.importedTikzStyleReferenceId, undefined)
  assert.deepEqual(curve.style, preset.style)
})

test('quick bar imported TikZ style application is undoable and redoable', () => {
  const diagram = importedCurveStyleDiagram()
  const preset = importedCurvePreset(diagram)
  const initial = editorState(diagram, curveASelection())
  const applied = applyContextQuickStylePreset(
    initial.editableDiagram,
    initial.selectedElement,
    preset.id,
  )

  assert.equal(applied.ok, true)
  if (!applied.ok) {
    throw new Error(applied.message)
  }

  const state = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: applied.diagram,
  })
  const undone = undoLastDiagramChange(state)
  const redone = redoLastDiagramChange(undone)

  assert.equal(state.history.past.length, 1)
  assert.equal(findCurve(state.editableDiagram, 'curve-a').stylePresetId, preset.id)
  assert.equal(findCurve(undone.editableDiagram, 'curve-a').stylePresetId, undefined)
  assert.equal(findCurve(redone.editableDiagram, 'curve-a').stylePresetId, preset.id)
})

test('quick scalar override after imported style emits only explicit override', () => {
  const diagram = importedCurveStyleDiagram()
  const preset = importedCurvePreset(diagram)
  const applied = applyContextQuickStylePreset(
    diagram,
    curveASelection(),
    preset.id,
  )

  assert.equal(applied.ok, true)
  if (!applied.ok) {
    throw new Error(applied.message)
  }

  const overridden = applyContextQuickStyleField(
    applied.diagram,
    curveASelection(),
    'curve.lineWidth',
    0.8,
  )
  const curve = findCurve(overridden, 'curve-a')
  const tikz = generateTikz({
    ...overridden,
    strata: [curve],
  })

  assert.equal(curve.stylePresetId, undefined)
  assert.equal(
    curve.importedTikzStyleReferenceId,
    preset.importedTikzStyleReferenceId,
  )
  assert.match(tikz, new RegExp(escapeRegExp(importedCurveKey)))
  assert.match(tikz, /line width=0\.8pt/)
  assert.doesNotMatch(tikz, /draw=stz/)
  assert.doesNotMatch(tikz, /draw opacity=/)
})

test('TikZ output reflects style shortcut changes', () => {
  const diagram = applyContextQuickStyleField(
    curveDiagram(),
    curveASelection(),
    'curve.lineWidth',
    0.5,
  )
  const tikz = generateTikz(diagram)

  assert.match(tikz, /line width=0\.5pt/)
})

test('inline TikZ output keeps no blank lines after quick style changes', () => {
  const diagram = applyContextQuickStyleField(
    curveDiagram(),
    curveASelection(),
    'curve.lineWidth',
    0.5,
  )
  const tikz = generateTikz(diagram, { exportMode: 'inlineMath' })

  assert.doesNotMatch(tikz, /\n\s*\n/)
})

function curveDiagram(
  options: { curveAWidth?: number; curveBWidth?: number } = {},
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    strata: [
      createCurveStratum({
        ambientDimension: 2,
        id: 'curve-a',
        name: 'A',
        style: {
          ...defaultCurveStyle,
          lineWidth: options.curveAWidth ?? 1.2,
        },
        points: [point(0, 0), point(1, 0)],
      }),
      createCurveStratum({
        ambientDimension: 2,
        id: 'curve-b',
        name: 'B',
        style: {
          ...defaultCurveStyle,
          lineWidth: options.curveBWidth ?? 1.2,
        },
        points: [point(0, 1), point(1, 1)],
      }),
    ],
  }
}

const importedCurveKey = '3cat/phys/1strata/color/x'

function importedCurveStyleDiagram(): Diagram {
  return importTikzStyleFile(
    curveDiagram(),
    '3cat.sty',
    String.raw`\tikzset{3cat/.cd, phys/1strata/color/x/.style={red!60,decorate,decoration={snake}}}`,
  ).diagram
}

function importedCurvePointStyleDiagram(): Diagram {
  const diagram = importedCurveStyleDiagram()

  return {
    ...diagram,
    strata: [
      ...diagram.strata,
      createPointStratum({
        ambientDimension: 2,
        id: 'point-a',
        style: defaultPointStyle,
        position: point(2, 2),
      }),
    ],
  }
}

function importedCurvePreset(
  diagram: Diagram,
  key = importedCurveKey,
): UserStylePreset {
  const reference = diagram.importedTikzStyleReferences?.find(
    (candidate) => candidate.key === key,
  )
  const preset = diagram.userStylePresets?.find(
    (candidate) =>
      candidate.kind === 'curve' &&
      candidate.importedTikzStyleReferenceId === reference?.id,
  )

  if (preset === undefined) {
    throw new Error(`Expected imported curve preset for ${key}.`)
  }

  return preset
}

function curvePointDiagram(): Diagram {
  const diagram = curveDiagram()

  return {
    ...diagram,
    strata: [
      ...diagram.strata,
      createPointStratum({
        ambientDimension: 2,
        id: 'point-a',
        style: defaultPointStyle,
        position: point(2, 2),
      }),
    ],
  }
}

function pointDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    strata: [
      createPointStratum({
        ambientDimension: 2,
        id: 'point-a',
        style: defaultPointStyle,
        position: point(0, 0),
      }),
    ],
  }
}

function sheetDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  return {
    ...diagram,
    strata: [
      createSheetStratum({
        id: 'sheet-a',
        style: defaultSheetStyle,
        corners: [
          point(0, 0, 0),
          point(1, 0, 0),
          point(1, 1, 0),
          point(0, 1, 0),
        ],
      }),
    ],
  }
}

function regionDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    strata: [
      createRegionStratum({
        id: 'region-a',
        style: defaultRegionStyle,
      }),
    ],
  }
}

function coordinateAnchorDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    coordinateAnchors: [
      createCoordinateAnchor(diagram, {
        id: 'coord-a',
        name: 'A',
        position: {
          kind: 'global',
          value: symbolicVec3FromVec3(point(0, 0)),
        },
      }),
    ],
  }
}

function editorState(
  editableDiagram: Diagram,
  selectedElement: SelectedElement,
): TestEditorState {
  return {
    editableDiagram,
    selectedElement,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(editableDiagram),
  }
}

function curveASelection(): SelectedElement {
  return { kind: 'stratum', id: 'curve-a' }
}

function curveABSelection(): SelectedElement {
  return {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'curve-a' },
      { kind: 'stratum', id: 'curve-b' },
    ],
  }
}

function pointSelection(): SelectedElement {
  return { kind: 'stratum', id: 'point-a' }
}

function sheetSelection(): SelectedElement {
  return { kind: 'stratum', id: 'sheet-a' }
}

function regionSelection(): SelectedElement {
  return { kind: 'stratum', id: 'region-a' }
}

function requiredModel(
  diagram: Diagram,
  selection: SelectedElement,
): NonNullable<ReturnType<typeof createContextQuickStyleBarModel>> {
  const model = createContextQuickStyleBarModel(diagram, selection)

  assert.notEqual(model, null)

  return model
}

function requiredSliderField(
  model: NonNullable<ReturnType<typeof createContextQuickStyleBarModel>>,
  id: string,
): Extract<ContextQuickStyleField, { input: 'slider' }> {
  const field = model.fields.find((candidate) => candidate.id === id)

  if (field === undefined || field.input !== 'slider') {
    throw new Error(`Expected slider field ${id}.`)
  }

  return field
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'curve') {
    throw new Error(`Expected curve ${id}.`)
  }

  return stratum
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'point') {
    throw new Error(`Expected point ${id}.`)
  }

  return stratum
}

function findSheet(diagram: Diagram, id: string): SheetStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'sheet') {
    throw new Error(`Expected sheet ${id}.`)
  }

  return stratum
}

function findRegion(diagram: Diagram, id: string): RegionStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'region') {
    throw new Error(`Expected region ${id}.`)
  }

  return stratum
}

function point(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
