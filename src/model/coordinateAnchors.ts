import type { ScalarInputValue } from './scalarExpressions.ts'
import type {
  AmbientDimension,
  CoordinateAnchor,
  CoordinateAnchorPosition,
  CoordinateComponent,
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
  switch (position.kind) {
    case 'global':
      return normalizeAnchorPreviewPoint(
        {
          x: coordinateComponentPreviewValue(position.value.x),
          y: coordinateComponentPreviewValue(position.value.y),
          z: coordinateComponentPreviewValue(position.value.z),
        },
        ambientDimension,
      )
    case 'workPlaneLocal':
      return normalizeAnchorPreviewPoint(position.preview, ambientDimension)
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
      : { source: cloneWorkPlaneLocalCoordinateSource(value.source) }),
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
