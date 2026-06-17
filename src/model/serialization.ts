import { validateCamera3D } from '../geometry/projection.ts'
import {
  cloneCamera3D,
  createInitialCamera3D,
  isOrthographicCamera3D,
} from './camera.ts'
import { createDefaultCamera2D } from './constructors.ts'
import type {
  AmbientDimension,
  Camera,
  Camera2D,
  Camera3D,
  Diagram,
  DiagramLayer,
  DiagramValidationResult,
  DiagramViewOptions,
  OrthographicCamera3D,
  Stratum,
  TextLabel,
} from './types.ts'
import { getLayerMetadata, normalizeLayerMetadataForDiagram } from './layers.ts'
import { validateDiagram } from './validation.ts'

export const savedDiagramFormat = 'stratified-tikz-diagram'
export const savedDiagramVersion = 1

export type PersistentDiagram = {
  version: 1
  ambientDimension: AmbientDimension
  camera?: Camera
  view?: DiagramViewOptions
  layers?: DiagramLayer[]
  strata: Stratum[]
  labels: TextLabel[]
}

export type SavedDiagramFile = {
  format: typeof savedDiagramFormat
  version: typeof savedDiagramVersion
  diagram: PersistentDiagram
}

export type SerializeDiagramOptions = {
  camera3d?: Camera3D
  showCoordinateAxesInTikz?: boolean
}

export type ParseSavedDiagramResult =
  | {
      ok: true
      diagram: Diagram
      warnings: string[]
    }
  | {
      ok: false
      error: string
    }

type SavedDiagramInput = {
  version: 1
  ambientDimension: AmbientDimension
  camera?: unknown
  view?: unknown
  layers?: unknown
  strata: unknown[]
  labels: unknown[]
}

type LoadedDiagramNormalization = {
  diagram: Diagram
  warnings: string[]
  errors: string[]
}

export function serializeDiagram(
  diagram: Diagram,
  options: SerializeDiagramOptions = {},
): string {
  const savedFile: SavedDiagramFile = {
    format: savedDiagramFormat,
    version: savedDiagramVersion,
    diagram: toPersistentDiagram(diagram, options),
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

  const normalization = normalizeLoadedDiagram(parsed.diagram)
  if (normalization.errors.length > 0) {
    return {
      ok: false,
      error: `Saved diagram is invalid: ${normalization.errors[0]}`,
    }
  }

  const diagram = normalization.diagram
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
    warnings: normalization.warnings,
  }
}

function toPersistentDiagram(
  diagram: Diagram,
  options: SerializeDiagramOptions,
): PersistentDiagram {
  const view = normalizePersistentView(diagram, options)
  const layers = normalizePersistentLayers(diagram)

  return {
    version: diagram.version,
    ambientDimension: diagram.ambientDimension,
    ...(view === undefined ? {} : { view }),
    ...(layers === undefined ? {} : { layers }),
    strata: diagram.strata,
    labels: diagram.labels,
  }
}

function normalizePersistentLayers(diagram: Diagram): DiagramLayer[] | undefined {
  const normalization = normalizeLayerMetadataForDiagram(diagram)

  if (normalization.errors.length > 0) {
    throw new Error(normalization.errors[0])
  }

  return normalization.layers.length === 0 && diagram.layers === undefined
    ? undefined
    : normalization.layers
}

function normalizePersistentView(
  diagram: Diagram,
  options: SerializeDiagramOptions,
): DiagramViewOptions | undefined {
  const view: DiagramViewOptions = {}

  if (diagram.ambientDimension === 3) {
    const sourceCamera =
      options.camera3d ??
      diagram.view?.camera3d ??
      (diagram.camera.mode === '3d' ? diagram.camera : undefined)

    view.camera3d = normalizeCamera3DForPersistence(sourceCamera)
  }

  const showCoordinateAxesInTikz =
    options.showCoordinateAxesInTikz ?? diagram.view?.showCoordinateAxesInTikz

  if (showCoordinateAxesInTikz !== undefined) {
    view.showCoordinateAxesInTikz = showCoordinateAxesInTikz
  }

  return Object.keys(view).length === 0 ? undefined : view
}

