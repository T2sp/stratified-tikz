import type {
  ClosedPathBoundary,
  ConcatenatedPathStratum,
  CubicBezierCurveStratum,
  CubicBezierControlMode,
  Camera3D,
  CurveStyle,
  CurveStratum,
  Diagram,
  ExternalTikzStyleSource,
  FilledRegion2DStratum,
  HexColor,
  ImportedTikzStyleReference,
  LabelStyle,
  LineStyle,
  PointShape,
  PointStratum,
  PointStyle,
  RegionStyle,
  SheetStyle,
  SheetStratum,
  TextLabel,
  OrthographicCamera3D,
  PathSegment,
  PathTemplate,
  StylePresetKind,
  UserStylePreset,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinate,
  WorkPlaneLocalOffset,
} from '../model/types'
import { sheetVertices } from '../model/sheets.ts'
import {
  arcSegmentToCubicBezierSegments,
  pathSegmentStyleRuns,
  templatePathCoordinates,
  templatePathFrame,
  type PathSegmentStyleRun,
} from '../model/paths.ts'
import { sampleCurvedSheetPrimitive } from '../geometry/curvedSheets.ts'
import {
  createInitialCamera3D,
  isOrthographicCamera3D,
} from '../model/camera.ts'
import { stylePresetStylesEqual } from '../model/stylePresets.ts'
import { normalizeSingleLineCommentText } from '../model/importedTikzStyles.ts'
import {
  absoluteCubicBezierPointsFromControlMode,
  isFiniteVec3,
  isValidWorkPlaneFrameSnapshot,
  pointFromWorkPlaneLocalCoordinate,
  workPlaneLocalCoordinateFromPoint,
} from '../geometry/bezierControls.ts'

const defaultLabelStyleValues: LabelStyle = {
  kind: 'labelStyle',
  color: '#000000',
  opacity: 1,
  fontSize: 10,
  anchor: 'center',
}

type TikzMode = '2d' | '3d'

type ColorDefinition = {
  name: string
  hex: HexColor
}

type CoordinateDefinition = {
  name: string
  position: Vec3
}

type LayeredTikzCommand = {
  layer: number
  sectionTitle: string
  lines: string[]
}

type PointCurveStratum = Exclude<
  CurveStratum,
  ConcatenatedPathStratum | Extract<CurveStratum, { kind: 'templatePath' }>
>

type PathSegmentCoordinateNames =
  | {
      kind: 'line'
      start: string
      end: string
    }
  | {
      kind: 'cubicBezier'
      start: string
      control1: string
      control2: string
      end: string
    }
  | {
      kind: 'arc'
      start: string
      end: string
      radius: number
      startAngleDeg: number
      endAngleDeg: number
      direction: 'counterclockwise' | 'clockwise'
    }
  | {
      kind: 'arcCubicApproximation'
      start: string
      end: string
      cubics: Array<{
        control1: string
        control2: string
        end: string
      }>
    }

export type GenerateTikzOptions = {
  includeCoordinateAxes?: boolean
  camera3d?: Camera3D
}

type GenerateContext = {
  mode: TikzMode
  camera3d?: OrthographicCamera3D
  colors: ColorRegistry
  coordinates: CoordinateRegistry
  userStylePresets: Map<string, UserStylePreset>
  localStyles: LocalStyleRegistry
  externalTikzStyleSources: Map<string, ExternalTikzStyleSource>
  importedTikzStyleReferences: Map<string, ImportedTikzStyleReference>
  externalTikzStyleUsage: ExternalTikzStyleUsageRegistry
  hasSavedPaths: boolean
  requiresTikz3dLibrary: boolean
  includeCoordinateAxes: boolean
}

const coordinateAxesGuideLayerName = 'stratifiedGuideLayer'
const coordinateAxesGuideColor: HexColor = '#64748B'
const coordinateAxesGuideLength = 2.5
const coordinateAxesGuideLabelOffset = 0.25
export const maxCurvedSheetTikzFaces = 256

export function generateTikz(
  diagram: Diagram,
  options: GenerateTikzOptions = {},
): string {
  return diagram.ambientDimension === 2
    ? generateTikz2D(diagram, options)
    : generateTikz3D(diagram, options)
}

export function generateTikz2D(
  diagram: Diagram,
  options: GenerateTikzOptions = {},
): string {
  const context = createContext(
    '2d',
    options,
    diagram.userStylePresets,
    diagram.externalTikzStyleSources,
    diagram.importedTikzStyleReferences,
  )
  const regionSectionTitle = 'Codimension 0 strata: regions'
  const curveSectionTitle = 'Codimension 1 strata: curves'
  const pointSectionTitle = 'Codimension 2 strata: points'
  const labelSectionTitle = 'Labels'
  const sectionTitles = [
    regionSectionTitle,
    curveSectionTitle,
    pointSectionTitle,
    labelSectionTitle,
  ]
  const drawingCommands = [
    ...emitLayeredItems(
      regionSectionTitle,
      diagram.strata.filter(
        (stratum): stratum is FilledRegion2DStratum =>
          stratum.geometricKind === 'region' &&
          stratum.codim === 0 &&
          stratum.kind === 'filledRegion' &&
          stratum.visible,
      ),
      (region, index) => emitFilledRegion(region, index, context),
    ),
    ...emitLayeredItems(
      curveSectionTitle,
      diagram.strata.filter(
        (stratum): stratum is CurveStratum =>
          stratum.geometricKind === 'curve' && stratum.codim === 1,
      ),
      (curve, index) => emitCurve(curve, index, context),
    ),
    ...emitLayeredItems(
      pointSectionTitle,
      diagram.strata.filter(
        (stratum): stratum is PointStratum =>
          stratum.geometricKind === 'point' && stratum.codim === 2,
      ),
      (point, index) => emitPoint(point, index, context),
    ),
    ...emitLayeredItems(labelSectionTitle, diagram.labels, (label) =>
      emitLabel(label, context),
    ),
  ]
  const layers = collectUsedLayers(drawingCommands)

  return assembleTikz({
    context,
    layers,
    bodySections: [
      section('Coordinates', emitCoordinateDefinitions(context)),
      section(
        'Layered drawing commands',
        emitLayeredCommands(drawingCommands, sectionTitles),
      ),
    ],
  })
}

export function generateTikz3D(
  diagram: Diagram,
  options: GenerateTikzOptions = {},
): string {
  const context = createContext(
    '3d',
    options,
    diagram.userStylePresets,
    diagram.externalTikzStyleSources,
    diagram.importedTikzStyleReferences,
    resolveTikzCamera3D(diagram, options),
  )
  const sheetSectionTitle = 'Codimension 1 strata: sheets'
  const curveSectionTitle = 'Codimension 2 strata: curves'
  const pointSectionTitle = 'Codimension 3 strata: points'
  const labelSectionTitle = 'Labels'
  const sectionTitles = [
    sheetSectionTitle,
    curveSectionTitle,
    pointSectionTitle,
    labelSectionTitle,
  ]
  const drawingCommands = [
    ...emitLayeredItems(
      sheetSectionTitle,
      diagram.strata.filter(
        (stratum): stratum is SheetStratum =>
          stratum.geometricKind === 'sheet' && stratum.codim === 1,
      ),
      (sheet, index) => emitSheet(sheet, index, context),
    ),
    ...emitLayeredItems(
      curveSectionTitle,
      diagram.strata.filter(
        (stratum): stratum is CurveStratum =>
          stratum.geometricKind === 'curve' && stratum.codim === 2,
      ),
      (curve, index) => emitCurve(curve, index, context),
    ),
    ...emitLayeredItems(
      pointSectionTitle,
      diagram.strata.filter(
        (stratum): stratum is PointStratum =>
          stratum.geometricKind === 'point' && stratum.codim === 3,
      ),
      (point, index) => emitPoint(point, index, context),
    ),
    ...emitLayeredItems(labelSectionTitle, diagram.labels, (label) =>
      emitLabel(label, context),
    ),
  ]
  const coordinateAxesGuide = emitCoordinateAxesGuide(context)
  const layers = collectUsedLayers(drawingCommands)

  return assembleTikz({
    context,
    layers,
    bodySections: [
      section('Coordinates', emitCoordinateDefinitions(context)),
      ...(coordinateAxesGuide.length === 0
        ? []
        : [section('Coordinate axes guide', coordinateAxesGuide)]),
      section(
        'Layered drawing commands',
        emitLayeredCommands(drawingCommands, sectionTitles),
      ),
    ],
  })
}

export function lineStyleToTikzOption(lineStyle: LineStyle): string | null {
  switch (lineStyle) {
    case 'solid':
      return null
    case 'dashed':
      return 'dashed'
    case 'dotted':
      return 'dotted'
    case 'denselyDotted':
      return 'densely dotted'
  }
}

