import {
  cross,
  dot,
  isFiniteVec3,
  norm,
  subtractVec3,
} from '../geometry/workPlane.ts'
import {
  detectScalarExpressionVariables,
  evaluateScalarExpression,
  parseScalarExpression,
} from './scalarExpressions.ts'
import type { ScalarInputValue } from './scalarExpressions.ts'
import type {
  CoordinateComponent,
  DiagramValidationIssue,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from './types.ts'
import { cloneCoordinateSource } from './coordinateReferences.ts'

export type WorkPlaneLocalCoordinateExpressionContext = {
  variableNames: readonly string[]
  previewValues: ReadonlyMap<string, number>
}

export type EvaluateWorkPlaneLocalCoordinateResult =
  | {
      ok: true
      point: Vec3
    }
  | {
      ok: false
      errors: DiagramValidationIssue[]
    }

export type RefreshWorkPlaneLocalCoordinateSourceResult =
  | {
      ok: true
      source: WorkPlaneLocalCoordinateSource
    }
  | {
      ok: false
      errors: DiagramValidationIssue[]
    }

export type DetectWorkPlaneLocalCoordinateVariablesResult =
  | {
      ok: true
      variables: string[]
    }
  | {
      ok: false
      errors: DiagramValidationIssue[]
    }

const frameEpsilon = 1e-9

export function evaluateWorkPlaneLocalCoordinate(
  source: unknown,
  context?: WorkPlaneLocalCoordinateExpressionContext,
  path = 'source',
): EvaluateWorkPlaneLocalCoordinateResult {
  const errors: DiagramValidationIssue[] = []
  const point = evaluateWorkPlaneLocalCoordinateInternal(
    source,
    context,
    path,
    errors,
    new WeakSet<object>(),
  )

  if (point === null || errors.length > 0) {
    return {
      ok: false,
      errors,
    }
  }

  return {
    ok: true,
    point,
  }
}

export function validateWorkPlaneLocalCoordinateSource(
  source: unknown,
  path: string,
  context?: WorkPlaneLocalCoordinateExpressionContext,
): DiagramValidationIssue[] {
  const evaluated = evaluateWorkPlaneLocalCoordinate(source, context, path)

  return evaluated.ok ? [] : evaluated.errors
}

export function validateWorkPlaneLocalCoordinateSourceForPoint(
  source: unknown,
  point: Vec3,
  path: string,
  context?: WorkPlaneLocalCoordinateExpressionContext,
): DiagramValidationIssue[] {
  const evaluated = evaluateWorkPlaneLocalCoordinate(source, context, path)

  if (!evaluated.ok) {
    return evaluated.errors
  }

  if (!pointsApproximatelyEqual(point, evaluated.point)) {
    return [
      {
        path,
        message:
          'Work-plane-local coordinate preview must match the stored global preview point.',
      },
    ]
  }

  return []
}

export function refreshWorkPlaneLocalCoordinateSource(
  source: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext,
  path = 'source',
): RefreshWorkPlaneLocalCoordinateSourceResult {
  const errors: DiagramValidationIssue[] = []

  if (!isRecord(source)) {
    return {
      ok: false,
      errors: [
        {
          path,
          message: 'Coordinate source must be an object.',
        },
      ],
    }
  }

  if (source.kind !== 'workPlaneLocal') {
    return {
      ok: false,
      errors: [
        {
          path: `${path}.kind`,
          message: 'Coordinate source kind must be workPlaneLocal.',
        },
      ],
    }
  }

  if (!isRecord(source.local)) {
    return {
      ok: false,
      errors: [
        {
          path: `${path}.local`,
          message: 'Work-plane-local coordinate source local field must be an object.',
        },
      ],
    }
  }

  const frame = refreshWorkPlaneFrameSnapshotPreviews(
    source.frame,
    context,
    `${path}.frame`,
    errors,
  )
  const a = refreshScalarInputValuePreview(
    source.local.a,
    context,
    `${path}.local.a`,
    errors,
  )
  const b = refreshScalarInputValuePreview(
    source.local.b,
    context,
    `${path}.local.b`,
    errors,
  )

  if (frame === null || a === null || b === null || errors.length > 0) {
    return {
      ok: false,
      errors,
    }
  }

  return {
    ok: true,
    source: {
      kind: 'workPlaneLocal',
      frame,
      local: { a, b },
    },
  }
}

export function detectWorkPlaneLocalCoordinateVariables(
  source: unknown,
  path = 'source',
): DetectWorkPlaneLocalCoordinateVariablesResult {
  const errors: DiagramValidationIssue[] = []
  const variables = new Set<string>()

  collectCoordinateSourceVariables(source, path, variables, errors)

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    }
  }

  return {
    ok: true,
    variables: [...variables].sort(),
  }
}

