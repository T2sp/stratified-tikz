export type NumericScalar = {
  kind: 'numeric'
  value: number
}

export type SymbolicScalar = {
  kind: 'symbolic'
  expression: string
  previewValue: number
}

export type ScalarInputValue = NumericScalar | SymbolicScalar

export const scalarExpressionFunctionNames = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'abs',
  'exp',
  'ln',
  'log',
  'min',
  'max',
] as const

export type ScalarExpressionFunctionName =
  (typeof scalarExpressionFunctionNames)[number]

export const scalarExpressionConstantNames = ['pi', 'e'] as const

export type ScalarExpressionConstantName =
  (typeof scalarExpressionConstantNames)[number]

export type ScalarExpressionUnaryOperator = '+' | '-'

export type ScalarExpressionBinaryOperator = '+' | '-' | '*' | '/' | '^'

export type ScalarExpressionAst =
  | {
      kind: 'number'
      value: number
    }
  | {
      kind: 'variable'
      name: string
    }
  | {
      kind: 'constant'
      name: ScalarExpressionConstantName
    }
  | {
      kind: 'unary'
      operator: ScalarExpressionUnaryOperator
      argument: ScalarExpressionAst
    }
  | {
      kind: 'binary'
      operator: ScalarExpressionBinaryOperator
      left: ScalarExpressionAst
      right: ScalarExpressionAst
    }
  | {
      kind: 'call'
      name: ScalarExpressionFunctionName
      args: ScalarExpressionAst[]
    }

export type ParsedScalarExpression = {
  source: string
  ast: ScalarExpressionAst
}

export type ParseScalarExpressionOptions = {
  variables?: Iterable<string>
}

export type ParseScalarExpressionResult =
  | {
      ok: true
      expression: ParsedScalarExpression
    }
  | {
      ok: false
      error: string
    }

export type EvaluateScalarExpressionResult =
  | {
      ok: true
      value: number
    }
  | {
      ok: false
      error: string
    }

export type CreateScalarInputValueOptions = ParseScalarExpressionOptions & {
  previewValues?: ReadonlyMap<string, number>
}

export type CreateScalarInputValueResult =
  | {
      ok: true
      scalar: ScalarInputValue
      parsed: ParsedScalarExpression
    }
  | {
      ok: false
      error: string
    }

const identifierPattern = /^[A-Za-z][A-Za-z0-9_]*$/
const dangerousTexCommandNames = [
  'input',
  'write',
  'read',
  'openout',
  'catcode',
  'csname',
] as const

type ScalarExpressionToken =
  | {
      kind: 'number'
      text: string
      value: number
      start: number
    }
  | {
      kind: 'identifier'
      text: string
      start: number
    }
  | {
      kind: 'operator'
      operator: ScalarExpressionBinaryOperator
      start: number
    }
  | {
      kind: 'leftParen'
      start: number
    }
  | {
      kind: 'rightParen'
      start: number
    }
  | {
      kind: 'comma'
      start: number
    }
  | {
      kind: 'eof'
      start: number
    }

export function parseScalarExpression(
  source: string,
  options: ParseScalarExpressionOptions = {},
): ParseScalarExpressionResult {
  const safetyError = validateScalarExpressionSourceSafety(source)
  if (safetyError !== undefined) {
    return {
      ok: false,
      error: safetyError,
    }
  }

  const tokensResult = tokenizeScalarExpression(source)
  if (!tokensResult.ok) {
    return tokensResult
  }

  const parser = new ScalarExpressionParser(
    tokensResult.tokens,
    new Set(options.variables ?? []),
  )

  return parser.parse(source)
}

export function evaluateScalarExpression(
  expression: ParsedScalarExpression | ScalarExpressionAst,
  variableValues: ReadonlyMap<string, number> = new Map(),
): EvaluateScalarExpressionResult {
  const ast = 'ast' in expression ? expression.ast : expression
  const result = evaluateAst(ast, variableValues)

  if (!result.ok) {
    return result
  }

  if (!Number.isFinite(result.value)) {
    return {
      ok: false,
      error: 'Expression evaluated to a non-finite number.',
    }
  }

  return result
}