export function sanitizeTikzNameStem(name: string, fallback: string): string {
  const fallbackStem = sanitizeTikzNameStemPart(fallback) || 'coord'
  const stem = sanitizeTikzNameStemPart(name)
  const safeStem = stem.length === 0 ? fallbackStem : stem

  return /^[a-zA-Z]/.test(safeStem) ? safeStem : `${fallbackStem}${safeStem}`
}

export function sanitizeTikzSpathSaveName(pathLabel: string): string {
  return sanitizeTikzNameStem(pathLabel, 'savedPath')
}

export function layerToTikzLayerName(layer: number): string {
  const normalizedLayer = normalizeLayer(layer)
  const suffix = String(normalizedLayer)
    .replaceAll('-', 'Minus')
    .replaceAll('.', 'Point')
    .replaceAll('+', '')
    .replaceAll('e', 'E')

  return `stratifiedLayer${suffix}`
}

function createContext(
  mode: TikzMode,
  options: GenerateTikzOptions,
  userStylePresets: readonly UserStylePreset[] | undefined,
  externalTikzStyleSources: readonly ExternalTikzStyleSource[] | undefined,
  importedTikzStyleReferences: readonly ImportedTikzStyleReference[] | undefined,
  camera3d?: OrthographicCamera3D,
): GenerateContext {
  return {
    mode,
    ...(mode === '3d' && camera3d !== undefined ? { camera3d } : {}),
    colors: new ColorRegistry(),
    coordinates: new CoordinateRegistry(),
    userStylePresets: new Map(
      (userStylePresets ?? []).map((preset) => [preset.id, preset]),
    ),
    localStyles: new LocalStyleRegistry(),
    externalTikzStyleSources: new Map(
      (externalTikzStyleSources ?? []).map((source) => [source.id, source]),
    ),
    importedTikzStyleReferences: new Map(
      (importedTikzStyleReferences ?? []).map((reference) => [
        reference.id,
        reference,
      ]),
    ),
    externalTikzStyleUsage: new ExternalTikzStyleUsageRegistry(),
    hasSavedPaths: false,
    requiresTikz3dLibrary: false,
    includeCoordinateAxes:
      mode === '3d' && options.includeCoordinateAxes === true,
  }
}

function resolveTikzCamera3D(
  diagram: Diagram,
  options: GenerateTikzOptions,
): OrthographicCamera3D {
  if (options.camera3d !== undefined) {
    return supportedTikzCamera3D(options.camera3d)
  }

  if (diagram.view?.camera3d !== undefined) {
    return supportedTikzCamera3D(diagram.view.camera3d)
  }

  if (diagram.camera.mode === '3d') {
    return supportedTikzCamera3D(diagram.camera)
  }

  return createInitialCamera3D()
}

function supportedTikzCamera3D(camera: Camera3D): OrthographicCamera3D {
  if (isOrthographicCamera3D(camera)) {
    return camera
  }

  throw new Error(
    'Perspective TikZ export is not supported; 3D TikZ export uses tikz-3dplot orthographic theta/phi.',
  )
}

function assembleTikz({
  context,
  layers,
  bodySections,
}: {
  context: GenerateContext
  layers: number[]
  bodySections: string[][]
}): string {
  const lines = [
    ...section('Styles and colors', [
      ...emitRequiredLibraryComment(context),
      ...emitExternalTikzStyleLoadComment(context),
      ...context.colors.emitDefinitions(),
      ...emitTikzLayerDeclarations(layers, context.includeCoordinateAxes),
      ...emitTikzCameraSetup(context),
      ...emitTikzPictureStart(context),
    ]),
    ...bodySections.flat(),
    '\\end{tikzpicture}',
  ]

  return `${lines.join('\n')}\n`
}

function emitTikzPictureStart(context: GenerateContext): string[] {
  const baseOptions =
    context.mode === '2d'
      ? ['line cap=round', 'line join=round']
      : ['tdplot_main_coords', 'line cap=round', 'line join=round']
  const options = [...baseOptions, ...context.localStyles.emitDefinitions()]

  if (context.mode === '2d') {
    return ['\\begin{tikzpicture}[', ...formatTikzOptions(options), ']']
  }

  return ['\\begin{tikzpicture}[', ...formatTikzOptions(options), ']']
}

function emitTikzCameraSetup(context: GenerateContext): string[] {
  if (context.mode !== '3d' || context.camera3d === undefined) {
    return []
  }

  return [
    `\\tdplotsetmaincoords{${formatNumber(
      context.camera3d.thetaDeg,
    )}}{${formatNumber(context.camera3d.phiDeg)}}`,
    '',
  ]
}

function emitRequiredLibraryComment(context: GenerateContext): string[] {
  const lines: string[] = []

  if (context.mode === '3d' && context.camera3d !== undefined) {
    lines.push('% Requires \\usepackage{tikz-3dplot}', '')
  }

  if (context.coordinates.hasNonCircularPointShape) {
    lines.push(
      '% Required TikZ libraries for non-circular point shapes:',
      '% \\usetikzlibrary{shapes.geometric,shapes.symbols}',
      '',
    )
  }

  if (context.hasSavedPaths) {
    lines.push(
      '% Required TikZ libraries for saved paths:',
      '% \\usetikzlibrary{spath3}',
      '',
    )
  }

  if (context.requiresTikz3dLibrary) {
    lines.push('\\usetikzlibrary{3d}', '')
  }

  return lines
}

function emitExternalTikzStyleLoadComment(context: GenerateContext): string[] {
  const sources = context.externalTikzStyleUsage.usedSources()

  if (sources.length === 0) {
    return []
  }

  return [
    '% External TikZ styles referenced below.',
    '% Load these files in your LaTeX preamble or before the picture:',
    ...sources.map((source) => `% - ${commentLineText(source.name)}`),
    '% Suggested:',
    ...sources.map((source) => `%   ${commentLineText(source.loadHint)}`),
    '',
  ]
}

function commentLineText(value: string): string {
  return normalizeSingleLineCommentText(value, 'external TikZ style source')
}

function emitTikzLayerDeclarations(
  layers: number[],
  includeCoordinateAxesGuideLayer: boolean,
): string[] {
  if (layers.length === 0 && !includeCoordinateAxesGuideLayer) {
    return []
  }

  const layerNames = [
    ...(includeCoordinateAxesGuideLayer ? [coordinateAxesGuideLayerName] : []),
    ...layers.map(layerToTikzLayerName),
  ]

  return [
    ...layerNames.map((layerName) => `\\pgfdeclarelayer{${layerName}}`),
    `\\pgfsetlayers{${[...layerNames, 'main'].join(',')}}`,
    '',
  ]
}

function emitCoordinateDefinitions(context: GenerateContext): string[] {
  return context.coordinates.definitions.map(
    (definition) =>
      `\\coordinate (${definition.name}) at ${formatCoordinate(
        definition.position,
        context.mode,
      )};`,
  )
}

function emitCoordinateAxesGuide(context: GenerateContext): string[] {
  if (!context.includeCoordinateAxes || context.mode !== '3d') {
    return []
  }

  const axisColor = context.colors.define(
    'CoordinateAxesGuide',
    coordinateAxesGuideColor,
  )
  const axisDefinitions = [
    {
      label: 'x',
      end: { x: coordinateAxesGuideLength, y: 0, z: 0 },
      labelPosition: {
        x: coordinateAxesGuideLength + coordinateAxesGuideLabelOffset,
        y: 0,
        z: 0,
      },
    },
    {
      label: 'y',
      end: { x: 0, y: coordinateAxesGuideLength, z: 0 },
      labelPosition: {
        x: 0,
        y: coordinateAxesGuideLength + coordinateAxesGuideLabelOffset,
        z: 0,
      },
    },
    {
      label: 'z',
      end: { x: 0, y: 0, z: coordinateAxesGuideLength },
      labelPosition: {
        x: 0,
        y: 0,
        z: coordinateAxesGuideLength + coordinateAxesGuideLabelOffset,
      },
    },
  ] satisfies Array<{
    label: 'x' | 'y' | 'z'
    end: Vec3
    labelPosition: Vec3
  }>

  return [
    '% Optional 3D coordinate axes guide. This is not a stratum.',
    `\\begin{pgfonlayer}{${coordinateAxesGuideLayerName}}`,
    ...indentLines(
      axisDefinitions.flatMap((axis) =>
        emitCoordinateAxisGuide(axis.label, axis.end, axis.labelPosition, axisColor),
      ),
    ),
    '\\end{pgfonlayer}',
  ]
}

function emitCoordinateAxisGuide(
  label: 'x' | 'y' | 'z',
  end: Vec3,
  labelPosition: Vec3,
  axisColor: string,
): string[] {
  return [
    '\\draw[',
    ...formatTikzOptions([
      `draw=${axisColor}`,
      'draw opacity=0.35',
      'line width=0.4pt',
      '->',
    ]),
    ']',
    `  ${formatCoordinate({ x: 0, y: 0, z: 0 }, '3d')} -- ${formatCoordinate(
      end,
      '3d',
    )};`,
    '\\node[',
    ...formatTikzOptions([
      `text=${axisColor}`,
      'opacity=0.55',
      'font=\\scriptsize',
    ]),
    `] at ${formatCoordinate(labelPosition, '3d')} {$${label}$};`,
    '',
  ]
}

