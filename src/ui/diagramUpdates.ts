import {
  absoluteCubicBezierPointsFromControlMode,
  isValidPolarControl,
  isValidWorkPlaneFrameSnapshot,
  pointFromWorkPlaneLocalCoordinate,
  workPlaneLocalCoordinateFromPoint,
} from '../geometry/bezierControls.ts'
import {
  MAX_CURVED_SHEET_SAMPLING_SEGMENTS,
  validateCurvedSheetPrimitive,
} from '../geometry/curvedSheets.ts'
import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import {
  isFiniteVec3,
  projectPointToWorkPlaneCoordinates,
  pointOnWorkPlane,
  validateWorkPlane,
  workPlaneToBasis,
} from '../geometry/workPlane.ts'
import {
  areSegmentsComposable,
  normalizePathSegmentsForAmbientDimension,
  pathCoordinates,
} from '../model/paths.ts'
import {
  layerFilterIncludesLayer,
  normalizeLayerFilterForDiagram,
  type LayerFilter,
} from './layerFilter.ts'
import {
  cloneCurveStyle,
  cloneLabelStyle,
  clonePointStyle,
  cloneSheetStyle,
  defaultCurveStyle,
  defaultLabelStyle,
  defaultPointStyle,
  defaultSheetStyle,
} from '../model/styles.ts'
import type {
  AmbientDimension,
  CubicBezierPolarControl,
  CubicBezierControlMode,
  CurveStratum,
  CurvedSheetPrimitive,
  CurvedSheetStratum,
  Diagram,
  HemisphereSide,
  LabelStyle,
  PathSegment,
  PointStratum,
  PolygonSheetStratum,
  SheetStyle,
  Stratum,
  StratumStyle,
  SurfaceSampling,
  TextLabel,
  Vec3,
  WorkPlane,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinate,
  WorkPlaneLocalOffset,
} from '../model/types.ts'
import type { SelectedElement } from './selection.ts'
import { areFinitePoints } from './sheetDraft.ts'
import {
  resolveExistingCoordinateForDirectCreation,
  type ExistingCoordinateSource,
} from './coordinateSources.ts'

export type CoordinateAxis = 'x' | 'y' | 'z'

export type SelectedElementUpdaters = {
  stratum?: (stratum: Stratum) => Stratum
  label?: (label: TextLabel) => TextLabel
}

export type RemoveSelectedElementResult = {
  diagram: Diagram
  selectedElement: SelectedElement
  removed: boolean
}

export type RemoveSelectedElementWithLayerFilterResult =
  RemoveSelectedElementResult & {
    layerFilter: LayerFilter
  }

export function cloneDiagram(diagram: Diagram): Diagram {
  return structuredClone(diagram) as Diagram
}

export function updateStratumById(
  diagram: Diagram,
  id: string,
  updater: (stratum: Stratum) => Stratum,
): Diagram {
  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (stratum.id !== id) {
      return stratum
    }

    changed = true
    return updater(stratum)
  })

  return changed ? { ...diagram, strata } : diagram
}

export function updateLabelById(
  diagram: Diagram,
  id: string,
  updater: (label: TextLabel) => TextLabel,
): Diagram {
  let changed = false
  const labels = diagram.labels.map((label) => {
    if (label.id !== id) {
      return label
    }

    changed = true
    return updater(label)
  })

  return changed ? { ...diagram, labels } : diagram
}

export function removeSelectedElement(
  diagram: Diagram,
  selectedElement: SelectedElement,
): RemoveSelectedElementResult {
  if (selectedElement === null) {
    return {
      diagram,
      selectedElement: null,
      removed: false,
    }
  }

  if (selectedElement.kind === 'stratum') {
    let removed = false
    const strata = diagram.strata.filter((stratum) => {
      if (!removed && stratum.id === selectedElement.id) {
        removed = true
        return false
      }

      return true
    })

    return {
      diagram: removed ? { ...diagram, strata } : diagram,
      selectedElement: null,
      removed,
    }
  }

  let removed = false
  const labels = diagram.labels.filter((label) => {
    if (!removed && label.id === selectedElement.id) {
      removed = true
      return false
    }

    return true
  })

  return {
    diagram: removed ? { ...diagram, labels } : diagram,
    selectedElement: null,
    removed,
  }
}

export function removeSelectedElementWithLayerFilter(
  diagram: Diagram,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
): RemoveSelectedElementWithLayerFilterResult {
  const result = removeSelectedElement(diagram, selectedElement)

  return {
    ...result,
    layerFilter: normalizeLayerFilterForDiagram(result.diagram, layerFilter),
  }
}

export function updateStratumStyleById(
  diagram: Diagram,
  id: string,
  updater: (style: StratumStyle) => StratumStyle,
): Diagram {
  return updateStratumById(diagram, id, (stratum) => {
    switch (stratum.geometricKind) {
      case 'region': {
        const style = updater(stratum.style)
        return style.kind === 'regionStyle' ? { ...stratum, style } : stratum
      }
      case 'sheet': {
        const style = updater(stratum.style)
        return style.kind === 'sheetStyle' ? { ...stratum, style } : stratum
      }
      case 'curve': {
        const style = updater(stratum.style)
        return style.kind === 'curveStyle' ? { ...stratum, style } : stratum
      }
      case 'point': {
        const style = updater(stratum.style)
        return style.kind === 'pointStyle' ? { ...stratum, style } : stratum
      }
    }
  })
}

