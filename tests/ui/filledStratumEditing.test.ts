import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEmptyDiagram,
  createFilledRegion2DStratum,
  createWorkPlaneFilledSheet3DStratum,
} from '../../src/model/constructors.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import type {
  ClosedPathBoundary,
  Diagram,
  FilledRegion2DStratum,
  RegionStyle,
  SheetStyle,
  Vec3,
  WorkPlaneFilledSheet3DStratum,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import { generateTikz, layerToTikzLayerName } from '../../src/tikz/index.ts'
import { filledSurfaceStyleToSvgAttributes } from '../../src/rendering/svgStyle.ts'
import { svgFillRuleValue } from '../../src/rendering/svgPath.ts'
import {
  updateStratumById,
  updateStratumStyleById,
} from '../../src/ui/diagramUpdates.ts'
import {
  replaceFilledStratumBoundaries,
  updateFilledStratumFillRule,
} from '../../src/ui/filledStratumEditing.ts'
import {
  createInspectorCompactSummary,
  createInspectorSections,
} from '../../src/ui/inspectorSummary.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type DiagramHistory,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

type TestEditorState = UndoableEditorState & {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
  history: DiagramHistory
}

test('inspector summary reports a 2D filled region boundary summary', () => {
  const diagram = createFilledRegionDiagram({
    fillRule: 'evenOdd',
    boundaries: [squareBoundary2D('outer', 0, 0, 3)],
  })
  const sections = createInspectorSections(diagram, {
    kind: 'stratum',
    id: 'filled-region',
  })
  const summary = createInspectorCompactSummary(diagram, {
    kind: 'stratum',
    id: 'filled-region',
  })
  const fields = sections.flatMap((section) => section.fields)

  assert.equal(summary?.title, 'Filled region: Filled Region [filled-region]')
  assertField(fields, 'Object kind', 'Filled region')
  assertField(fields, 'Boundaries', '1')
  assertField(fields, 'Fill rule', 'evenOdd')
  assertField(fields, 'Boundary coordinates', 'read-only')
  assert.match(fieldValue(fields, 'Boundary 1'), /4 line/)
  assert.match(fieldValue(fields, 'Boundary 1'), /closed/)
})

test('inspector summary reports a 3D work-plane filled sheet boundary summary', () => {
  const diagram = createWorkPlaneFilledSheetDiagram({
    fillRule: 'nonzero',
    boundaries: [squareBoundary3D('outer', 2)],
  })
  const sections = createInspectorSections(diagram, {
    kind: 'stratum',
    id: 'filled-sheet',
  })
  const summary = createInspectorCompactSummary(diagram, {
    kind: 'stratum',
    id: 'filled-sheet',
  })
  const fields = sections.flatMap((section) => section.fields)

  assert.equal(
    summary?.title,
    'Work-plane filled sheet: Filled Sheet [filled-sheet]',
  )
  assertField(fields, 'Object kind', 'Work-plane filled sheet')
  assertField(fields, 'Boundaries', '1')
  assertField(fields, 'Fill rule', 'nonzero')
  assert.match(fieldValue(fields, 'Boundary 1'), /\(0, 0, 2\) to \(0, 0, 2\)/)
})

test('fill rule edit updates the diagram model', () => {
  const diagram = createFilledRegionDiagram()
  const updated = updateFilledStratumFillRule(
    diagram,
    'filled-region',
    'evenOdd',
  )

  assert.equal(mustFindFilledRegion(updated).fillRule, 'evenOdd')
  assert.equal(mustFindFilledRegion(diagram).fillRule, 'nonzero')
})

test('fill rule edit updates SVG and TikZ output', () => {
  const diagram = updateFilledStratumFillRule(
    createFilledRegionDiagram({
      boundaries: [
        squareBoundary2D('outer', 0, 0, 4),
        squareBoundary2D('inner', 1, 1, 1),
      ],
    }),
    'filled-region',
    'evenOdd',
  )
  const region = mustFindFilledRegion(diagram)

  assert.equal(svgFillRuleValue(region.fillRule), 'evenodd')
  assert.match(generateTikz(diagram), /even odd rule/)
})

