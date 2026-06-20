import assert from 'node:assert/strict'
import test from 'node:test'
import { parseScalarExpression } from '../../src/model/scalarExpressions.ts'
import type {
  ParsedScalarExpression,
  ScalarExpressionAst,
} from '../../src/model/scalarExpressions.ts'
import {
  formatScalarExpressionForTikz,
  isSafeTikzMacroName,
} from '../../src/tikz/expressionFormatter.ts'

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

const reviewRequiredTikzReservedMacroNames = [
  'draw',
  'fill',
  'filldraw',
  'node',
  'coordinate',
  'path',
  'clip',
  'foreach',
  'begin',
  'end',
  'pgfmathsetmacro',
  'pgfmathparse',
  'pgfmathresult',
  'tikzset',
  'tikzpicture',
] as const

const safeTikzMacroNames = [
  'x',
  'y',
  'z',
  'theta',
  'radius',
  'height',
  'alphaBeta',
] as const

test('TikZ formatter maps variables to macro names', () => {
  const formatted = formatOk('R*cos(q)', ['R', 'q'], new Map([
    ['R', '\\R'],
    ['q', '\\q'],
  ]))

  assert.equal(formatted, '\\R * cos(\\q)')
})

test('TikZ formatter preserves elementary functions and constants', () => {
  const formatted = formatOk(
    'sqrt(abs(R)) + ln(e) + max(R, q)',
    ['R', 'q'],
    new Map([
      ['R', '\\R'],
      ['q', '\\q'],
    ]),
  )

  assert.equal(formatted, 'sqrt(abs(\\R)) + ln(e) + max(\\R, \\q)')
})

test('TikZ formatter keeps required parentheses for precedence', () => {
  const formatted = formatOk('R*(q + 1) - (R - q)', ['R', 'q'], new Map([
    ['R', '\\R'],
    ['q', '\\q'],
  ]))

  assert.equal(formatted, '\\R * (\\q + 1) - (\\R - \\q)')
})

test('TikZ formatter keeps unary parenthesization unambiguous', () => {
  const formatted = formatOk('-(R + 1)^2', ['R'], new Map([
    ['R', '\\R'],
  ]))

  assert.equal(formatted, '-((\\R + 1) ^ 2)')
})

test('TikZ formatter rejects missing variable macro mappings', () => {
  const parsed = parseOk('R + q', ['R', 'q'])
  const formatted = formatScalarExpressionForTikz(
    parsed,
    new Map([['R', '\\R']]),
  )

  assert.equal(formatted.ok, false)
  if (formatted.ok) {
    throw new Error('Expected formatting to fail.')
  }
  assert.match(formatted.error, /Missing TikZ macro mapping/)
})

test('TikZ formatter rejects unsafe macro names', () => {
  const parsed = parseOk('R', ['R'])
  const formatted = formatScalarExpressionForTikz(
    parsed,
    new Map([['R', '\\input']]),
  )

  assert.equal(formatted.ok, false)
  if (formatted.ok) {
    throw new Error('Expected formatting to fail.')
  }
  assert.match(formatted.error, /not safe/)
})

test('TikZ macro validator rejects dangerous control sequence names', () => {
  for (const name of reviewRequiredDangerousTexNames) {
    assert.equal(isSafeTikzMacroName(name), false)
    assert.equal(isSafeTikzMacroName(`\\${name}`), false)
  }

  assert.equal(isSafeTikzMacroName('\\input'), false)
  assert.equal(isSafeTikzMacroName('\\RequirePackage'), false)
})

test('TikZ macro validator rejects TikZ and PGF command names', () => {
  for (const name of reviewRequiredTikzReservedMacroNames) {
    assert.equal(isSafeTikzMacroName(name), false)
    assert.equal(isSafeTikzMacroName(`\\${name}`), false)
  }
})

test('TikZ macro validator keeps safe control sequence names valid', () => {
  for (const name of safeTikzMacroNames) {
    assert.equal(isSafeTikzMacroName(name), true)
    assert.equal(isSafeTikzMacroName(`\\${name}`), true)
  }
})

test('TikZ formatter rejects dangerous variable macro mappings', () => {
  const parsed = parseOk('x', ['x'])

  for (const macro of ['\\def', 'def']) {
    const formatted = formatScalarExpressionForTikz(
      parsed,
      new Map([['x', macro]]),
    )

    assert.equal(formatted.ok, false)
    if (formatted.ok) {
      throw new Error('Expected formatting to fail.')
    }
    assert.match(formatted.error, /not safe/)
  }
})

test('TikZ formatter rejects unsafe AST variable names', () => {
  const ast: ScalarExpressionAst = { kind: 'variable', name: 'def' }
  const formatted = formatScalarExpressionForTikz(
    ast,
    new Map([['def', '\\x']]),
  )

  assert.equal(formatted.ok, false)
  if (formatted.ok) {
    throw new Error('Expected formatting to fail.')
  }
  assert.match(formatted.error, /not safe/)
})

test('TikZ formatter rejects non-finite numeric AST values', () => {
  const ast: ScalarExpressionAst = { kind: 'number', value: Number.NaN }
  const formatted = formatScalarExpressionForTikz(ast, new Map())

  assert.equal(formatted.ok, false)
  if (formatted.ok) {
    throw new Error('Expected formatting to fail.')
  }
  assert.match(formatted.error, /non-finite/)
})

function formatOk(
  source: string,
  variables: readonly string[],
  macros: ReadonlyMap<string, string>,
): string {
  const parsed = parseOk(source, variables)
  const formatted = formatScalarExpressionForTikz(parsed, macros)

  assert.equal(formatted.ok, true)
  if (!formatted.ok) {
    throw new Error(formatted.error)
  }

  return formatted.expression
}

function parseOk(
  source: string,
  variables: readonly string[],
): ParsedScalarExpression {
  const parsed = parseScalarExpression(source, { variables })

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  return parsed.expression
}