export function updateLabelStyleById(
  diagram: Diagram,
  id: string,
  updater: (style: LabelStyle) => LabelStyle,
): Diagram {
  return updateLabelById(diagram, id, (label) => ({
    ...label,
    style: updater(label.style),
  }))
}

export type AddPointStratumOptions = {
  id?: string
  name?: string
  layer?: number
}

export type AddTextLabelOptions = {
  id?: string
  name?: string
  text?: string
  layer?: number
}

export type AddPolylineCurveStratumOptions = {
  id?: string
  name?: string
  layer?: number
}

export type AddCubicBezierCurveStratumOptions = {
  id?: string
  name?: string
  layer?: number
  bezierControls?: CubicBezierControlMode
  directControlMode?: DirectCubicBezierControlMode
}

export type AddConcatenatedPathStratumOptions = {
  id?: string
  name?: string
  layer?: number
}

export type AddPolygonSheetStratumOptions = {
  id?: string
  name?: string
  layer?: number
}

export type AddCurvedSheetStratumOptions = {
  id?: string
  name?: string
  layer?: number
  style?: SheetStyle
}

export type CurvedSheetCreationKind = CurvedSheetPrimitive['kind']

export type HemisphereCreationParameters = {
  kind: 'hemisphere'
  radius: number
  hemisphereSide: HemisphereSide
  sampling: SurfaceSampling
}

export type SaddleCreationParameters = {
  kind: 'saddle'
  width: number
  depth: number
  height: number
  sampling: SurfaceSampling
}

export type CurvedSheetCreationParameters =
  | HemisphereCreationParameters
  | SaddleCreationParameters

export type AddPointStratumResult = {
  diagram: Diagram
  id: string
}

export type AddTextLabelResult = {
  diagram: Diagram
  id: string
}

export type AddPolylineCurveStratumResult = {
  diagram: Diagram
  id: string | null
}

export type AddCubicBezierCurveStratumResult = {
  diagram: Diagram
  id: string | null
}

export type AddConcatenatedPathStratumResult = {
  diagram: Diagram
  id: string | null
}

export type AddPolygonSheetStratumResult = {
  diagram: Diagram
  id: string | null
}

export type AddCurvedSheetStratumResult = {
  diagram: Diagram
  id: string | null
}

export type DirectCoordinateInput = {
  x: string
  y: string
  z: string
  source?: ExistingCoordinateSource
}

export type DirectCoordinateMode = 'global' | 'workPlaneLocal'

export type DirectCoordinateParseOptions = {
  coordinateMode?: DirectCoordinateMode
  workPlane?: WorkPlane
  diagram?: Diagram
}

export type DirectCubicBezierControlMode =
  | 'absolute'
  | 'relativeCartesian'
  | 'relativePolar'

export type DirectPointCreationResult =
  | {
      ok: true
      diagram: Diagram
      id: string
    }
  | {
      ok: false
      diagram: Diagram
    }

export type DirectLabelCreationResult =
  | {
      ok: true
      diagram: Diagram
      id: string
    }
  | {
      ok: false
      diagram: Diagram
    }

export type DirectPathCreationError =
  | 'invalidCoordinates'
  | 'tooFewPoints'
  | 'wrongPointCount'
  | 'unsupportedAmbientDimension'

export type DirectPathCreationResult =
  | {
      ok: true
      diagram: Diagram
      id: string
    }
  | {
      ok: false
      diagram: Diagram
      error: DirectPathCreationError
    }

export type DirectCreationLayerOptions = {
  layer?: number
}

export type DirectCreationCommitResult = {
  diagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
}

export type DirectCreationEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
}

export function makeUniqueId(diagram: Diagram, prefix: string): string {
  const existingIds = new Set([
    ...diagram.strata.map((stratum) => stratum.id),
    ...diagram.labels.map((label) => label.id),
  ])
  let index = 1

  while (existingIds.has(`${prefix}-${index}`)) {
    index += 1
  }

  return `${prefix}-${index}`
}

export const defaultHemisphereSampling: SurfaceSampling = {
  uSegments: 8,
  vSegments: 4,
}

export const defaultSaddleSampling: SurfaceSampling = {
  uSegments: 6,
  vSegments: 5,
}

export const defaultHemisphereCreationParameters: HemisphereCreationParameters = {
  kind: 'hemisphere',
  radius: 1,
  hemisphereSide: 'positive',
  sampling: defaultHemisphereSampling,
}

export const defaultSaddleCreationParameters: SaddleCreationParameters = {
  kind: 'saddle',
  width: 2,
  depth: 2,
  height: 0.75,
  sampling: defaultSaddleSampling,
}

export const maxCurvedSheetSamplingSegments = MAX_CURVED_SHEET_SAMPLING_SEGMENTS

export function addPointStratum(
  diagram: Diagram,
  position: Vec3,
  options: AddPointStratumOptions = {},
): Diagram {
  return addPointStratumWithResult(diagram, position, options).diagram
}

export function addPointStratumWithResult(
  diagram: Diagram,
  position: Vec3,
  options: AddPointStratumOptions = {},
): AddPointStratumResult {
  const point = createPointForDiagram(diagram, position, options)

  return {
    diagram: {
      ...diagram,
      strata: [...diagram.strata, point],
    },
    id: point.id,
  }
}