function emitSheet(
  sheet: SheetStratum,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  if (sheet.kind === 'workPlaneFilledSheet') {
    return emitWorkPlaneFilledSheet(sheet, elementIndex, context)
  }

  if (sheet.kind === 'curvedSheet') {
    return emitCurvedSheet(sheet, elementIndex, context)
  }

  if (!sheetVertices(sheet).every(isFiniteVec3)) {
    return [
      `% Sheet "${sheet.name}" [${sheet.id}] omitted because its vertices contain non-finite coordinates.`,
      '',
    ]
  }

  const coordinates = sheetVertices(sheet).map((vertex, index) =>
    context.coordinates.define(
      sheetCoordinateBaseName(sheet, elementIndex),
      index,
      vertex,
    ),
  )
  const options = [
    ...filledSurfaceStyleOptionsForElement(
      'sheet',
      sheet.stylePresetId,
      sheet.importedTikzStyleReferenceId,
      sheet.style,
      `Sheet${sheet.id}`,
      context,
    ),
    ...spathSaveOptions(
      sheet.kind === 'polygonSheet' ? sheet.pathLabel : undefined,
      context,
    ),
  ]

  return [
    `% Filled sheet "${sheet.name}" [${sheet.id}] from stored ${sheet.kind === 'quadSheet' ? 'quad' : 'polygon'} vertices.`,
    `\\path[`,
    ...formatTikzOptions(options),
    `]`,
    `  ${coordinates.map((name) => `(${name})`).join(' -- ')} -- cycle;`,
    '',
  ]
}

function emitCurvedSheet(
  sheet: Extract<SheetStratum, { kind: 'curvedSheet' }>,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  let mesh: ReturnType<typeof sampleCurvedSheetPrimitive>

  try {
    mesh = sampleCurvedSheetPrimitive(sheet.primitive)
  } catch (error) {
    return [
      `% Curved sheet "${sheet.name}" [${sheet.id}] omitted because sampled mesh generation failed.`,
      `% ${error instanceof Error ? error.message : 'Unknown curved sheet sampling error.'}`,
      '',
    ]
  }

  if (!mesh.vertices.every(isFiniteVec3)) {
    return [
      `% Curved sheet "${sheet.name}" [${sheet.id}] omitted because its sampled mesh contains non-finite coordinates.`,
      '',
    ]
  }

  if (mesh.faces.length > maxCurvedSheetTikzFaces) {
    return [
      `% Curved sheet "${sheet.name}" [${sheet.id}] omitted because its sampled mesh has ${mesh.faces.length} faces.`,
      `% Reduce sampling to at most ${maxCurvedSheetTikzFaces} faces for readable TikZ export.`,
      '',
    ]
  }

  const coordinateBaseName = sheetCoordinateBaseName(sheet, elementIndex)
  const coordinates = mesh.vertices.map((vertex, index) =>
    context.coordinates.define(coordinateBaseName, index, vertex),
  )
  const options = filledSurfaceStyleOptionsForElement(
    'sheet',
    sheet.stylePresetId,
    sheet.importedTikzStyleReferenceId,
    sheet.style,
    `Sheet${sheet.id}`,
    context,
  )
  const faceLines = mesh.faces.map(
    (face) =>
      `  \\filldraw ${face.map((vertexIndex) => `(${coordinates[vertexIndex]})`).join(' -- ')} -- cycle;`,
  )

  return [
    `% Curved sheet "${sheet.name}" [${sheet.id}] sampled mesh export.`,
    `% Primitive: ${sheet.primitive.kind}; sampling: u=${mesh.uSegments}, v=${mesh.vSegments}; faces=${mesh.faces.length}.`,
    '% Each sampled face is emitted as one filled polygon; hidden-surface sorting is not applied.',
    '\\begin{scope}[',
    ...formatTikzOptions(options),
    ']',
    ...faceLines,
    '\\end{scope}',
    '',
  ]
}

function emitFilledRegion(
  region: FilledRegion2DStratum,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  if (!closedBoundariesHaveFiniteCoordinates(region.boundaries)) {
    return [
      `% Filled region "${region.name}" [${region.id}] omitted because its boundary contains non-finite coordinates.`,
      '',
    ]
  }

  const coordinates = defineClosedBoundariesCoordinateNames(
    region.boundaries,
    filledRegionCoordinateBaseName(region, elementIndex),
    context,
  )
  const options = [
    ...filledSurfaceStyleOptionsForElement(
      'region',
      region.stylePresetId,
      region.importedTikzStyleReferenceId,
      region.style,
      `Region${region.id}`,
      context,
    ),
    ...fillRuleTikzOptions(region.fillRule),
  ]

  return [
    `% Filled region "${region.name}" [${region.id}] from ${region.boundaries.length} closed boundary path${region.boundaries.length === 1 ? '' : 's'}.`,
    `% Fill rule: ${region.fillRule}.`,
    ...emitFillDrawClosedBoundaries(coordinates, options),
  ]
}

function emitWorkPlaneFilledSheet(
  sheet: Extract<SheetStratum, { kind: 'workPlaneFilledSheet' }>,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  if (!closedBoundariesHaveFiniteCoordinates(sheet.boundaries)) {
    return [
      `% Work-plane filled sheet "${sheet.name}" [${sheet.id}] omitted because its boundary contains non-finite coordinates.`,
      '',
    ]
  }

  const options = [
    ...filledSurfaceStyleOptionsForElement(
      'sheet',
      sheet.stylePresetId,
      sheet.importedTikzStyleReferenceId,
      sheet.style,
      `Sheet${sheet.id}`,
      context,
    ),
    ...fillRuleTikzOptions(sheet.fillRule),
  ]
  const scopedPath = formatWorkPlaneFilledSheetLocalPath(sheet)

  if (scopedPath !== null) {
    context.requiresTikz3dLibrary = true

    return [
      `% Work-plane filled sheet "${sheet.name}" [${sheet.id}] from ${sheet.boundaries.length} closed boundary path${sheet.boundaries.length === 1 ? '' : 's'}.`,
      `% Fill rule: ${sheet.fillRule}; exported in a local TikZ 3d plane scope.`,
      '\\begin{scope}[',
      `  plane origin={${formatCoordinate(sheet.planeFrame.origin, '3d')}},`,
      `  plane x={${formatCoordinate(
        addVec3(sheet.planeFrame.origin, sheet.planeFrame.u),
        '3d',
      )}},`,
      `  plane y={${formatCoordinate(
        addVec3(sheet.planeFrame.origin, sheet.planeFrame.v),
        '3d',
      )}},`,
      '  canvas is plane',
      ']',
      '  \\filldraw[',
      ...formatTikzOptions(options).map((line) => `  ${line}`),
      '  ]',
      ...formatClosedBoundaryPathLines(scopedPath).map((line) => `  ${line}`),
      '\\end{scope}',
      '',
    ]
  }

  const coordinates = defineClosedBoundariesCoordinateNames(
    sheet.boundaries,
    sheetCoordinateBaseName(sheet, elementIndex),
    context,
  )

  return [
    `% Work-plane filled sheet "${sheet.name}" [${sheet.id}] uses absolute 3D coordinates because its local plane scope could not be used.`,
    `% Fill rule: ${sheet.fillRule}.`,
    ...emitFillDrawClosedBoundaries(coordinates, options),
  ]
}

function filledRegionCoordinateBaseName(
  region: FilledRegion2DStratum,
  elementIndex: number,
): string {
  return `regionFilled${sanitizeTikzNameStem(region.name, 'region')}${elementIndex}`
}

function sheetCoordinateBaseName(
  sheet: SheetStratum,
  elementIndex: number,
): string {
  const stem = sanitizeTikzNameStem(sheet.name, 'sheet')

  switch (sheet.kind) {
    case 'polygonSheet':
      return `sheetPoly${stem}${elementIndex}`
    case 'quadSheet':
      return `sheetQuad${stem}${elementIndex}`
    case 'workPlaneFilledSheet':
      return `sheetFilled${stem}${elementIndex}`
    case 'curvedSheet':
      return `sheetCurved${stem}${elementIndex}`
  }
}

