import {
  evaluateScalarExpression,
  isScalarExpressionVariableName,
  isSafeTexMacroName,
  parseScalarExpression,
  scalarExpressionVariables,
  type ParsedScalarExpression,
} from './scalarExpressions.ts'
import type {
  Diagram,
  DiagramValidationIssue,
  SymbolicVariable,
} from './types.ts'

export type SymbolicVariableInput = {
  id: string
  name: string
  expression: string
  macroName?: string
}

export type SymbolicVariableUpdateInput = {
  name?: string
  expression?: string
  macroName?: string
}

export type ResolveSymbolicVariablesResult =
  | {
      ok: true
      variables: SymbolicVariable[]
      orderedVariables: SymbolicVariable[]
      values: ReadonlyMap<string, number>
      parsedExpressions: ReadonlyMap<string, ParsedScalarExpression>
    }
  | {
      ok: false
      errors: DiagramValidationIssue[]
    }

export type SymbolicVariableDiagramResult =
  | {
      ok: true
      diagram: Diagram
      variables: SymbolicVariable[]
    }
  | {
      ok: false
      error: string
      errors: DiagramValidationIssue[]
    }

type VariableCandidate = SymbolicVariable & {
  path: string
}

type VariableVisitState = 'visiting' | 'visited'

const previewValueEpsilon = 1e-9
const variableNamePattern = /^[A-Za-z]+$/
const preferredVariableNames = [
  'R',
  'q',
  'r',
  'a',
  'b',
  'c',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'A',
  'B',
  'C',
  'P',
  'Q',
  'S',
] as const
const generatedNameAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function isSymbolicVariableName(name: string): boolean {
  return variableNamePattern.test(name) && isScalarExpressionVariableName(name)
}

export function isSymbolicVariableMacroName(macroName: string): boolean {
  return (
    !macroName.startsWith('\\') &&
    variableNamePattern.test(macroName) &&
    isScalarExpressionVariableName(macroName) &&
    isSafeTexMacroName(macroName)
  )
}

export function macroNameFromSymbolicVariableName(name: string): string {
  return name.trim().replace(/[^A-Za-z]/g, '')
}

export function nextSymbolicVariableName(
  variables: readonly SymbolicVariable[] | undefined,
): string {
  const usedNames = new Set((variables ?? []).map((variable) => variable.name))

  for (const name of preferredVariableNames) {
    if (!usedNames.has(name) && isSymbolicVariableName(name)) {
      return name
    }
  }

  let index = 0
  while (true) {
    const name = alphabeticName(index)

    if (!usedNames.has(name) && isSymbolicVariableName(name)) {
      return name
    }

    index += 1
  }
}

export function validateSymbolicVariables(
  value: unknown,
  path = 'variables',
): DiagramValidationIssue[] {
  if (value === undefined) {
    return []
  }

  const resolved = resolveSymbolicVariables(value, {
    path,
    checkPreviewValues: true,
  })

  return resolved.ok ? [] : resolved.errors
}

export function resolveSymbolicVariables(
  value: unknown,
  options: {
    path?: string
    checkPreviewValues?: boolean
  } = {},
): ResolveSymbolicVariablesResult {
  const path = options.path ?? 'variables'
  const errors: DiagramValidationIssue[] = []
  const candidates = readVariableCandidates(value, path, errors)

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const allNames = candidates.map((variable) => variable.name)
  const parsedExpressions = new Map<string, ParsedScalarExpression>()

  candidates.forEach((variable) => {
    const parsed = parseScalarExpression(variable.expression, {
      variables: allNames,
    })

    if (!parsed.ok) {
      pushError(errors, `${variable.path}.expression`, parsed.error)
      return
    }

    parsedExpressions.set(variable.name, parsed.expression)
  })

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const orderedNames = dependencyOrder(candidates, parsedExpressions, errors)

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const values = evaluateVariables(candidates, orderedNames, parsedExpressions, errors)

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  if (options.checkPreviewValues === true) {
    checkPreviewValues(candidates, values, errors)

    if (errors.length > 0) {
      return { ok: false, errors }
    }
  }

  const variables = candidates.map((variable) => ({
    id: variable.id,
    name: variable.name,
    macroName: variable.macroName,
    expression: variable.expression,
    previewValue: values.get(variable.name) ?? variable.previewValue,
  }))
  const variablesByName = new Map(
    variables.map((variable) => [variable.name, variable]),
  )
  const orderedVariables = orderedNames.flatMap((name) => {
    const variable = variablesByName.get(name)

    return variable === undefined ? [] : [variable]
  })

  return {
    ok: true,
    variables,
    orderedVariables,
    values,
    parsedExpressions,
  }
}