export function cloneWorkPlaneLocalCoordinateSource(
  source: WorkPlaneLocalCoordinateSource,
): WorkPlaneLocalCoordinateSource {
  return {
    kind: 'workPlaneLocal',
    frame: cloneWorkPlaneFrameSnapshot(source.frame),
    local: {
      a: cloneScalarInputValue(source.local.a),
      b: cloneScalarInputValue(source.local.b),
    },
  }
}

function evaluateWorkPlaneLocalCoordinateInternal(
  source: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext | undefined,
  path: string,
  errors: DiagramValidationIssue[],
  seen: WeakSet<object>,
): Vec3 | null {
  if (!isRecord(source)) {
    pushError(errors, path, 'Coordinate source must be an object.')
    return null
  }

  if (source.kind !== 'workPlaneLocal') {
    pushError(errors, `${path}.kind`, 'Coordinate source kind must be workPlaneLocal.')
    return null
  }

  const frame = evaluateWorkPlaneFrameSnapshot(
    source.frame,
    context,
    `${path}.frame`,
    errors,
    seen,
  )
  const local = evaluateWorkPlaneLocalScalarPair(
    source.local,
    context,
    `${path}.local`,
    errors,
  )

  if (frame === null || local === null) {
    return null
  }

  if (!isValidPreviewFrame(frame)) {
    pushError(
      errors,
      `${path}.frame`,
      'Work-plane frame is invalid after evaluating symbolic variables; it must be an orthonormal right-handed frame.',
    )
    return null
  }

  const point = {
    x: frame.origin.x + local.a * frame.u.x + local.b * frame.v.x,
    y: frame.origin.y + local.a * frame.u.y + local.b * frame.v.y,
    z: frame.origin.z + local.a * frame.u.z + local.b * frame.v.z,
  }

  if (!isFiniteVec3(point)) {
    pushError(errors, path, 'Work-plane-local coordinate preview must be finite.')
    return null
  }

  return point
}

function evaluateWorkPlaneFrameSnapshot(
  frame: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext | undefined,
  path: string,
  errors: DiagramValidationIssue[],
  seen: WeakSet<object>,
): WorkPlaneFrameSnapshot | null {
  if (!isRecord(frame)) {
    pushError(errors, path, 'Work-plane frame must be an object.')
    return null
  }

  const origin = evaluateCoordinatePreview(
    frame.origin,
    context,
    `${path}.origin`,
    errors,
    seen,
  )
  const u = evaluateCoordinatePreview(frame.u, context, `${path}.u`, errors, seen)
  const v = evaluateCoordinatePreview(frame.v, context, `${path}.v`, errors, seen)
  const normal = evaluateCoordinatePreview(
    frame.normal,
    context,
    `${path}.normal`,
    errors,
    seen,
  )

  if (origin === null || u === null || v === null || normal === null) {
    return null
  }

  return { origin, u, v, normal }
}

function evaluateCoordinatePreview(
  point: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext | undefined,
  path: string,
  errors: DiagramValidationIssue[],
  seen: WeakSet<object>,
): Vec3 | null {
  if (!isRecord(point)) {
    pushError(errors, path, 'Coordinate must be an object.')
    return null
  }

  if (seen.has(point)) {
    pushError(errors, path, 'Coordinate source references must not be cyclic.')
    return null
  }
  seen.add(point)

  const numericPreview = finiteVec3FromRecord(point, path, errors)
  const symbolic = point.symbolic

  if (symbolic === undefined) {
    seen.delete(point)
    return numericPreview
  }

  if (!isRecord(symbolic)) {
    pushError(errors, `${path}.symbolic`, 'Symbolic coordinate metadata must be an object.')
    seen.delete(point)
    return null
  }

  const componentPreview = evaluateCoordinateComponentVec3(
    symbolic,
    context,
    `${path}.symbolic`,
    errors,
  )

  if (componentPreview === null) {
    seen.delete(point)
    return null
  }

  if (numericPreview !== null && !pointsApproximatelyEqual(numericPreview, componentPreview)) {
    pushError(errors, path, 'Coordinate preview value must match symbolic metadata.')
  }

  if (symbolic.source === undefined) {
    seen.delete(point)
    return componentPreview
  }

  const sourcePreview = evaluateWorkPlaneLocalCoordinateInternal(
    symbolic.source,
    context,
    `${path}.symbolic.source`,
    errors,
    seen,
  )

  seen.delete(point)

  if (sourcePreview === null) {
    return null
  }

  if (!pointsApproximatelyEqual(componentPreview, sourcePreview)) {
    pushError(
      errors,
      `${path}.symbolic.source`,
      'Work-plane-local coordinate preview must match symbolic coordinate components.',
    )
  }

  return sourcePreview
}