test('style edit updates SVG and TikZ output', () => {
  const diagram = updateStratumStyleById(
    createFilledRegionDiagram(),
    'filled-region',
    (style) =>
      style.kind === 'regionStyle'
        ? {
            ...style,
            fillColor: '#AA3355',
            fillOpacity: 0.61,
            strokeColor: '#2266CC',
            strokeOpacity: 0.47,
          }
        : style,
  )
  const region = mustFindFilledRegion(diagram)

  assert.deepEqual(filledSurfaceStyleToSvgAttributes(region.style), {
    fill: '#AA3355',
    fillOpacity: 0.61,
    stroke: '#2266CC',
    strokeOpacity: 0.47,
    strokeWidth: 1.5,
  })
  assert.match(generateTikz(diagram), /\{HTML\}\{AA3355\}/)
  assert.match(generateTikz(diagram), /\{HTML\}\{2266CC\}/)
  assert.match(generateTikz(diagram), /fill opacity=0\.61/)
  assert.match(generateTikz(diagram), /draw opacity=0\.47/)
})

test('layer edit updates layer-aware TikZ output', () => {
  const layer = 7
  const diagram = updateStratumById(
    createFilledRegionDiagram(),
    'filled-region',
    (stratum) => ({ ...stratum, layer }),
  )
  const layerName = layerToTikzLayerName(layer)
  const layerBlock = extractLayerBlock(generateTikz(diagram), layerName)

  assert.match(layerBlock, /% Codimension 0 strata: regions/)
  assert.match(layerBlock, /\\filldraw\[/)
})

test('invalid filled-boundary replacement is rejected', () => {
  const diagram = createFilledRegionDiagram()
  const result = replaceFilledStratumBoundaries(diagram, 'filled-region', [
    openBoundary2D('open'),
  ])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected open boundary replacement to fail.')
  }
  assert.equal(result.error, 'openBoundary')
  assert.equal(result.boundaryId, 'open')
  assert.equal(result.diagram, diagram)
})

test('off-plane work-plane sheet boundary replacement is rejected', () => {
  const diagram = createWorkPlaneFilledSheetDiagram()
  const result = replaceFilledStratumBoundaries(diagram, 'filled-sheet', [
    squareBoundary3D('off-plane', 3),
  ])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected off-plane boundary replacement to fail.')
  }
  assert.equal(result.error, 'nonPlanarBoundary')
  assert.equal(result.boundaryId, 'off-plane')
  assert.equal(result.diagram, diagram)
})

test('style and fill-rule edits are undoable and redoable', () => {
  const initial = createTestEditorState(createFilledRegionDiagram())
  const withFillRule = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: updateFilledStratumFillRule(
      initial.editableDiagram,
      'filled-region',
      'evenOdd',
    ),
  })
  const withStyle = commitDiagramChange(withFillRule, {
    ...withFillRule,
    editableDiagram: updateStratumStyleById(
      withFillRule.editableDiagram,
      'filled-region',
      (style) =>
        style.kind === 'regionStyle'
          ? { ...style, fillColor: '#CC4400' }
          : style,
    ),
  })
  const undoneStyle = undoLastDiagramChange(withStyle)
  const undoneFillRule = undoLastDiagramChange(undoneStyle)
  const redoneFillRule = redoLastDiagramChange(undoneFillRule)
  const redoneStyle = redoLastDiagramChange(redoneFillRule)

  assert.equal(mustFindFilledRegion(withStyle.editableDiagram).fillRule, 'evenOdd')
  assert.equal(mustFindFilledRegion(withStyle.editableDiagram).style.fillColor, '#CC4400')
  assert.equal(mustFindFilledRegion(undoneStyle.editableDiagram).fillRule, 'evenOdd')
  assert.equal(
    mustFindFilledRegion(undoneStyle.editableDiagram).style.fillColor,
    '#4D9DE0',
  )
  assert.equal(mustFindFilledRegion(undoneFillRule.editableDiagram).fillRule, 'nonzero')
  assert.equal(mustFindFilledRegion(redoneStyle.editableDiagram).fillRule, 'evenOdd')
  assert.equal(
    mustFindFilledRegion(redoneStyle.editableDiagram).style.fillColor,
    '#CC4400',
  )
})

test('save and load preserve edited fill rule', () => {
  const saved = serializeDiagram(
    updateFilledStratumFillRule(
      createWorkPlaneFilledSheetDiagram(),
      'filled-sheet',
      'evenOdd',
    ),
  )
  const result = parseSavedDiagramJson(saved)

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.equal(mustFindWorkPlaneFilledSheet(result.diagram).fillRule, 'evenOdd')
})

