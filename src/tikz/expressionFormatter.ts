import type {
  ParsedScalarExpression,
  ScalarExpressionAst,
  ScalarExpressionBinaryOperator,
} from '../model/scalarExpressions.ts'
import {
  isDangerousTexControlSequenceName,
  isScalarExpressionVariableName,
} from '../model/scalarExpressions.ts'

export type TikzExpressionFormatResult =
  | {
      ok: true
      expression: string
    }
  | {
      ok: false
      error: string
    }

export function formatScalarExpressionForTikz(
  expression: ParsedScalarExpression | ScalarExpressionAst,
  variableMacros: ReadonlyMap<string, string>,
): TikzExpressionFormatResult {
  const ast = 'ast' in expression ? expression.ast : expression
  const formatted = formatAst(ast, variableMacros)

  if (!formatted.ok) {
    return formatted
  }

  return {
    ok: true,
    expression: formatted.expression,
  }
}

function formatAst(
  ast: ScalarExpressionAst,
  variableMacros: ReadonlyMap<string, string>,
): TikzExpressionFormatResult {
  switch (ast.kind) {
    case 'number':
      if (!Number.isFinite(ast.value)) {
        return {
          ok: false,
          error: 'Cannot format a non-finite number as a TikZ expression.',
        }
      }

      return {
        ok: true,
        expression: formatExpressionNumber(ast.value),
      }
    case 'variable':
      return formatVariable(ast.name, variableMacros)
    case 'constant':
      return {
        ok: true,
        expression: ast.name,
      }
    case 'unary':
      return formatUnary(ast, variableMacros)
    case 'binary':
      return formatBinary(ast, variableMacros)
    case 'call':
      return formatCall(ast, variableMacros)
  }
}

function formatVariable(
  name: string,
  variableMacros: ReadonlyMap<string, string>,
): TikzExpressionFormatResult {
  if (!isScalarExpressionVariableName(name)) {
    return {
      ok: false,
      error: `Variable "${name}" is not safe for TikZ expression formatting.`,
    }
  }

  const macro = variableMacros.get(name)

  if (macro === undefined) {
    return {
      ok: false,
      error: `Missing TikZ macro mapping for variable "${name}".`,
    }
  }

  if (!isSafeTikzMacroMapping(macro)) {
    return {
      ok: false,
      error: `TikZ macro mapping for variable "${name}" is not safe.`,
    }
  }

  return {
    ok: true,
    expression: macro,
  }
}

function formatUnary(
  ast: Extract<ScalarExpressionAst, { kind: 'unary' }>,
  variableMacros: ReadonlyMap<string, string>,
): TikzExpressionFormatResult {
  const argument = formatAst(ast.argument, variableMacros)
  if (!argument.ok) {
    return argument
  }

  const formattedArgument =
    ast.argument.kind === 'binary'
      ? `(${argument.expression})`
      : argument.expression

  return {
    ok: true,
    expression: `${ast.operator}${formattedArgument}`,
  }
}

function formatBinary(
  ast: Extract<ScalarExpressionAst, { kind: 'binary' }>,
  variableMacros: ReadonlyMap<string, string>,
): TikzExpressionFormatResult {
  const left = formatAst(ast.left, variableMacros)
  if (!left.ok) {
    return left
  }

  const right = formatAst(ast.right, variableMacros)
  if (!right.ok) {
    return right
  }

  return {
    ok: true,
    expression: `${formatBinaryOperand(
      ast.left,
      left.expression,
      ast.operator,
      'left',
    )} ${ast.operator} ${formatBinaryOperand(
      ast.right,
      right.expression,
      ast.operator,
      'right',
    )}`,
  }
}

function formatCall(
  ast: Extract<ScalarExpressionAst, { kind: 'call' }>,
  variableMacros: ReadonlyMap<string, string>,
): TikzExpressionFormatResult {
  const args: string[] = []

  for (const arg of ast.args) {
    const formatted = formatAst(arg, variableMacros)
    if (!formatted.ok) {
      return formatted
    }
    args.push(formatted.expression)
  }

  return {
    ok: true,
    expression: `${ast.name}(${args.join(', ')})`,
  }
}

function formatBinaryOperand(
  child: ScalarExpressionAst,
  formattedChild: string,
  parentOperator: ScalarExpressionBinaryOperator,
  side: 'left' | 'right',
): string {
  if (needsBinaryOperandParentheses(child, parentOperator, side)) {
    return `(${formattedChild})`
  }

  return formattedChild
}

function needsBinaryOperandParentheses(
  child: ScalarExpressionAst,
  parentOperator: ScalarExpressionBinaryOperator,
  side: 'left' | 'right',
): boolean {
  const childPrecedence = expressionPrecedence(child)
  const parentPrecedence = binaryOperatorPrecedence(parentOperator)

  if (childPrecedence < parentPrecedence) {
    return true
  }

  if (child.kind !== 'binary') {
    return false
  }

  if (parentOperator === '^') {
    return true
  }

  if (side === 'right' && parentOperator === '-') {
    return childPrecedence === parentPrecedence
  }

  if (side === 'right' && parentOperator === '/') {
    return childPrecedence === parentPrecedence
  }

  return false
}

function expressionPrecedence(ast: ScalarExpressionAst): number {
  switch (ast.kind) {
    case 'number':
    case 'variable':
    case 'constant':
    case 'call':
      return 5
    case 'unary':
      return 3
    case 'binary':
      return binaryOperatorPrecedence(ast.operator)
  }
}

function binaryOperatorPrecedence(
  operator: ScalarExpressionBinaryOperator,
): number {
  switch (operator) {
    case '+':
    case '-':
      return 1
    case '*':
    case '/':
      return 2
    case '^':
      return 4
  }
}

export function isSafeTikzMacroName(macro: string): boolean {
  if (isDangerousTexControlSequenceName(macro)) {
    return false
  }

  if (!/^\\?[A-Za-z]+$/.test(macro)) {
    return false
  }

  return true
}

function isSafeTikzMacroMapping(macro: string): boolean {
  return /^\\[A-Za-z]+$/.test(macro) && isSafeTikzMacroName(macro)
}

function formatExpressionNumber(value: number): string {
  if (Object.is(value, -0)) {
    return '0'
  }

  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toFixed(12)))
}
