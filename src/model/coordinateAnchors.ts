import type { ScalarInputValue } from './scalarExpressions.ts'
import type {
  AmbientDimension,
  CoordinateAnchor,
  CoordinateAnchorPosition,
  CoordinateComponent,
  CoordinateSource,
  Diagram,
  SymbolicVec3,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from './types.ts'

export type CreateCoordinateAnchorInput = {
  id: string
  name: string
  position: CoordinateAnchorPosition
  tikzName?: string
  locked?: boolean
}

const defaultCoordinateAnchorName = 'Coordinate'
const defaultCoordinateAnchorTikzName = 'coord'

export function createCoordinateAnchor(
  diagram: Diagram,
  input: CreateCoordinateAnchorInput,
): CoordinateAnchor {
  const name = normalizeCoordinateAnchorName(input.name)
  const existingTikzNames = (diagram.coordinateAnchors ?? []).map(
    (anchor) => anchor.tikzName,
  )
  const tikzName = uniqueCoordinateAnchorTikzName(
    sanitizeCoordinateAnchorTikzName(input.tikzName ?? name),
    existingTikzNames,
  )

  return {
    id: input.id,
    name,
    tikzName,
    position: cloneCoordinateAnchorPosition(input.position),
    ...(input.locked === undefined ? {} : { locked: input.locked }),
  }
}

export function normalizeCoordinateAnchorName(rawName: string): string {
  const trimmed = rawName.trim()

  return trimmed.length === 0 ? defaultCoordinateAnchorName : trimmed
}

export function sanitizeCoordinateAnchorTikzName(rawName: string): string {
  const sanitized = toIdentifier(rawName)
  const fallback = defaultCoordinateAnchorTikzName
  const safeName = sanitized.length === 0 ? fallback : sanitized

  return /^[A-Za-z]/.test(safeName) ? safeName : `${fallback}${safeName}`
}

export function isCoordinateAnchorTikzName(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(value)
}

export function uniqueCoordinateAnchorTikzName(
  preferredName: string,
  existingNames: readonly string[],
): string {
  const usedNames = new Set(existingNames)

  if (!usedNames.has(preferredName)) {
    return preferredName
  }

  let suffix = 2
  while (usedNames.has(`${preferredName}${suffix}`)) {
    suffix += 1
  }

  return `${preferredName}${suffix}`
}

export function cloneCoordinateAnchor(anchor: CoordinateAnchor): CoordinateAnchor {
  return {
    id: anchor.id,
    name: anchor.name,
    tikzName: anchor.tikzName,
    position: cloneCoordinateAnchorPosition(anchor.position),
    ...(anchor.locked === undefined ? {} : { locked: anchor.locked }),
  }
}

export function cloneCoordinateAnchorPosition(
  position: CoordinateAnchorPosition,
): CoordinateAnchorPosition {
  switch (position.kind) {
    case 'global':
      return {
        kind: 'global',
        value: cloneSymbolicVec3(position.value),
      }
    case 'workPlaneLocal':
      return {
        kind: 'workPlaneLocal',
        frame: cloneWorkPlaneFrameSnapshot(position.frame),
        local: {
          a: cloneScalarInputValue(position.local.a),
          b: cloneScalarInputValue(position.local.b),
        },
        preview: cloneVec3(position.preview),
      }
  }
}

export function coordinateAnchorPositionPreview(
  position: CoordinateAnchorPosition,
  ambientDimension: AmbientDimension,
): Vec3 {
  assertCoordinateAnchorPositionRecord(position)

  switch (position.kind) {
    case 'global': {
      assertSymbolicVec3(position.value, 'Global coordinate anchor value')

      return normalizeAnchorPreviewPoint(
        {
          x: coordinateComponentPreviewValue(position.value.x),
          y: coordinateComponentPreviewValue(position.value.y),
          z: coordinateComponentPreviewValue(position.value.z),
        },
        ambientDimension,
      )
    }
    case 'workPlaneLocal':
      return normalizeAnchorPreviewPoint(position.preview, ambientDimension)
    default:
      throw new Error('Coordinate anchor position kind must be global or workPlaneLocal.')
  }
}

export function coordinateAnchorPositionToVec3(
  position: CoordinateAnchorPosition,
  ambientDimension: AmbientDimension,
): Vec3 {
  const preview = coordinateAnchorPositionPreview(position, ambientDimension)

  switch (position.kind) {
    case 'global':
      return {
        ...preview,
        symbolic: cloneSymbolicVec3(
          normalizeSymbolicVec3ForAmbientDimension(position.value, ambientDimension),
        ),
      }
    case 'workPlaneLocal':
      return {
        ...preview,
        symbolic: {
          x: { kind: 'numeric', value: preview.x },
          y: { kind: 'numeric', value: preview.y },
          z: { kind: 'numeric', value: preview.z },
          source: workPlaneLocalCoordinateSourceFromAnchorPosition(position),
        },
      }
  }
}

export function workPlaneLocalCoordinateSourceFromAnchorPosition(
  position: Extract<CoordinateAnchorPosition, { kind: 'workPlaneLocal' }>,
): WorkPlaneLocalCoordinateSource {
  return cloneWorkPlaneLocalCoordinateSource(position)
}

export function symbolicVec3FromVec3(point: Vec3): SymbolicVec3 {
  return {
    x: cloneCoordinateComponent(point.symbolic?.x ?? numericComponent(point.x)),
    y: cloneCoordinateComponent(point.symbolic?.y ?? numericComponent(point.y)),
    z: cloneCoordinateComponent(point.symbolic?.z ?? numericComponent(point.z)),
  }
}

function normalizeSymbolicVec3ForAmbientDimension(
  value: SymbolicVec3,
  ambientDimension: AmbientDimension,
): SymbolicVec3 {
  if (ambientDimension === 3) {
    return cloneSymbolicVec3(value)
  }

  return {
    x: cloneCoordinateComponent(value.x),
    y: cloneCoordinateComponent(value.y),
    z: numericComponent(0),
  }
}

function normalizeAnchorPreviewPoint(
  point: Vec3,
  ambientDimension: AmbientDimension,
): Vec3 {
  return ambientDimension === 2
    ? { x: point.x, y: point.y, z: 0 }
    : cloneVec3(point)
}

function cloneSymbolicVec3(value: SymbolicVec3): SymbolicVec3 {
  return {
    x: cloneCoordinateComponent(value.x),
    y: cloneCoordinateComponent(value.y),
    z: cloneCoordinateComponent(value.z),
    ...(value.source === undefined
      ? {}
      : { source: cloneCoordinateSource(value.source) }),
  }
}

function cloneCoordinateSource(source: CoordinateSource): CoordinateSource {
  switch (source.kind) {
    case 'workPlaneLocal':
      return cloneWorkPlaneLocalCoordinateSource(source)
    case 'coordinateRef':
      return {
        kind: 'coordinateRef',
        coordinateId: source.coordinateId,
        preview: cloneVec3(source.preview),
      }
  }
}

function cloneCoordinateComponent(
  component: CoordinateComponent,
): CoordinateComponent {
  return component.kind === 'numeric'
    ? {
        kind: 'numeric',
        value: component.value,
      }
    : {
        kind: 'symbolic',
        expression: component.expression,
        previewValue: component.previewValue,
      }
}

function coordinateComponentPreviewValue(component: CoordinateComponent): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}

