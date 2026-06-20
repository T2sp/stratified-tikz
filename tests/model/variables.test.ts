import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addSymbolicVariableToDiagram,
  createEmptyDiagram,
  deleteSymbolicVariableFromDiagram,
  resolveSymbolicVariables,
  setDiagramSymbolicVariables,
  updateSymbolicVariableInDiagram,
  validateDiagram,
} from '../../src/model/index.ts'
import type { Diagram, SymbolicVariable } from '../../src/model/types.ts'

const reviewRequiredReservedVariableMacroNames = [
  'draw',
  'fill',
  'filldraw',
  'node',
  'coordinate',
  'path',
  'clip',
  'foreach',
  'pgfmathsetmacro',
  'pgfmathparse',
  'pgfmathresult',
  'tikzset',
  'tikzpicture',
  'begin',
  'end',
] as const

const reviewRequiredDangerousTexNames = [
  'def',
  'let',
  'newcommand',
  'renewcommand',
  'providecommand',
  'include',
  'includeonly',
  'input',
  'usepackage',
  'shipout',
  'special',
  'immediate',
  'openin',
  'closein',
  'openout',
  'closeout',
  'write',
  'write18',
  'read',
  'catcode',
] as const

const reviewRequiredValidVariableNames = [
  'r',
  'theta',
  'scale',
  'height',
  'radius',
  'alpha',
  'beta',
  'myVar',
  'xOne',
] as const

test('variables can be added to a diagram with evaluated preview values', () => {
  const withR = expectVariableDiagramOk(
    addSymbolicVariableToDiagram(createEmptyDiagram({ ambientDimension: 2 }), {
      id: 'var-R',
      name: 'R',
      expression: '2',
    }),
  )
  const withQ = expectVariableDiagramOk(
    addSymbolicVariableToDiagram(withR, {
      id: 'var-q',
      name: 'q',
      expression: '30',
    }),
  )

  assert.deepEqual(withQ.variables, [
    {
      id: 'var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
    {
      id: 'var-q',
      name: 'q',
      macroName: 'q',
      expression: '30',
      previewValue: 30,
    },
  ])
})

test('duplicate variable names are rejected', () => {
  const result = setVariables([
    variable('var-R', 'R', '2'),
    variable('var-R2', 'R', '3'),
  ])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected duplicate name to fail.')
  }
  assert.match(result.error, /Variable name must be unique/)
})

test('duplicate macro names are rejected', () => {
  const result = setVariables([
    { ...variable('var-R', 'R', '2'), macroName: 'x' },
    { ...variable('var-q', 'q', '30'), macroName: 'x' },
  ])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected duplicate macro name to fail.')
  }
  assert.match(result.error, /Variable macro name must be unique/)
})

test('invalid variable names are rejected', () => {
  const result = setVariables([variable('var-R1', 'R1', '2')])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid name to fail.')
  }
  assert.match(result.error, /letters only/)
})

test('reserved TikZ and PGF command names are rejected as implicit macros', () => {
  for (const name of reviewRequiredReservedVariableMacroNames) {
    const result = setVariables([variable(`var-${name}`, name, '2')])

    assert.equal(result.ok, false, name)
    if (result.ok) {
      throw new Error(`Expected reserved variable name ${name} to fail.`)
    }
    assert.match(result.error, /reserved/, name)
  }
})

test('dangerous TeX command names remain rejected as implicit macros', () => {
  for (const name of reviewRequiredDangerousTexNames) {
    const result = setVariables([variable(`var-${name}`, name, '2')])

    assert.equal(result.ok, false, name)
    if (result.ok) {
      throw new Error(`Expected dangerous variable name ${name} to fail.`)
    }
    assert.match(result.error, /reserved/, name)
  }
})

test('reserved TikZ macro names are rejected when explicit', () => {
  for (const macroName of ['draw', 'node', 'pgfmathsetmacro'] as const) {
    const result = setVariables([
      {
        ...variable(`var-radius-${macroName}`, `radius${macroName}`, '2'),
        macroName,
      },
    ])

    assert.equal(result.ok, false, macroName)
    if (result.ok) {
      throw new Error(`Expected reserved macro name ${macroName} to fail.`)
    }
    assert.match(result.error, /Variable macro names.*reserved/, macroName)
  }
})

test('ordinary variable names remain valid', () => {
  const result = setVariables(
    reviewRequiredValidVariableNames.map((name) =>
      variable(`var-${name}`, name, '2'),
    ),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(
    result.variables.map((item) => item.name),
    [...reviewRequiredValidVariableNames],
  )
})

test('invalid variable expressions are rejected', () => {
  const result = setVariables([variable('var-R', 'R', '2 +')])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid expression to fail.')
  }
  assert.match(result.error, /ended unexpectedly|Unexpected/)
})

test('variable dependencies evaluate in dependency order', () => {
  const diagram = expectVariableDiagramOk(
    setVariables([
      variable('var-r', 'r', 'R/2'),
      variable('var-R', 'R', '2'),
    ]),
  )
  const resolved = resolveSymbolicVariables(diagram.variables ?? [])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.errors[0]?.message ?? 'Expected variables to resolve.')
  }
  assert.equal(diagram.variables?.find((item) => item.name === 'r')?.previewValue, 1)
  assert.deepEqual(
    resolved.orderedVariables.map((item) => item.name),
    ['R', 'r'],
  )
})

test('dependency cycles are rejected', () => {
  const result = setVariables([
    variable('var-R', 'R', 'q'),
    variable('var-q', 'q', 'R'),
  ])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected dependency cycle to fail.')
  }
  assert.match(result.error, /dependency cycle/)
})

test('dangerous raw TeX in expressions is rejected', () => {
  const result = setVariables([variable('var-R', 'R', '\\input')])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected raw TeX to fail.')
  }
  assert.match(result.error, /Backslash commands/)
})

test('deleting a variable used by another variable is prevented', () => {
  const diagram = expectVariableDiagramOk(
    setVariables([
      variable('var-R', 'R', '2'),
      variable('var-r', 'r', 'R/2'),
    ]),
  )
  const result = deleteSymbolicVariableFromDiagram(diagram, 'var-R')

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected dependent delete to fail.')
  }
  assert.match(result.error, /Unknown variable "R"/)
})

test('updating a variable recomputes dependent preview values', () => {
  const diagram = expectVariableDiagramOk(
    setVariables([
      variable('var-R', 'R', '2'),
      variable('var-r', 'r', 'R/2'),
    ]),
  )
  const updated = expectVariableDiagramOk(
    updateSymbolicVariableInDiagram(diagram, 'var-R', { expression: '6' }),
  )

  assert.equal(updated.variables?.find((item) => item.name === 'R')?.previewValue, 6)
  assert.equal(updated.variables?.find((item) => item.name === 'r')?.previewValue, 3)
})

test('diagram validation rejects stale variable preview values', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const validation = validateDiagram({
    ...diagram,
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '2',
        previewValue: 3,
      },
    ],
  })

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors.map((issue) => issue.message).join(' '),
    /Preview value must match/,
  )
})

function setVariables(variables: readonly SymbolicVariable[]) {
  return setDiagramSymbolicVariables(
    createEmptyDiagram({ ambientDimension: 2 }),
    variables,
  )
}

function variable(
  id: string,
  name: string,
  expression: string,
): SymbolicVariable {
  return {
    id,
    name,
    macroName: name.replace(/[^A-Za-z]/g, ''),
    expression,
    previewValue: 0,
  }
}

function expectVariableDiagramOk(
  result: ReturnType<typeof setDiagramSymbolicVariables>,
): Diagram {
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.diagram
}