function createFilledRegionDiagram({
  boundaries = [squareBoundary2D('outer')],
  fillRule = 'nonzero',
  layer = 0,
  style = defaultFilledRegionStyle(),
}: {
  boundaries?: ClosedPathBoundary[]
  fillRule?: 'nonzero' | 'evenOdd'
  layer?: number
  style?: RegionStyle
} = {}): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata: [
      createFilledRegion2DStratum({
        id: 'filled-region',
        name: 'Filled Region',
        style,
        boundaries,
        fillRule,
        layer,
      }),
    ],
  }
}

function createWorkPlaneFilledSheetDiagram({
  boundaries = [squareBoundary3D('outer', 2)],
  fillRule = 'nonzero',
  layer = 0,
  style = defaultSheetStyle(),
}: {
  boundaries?: ClosedPathBoundary[]
  fillRule?: 'nonzero' | 'evenOdd'
  layer?: number
  style?: SheetStyle
} = {}): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    strata: [
      createWorkPlaneFilledSheet3DStratum({
        id: 'filled-sheet',
        name: 'Filled Sheet',
        style,
        planeFrame: xyPlaneFrameAtZ(2),
        boundaries,
        fillRule,
        layer,
      }),
    ],
  }
}

function defaultFilledRegionStyle(): RegionStyle {
  return {
    kind: 'regionStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
  }
}

function defaultSheetStyle(): SheetStyle {
  return {
    kind: 'sheetStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
  }
}

function squareBoundary2D(
  id: string,
  x = 0,
  y = 0,
  size = 2,
): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x, y, z: 0 },
    { x: x + size, y, z: 0 },
    { x: x + size, y: y + size, z: 0 },
    { x, y: y + size, z: 0 },
  ])
}

function squareBoundary3D(
  id: string,
  z: number,
  x = 0,
  y = 0,
  size = 2,
): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x, y, z },
    { x: x + size, y, z },
    { x: x + size, y: y + size, z },
    { x, y: y + size, z },
  ])
}

function squareBoundaryFromPoints(
  id: string,
  points: [Vec3, Vec3, Vec3, Vec3],
): ClosedPathBoundary {
  return {
    id,
    name: id,
    segments: [
      { kind: 'line', start: points[0], end: points[1] },
      { kind: 'line', start: points[1], end: points[2] },
      { kind: 'line', start: points[2], end: points[3] },
      { kind: 'line', start: points[3], end: points[0] },
    ],
  }
}

function openBoundary2D(id: string): ClosedPathBoundary {
  return {
    id,
    name: id,
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
    ],
  }
}

function xyPlaneFrameAtZ(z: number): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y: 0, z },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function mustFindFilledRegion(diagram: Diagram): FilledRegion2DStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === 'filled-region')

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'region' ||
    stratum.kind !== 'filledRegion'
  ) {
    throw new Error('Expected filled region.')
  }

  return stratum
}

function mustFindWorkPlaneFilledSheet(
  diagram: Diagram,
): WorkPlaneFilledSheet3DStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === 'filled-sheet')

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'workPlaneFilledSheet'
  ) {
    throw new Error('Expected work-plane filled sheet.')
  }

  return stratum
}

function createTestEditorState(diagram: Diagram): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: { kind: 'stratum', id: 'filled-region' },
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
}

function extractLayerBlock(tikz: string, layerName: string): string {
  const start = tikz.indexOf(`\\begin{pgfonlayer}{${layerName}}`)

  if (start === -1) {
    throw new Error(`Layer ${layerName} was not generated.`)
  }

  const end = tikz.indexOf('\\end{pgfonlayer}', start)

  if (end === -1) {
    throw new Error(`Layer ${layerName} was not closed.`)
  }

  return tikz.slice(start, end)
}

function assertField(
  fields: Array<{ label: string; value: string }>,
  label: string,
  value: string,
): void {
  assert.equal(fieldValue(fields, label), value)
}

function fieldValue(
  fields: Array<{ label: string; value: string }>,
  label: string,
): string {
  const field = fields.find((candidate) => candidate.label === label)

  if (field === undefined) {
    throw new Error(`Expected field ${label}.`)
  }

  return field.value
}
