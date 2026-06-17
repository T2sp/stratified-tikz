import type {
  ConcatenatedPathStratum,
  CubicBezierCurveStratum,
  CubicBezierControlMode,
  Camera3D,
  CurveStratum,
  Diagram,
  HexColor,
  LabelStyle,
  LineStyle,
  PointShape,
  PointStratum,
  SheetStratum,
  TextLabel,
  OrthographicCamera3D,
  PathSegment,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinate,
  WorkPlaneLocalOffset,
} from '../model/types'
import { sheetVertices } from '../model/sheets.ts'
import {
  createInitialCamera3D,
  isOrthographicCamera3D,
} from '../model/camera.ts'
import {
  absoluteCubicBezierPointsFromControlMode,
  pointFromWorkPlaneLocalCoordinate,
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

type PointCurveStratum = Exclude<CurveStratum, ConcatenatedPathStratum>

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

export type GenerateTikzOptions = {
  includeCoordinateAxes?: boolean
  camera3d?: Camera3D
}

type GenerateContext = {
  mode: TikzMode
  camera3d?: OrthographicCamera3D
  colors: ColorRegistry
  coordinates: CoordinateRegistry
  hasSavedPaths: boolean
  requiresTikz3dLibrary: boolean
  includeCoordinateAxes: boolean
}

const coordinateAxesGuideLayerName = 'stratifiedGuideLayer'
const coordinateAxesGuideColor: HexColor = '#64748B'
const coordinateAxesGuideLength = 2.5
const coordinateAxesGuideLabelOffset = 0.25

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
  const context = createContext('2d', options)
  const curveSectionTitle = 'Codimension 1 strata: curves'
  const pointSectionTitle = 'Codimension 2 strata: points'
  const labelSectionTitle = 'Labels'
  const sectionTitles = [
    curveSectionTitle,
    pointSectionTitle,
    labelSectionTitle,
  ]
  const drawingCommands = [
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
  const context = createContext('3d', options, resolveTikzCamera3D(diagram, options))
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
  const normalizedLayer = Object.is(layer, -0) ? 0 : layer
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
  camera3d?: OrthographicCamera3D,
): GenerateContext {
  return {
    mode,
    ...(mode === '3d' && camera3d !== undefined ? { camera3d } : {}),
    colors: new ColorRegistry(),
    coordinates: new CoordinateRegistry(),
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
  if (context.mode === '2d') {
    return ['\\begin{tikzpicture}[', '  line cap=round,', '  line join=round', ']']
  }

  return [
    '\\begin{tikzpicture}[',
    '  tdplot_main_coords,',
    '  line cap=round,',
    '  line join=round',
    ']',
  ]
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
  const fillColor = context.colors.define(
    `Sheet${sheet.id}Fill`,
    sheet.style.fillColor,
  )
  const strokeColor = context.colors.define(
    `Sheet${sheet.id}Stroke`,
    sheet.style.strokeColor,
  )
  const coordinates = sheetVertices(sheet).map((vertex, index) =>
    context.coordinates.define(
      sheetCoordinateBaseName(sheet, elementIndex),
      index,
      vertex,
    ),
  )
  const options = [
    `fill=${fillColor}`,
    `fill opacity=${formatNumber(sheet.style.fillOpacity)}`,
    `draw=${strokeColor}`,
    `draw opacity=${formatNumber(sheet.style.strokeOpacity)}`,
    ...spathSaveOptions(
      sheet.kind === 'polygonSheet' ? sheet.pathLabel : undefined,
      context,
    ),
  ]

  return [
    `\\path[`,
    ...formatTikzOptions(options),
    `]`,
    `  ${coordinates.map((name) => `(${name})`).join(' -- ')} -- cycle;`,
    '',
  ]
}

function sheetCoordinateBaseName(
  sheet: SheetStratum,
  elementIndex: number,
): string {
  const stem = sanitizeTikzNameStem(sheet.name, 'sheet')

  return sheet.kind === 'polygonSheet'
    ? `sheetPoly${stem}${elementIndex}`
    : `sheetQuad${stem}${elementIndex}`
}

function emitCurve(
  curve: CurveStratum,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  const strokeColor = context.colors.define(
    `Curve${curve.id}Stroke`,
    curve.style.strokeColor,
  )
  const lineStyleOption = lineStyleToTikzOption(curve.style.lineStyle)
  const options = [
    `draw=${strokeColor}`,
    `draw opacity=${formatNumber(curve.style.strokeOpacity)}`,
    `line width=${formatNumber(curve.style.lineWidth)}pt`,
    ...(lineStyleOption === null ? [] : [lineStyleOption]),
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

  if (curve.kind === 'concatenatedPath') {
    const coordinates = defineConcatenatedPathCoordinates(
      curve,
      elementIndex,
      context,
    )

    return [
      '\\draw[',
      ...formatTikzOptions(options),
      ']',
      `  ${formatConcatenatedPath(coordinates)};`,
      '',
    ]
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
    case 'polyline':
      return `curvePoly${stem}${elementIndex}`
  }
}

function emitPoint(
  point: PointStratum,
  elementIndex: number,
  context: GenerateContext,
): string[] {
  const pointColor = context.colors.define(`Point${point.id}`, point.style.color)
  const coordinate = context.coordinates.define(
    pointCoordinateBaseName(point, elementIndex),
    0,
    point.position,
  )
  const options = [
    ...pointShapeOptions(point.style.shape, context),
    `fill=${point.style.fill === 'filled' ? pointColor : 'white'}`,
    `draw=${pointColor}`,
    `opacity=${formatNumber(point.style.opacity)}`,
    `inner sep=${formatNumber(point.style.size / 2)}pt`,
  ]

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
  if (isDefaultLabelStyle(label.style)) {
    return []
  }

  const labelColor = context.colors.define(`Label${label.id}`, label.style.color)

  return [
    `text=${labelColor}`,
    `opacity=${formatNumber(label.style.opacity)}`,
    `font=\\fontsize{${formatNumber(label.style.fontSize)}pt}{${formatNumber(
      label.style.fontSize * 1.2,
    )}pt}\\selectfont`,
    `anchor=${label.style.anchor}`,
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

    pointIndex += segment.kind === 'line' ? 1 : 3
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

function formatPathSegmentCommand(segment: PathSegmentCoordinateNames): string {
  switch (segment.kind) {
    case 'line':
      return `-- (${segment.end})`
    case 'cubicBezier':
      return `.. controls (${segment.control1}) and (${segment.control2}) .. (${segment.end})`
  }
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
