import { validateCamera3D } from '../geometry/projection.ts'
import {
  cloneCamera3D,
  createInitialCamera3D,
  isOrthographicCamera3D,
} from './camera.ts'
import { createDefaultCamera2D } from './constructors.ts'
import {
  isStylePresetKind,
  normalizeStylePresetName,
  sanitizeTikzStyleName,
  tikzStyleNameFromPresetName,
  uniqueTikzStyleName,
} from './stylePresets.ts'
import {
  isTikzStyleTarget,
  normalizeExternalTikzStyleLoadHint,
  normalizeExternalTikzStyleSourceName,
  normalizeImportedTikzStyleDisplayName,
  normalizeImportedTikzStyleKey,
} from './importedTikzStyles.ts'
import type {
  AmbientDimension,
  Camera,
  Camera2D,
  Camera3D,
  Diagram,
  DiagramLayer,
  DiagramValidationResult,
  DiagramViewOptions,
  ExternalTikzStyleSource,
  ImportedTikzStyleReference,
  StylePresetKind,
  OrthographicCamera3D,
  RegionStyle,
  SheetStyle,
  CurveStyle,
  PointStyle,
  LabelStyle,
  UserStylePreset,
  Stratum,
  TextLabel,
  TikzStyleTarget,
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
  userStylePresets?: UserStylePreset[]
  externalTikzStyleSources?: ExternalTikzStyleSource[]
  importedTikzStyleReferences?: ImportedTikzStyleReference[]
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
  userStylePresets?: unknown
  externalTikzStyleSources?: unknown
  importedTikzStyleReferences?: unknown
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
  const userStylePresets =
    diagram.userStylePresets === undefined || diagram.userStylePresets.length === 0
      ? undefined
      : diagram.userStylePresets
  const externalTikzStyleSources =
    diagram.externalTikzStyleSources === undefined ||
    diagram.externalTikzStyleSources.length === 0
      ? undefined
      : diagram.externalTikzStyleSources
  const importedTikzStyleReferences =
    diagram.importedTikzStyleReferences === undefined ||
    diagram.importedTikzStyleReferences.length === 0
      ? undefined
      : diagram.importedTikzStyleReferences

  return {
    version: diagram.version,
    ambientDimension: diagram.ambientDimension,
    ...(view === undefined ? {} : { view }),
    ...(layers === undefined ? {} : { layers }),
    ...(userStylePresets === undefined ? {} : { userStylePresets }),
    ...(externalTikzStyleSources === undefined
      ? {}
      : { externalTikzStyleSources }),
    ...(importedTikzStyleReferences === undefined
      ? {}
      : { importedTikzStyleReferences }),
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
  const sourceNormalization = normalizeLoadedExternalTikzStyleSources(
    savedDiagram.externalTikzStyleSources,
  )
  warnings.push(...sourceNormalization.warnings)
  const referenceNormalization = normalizeLoadedImportedTikzStyleReferences(
    savedDiagram.importedTikzStyleReferences,
    sourceNormalization.externalTikzStyleSources,
  )
  warnings.push(...referenceNormalization.warnings)
  const presetNormalization = normalizeLoadedUserStylePresets(
    savedDiagram.userStylePresets,
  )
  warnings.push(...presetNormalization.warnings)

  const styleMetadataErrors = [
    ...sourceNormalization.errors,
    ...referenceNormalization.errors,
    ...presetNormalization.errors,
  ]

  if (styleMetadataErrors.length > 0) {
    return {
      diagram: {
        version: savedDiagram.version,
        ambientDimension: savedDiagram.ambientDimension,
        camera,
        ...(view === undefined ? {} : { view }),
        ...(sourceNormalization.externalTikzStyleSources === undefined
          ? {}
          : {
              externalTikzStyleSources:
                sourceNormalization.externalTikzStyleSources,
            }),
        ...(referenceNormalization.importedTikzStyleReferences === undefined
          ? {}
          : {
              importedTikzStyleReferences:
                referenceNormalization.importedTikzStyleReferences,
            }),
        strata: savedDiagram.strata as Stratum[],
        labels: savedDiagram.labels as TextLabel[],
      },
      warnings,
      errors: styleMetadataErrors,
    }
  }

  const diagramWithoutLayers: Diagram = {
    version: savedDiagram.version,
    ambientDimension: savedDiagram.ambientDimension,
    camera,
    ...(view === undefined ? {} : { view }),
    ...(sourceNormalization.externalTikzStyleSources === undefined
      ? {}
      : {
          externalTikzStyleSources:
            sourceNormalization.externalTikzStyleSources,
        }),
    ...(referenceNormalization.importedTikzStyleReferences === undefined
      ? {}
      : {
          importedTikzStyleReferences:
            referenceNormalization.importedTikzStyleReferences,
        }),
    ...(presetNormalization.userStylePresets === undefined
      ? {}
      : { userStylePresets: presetNormalization.userStylePresets }),
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

function normalizeLoadedExternalTikzStyleSources(
  savedSources: unknown,
): {
  externalTikzStyleSources?: ExternalTikzStyleSource[]
  warnings: string[]
  errors: string[]
} {
  if (savedSources === undefined) {
    return {
      warnings: [],
      errors: [],
    }
  }

  if (!Array.isArray(savedSources)) {
    return {
      warnings: [],
      errors: ['externalTikzStyleSources must be an array when present.'],
    }
  }

  const warnings: string[] = []
  const errors: string[] = []
  const seenIds = new Set<string>()
  const externalTikzStyleSources = savedSources.flatMap(
    (savedSource, index): ExternalTikzStyleSource[] => {
      const sourcePath = `externalTikzStyleSources[${index}]`

      if (!isRecord(savedSource)) {
        errors.push(`${sourcePath} must be an external TikZ style source object.`)
        return []
      }

      if (typeof savedSource.id !== 'string' || savedSource.id.trim().length === 0) {
        errors.push(`${sourcePath}.id must be non-empty.`)
        return []
      }

      if (seenIds.has(savedSource.id)) {
        errors.push(`${sourcePath}.id duplicates an earlier external style source id.`)
        return []
      }
      seenIds.add(savedSource.id)

      const rawName =
        typeof savedSource.name === 'string' ? savedSource.name : ''
      const name = normalizeExternalTikzStyleSourceName(rawName)
      if (rawName !== name) {
        warnings.push(
          `Saved external style source ${index + 1} name was normalized.`,
        )
      }

      const rawLoadHint =
        typeof savedSource.loadHint === 'string' ? savedSource.loadHint : ''
      const loadHint = normalizeExternalTikzStyleLoadHint(rawLoadHint, name)
      if (rawLoadHint !== loadHint) {
        warnings.push(
          `Saved external style source ${index + 1} load hint was normalized.`,
        )
      }

      return [{ id: savedSource.id, name, loadHint }]
    },
  )

  return {
    ...(externalTikzStyleSources.length === 0
      ? {}
      : { externalTikzStyleSources }),
    warnings,
    errors,
  }
}

function normalizeLoadedImportedTikzStyleReferences(
  savedReferences: unknown,
  sources: readonly ExternalTikzStyleSource[] | undefined,
): {
  importedTikzStyleReferences?: ImportedTikzStyleReference[]
  warnings: string[]
  errors: string[]
} {
  if (savedReferences === undefined) {
    return {
      warnings: [],
      errors: [],
    }
  }

  if (!Array.isArray(savedReferences)) {
    return {
      warnings: [],
      errors: ['importedTikzStyleReferences must be an array when present.'],
    }
  }

  const warnings: string[] = []
  const errors: string[] = []
  const seenIds = new Set<string>()
  const sourceIds = new Set((sources ?? []).map((source) => source.id))
  const importedTikzStyleReferences = savedReferences.flatMap(
    (savedReference, index): ImportedTikzStyleReference[] => {
      const referencePath = `importedTikzStyleReferences[${index}]`

      if (!isRecord(savedReference)) {
        errors.push(`${referencePath} must be an imported TikZ style reference object.`)
        return []
      }

      if (
        typeof savedReference.id !== 'string' ||
        savedReference.id.trim().length === 0
      ) {
        errors.push(`${referencePath}.id must be non-empty.`)
        return []
      }

      if (seenIds.has(savedReference.id)) {
        errors.push(`${referencePath}.id duplicates an earlier imported style reference id.`)
        return []
      }
      seenIds.add(savedReference.id)

      if (
        typeof savedReference.key !== 'string' ||
        normalizeImportedTikzStyleKey(savedReference.key).length === 0
      ) {
        errors.push(`${referencePath}.key must be non-empty.`)
        return []
      }
      const key = normalizeImportedTikzStyleKey(savedReference.key)

      if (
        typeof savedReference.sourceId !== 'string' ||
        savedReference.sourceId.trim().length === 0
      ) {
        errors.push(`${referencePath}.sourceId must be non-empty.`)
        return []
      }

      if (!sourceIds.has(savedReference.sourceId)) {
        errors.push(`${referencePath}.sourceId does not match an external style source.`)
        return []
      }

      const targets = loadedTikzStyleTargets(
        savedReference.targets,
        referencePath,
        errors,
      )

      if (targets.length === 0) {
        return []
      }

      const rawDisplayName =
        typeof savedReference.displayName === 'string'
          ? savedReference.displayName
          : ''
      const displayName = normalizeImportedTikzStyleDisplayName(
        rawDisplayName,
        key,
      )
      if (rawDisplayName !== displayName) {
        warnings.push(
          `Saved imported style reference ${index + 1} display name was normalized.`,
        )
      }

      return [
        {
          id: savedReference.id,
          key,
          sourceId: savedReference.sourceId,
          displayName,
          targets,
        },
      ]
    },
  )

  return {
    ...(importedTikzStyleReferences.length === 0
      ? {}
      : { importedTikzStyleReferences }),
    warnings,
    errors,
  }
}

function loadedTikzStyleTargets(
  savedTargets: unknown,
  referencePath: string,
  errors: string[],
): TikzStyleTarget[] {
  if (!Array.isArray(savedTargets)) {
    errors.push(`${referencePath}.targets must be an array.`)
    return []
  }

  if (savedTargets.length === 0) {
    errors.push(`${referencePath}.targets must not be empty.`)
    return []
  }

  const targets: TikzStyleTarget[] = []

  savedTargets.forEach((savedTarget, targetIndex) => {
    if (typeof savedTarget !== 'string' || !isTikzStyleTarget(savedTarget)) {
      errors.push(`${referencePath}.targets[${targetIndex}] is not supported.`)
      return
    }

    targets.push(savedTarget)
  })

  return targets
}

function normalizeLoadedUserStylePresets(
  savedPresets: unknown,
): {
  userStylePresets?: UserStylePreset[]
  warnings: string[]
  errors: string[]
} {
  if (savedPresets === undefined) {
    return {
      warnings: [],
      errors: [],
    }
  }

  if (!Array.isArray(savedPresets)) {
    return {
      warnings: [],
      errors: ['userStylePresets must be an array when present.'],
    }
  }

  const warnings: string[] = []
  const errors: string[] = []
  const seenIds = new Set<string>()
  const usedTikzNames: string[] = []
  const userStylePresets = savedPresets.flatMap(
    (savedPreset, index): UserStylePreset[] => {
      const presetPath = `userStylePresets[${index}]`

      if (!isRecord(savedPreset)) {
        errors.push(`${presetPath} must be a style preset object.`)
        return []
      }

      if (typeof savedPreset.id !== 'string' || savedPreset.id.trim().length === 0) {
        errors.push(`${presetPath}.id must be non-empty.`)
        return []
      }

      if (seenIds.has(savedPreset.id)) {
        errors.push(`${presetPath}.id duplicates an earlier preset id.`)
        return []
      }
      seenIds.add(savedPreset.id)

      if (
        typeof savedPreset.kind !== 'string' ||
        !isStylePresetKind(savedPreset.kind)
      ) {
        errors.push(`${presetPath}.kind is not supported.`)
        return []
      }

      const kind = savedPreset.kind
      const name = loadedStylePresetName(savedPreset.name, kind, index, warnings)
      const tikzStyleName = loadedTikzStyleName(
        savedPreset.tikzStyleName,
        name,
        kind,
        index,
        usedTikzNames,
        warnings,
      )
      usedTikzNames.push(tikzStyleName)

      if (!isRecord(savedPreset.style)) {
        errors.push(`${presetPath}.style must be a style object.`)
        return []
      }

      const importedTikzStyleReferenceId =
        loadedOptionalImportedTikzStyleReferenceId(
          savedPreset.importedTikzStyleReferenceId,
          `${presetPath}.importedTikzStyleReferenceId`,
          errors,
        )

      return [
        loadedUserStylePreset(
          savedPreset.id,
          name,
          kind,
          savedPreset.style,
          tikzStyleName,
          importedTikzStyleReferenceId,
        ),
      ]
    },
  )

  return {
    ...(userStylePresets.length === 0 ? {} : { userStylePresets }),
    warnings,
    errors,
  }
}

function loadedStylePresetName(
  savedName: unknown,
  kind: StylePresetKind,
  index: number,
  warnings: string[],
): string {
  if (typeof savedName === 'string' && savedName.trim().length > 0) {
    return normalizeStylePresetName(savedName, kind)
  }

  warnings.push(
    `Saved style preset ${index + 1} has a blank name; using a default name.`,
  )
  return normalizeStylePresetName('', kind)
}

function loadedTikzStyleName(
  savedTikzStyleName: unknown,
  name: string,
  kind: StylePresetKind,
  index: number,
  usedTikzNames: readonly string[],
  warnings: string[],
): string {
  const fallback = tikzStyleNameFromPresetName(name, kind)
  const rawName =
    typeof savedTikzStyleName === 'string' && savedTikzStyleName.trim().length > 0
      ? savedTikzStyleName
      : fallback
  const sanitized = sanitizeTikzStyleName(rawName, fallback)
  const unique = uniqueTikzStyleName(sanitized, usedTikzNames)

  if (rawName !== unique) {
    warnings.push(
      `Saved style preset ${index + 1} TikZ style name was normalized to ${unique}.`,
    )
  }

  return unique
}

function loadedUserStylePreset(
  id: string,
  name: string,
  kind: StylePresetKind,
  style: Record<string, unknown>,
  tikzStyleName: string,
  importedTikzStyleReferenceId: string | undefined,
): UserStylePreset {
  const importedStyleReference =
    importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }

  switch (kind) {
    case 'region':
      return {
        id,
        name,
        kind,
        style: style as RegionStyle,
        tikzStyleName,
        ...importedStyleReference,
      }
    case 'sheet':
      return {
        id,
        name,
        kind,
        style: style as SheetStyle,
        tikzStyleName,
        ...importedStyleReference,
      }
    case 'curve':
      return {
        id,
        name,
        kind,
        style: style as CurveStyle,
        tikzStyleName,
        ...importedStyleReference,
      }
    case 'point':
      return {
        id,
        name,
        kind,
        style: style as PointStyle,
        tikzStyleName,
        ...importedStyleReference,
      }
    case 'label':
      return {
        id,
        name,
        kind,
        style: style as LabelStyle,
        tikzStyleName,
        ...importedStyleReference,
      }
  }
}

function loadedOptionalImportedTikzStyleReferenceId(
  value: unknown,
  path: string,
  errors: string[],
): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be non-empty when present.`)
    return undefined
  }

  return value
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
