import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createScalarInputValue,
  evaluateScalarExpression,
  isScalarExpressionVariableName,
  parseScalarExpression,
  scalarExpressionVariables,
} from '../../src/model/scalarExpressions.ts'
import type { ParsedScalarExpression } from '../../src/model/scalarExpressions.ts'

test('numeric literal parses and evaluates', () => {
  const parsed = parseOk('-3.5')
  const evaluated = evaluateScalarExpression(parsed)

  assert.equal(evaluated.ok, true)
  if (!evaluated.ok) {
    throw new Error(evaluated.error)
  }
  assert.equal(evaluated.value, -3.5)
})

test('createScalarInputValue classifies numeric and symbolic scalar values', () => {
  const numeric = createScalarInputValue('-2.25')
  const symbolic = createScalarInputValue('R + 1', {
    variables: ['R'],
    previewValues: new Map([['R', 3]]),
  })

  assert.equal(numeric.ok, true)
  assert.equal(symbolic.ok, true)
  if (!numeric.ok || !symbolic.ok) {
    throw new Error('Expected scalar creation to succeed.')
  }

  assert.deepEqual(numeric.scalar, { kind: 'numeric', value: -2.25 })
  assert.deepEqual(symbolic.scalar, {
    kind: 'symbolic',
    expression: 'R + 1',
    previewValue: 4,
  })
})

test('R*cos(q) parses and evaluates with variable preview values', () => {
  assertClose(
    evaluateOk('R*cos(q)', ['R', 'q'], new Map([
      ['R', 2],
      ['q', 60],
    ])),
    1,
  )
})

test('R*sin(q) uses PGFMath degree trig semantics', () => {
  assertClose(
    evaluateOk('R*sin(q)', ['R', 'q'], new Map([
      ['R', 2],
      ['q', 30],
    ])),
    1,
  )
})

test('parentheses and operator precedence work', () => {
  assert.equal(evaluateOk('2 + 3 * 4 ^ 2'), 50)
  assert.equal(evaluateOk('(2 + 3) * 4'), 20)
  assert.equal(evaluateOk('2^3^2'), 512)
})

test('unary minus binds below exponentiation', () => {
  assert.equal(evaluateOk('-2^2'), -4)
  assert.equal(evaluateOk('(-2)^2'), 4)
})

test('elementary functions evaluate with PGFMath-compatible conventions', () => {
  assertClose(evaluateOk('sqrt(9) + abs(-2) + exp(0) + ln(e) + log(100)'), 9)
  assertClose(evaluateOk('asin(1) + acos(0) + atan(1)'), 225)
  assert.equal(evaluateOk('min(3, 2, 5) + max(1, 4, 2)'), 6)
})

test('scalarExpressionVariables returns declared variable names used by the AST', () => {
  const parsed = parseOk('R*cos(q) + R', ['R', 'q'])

  assert.deepEqual(scalarExpressionVariables(parsed), ['R', 'q'])
})

test('unknown variable is rejected', () => {
  expectParseError('R + 1', /Unknown variable "R"/)
})

test('unknown function is rejected', () => {
  expectParseError('foo(1)', /Unknown function "foo"/)
})

test('dangerous TeX command names are rejected even without a backslash', () => {
  expectParseError('input(1)', /dangerous TeX command/)
})

test('backslash is rejected', () => {
  expectParseError('\\input', /Backslash commands/)
})

test('newline is rejected', () => {
  expectParseError('1 +\n2', /single-line/)
})

test('unmatched parentheses are rejected', () => {
  expectParseError('(1 + 2', /Expected "\)"/)
  expectParseError('1 + 2)', /Unexpected token/)
})

test('division by zero is rejected during evaluation', () => {
  expectEvaluationError('1 / (q - q)', /Division by zero/, ['q'], new Map([
    ['q', 3],
  ]))
})

test('non-finite evaluation is rejected', () => {
  expectEvaluationError('sqrt(-1)', /non-finite/)
  expectEvaluationError('R + 1', /not finite/, ['R'], new Map([
    ['R', Number.POSITIVE_INFINITY],
  ]))
})

test('variable names reject reserved functions, constants, and dangerous commands', () => {
  assert.equal(isScalarExpressionVariableName('theta'), true)
  assert.equal(isScalarExpressionVariableName('sin'), false)
  assert.equal(isScalarExpressionVariableName('pi'), false)
  assert.equal(isScalarExpressionVariableName('input'), false)
})

function parseOk(
  source: string,
  variables: readonly string[] = [],
): ParsedScalarExpression {
  const parsed = parseScalarExpression(source, { variables })

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  return parsed.expression
}

function evaluateOk(
  source: string,
  variables: readonly string[] = [],
  values: ReadonlyMap<string, number> = new Map(),
): number {
  const parsed = parseOk(source, variables)
  const evaluated = evaluateScalarExpression(parsed, values)

  assert.equal(evaluated.ok, true)
  if (!evaluated.ok) {
    throw new Error(evaluated.error)
  }

  return evaluated.value
}

function expectParseError(
  source: string,
  pattern: RegExp,
  variables: readonly string[] = [],
): void {
  const parsed = parseScalarExpression(source, { variables })

  assert.equal(parsed.ok, false)
  if (parsed.ok) {
    throw new Error('Expected parsing to fail.')
  }
  assert.match(parsed.error, pattern)
}

function expectEvaluationError(
  source: string,
  pattern: RegExp,
  variables: readonly string[] = [],
  values: ReadonlyMap<string, number> = new Map(),
): void {
  const parsed = parseOk(source, variables)
  const evaluated = evaluateScalarExpression(parsed, values)

  assert.equal(evaluated.ok, false)
  if (evaluated.ok) {
    throw new Error('Expected evaluation to fail.')
  }
  assert.match(evaluated.error, pattern)
}

function assertClose(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `Expected ${actual} to be close to ${expected}.`,
  )
}
