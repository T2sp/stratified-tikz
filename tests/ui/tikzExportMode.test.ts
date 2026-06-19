import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import {
  createSerializeDiagramOptionsForUi,
  createTikzGenerateOptionsForUi,
  defaultTikzExportMode,
  generateTikzForUi,
  tikzExportModeFromSelectValue,
  tikzExportModeLabel,
} from '../../src/ui/tikzExportMode.ts'

test('TikZ export UI state defaults to standalone mode', () => {
  assert.equal(defaultTikzExportMode, 'standalone')
  assert.equal(tikzExportModeFromSelectValue('unknown'), 'standalone')
  assert.equal(tikzExportModeLabel('standalone'), 'Standalone TikZ')
})

test('TikZ export UI state can switch to inline math mode', () => {
  assert.equal(tikzExportModeFromSelectValue('inlineMath'), 'inlineMath')
  assert.equal(tikzExportModeLabel('inlineMath'), 'Inline math TikZ')
})

test('selected TikZ export mode is passed to generator options', () => {
  const options = createTikzGenerateOptionsForUi(twoDimensionalExample, {
    exportMode: 'inlineMath',
    includeCoordinateAxesInTikz: true,
  })

  assert.equal(options.exportMode, 'inlineMath')
  assert.equal(options.includeCoordinateAxes, undefined)
})

test('copyable TikZ source uses the selected export mode', () => {
  const tikz = generateTikzForUi(twoDimensionalExample, {
    exportMode: 'inlineMath',
    includeCoordinateAxesInTikz: false,
  })

  assert.match(tikz, /TikZ export mode: inline math/)
})

test('download serialization options use the selected export mode', () => {
  const serialized = serializeDiagram(
    twoDimensionalExample,
    createSerializeDiagramOptionsForUi(twoDimensionalExample, {
      exportMode: 'inlineMath',
      includeCoordinateAxesInTikz: false,
    }),
  )
  const parsed = JSON.parse(serialized) as {
    diagram: {
      view?: {
        exportMode?: unknown
      }
    }
  }

  assert.equal(parsed.diagram.view?.exportMode, 'inlineMath')
})

test('changing TikZ export mode does not mutate diagram geometry', () => {
  const before = structuredClone(twoDimensionalExample)

  generateTikzForUi(twoDimensionalExample, {
    exportMode: 'inlineMath',
    includeCoordinateAxesInTikz: false,
  })

  assert.deepEqual(twoDimensionalExample.strata, before.strata)
  assert.deepEqual(twoDimensionalExample.labels, before.labels)
})
