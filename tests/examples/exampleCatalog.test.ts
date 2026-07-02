import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  curatedThreeDimensionalExample,
  curatedTwoDimensionalExample,
  defaultExampleId,
  exampleOptions,
  getExampleOption,
} from '../../src/examples/index.ts'
import { parseSavedDiagramJson } from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { cloneDiagram } from '../../src/ui/diagramUpdates.ts'

const expectedExampleNames = [
  'Empty 2D',
  'Empty 3D',
  '2D example',
  '3D example',
  'braiding',
  '3D local symbolic',
  'Coordinate anchors',
] as const

test('main example catalog contains exactly the curated examples in order', () => {
  assert.deepEqual(
    exampleOptions.map((example) => example.name),
    expectedExampleNames,
  )
  assert.equal(new Set(exampleOptions.map((example) => example.name)).size, 7)
})

test('Empty 2D is the default and precedes Empty 3D', () => {
  assert.equal(defaultExampleId, 'empty2d')
  assert.equal(exampleOptions[0]?.id, 'empty2d')
  assert.equal(exampleOptions[1]?.id, 'empty3d')
  assert.equal(getExampleOption(defaultExampleId).name, 'Empty 2D')
})

test('curated 2D and 3D JSON fixtures load successfully', () => {
  const cases = [
    {
      filename: '2d-example.json',
      ambientDimension: 2,
      diagram: curatedTwoDimensionalExample,
    },
    {
      filename: '3d-example.json',
      ambientDimension: 3,
      diagram: curatedThreeDimensionalExample,
    },
  ] as const

  for (const { filename, ambientDimension, diagram } of cases) {
    const fixtureText = readFileSync(
      new URL(`../../src/examples/${filename}`, import.meta.url),
      'utf8',
    )
    const parsed = parseSavedDiagramJson(fixtureText)

    assert.equal(parsed.ok, true, parsed.ok ? undefined : parsed.error)
    if (!parsed.ok) {
      throw new Error(parsed.error)
    }

    assert.equal(parsed.diagram.ambientDimension, ambientDimension)
    assert.deepEqual(parsed.diagram, diagram)
    assert.equal(validateDiagram(diagram).valid, true)
  }
})

test('braiding example still loads and exports crossing overlays', () => {
  const diagram = getExampleOption('braiding').diagram
  const validation = validateDiagram(diagram)

  assert.equal(
    validation.valid,
    true,
    validation.errors.map((issue) => issue.message).join('\n'),
  )
  assert.match(generateTikz(diagram), /Braiding crossing:/)
})

test('coordinate anchor example exports reusable coordinate references', () => {
  const diagram = getExampleOption('coordinateAnchors').diagram
  const validation = validateDiagram(diagram)
  const tikz = generateTikz(diagram)

  assert.equal(
    validation.valid,
    true,
    validation.errors.map((issue) => issue.message).join('\n'),
  )
  assert.match(tikz, /\\coordinate \(A\) at \(0,0,0\);/)
  assert.match(tikz, /\(A\) -- \(B\);/)
  assert.match(tikz, /\(B\) -- \(C\);/)
  assert.match(tikz, /\\node at \(LocalAnchor\) \{\$L\$\};/)
})

test('example bar CSS wraps instead of requiring horizontal scroll', () => {
  const css = readFileSync(
    new URL('../../src/App.css', import.meta.url),
    'utf8',
  )
  const match = /\.example-segmented-control\s*\{(?<body>[^}]*)\}/u.exec(css)

  assert.notEqual(match?.groups?.body, undefined)
  const body = match?.groups?.body ?? ''

  assert.match(body, /display:\s*flex;/u)
  assert.match(body, /flex-wrap:\s*wrap;/u)
  assert.match(body, /overflow-x:\s*visible;/u)
  assert.doesNotMatch(body, /overflow-x:\s*(auto|scroll);/u)
})

test('switching examples uses fresh fixture clones and drops temporary edits', () => {
  const source = getExampleOption('2d').diagram
  const editedWorkingCopy = cloneDiagram(source)

  editedWorkingCopy.strata.splice(0, editedWorkingCopy.strata.length)
  editedWorkingCopy.labels.splice(0, editedWorkingCopy.labels.length)

  const switchedWorkingCopy = cloneDiagram(getExampleOption('2d').diagram)

  assert.notEqual(switchedWorkingCopy, source)
  assert.equal(switchedWorkingCopy.strata.length, source.strata.length)
  assert.equal(switchedWorkingCopy.labels.length, source.labels.length)
})
