import type {
  Camera,
  Camera3D,
  Camera3DProjectionBasis,
  Diagram,
  DiagramValidationResult,
} from './types.ts'
import { createInitialCamera3D } from './camera.ts'
import { validateDiagram } from './validation.ts'

export const savedDiagramFormat = 'stratified-tikz-diagram'
export const savedDiagramVersion = 1

export type SavedDiagramFile = {
  format: typeof savedDiagramFormat
  version: typeof savedDiagramVersion
  diagram: Diagram
}

export type ParseSavedDiagramResult =
  | {
      ok: true
      diagram: Diagram
    }
  | {
      ok: false
      error: string
    }

export function serializeDiagram(diagram: Diagram): string {
  const savedFile: SavedDiagramFile = {
    format: savedDiagramFormat,
    version: savedDiagramVersion,
    diagram: toPersistentDiagram(diagram),
  }

  return `${JSON.stringify(savedFile, null, 2)}\n`
}

export function parseSavedDiagramJson(text: string): ParseSavedDiagramResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return {
      ok: false,
      error: 'File is not valid JSON.',
    }
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: 'Saved file must be a JSON object.',
    }
  }

  if (parsed.format !== savedDiagramFormat) {
    return {
      ok: false,
      error: 'Saved file format is not supported.',
    }
  }

  if (parsed.version !== savedDiagramVersion) {
    return {
      ok: false,
      error: 'Saved file version is not supported.',
    }
  }

  if (!isDiagramLike(parsed.diagram)) {
    return {
      ok: false,
      error: 'Saved file does not contain a diagram.',
    }
  }

  const diagram = toPersistentDiagram(parsed.diagram as Diagram)
  let validation: DiagramValidationResult

  try {
    validation = validateDiagram(diagram)
  } catch {
    return {
      ok: false,
      error: 'Saved diagram is malformed.',
    }
  }

  if (!validation.valid) {
    const firstIssue = validation.errors[0]

    return {
      ok: false,
      error:
        firstIssue === undefined
          ? 'Saved diagram is invalid.'
          : `Saved diagram is invalid: ${firstIssue.path} ${firstIssue.message}`,
    }
  }

  return {
    ok: true,
    diagram,
  }
}

function isDiagramLike(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.version === 1 &&
    (value.ambientDimension === 2 || value.ambientDimension === 3) &&
    isRecord(value.camera) &&
    Array.isArray(value.strata) &&
    value.strata.every(isRecord) &&
    Array.isArray(value.labels) &&
    value.labels.every(isRecord)
  )
}

function toPersistentDiagram(diagram: Diagram): Diagram {
  return {
    version: diagram.version,
    ambientDimension: diagram.ambientDimension,
    camera: normalizePersistentCamera(diagram),
    strata: diagram.strata,
    labels: diagram.labels,
  }
}

function normalizePersistentCamera(diagram: Diagram): Camera {
  if (diagram.ambientDimension !== 3) {
    return diagram.camera
  }

  const camera = diagram.camera as unknown

  if (isCamera3D(camera)) {
    return camera
  }

  const legacyCamera = cameraFromLegacyProjection(camera)

  if (legacyCamera !== null) {
    return legacyCamera
  }

  return diagram.camera
}

function isCamera3D(value: unknown): value is Camera3D {
  return (
    isRecord(value) &&
    value.mode === '3d' &&
    value.kind === 'orthographic' &&
    typeof value.thetaDeg === 'number' &&
    typeof value.phiDeg === 'number' &&
    typeof value.zoom === 'number' &&
    isRecord(value.pan)
  )
}

function cameraFromLegacyProjection(value: unknown): Camera3D | null {
  const legacyScale = isRecord(value) ? value.scale : undefined
  const legacyOrigin = isRecord(value) ? value.origin : undefined

  if (
    !isRecord(value) ||
    value.mode !== '3d' ||
    value.projection !== 'orthographic' ||
    !isBasisVector(value.xVector) ||
    !isBasisVector(value.yVector) ||
    !isBasisVector(value.zVector) ||
    typeof legacyScale !== 'number' ||
    !Number.isFinite(legacyScale) ||
    !isFiniteVec2Record(legacyOrigin)
  ) {
    return null
  }

  const projectionBasis: Camera3DProjectionBasis = {
    xVector: [value.xVector[0], value.xVector[1]],
    yVector: [value.yVector[0], value.yVector[1]],
    zVector: [value.zVector[0], value.zVector[1]],
  }
  const initialCamera = createInitialCamera3D()

  return {
    ...initialCamera,
    zoom: legacyScale,
    pan: { x: legacyOrigin.x, y: legacyOrigin.y },
    projectionBasis,
  }
}

function isBasisVector(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

function isFiniteVec2Record(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