function evaluateCoordinateComponentVec3(
  symbolic: Record<string, unknown>,
  context: WorkPlaneLocalCoordinateExpressionContext | undefined,
  path: string,
  errors: DiagramValidationIssue[],
): Vec3 | null {
  const x = evaluateCoordinateComponentPreview(
    symbolic.x,
    context,
    `${path}.x`,
    errors,
  )
  const y = evaluateCoordinateComponentPreview(
    symbolic.y,
    context,
    `${path}.y`,
    errors,
  )
  const z = evaluateCoordinateComponentPreview(
    symbolic.z,
    context,
    `${path}.z`,
    errors,
  )

  if (x === null || y === null || z === null) {
    return null
  }

  return { x, y, z }
}

function evaluateCoordinateComponentPreview(
  component: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext | undefined,
  path: string,
  errors: DiagramValidationIssue[],
): number | null {
  if (!isRecord(component)) {
    pushError(errors, path, 'Coordinate component must be an object.')
    return null
  }

  if (component.kind === 'numeric') {
    if (typeof component.value !== 'number' || !Number.isFinite(component.value)) {
      pushError(errors, `${path}.value`, 'Numeric coordinate value must be finite.')
      return null
    }

    return component.value
  }

  if (component.kind !== 'symbolic') {
    pushError(errors, `${path}.kind`, 'Coordinate component kind must be numeric or symbolic.')
    return null
  }

  return evaluateSymbolicScalarPreview(
    component,
    context,
    path,
    errors,
    'Symbolic coordinate',
  )
}

function evaluateWorkPlaneLocalScalarPair(
  local: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext | undefined,
  path: string,
  errors: DiagramValidationIssue[],
): { a: number; b: number } | null {
  if (!isRecord(local)) {
    pushError(errors, path, 'Work-plane-local coordinate source local field must be an object.')
    return null
  }

  const a = evaluateScalarInputValuePreview(
    local.a,
    context,
    `${path}.a`,
    errors,
    'Work-plane-local scalar',
  )
  const b = evaluateScalarInputValuePreview(
    local.b,
    context,
    `${path}.b`,
    errors,
    'Work-plane-local scalar',
  )

  if (a === null || b === null) {
    return null
  }

  return { a, b }
}

function evaluateScalarInputValuePreview(
  value: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext | undefined,
  path: string,
  errors: DiagramValidationIssue[],
  label: string,
): number | null {
  if (!isRecord(value)) {
    pushError(errors, path, `${label} must be a scalar input object.`)
    return null
  }

  if (value.kind === 'numeric') {
    if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
      pushError(errors, `${path}.value`, `${label} value must be finite.`)
      return null
    }

    return value.value
  }

  if (value.kind !== 'symbolic') {
    pushError(errors, `${path}.kind`, `${label} kind must be numeric or symbolic.`)
    return null
  }

  return evaluateSymbolicScalarPreview(value, context, path, errors, label)
}

function evaluateSymbolicScalarPreview(
  value: Record<string, unknown>,
  context: WorkPlaneLocalCoordinateExpressionContext | undefined,
  path: string,
  errors: DiagramValidationIssue[],
  label: string,
): number | null {
  if (typeof value.expression !== 'string') {
    pushError(errors, `${path}.expression`, `${label} expression must be a string.`)
    return null
  }

  if (typeof value.previewValue !== 'number' || !Number.isFinite(value.previewValue)) {
    pushError(errors, `${path}.previewValue`, `${label} preview value must be finite.`)
    return null
  }

  if (context === undefined) {
    const detected = detectScalarExpressionVariables(value.expression)

    if (!detected.ok) {
      pushError(errors, `${path}.expression`, detected.error)
      return null
    }

    return value.previewValue
  }

  const parsed = parseScalarExpression(value.expression, {
    variables: context.variableNames,
  })

  if (!parsed.ok) {
    pushError(errors, `${path}.expression`, parsed.error)
    return null
  }

  const evaluated = evaluateScalarExpression(parsed.expression, context.previewValues)

  if (!evaluated.ok) {
    pushError(errors, `${path}.expression`, evaluated.error)
    return null
  }

  if (!numbersApproximatelyEqual(value.previewValue, evaluated.value)) {
    pushError(
      errors,
      `${path}.previewValue`,
      `${label} preview value must match the evaluated expression.`,
    )
    return null
  }

  return evaluated.value
}