function emitCurve(
  curve: CurveStratum,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  if (!curveHasFiniteCoordinates(curve)) {
    return [
      `% Curve "${curve.name}" [${curve.id}] omitted because its path contains non-finite coordinates.`,
      '',
    ]
  }

  if (curve.kind === 'templatePath') {
    return emitTemplatePath(curve, elementIndex, context)
  }

  if (curve.kind === 'concatenatedPath') {
    const coordinates = defineConcatenatedPathCoordinates(
      curve,
      elementIndex,
      context,
    )
    const styleRuns = pathSegmentStyleRuns(curve.segments, curve.style)

    if (styleRuns.length > 1) {
      return emitMixedStyleConcatenatedPath(
        curve,
        coordinates,
        styleRuns,
        context,
      )
    }
    const continuousStyle = styleRuns[0]?.style ?? curve.style
    const continuousOptions = [
      ...curveStyleOptionsForElement(
        curve.stylePresetId,
        curve.importedTikzStyleReferenceId,
        continuousStyle,
        `Curve${curve.id}`,
        context,
      ),
      ...spathSaveOptions(curve.pathLabel, context),
    ]

    return [
      '\\draw[',
      ...formatTikzOptions(continuousOptions),
      ']',
      `  ${formatConcatenatedPath(coordinates)};`,
      '',
    ]
  }

  const options = [
    ...curveStyleOptionsForElement(
      curve.stylePresetId,
      curve.importedTikzStyleReferenceId,
      curve.style,
      `Curve${curve.id}`,
      context,
    ),
    ...spathSaveOptions(curve.pathLabel, context),
  ]
  const scopedCurve = emitScopedWorkPlaneRelativeBezierCurve(
    curve,
    options,
    context,
  )

  if (scopedCurve !== null) {
    return scopedCurve
  }

  const coordinates = defineCurveCoordinates(curve, elementIndex, context)

  return [
    '\\draw[',
    ...formatTikzOptions(options),
    ']',
    `  ${formatCurvePath(curve, coordinates, context.mode)};`,
    '',
  ]
}

function emitMixedStyleConcatenatedPath(
  curve: ConcatenatedPathStratum,
  coordinates: PathSegmentCoordinateNames[],
  styleRuns: PathSegmentStyleRun[],
  context: GenerateContext,
): string[] {
  const savedPath = emitSavedConcatenatedPath(curve.pathLabel, coordinates, context)
  const drawCommands = styleRuns.flatMap((run) =>
    emitConcatenatedPathStyleRun(curve, coordinates, run, context),
  )

  return [
    ...savedPath,
    '% Segment style overrides split this concatenated path by resolved style.',
    ...drawCommands,
  ]
}

function emitTemplatePath(
  curve: Extract<CurveStratum, { kind: 'templatePath' }>,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  const options = [
    ...curveStyleOptionsForElement(
      curve.stylePresetId,
      curve.importedTikzStyleReferenceId,
      curve.style,
      `Curve${curve.id}`,
      context,
    ),
    ...spathSaveOptions(curve.pathLabel, context),
  ]

  if (context.mode === '3d') {
    return emitTemplatePath3D(curve, options, context)
  }

  const center = context.coordinates.define(
    curveCoordinateBaseName(curve, elementIndex),
    0,
    curve.template.center,
  )
  const drawCommand = formatTemplatePathCommand(
    curve.template,
    `(${center})`,
  )

  if (drawCommand === null) {
    return [
      `% Template path "${curve.name}" [${curve.id}] omitted because its template data is invalid.`,
      '',
    ]
  }

  if (
    curve.template.kind === 'ellipseTemplate' &&
    (curve.template.rotationDeg ?? 0) !== 0
  ) {
    return [
      `\\begin{scope}[rotate around={${formatNumber(
        curve.template.rotationDeg ?? 0,
      )}:(${center})}]`,
      '\\draw[',
      ...formatTikzOptions(options),
      ']',
      `  ${drawCommand};`,
      '\\end{scope}',
      '',
    ]
  }

  return [
    '\\draw[',
    ...formatTikzOptions(options),
    ']',
    `  ${drawCommand};`,
    '',
  ]
}

function emitTemplatePath3D(
  curve: Extract<CurveStratum, { kind: 'templatePath' }>,
  options: string[],
  context: GenerateContext,
): string[] {
  if (curve.template.frame === undefined) {
    return [
      `% Template path "${curve.name}" [${curve.id}] omitted because 3D templates require a stored frame.`,
      '',
    ]
  }

  const frame = templatePathFrame(curve.template)
  const localCenter = workPlaneLocalCoordinateFromPoint(frame, curve.template.center)
  const drawCommand = formatTemplatePathCommand(
    curve.template,
    `(${formatNumber(localCenter.a)},${formatNumber(localCenter.b)})`,
  )

  if (drawCommand === null) {
    return [
      `% Template path "${curve.name}" [${curve.id}] omitted because its template data is invalid.`,
      '',
    ]
  }

  context.requiresTikz3dLibrary = true

  const drawLines =
    curve.template.kind === 'ellipseTemplate' &&
    (curve.template.rotationDeg ?? 0) !== 0
      ? [
          `  \\begin{scope}[rotate around={${formatNumber(
            curve.template.rotationDeg ?? 0,
          )}:(${formatNumber(localCenter.a)},${formatNumber(localCenter.b)})}]`,
          '    \\draw[',
          ...formatTikzOptions(options).map((line) => `    ${line}`),
          '    ]',
          `      ${drawCommand};`,
          '  \\end{scope}',
        ]
      : [
          '  \\draw[',
          ...formatTikzOptions(options).map((line) => `  ${line}`),
          '  ]',
          `    ${drawCommand};`,
        ]

  return [
    `% Template path "${curve.name}" [${curve.id}] exported in a local TikZ 3d plane scope.`,
    '\\begin{scope}[',
    `  plane origin={${formatCoordinate(frame.origin, '3d')}},`,
    `  plane x={${formatCoordinate(addVec3(frame.origin, frame.u), '3d')}},`,
    `  plane y={${formatCoordinate(addVec3(frame.origin, frame.v), '3d')}},`,
    '  canvas is plane',
    ']',
    ...drawLines,
    '\\end{scope}',
    '',
  ]
}

function formatTemplatePathCommand(
  template: PathTemplate,
  center: string,
): string | null {
  switch (template.kind) {
    case 'circleTemplate':
      return Number.isFinite(template.radius) && template.radius > 0
        ? `${center} circle[radius=${formatNumber(template.radius)}]`
        : null
    case 'ellipseTemplate':
      return Number.isFinite(template.radiusX) &&
        Number.isFinite(template.radiusY) &&
        template.radiusX > 0 &&
        template.radiusY > 0
        ? `${center} ellipse[x radius=${formatNumber(
            template.radiusX,
          )}, y radius=${formatNumber(template.radiusY)}]`
        : null
  }
}

function emitSavedConcatenatedPath(
  pathLabel: string | undefined,
  coordinates: PathSegmentCoordinateNames[],
  context: GenerateContext,
): string[] {
  const options = spathSaveOptions(pathLabel, context)

  if (options.length === 0) {
    return []
  }

  return [
    '% Saved full concatenated path for spath operations.',
    '\\path[',
    ...formatTikzOptions(options),
    ']',
    `  ${formatConcatenatedPath(coordinates)};`,
    '',
  ]
}

function emitConcatenatedPathStyleRun(
  curve: ConcatenatedPathStratum,
  coordinates: PathSegmentCoordinateNames[],
  run: PathSegmentStyleRun,
  context: GenerateContext,
): string[] {
  const runCoordinates = coordinates.slice(
    run.startIndex,
    run.startIndex + run.segments.length,
  )
  const options = curveStyleOptionsForElement(
    curve.stylePresetId,
    curve.importedTikzStyleReferenceId,
    run.style,
    `Curve${curve.id}Segment${run.startIndex + 1}`,
    context,
  )

  return [
    `% Segment${run.segments.length === 1 ? '' : 's'} ${formatSegmentRunNumberRange(
      run,
    )}`,
    '\\draw[',
    ...formatTikzOptions(options),
    ']',
    `  ${formatConcatenatedPath(runCoordinates)};`,
    '',
  ]
}

function formatSegmentRunNumberRange(run: PathSegmentStyleRun): string {
  const first = run.startIndex + 1
  const last = run.startIndex + run.segments.length

  return first === last ? String(first) : `${first}-${last}`
}

function emitScopedWorkPlaneRelativeBezierCurve(
  curve: CurveStratum,
  options: string[],
  context: GenerateContext,
): string[] | null {
  const scopedPath = formatScopedWorkPlaneRelativeBezierPath(curve, context.mode)

  if (scopedPath === null) {
    return null
  }

  context.requiresTikz3dLibrary = true

  return [
    '\\begin{scope}[',
    `  plane origin={${formatCoordinate(scopedPath.frame.origin, '3d')}},`,
    `  plane x={${formatCoordinate(
      addVec3(scopedPath.frame.origin, scopedPath.frame.u),
      '3d',
    )}},`,
    `  plane y={${formatCoordinate(
      addVec3(scopedPath.frame.origin, scopedPath.frame.v),
      '3d',
    )}},`,
    '  canvas is plane',
    ']',
    '  \\draw[',
    ...formatTikzOptions(options).map((line) => `  ${line}`),
    '  ]',
    `    ${scopedPath.path};`,
    '\\end{scope}',
    '',
  ]
}