export function addTextLabel(
  diagram: Diagram,
  position: Vec3,
  options: AddTextLabelOptions = {},
): Diagram {
  return addTextLabelWithResult(diagram, position, options).diagram
}

export function addTextLabelWithResult(
  diagram: Diagram,
  position: Vec3,
  options: AddTextLabelOptions = {},
): AddTextLabelResult {
  const label = createLabelForDiagram(diagram, position, options)

  return {
    diagram: {
      ...diagram,
      labels: [...diagram.labels, label],
    },
    id: label.id,
  }
}

export function addPolylineCurveStratum(
  diagram: Diagram,
  points: Vec3[],
  options: AddPolylineCurveStratumOptions = {},
): Diagram {
  return addPolylineCurveStratumWithResult(diagram, points, options).diagram
}

export function addPolylineCurveStratumWithResult(
  diagram: Diagram,
  points: Vec3[],
  options: AddPolylineCurveStratumOptions = {},
): AddPolylineCurveStratumResult {
  if (points.length < 2 || !areFinitePoints(points)) {
    return {
      diagram,
      id: null,
    }
  }

  const curve = createPolylineCurveForDiagram(diagram, points, options)

  return {
    diagram: {
      ...diagram,
      strata: [...diagram.strata, curve],
    },
    id: curve.id,
  }
}

export function addCubicBezierCurveStratum(
  diagram: Diagram,
  points: Vec3[],
  options: AddCubicBezierCurveStratumOptions = {},
): Diagram {
  return addCubicBezierCurveStratumWithResult(diagram, points, options).diagram
}

export function addCubicBezierCurveStratumWithResult(
  diagram: Diagram,
  points: Vec3[],
  options: AddCubicBezierCurveStratumOptions = {},
): AddCubicBezierCurveStratumResult {
  if (points.length !== 4 || !areFinitePoints(points)) {
    return {
      diagram,
      id: null,
    }
  }

  const curve = createCubicBezierCurveForDiagram(diagram, points, options)

  return {
    diagram: {
      ...diagram,
      strata: [...diagram.strata, curve],
    },
    id: curve.id,
  }
}

export function addConcatenatedPathStratum(
  diagram: Diagram,
  segments: PathSegment[],
  options: AddConcatenatedPathStratumOptions = {},
): Diagram {
  return addConcatenatedPathStratumWithResult(diagram, segments, options).diagram
}

export function addConcatenatedPathStratumWithResult(
  diagram: Diagram,
  segments: PathSegment[],
  options: AddConcatenatedPathStratumOptions = {},
): AddConcatenatedPathStratumResult {
  if (
    segments.length === 0 ||
    !areFinitePoints(pathCoordinates(segments)) ||
    !areSegmentsComposable(segments)
  ) {
    return {
      diagram,
      id: null,
    }
  }

  const path = createConcatenatedPathForDiagram(diagram, segments, options)

  return {
    diagram: {
      ...diagram,
      strata: [...diagram.strata, path],
    },
    id: path.id,
  }
}

export function addPolygonSheetStratum(
  diagram: Diagram,
  vertices: Vec3[],
  options: AddPolygonSheetStratumOptions = {},
): Diagram {
  return addPolygonSheetStratumWithResult(diagram, vertices, options).diagram
}

export function addPolygonSheetStratumWithResult(
  diagram: Diagram,
  vertices: Vec3[],
  options: AddPolygonSheetStratumOptions = {},
): AddPolygonSheetStratumResult {
  if (
    diagram.ambientDimension !== 3 ||
    vertices.length < 3 ||
    !areFinitePoints(vertices)
  ) {
    return {
      diagram,
      id: null,
    }
  }

  const sheet = createPolygonSheetForDiagram(diagram, vertices, options)

  return {
    diagram: {
      ...diagram,
      strata: [...diagram.strata, sheet],
    },
    id: sheet.id,
  }
}

export function addCurvedSheetStratumWithResult(
  diagram: Diagram,
  anchorPoint: Vec3,
  workPlane: WorkPlane,
  parameters: CurvedSheetCreationParameters,
  options: AddCurvedSheetStratumOptions = {},
): AddCurvedSheetStratumResult {
  if (diagram.ambientDimension !== 3 || !isFiniteVec3(anchorPoint)) {
    return {
      diagram,
      id: null,
    }
  }

  const frame = workPlaneFrameSnapshotFromWorkPlane(workPlane, anchorPoint)

  if (frame === null) {
    return {
      diagram,
      id: null,
    }
  }

  const primitive = curvedSheetPrimitiveFromCreationParameters(
    anchorPoint,
    frame,
    parameters,
  )

  if (!validateCurvedSheetPrimitive(primitive).valid) {
    return {
      diagram,
      id: null,
    }
  }

  const sheet = createCurvedSheetForDiagram(diagram, primitive, options)

  return {
    diagram: {
      ...diagram,
      strata: [...diagram.strata, sheet],
    },
    id: sheet.id,
  }
}

export function addHemisphereSheetStratumWithResult(
  diagram: Diagram,
  center: Vec3,
  workPlane: WorkPlane,
  parameters: Omit<HemisphereCreationParameters, 'kind'>,
  options: AddCurvedSheetStratumOptions = {},
): AddCurvedSheetStratumResult {
  return addCurvedSheetStratumWithResult(
    diagram,
    center,
    workPlane,
    { kind: 'hemisphere', ...parameters },
    options,
  )
}

