import type {
  ClosedPathBoundary,
  ConcatenatedPathStratum,
  CoordinateComponent,
  CubicBezierCurveStratum,
  CubicBezierControlMode,
  Camera3D,
  CurveStyle,
  CurveStratum,
  Diagram,
  ExternalTikzStyleSource,
  FilledRegion2DStratum,
  GridParameterRange,
  GridRectangleClip,
  HexColor,
  ImportedTikzStyleReference,
  LabelStyle,
  LatticePattern,
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
  SymbolicVariable,
  TikzExportMode,
  TikzStyleTarget,
  UserStylePreset,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinate,
  WorkPlaneLocalOffset,
} from '../model/types'
import { gridLatticePattern, isLatticePattern } from '../model/grids.ts'
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
import {
  type ScalarInputValue,
  parseScalarExpression,
} from '../model/scalarExpressions.ts'
import { hasSymbolicVec3Coordinates } from '../model/symbolicCoordinates.ts'
import {
  isSymbolicVariableMacroName,
  resolveSymbolicVariables,
} from '../model/variables.ts'
import { formatScalarExpressionForTikz } from './expressionFormatter.ts'

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

type VariableExportContext = {
  definitions: string[]
  variableNames: string[]
  variableMacros: ReadonlyMap<string, string>
}

type LayeredTikzCommand = {
  layer: number
  sectionTitle: string
  lines: string[]
}

type PointCurveStratum = Exclude<
  CurveStratum,
  | ConcatenatedPathStratum
  | Extract<CurveStratum, { kind: 'templatePath' | 'grid' }>
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

type GridRangeValues = {
  min: number
  max: number
  step: number
}

type GridRangeBounds = {
  min: number
  max: number
}

type GridClipValues = {
  uMin: FormattedGridScalar
  uMax: FormattedGridScalar
  vMin: FormattedGridScalar
  vMax: FormattedGridScalar
}

type FormattedGridScalar = {
  value: number
  tikz: string
}

type GridForeachSequence = {
  count: number
  first: number
  last: number
  next?: number
}

type GridLoopVariables = {
  u: string
  v: string
  w: string
  i: string
  j: string
}

type GridRangeReadResult =
  | {
      ok: true
      range: GridRangeValues
    }
  | {
      ok: false
      error: string
    }

type GridRangeBoundsReadResult =
  | {
      ok: true
      bounds: GridRangeBounds
    }
  | {
      ok: false
      error: string
    }

type GridClipFormatResult =
  | {
      ok: true
      clip: GridClipValues
    }
  | {
      ok: false
      error: string
    }

type GridForeachSequenceResult =
  | {
      ok: true
      sequence: GridForeachSequence
    }
  | {
      ok: false
      error: string
    }

export type GenerateTikzOptions = {
  includeCoordinateAxes?: boolean
  camera3d?: Camera3D
  exportMode?: TikzExportMode
}

type GenerateContext = {
  mode: TikzMode
  camera3d?: OrthographicCamera3D
  colors: ColorRegistry
  coordinates: CoordinateRegistry
  variables: VariableExportContext
  userStylePresets: Map<string, UserStylePreset>
  localStyles: LocalStyleRegistry
  externalTikzStyleSources: Map<string, ExternalTikzStyleSource>
  importedTikzStyleReferences: Map<string, ImportedTikzStyleReference>
  externalTikzStyleUsage: ExternalTikzStyleUsageRegistry
  hasSavedPaths: boolean
  requiresTikz3dLibrary: boolean
  includeCoordinateAxes: boolean
  exportMode: TikzExportMode
}

const coordinateAxesGuideLayerName = 'stratifiedGuideLayer'
const coordinateAxesGuideColor: HexColor = '#64748B'
const coordinateAxesGuideLength = 2.5
const coordinateAxesGuideLabelOffset = 0.25
const inlineMathBaselineTikzOption =
  'baseline={([yshift=-.5ex]current bounding box.center)}'
const inlineMathCommentSeparatorLine = '%----------------------------------------'
const TIKZ_INDENT = '    '
export const maxCurvedSheetTikzFaces = 256
const gridTikzEpsilon = 1e-9

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
    diagram.variables,
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
      section(
        'Coordinates',
        emitCoordinateDefinitions(context),
        context.exportMode,
      ),
      section(
        'Layered drawing commands',
        emitLayeredCommands(drawingCommands, sectionTitles),
        context.exportMode,
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
    diagram.variables,
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
      section(
        'Coordinates',
        emitCoordinateDefinitions(context),
        context.exportMode,
      ),
      ...(coordinateAxesGuide.length === 0
        ? []
        : [
            section(
              'Coordinate axes guide',
              coordinateAxesGuide,
              context.exportMode,
            ),
          ]),
      section(
        'Layered drawing commands',
        emitLayeredCommands(drawingCommands, sectionTitles),
        context.exportMode,
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
  variables: readonly SymbolicVariable[] | undefined,
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
    variables: createVariableExportContext(variables),
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
    exportMode: options.exportMode ?? 'standalone',
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
  if (context.exportMode === 'inlineMath') {
    return assembleInlineMathTikz({ context, layers, bodySections })
  }

  return assembleStandaloneTikz({ context, layers, bodySections })
}

function assembleStandaloneTikz({
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
      ...emitExportModeComment(context),
      ...emitRequiredLibraryComment(context),
      ...emitExternalTikzStyleLoadComment(context),
      ...emitColorDefinitions(context, false),
      ...emitStandaloneVariableDefinitions(context),
      ...emitTikzLayerDeclarations(
        layers,
        context.includeCoordinateAxes,
        context.exportMode,
      ),
      ...emitTikzCameraSetup(context),
      ...emitTikzPictureStart(context),
    ]),
    ...indentLines(bodySections.flat()),
    '\\end{tikzpicture}',
  ]

  return joinStandaloneTikzLines(lines)
}

function assembleInlineMathTikz({
  context,
  layers,
  bodySections,
}: {
  context: GenerateContext
  layers: number[]
  bodySections: string[][]
}): string {
  const lines = [
    ...emitTikzPictureStart(context),
    ...indentLines(
      [
        ...section(
          'Styles and colors',
          [
            ...emitExportModeComment(context),
            ...emitRequiredLibraryComment(context),
            ...emitExternalTikzStyleLoadComment(context),
            ...emitColorDefinitions(context, true),
            ...emitLocalStyleTikzset(context),
            ...emitTikzLayerDeclarations(
              layers,
              context.includeCoordinateAxes,
              context.exportMode,
            ),
            ...emitTikzCameraSetup(context),
          ],
          context.exportMode,
        ),
        ...emitInlineVariableSection(context),
        ...emitBodySections(context, bodySections),
      ],
    ),
    '\\end{tikzpicture}',
  ]

  return joinInlineMathTikzLines(lines)
}

function emitExportModeComment(context: GenerateContext): string[] {
  if (context.exportMode !== 'inlineMath') {
    return []
  }

  return ['% TikZ export mode: inline math. Setup is local to this tikzpicture.']
}