function refreshWorkPlaneFrameSnapshotPreviews(
  frame: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): WorkPlaneFrameSnapshot | null {
  if (!isRecord(frame)) {
    pushError(errors, path, 'Work-plane frame must be an object.')
    return null
  }

  const origin = refreshCoordinatePreview(
    frame.origin,
    context,
    `${path}.origin`,
    errors,
  )
  const u = refreshCoordinatePreview(frame.u, context, `${path}.u`, errors)
  const v = refreshCoordinatePreview(frame.v, context, `${path}.v`, errors)
  const normal = refreshCoordinatePreview(
    frame.normal,
    context,
    `${path}.normal`,
    errors,
  )

  if (origin === null || u === null || v === null || normal === null) {
    return null
  }

  return { origin, u, v, normal }
}

function refreshCoordinatePreview(
  point: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): Vec3 | null {
  if (!isRecord(point)) {
    pushError(errors, path, 'Coordinate must be an object.')
    return null
  }

  const symbolic = point.symbolic

  if (symbolic === undefined) {
    return finiteVec3FromRecord(point, path, errors)
  }

  if (!isRecord(symbolic)) {
    pushError(errors, `${path}.symbolic`, 'Symbolic coordinate metadata must be an object.')
    return null
  }

  if (symbolic.source !== undefined) {
    const refreshedSource = refreshWorkPlaneLocalCoordinateSource(
      symbolic.source,
      context,
      `${path}.symbolic.source`,
    )

    if (!refreshedSource.ok) {
      errors.push(...refreshedSource.errors)
      return null
    }

    const preview = evaluateWorkPlaneLocalCoordinate(
      refreshedSource.source,
      context,
      `${path}.symbolic.source`,
    )

    if (!preview.ok) {
      errors.push(...preview.errors)
      return null
    }

    return {
      ...preview.point,
      symbolic: {
        x: { kind: 'numeric', value: preview.point.x },
        y: { kind: 'numeric', value: preview.point.y },
        z: { kind: 'numeric', value: preview.point.z },
        source: refreshedSource.source,
      },
    }
  }

  const x = refreshCoordinateComponentPreview(
    symbolic.x,
    context,
    `${path}.symbolic.x`,
    errors,
  )
  const y = refreshCoordinateComponentPreview(
    symbolic.y,
    context,
    `${path}.symbolic.y`,
    errors,
  )
  const z = refreshCoordinateComponentPreview(
    symbolic.z,
    context,
    `${path}.symbolic.z`,
    errors,
  )

  if (x === null || y === null || z === null) {
    return null
  }

  return {
    x: componentPreviewValue(x),
    y: componentPreviewValue(y),
    z: componentPreviewValue(z),
    symbolic: { x, y, z },
  }
}

function refreshCoordinateComponentPreview(
  component: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): CoordinateComponent | null {
  if (!isRecord(component)) {
    pushError(errors, path, 'Coordinate component must be an object.')
    return null
  }

  if (component.kind === 'numeric') {
    if (typeof component.value !== 'number' || !Number.isFinite(component.value)) {
      pushError(errors, `${path}.value`, 'Numeric coordinate value must be finite.')
      return null
    }

    return { kind: 'numeric', value: component.value }
  }

  if (component.kind !== 'symbolic') {
    pushError(errors, `${path}.kind`, 'Coordinate component kind must be numeric or symbolic.')
    return null
  }

  if (typeof component.expression !== 'string') {
    pushError(errors, `${path}.expression`, 'Symbolic coordinate expression must be a string.')
    return null
  }

  const parsed = parseScalarExpression(component.expression, {
    variables: context.variableNames,
  })

  if (!parsed.ok) {
    pushError(errors, `${path}.expression`, parsed.error)
    return null
  }

  const evaluated = evaluateScalarExpression(parsed.expression, context.previewValues)

  if (!evaluated.ok) {
    pushError(errors, `${path}.expression`, evaluated.error)
    return null
  }

  return {
    kind: 'symbolic',
    expression: component.expression,
    previewValue: evaluated.value,
  }
}