function normalizeCamera3DForPersistence(
  camera: Camera3D | undefined,
): OrthographicCamera3D {
  if (
    camera === undefined ||
    !isOrthographicCamera3D(camera) ||
    !validateCamera3D(camera).valid
  ) {
    return createInitialCamera3D()
  }

  return cloneCamera3DWithoutProjectionBasis(camera)
}

function normalizeLoadedDiagram(
  savedDiagram: SavedDiagramInput,
): LoadedDiagramNormalization {
  const warnings: string[] = []
  const camera = normalizeLoadedCamera(savedDiagram, warnings)
  const view = normalizeLoadedView(savedDiagram, camera, warnings)
  const diagramWithoutLayers: Diagram = {
    version: savedDiagram.version,
    ambientDimension: savedDiagram.ambientDimension,
    camera,
    ...(view === undefined ? {} : { view }),
    strata: savedDiagram.strata as Stratum[],
    labels: savedDiagram.labels as TextLabel[],
  }
  const layerNormalization = normalizeLoadedLayers(
    diagramWithoutLayers,
    savedDiagram.layers,
  )
  warnings.push(...layerNormalization.warnings)

  const diagram: Diagram = {
    ...diagramWithoutLayers,
    ...(layerNormalization.layers === undefined
      ? {}
      : { layers: layerNormalization.layers }),
  }

  return {
    diagram,
    warnings,
    errors: layerNormalization.errors,
  }
}

function normalizeLoadedLayers(
  diagramWithoutLayers: Diagram,
  savedLayers: unknown,
): {
  layers?: DiagramLayer[]
  warnings: string[]
  errors: string[]
} {
  if (savedLayers === undefined) {
    const layers = getLayerMetadata(diagramWithoutLayers)

    return {
      layers: layers.length === 0 ? undefined : layers,
      warnings: [],
      errors: [],
    }
  }

  if (!Array.isArray(savedLayers)) {
    return {
      warnings: [],
      errors: ['layers must be an array when present.'],
    }
  }

  const errors: string[] = []
  const warnings: string[] = []
  const layerRecords = savedLayers.flatMap((layer, index): DiagramLayer[] => {
    if (!isRecord(layer)) {
      errors.push(`layers[${index}] must be a layer metadata object.`)
      return []
    }

    const record: DiagramLayer = {
      value: layer.value as number,
      name: layer.name as string,
    }

    if ('visible' in layer) {
      if (typeof layer.visible === 'boolean') {
        record.visible = layer.visible
      } else {
        warnings.push(`layers[${index}].visible is invalid; using visible.`)
      }
    }

    if ('locked' in layer) {
      if (typeof layer.locked === 'boolean') {
        record.locked = layer.locked
      } else {
        warnings.push(`layers[${index}].locked is invalid; using unlocked.`)
      }
    }

    return [
      record,
    ]
  })
  const normalization = normalizeLayerMetadataForDiagram({
    ...diagramWithoutLayers,
    layers: layerRecords,
  })

  return {
    layers: normalization.layers,
    warnings: [...warnings, ...normalization.warnings],
    errors: [...errors, ...normalization.errors],
  }
}

function normalizeLoadedCamera(
  savedDiagram: SavedDiagramInput,
  warnings: string[],
): Camera {
  if (savedDiagram.ambientDimension === 2) {
    return normalizeLoadedCamera2D(savedDiagram, warnings)
  }

  return normalizeLoadedCamera3D(savedDiagram, warnings)
}

function normalizeLoadedCamera2D(
  savedDiagram: SavedDiagramInput,
  warnings: string[],
): Camera2D {
  if (savedDiagram.camera === undefined) {
    return createDefaultCamera2D()
  }

  const camera = camera2DFromPersistent(savedDiagram.camera)

  if (camera !== null) {
    return camera
  }

  warnings.push('Saved 2D camera is invalid; using the initial camera.')
  return createDefaultCamera2D()
}