function numericComponent(value: number): CoordinateComponent {
  return {
    kind: 'numeric',
    value,
  }
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

function cloneWorkPlaneLocalCoordinateSource(
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

function cloneVec3(point: Vec3): Vec3 {
  return point.symbolic === undefined
    ? { x: point.x, y: point.y, z: point.z }
    : {
        x: point.x,
        y: point.y,
        z: point.z,
        symbolic: cloneSymbolicVec3(point.symbolic),
      }
}

function cloneScalarInputValue(value: ScalarInputValue): ScalarInputValue {
  return value.kind === 'numeric'
    ? {
        kind: 'numeric',
        value: value.value,
      }
    : {
        kind: 'symbolic',
        expression: value.expression,
        previewValue: value.previewValue,
      }
}

function assertCoordinateAnchorPositionRecord(
  position: CoordinateAnchorPosition,
): asserts position is CoordinateAnchorPosition {
  if (!isRecord(position)) {
    throw new Error('Coordinate anchor position must be an object.')
  }
}

function assertSymbolicVec3(value: SymbolicVec3, label: string): void {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`)
  }

  assertCoordinateComponent(value.x, `${label}.x`)
  assertCoordinateComponent(value.y, `${label}.y`)
  assertCoordinateComponent(value.z, `${label}.z`)
}

function assertCoordinateComponent(
  component: CoordinateComponent,
  label: string,
): void {
  if (!isRecord(component)) {
    throw new Error(`${label} must be a coordinate component object.`)
  }

  if (component.kind === 'numeric') {
    if (typeof component.value !== 'number' || !Number.isFinite(component.value)) {
      throw new Error(`${label}.value must be a finite number.`)
    }
    return
  }

  if (component.kind === 'symbolic') {
    if (typeof component.expression !== 'string') {
      throw new Error(`${label}.expression must be a string.`)
    }
    if (
      typeof component.previewValue !== 'number' ||
      !Number.isFinite(component.previewValue)
    ) {
      throw new Error(`${label}.previewValue must be finite.`)
    }
    return
  }

  throw new Error(`${label}.kind must be numeric or symbolic.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toIdentifier(rawName: string): string {
  let result = ''
  let capitalizeNext = false

  for (const character of rawName.trim()) {
    if (/^[A-Za-z0-9]$/.test(character)) {
      result +=
        capitalizeNext && /^[a-z]$/.test(character)
          ? character.toUpperCase()
          : character
      capitalizeNext = false
      continue
    }

    if (result.length > 0) {
      capitalizeNext = true
    }
  }

  return result
}