function curveCoordinateBaseName(
  curve: CurveStratum,
  elementIndex: number,
): string {
  const stem = sanitizeTikzNameStem(curve.name, 'curve')

  switch (curve.kind) {
    case 'cubicBezier':
      return `curveBezier${stem}${elementIndex}`
    case 'concatenatedPath':
      return `curvePath${stem}${elementIndex}`
    case 'templatePath':
      return `curveTemplate${stem}${elementIndex}`
    case 'polyline':
      return `curvePoly${stem}${elementIndex}`
  }
}

function emitPoint(
  point: PointStratum,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  if (!isFiniteVec3(point.position)) {
    return [
      `% Point "${point.name}" [${point.id}] omitted because its position contains non-finite coordinates.`,
      '',
    ]
  }

  const coordinate = context.coordinates.define(
    pointCoordinateBaseName(point, elementIndex),
    0,
    point.position,
  )
  const options = pointStyleOptionsForElement(
    point.stylePresetId,
    point.importedTikzStyleReferenceId,
    point.style,
    `Point${point.id}`,
    context,
  )

  return [
    '\\node[',
    ...formatTikzOptions(options),
    `] at (${coordinate}) {};`,
    '',
  ]
}

function pointCoordinateBaseName(
  point: PointStratum,
  elementIndex: number,
): string {
  return `point${sanitizeTikzNameStem(point.name, 'point')}${elementIndex}`
}

function emitLabel(label: TextLabel, context: GenerateContext): string[] {
  if (!isFiniteVec3(label.position)) {
    return [
      `% Label "${label.name}" [${label.id}] omitted because its position contains non-finite coordinates.`,
      '',
    ]
  }

  const options = labelStyleOptions(label, context)
  const coordinate = formatCoordinate(label.position, context.mode)

  if (options.length === 0) {
    return [`\\node at ${coordinate} {${label.text}};`, '']
  }

  return [
    '\\node[',
    ...formatTikzOptions(options),
    `] at ${coordinate} {${label.text}};`,
    '',
  ]
}

function emitLayeredItems<T extends { layer: number }>(
  sectionTitle: string,
  items: T[],
  emit: (item: T, index: number) => string[],
): LayeredTikzCommand[] {
  return sortByLayer(items).map(({ item }, index) => ({
    layer: normalizeLayer(item.layer),
    sectionTitle,
    lines: emit(item, index),
  }))
}

function collectUsedLayers(commands: LayeredTikzCommand[]): number[] {
  return [...new Set(commands.map((command) => command.layer))].sort(
    (first, second) => first - second,
  )
}

function emitLayeredCommands(
  commands: LayeredTikzCommand[],
  sectionTitles: string[],
): string[] {
  const layers = collectUsedLayers(commands)
  const layeredLines = layers.flatMap((layer) => {
    const layerName = layerToTikzLayerName(layer)
    const commandsInLayer = commands.filter((command) => command.layer === layer)
    const lines = [
      `% Layer ${formatNumber(layer)}: ${layerName}`,
      `\\begin{pgfonlayer}{${layerName}}`,
    ]
    let previousSectionTitle: string | null = null

    for (const command of commandsInLayer) {
      if (command.sectionTitle !== previousSectionTitle) {
        lines.push(...layerSectionComment(command.sectionTitle))
        previousSectionTitle = command.sectionTitle
      }

      lines.push(...indentLines(command.lines))
    }

    lines.push('\\end{pgfonlayer}', '')

    return lines
  })
  const presentSectionTitles = new Set(
    commands.map((command) => command.sectionTitle),
  )
  const emptySectionLines = sectionTitles
    .filter((sectionTitle) => !presentSectionTitles.has(sectionTitle))
    .map((sectionTitle) => `% ${sectionTitle}`)

  return [...layeredLines, ...emptySectionLines]
}

function indentLines(lines: string[]): string[] {
  return lines.map((line) => (line.length === 0 ? line : `  ${line}`))
}

function layerSectionComment(sectionTitle: string): string[] {
  const separator = '  %----------------------------------------'

  return [separator, `  % ${sectionTitle}`, separator]
}

function labelStyleOptions(
  label: TextLabel,
  context: GenerateContext,
): string[] {
  const presetStyleOption = userStylePresetTikzOption(
    'label',
    label.stylePresetId,
    label.style,
    context,
  )
  const importedOptions = importedStyleOptionsForElement(
    'label',
    label.importedTikzStyleReferenceId,
    label.stylePresetId,
    label.style,
    context,
  )

  if (presetStyleOption !== null) {
    return [presetStyleOption, ...importedOptions]
  }

  if (isDefaultLabelStyle(label.style)) {
    return importedOptions
  }

  return [
    ...labelStyleTikzOptions(label.style, `Label${label.id}`, context),
    ...importedOptions,
  ]
}

function labelStyleTikzOptions(
  style: LabelStyle,
  colorBaseName: string,
  context: GenerateContext,
): string[] {
  const labelColor = context.colors.define(colorBaseName, style.color)

  return [
    `text=${labelColor}`,
    `opacity=${formatNumber(style.opacity)}`,
    `font=\\fontsize{${formatNumber(style.fontSize)}pt}{${formatNumber(
      style.fontSize * 1.2,
    )}pt}\\selectfont`,
    `anchor=${style.anchor}`,
  ]
}

function isDefaultLabelStyle(style: LabelStyle): boolean {
  return (
    style.color === defaultLabelStyleValues.color &&
    style.opacity === defaultLabelStyleValues.opacity &&
    style.fontSize === defaultLabelStyleValues.fontSize &&
    style.anchor === defaultLabelStyleValues.anchor
  )
}

function curveStyleTikzOptions(
  style: CurveStyle,
  colorBaseName: string,
  context: GenerateContext,
): string[] {
  const strokeColor = context.colors.define(
    `${colorBaseName}Stroke`,
    style.strokeColor,
  )
  const lineStyleOption = lineStyleToTikzOption(style.lineStyle)

  return [
    `draw=${strokeColor}`,
    `draw opacity=${formatNumber(style.strokeOpacity)}`,
    `line width=${formatNumber(style.lineWidth)}pt`,
    ...(lineStyleOption === null ? [] : [lineStyleOption]),
  ]
}

function curveStyleOptionsForElement(
  stylePresetId: string | undefined,
  importedTikzStyleReferenceId: string | undefined,
  style: CurveStyle,
  colorBaseName: string,
  context: GenerateContext,
): string[] {
  const presetStyleOption = userStylePresetTikzOption(
    'curve',
    stylePresetId,
    style,
    context,
  )
  const importedOptions = importedStyleOptionsForElement(
    'curve',
    importedTikzStyleReferenceId,
    stylePresetId,
    style,
    context,
  )

  return presetStyleOption === null
    ? [...curveStyleTikzOptions(style, colorBaseName, context), ...importedOptions]
    : [presetStyleOption, ...importedOptions]
}

function filledSurfaceStyleTikzOptions(
  style: RegionStyle | SheetStyle,
  colorBaseName: string,
  context: GenerateContext,
): string[] {
  const fillColor = context.colors.define(`${colorBaseName}Fill`, style.fillColor)
  const strokeColor = context.colors.define(
    `${colorBaseName}Stroke`,
    style.strokeColor,
  )

  return [
    `fill=${fillColor}`,
    `fill opacity=${formatNumber(style.fillOpacity)}`,
    `draw=${strokeColor}`,
    `draw opacity=${formatNumber(style.strokeOpacity)}`,
  ]
}

function filledSurfaceStyleOptionsForElement(
  kind: 'region' | 'sheet',
  stylePresetId: string | undefined,
  importedTikzStyleReferenceId: string | undefined,
  style: RegionStyle | SheetStyle,
  colorBaseName: string,
  context: GenerateContext,
): string[] {
  const presetStyleOption = userStylePresetTikzOption(
    kind,
    stylePresetId,
    style,
    context,
  )
  const importedOptions = importedStyleOptionsForElement(
    kind,
    importedTikzStyleReferenceId,
    stylePresetId,
    style,
    context,
  )

  return presetStyleOption === null
    ? [
        ...filledSurfaceStyleTikzOptions(style, colorBaseName, context),
        ...importedOptions,
      ]
    : [presetStyleOption, ...importedOptions]
}

function pointStyleTikzOptions(
  style: PointStyle,
  colorBaseName: string,
  context: GenerateContext,
): string[] {
  const pointColor = context.colors.define(colorBaseName, style.color)

  return [
    ...pointShapeOptions(style.shape, context),
    `fill=${style.fill === 'filled' ? pointColor : 'white'}`,
    `draw=${pointColor}`,
    `opacity=${formatNumber(style.opacity)}`,
    `inner sep=${formatNumber(style.size / 2)}pt`,
  ]
}

function pointStyleOptionsForElement(
  stylePresetId: string | undefined,
  importedTikzStyleReferenceId: string | undefined,
  style: PointStyle,
  colorBaseName: string,
  context: GenerateContext,
): string[] {
  const presetStyleOption = userStylePresetTikzOption(
    'point',
    stylePresetId,
    style,
    context,
  )
  const importedOptions = importedStyleOptionsForElement(
    'point',
    importedTikzStyleReferenceId,
    stylePresetId,
    style,
    context,
  )

  return presetStyleOption === null
    ? [...pointStyleTikzOptions(style, colorBaseName, context), ...importedOptions]
    : [presetStyleOption, ...importedOptions]
}