export function addSaddleSheetStratumWithResult(
  diagram: Diagram,
  origin: Vec3,
  workPlane: WorkPlane,
  parameters: Omit<SaddleCreationParameters, 'kind'>,
  options: AddCurvedSheetStratumOptions = {},
): AddCurvedSheetStratumResult {
  return addCurvedSheetStratumWithResult(
    diagram,
    origin,
    workPlane,
    { kind: 'saddle', ...parameters },
    options,
  )
}

export function addPointStratumFromDirectInput(
  diagram: Diagram,
  coordinates: DirectCoordinateInput,
  options: AddPointStratumOptions & DirectCoordinateParseOptions = {},
): DirectPointCreationResult {
  const position = parseDirectCoordinateInput(
    coordinates,
    diagram.ambientDimension,
    directCoordinateParseOptionsForDiagram(diagram, options),
  )

  if (position === null) {
    return {
      ok: false,
      diagram,
    }
  }

  const result = addPointStratumWithResult(diagram, position, options)

  return {
    ok: true,
    diagram: result.diagram,
    id: result.id,
  }
}

export function addTextLabelFromDirectInput(
  diagram: Diagram,
  coordinates: DirectCoordinateInput,
  text: string,
  options: AddTextLabelOptions & DirectCoordinateParseOptions = {},
): DirectLabelCreationResult {
  const position = parseDirectCoordinateInput(
    coordinates,
    diagram.ambientDimension,
    directCoordinateParseOptionsForDiagram(diagram, options),
  )

  if (position === null) {
    return {
      ok: false,
      diagram,
    }
  }

  const result = addTextLabelWithResult(diagram, position, {
    ...options,
    text: normalizeDirectLabelText(text),
  })

  return {
    ok: true,
    diagram: result.diagram,
    id: result.id,
  }
}

export function addPolylineCurveFromDirectInput(
  diagram: Diagram,
  coordinates: DirectCoordinateInput[],
  options: AddPolylineCurveStratumOptions & DirectCoordinateParseOptions = {},
): DirectPathCreationResult {
  if (coordinates.length < 2) {
    return {
      ok: false,
      diagram,
      error: 'tooFewPoints',
    }
  }

  const points = parseDirectCoordinateInputs(
    coordinates,
    diagram.ambientDimension,
    directCoordinateParseOptionsForDiagram(diagram, options),
  )

  if (points === null) {
    return {
      ok: false,
      diagram,
      error: 'invalidCoordinates',
    }
  }

  const result = addPolylineCurveStratumWithResult(diagram, points, options)

  if (result.id === null) {
    return {
      ok: false,
      diagram,
      error: 'tooFewPoints',
    }
  }

  return {
    ok: true,
    diagram: result.diagram,
    id: result.id,
  }
}

export function addCubicBezierCurveFromDirectInput(
  diagram: Diagram,
  coordinates: DirectCoordinateInput[],
  options: AddCubicBezierCurveStratumOptions & DirectCoordinateParseOptions = {},
): DirectPathCreationResult {
  if (coordinates.length !== 4) {
    return {
      ok: false,
      diagram,
      error: 'wrongPointCount',
    }
  }

  const directControlMode = options.directControlMode ?? 'absolute'
  const parseOptions = directCoordinateParseOptionsForDiagram(diagram, options)
  const usesWorkPlaneLocalCoordinates =
    diagram.ambientDimension === 3 &&
    parseOptions.coordinateMode === 'workPlaneLocal'

  if (
    directControlMode === 'relativePolar' &&
    diagram.ambientDimension === 3 &&
    !usesWorkPlaneLocalCoordinates
  ) {
    return {
      ok: false,
      diagram,
      error: 'unsupportedAmbientDimension',
    }
  }

  const bezierInput = directCubicBezierInputToPoints(
    diagram.ambientDimension,
    coordinates,
    directControlMode,
    parseOptions,
  )

  if (bezierInput === null) {
    return {
      ok: false,
      diagram,
      error: 'invalidCoordinates',
    }
  }

  const result = addCubicBezierCurveStratumWithResult(
    diagram,
    bezierInput.points,
    {
      ...options,
      bezierControls: bezierInput.bezierControls,
    },
  )

  if (result.id === null) {
    return {
      ok: false,
      diagram,
      error: 'wrongPointCount',
    }
  }

  return {
    ok: true,
    diagram: result.diagram,
    id: result.id,
  }
}