function emitTikzPictureStart(context: GenerateContext): string[] {
  if (context.exportMode === 'inlineMath') {
    return [
      `\\begin{tikzpicture}[${[
        inlineMathBaselineTikzOption,
        'line cap=round',
        'line join=round',
      ].join(', ')}]`,
    ]
  }

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

function emitColorDefinitions(
  context: GenerateContext,
  includeInlineHeading: boolean,
): string[] {
  const definitions = context.colors.emitDefinitions()

  if (definitions.length === 0) {
    return []
  }

  return includeInlineHeading
    ? inlineMathCommentSection('Local colors', definitions)
    : definitions
}

function emitLocalStyleTikzset(context: GenerateContext): string[] {
  const definitions = context.localStyles.emitDefinitions()

  if (definitions.length === 0) {
    return []
  }

  return inlineMathCommentSection('Local styles', [
    '\\tikzset{',
    ...formatTikzOptions(definitions),
    '}',
  ])
}

function emitStandaloneVariableDefinitions(context: GenerateContext): string[] {
  if (context.variables.definitions.length === 0) {
    return []
  }

  return [
    '% Variables',
    ...context.variables.definitions,
    '',
  ]
}

function emitInlineVariableSection(context: GenerateContext): string[] {
  if (context.variables.definitions.length === 0) {
    return []
  }

  return section(
    'Variables',
    context.variables.definitions,
    context.exportMode,
  )
}

function emitBodySections(
  context: GenerateContext,
  bodySections: string[][],
): string[] {
  const lines = bodySections.flat()

  if (
    context.exportMode === 'inlineMath' &&
    context.mode === '3d' &&
    context.camera3d !== undefined
  ) {
    return [
      '\\begin{scope}[tdplot_main_coords]',
      ...indentLines(lines),
      '\\end{scope}',
    ]
  }

  return lines
}

function emitTikzCameraSetup(context: GenerateContext): string[] {
  if (context.mode !== '3d' || context.camera3d === undefined) {
    return []
  }

  const setupLines = [
    `\\tdplotsetmaincoords{${formatNumber(
      context.camera3d.thetaDeg,
    )}}{${formatNumber(context.camera3d.phiDeg)}}`,
  ]

  return context.exportMode === 'inlineMath'
    ? inlineMathCommentSection('Camera setup', setupLines)
    : [...setupLines, '']
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

  return context.exportMode === 'inlineMath' && lines.length > 0
    ? inlineMathCommentSection('Package requirements', lines)
    : lines
}

function emitExternalTikzStyleLoadComment(context: GenerateContext): string[] {
  const sources = context.externalTikzStyleUsage.usedSources()

  if (sources.length === 0) {
    return []
  }

  const lines = [
    '% External TikZ styles referenced below.',
    '% Load these files in your LaTeX preamble or before the picture:',
    ...sources.map((source) => `% - ${commentLineText(source.name)}`),
    '% Suggested:',
    ...sources.map((source) => `%   ${commentLineText(source.loadHint)}`),
  ]

  return context.exportMode === 'inlineMath'
    ? inlineMathCommentSection('External TikZ styles', lines)
    : [...lines, '']
}

function commentLineText(value: string): string {
  return normalizeSingleLineCommentText(value, 'external TikZ style source')
}

function createVariableExportContext(
  variables: readonly SymbolicVariable[] | undefined,
): VariableExportContext {
  const resolved = resolveSymbolicVariables(variables ?? [])

  if (!resolved.ok) {
    return {
      definitions: resolved.errors.map(
        (issue) =>
          `% Variable omitted: ${commentLineText(`${issue.path} ${issue.message}`)}`,
      ),
      variableNames: [],
      variableMacros: new Map(),
    }
  }

  if (resolved.orderedVariables.length === 0) {
    return {
      definitions: [],
      variableNames: [],
      variableMacros: new Map(),
    }
  }

  const variableNames = resolved.variables.map((variable) => variable.name)
  const variableMacros = new Map(
    resolved.variables.map((variable) => [
      variable.name,
      `\\${variable.macroName}`,
    ]),
  )
  const definitions = resolved.orderedVariables.map((variable) =>
    emitVariableDefinition(variable, variableNames, variableMacros),
  )

  return {
    definitions,
    variableNames,
    variableMacros,
  }
}

function emitVariableDefinition(
  variable: SymbolicVariable,
  variableNames: readonly string[],
  variableMacros: ReadonlyMap<string, string>,
): string {
  if (!isSymbolicVariableMacroName(variable.macroName)) {
    const error = commentLineText(
      'Variable macro name is not safe for TikZ export.',
    )

    return `% Variable "${commentLineText(variable.name)}" omitted: ${error}`
  }

  const parsed = parseScalarExpression(variable.expression, {
    variables: variableNames,
  })

  if (!parsed.ok) {
    return `% Variable "${commentLineText(variable.name)}" omitted: ${commentLineText(parsed.error)}`
  }

  const formatted = formatScalarExpressionForTikz(
    parsed.expression,
    variableMacros,
  )

  if (!formatted.ok) {
    return `% Variable "${commentLineText(variable.name)}" omitted: ${commentLineText(formatted.error)}`
  }

  return `\\pgfmathsetmacro{\\${variable.macroName}}{${formatted.expression}}`
}

function emitTikzLayerDeclarations(
  layers: number[],
  includeCoordinateAxesGuideLayer: boolean,
  exportMode: TikzExportMode = 'standalone',
): string[] {
  if (layers.length === 0 && !includeCoordinateAxesGuideLayer) {
    return []
  }

  const layerNames = [
    ...(includeCoordinateAxesGuideLayer ? [coordinateAxesGuideLayerName] : []),
    ...layers.map(layerToTikzLayerName),
  ]
  const declarations = [
    ...layerNames.map((layerName) => `\\pgfdeclarelayer{${layerName}}`),
    `\\pgfsetlayers{${[...layerNames, 'main'].join(',')}}`,
  ]

  if (exportMode === 'inlineMath') {
    return inlineMathCommentSection('TikZ layers', declarations)
  }

  return [
    ...declarations,
    '',
  ]
}

function emitCoordinateDefinitions(context: GenerateContext): string[] {
  return context.coordinates.definitions.map(
    (definition) =>
      `\\coordinate (${definition.name}) at ${formatCoordinate(
        definition.position,
        context.mode,
        context,
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
    indentLine(
      `${formatCoordinate({ x: 0, y: 0, z: 0 }, '3d')} -- ${formatCoordinate(
        end,
        '3d',
      )};`,
    ),
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
    `\\filldraw[`,
    ...formatTikzOptions(options),
    `]`,
    indentLine(
      `${coordinates.map((name) => `(${name})`).join(' -- ')} -- cycle;`,
    ),
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
  const faceLines = mesh.faces.map((face) =>
    indentLine(
      `\\filldraw ${face.map((vertexIndex) => `(${coordinates[vertexIndex]})`).join(' -- ')} -- cycle;`,
    ),
  )

  return [
    `% Curved sheet "${sheet.name}" [${sheet.id}] sampled mesh export.`,
    ...(sheet.primitive.kind === 'ruledSurface'
      ? ['% Ruled surface generated from two boundary paths.']
      : []),
    ...(sheet.primitive.kind === 'coonsPatch'
      ? ['% Coons patch generated from copied bottom, right, top, and left boundary paths.']
      : []),
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
  const hasSymbolicBoundaryCoordinates = closedBoundariesHaveSymbolicCoordinates(
    sheet.boundaries,
  )
  const scopedPath = hasSymbolicBoundaryCoordinates
    ? null
    : formatWorkPlaneFilledSheetLocalPath(sheet)

  if (scopedPath !== null) {
    const frameOptions = formatTikzPlaneScopeOptions(
      sheet.planeFrame,
      context,
      `work-plane filled sheet "${sheet.name}" [${sheet.id}] frame`,
    )

    if (!frameOptions.ok) {
      return [
        `% Work-plane filled sheet "${sheet.name}" [${sheet.id}] omitted because its local plane frame cannot be exported safely.`,
        `% ${frameOptions.error}`,
        '',
      ]
    }

    context.requiresTikz3dLibrary = true

    return [
      `% Work-plane filled sheet "${sheet.name}" [${sheet.id}] from ${sheet.boundaries.length} closed boundary path${sheet.boundaries.length === 1 ? '' : 's'}.`,
      `% Fill rule: ${sheet.fillRule}; exported in a local TikZ 3d plane scope.`,
      '\\begin{scope}[',
      ...frameOptions.options.map((option) => indentLine(option)),
      ']',
      indentLine('\\filldraw['),
      ...indentLines(formatTikzOptions(options)),
      indentLine(']'),
      ...indentLines(formatClosedBoundaryPathLines(scopedPath)),
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
    hasSymbolicBoundaryCoordinates
      ? `% Work-plane filled sheet "${sheet.name}" [${sheet.id}] uses absolute 3D coordinates to preserve symbolic boundary expressions.`
      : `% Work-plane filled sheet "${sheet.name}" [${sheet.id}] uses absolute 3D coordinates because its local plane scope could not be used.`,
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

  if (curve.kind === 'grid') {
    return emitGrid(curve, context)
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
      indentLine(`${formatConcatenatedPath(coordinates)};`),
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
    indentLine(`${formatCurvePath(curve, coordinates, context.mode)};`),
    '',
  ]
}

function emitGrid(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  context: GenerateContext,
): string[] {
  const pattern = readGridExportPattern(grid)

  if (!pattern.ok) {
    return emitGridOmitted(grid, pattern.error)
  }

  const options = curveStyleOptionsForElement(
    grid.stylePresetId,
    grid.importedTikzStyleReferenceId,
    grid.style,
    `Curve${grid.id}`,
    context,
  )
  const loopVariables = gridLoopVariables(context)
  const scopeBody = emitGridPatternScopeBody(
    grid,
    pattern.pattern,
    context,
    loopVariables,
    options,
  )

  if (!scopeBody.ok) {
    return emitGridOmitted(grid, scopeBody.error)
  }

  if (context.mode === '2d') {
    if (grid.frame.kind !== 'xy' || !isCanonicalGridXyFrame(grid.frame.frame)) {
      return emitGridOmitted(
        grid,
        '2D grid foreach export requires the canonical xy frame at z = 0.',
      )
    }

    return [
      `% Grid "${grid.name}" [${grid.id}] exported with TikZ foreach loops and rectangular clip.`,
      '\\begin{scope}',
      ...scopeBody.lines,
      '\\end{scope}',
      '',
    ]
  }

  if (grid.frame.kind !== 'workPlane') {
    return emitGridOmitted(
      grid,
      '3D grid foreach export requires a stored work-plane frame snapshot.',
    )
  }

  const frameOptions = formatTikzPlaneScopeOptions(
    grid.frame.frame,
    context,
    `grid "${grid.name}" [${grid.id}] frame`,
  )

  if (!frameOptions.ok) {
    return emitGridOmitted(
      grid,
      `its local plane frame cannot be exported safely. ${frameOptions.error}`,
    )
  }

  context.requiresTikz3dLibrary = true

  return [
    `% Grid "${grid.name}" [${grid.id}] exported in a local TikZ 3d plane scope with foreach loops and rectangular clip.`,
    '\\begin{scope}[',
    ...frameOptions.options.map((option) => indentLine(option)),
    ']',
    ...scopeBody.lines,
    '\\end{scope}',
    '',
  ]
}

function readGridExportPattern(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
):
  | {
      ok: true
      pattern: LatticePattern
    }
  | {
      ok: false
      error: string
    } {
  const rawPattern = (grid as { latticePattern?: unknown }).latticePattern

  if (rawPattern !== undefined && !isLatticePattern(rawPattern)) {
    return {
      ok: false,
      error: 'grid lattice pattern must be rectangular, triangular, or honeycomb.',
    }
  }

  return {
    ok: true,
    pattern: gridLatticePattern(grid),
  }
}

function emitGridPatternScopeBody(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  pattern: LatticePattern,
  context: GenerateContext,
  loopVariables: GridLoopVariables,
  options: string[],
):
  | {
      ok: true
      lines: string[]
    }
  | {
      ok: false
      error: string
    } {
  switch (pattern) {
    case 'rectangular':
      return emitRectangularGridScopeBody(
        grid,
        context,
        loopVariables,
        options,
      )
    case 'triangular':
      return emitTriangularGridScopeBody(grid, loopVariables, options)
    case 'honeycomb':
      return emitHoneycombGridScopeBody(grid, loopVariables, options)
  }
}

function emitRectangularGridScopeBody(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  context: GenerateContext,
  loopVariables: GridLoopVariables,
  options: string[],
):
  | {
      ok: true
      lines: string[]
    }
  | {
      ok: false
      error: string
    } {
  const uRange = readGridNumericRange(grid.uRange, 'uRange')
  const vRange = readGridNumericRange(grid.vRange, 'vRange')
  const clip = formatGridClip(grid.clip, context)

  if (!uRange.ok) {
    return uRange
  }

  if (!vRange.ok) {
    return vRange
  }

  if (!clip.ok) {
    return clip
  }

  const uSequence = gridForeachSequence(
    uRange.range,
    clip.clip.uMin.value,
    clip.clip.uMax.value,
    'uRange',
  )
  const vSequence = gridForeachSequence(
    vRange.range,
    clip.clip.vMin.value,
    clip.clip.vMax.value,
    'vRange',
  )

  if (!uSequence.ok) {
    return uSequence
  }

  if (!vSequence.ok) {
    return vSequence
  }

  return {
    ok: true,
    lines: emitGridScopeBody(
      clip.clip,
      uSequence.sequence,
      vSequence.sequence,
      loopVariables,
      options,
    ),
  }
}

function emitTriangularGridScopeBody(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  loopVariables: GridLoopVariables,
  options: string[],
):
  | {
      ok: true
      lines: string[]
    }
  | {
      ok: false
      error: string
    } {
  const values = readNonRectangularGridValues(grid, 'triangular lattice')

  if (!values.ok) {
    return values
  }

  const domain = gridDomainFromBoundsAndClip(
    values.uBounds,
    values.vBounds,
    values.clip,
  )

  if (domain === null) {
    return {
      ok: true,
      lines: [emitGridClipLine(values.clip)],
    }
  }

  const spacing = values.spacing
  const verticalSpacing = (Math.sqrt(3) / 2) * spacing
  const horizontalSequence = gridForeachSequenceFromBounds(
    values.vBounds.min,
    verticalSpacing,
    domain.vMin.value,
    domain.vMax.value,
    'triangular horizontal family',
  )
  const positiveDiagonalSequence = gridForeachSequenceFromBounds(
    values.uBounds.min,
    spacing,
    minGridDomainCornerValue(
      domain,
      (corner) => corner.u - corner.v / Math.sqrt(3),
    ),
    maxGridDomainCornerValue(
      domain,
      (corner) => corner.u - corner.v / Math.sqrt(3),
    ),
    'triangular +60 family',
  )
  const negativeDiagonalSequence = gridForeachSequenceFromBounds(
    values.uBounds.min,
    spacing,
    minGridDomainCornerValue(
      domain,
      (corner) => corner.u + corner.v / Math.sqrt(3),
    ),
    maxGridDomainCornerValue(
      domain,
      (corner) => corner.u + corner.v / Math.sqrt(3),
    ),
    'triangular -60 family',
  )

  if (!horizontalSequence.ok) {
    return horizontalSequence
  }

  if (!positiveDiagonalSequence.ok) {
    return positiveDiagonalSequence
  }

  if (!negativeDiagonalSequence.ok) {
    return negativeDiagonalSequence
  }

  const padding = diagonalGridLinePadding(domain, spacing)
  const paddedUMin = normalizeGridTikzNumber(domain.uMin.value - padding)
  const paddedUMax = normalizeGridTikzNumber(domain.uMax.value + padding)
  const slope = Math.sqrt(3)

  return {
    ok: true,
    lines: [
      emitGridClipLine(domain),
      ...emitGridForeachLoop(
        loopVariables.v,
        horizontalSequence.sequence,
        options,
        formatGridLocalCoordinate(domain.uMin.tikz, loopVariables.v),
        formatGridLocalCoordinate(domain.uMax.tikz, loopVariables.v),
      ),
      ...emitGridForeachLoop(
        loopVariables.u,
        positiveDiagonalSequence.sequence,
        options,
        formatGridLocalCoordinate(
          formatNumber(paddedUMin),
          gridMathExpression(
            `${formatNumber(slope)} * (${formatNumber(paddedUMin)} - ${loopVariables.u})`,
          ),
        ),
        formatGridLocalCoordinate(
          formatNumber(paddedUMax),
          gridMathExpression(
            `${formatNumber(slope)} * (${formatNumber(paddedUMax)} - ${loopVariables.u})`,
          ),
        ),
      ),
      ...emitGridForeachLoop(
        loopVariables.w,
        negativeDiagonalSequence.sequence,
        options,
        formatGridLocalCoordinate(
          formatNumber(paddedUMin),
          gridMathExpression(
            `-${formatNumber(slope)} * (${formatNumber(paddedUMin)} - ${loopVariables.w})`,
          ),
        ),
        formatGridLocalCoordinate(
          formatNumber(paddedUMax),
          gridMathExpression(
            `-${formatNumber(slope)} * (${formatNumber(paddedUMax)} - ${loopVariables.w})`,
          ),
        ),
      ),
    ],
  }
}

function emitHoneycombGridScopeBody(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  loopVariables: GridLoopVariables,
  options: string[],
):
  | {
      ok: true
      lines: string[]
    }
  | {
      ok: false
      error: string
    } {
  const values = readNonRectangularGridValues(grid, 'honeycomb lattice')

  if (!values.ok) {
    return values
  }

  const domain = gridDomainFromBoundsAndClip(
    values.uBounds,
    values.vBounds,
    values.clip,
  )

  if (domain === null) {
    return {
      ok: true,
      lines: [emitGridClipLine(values.clip)],
    }
  }

  const edgeLength = values.spacing
  const columnStep = 1.5 * edgeLength
  const rowStep = Math.sqrt(3) * edgeLength
  const iFirst = Math.floor((domain.uMin.value - edgeLength - values.uBounds.min) / columnStep)
  const iLast = Math.ceil((domain.uMax.value + edgeLength - values.uBounds.min) / columnStep)
  const jFirst = Math.floor(
    (domain.vMin.value - rowStep - values.vBounds.min - rowStep / 2) / rowStep,
  )
  const jLast = Math.ceil(
    (domain.vMax.value + rowStep - values.vBounds.min) / rowStep,
  )
  const evenColumns = integerGridForeachSequence(
    firstIntegerWithParity(iFirst, 0),
    iLast,
    2,
  )
  const oddColumns = integerGridForeachSequence(
    firstIntegerWithParity(iFirst, 1),
    iLast,
    2,
  )
  const rows = integerGridForeachSequence(jFirst, jLast, 1)

  return {
    ok: true,
    lines: [
      emitGridClipLine(domain),
      ...emitHoneycombColumnLoops(
        evenColumns,
        rows,
        0,
        values.uBounds.min,
        values.vBounds.min,
        columnStep,
        rowStep,
        edgeLength,
        loopVariables,
        options,
      ),
      ...emitHoneycombColumnLoops(
        oddColumns,
        rows,
        rowStep / 2,
        values.uBounds.min,
        values.vBounds.min,
        columnStep,
        rowStep,
        edgeLength,
        loopVariables,
        options,
      ),
    ],
  }
}

function emitHoneycombColumnLoops(
  columnSequence: GridForeachSequence,
  rowSequence: GridForeachSequence,
  rowOffset: number,
  baseU: number,
  baseV: number,
  columnStep: number,
  rowStep: number,
  edgeLength: number,
  loopVariables: GridLoopVariables,
  options: string[],
): string[] {
  if (columnSequence.count === 0 || rowSequence.count === 0) {
    return []
  }

  return [
    indentLine(
      `\\foreach ${loopVariables.i} in ${formatGridForeachRange(columnSequence)} {`,
    ),
    indentLine(
      `\\foreach ${loopVariables.j} in ${formatGridForeachRange(rowSequence)} {`,
      2,
    ),
    indentLine('\\draw[', 3),
    ...indentLines(formatTikzOptions(options), 3),
    indentLine(']', 3),
    indentLine(
      `${formatHoneycombHexagonPath(
        baseU,
        baseV,
        columnStep,
        rowStep,
        rowOffset,
        edgeLength,
        loopVariables,
      )};`,
      4,
    ),
    indentLine('}', 2),
    indentLine('}'),
  ]
}

function formatHoneycombHexagonPath(
  baseU: number,
  baseV: number,
  columnStep: number,
  rowStep: number,
  rowOffset: number,
  edgeLength: number,
  loopVariables: GridLoopVariables,
): string {
  const halfHeight = (Math.sqrt(3) / 2) * edgeLength
  const offsets = [
    { u: edgeLength, v: 0 },
    { u: edgeLength / 2, v: halfHeight },
    { u: -edgeLength / 2, v: halfHeight },
    { u: -edgeLength, v: 0 },
    { u: -edgeLength / 2, v: -halfHeight },
    { u: edgeLength / 2, v: -halfHeight },
  ]

  return `${offsets
    .map((offset) =>
      formatGridLocalCoordinate(
        gridMathExpression(
          gridMathSum([
            formatNumber(baseU),
            `${formatNumber(columnStep)} * ${loopVariables.i}`,
            formatNumber(offset.u),
          ]),
        ),
        gridMathExpression(
          gridMathSum([
            formatNumber(baseV),
            `${formatNumber(rowStep)} * ${loopVariables.j}`,
            formatNumber(rowOffset),
            formatNumber(offset.v),
          ]),
        ),
      ),
    )
    .join(' -- ')} -- cycle`
}

type NonRectangularGridValues = {
  uBounds: GridRangeBounds
  vBounds: GridRangeBounds
  clip: GridClipValues
  spacing: number
}

function readNonRectangularGridValues(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  latticeName: 'triangular lattice' | 'honeycomb lattice',
):
  | {
      ok: true
    } & NonRectangularGridValues
  | {
      ok: false
      error: string
    } {
  const uBounds = readGridNumericRangeBounds(grid.uRange, 'uRange')
  const vBounds = readGridNumericRangeBounds(grid.vRange, 'vRange')
  const clip = readGridNumericClip(grid.clip)
  const spacing = readGridNumericRangeScalar(
    grid.uRange.step,
    `${latticeName} spacing`,
  )

  if (!uBounds.ok) {
    return uBounds
  }

  if (!vBounds.ok) {
    return vBounds
  }

  if (!clip.ok) {
    return clip
  }

  if (!spacing.ok) {
    return spacing
  }

  if (spacing.value <= 0) {
    return {
      ok: false,
      error: `${latticeName} spacing must be positive for grid foreach export.`,
    }
  }

  return {
    ok: true,
    uBounds: uBounds.bounds,
    vBounds: vBounds.bounds,
    clip: clip.clip,
    spacing: spacing.value,
  }
}

function readGridNumericRangeBounds(
  range: GridParameterRange,
  fieldName: 'uRange' | 'vRange',
): GridRangeBoundsReadResult {
  const min = readGridNumericRangeScalar(range.min, `${fieldName}.min`)
  const max = readGridNumericRangeScalar(range.max, `${fieldName}.max`)

  if (!min.ok) {
    return min
  }

  if (!max.ok) {
    return max
  }

  if (max.value < min.value) {
    return {
      ok: false,
      error: `${fieldName}.max must be greater than or equal to ${fieldName}.min for grid foreach export.`,
    }
  }

  return {
    ok: true,
    bounds: {
      min: min.value,
      max: max.value,
    },
  }
}

function readGridNumericClip(clip: GridRectangleClip): GridClipFormatResult {
  if (clip.kind !== 'rectangle') {
    return {
      ok: false,
      error: 'grid clip must be a rectangle for foreach export.',
    }
  }

  const uMin = readGridNumericRangeScalar(clip.uMin, 'clip.uMin')
  const uMax = readGridNumericRangeScalar(clip.uMax, 'clip.uMax')
  const vMin = readGridNumericRangeScalar(clip.vMin, 'clip.vMin')
  const vMax = readGridNumericRangeScalar(clip.vMax, 'clip.vMax')

  if (!uMin.ok) {
    return uMin
  }

  if (!uMax.ok) {
    return uMax
  }

  if (!vMin.ok) {
    return vMin
  }

  if (!vMax.ok) {
    return vMax
  }

  if (uMax.value < uMin.value) {
    return {
      ok: false,
      error: 'clip.uMax must be greater than or equal to clip.uMin for grid foreach export.',
    }
  }

  if (vMax.value < vMin.value) {
    return {
      ok: false,
      error: 'clip.vMax must be greater than or equal to clip.vMin for grid foreach export.',
    }
  }

  return {
    ok: true,
    clip: {
      uMin: formattedNumericGridScalar(uMin.value),
      uMax: formattedNumericGridScalar(uMax.value),
      vMin: formattedNumericGridScalar(vMin.value),
      vMax: formattedNumericGridScalar(vMax.value),
    },
  }
}

function formattedNumericGridScalar(value: number): FormattedGridScalar {
  return {
    value,
    tikz: formatNumber(value),
  }
}

function gridDomainFromBoundsAndClip(
  uBounds: GridRangeBounds,
  vBounds: GridRangeBounds,
  clip: GridClipValues,
): GridClipValues | null {
  const uMin = Math.max(uBounds.min, clip.uMin.value)
  const uMax = Math.min(uBounds.max, clip.uMax.value)
  const vMin = Math.max(vBounds.min, clip.vMin.value)
  const vMax = Math.min(vBounds.max, clip.vMax.value)

  if (uMax < uMin - gridTikzEpsilon || vMax < vMin - gridTikzEpsilon) {
    return null
  }

  return {
    uMin: formattedNumericGridScalar(normalizeGridTikzNumber(uMin)),
    uMax: formattedNumericGridScalar(normalizeGridTikzNumber(uMax)),
    vMin: formattedNumericGridScalar(normalizeGridTikzNumber(vMin)),
    vMax: formattedNumericGridScalar(normalizeGridTikzNumber(vMax)),
  }
}

function emitGridClipLine(clip: GridClipValues): string {
  return indentLine(
    `\\clip ${formatGridLocalCoordinate(
      clip.uMin.tikz,
      clip.vMin.tikz,
    )} rectangle ${formatGridLocalCoordinate(clip.uMax.tikz, clip.vMax.tikz)};`,
  )
}

function minGridDomainCornerValue(
  domain: GridClipValues,
  value: (corner: { u: number; v: number }) => number,
): number {
  return Math.min(...gridDomainCorners(domain).map(value))
}

function maxGridDomainCornerValue(
  domain: GridClipValues,
  value: (corner: { u: number; v: number }) => number,
): number {
  return Math.max(...gridDomainCorners(domain).map(value))
}

function gridDomainCorners(domain: GridClipValues): Array<{
  u: number
  v: number
}> {
  return [
    { u: domain.uMin.value, v: domain.vMin.value },
    { u: domain.uMin.value, v: domain.vMax.value },
    { u: domain.uMax.value, v: domain.vMin.value },
    { u: domain.uMax.value, v: domain.vMax.value },
  ]
}

function diagonalGridLinePadding(
  domain: GridClipValues,
  spacing: number,
): number {
  return Math.max(
    spacing,
    domain.uMax.value - domain.uMin.value,
    domain.vMax.value - domain.vMin.value,
  )
}

function gridMathExpression(expression: string): string {
  return `{${expression}}`
}

function gridMathSum(terms: string[]): string {
  return terms
    .filter((term) => term !== '0')
    .join(' + ')
    .replaceAll('+ -', '- ')
    .replaceAll('* -', '* -')
}

function gridForeachSequenceFromBounds(
  base: number,
  step: number,
  lower: number,
  upper: number,
  fieldName: string,
): GridForeachSequenceResult {
  if (!Number.isFinite(step) || step <= 0) {
    return {
      ok: false,
      error: `${fieldName} step must be positive for grid foreach export.`,
    }
  }

  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return {
      ok: false,
      error: `${fieldName} bounds must be finite for grid foreach export.`,
    }
  }

  if (upper < lower - gridTikzEpsilon) {
    return {
      ok: true,
      sequence: {
        count: 0,
        first: 0,
        last: 0,
      },
    }
  }

  const firstIndex = Math.ceil((lower - base) / step - gridTikzEpsilon)
  const lastIndex = Math.floor((upper - base) / step + gridTikzEpsilon)

  if (lastIndex < firstIndex) {
    return {
      ok: true,
      sequence: {
        count: 0,
        first: 0,
        last: 0,
      },
    }
  }

  const count = lastIndex - firstIndex + 1

  if (!Number.isSafeInteger(count)) {
    return {
      ok: false,
      error: `${fieldName} line count must be a finite safe integer for grid foreach export.`,
    }
  }

  const first = normalizeGridTikzNumber(base + firstIndex * step)
  const last = normalizeGridTikzNumber(base + lastIndex * step)
  const next =
    count > 1 ? normalizeGridTikzNumber(base + (firstIndex + 1) * step) : undefined

  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    (next !== undefined && !Number.isFinite(next))
  ) {
    return {
      ok: false,
      error: `${fieldName} produced a non-finite foreach range value.`,
    }
  }

  return {
    ok: true,
    sequence: {
      count,
      first,
      last,
      ...(next === undefined ? {} : { next }),
    },
  }
}

function integerGridForeachSequence(
  first: number,
  upperBound: number,
  step: number,
): GridForeachSequence {
  if (first > upperBound || step <= 0) {
    return {
      count: 0,
      first: 0,
      last: 0,
    }
  }

  const count = Math.floor((upperBound - first) / step) + 1
  const last = first + (count - 1) * step

  return {
    count,
    first,
    last,
    ...(count > 1 ? { next: first + step } : {}),
  }
}

function firstIntegerWithParity(first: number, parity: 0 | 1): number {
  const normalizedParity = ((first % 2) + 2) % 2

  return normalizedParity === parity ? first : first + 1
}

function emitGridScopeBody(
  clip: GridClipValues,
  uSequence: GridForeachSequence,
  vSequence: GridForeachSequence,
  loopVariables: GridLoopVariables,
  options: string[],
): string[] {
  return [
    emitGridClipLine(clip),
    ...emitGridForeachLoop(
      loopVariables.u,
      uSequence,
      options,
      formatGridLocalCoordinate(loopVariables.u, clip.vMin.tikz),
      formatGridLocalCoordinate(loopVariables.u, clip.vMax.tikz),
    ),
    ...emitGridForeachLoop(
      loopVariables.v,
      vSequence,
      options,
      formatGridLocalCoordinate(clip.uMin.tikz, loopVariables.v),
      formatGridLocalCoordinate(clip.uMax.tikz, loopVariables.v),
    ),
  ]
}

function emitGridForeachLoop(
  loopVariable: string,
  sequence: GridForeachSequence,
  options: string[],
  start: string,
  end: string,
): string[] {
  if (sequence.count === 0) {
    return []
  }

  return [
    indentLine(
      `\\foreach ${loopVariable} in ${formatGridForeachRange(sequence)} {`,
    ),
    indentLine('\\draw[', 2),
    ...indentLines(formatTikzOptions(options), 2),
    indentLine(']', 2),
    indentLine(`${start} -- ${end};`, 3),
    indentLine('}'),
  ]
}

function readGridNumericRange(
  range: GridParameterRange,
  fieldName: 'uRange' | 'vRange',
): GridRangeReadResult {
  const min = readGridNumericRangeScalar(range.min, `${fieldName}.min`)
  const max = readGridNumericRangeScalar(range.max, `${fieldName}.max`)
  const step = readGridNumericRangeScalar(range.step, `${fieldName}.step`)

  if (!min.ok) {
    return min
  }

  if (!max.ok) {
    return max
  }

  if (!step.ok) {
    return step
  }

  if (step.value <= 0) {
    return {
      ok: false,
      error: `${fieldName}.step must be positive for grid foreach export.`,
    }
  }

  if (max.value < min.value) {
    return {
      ok: false,
      error: `${fieldName}.max must be greater than or equal to ${fieldName}.min for grid foreach export.`,
    }
  }

  return {
    ok: true,
    range: {
      min: min.value,
      max: max.value,
      step: step.value,
    },
  }
}

function readGridNumericRangeScalar(
  value: ScalarInputValue,
  path: string,
):
  | {
      ok: true
      value: number
    }
  | {
      ok: false
      error: string
    } {
  if (value.kind !== 'numeric') {
    return {
      ok: false,
      error: `${path} is symbolic; grid foreach ranges currently require numeric min, max, and step values.`,
    }
  }

  if (!Number.isFinite(value.value)) {
    return {
      ok: false,
      error: `${path} must be finite for grid foreach export.`,
    }
  }

  return {
    ok: true,
    value: value.value,
  }
}

function formatGridClip(
  clip: GridRectangleClip,
  context: GenerateContext,
): GridClipFormatResult {
  if (clip.kind !== 'rectangle') {
    return {
      ok: false,
      error: 'grid clip must be a rectangle for foreach export.',
    }
  }

  const uMin = formatGridScalar(clip.uMin, context, 'clip.uMin')
  const uMax = formatGridScalar(clip.uMax, context, 'clip.uMax')
  const vMin = formatGridScalar(clip.vMin, context, 'clip.vMin')
  const vMax = formatGridScalar(clip.vMax, context, 'clip.vMax')

  if (!uMin.ok) {
    return uMin
  }

  if (!uMax.ok) {
    return uMax
  }

  if (!vMin.ok) {
    return vMin
  }

  if (!vMax.ok) {
    return vMax
  }

  if (uMax.scalar.value < uMin.scalar.value) {
    return {
      ok: false,
      error: 'clip.uMax must be greater than or equal to clip.uMin for grid foreach export.',
    }
  }

  if (vMax.scalar.value < vMin.scalar.value) {
    return {
      ok: false,
      error: 'clip.vMax must be greater than or equal to clip.vMin for grid foreach export.',
    }
  }

  return {
    ok: true,
    clip: {
      uMin: uMin.scalar,
      uMax: uMax.scalar,
      vMin: vMin.scalar,
      vMax: vMax.scalar,
    },
  }
}

function formatGridScalar(
  value: ScalarInputValue,
  context: GenerateContext,
  path: string,
):
  | {
      ok: true
      scalar: FormattedGridScalar
    }
  | {
      ok: false
      error: string
    } {
  if (value.kind === 'numeric') {
    if (!Number.isFinite(value.value)) {
      return {
        ok: false,
        error: `${path} must be finite for grid foreach export.`,
      }
    }

    return {
      ok: true,
      scalar: {
        value: value.value,
        tikz: formatNumber(value.value),
      },
    }
  }

  if (!Number.isFinite(value.previewValue)) {
    return {
      ok: false,
      error: `${path} symbolic preview value must be finite for grid foreach export.`,
    }
  }

  const parsed = parseScalarExpression(value.expression, {
    variables: context.variables.variableNames,
  })

  if (!parsed.ok) {
    return {
      ok: false,
      error: `${path} ${parsed.error}`,
    }
  }

  const formatted = formatScalarExpressionForTikz(
    parsed.expression,
    context.variables.variableMacros,
  )

  if (!formatted.ok) {
    return {
      ok: false,
      error: `${path} ${formatted.error}`,
    }
  }

  return {
    ok: true,
    scalar: {
      value: value.previewValue,
      tikz: `{${formatted.expression}}`,
    },
  }
}

function gridForeachSequence(
  range: GridRangeValues,
  clipMin: number,
  clipMax: number,
  fieldName: 'uRange' | 'vRange',
): GridForeachSequenceResult {
  const lower = Math.max(range.min, clipMin)
  const upper = Math.min(range.max, clipMax)

  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return {
      ok: false,
      error: `${fieldName} clipped bounds must be finite for grid foreach export.`,
    }
  }

  if (upper < lower - gridTikzEpsilon) {
    return {
      ok: true,
      sequence: {
        count: 0,
        first: 0,
        last: 0,
      },
    }
  }

  const firstIndex = Math.max(
    0,
    Math.ceil((lower - range.min) / range.step - gridTikzEpsilon),
  )
  const lastIndex = Math.floor(
    (upper - range.min) / range.step + gridTikzEpsilon,
  )

  if (lastIndex < firstIndex) {
    return {
      ok: true,
      sequence: {
        count: 0,
        first: 0,
        last: 0,
      },
    }
  }

  const count = lastIndex - firstIndex + 1

  if (!Number.isSafeInteger(count)) {
    return {
      ok: false,
      error: `${fieldName} line count must be a finite safe integer for grid foreach export.`,
    }
  }

  const first = normalizeGridTikzNumber(range.min + firstIndex * range.step)
  const last = normalizeGridTikzNumber(range.min + lastIndex * range.step)
  const next =
    count > 1
      ? normalizeGridTikzNumber(range.min + (firstIndex + 1) * range.step)
      : undefined

  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    (next !== undefined && !Number.isFinite(next))
  ) {
    return {
      ok: false,
      error: `${fieldName} produced a non-finite foreach range value.`,
    }
  }

  return {
    ok: true,
    sequence: {
      count,
      first,
      last,
      ...(next === undefined ? {} : { next }),
    },
  }
}

function formatGridForeachRange(sequence: GridForeachSequence): string {
  if (sequence.count <= 1 || sequence.next === undefined) {
    return `{${formatNumber(sequence.first)}}`
  }

  return `{${formatNumber(sequence.first)},${formatNumber(
    sequence.next,
  )},...,${formatNumber(sequence.last)}}`
}

function formatGridLocalCoordinate(x: string, y: string): string {
  return `(${x},${y})`
}

function gridLoopVariables(context: GenerateContext): GridLoopVariables {
  const usedMacros = new Set(context.variables.variableMacros.values())
  const u = uniqueGridLoopVariable('\\stzGridU', usedMacros)

  usedMacros.add(u)
  const v = uniqueGridLoopVariable('\\stzGridV', usedMacros)

  usedMacros.add(v)
  const w = uniqueGridLoopVariable('\\stzGridW', usedMacros)

  usedMacros.add(w)
  const i = uniqueGridLoopVariable('\\stzGridI', usedMacros)

  usedMacros.add(i)

  return {
    u,
    v,
    w,
    i,
    j: uniqueGridLoopVariable('\\stzGridJ', usedMacros),
  }
}

function uniqueGridLoopVariable(
  preferred: string,
  usedMacros: ReadonlySet<string>,
): string {
  let suffix = ''

  while (true) {
    const candidate = `${preferred}${suffix}`

    if (!usedMacros.has(candidate)) {
      return candidate
    }

    suffix = `${suffix}A`
  }
}

function isCanonicalGridXyFrame(frame: WorkPlaneFrameSnapshot): boolean {
  return (
    isValidWorkPlaneFrameSnapshot(frame) &&
    vec3ApproximatelyEqual(frame.origin, { x: 0, y: 0, z: 0 }) &&
    vec3ApproximatelyEqual(frame.u, { x: 1, y: 0, z: 0 }) &&
    vec3ApproximatelyEqual(frame.v, { x: 0, y: 1, z: 0 }) &&
    vec3ApproximatelyEqual(frame.normal, { x: 0, y: 0, z: 1 })
  )
}

function normalizeGridTikzNumber(value: number): number {
  return Math.abs(value) <= gridTikzEpsilon ? 0 : value
}

function emitGridOmitted(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  reason: string,
): string[] {
  return [
    `% Grid "${grid.name}" [${grid.id}] omitted: ${commentLineText(reason)}`,
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
      indentLine(`${drawCommand};`),
      '\\end{scope}',
      '',
    ]
  }

  return [
    '\\draw[',
    ...formatTikzOptions(options),
    ']',
    indentLine(`${drawCommand};`),
    '',
  ]
}

function emitTemplatePath3D(
  curve: Extract<CurveStratum, { kind: 'templatePath' }>,
  options: string[],
  context: GenerateContext,
): string[] {
  if (hasSymbolicVec3Coordinates(curve.template.center)) {
    return [
      `% Template path "${curve.name}" [${curve.id}] omitted because 3D template centers use local numeric plane coordinates and cannot preserve symbolic center expressions yet.`,
      '',
    ]
  }

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
  const frameOptions = formatTikzPlaneScopeOptions(
    frame,
    context,
    `template path "${curve.name}" [${curve.id}] frame`,
  )

  if (!frameOptions.ok) {
    return [
      `% Template path "${curve.name}" [${curve.id}] omitted because its local plane frame cannot be exported safely.`,
      `% ${frameOptions.error}`,
      '',
    ]
  }

  const drawLines =
    curve.template.kind === 'ellipseTemplate' &&
    (curve.template.rotationDeg ?? 0) !== 0
      ? [
          indentLine(
            `\\begin{scope}[rotate around={${formatNumber(
              curve.template.rotationDeg ?? 0,
            )}:(${formatNumber(localCenter.a)},${formatNumber(localCenter.b)})}]`,
          ),
          indentLine('\\draw[', 2),
          ...indentLines(formatTikzOptions(options), 2),
          indentLine(']', 2),
          indentLine(`${drawCommand};`, 3),
          indentLine('\\end{scope}'),
        ]
      : [
          indentLine('\\draw['),
          ...indentLines(formatTikzOptions(options)),
          indentLine(']'),
          indentLine(`${drawCommand};`, 2),
        ]

  return [
    `% Template path "${curve.name}" [${curve.id}] exported in a local TikZ 3d plane scope.`,
    '\\begin{scope}[',
    ...frameOptions.options.map((option) => indentLine(option)),
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
    indentLine(`${formatConcatenatedPath(coordinates)};`),
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
    indentLine(`${formatConcatenatedPath(runCoordinates)};`),
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
  const workPlaneFrame = workPlaneRelativeBezierControlFrame(curve)

  if (curveHasSymbolicCoordinates(curve)) {
    return workPlaneFrame !== null && workPlaneFrameHasSymbolicMetadata(workPlaneFrame)
      ? [
          `% Curve "${curve.name}" [${curve.id}] omitted because symbolic work-plane-local frame coordinates cannot be preserved when symbolic absolute curve points require fallback export.`,
          '',
        ]
      : null
  }

  const scopedPath = formatScopedWorkPlaneRelativeBezierPath(curve, context.mode)

  if (scopedPath === null) {
    return workPlaneFrame !== null && workPlaneFrameHasSymbolicMetadata(workPlaneFrame)
      ? [
          `% Curve "${curve.name}" [${curve.id}] omitted because its symbolic work-plane-local frame cannot be exported safely without a valid local plane scope.`,
          '',
        ]
      : null
  }

  const frameOptions = formatTikzPlaneScopeOptions(
    scopedPath.frame,
    context,
    `curve "${curve.name}" [${curve.id}] work-plane-local frame`,
  )

  if (!frameOptions.ok) {
    return [
      `% Curve "${curve.name}" [${curve.id}] omitted because its work-plane-local frame cannot be exported safely.`,
      `% ${frameOptions.error}`,
      '',
    ]
  }

  context.requiresTikz3dLibrary = true

  return [
    '\\begin{scope}[',
    ...frameOptions.options.map((option) => indentLine(option)),
    ']',
    indentLine('\\draw['),
    ...indentLines(formatTikzOptions(options)),
    indentLine(']'),
    indentLine(`${scopedPath.path};`, 2),
    '\\end{scope}',
    '',
  ]
}

function workPlaneRelativeBezierControlFrame(
  curve: CurveStratum,
): WorkPlaneFrameSnapshot | null {
  if (curve.kind !== 'cubicBezier') {
    return null
  }

  const controlMode = curve.bezierControls

  return controlMode?.kind === 'workPlaneRelativeCartesian' ||
    controlMode?.kind === 'workPlaneRelativePolar'
    ? controlMode.frame
    : null
}

function workPlaneFrameHasSymbolicMetadata(
  frame: WorkPlaneFrameSnapshot,
): boolean {
  return (
    frame.origin.symbolic !== undefined ||
    frame.u.symbolic !== undefined ||
    frame.v.symbolic !== undefined ||
    frame.normal.symbolic !== undefined
  )
}

type FormatTikzPlaneScopeOptionsResult =
  | {
      ok: true
      options: string[]
    }
  | {
      ok: false
      error: string
    }

function formatTikzPlaneScopeOptions(
  frame: WorkPlaneFrameSnapshot,
  context: GenerateContext,
  frameDescription: string,
): FormatTikzPlaneScopeOptionsResult {
  const origin = formatFrameCoordinate(
    frame.origin,
    context,
    `${frameDescription}.origin`,
  )
  const u = formatFrameCoordinate(
    frame.u,
    context,
    `${frameDescription}.u`,
  )
  const v = formatFrameCoordinate(
    frame.v,
    context,
    `${frameDescription}.v`,
  )
  const normal = validateNumericFrameCoordinate(
    frame.normal,
    context,
    `${frameDescription}.normal`,
  )
  const planeX = formatFrameCoordinate(
    addVec3PreservingSymbolicCoordinates(frame.origin, frame.u),
    context,
    `${frameDescription}.u`,
  )
  const planeY = formatFrameCoordinate(
    addVec3PreservingSymbolicCoordinates(frame.origin, frame.v),
    context,
    `${frameDescription}.v`,
  )

  if (!origin.ok) {
    return origin
  }

  if (!u.ok) {
    return u
  }

  if (!v.ok) {
    return v
  }

  if (!normal.ok) {
    return normal
  }

  if (!planeX.ok) {
    return planeX
  }

  if (!planeY.ok) {
    return planeY
  }

  return {
    ok: true,
    options: [
      `plane origin={${origin.coordinate}},`,
      `plane x={${planeX.coordinate}},`,
      `plane y={${planeY.coordinate}},`,
      'canvas is plane',
    ],
  }
}

function validateNumericFrameCoordinate(
  point: Vec3,
  context: GenerateContext,
  path: string,
): FormatFrameCoordinateResult {
  if (hasSymbolicVec3Coordinates(point)) {
    return {
      ok: false,
      error: `${path} is symbolic, but this frame component is not emitted by TikZ plane scope options.`,
    }
  }

  const formatted = formatFrameCoordinate(point, context, path)

  return formatted.ok
    ? {
        ok: true,
        coordinate: formatted.coordinate,
      }
    : formatted
}

type FormatFrameCoordinateResult =
  | {
      ok: true
      coordinate: string
    }
  | {
      ok: false
      error: string
    }

function formatFrameCoordinate(
  point: Vec3,
  context: GenerateContext,
  path: string,
): FormatFrameCoordinateResult {
  const components = [
    formatFrameCoordinateComponent(point, 'x', context, `${path}.x`),
    formatFrameCoordinateComponent(point, 'y', context, `${path}.y`),
    formatFrameCoordinateComponent(point, 'z', context, `${path}.z`),
  ] as const
  const values: string[] = []

  for (const component of components) {
    if (!component.ok) {
      return component
    }
    values.push(component.value)
  }

  return {
    ok: true,
    coordinate: `(${values.join(',')})`,
  }
}

type FormatFrameCoordinateComponentResult =
  | {
      ok: true
      value: string
    }
  | {
      ok: false
      error: string
    }

function formatFrameCoordinateComponent(
  point: Vec3,
  axis: 'x' | 'y' | 'z',
  context: GenerateContext,
  path: string,
): FormatFrameCoordinateComponentResult {
  if (!Number.isFinite(point[axis])) {
    return {
      ok: false,
      error: `${path} is not finite.`,
    }
  }

  if (point.symbolic === undefined) {
    return {
      ok: true,
      value: formatNumber(point[axis]),
    }
  }

  const symbolic = point.symbolic as Partial<Record<'x' | 'y' | 'z', unknown>>
  const rawComponent = symbolic[axis]

  if (!isCoordinateComponent(rawComponent)) {
    return {
      ok: false,
      error: `${path} symbolic metadata is malformed.`,
    }
  }

  const component = rawComponent

  if (component.kind === 'numeric') {
    if (
      !Number.isFinite(component.value) ||
      !numbersApproximatelyEqual(component.value, point[axis])
    ) {
      return {
        ok: false,
        error: `${path} numeric symbolic metadata does not match the coordinate preview value.`,
      }
    }

    return {
      ok: true,
      value: formatNumber(point[axis]),
    }
  }

  if (!Number.isFinite(component.previewValue)) {
    return {
      ok: false,
      error: `${path} symbolic preview value is not finite.`,
    }
  }

  if (!numbersApproximatelyEqual(component.previewValue, point[axis])) {
    return {
      ok: false,
      error: `${path} symbolic preview value does not match the coordinate preview value.`,
    }
  }

  const parsed = parseScalarExpression(component.expression, {
    variables: context.variables.variableNames,
  })

  if (!parsed.ok) {
    return {
      ok: false,
      error: `${path} ${parsed.error}`,
    }
  }

  const formatted = formatScalarExpressionForTikz(
    parsed.expression,
    context.variables.variableMacros,
  )

  if (!formatted.ok) {
    return {
      ok: false,
      error: `${path} ${formatted.error}`,
    }
  }

  return {
    ok: true,
    value: `{${formatted.expression}}`,
  }
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
    case 'grid':
      return `curveGrid${stem}${elementIndex}`
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
  const coordinate = formatCoordinate(label.position, context.mode, context)
  const labelText = formatLabelTextForTikz(label.text, context.exportMode)

  if (options.length === 0) {
    return [`\\node at ${coordinate} {${labelText}};`, '']
  }

  return [
    '\\node[',
    ...formatTikzOptions(options),
    `] at ${coordinate} {${labelText}};`,
    '',
  ]
}

function formatLabelTextForTikz(
  labelText: string,
  exportMode: TikzExportMode,
): string {
  if (exportMode !== 'inlineMath') {
    return labelText
  }

  // Inline math export is commonly pasted into align-like environments, where
  // physical blank lines are invalid. Normalize raw label line breaks only in
  // emitted TikZ; the stored label text remains unchanged.
  return labelText
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]*\n+[^\S\n]*/g, ' ')
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

function indentLine(line: string, level = 1): string {
  return `${TIKZ_INDENT.repeat(level)}${line}`
}

function indentLines(lines: string[], level = 1): string[] {
  return lines.map((line) =>
    line.length === 0 ? line : indentLine(line, level),
  )
}

function layerSectionComment(sectionTitle: string): string[] {
  return commentSeparatorLines(sectionTitle, TIKZ_INDENT)
}

function labelStyleOptions(
  label: TextLabel,
  context: GenerateContext,
): string[] {
  const importedOptions = importedStyleOptionsForElement(
    'label',
    'node',
    label.importedTikzStyleReferenceId,
    label.stylePresetId,
    label.style,
    context,
  )
  const presetStyleOption = userStylePresetTikzOption(
    'label',
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
    ...importedOptions,
    ...labelStyleTikzOptions(label.style, `Label${label.id}`, context),
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
  const importedOptions = importedStyleOptionsForElement(
    'curve',
    'draw',
    importedTikzStyleReferenceId,
    stylePresetId,
    style,
    context,
  )
  const presetStyleOption = userStylePresetTikzOption(
    'curve',
    stylePresetId,
    style,
    context,
  )

  return presetStyleOption === null
    ? [...importedOptions, ...curveStyleTikzOptions(style, colorBaseName, context)]
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
  const importedOptions = importedStyleOptionsForElement(
    kind,
    'filldraw',
    importedTikzStyleReferenceId,
    stylePresetId,
    style,
    context,
  )
  const presetStyleOption = userStylePresetTikzOption(
    kind,
    stylePresetId,
    style,
    context,
  )

  return presetStyleOption === null
    ? [
        ...importedOptions,
        ...filledSurfaceStyleTikzOptions(style, colorBaseName, context),
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
  const importedOptions = importedStyleOptionsForElement(
    'point',
    'node',
    importedTikzStyleReferenceId,
    stylePresetId,
    style,
    context,
  )
  const presetStyleOption = userStylePresetTikzOption(
    'point',
    stylePresetId,
    style,
    context,
  )

  return presetStyleOption === null
    ? [...importedOptions, ...pointStyleTikzOptions(style, colorBaseName, context)]
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
  commandTarget: TikzStyleTarget,
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

  if (!styleReferenceAppliesToElement(reference, kind, commandTarget)) {
    return []
  }

  const source = context.externalTikzStyleSources.get(reference.sourceId)

  if (source !== undefined) {
    context.externalTikzStyleUsage.use(source)
  }

  return [reference.key]
}

function styleReferenceAppliesToElement(
  reference: ImportedTikzStyleReference,
  kind: StylePresetKind,
  commandTarget: TikzStyleTarget,
): boolean {
  return (
    reference.targets.includes(kind) ||
    reference.targets.includes(commandTarget)
  )
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

function closedBoundariesHaveSymbolicCoordinates(
  boundaries: readonly ClosedPathBoundary[],
): boolean {
  return boundaries.some((boundary) =>
    boundary.segments.some(pathSegmentHasSymbolicCoordinates),
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

function pathSegmentHasSymbolicCoordinates(segment: PathSegment): boolean {
  switch (segment.kind) {
    case 'line':
      return (
        hasSymbolicVec3Coordinates(segment.start) ||
        hasSymbolicVec3Coordinates(segment.end)
      )
    case 'cubicBezier':
      return (
        hasSymbolicVec3Coordinates(segment.start) ||
        hasSymbolicVec3Coordinates(segment.control1) ||
        hasSymbolicVec3Coordinates(segment.control2) ||
        hasSymbolicVec3Coordinates(segment.end)
      )
    case 'arc':
      return (
        hasSymbolicVec3Coordinates(segment.start) ||
        hasSymbolicVec3Coordinates(segment.end) ||
        hasSymbolicVec3Coordinates(segment.center)
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
    case 'grid':
      return true
  }
}

function curveHasSymbolicCoordinates(curve: CurveStratum): boolean {
  switch (curve.kind) {
    case 'polyline':
    case 'cubicBezier':
      return curve.points.some(hasSymbolicVec3Coordinates)
    case 'concatenatedPath':
      return curve.segments.some(pathSegmentHasSymbolicCoordinates)
    case 'templatePath':
      return templatePathCoordinates(curve.template).some(
        hasSymbolicVec3Coordinates,
      )
    case 'grid':
      return false
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
    indentLine(index === paths.length - 1 ? `${path};` : path),
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
    indentLine(index === options.length - 1 ? option : `${option},`),
  )
}

function joinStandaloneTikzLines(lines: string[]): string {
  return `${lines.join('\n')}\n`
}

function joinInlineMathTikzLines(lines: string[]): string {
  return joinTikzLinesNoBlankLines(lines)
}

function joinTikzLinesNoBlankLines(lines: string[]): string {
  return lines
    .flatMap((line) => line.replace(/\r\n?/g, '\n').split('\n'))
    .filter(isNonBlankLine)
    .join('\n')
}

function isNonBlankLine(line: string): boolean {
  return !/^\s*$/.test(line)
}

function inlineMathCommentSection(title: string, lines: string[]): string[] {
  return [...commentSeparatorLines(title), ...lines.filter(isNonBlankLine)]
}

function commentSeparatorLines(title: string, indent = ''): string[] {
  const separator = `${indent}${inlineMathCommentSeparatorLine}`

  return [separator, `${indent}% ${title}`, separator]
}

function section(
  title: string,
  lines: string[],
  exportMode: TikzExportMode = 'standalone',
): string[] {
  if (exportMode === 'inlineMath') {
    return inlineMathCommentSection(title, lines)
  }

  return [
    '% ----------------------------------------------------------------------------',
    `% ${title}`,
    '% ----------------------------------------------------------------------------',
    '',
    ...lines,
    '',
  ]
}

function formatCoordinate(
  point: Vec3,
  mode: TikzMode,
  context?: GenerateContext,
): string {
  const x = formatCoordinateComponent(point, 'x', context)
  const y = formatCoordinateComponent(point, 'y', context)

  if (mode === '2d') {
    return `(${x},${y})`
  }

  return `(${x},${y},${formatCoordinateComponent(point, 'z', context)})`
}

function formatCoordinateComponent(
  point: Vec3,
  axis: 'x' | 'y' | 'z',
  context: GenerateContext | undefined,
): string {
  const component = point.symbolic?.[axis]

  if (component?.kind !== 'symbolic' || context === undefined) {
    return formatNumber(point[axis])
  }

  const parsed = parseScalarExpression(component.expression, {
    variables: context.variables.variableNames,
  })

  if (!parsed.ok) {
    return formatNumber(point[axis])
  }

  const formatted = formatScalarExpressionForTikz(
    parsed.expression,
    context.variables.variableMacros,
  )

  return formatted.ok ? `{${formatted.expression}}` : formatNumber(point[axis])
}

function formatWorkPlaneLocalCoordinate(
  coordinate: WorkPlaneLocalCoordinate,
): string {
  return `(${formatNumber(coordinate.a)},${formatNumber(coordinate.b)})`
}

function formatWorkPlaneLocalOffset(offset: WorkPlaneLocalOffset): string {
  return `(${formatNumber(offset.dx)},${formatNumber(offset.dy)})`
}

function addVec3PreservingSymbolicCoordinates(first: Vec3, second: Vec3): Vec3 {
  const x = addCoordinateComponents(
    coordinateComponentForPoint(first, 'x'),
    coordinateComponentForPoint(second, 'x'),
  )
  const y = addCoordinateComponents(
    coordinateComponentForPoint(first, 'y'),
    coordinateComponentForPoint(second, 'y'),
  )
  const z = addCoordinateComponents(
    coordinateComponentForPoint(first, 'z'),
    coordinateComponentForPoint(second, 'z'),
  )
  const point = {
    x: coordinateComponentPreviewValue(x),
    y: coordinateComponentPreviewValue(y),
    z: coordinateComponentPreviewValue(z),
  }

  return x.kind === 'symbolic' || y.kind === 'symbolic' || z.kind === 'symbolic'
    ? {
        ...point,
        symbolic: { x, y, z },
      }
    : point
}

function coordinateComponentForPoint(
  point: Vec3,
  axis: 'x' | 'y' | 'z',
): CoordinateComponent {
  const rawComponent = point.symbolic?.[axis]

  return rawComponent?.kind === 'symbolic'
    ? {
        kind: 'symbolic',
        expression: rawComponent.expression,
        previewValue: rawComponent.previewValue,
      }
    : {
        kind: 'numeric',
        value: point[axis],
      }
}

function addCoordinateComponents(
  first: CoordinateComponent,
  second: CoordinateComponent,
): CoordinateComponent {
  if (first.kind === 'numeric' && second.kind === 'numeric') {
    return {
      kind: 'numeric',
      value: first.value + second.value,
    }
  }

  const firstPreview = coordinateComponentPreviewValue(first)
  const secondPreview = coordinateComponentPreviewValue(second)

  if (first.kind === 'numeric' && numbersApproximatelyEqual(first.value, 0)) {
    return {
      kind: 'symbolic',
      expression: coordinateComponentExpression(second),
      previewValue: firstPreview + secondPreview,
    }
  }

  if (second.kind === 'numeric' && numbersApproximatelyEqual(second.value, 0)) {
    return {
      kind: 'symbolic',
      expression: coordinateComponentExpression(first),
      previewValue: firstPreview + secondPreview,
    }
  }

  return {
    kind: 'symbolic',
    expression: `(${coordinateComponentExpression(
      first,
    )}) + (${coordinateComponentExpression(second)})`,
    previewValue: firstPreview + secondPreview,
  }
}

function coordinateComponentExpression(component: CoordinateComponent): string {
  return component.kind === 'symbolic'
    ? component.expression
    : formatNumber(component.value)
}

function coordinateComponentPreviewValue(component: CoordinateComponent): number {
  return component.kind === 'symbolic' ? component.previewValue : component.value
}

function isCoordinateComponent(component: unknown): component is CoordinateComponent {
  if (typeof component !== 'object' || component === null || Array.isArray(component)) {
    return false
  }

  const candidate = component as Partial<CoordinateComponent>

  if (candidate.kind === 'numeric') {
    return (
      typeof candidate.value === 'number' &&
      Number.isFinite(candidate.value)
    )
  }

  return (
    candidate.kind === 'symbolic' &&
    typeof candidate.expression === 'string' &&
    typeof candidate.previewValue === 'number' &&
    Number.isFinite(candidate.previewValue)
  )
}

function numbersApproximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= 1e-9
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