function userStylePresetTikzOption(
  kind: StylePresetKind,
  stylePresetId: string | undefined,
  style: UserStylePreset['style'],
  context: GenerateContext,
): string | null {
  const preset = matchingUserStylePreset(kind, stylePresetId, style, context)

  if (preset === undefined) {
    return null
  }

  return context.localStyles.define(preset, () =>
    styleOptionsForUserPreset(preset, context),
  )
}

function importedStyleOptionsForElement(
  kind: StylePresetKind,
  importedTikzStyleReferenceId: string | undefined,
  stylePresetId: string | undefined,
  style: UserStylePreset['style'],
  context: GenerateContext,
): string[] {
  const referenceId =
    importedTikzStyleReferenceId ??
    matchingUserStylePreset(kind, stylePresetId, style, context)
      ?.importedTikzStyleReferenceId

  if (referenceId === undefined) {
    return []
  }

  const reference = context.importedTikzStyleReferences.get(referenceId)

  if (reference === undefined) {
    return []
  }

  const source = context.externalTikzStyleSources.get(reference.sourceId)

  if (source !== undefined) {
    context.externalTikzStyleUsage.use(source)
  }

  return [reference.key]
}

function matchingUserStylePreset(
  kind: StylePresetKind,
  stylePresetId: string | undefined,
  style: UserStylePreset['style'],
  context: GenerateContext,
): UserStylePreset | undefined {
  const preset =
    stylePresetId === undefined
      ? undefined
      : context.userStylePresets.get(stylePresetId)

  if (
    preset === undefined ||
    preset.kind !== kind ||
    !stylePresetStylesEqual(style, preset.style)
  ) {
    return undefined
  }

  return preset
}

function styleOptionsForUserPreset(
  preset: UserStylePreset,
  context: GenerateContext,
): string[] {
  const colorBaseName = `Style${preset.id}`

  switch (preset.kind) {
    case 'region':
    case 'sheet':
      return filledSurfaceStyleTikzOptions(
        preset.style,
        colorBaseName,
        context,
      )
    case 'curve':
      return curveStyleTikzOptions(preset.style, colorBaseName, context)
    case 'point':
      return pointStyleTikzOptions(preset.style, colorBaseName, context)
    case 'label':
      return labelStyleTikzOptions(preset.style, colorBaseName, context)
  }
}

function fillRuleTikzOptions(fillRule: 'nonzero' | 'evenOdd'): string[] {
  return fillRule === 'evenOdd' ? ['even odd rule'] : []
}

function pointShapeOptions(
  shape: PointShape,
  context: GenerateContext,
): string[] {
  if (shape !== 'circle') {
    context.coordinates.hasNonCircularPointShape = true
  }

  switch (shape) {
    case 'circle':
      return ['circle']
    case 'square':
      return ['regular polygon', 'regular polygon sides=4']
    case 'triangle':
      return ['regular polygon', 'regular polygon sides=3']
    case 'star':
      return ['star', 'star points=5']
  }
}

function defineCurveCoordinates(
  curve: PointCurveStratum,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  const baseName = curveCoordinateBaseName(curve, elementIndex)

  if (usesRelativeBezierControls(curve, context.mode)) {
    return [
      context.coordinates.define(baseName, 0, curve.points[0]),
      context.coordinates.define(baseName, 3, curve.points[3]),
    ]
  }

  return curve.points.map((point, index) =>
    context.coordinates.define(baseName, index, point),
  )
}

function defineConcatenatedPathCoordinates(
  path: ConcatenatedPathStratum,
  elementIndex: number,
  context: GenerateContext,
): PathSegmentCoordinateNames[] {
  const baseName = curveCoordinateBaseName(path, elementIndex)
  let pointIndex = 0
  let previousEnd: string | null = null

  return path.segments.map((segment) => {
    const start =
      previousEnd ??
      context.coordinates.define(baseName, pointIndex, segment.start)

    if (previousEnd === null) {
      pointIndex += 1
    }

    const names = definePathSegmentCoordinateNames(
      segment,
      start,
      baseName,
      pointIndex,
      context,
    )

    pointIndex += pathSegmentCoordinateNameCount(names)
    previousEnd = names.end

    return names
  })
}

function defineClosedBoundariesCoordinateNames(
  boundaries: readonly ClosedPathBoundary[],
  baseName: string,
  context: GenerateContext,
): PathSegmentCoordinateNames[][] {
  return boundaries.map((boundary, boundaryIndex) =>
    defineClosedBoundaryCoordinateNames(
      boundary,
      `${baseName}b${boundaryIndex}`,
      context,
    ),
  )
}

function defineClosedBoundaryCoordinateNames(
  boundary: ClosedPathBoundary,
  baseName: string,
  context: GenerateContext,
): PathSegmentCoordinateNames[] {
  let pointIndex = 0
  let previousEnd: string | null = null

  return boundary.segments.map((segment) => {
    const start =
      previousEnd ??
      context.coordinates.define(baseName, pointIndex, segment.start)

    if (previousEnd === null) {
      pointIndex += 1
    }

    const names = definePathSegmentCoordinateNames(
      segment,
      start,
      baseName,
      pointIndex,
      context,
    )

    pointIndex += pathSegmentCoordinateNameCount(names)
    previousEnd = names.end

    return names
  })
}

function definePathSegmentCoordinateNames(
  segment: PathSegment,
  start: string,
  baseName: string,
  pointIndex: number,
  context: GenerateContext,
): PathSegmentCoordinateNames {
  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        start,
        end: context.coordinates.define(baseName, pointIndex, segment.end),
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        start,
        control1: context.coordinates.define(
          baseName,
          pointIndex,
          segment.control1,
        ),
        control2: context.coordinates.define(
          baseName,
          pointIndex + 1,
          segment.control2,
        ),
        end: context.coordinates.define(baseName, pointIndex + 2, segment.end),
      }
    case 'arc':
      if (context.mode === '2d') {
        return {
          kind: 'arc',
          start,
          end: context.coordinates.define(baseName, pointIndex, segment.end),
          radius: segment.radius,
          startAngleDeg: segment.startAngleDeg,
          endAngleDeg: segment.endAngleDeg,
          direction: segment.direction,
        }
      }

      return defineArcCubicApproximationCoordinateNames(
        segment,
        start,
        baseName,
        pointIndex,
        context,
      )
  }
}

function defineArcCubicApproximationCoordinateNames(
  segment: Extract<PathSegment, { kind: 'arc' }>,
  start: string,
  baseName: string,
  pointIndex: number,
  context: GenerateContext,
): PathSegmentCoordinateNames {
  const cubicSegments = arcSegmentToCubicBezierSegments(segment, 3) ?? []
  let nextPointIndex = pointIndex
  const cubics = cubicSegments.map((cubic) => {
    const names = {
      control1: context.coordinates.define(
        baseName,
        nextPointIndex,
        cubic.control1,
      ),
      control2: context.coordinates.define(
        baseName,
        nextPointIndex + 1,
        cubic.control2,
      ),
      end: context.coordinates.define(baseName, nextPointIndex + 2, cubic.end),
    }
    nextPointIndex += 3
    return names
  })

  return {
    kind: 'arcCubicApproximation',
    start,
    end: cubics[cubics.length - 1]?.end ?? start,
    cubics,
  }
}

function pathSegmentCoordinateNameCount(
  segment: PathSegmentCoordinateNames,
): number {
  switch (segment.kind) {
    case 'line':
    case 'arc':
      return 1
    case 'cubicBezier':
      return 3
    case 'arcCubicApproximation':
      return segment.cubics.length * 3
  }
}

function closedBoundariesHaveFiniteCoordinates(
  boundaries: readonly ClosedPathBoundary[],
): boolean {
  return boundaries.every((boundary) =>
    boundary.segments.every(pathSegmentHasFiniteCoordinates),
  )
}

function pathSegmentHasFiniteCoordinates(segment: PathSegment): boolean {
  switch (segment.kind) {
    case 'line':
      return isFiniteVec3(segment.start) && isFiniteVec3(segment.end)
    case 'cubicBezier':
      return (
        isFiniteVec3(segment.start) &&
        isFiniteVec3(segment.control1) &&
        isFiniteVec3(segment.control2) &&
        isFiniteVec3(segment.end)
      )
    case 'arc':
      return (
        isFiniteVec3(segment.start) &&
        isFiniteVec3(segment.end) &&
        isFiniteVec3(segment.center) &&
        Number.isFinite(segment.radius) &&
        Number.isFinite(segment.startAngleDeg) &&
        Number.isFinite(segment.endAngleDeg)
      )
  }
}