function directCubicBezierInputToPoints(
  ambientDimension: AmbientDimension,
  coordinates: DirectCoordinateInput[],
  directControlMode: DirectCubicBezierControlMode,
  options: DirectCoordinateParseOptions,
): { points: Vec3[]; bezierControls: CubicBezierControlMode } | null {
  if (directControlMode === 'absolute') {
    const points = parseDirectCoordinateInputs(
      coordinates,
      ambientDimension,
      options,
    )

    if (points === null) {
      return null
    }

    return {
      points,
      bezierControls: { kind: 'absolute' },
    }
  }

  const start = parseDirectCoordinateInput(coordinates[0], ambientDimension, options)
  const end = parseDirectCoordinateInput(coordinates[1], ambientDimension, options)

  if (start === null || end === null) {
    return null
  }

  if (directControlMode === 'relativeCartesian') {
    if (
      ambientDimension === 3 &&
      options.coordinateMode === 'workPlaneLocal'
    ) {
      const frame = workPlaneFrameSnapshotFromWorkPlane(options.workPlane)
      const firstControlOffset = parseWorkPlaneLocalOffsetInput(coordinates[2])
      const secondControlOffset = parseWorkPlaneLocalOffsetInput(coordinates[3])

      if (
        frame === null ||
        firstControlOffset === null ||
        secondControlOffset === null
      ) {
        return null
      }

      const localStart = workPlaneLocalCoordinateForPoint(frame, start)
      const localEnd = workPlaneLocalCoordinateForPoint(frame, end)

      if (localStart === null || localEnd === null) {
        return null
      }

      const bezierControls: CubicBezierControlMode = {
        kind: 'workPlaneRelativeCartesian',
        frame,
        localStart,
        localEnd,
        firstControlOffset,
        secondControlOffset,
        secondOffsetReference: 'end',
      }
      const absolutePoints = absoluteCubicBezierPointsFromControlMode(
        ambientDimension,
        start,
        end,
        bezierControls,
      )

      return absolutePoints === null || !areFinitePoints(absolutePoints)
        ? null
        : { points: absolutePoints, bezierControls }
    }

    const firstControlOffset = parseNumericDirectCoordinateInput(
      coordinates[2],
      ambientDimension,
      options,
    )
    const secondControlOffset = parseNumericDirectCoordinateInput(
      coordinates[3],
      ambientDimension,
      options,
    )

    if (firstControlOffset === null || secondControlOffset === null) {
      return null
    }

    const bezierControls: CubicBezierControlMode = {
      kind: 'relativeCartesian',
      firstControlOffset,
      secondControlOffset,
      secondOffsetReference: 'end',
    }
    const absolutePoints = absoluteCubicBezierPointsFromControlMode(
      ambientDimension,
      start,
      end,
      bezierControls,
    )

    return absolutePoints === null || !areFinitePoints(absolutePoints)
      ? null
      : { points: absolutePoints, bezierControls }
  }

  const firstControl = parseDirectPolarControlInput(coordinates[2])
  const secondControl = parseDirectPolarControlInput(coordinates[3])

  if (firstControl === null || secondControl === null) {
    return null
  }

  if (
    ambientDimension === 3 &&
    options.coordinateMode === 'workPlaneLocal'
  ) {
    const frame = workPlaneFrameSnapshotFromWorkPlane(options.workPlane)

    if (frame === null) {
      return null
    }

    const localStart = workPlaneLocalCoordinateForPoint(frame, start)
    const localEnd = workPlaneLocalCoordinateForPoint(frame, end)

    if (localStart === null || localEnd === null) {
      return null
    }

    const bezierControls: CubicBezierControlMode = {
      kind: 'workPlaneRelativePolar',
      frame,
      localStart,
      localEnd,
      firstControl,
      secondControl,
      secondOffsetReference: 'end',
    }
    const absolutePoints = absoluteCubicBezierPointsFromControlMode(
      ambientDimension,
      start,
      end,
      bezierControls,
    )

    return absolutePoints === null || !areFinitePoints(absolutePoints)
      ? null
      : { points: absolutePoints, bezierControls }
  }

  const bezierControls: CubicBezierControlMode = {
    kind: 'relativePolar',
    firstControl,
    secondControl,
    secondOffsetReference: 'end',
  }

  const absolutePoints = absoluteCubicBezierPointsFromControlMode(
    ambientDimension,
    start,
    end,
    bezierControls,
  )

  return absolutePoints === null || !areFinitePoints(absolutePoints)
    ? null
    : { points: absolutePoints, bezierControls }
}

export function addPolygonSheetFromDirectInput(
  diagram: Diagram,
  coordinates: DirectCoordinateInput[],
  options: AddPolygonSheetStratumOptions & DirectCoordinateParseOptions = {},
): DirectPathCreationResult {
  if (diagram.ambientDimension !== 3) {
    return {
      ok: false,
      diagram,
      error: 'unsupportedAmbientDimension',
    }
  }

  if (coordinates.length < 3) {
    return {
      ok: false,
      diagram,
      error: 'tooFewPoints',
    }
  }

  const vertices = parseDirectCoordinateInputs(
    coordinates,
    diagram.ambientDimension,
    directCoordinateParseOptionsForDiagram(diagram, options),
  )

  if (vertices === null) {
    return {
      ok: false,
      diagram,
      error: 'invalidCoordinates',
    }
  }

  const result = addPolygonSheetStratumWithResult(diagram, vertices, options)

  if (result.id === null) {
    return {
      ok: false,
      diagram,
      error: 'tooFewPoints',
    }
  }

  return {
    ok: true,
    diagram: result.diagram,
    id: result.id,
  }
}

export function directCreationLayerOptions(
  layerFilter: LayerFilter,
): DirectCreationLayerOptions {
  return layerFilter.kind === 'layer' ? { layer: layerFilter.layer } : {}
}

export function commitDirectCreationResult(
  diagram: Diagram,
  selectedElement: Exclude<SelectedElement, null>,
  createdLayer: number,
  layerFilter: LayerFilter,
): DirectCreationCommitResult {
  return {
    diagram,
    selectedElement,
    layerFilter: layerFilterIncludesLayer(layerFilter, createdLayer)
      ? layerFilter
      : { kind: 'layer', layer: createdLayer },
  }
}

