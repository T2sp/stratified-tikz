import type {
  CurveStratum,
  Diagram,
  HexColor,
  LabelStyle,
  LineStyle,
  PointShape,
  PointStratum,
  SheetStratum,
  TextLabel,
  Vec3,
} from '../model/types'
import { sheetVertices } from '../model/sheets.ts'

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

type GenerateContext = {
  mode: TikzMode
  colors: ColorRegistry
  coordinates: CoordinateRegistry
}

export function generateTikz(diagram: Diagram): string {
  return diagram.ambientDimension === 2
    ? generateTikz2D(diagram)
    : generateTikz3D(diagram)
}

export function generateTikz2D(diagram: Diagram): string {
  const context = createContext('2d')
  const curves = sortByLayer(
    diagram.strata.filter(
      (stratum): stratum is CurveStratum =>
        stratum.geometricKind === 'curve' && stratum.codim === 1,
    ),
  ).flatMap((curve, index) => emitCurve(curve, index, context))
  const points = sortByLayer(
    diagram.strata.filter(
      (stratum): stratum is PointStratum =>
        stratum.geometricKind === 'point' && stratum.codim === 2,
    ),
  ).flatMap((point, index) => emitPoint(point, index, context))
  const labels = sortByLayer(diagram.labels).flatMap((label) =>
    emitLabel(label, context),
  )

  return assembleTikz({
    context,
    bodySections: [
      section('Coordinates', emitCoordinateDefinitions(context)),
      section('Codimension 1 strata: curves', curves),
      section('Codimension 2 strata: points', points),
      section('Labels', labels),
    ],
  })
}

export function generateTikz3D(diagram: Diagram): string {
  const context = createContext('3d')
  const sheets = sortByLayer(
    diagram.strata.filter(
      (stratum): stratum is SheetStratum =>
        stratum.geometricKind === 'sheet' && stratum.codim === 1,
    ),
  ).flatMap((sheet, index) => emitSheet(sheet, index, context))
  const curves = sortByLayer(
    diagram.strata.filter(
      (stratum): stratum is CurveStratum =>
        stratum.geometricKind === 'curve' && stratum.codim === 2,
    ),
  ).flatMap((curve, index) => emitCurve(curve, index, context))
  const points = sortByLayer(
    diagram.strata.filter(
      (stratum): stratum is PointStratum =>
        stratum.geometricKind === 'point' && stratum.codim === 3,
    ),
  ).flatMap((point, index) => emitPoint(point, index, context))
  const labels = sortByLayer(diagram.labels).flatMap((label) =>
    emitLabel(label, context),
  )

  return assembleTikz({
    context,
    bodySections: [
      section('Coordinates', emitCoordinateDefinitions(context)),
      section('Codimension 1 strata: sheets', sheets),
      section('Codimension 2 strata: curves', curves),
      section('Codimension 3 strata: points', points),
      section('Labels', labels),
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

function createContext(mode: TikzMode): GenerateContext {
  return {
    mode,
    colors: new ColorRegistry(),
    coordinates: new CoordinateRegistry(),
  }
}

function assembleTikz({
  context,
  bodySections,
}: {
  context: GenerateContext
  bodySections: string[][]
}): string {
  const lines = [
    ...section('Styles and colors', [
      ...emitRequiredLibraryComment(context),
      ...context.colors.emitDefinitions(),
      ...emitTikzPictureStart(context.mode),
    ]),
    ...bodySections.flat(),
    '\\end{tikzpicture}',
  ]

  return `${lines.join('\n')}\n`
}

function emitTikzPictureStart(mode: TikzMode): string[] {
  if (mode === '2d') {
    return ['\\begin{tikzpicture}[', '  line cap=round,', '  line join=round', ']']
  }

  return [
    '\\begin{tikzpicture}[',
    '  x={(1cm,0cm)},',
    '  y={(0.45cm,0.25cm)},',
    '  z={(0cm,1cm)},',
    '  line cap=round,',
    '  line join=round',
    ']',
  ]
}

function emitRequiredLibraryComment(context: GenerateContext): string[] {
  if (!context.coordinates.hasNonCircularPointShape) {
    return []
  }

  return [
    '% Required TikZ libraries for non-circular point shapes:',
    '% \\usetikzlibrary{shapes.geometric,shapes.symbols}',
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

  return [
    `\\path[`,
    `  fill=${fillColor},`,
    `  fill opacity=${formatNumber(sheet.style.fillOpacity)},`,
    `  draw=${strokeColor},`,
    `  draw opacity=${formatNumber(sheet.style.strokeOpacity)}`,
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
  const coordinates = curve.points.map((point, index) =>
    context.coordinates.define(
      curveCoordinateBaseName(curve, elementIndex),
      index,
      point,
    ),
  )
  const lineStyleOption = lineStyleToTikzOption(curve.style.lineStyle)
  const options = [
    `draw=${strokeColor}`,
    `draw opacity=${formatNumber(curve.style.strokeOpacity)}`,
    `line width=${formatNumber(curve.style.lineWidth)}pt`,
    ...(lineStyleOption === null ? [] : [lineStyleOption]),
  ]

  return [
    '\\draw[',
    ...formatTikzOptions(options),
    ']',
    `  ${formatCurvePath(curve, coordinates)};`,
    '',
  ]
}

function curveCoordinateBaseName(
  curve: CurveStratum,
  elementIndex: number,
): string {
  const stem = sanitizeTikzNameStem(curve.name, 'curve')

  return curve.kind === 'cubicBezier'
    ? `curveBezier${stem}${elementIndex}`
    : `curvePoly${stem}${elementIndex}`
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

function formatCurvePath(curve: CurveStratum, coordinates: string[]): string {
  if (curve.kind === 'cubicBezier' && coordinates.length === 4) {
    return `(${coordinates[0]}) .. controls (${coordinates[1]}) and (${coordinates[2]}) .. (${coordinates[3]})`
  }

  return coordinates.map((name) => `(${name})`).join(' -- ')
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

function formatNumber(value: number): string {
  if (Object.is(value, -0)) {
    return '0'
  }

  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toFixed(6)))
}

function sortByLayer<T extends { layer: number; id: string }>(items: T[]): T[] {
  return [...items].sort((first, second) => {
    if (first.layer !== second.layer) {
      return first.layer - second.layer
    }

    return first.id.localeCompare(second.id)
  })
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