function refreshScalarInputValuePreview(
  value: unknown,
  context: WorkPlaneLocalCoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): ScalarInputValue | null {
  if (!isRecord(value)) {
    pushError(errors, path, 'Work-plane-local scalar must be a scalar input object.')
    return null
  }

  if (value.kind === 'numeric') {
    if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
      pushError(errors, `${path}.value`, 'Work-plane-local scalar value must be finite.')
      return null
    }

    return { kind: 'numeric', value: value.value }
  }

  if (value.kind !== 'symbolic') {
    pushError(errors, `${path}.kind`, 'Work-plane-local scalar kind must be numeric or symbolic.')
    return null
  }

  if (typeof value.expression !== 'string') {
    pushError(errors, `${path}.expression`, 'Work-plane-local scalar expression must be a string.')
    return null
  }

  const parsed = parseScalarExpression(value.expression, {
    variables: context.variableNames,
  })

  if (!parsed.ok) {
    pushError(errors, `${path}.expression`, parsed.error)
    return null
  }

  const evaluated = evaluateScalarExpression(parsed.expression, context.previewValues)

  if (!evaluated.ok) {
    pushError(errors, `${path}.expression`, evaluated.error)
    return null
  }

  return {
    kind: 'symbolic',
    expression: value.expression,
    previewValue: evaluated.value,
  }
}

function collectCoordinateSourceVariables(
  source: unknown,
  path: string,
  variables: Set<string>,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(source)) {
    pushError(errors, path, 'Coordinate source must be an object.')
    return
  }

  if (source.kind !== 'workPlaneLocal') {
    pushError(errors, `${path}.kind`, 'Coordinate source kind must be workPlaneLocal.')
    return
  }

  if (!isRecord(source.local)) {
    pushError(errors, `${path}.local`, 'Work-plane-local coordinate source local field must be an object.')
  } else {
    collectScalarInputVariables(source.local.a, `${path}.local.a`, variables, errors)
    collectScalarInputVariables(source.local.b, `${path}.local.b`, variables, errors)
  }

  collectWorkPlaneFrameVariables(source.frame, `${path}.frame`, variables, errors)
}

function collectWorkPlaneFrameVariables(
  frame: unknown,
  path: string,
  variables: Set<string>,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(frame)) {
    pushError(errors, path, 'Work-plane frame must be an object.')
    return
  }

  collectCoordinateVariables(frame.origin, `${path}.origin`, variables, errors)
  collectCoordinateVariables(frame.u, `${path}.u`, variables, errors)
  collectCoordinateVariables(frame.v, `${path}.v`, variables, errors)
  collectCoordinateVariables(frame.normal, `${path}.normal`, variables, errors)
}

function collectCoordinateVariables(
  point: unknown,
  path: string,
  variables: Set<string>,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(point)) {
    pushError(errors, path, 'Coordinate must be an object.')
    return
  }

  const symbolic = point.symbolic

  if (symbolic === undefined) {
    return
  }

  if (!isRecord(symbolic)) {
    pushError(errors, `${path}.symbolic`, 'Symbolic coordinate metadata must be an object.')
    return
  }

  collectCoordinateComponentVariables(
    symbolic.x,
    `${path}.symbolic.x`,
    variables,
    errors,
  )
  collectCoordinateComponentVariables(
    symbolic.y,
    `${path}.symbolic.y`,
    variables,
    errors,
  )
  collectCoordinateComponentVariables(
    symbolic.z,
    `${path}.symbolic.z`,
    variables,
    errors,
  )

  if (symbolic.source !== undefined) {
    collectCoordinateSourceVariables(
      symbolic.source,
      `${path}.symbolic.source`,
      variables,
      errors,
    )
  }
}

function collectCoordinateComponentVariables(
  component: unknown,
  path: string,
  variables: Set<string>,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(component)) {
    pushError(errors, path, 'Coordinate component must be an object.')
    return
  }

  if (component.kind === 'numeric') {
    return
  }

  if (component.kind !== 'symbolic') {
    pushError(errors, `${path}.kind`, 'Coordinate component kind must be numeric or symbolic.')
    return
  }

  collectSymbolicExpressionVariables(
    component.expression,
    `${path}.expression`,
    variables,
    errors,
  )
}

function collectScalarInputVariables(
  value: unknown,
  path: string,
  variables: Set<string>,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(value)) {
    pushError(errors, path, 'Work-plane-local scalar must be a scalar input object.')
    return
  }

  if (value.kind === 'numeric') {
    return
  }

  if (value.kind !== 'symbolic') {
    pushError(errors, `${path}.kind`, 'Work-plane-local scalar kind must be numeric or symbolic.')
    return
  }

  collectSymbolicExpressionVariables(
    value.expression,
    `${path}.expression`,
    variables,
    errors,
  )
}