export function createScalarInputValue(
  source: string,
  options: CreateScalarInputValueOptions = {},
): CreateScalarInputValueResult {
  const parsed = parseScalarExpression(source, options)
  if (!parsed.ok) {
    return parsed
  }

  const evaluated = evaluateScalarExpression(
    parsed.expression,
    options.previewValues,
  )
  if (!evaluated.ok) {
    return evaluated
  }

  return {
    ok: true,
    parsed: parsed.expression,
    scalar:
      isNumericScalarLiteralAst(parsed.expression.ast)
        ? {
            kind: 'numeric',
            value: evaluated.value,
          }
        : {
            kind: 'symbolic',
            expression: source,
            previewValue: evaluated.value,
          },
  }
}

function isNumericScalarLiteralAst(ast: ScalarExpressionAst): boolean {
  if (ast.kind === 'number') {
    return true
  }

  return ast.kind === 'unary' && isNumericScalarLiteralAst(ast.argument)
}

export function scalarExpressionVariables(
  expression: ParsedScalarExpression | ScalarExpressionAst,
): string[] {
  const ast = 'ast' in expression ? expression.ast : expression
  const variables = new Set<string>()
  collectScalarExpressionVariables(ast, variables)

  return [...variables].sort()
}

export function isScalarExpressionVariableName(name: string): boolean {
  return (
    identifierPattern.test(name) &&
    !isScalarExpressionFunctionName(name) &&
    !isScalarExpressionConstantName(name) &&
    !isDangerousTexCommandName(name)
  )
}

export function isScalarExpressionFunctionName(
  name: string,
): name is ScalarExpressionFunctionName {
  return scalarExpressionFunctionNames.includes(
    name as ScalarExpressionFunctionName,
  )
}

export function isScalarExpressionConstantName(
  name: string,
): name is ScalarExpressionConstantName {
  return scalarExpressionConstantNames.includes(
    name as ScalarExpressionConstantName,
  )
}

function validateScalarExpressionSourceSafety(source: string): string | undefined {
  if (source.trim().length === 0) {
    return 'Expression must not be empty.'
  }

  if (source.includes('\\')) {
    return 'Backslash commands and raw TeX are not allowed in expressions.'
  }

  if (source.includes('{') || source.includes('}')) {
    return 'Braces are not supported in scalar expressions.'
  }

  if (source.includes(';')) {
    return 'Semicolons are not allowed in scalar expressions.'
  }

  if (source.includes('\n') || source.includes('\r')) {
    return 'Expressions must be single-line.'
  }

  return undefined
}

function tokenizeScalarExpression(
  source: string,
):
  | {
      ok: true
      tokens: ScalarExpressionToken[]
    }
  | {
      ok: false
      error: string
    } {
  const tokens: ScalarExpressionToken[] = []
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (char === ' ' || char === '\t') {
      index += 1
      continue
    }

    if (char === undefined) {
      break
    }

    if (isDigit(char) || (char === '.' && isDigit(source[index + 1]))) {
      const start = index
      index = readNumberToken(source, index)
      const text = source.slice(start, index)
      const value = Number(text)

      if (!Number.isFinite(value)) {
        return {
          ok: false,
          error: `Invalid number "${text}".`,
        }
      }

      tokens.push({ kind: 'number', text, value, start })
      continue
    }

    if (isIdentifierStart(char)) {
      const start = index
      index += 1
      while (isIdentifierPart(source[index])) {
        index += 1
      }
      tokens.push({
        kind: 'identifier',
        text: source.slice(start, index),
        start,
      })
      continue
    }

    if (
      char === '+' ||
      char === '-' ||
      char === '*' ||
      char === '/' ||
      char === '^'
    ) {
      tokens.push({ kind: 'operator', operator: char, start: index })
      index += 1
      continue
    }

    if (char === '(') {
      tokens.push({ kind: 'leftParen', start: index })
      index += 1
      continue
    }

    if (char === ')') {
      tokens.push({ kind: 'rightParen', start: index })
      index += 1
      continue
    }

    if (char === ',') {
      tokens.push({ kind: 'comma', start: index })
      index += 1
      continue
    }

    return {
      ok: false,
      error: `Invalid token "${char}" at position ${index + 1}.`,
    }
  }

  tokens.push({ kind: 'eof', start: source.length })

  return {
    ok: true,
    tokens,
  }
}