export function applyDirectCreationCommitToEditorState<
  T extends DirectCreationEditorState,
>(state: T, result: DirectCreationCommitResult): T {
  return {
    ...state,
    editableDiagram: result.diagram,
    selectedElement: result.selectedElement,
    layerFilter: result.layerFilter,
  }
}

export function updateStratumNameById(
  diagram: Diagram,
  id: string,
  name: string,
): Diagram {
  if (name.trim().length === 0) {
    return diagram
  }

  return updateStratumById(diagram, id, (stratum) => ({ ...stratum, name }))
}

export function updateCurvedSheetPrimitiveById(
  diagram: Diagram,
  id: string,
  updater: (primitive: CurvedSheetPrimitive) => CurvedSheetPrimitive,
): Diagram {
  return updateStratumById(diagram, id, (stratum) => {
    if (stratum.geometricKind !== 'sheet' || stratum.kind !== 'curvedSheet') {
      return stratum
    }

    const primitive = updater(stratum.primitive)

    return validateCurvedSheetPrimitive(primitive).valid
      ? {
          ...stratum,
          primitive,
        }
      : stratum
  })
}

function nextLayer(diagram: Diagram): number {
  const layers = [
    ...diagram.strata.map((stratum) => stratum.layer),
    ...diagram.labels.map((label) => label.layer),
  ]

  return layers.length === 0 ? 0 : Math.max(...layers) + 1
}

function createPointForDiagram(
  diagram: Diagram,
  position: Vec3,
  options: AddPointStratumOptions,
): PointStratum {
  return {
    codim: diagram.ambientDimension === 2 ? 2 : 3,
    geometricKind: 'point',
    id: options.id ?? makeUniqueId(diagram, 'point'),
    name: options.name ?? 'Point',
    style: clonePointStyle(defaultPointStyle),
    position: normalizePointForAmbientDimension(diagram.ambientDimension, position),
    layer: options.layer ?? nextLayer(diagram),
  }
}

function createLabelForDiagram(
  diagram: Diagram,
  position: Vec3,
  options: AddTextLabelOptions,
): TextLabel {
  return {
    id: options.id ?? makeUniqueId(diagram, 'label'),
    geometricKind: 'label',
    name: options.name ?? 'Label',
    text: options.text ?? 'Label',
    position: normalizePointForAmbientDimension(diagram.ambientDimension, position),
    style: cloneLabelStyle(defaultLabelStyle),
    layer: options.layer ?? nextLayer(diagram),
  }
}

function createPolylineCurveForDiagram(
  diagram: Diagram,
  points: Vec3[],
  options: AddPolylineCurveStratumOptions,
): CurveStratum {
  return {
    codim: diagram.ambientDimension === 2 ? 1 : 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: safeOptionalId(diagram, options.id, 'curve'),
    name: safeOptionalName(options.name, 'Curve'),
    style: cloneCurveStyle(defaultCurveStyle),
    points: points.map((point) =>
      normalizePointForAmbientDimension(diagram.ambientDimension, point),
    ),
    styleSegments: [],
    layer: options.layer ?? nextLayer(diagram),
  }
}

function createCubicBezierCurveForDiagram(
  diagram: Diagram,
  points: Vec3[],
  options: AddCubicBezierCurveStratumOptions,
): CurveStratum {
  const curve: CurveStratum = {
    codim: diagram.ambientDimension === 2 ? 1 : 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: safeOptionalId(diagram, options.id, 'curve'),
    name: safeOptionalName(options.name, 'Cubic Bezier'),
    style: cloneCurveStyle(defaultCurveStyle),
    points: points.map((point) =>
      normalizePointForAmbientDimension(diagram.ambientDimension, point),
    ),
    styleSegments: [],
    layer: options.layer ?? nextLayer(diagram),
  }

  if (options.bezierControls !== undefined) {
    curve.bezierControls = options.bezierControls
  }

  return curve
}

function createConcatenatedPathForDiagram(
  diagram: Diagram,
  segments: PathSegment[],
  options: AddConcatenatedPathStratumOptions,
): CurveStratum {
  return {
    codim: diagram.ambientDimension === 2 ? 1 : 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: safeOptionalId(diagram, options.id, 'curve'),
    name: safeOptionalName(options.name, 'Path'),
    style: cloneCurveStyle(defaultCurveStyle),
    segments: normalizePathSegmentsForAmbientDimension(
      segments,
      diagram.ambientDimension,
    ),
    styleSegments: [],
    layer: options.layer ?? nextLayer(diagram),
  }
}

function createPolygonSheetForDiagram(
  diagram: Diagram,
  vertices: Vec3[],
  options: AddPolygonSheetStratumOptions,
): PolygonSheetStratum {
  return {
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    id: safeOptionalId(diagram, options.id, 'sheet'),
    name: safeOptionalName(options.name, 'Sheet'),
    style: cloneSheetStyle(defaultSheetStyle),
    vertices: vertices.map((vertex) =>
      normalizePointForAmbientDimension(diagram.ambientDimension, vertex),
    ),
    layer: options.layer ?? nextLayer(diagram),
  }
}