export function setDiagramSymbolicVariables(
  diagram: Diagram,
  variables: readonly SymbolicVariable[],
): SymbolicVariableDiagramResult {
  const resolved = resolveSymbolicVariables(variables)

  if (!resolved.ok) {
    return variableDiagramError(resolved.errors)
  }

  const nextDiagram: Diagram = {
    ...diagram,
    variables: resolved.variables,
  }

  if (resolved.variables.length === 0) {
    delete nextDiagram.variables
  }

  return {
    ok: true,
    diagram: nextDiagram,
    variables: resolved.variables,
  }
}

export function addSymbolicVariableToDiagram(
  diagram: Diagram,
  input: SymbolicVariableInput,
): SymbolicVariableDiagramResult {
  return setDiagramSymbolicVariables(diagram, [
    ...(diagram.variables ?? []),
    symbolicVariableFromInput(input),
  ])
}

export function updateSymbolicVariableInDiagram(
  diagram: Diagram,
  id: string,
  input: SymbolicVariableUpdateInput,
): SymbolicVariableDiagramResult {
  let found = false
  const variables = (diagram.variables ?? []).map((variable) => {
    if (variable.id !== id) {
      return variable
    }

    found = true
    const name =
      input.name === undefined ? variable.name : normalizeVariableText(input.name)
    const expression =
      input.expression === undefined
        ? variable.expression
        : normalizeVariableText(input.expression)
    const macroName =
      input.macroName === undefined
        ? input.name === undefined
          ? variable.macroName
          : macroNameFromSymbolicVariableName(name)
        : normalizeVariableText(input.macroName)

    return {
      id: variable.id,
      name,
      macroName,
      expression,
      previewValue: variable.previewValue,
    }
  })

  if (!found) {
    return variableDiagramError([
      {
        path: 'variables',
        message: 'Variable does not exist.',
      },
    ])
  }

  return setDiagramSymbolicVariables(diagram, variables)
}

export function deleteSymbolicVariableFromDiagram(
  diagram: Diagram,
  id: string,
): SymbolicVariableDiagramResult {
  let removed = false
  const variables = (diagram.variables ?? []).filter((variable) => {
    if (variable.id !== id) {
      return true
    }

    removed = true
    return false
  })

  if (!removed) {
    return variableDiagramError([
      {
        path: 'variables',
        message: 'Variable does not exist.',
      },
    ])
  }

  return setDiagramSymbolicVariables(diagram, variables)
}

function symbolicVariableFromInput(
  input: SymbolicVariableInput,
): SymbolicVariable {
  const name = normalizeVariableText(input.name)

  return {
    id: normalizeVariableText(input.id),
    name,
    macroName:
      input.macroName === undefined
        ? macroNameFromSymbolicVariableName(name)
        : normalizeVariableText(input.macroName),
    expression: normalizeVariableText(input.expression),
    previewValue: 0,
  }
}

function readVariableCandidates(
  value: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): VariableCandidate[] {
  if (!Array.isArray(value)) {
    pushError(errors, path, 'Variables must be an array.')
    return []
  }

  const seenIds = new Map<string, string>()
  const seenNames = new Map<string, string>()
  const seenMacroNames = new Map<string, string>()
  const candidates: VariableCandidate[] = []

  value.forEach((rawVariable, index) => {
    const variablePath = `${path}[${index}]`

    if (!isRecord(rawVariable)) {
      pushError(errors, variablePath, 'Variable must be an object.')
      return
    }

    const candidate = readVariableCandidate(rawVariable, variablePath, errors)

    if (candidate === null) {
      return
    }

    addUnique(candidate.id, `${variablePath}.id`, seenIds, 'Variable id', errors)
    addUnique(
      candidate.name,
      `${variablePath}.name`,
      seenNames,
      'Variable name',
      errors,
    )
    addUnique(
      candidate.macroName,
      `${variablePath}.macroName`,
      seenMacroNames,
      'Variable macro name',
      errors,
    )
    candidates.push(candidate)
  })

  return candidates
}

function readVariableCandidate(
  rawVariable: Record<string, unknown>,
  path: string,
  errors: DiagramValidationIssue[],
): VariableCandidate | null {
  if (typeof rawVariable.id !== 'string') {
    pushError(errors, `${path}.id`, 'Variable id must be a string.')
  } else if (rawVariable.id.trim().length === 0) {
    pushError(errors, `${path}.id`, 'Variable id must be non-empty.')
  }

  if (typeof rawVariable.name !== 'string') {
    pushError(errors, `${path}.name`, 'Variable name must be a string.')
  } else if (!isSymbolicVariableName(rawVariable.name)) {
    pushError(
      errors,
      `${path}.name`,
      'Variable names must contain letters only and must not be reserved.',
    )
  }

  if (typeof rawVariable.macroName !== 'string') {
    pushError(errors, `${path}.macroName`, 'Variable macro name must be a string.')
  } else if (!isSymbolicVariableMacroName(rawVariable.macroName)) {
    pushError(
      errors,
      `${path}.macroName`,
      'Variable macro names must contain letters only, without a leading backslash, and must not be reserved.',
    )
  }

  if (typeof rawVariable.expression !== 'string') {
    pushError(errors, `${path}.expression`, 'Variable expression must be a string.')
  }

  if (typeof rawVariable.previewValue !== 'number') {
    pushError(errors, `${path}.previewValue`, 'Preview value must be a number.')
  } else if (!Number.isFinite(rawVariable.previewValue)) {
    pushError(errors, `${path}.previewValue`, 'Preview value must be finite.')
  }

  if (
    typeof rawVariable.id !== 'string' ||
    typeof rawVariable.name !== 'string' ||
    typeof rawVariable.macroName !== 'string' ||
    typeof rawVariable.expression !== 'string' ||
    typeof rawVariable.previewValue !== 'number'
  ) {
    return null
  }

  return {
    id: rawVariable.id,
    name: rawVariable.name,
    macroName: rawVariable.macroName,
    expression: rawVariable.expression,
    previewValue: rawVariable.previewValue,
    path,
  }
}