function collectSymbolicExpressionVariables(
  expression: unknown,
  path: string,
  variables: Set<string>,
  errors: DiagramValidationIssue[],
): void {
  if (typeof expression !== 'string') {
    pushError(errors, path, 'Symbolic expression must be a string.')
    return
  }

  const detected = detectScalarExpressionVariables(expression)

  if (!detected.ok) {
    pushError(errors, path, detected.error)
    return
  }

  detected.variables.forEach((variable) => variables.add(variable))
}

function finiteVec3FromRecord(
  value: Record<string, unknown>,
  path: string,
  errors: DiagramValidationIssue[],
): Vec3 | null {
  const x = finiteNumberFromRecord(value, 'x', path, errors)
  const y = finiteNumberFromRecord(value, 'y', path, errors)
  const z = finiteNumberFromRecord(value, 'z', path, errors)

  if (x === null || y === null || z === null) {
    return null
  }

  return { x, y, z }
}

function finiteNumberFromRecord(
  value: Record<string, unknown>,
  key: 'x' | 'y' | 'z',
  path: string,
  errors: DiagramValidationIssue[],
): number | null {
  const raw = value[key]

  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    pushError(errors, `${path}.${key}`, `Coordinate ${key} value must be finite.`)
    return null
  }

  return raw
}

function isValidPreviewFrame(frame: WorkPlaneFrameSnapshot): boolean {
  const uNorm = norm(frame.u)
  const vNorm = norm(frame.v)
  const normalNorm = norm(frame.normal)

  if (
    !Number.isFinite(uNorm) ||
    !Number.isFinite(vNorm) ||
    !Number.isFinite(normalNorm) ||
    uNorm <= frameEpsilon ||
    vNorm <= frameEpsilon ||
    normalNorm <= frameEpsilon
  ) {
    return false
  }

  const handednessError = norm(subtractVec3(cross(frame.u, frame.v), frame.normal))

  return (
    Math.abs(uNorm - 1) <= frameEpsilon &&
    Math.abs(vNorm - 1) <= frameEpsilon &&
    Math.abs(normalNorm - 1) <= frameEpsilon &&
    Math.abs(dot(frame.u, frame.v)) <= frameEpsilon &&
    Math.abs(dot(frame.u, frame.normal)) <= frameEpsilon &&
    Math.abs(dot(frame.v, frame.normal)) <= frameEpsilon &&
    Number.isFinite(handednessError) &&
    handednessError <= frameEpsilon
  )
}

function cloneWorkPlaneFrameSnapshot(
  frame: WorkPlaneFrameSnapshot,
): WorkPlaneFrameSnapshot {
  return {
    origin: cloneVec3(frame.origin),
    u: cloneVec3(frame.u),
    v: cloneVec3(frame.v),
    normal: cloneVec3(frame.normal),
  }
}

function cloneVec3(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    ...(point.symbolic === undefined
      ? {}
      : {
          symbolic: {
            x: cloneCoordinateComponent(point.symbolic.x),
            y: cloneCoordinateComponent(point.symbolic.y),
            z: cloneCoordinateComponent(point.symbolic.z),
            ...(point.symbolic.source === undefined
              ? {}
              : {
                  source: cloneCoordinateSource(point.symbolic.source),
                }),
          },
        }),
  }
}

function cloneCoordinateComponent(
  component: CoordinateComponent,
): CoordinateComponent {
  return component.kind === 'numeric'
    ? { kind: 'numeric', value: component.value }
    : {
        kind: 'symbolic',
        expression: component.expression,
        previewValue: component.previewValue,
      }
}

function cloneScalarInputValue(value: ScalarInputValue): ScalarInputValue {
  return value.kind === 'numeric'
    ? { kind: 'numeric', value: value.value }
    : {
        kind: 'symbolic',
        expression: value.expression,
        previewValue: value.previewValue,
      }
}

function componentPreviewValue(component: CoordinateComponent): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}

function pointsApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  return (
    numbersApproximatelyEqual(first.x, second.x) &&
    numbersApproximatelyEqual(first.y, second.y) &&
    numbersApproximatelyEqual(first.z, second.z)
  )
}

function numbersApproximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= frameEpsilon
}

function pushError(
  errors: DiagramValidationIssue[],
  path: string,
  message: string,
): void {
  errors.push({ path, message })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