function createCurvedSheetForDiagram(
  diagram: Diagram,
  primitive: CurvedSheetPrimitive,
  options: AddCurvedSheetStratumOptions,
): CurvedSheetStratum {
  return {
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    id: safeOptionalId(diagram, options.id, 'sheet'),
    name: safeOptionalName(options.name, curvedSheetDefaultName(primitive.kind)),
    style: cloneSheetStyle(options.style ?? defaultSheetStyle),
    primitive: cloneDiagramValue(primitive),
    layer: options.layer ?? nextLayer(diagram),
  }
}

function curvedSheetDefaultName(kind: CurvedSheetCreationKind): string {
  switch (kind) {
    case 'hemisphere':
      return 'Hemisphere'
    case 'saddle':
      return 'Saddle'
  }
}

function curvedSheetPrimitiveFromCreationParameters(
  anchorPoint: Vec3,
  frame: WorkPlaneFrameSnapshot,
  parameters: CurvedSheetCreationParameters,
): CurvedSheetPrimitive {
  switch (parameters.kind) {
    case 'hemisphere':
      return {
        kind: 'hemisphere',
        center: normalizePointForAmbientDimension(3, anchorPoint),
        radius: parameters.radius,
        frame,
        hemisphereSide: parameters.hemisphereSide,
        sampling: { ...parameters.sampling },
      }
    case 'saddle':
      return {
        kind: 'saddle',
        frame,
        width: parameters.width,
        depth: parameters.depth,
        height: parameters.height,
        sampling: { ...parameters.sampling },
      }
  }
}

function cloneDiagramValue<T>(value: T): T {
  return structuredClone(value) as T
}

function safeOptionalId(
  diagram: Diagram,
  id: string | undefined,
  fallbackPrefix: string,
): string {
  const trimmedId = id?.trim()

  if (trimmedId === undefined || trimmedId.length === 0) {
    return makeUniqueId(diagram, fallbackPrefix)
  }

  const existingIds = new Set([
    ...diagram.strata.map((stratum) => stratum.id),
    ...diagram.labels.map((label) => label.id),
  ])

  return existingIds.has(trimmedId)
    ? makeUniqueId(diagram, fallbackPrefix)
    : trimmedId
}

function safeOptionalName(
  name: string | undefined,
  fallbackName: string,
): string {
  const trimmedName = name?.trim()

  return trimmedName === undefined || trimmedName.length === 0
    ? fallbackName
    : trimmedName
}

export function updateSelectedElement(
  diagram: Diagram,
  selectedElement: SelectedElement,
  updaters: SelectedElementUpdaters,
): Diagram {
  if (selectedElement === null) {
    return diagram
  }

  if (selectedElement.kind === 'stratum') {
    return updaters.stratum === undefined
      ? diagram
      : updateStratumById(diagram, selectedElement.id, updaters.stratum)
  }

  return updaters.label === undefined
    ? diagram
    : updateLabelById(diagram, selectedElement.id, updaters.label)
}

export function coordinateAxesForAmbientDimension(
  ambientDimension: AmbientDimension,
): CoordinateAxis[] {
  return ambientDimension === 2 ? ['x', 'y'] : ['x', 'y', 'z']
}

export function updateVec3Coordinate(
  point: Vec3,
  axis: CoordinateAxis,
  value: number,
  ambientDimension: AmbientDimension,
): Vec3 {
  return normalizePointForAmbientDimension(ambientDimension, {
    ...point,
    [axis]: value,
  })
}

export function parseDirectCoordinateInput(
  coordinates: DirectCoordinateInput,
  ambientDimension: AmbientDimension,
  options: DirectCoordinateParseOptions = {},
): Vec3 | null {
  if (coordinates.source !== undefined) {
    if (options.diagram === undefined) {
      return null
    }

    return resolveExistingCoordinateForDirectCreation(
      options.diagram,
      coordinates.source,
      {
        ambientDimension,
        coordinateMode: options.coordinateMode,
        workPlane: options.workPlane,
      },
    )
  }

  if (
    ambientDimension === 3 &&
    options.coordinateMode === 'workPlaneLocal'
  ) {
    return parseWorkPlaneLocalCoordinateInput(coordinates, options.workPlane)
  }

  const x = parseFiniteNumber(coordinates.x)
  const y = parseFiniteNumber(coordinates.y)
  const z = ambientDimension === 2 ? 0 : parseFiniteNumber(coordinates.z)

  if (x === null || y === null || z === null) {
    return null
  }

  return normalizePointForAmbientDimension(ambientDimension, { x, y, z })
}

export function parseDirectCoordinateInputs(
  coordinates: DirectCoordinateInput[],
  ambientDimension: AmbientDimension,
  options: DirectCoordinateParseOptions = {},
): Vec3[] | null {
  const points = coordinates.map((coordinate) =>
    parseDirectCoordinateInput(coordinate, ambientDimension, options),
  )

  return points.every((point): point is Vec3 => point !== null) ? points : null
}

export function parseDirectCoordinateRows(
  rows: string,
  ambientDimension: AmbientDimension,
  options: Pick<DirectCoordinateParseOptions, 'coordinateMode'> = {},
): DirectCoordinateInput[] | null {
  const axisCount =
    ambientDimension === 3 && options.coordinateMode === 'workPlaneLocal'
      ? 2
      : ambientDimension
  const trimmedRows = rows.trim()

  if (trimmedRows.length === 0) {
    return null
  }

  const coordinates: DirectCoordinateInput[] = []

  for (const row of trimmedRows.split(/\r?\n/u)) {
    const trimmedRow = row.trim()

    if (trimmedRow.length === 0) {
      continue
    }

    const parts = trimmedRow.split(/[\s,]+/u)

    if (parts.length !== axisCount) {
      return null
    }

    coordinates.push({
      x: parts[0],
      y: parts[1],
      z: axisCount === 2 ? '0' : parts[2],
    })
  }

  return coordinates.length === 0 ? null : coordinates
}