function curveHasFiniteCoordinates(curve: CurveStratum): boolean {
  switch (curve.kind) {
    case 'polyline':
    case 'cubicBezier':
      return curve.points.every(isFiniteVec3)
    case 'concatenatedPath':
      return curve.segments.every(pathSegmentHasFiniteCoordinates)
    case 'templatePath':
      return (
        templatePathCoordinates(curve.template).every(isFiniteVec3) &&
        templatePathHasFiniteParameters(curve.template)
      )
  }
}

function templatePathHasFiniteParameters(template: PathTemplate): boolean {
  switch (template.kind) {
    case 'circleTemplate':
      return Number.isFinite(template.radius) && template.radius > 0
    case 'ellipseTemplate':
      return (
        Number.isFinite(template.radiusX) &&
        Number.isFinite(template.radiusY) &&
        template.radiusX > 0 &&
        template.radiusY > 0 &&
        (template.rotationDeg === undefined || Number.isFinite(template.rotationDeg))
      )
  }
}

function formatCurvePath(
  curve: PointCurveStratum,
  coordinates: string[],
  mode: TikzMode,
): string {
  if (
    curve.kind === 'cubicBezier' &&
    usesRelativeBezierControls(curve, mode) &&
    coordinates.length === 2
  ) {
    const controlPath = formatRelativeBezierControls(curve.bezierControls, mode)

    if (controlPath !== null) {
      return `(${coordinates[0]}) ${controlPath} (${coordinates[1]})`
    }
  }

  if (curve.kind === 'cubicBezier' && coordinates.length === 4) {
    return `(${coordinates[0]}) .. controls (${coordinates[1]}) and (${coordinates[2]}) .. (${coordinates[3]})`
  }

  return coordinates.map((name) => `(${name})`).join(' -- ')
}

function formatConcatenatedPath(
  coordinates: readonly PathSegmentCoordinateNames[],
): string {
  if (coordinates.length === 0) {
    return ''
  }

  const [firstSegment, ...restSegments] = coordinates

  return [
    `(${firstSegment.start})`,
    formatPathSegmentCommand(firstSegment),
    ...restSegments.map(formatPathSegmentCommand),
  ].join(' ')
}

function emitFillDrawClosedBoundaries(
  boundaries: readonly PathSegmentCoordinateNames[][],
  options: string[],
): string[] {
  const paths = boundaries
    .map(formatClosedBoundaryPath)
    .filter((path) => path.length > 0)

  if (paths.length === 0) {
    return []
  }

  return [
    '\\filldraw[',
    ...formatTikzOptions(options),
    ']',
    ...formatClosedBoundaryPathLines(paths),
    '',
  ]
}

function formatClosedBoundaryPathLines(paths: readonly string[]): string[] {
  return paths.map((path, index) =>
    index === paths.length - 1 ? `  ${path};` : `  ${path}`,
  )
}

function formatClosedBoundaryPath(
  coordinates: readonly PathSegmentCoordinateNames[],
): string {
  const openPath = formatConcatenatedPath(coordinates)

  return openPath.length === 0 ? '' : `${openPath} -- cycle`
}

function formatPathSegmentCommand(segment: PathSegmentCoordinateNames): string {
  switch (segment.kind) {
    case 'line':
      return `-- (${segment.end})`
    case 'cubicBezier':
      return `.. controls (${segment.control1}) and (${segment.control2}) .. (${segment.end})`
    case 'arc':
      return `arc[start angle=${formatNumber(
        segment.startAngleDeg,
      )}, end angle=${formatNumber(
        arcEndAngleForDirection(segment),
      )}, radius=${formatNumber(segment.radius)}]`
    case 'arcCubicApproximation':
      return segment.cubics
        .map(
          (cubic) =>
            `.. controls (${cubic.control1}) and (${cubic.control2}) .. (${cubic.end})`,
        )
        .join(' ')
  }
}

function arcEndAngleForDirection(
  segment: Extract<PathSegmentCoordinateNames, { kind: 'arc' }>,
): number {
  if (segment.direction === 'counterclockwise') {
    return segment.endAngleDeg
  }

  return segment.endAngleDeg >= segment.startAngleDeg
    ? segment.endAngleDeg - 360
    : segment.endAngleDeg
}

function formatWorkPlaneFilledSheetLocalPath(
  sheet: Extract<SheetStratum, { kind: 'workPlaneFilledSheet' }>,
): string[] | null {
  if (!isValidWorkPlaneFrameSnapshot(sheet.planeFrame)) {
    return null
  }

  const paths: string[] = []

  for (const boundary of sheet.boundaries) {
    const path = formatClosedBoundaryLocalPath(boundary, sheet.planeFrame)

    if (path === null) {
      return null
    }

    paths.push(path)
  }

  return paths
}

function formatClosedBoundaryLocalPath(
  boundary: ClosedPathBoundary,
  frame: WorkPlaneFrameSnapshot,
): string | null {
  if (boundary.segments.length === 0) {
    return null
  }

  const start = formatLocalCoordinateForPoint(boundary.segments[0].start, frame)

  if (start === null) {
    return null
  }

  const commands = [start]

  for (const segment of boundary.segments) {
    switch (segment.kind) {
      case 'line': {
        const end = formatLocalCoordinateForPoint(segment.end, frame)

        if (end === null) {
          return null
        }

        commands.push(`-- ${end}`)
        break
      }
      case 'cubicBezier': {
        const control1 = formatLocalCoordinateForPoint(segment.control1, frame)
        const control2 = formatLocalCoordinateForPoint(segment.control2, frame)
        const end = formatLocalCoordinateForPoint(segment.end, frame)

        if (control1 === null || control2 === null || end === null) {
          return null
        }

        commands.push(`.. controls ${control1} and ${control2} .. ${end}`)
        break
      }
      case 'arc': {
        const cubics = arcSegmentToCubicBezierSegments(segment, 3)

        if (cubics === null) {
          return null
        }

        for (const cubic of cubics) {
          const control1 = formatLocalCoordinateForPoint(cubic.control1, frame)
          const control2 = formatLocalCoordinateForPoint(cubic.control2, frame)
          const end = formatLocalCoordinateForPoint(cubic.end, frame)

          if (control1 === null || control2 === null || end === null) {
            return null
          }

          commands.push(`.. controls ${control1} and ${control2} .. ${end}`)
        }
        break
      }
    }
  }

  commands.push('-- cycle')

  return commands.join(' ')
}

function formatLocalCoordinateForPoint(
  point: Vec3,
  frame: WorkPlaneFrameSnapshot,
): string | null {
  const localCoordinate = workPlaneLocalCoordinateFromPoint(frame, point)

  if (
    !Number.isFinite(localCoordinate.a) ||
    !Number.isFinite(localCoordinate.b) ||
    !vec3ApproximatelyEqual(pointFromWorkPlaneLocalCoordinate(frame, localCoordinate), point)
  ) {
    return null
  }

  return formatWorkPlaneLocalCoordinate(localCoordinate)
}

type ScopedWorkPlaneRelativeBezierPath = {
  frame: WorkPlaneFrameSnapshot
  path: string
}

function formatScopedWorkPlaneRelativeBezierPath(
  curve: CurveStratum,
  mode: TikzMode,
): ScopedWorkPlaneRelativeBezierPath | null {
  if (
    mode !== '3d' ||
    curve.kind !== 'cubicBezier' ||
    curve.points.length !== 4
  ) {
    return null
  }

  const controlMode = curve.bezierControls

  if (
    controlMode?.kind !== 'workPlaneRelativeCartesian' &&
    controlMode?.kind !== 'workPlaneRelativePolar'
  ) {
    return null
  }

  if (!isConsistentWorkPlaneRelativeBezierCurve(curve, controlMode)) {
    return null
  }

  const start = formatWorkPlaneLocalCoordinate(controlMode.localStart)
  const end = formatWorkPlaneLocalCoordinate(controlMode.localEnd)
  const controls =
    controlMode.kind === 'workPlaneRelativeCartesian'
      ? formatWorkPlaneRelativeCartesianControls(
          controlMode.firstControlOffset,
          controlMode.secondControlOffset,
        )
      : formatWorkPlaneRelativePolarControls(
          controlMode.firstControl,
          controlMode.secondControl,
        )

  return {
    frame: controlMode.frame,
    path: `${start} ${controls} ${end}`,
  }
}

function isConsistentWorkPlaneRelativeBezierCurve(
  curve: CubicBezierCurveStratum,
  controlMode: Extract<
    CubicBezierControlMode,
    { kind: 'workPlaneRelativeCartesian' | 'workPlaneRelativePolar' }
  >,
): boolean {
  const expectedPoints = absoluteCubicBezierPointsFromControlMode(
    3,
    curve.points[0],
    curve.points[3],
    controlMode,
  )

  if (expectedPoints === null) {
    return false
  }

  const expectedStart = pointFromWorkPlaneLocalCoordinate(
    controlMode.frame,
    controlMode.localStart,
  )
  const expectedEnd = pointFromWorkPlaneLocalCoordinate(
    controlMode.frame,
    controlMode.localEnd,
  )

  return (
    vec3ApproximatelyEqual(expectedStart, curve.points[0]) &&
    vec3ApproximatelyEqual(expectedEnd, curve.points[3]) &&
    expectedPoints.every((point, index) =>
      vec3ApproximatelyEqual(point, curve.points[index]),
    )
  )
}