function readNumberToken(source: string, start: number): number {
  let index = start

  while (isDigit(source[index])) {
    index += 1
  }

  if (source[index] === '.') {
    index += 1
    while (isDigit(source[index])) {
      index += 1
    }
  }

  return index
}

class ScalarExpressionParser {
  private readonly tokens: ScalarExpressionToken[]
  private readonly declaredVariables: ReadonlySet<string>
  private index = 0

  constructor(
    tokens: ScalarExpressionToken[],
    declaredVariables: ReadonlySet<string>,
  ) {
    this.tokens = tokens
    this.declaredVariables = declaredVariables
  }

  parse(source: string): ParseScalarExpressionResult {
    try {
      const ast = this.parseExpression()
      const token = this.peek()

      if (token.kind !== 'eof') {
        return {
          ok: false,
          error: `Unexpected token at position ${token.start + 1}.`,
        }
      }

      return {
        ok: true,
        expression: {
          source,
          ast,
        },
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid expression.',
      }
    }
  }

  private parseExpression(): ScalarExpressionAst {
    return this.parseAdditive()
  }

  private parseAdditive(): ScalarExpressionAst {
    let left = this.parseMultiplicative()

    while (this.peekOperator('+') || this.peekOperator('-')) {
      const operator = this.advanceOperator()
      const right = this.parseMultiplicative()
      left = {
        kind: 'binary',
        operator,
        left,
        right,
      }
    }

    return left
  }

  private parseMultiplicative(): ScalarExpressionAst {
    let left = this.parseUnary()

    while (this.peekOperator('*') || this.peekOperator('/')) {
      const operator = this.advanceOperator()
      const right = this.parseUnary()
      left = {
        kind: 'binary',
        operator,
        left,
        right,
      }
    }

    return left
  }

  private parseUnary(): ScalarExpressionAst {
    if (this.peekOperator('+') || this.peekOperator('-')) {
      const operator = this.advanceUnaryOperator()
      return {
        kind: 'unary',
        operator,
        argument: this.parseUnary(),
      }
    }

    return this.parsePower()
  }

  private parsePower(): ScalarExpressionAst {
    const left = this.parsePrimary()

    if (!this.peekOperator('^')) {
      return left
    }

    const operator = this.advanceOperator()
    const right = this.parseUnary()

    return {
      kind: 'binary',
      operator,
      left,
      right,
    }
  }

  private parsePrimary(): ScalarExpressionAst {
    const token = this.peek()

    switch (token.kind) {
      case 'number':
        this.advance()
        return {
          kind: 'number',
          value: token.value,
        }
      case 'identifier':
        return this.parseIdentifier(token)
      case 'leftParen':
        this.advance()
        return this.parseParenthesizedExpression(token.start)
      case 'rightParen':
        throw new Error(`Unexpected ")" at position ${token.start + 1}.`)
      case 'comma':
        throw new Error(`Unexpected "," at position ${token.start + 1}.`)
      case 'operator':
        throw new Error(
          `Unexpected operator "${token.operator}" at position ${token.start + 1}.`,
        )
      case 'eof':
        throw new Error('Expression ended unexpectedly.')
    }
  }

  private parseIdentifier(
    token: Extract<ScalarExpressionToken, { kind: 'identifier' }>,
  ): ScalarExpressionAst {
    this.advance()

    if (this.peek().kind === 'leftParen') {
      return this.parseFunctionCall(token)
    }

    if (isScalarExpressionConstantName(token.text)) {
      return {
        kind: 'constant',
        name: token.text,
      }
    }

    if (isScalarExpressionFunctionName(token.text)) {
      throw new Error(
        `Function "${token.text}" must be called with parentheses.`,
      )
    }

    if (isDangerousTexCommandName(token.text)) {
      throw new Error(
        `Identifier "${token.text}" is reserved because it matches a dangerous TeX command name.`,
      )
    }

    if (!this.declaredVariables.has(token.text)) {
      throw new Error(`Unknown variable "${token.text}".`)
    }

    return {
      kind: 'variable',
      name: token.text,
    }
  }