function parseNumericDirectCoordinateInput(
  coordinates: DirectCoordinateInput,
  ambientDimension: AmbientDimension,
  options: DirectCoordinateParseOptions = {},
): Vec3 | null {
  if (coordinates.source !== undefined) {
    return null
  }

  return parseDirectCoordinateInput(coordinates, ambientDimension, options)
}

function parseWorkPlaneLocalCoordinateInput(
  coordinates: DirectCoordinateInput,
  workPlane: WorkPlane | undefined,
): Vec3 | null {
  const a = parseFiniteNumber(coordinates.x)
  const b = parseFiniteNumber(coordinates.y)

  if (a === null || b === null || workPlane === undefined) {
    return null
  }

  const validation = validateWorkPlane(workPlane)

  if (!validation.valid) {
    return null
  }

  try {
    const point = pointOnWorkPlane(workPlane, a, b)
    return isFiniteVec3(point) ? point : null
  } catch {
    return null
  }
}

function parseWorkPlaneLocalOffsetInput(
  coordinates: DirectCoordinateInput,
): WorkPlaneLocalOffset | null {
  if (coordinates.source !== undefined) {
    return null
  }

  const dx = parseFiniteNumber(coordinates.x)
  const dy = parseFiniteNumber(coordinates.y)

  return dx === null || dy === null ? null : { dx, dy }
}

function parseDirectPolarControlInput(
  coordinates: DirectCoordinateInput,
): CubicBezierPolarControl | null {
  if (coordinates.source !== undefined) {
    return null
  }

  const angleDegrees = parseFiniteNumber(coordinates.x)
  const radius = parseFiniteNumber(coordinates.y)

  if (angleDegrees === null || radius === null) {
    return null
  }

  const control = { angleDegrees, radius }

  return isValidPolarControl(control) ? control : null
}

export function workPlaneFrameSnapshotFromWorkPlane(
  workPlane: WorkPlane | undefined,
  originOverride?: Vec3,
): WorkPlaneFrameSnapshot | null {
  if (workPlane === undefined) {
    return null
  }

  const validation = validateWorkPlane(workPlane)

  if (!validation.valid) {
    return null
  }

  try {
    const basis = workPlaneToBasis(workPlane)
    const frame: WorkPlaneFrameSnapshot = {
      origin:
        originOverride === undefined ? { ...basis.origin } : { ...originOverride },
      u: { ...basis.u },
      v: { ...basis.v },
      normal: { ...basis.normal },
    }

    return isValidWorkPlaneFrameSnapshot(frame) ? frame : null
  } catch {
    return null
  }
}

function workPlaneLocalCoordinateForPoint(
  frame: WorkPlaneFrameSnapshot,
  point: Vec3,
): WorkPlaneLocalCoordinate | null {
  const local = workPlaneLocalCoordinateFromPoint(frame, point)

  if (!Number.isFinite(local.a) || !Number.isFinite(local.b)) {
    return null
  }

  return pointsApproximatelyEqual(pointFromWorkPlaneLocalCoordinate(frame, local), point)
    ? local
    : null
}

function pointsApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  const epsilon = 1e-9

  return (
    Math.abs(first.x - second.x) <= epsilon &&
    Math.abs(first.y - second.y) <= epsilon &&
    Math.abs(first.z - second.z) <= epsilon
  )
}

export function localDirectCoordinateInputFromExistingSource(
  diagram: Diagram,
  source: ExistingCoordinateSource,
  workPlane: WorkPlane,
): DirectCoordinateInput | null {
  const point = resolveExistingCoordinateForDirectCreation(diagram, source, {
    ambientDimension: diagram.ambientDimension,
    coordinateMode: 'workPlaneLocal',
    workPlane,
  })

  if (point === null) {
    return null
  }

  try {
    const local = projectPointToWorkPlaneCoordinates(point, workPlane)

    return {
      x: String(local.a),
      y: String(local.b),
      z: '0',
      source,
    }
  } catch {
    return null
  }
}

function directCoordinateParseOptionsForDiagram(
  diagram: Diagram,
  options: DirectCoordinateParseOptions,
): DirectCoordinateParseOptions {
  return {
    ...options,
    diagram,
  }
}

export function normalizeDirectLabelText(text: string): string {
  const trimmedText = text.trim()

  return trimmedText.length === 0 ? 'Label' : text
}

export function parseDirectLayerInput(rawValue: string): number | null {
  return parseFiniteNumber(rawValue)
}

export function parseFiniteNumber(rawValue: string): number | null {
  if (rawValue.trim() === '') {
    return null
  }

  const value = Number(rawValue)
  return Number.isFinite(value) ? value : null
}

export function parseOpacity(rawValue: string): number | null {
  const value = parseFiniteNumber(rawValue)

  if (value === null || value < 0 || value > 1) {
    return null
  }

  return value
}

export function parsePositiveFiniteNumber(rawValue: string): number | null {
  const value = parseFiniteNumber(rawValue)

  if (value === null || value <= 0) {
    return null
  }

  return value
}