function formatWorkPlaneRelativeCartesianControls(
  firstControlOffset: WorkPlaneLocalOffset,
  secondControlOffset: WorkPlaneLocalOffset,
): string {
  return `.. controls +${formatWorkPlaneLocalOffset(
    firstControlOffset,
  )} and +${formatWorkPlaneLocalOffset(secondControlOffset)} ..`
}

function formatWorkPlaneRelativePolarControls(
  firstControl: Extract<
    CubicBezierControlMode,
    { kind: 'workPlaneRelativePolar' }
  >['firstControl'],
  secondControl: Extract<
    CubicBezierControlMode,
    { kind: 'workPlaneRelativePolar' }
  >['secondControl'],
): string {
  return `.. controls +(${formatNumber(
    firstControl.angleDegrees,
  )}:${formatNumber(firstControl.radius)}) and +(${formatNumber(
    secondControl.angleDegrees,
  )}:${formatNumber(secondControl.radius)}) ..`
}

function usesRelativeBezierControls(
  curve: CurveStratum,
  mode: TikzMode | undefined,
): boolean {
  if (
    curve.kind !== 'cubicBezier' ||
    curve.points.length !== 4 ||
    curve.bezierControls === undefined
  ) {
    return false
  }

  if (curve.bezierControls.kind === 'relativeCartesian') {
    return true
  }

  return curve.bezierControls.kind === 'relativePolar' && mode !== '3d'
}

function formatRelativeBezierControls(
  controlMode: CubicBezierControlMode | undefined,
  mode: TikzMode,
): string | null {
  if (controlMode?.kind === 'relativeCartesian') {
    return `.. controls +${formatCoordinate(
      controlMode.firstControlOffset,
      mode,
    )} and +${formatCoordinate(
      controlMode.secondControlOffset,
      mode,
    )} ..`
  }

  if (controlMode?.kind === 'relativePolar') {
    return `.. controls +(${formatNumber(
      controlMode.firstControl.angleDegrees,
    )}:${formatNumber(controlMode.firstControl.radius)}) and +(${formatNumber(
      controlMode.secondControl.angleDegrees,
    )}:${formatNumber(controlMode.secondControl.radius)}) ..`
  }

  return null
}

function spathSaveOptions(
  pathLabel: string | undefined,
  context: GenerateContext,
): string[] {
  const trimmedPathLabel = pathLabel?.trim()

  if (trimmedPathLabel === undefined || trimmedPathLabel.length === 0) {
    return []
  }

  context.hasSavedPaths = true

  return [`spath/save=${sanitizeTikzSpathSaveName(trimmedPathLabel)}`]
}

function formatTikzOptions(options: string[]): string[] {
  return options.map((option, index) =>
    index === options.length - 1 ? `  ${option}` : `  ${option},`,
  )
}

function section(title: string, lines: string[]): string[] {
  return [
    '% ----------------------------------------------------------------------------',
    `% ${title}`,
    '% ----------------------------------------------------------------------------',
    '',
    ...lines,
    '',
  ]
}

function formatCoordinate(point: Vec3, mode: TikzMode): string {
  if (mode === '2d') {
    return `(${formatNumber(point.x)},${formatNumber(point.y)})`
  }

  return `(${formatNumber(point.x)},${formatNumber(point.y)},${formatNumber(
    point.z,
  )})`
}

function formatWorkPlaneLocalCoordinate(
  coordinate: WorkPlaneLocalCoordinate,
): string {
  return `(${formatNumber(coordinate.a)},${formatNumber(coordinate.b)})`
}

function formatWorkPlaneLocalOffset(offset: WorkPlaneLocalOffset): string {
  return `(${formatNumber(offset.dx)},${formatNumber(offset.dy)})`
}

function addVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

function vec3ApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  const epsilon = 1e-6

  return (
    Math.abs(first.x - second.x) <= epsilon &&
    Math.abs(first.y - second.y) <= epsilon &&
    Math.abs(first.z - second.z) <= epsilon
  )
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (Object.is(value, -0)) {
    return '0'
  }

  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toFixed(6)))
}

function sortByLayer<T extends { layer: number }>(
  items: T[],
): { item: T; originalIndex: number }[] {
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((first, second) => {
      const firstLayer = normalizeLayer(first.item.layer)
      const secondLayer = normalizeLayer(second.item.layer)

      if (firstLayer !== secondLayer) {
        return firstLayer - secondLayer
      }

      return first.originalIndex - second.originalIndex
    })
}

function normalizeLayer(layer: number): number {
  if (!Number.isFinite(layer)) {
    return 0
  }

  return Object.is(layer, -0) ? 0 : layer
}

class ColorRegistry {
  private readonly definitions: ColorDefinition[] = []
  private readonly usedNames = new Set<string>()

  define(baseName: string, hex: HexColor): string {
    const base = `stz${toIdentifierPart(baseName, 'Color')}`
    const name = this.uniqueName(base)

    this.definitions.push({ name, hex })

    return name
  }

  emitDefinitions(): string[] {
    return this.definitions.map(
      (definition) =>
        `\\definecolor{${definition.name}}{HTML}{${definition.hex.slice(1)}}`,
    )
  }

  private uniqueName(baseName: string): string {
    if (!this.usedNames.has(baseName)) {
      this.usedNames.add(baseName)
      return baseName
    }

    let suffix = 2
    while (this.usedNames.has(`${baseName}${suffix}`)) {
      suffix += 1
    }

    const name = `${baseName}${suffix}`
    this.usedNames.add(name)
    return name
  }
}

class LocalStyleRegistry {
  private readonly definitions: Array<{ name: string; options: string[] }> = []
  private readonly namesByPresetId = new Map<string, string>()
  private readonly usedNames = new Set<string>()

  define(preset: UserStylePreset, createOptions: () => string[]): string {
    const existingName = this.namesByPresetId.get(preset.id)

    if (existingName !== undefined) {
      return existingName
    }

    const name = this.uniqueName(preset.tikzStyleName)

    this.namesByPresetId.set(preset.id, name)
    this.definitions.push({ name, options: createOptions() })

    return name
  }

  emitDefinitions(): string[] {
    return this.definitions.map(
      (definition) =>
        `${definition.name}/.style={${definition.options.join(', ')}}`,
    )
  }

  private uniqueName(preferredName: string): string {
    const identifier = /^[a-zA-Z][a-zA-Z0-9]*$/.test(preferredName)
      ? preferredName
      : toIdentifierPart(preferredName, 'stratifiedStylePreset')
    const safeName = /^[a-zA-Z]/.test(identifier)
      ? identifier
      : `stratifiedStylePreset${identifier}`

    if (!this.usedNames.has(safeName)) {
      this.usedNames.add(safeName)
      return safeName
    }

    let suffix = 2
    while (this.usedNames.has(`${safeName}${suffix}`)) {
      suffix += 1
    }

    const name = `${safeName}${suffix}`
    this.usedNames.add(name)
    return name
  }
}

class ExternalTikzStyleUsageRegistry {
  private readonly sources: ExternalTikzStyleSource[] = []
  private readonly usedSourceIds = new Set<string>()

  use(source: ExternalTikzStyleSource): void {
    if (this.usedSourceIds.has(source.id)) {
      return
    }

    this.usedSourceIds.add(source.id)
    this.sources.push(source)
  }

  usedSources(): ExternalTikzStyleSource[] {
    return [...this.sources]
  }
}

class CoordinateRegistry {
  readonly definitions: CoordinateDefinition[] = []
  hasNonCircularPointShape = false
  private readonly usedNames = new Set<string>()

  define(baseName: string, index: number, position: Vec3): string {
    const base = toIdentifierPart(`${baseName}p${index}`, 'p')
    const name = this.uniqueName(base)

    this.definitions.push({ name, position })

    return name
  }

  private uniqueName(baseName: string): string {
    if (!this.usedNames.has(baseName)) {
      this.usedNames.add(baseName)
      return baseName
    }

    let suffix = 2
    while (this.usedNames.has(`${baseName}${suffix}`)) {
      suffix += 1
    }

    const name = `${baseName}${suffix}`
    this.usedNames.add(name)
    return name
  }
}

function sanitizeTikzNameStemPart(value: string): string {
  let result = ''
  let capitalizeNext = false

  for (const character of value.trim()) {
    if (/^[a-zA-Z0-9]$/.test(character)) {
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

function toIdentifierPart(value: string, fallback: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '')

  if (cleaned.length === 0) {
    return fallback
  }

  if (/^[0-9]/.test(cleaned)) {
    return `${fallback}${cleaned}`
  }

  return cleaned
}