function normalizeLoadedCamera3D(
  savedDiagram: SavedDiagramInput,
  warnings: string[],
): Camera3D {
  const view = savedDiagram.view

  if (isRecord(view) && 'camera3d' in view) {
    const camera = camera3DFromPersistent(view.camera3d)

    if (camera !== null) {
      return camera
    }

    warnings.push(saved3DCameraWarning(view.camera3d, 'metadata'))
    return createInitialCamera3D()
  }

  if (view !== undefined && !isRecord(view)) {
    warnings.push('Saved view metadata is invalid; using default view options.')
  }

  if (savedDiagram.camera === undefined) {
    return createInitialCamera3D()
  }

  const camera =
    camera3DFromPersistent(savedDiagram.camera) ??
    cameraFromLegacyProjection(savedDiagram.camera)

  if (camera !== null) {
    return camera
  }

  warnings.push(saved3DCameraWarning(savedDiagram.camera, ''))
  return createInitialCamera3D()
}

function normalizeLoadedView(
  savedDiagram: SavedDiagramInput,
  camera: Camera,
  warnings: string[],
): DiagramViewOptions | undefined {
  const view: DiagramViewOptions = {}

  if (camera.mode === '3d') {
    view.camera3d = cloneCamera3D(camera)
  }

  const savedView = savedDiagram.view

  if (savedView !== undefined && !isRecord(savedView)) {
    return Object.keys(view).length === 0 ? undefined : view
  }

  if (isRecord(savedView) && 'showCoordinateAxesInTikz' in savedView) {
    if (typeof savedView.showCoordinateAxesInTikz === 'boolean') {
      view.showCoordinateAxesInTikz = savedView.showCoordinateAxesInTikz
    } else {
      warnings.push(
        'Saved coordinate axes TikZ option is invalid; using the default.',
      )
    }
  }

  return Object.keys(view).length === 0 ? undefined : view
}

function camera2DFromPersistent(value: unknown): Camera2D | null {
  if (
    !isRecord(value) ||
    value.mode !== '2d' ||
    !Number.isFinite(value.scale) ||
    typeof value.scale !== 'number' ||
    value.scale <= 0 ||
    !isFiniteVec2Record(value.origin)
  ) {
    return null
  }

  return {
    mode: '2d',
    scale: value.scale,
    origin: {
      x: value.origin.x,
      y: value.origin.y,
    },
  }
}

function camera3DFromPersistent(value: unknown): Camera3D | null {
  if (
    !isRecord(value) ||
    value.mode !== '3d' ||
    value.kind !== 'orthographic' ||
    typeof value.thetaDeg !== 'number' ||
    typeof value.phiDeg !== 'number' ||
    typeof value.zoom !== 'number' ||
    !isFiniteVec2Record(value.pan)
  ) {
    return null
  }

  const camera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: value.thetaDeg,
    phiDeg: value.phiDeg,
    zoom: value.zoom,
    pan: { x: value.pan.x, y: value.pan.y },
  }

  return validateCamera3D(camera).valid ? camera : null
}

function cameraFromLegacyProjection(value: unknown): OrthographicCamera3D | null {
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
    legacyScale <= 0 ||
    !isFiniteVec2Record(legacyOrigin)
  ) {
    return null
  }

  const initialCamera = createInitialCamera3D()
  const camera: Camera3D = {
    ...initialCamera,
    zoom: legacyScale,
    pan: { x: legacyOrigin.x, y: legacyOrigin.y },
  }

  return validateCamera3D(camera).valid ? camera : null
}

function cloneCamera3DWithoutProjectionBasis(
  camera: OrthographicCamera3D,
): OrthographicCamera3D {
  return {
    mode: camera.mode,
    kind: camera.kind,
    thetaDeg: camera.thetaDeg,
    phiDeg: camera.phiDeg,
    zoom: camera.zoom,
    pan: { ...camera.pan },
  }
}

function saved3DCameraWarning(value: unknown, label: 'metadata' | ''): string {
  const subject = label.length === 0 ? 'camera' : `camera ${label}`

  if (isRecord(value) && value.mode === '3d' && value.kind === 'perspective') {
    return `Saved perspective 3D ${subject} is unsupported; using the initial camera.`
  }

  return `Saved 3D ${subject} is invalid; using the initial camera.`
}

function isDiagramLike(value: unknown): value is SavedDiagramInput {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.version === 1 &&
    (value.ambientDimension === 2 || value.ambientDimension === 3) &&
    Array.isArray(value.strata) &&
    value.strata.every(isRecord) &&
    Array.isArray(value.labels) &&
    value.labels.every(isRecord)
  )
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
