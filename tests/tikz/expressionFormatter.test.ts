import assert from 'node:assert/strict'
import test from 'node:test'
import { parseScalarExpression } from '../../src/model/scalarExpressions.ts'
import type {
  ParsedScalarExpression,
  ScalarExpressionAst,
} from '../../src/model/scalarExpressions.ts'
import { formatScalarExpressionForTikz } from '../../src/tikz/expressionFormatter.ts'

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
