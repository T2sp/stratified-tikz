import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import type { Diagram, PointStratum } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { duplicateSelectedElements } from '../../src/ui/bulkEditing.ts'
import {
  addPointStratumFromDirectInput,
  addPointStratumWithResult,
  updatePointTextById,
  updateStratumById,
} from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

for (const ambientDimension of [2, 3] as const) {
  for (const inputMethod of ['direct', 'cursor'] as const) {
    test(`${ambientDimension}D ${inputMethod} point text survives editing, saving and undo/redo`, () => {
      const empty = createEmptyDiagram({ ambientDimension })
      const created = inputMethod === 'direct'
        ? addPointStratumFromDirectInput(empty, { x: '1', y: '2', z: '3' })
        : addPointStratumWithResult(empty, { x: 1, y: 2, z: 3 })

      if ('ok' in created && !created.ok) {
        throw new Error('Expected direct point creation to succeed.')
      }

      const original = findPoint(created.diagram, created.id)
      const initial: UndoableEditorState = {
        editableDiagram: created.diagram,
        selectedElement: { kind: 'stratum', id: created.id },
        layerFilter: allLayersFilter,
        polylineDraft: null,
        cubicBezierDraft: null,
        pathDraft: null,
        sheetPolygonDraft: null,
        history: createDiagramHistory(created.diagram),
      }
      const text = '  $F^{(1)}L$\n$\\alpha \\colon f \\Rightarrow g$  '
      const edited = commitDiagramChange(initial, {
        ...initial,
        editableDiagram: updatePointTextById(created.diagram, created.id, text),
      })

      assert.equal(original.text, undefined)
      assert.deepEqual(findPoint(edited.editableDiagram, created.id), { ...original, text })
      assert.deepEqual(edited.selectedElement, initial.selectedElement)
      assert.ok(generateTikz(edited.editableDiagram).includes(`{${text}};`))

      const loaded = parseSavedDiagramJson(serializeDiagram(edited.editableDiagram))
      assert.equal(loaded.ok, true)
      if (!loaded.ok) throw new Error('Expected saved point text to load.')
      assert.equal(findPoint(loaded.diagram, created.id).text, text)

      const cleared = commitDiagramChange(edited, {
        ...edited,
        editableDiagram: updatePointTextById(edited.editableDiagram, created.id, ''),
      })
      assert.equal(findPoint(cleared.editableDiagram, created.id).text, '')
      assert.equal(generateTikz(cleared.editableDiagram), generateTikz(created.diagram))

      const restoredText = undoLastDiagramChange(cleared)
      assert.equal(findPoint(restoredText.editableDiagram, created.id).text, text)
      const restoredOriginal = undoLastDiagramChange(restoredText)
      assert.deepEqual(restoredOriginal.editableDiagram, created.diagram)
      const redoneText = redoLastDiagramChange(restoredOriginal)
      assert.equal(findPoint(redoneText.editableDiagram, created.id).text, text)
      assert.equal(
        findPoint(redoLastDiagramChange(redoneText).editableDiagram, created.id).text,
        '',
      )
    })
  }
}

test('point text is preserved during duplication and coordinate editing', () => {
  const text = '$F$'
  const created = addPointStratumWithResult(
    createEmptyDiagram({ ambientDimension: 3 }),
    { x: 1, y: 2, z: 3 },
    { text },
  )
  const duplicated = duplicateSelectedElements(created.diagram, {
    kind: 'stratum',
    id: created.id,
  })
  assert.equal(duplicated.duplicatedCount, 1)
  const copiedId = duplicated.idChanges[0].copiedId
  const moved = updateStratumById(duplicated.diagram, copiedId, (stratum) =>
    stratum.geometricKind === 'point'
      ? { ...stratum, position: { x: 4, y: 5, z: 6 } }
      : stratum,
  )
  const editedCopy = updatePointTextById(moved, copiedId, '$G$')

  assert.equal(findPoint(moved, copiedId).text, text)
  assert.equal(findPoint(editedCopy, copiedId).text, '$G$')
  assert.equal(findPoint(editedCopy, created.id).text, text)
  assert.deepEqual(findPoint(editedCopy, copiedId).position, { x: 4, y: 5, z: 6 })
  assert.deepEqual(findPoint(editedCopy, created.id).position, { x: 1, y: 2, z: 3 })
})

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)
  if (stratum?.geometricKind !== 'point') throw new Error(`Expected point ${id}.`)
  return stratum
}