  private parseFunctionCall(
    token: Extract<ScalarExpressionToken, { kind: 'identifier' }>,
  ): ScalarExpressionAst {
    if (!isScalarExpressionFunctionName(token.text)) {
      if (isScalarExpressionConstantName(token.text)) {
        throw new Error(`Constant "${token.text}" cannot be called as a function.`)
      }

      if (isDangerousTexCommandName(token.text)) {
        throw new Error(
          `Identifier "${token.text}" is reserved because it matches a dangerous TeX command name.`,
        )
      }

      throw new Error(`Unknown function "${token.text}".`)
    }

    this.expect('leftParen', `Expected "(" after function "${token.text}".`)
    const args: ScalarExpressionAst[] = []

    if (this.peek().kind !== 'rightParen') {
      args.push(this.parseExpression())
      while (this.peek().kind === 'comma') {
        this.advance()
        args.push(this.parseExpression())
      }
    }

    this.expect(
      'rightParen',
      `Expected ")" to close function "${token.text}".`,
    )
    this.validateFunctionArity(token.text, args.length)

    return {
      kind: 'call',
      name: token.text,
      args,
    }
  }

  private parseParenthesizedExpression(start: number): ScalarExpressionAst {
    const expression = this.parseExpression()
    const token = this.peek()

    if (token.kind !== 'rightParen') {
      throw new Error(`Expected ")" to match "(" at position ${start + 1}.`)
    }

    this.advance()

    return expression
  }

  private validateFunctionArity(
    name: ScalarExpressionFunctionName,
    count: number,
  ): void {
    if (name === 'min' || name === 'max') {
      if (count < 2) {
        throw new Error(`Function "${name}" requires at least two arguments.`)
      }
      return
    }

    if (count !== 1) {
      throw new Error(`Function "${name}" requires exactly one argument.`)
    }
  }

  private expect(
    kind: ScalarExpressionToken['kind'],
    message: string,
  ): void {
    if (this.peek().kind !== kind) {
      throw new Error(message)
    }

    this.advance()
  }

  private peekOperator(operator: ScalarExpressionBinaryOperator): boolean {
    const token = this.peek()

    return token.kind === 'operator' && token.operator === operator
  }

  private advanceOperator(): ScalarExpressionBinaryOperator {
    const token = this.peek()

    if (token.kind !== 'operator') {
      throw new Error('Expected an operator.')
    }

    this.advance()
    return token.operator
  }

  private advanceUnaryOperator(): ScalarExpressionUnaryOperator {
    const token = this.peek()

    if (
      token.kind !== 'operator' ||
      (token.operator !== '+' && token.operator !== '-')
    ) {
      throw new Error('Expected a unary operator.')
    }

    this.advance()
    return token.operator
  }

  private peek(): ScalarExpressionToken {
    return this.tokens[this.index] ?? { kind: 'eof', start: this.tokens.length }
  }

  private advance(): ScalarExpressionToken {
    const token = this.peek()
    this.index += 1

    return token
  }
}

function evaluateAst(
  ast: ScalarExpressionAst,
  variableValues: ReadonlyMap<string, number>,
): EvaluateScalarExpressionResult {
  switch (ast.kind) {
    case 'number':
      return finiteEvaluationResult(ast.value)
    case 'variable':
      return evaluateVariable(ast.name, variableValues)
    case 'constant':
      return finiteEvaluationResult(
        ast.name === 'pi' ? Math.PI : Math.E,
      )
    case 'unary':
      return evaluateUnary(ast, variableValues)
    case 'binary':
      return evaluateBinary(ast, variableValues)
    case 'call':
      return evaluateCall(ast, variableValues)
  }
}

function evaluateVariable(
  name: string,
  variableValues: ReadonlyMap<string, number>,
): EvaluateScalarExpressionResult {
  const value = variableValues.get(name)

  if (value === undefined) {
    return {
      ok: false,
      error: `Missing preview value for variable "${name}".`,
    }
  }

  return finiteEvaluationResult(value, `Variable "${name}" is not finite.`)
}

function evaluateUnary(
  ast: Extract<ScalarExpressionAst, { kind: 'unary' }>,
  variableValues: ReadonlyMap<string, number>,
): EvaluateScalarExpressionResult {
  const argument = evaluateAst(ast.argument, variableValues)
  if (!argument.ok) {
    return argument
  }

  return finiteEvaluationResult(
    ast.operator === '-' ? -argument.value : argument.value,
  )
}