function dependencyOrder(
  variables: readonly VariableCandidate[],
  parsedExpressions: ReadonlyMap<string, ParsedScalarExpression>,
  errors: DiagramValidationIssue[],
): string[] {
  const variablesByName = new Map(
    variables.map((variable) => [variable.name, variable]),
  )
  const state = new Map<string, VariableVisitState>()
  const orderedNames: string[] = []

  function visit(name: string, stack: string[]): void {
    const currentState = state.get(name)

    if (currentState === 'visited') {
      return
    }

    if (currentState === 'visiting') {
      const cycleStart = stack.indexOf(name)
      const cycle =
        cycleStart === -1 ? [...stack, name] : [...stack.slice(cycleStart), name]
      const variable = variablesByName.get(name)

      pushError(
        errors,
        variable === undefined ? 'variables' : `${variable.path}.expression`,
        `Variable dependency cycle detected: ${cycle.join(' -> ')}.`,
      )
      return
    }

    state.set(name, 'visiting')

    const parsed = parsedExpressions.get(name)
    const dependencies =
      parsed === undefined ? [] : scalarExpressionVariables(parsed)

    dependencies.forEach((dependency) => visit(dependency, [...stack, name]))

    state.set(name, 'visited')
    orderedNames.push(name)
  }

  variables.forEach((variable) => visit(variable.name, []))

  return orderedNames
}

function evaluateVariables(
  variables: readonly VariableCandidate[],
  orderedNames: readonly string[],
  parsedExpressions: ReadonlyMap<string, ParsedScalarExpression>,
  errors: DiagramValidationIssue[],
): Map<string, number> {
  const values = new Map<string, number>()
  const variablesByName = new Map(
    variables.map((variable) => [variable.name, variable]),
  )

  orderedNames.forEach((name) => {
    const variable = variablesByName.get(name)
    const parsed = parsedExpressions.get(name)

    if (variable === undefined || parsed === undefined) {
      return
    }

    const evaluated = evaluateScalarExpression(parsed, values)

    if (!evaluated.ok) {
      pushError(errors, `${variable.path}.expression`, evaluated.error)
      return
    }

    values.set(variable.name, evaluated.value)
  })

  return values
}

function checkPreviewValues(
  variables: readonly VariableCandidate[],
  values: ReadonlyMap<string, number>,
  errors: DiagramValidationIssue[],
): void {
  variables.forEach((variable) => {
    const value = values.get(variable.name)

    if (value === undefined) {
      return
    }

    if (!numbersApproximatelyEqual(variable.previewValue, value)) {
      pushError(
        errors,
        `${variable.path}.previewValue`,
        'Preview value must match the evaluated expression.',
      )
    }
  })
}

function addUnique(
  value: string,
  path: string,
  seen: Map<string, string>,
  label: string,
  errors: DiagramValidationIssue[],
): void {
  if (value.trim().length === 0) {
    return
  }

  const previousPath = seen.get(value)

  if (previousPath === undefined) {
    seen.set(value, path)
    return
  }

  pushError(errors, path, `${label} must be unique; already used at ${previousPath}.`)
}

function variableDiagramError(
  errors: DiagramValidationIssue[],
): SymbolicVariableDiagramResult {
  const firstError = errors[0]

  return {
    ok: false,
    error:
      firstError === undefined
        ? 'Variable update failed.'
        : `${firstError.path}: ${firstError.message}`,
    errors,
  }
}

function normalizeVariableText(value: string): string {
  return value.trim()
}

function alphabeticName(index: number): string {
  const base = generatedNameAlphabet.length
  let value = index
  let name = ''

  do {
    name = `${generatedNameAlphabet[value % base]}${name}`
    value = Math.floor(value / base) - 1
  } while (value >= 0)

  return name
}

function numbersApproximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= previewValueEpsilon
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pushError(
  errors: DiagramValidationIssue[],
  path: string,
  message: string,
): void {
  errors.push({ path, message })
}