function evaluateBinary(
  ast: Extract<ScalarExpressionAst, { kind: 'binary' }>,
  variableValues: ReadonlyMap<string, number>,
): EvaluateScalarExpressionResult {
  const left = evaluateAst(ast.left, variableValues)
  if (!left.ok) {
    return left
  }

  const right = evaluateAst(ast.right, variableValues)
  if (!right.ok) {
    return right
  }

  switch (ast.operator) {
    case '+':
      return finiteEvaluationResult(left.value + right.value)
    case '-':
      return finiteEvaluationResult(left.value - right.value)
    case '*':
      return finiteEvaluationResult(left.value * right.value)
    case '/':
      if (right.value === 0) {
        return {
          ok: false,
          error: 'Division by zero is not allowed.',
        }
      }
      return finiteEvaluationResult(left.value / right.value)
    case '^':
      return finiteEvaluationResult(left.value ** right.value)
  }
}

function evaluateCall(
  ast: Extract<ScalarExpressionAst, { kind: 'call' }>,
  variableValues: ReadonlyMap<string, number>,
): EvaluateScalarExpressionResult {
  const evaluatedArgs: number[] = []

  for (const arg of ast.args) {
    const evaluated = evaluateAst(arg, variableValues)
    if (!evaluated.ok) {
      return evaluated
    }
    evaluatedArgs.push(evaluated.value)
  }

  switch (ast.name) {
    case 'sin':
      return finiteEvaluationResult(Math.sin(degreesToRadians(evaluatedArgs[0])))
    case 'cos':
      return finiteEvaluationResult(Math.cos(degreesToRadians(evaluatedArgs[0])))
    case 'tan':
      return finiteEvaluationResult(Math.tan(degreesToRadians(evaluatedArgs[0])))
    case 'asin':
      return finiteEvaluationResult(radiansToDegrees(Math.asin(evaluatedArgs[0])))
    case 'acos':
      return finiteEvaluationResult(radiansToDegrees(Math.acos(evaluatedArgs[0])))
    case 'atan':
      return finiteEvaluationResult(radiansToDegrees(Math.atan(evaluatedArgs[0])))
    case 'sqrt':
      return finiteEvaluationResult(Math.sqrt(evaluatedArgs[0]))
    case 'abs':
      return finiteEvaluationResult(Math.abs(evaluatedArgs[0]))
    case 'exp':
      return finiteEvaluationResult(Math.exp(evaluatedArgs[0]))
    case 'ln':
      return finiteEvaluationResult(Math.log(evaluatedArgs[0]))
    case 'log':
      return finiteEvaluationResult(Math.log10(evaluatedArgs[0]))
    case 'min':
      return finiteEvaluationResult(Math.min(...evaluatedArgs))
    case 'max':
      return finiteEvaluationResult(Math.max(...evaluatedArgs))
  }
}

function finiteEvaluationResult(
  value: number,
  error = 'Expression evaluated to a non-finite number.',
): EvaluateScalarExpressionResult {
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      error,
    }
  }

  return {
    ok: true,
    value: Object.is(value, -0) ? 0 : value,
  }
}

function collectScalarExpressionVariables(
  ast: ScalarExpressionAst,
  variables: Set<string>,
): void {
  switch (ast.kind) {
    case 'number':
    case 'constant':
      return
    case 'variable':
      variables.add(ast.name)
      return
    case 'unary':
      collectScalarExpressionVariables(ast.argument, variables)
      return
    case 'binary':
      collectScalarExpressionVariables(ast.left, variables)
      collectScalarExpressionVariables(ast.right, variables)
      return
    case 'call':
      ast.args.forEach((arg) => collectScalarExpressionVariables(arg, variables))
      return
  }
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9'
}

function isIdentifierStart(char: string | undefined): boolean {
  return (
    char !== undefined &&
    ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z'))
  )
}

function isIdentifierPart(char: string | undefined): boolean {
  return char !== undefined && (isIdentifierStart(char) || isDigit(char) || char === '_')
}

function isDangerousTexCommandName(name: string): boolean {
  return dangerousTexCommandNames.includes(
    name as (typeof dangerousTexCommandNames)[number],
  )
}
