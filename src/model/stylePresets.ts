import {
  cloneCurveStyle,
  cloneLabelStyle,
  clonePointStyle,
  cloneRegionStyle,
  cloneSheetStyle,
} from './styles.ts'
import type {
  Diagram,
  LabelStyle,
  Stratum,
  StratumStyle,
  StylePresetKind,
  UserStylePreset,
} from './types.ts'

export type StylePresetStyle = StratumStyle | LabelStyle

export type CreateUserStylePresetResult = {
  diagram: Diagram
  preset: UserStylePreset
}

const defaultPresetNames: Record<StylePresetKind, string> = {
  region: 'Region preset',
  sheet: 'Sheet preset',
  curve: 'Curve preset',
  point: 'Point preset',
  label: 'Label preset',
}

const defaultPresetIdStems: Record<StylePresetKind, string> = {
  region: 'region-preset',
  sheet: 'sheet-preset',
  curve: 'curve-preset',
  point: 'point-preset',
  label: 'label-preset',
}

export function createUserStylePresetFromStyle(
  diagram: Diagram,
  kind: StylePresetKind,
  rawName: string,
  style: StylePresetStyle,
  importedTikzStyleReferenceId?: string,
): CreateUserStylePresetResult | null {
  if (!isStyleCompatibleWithPresetKind(kind, style)) {
    return null
  }

  const currentPresets = diagram.userStylePresets ?? []
  const name = normalizeStylePresetName(rawName, kind)
  const id = uniqueStylePresetId(kind, name, currentPresets)
  const tikzStyleName = uniqueTikzStyleName(
    tikzStyleNameFromPresetName(name, kind),
    currentPresets.map((preset) => preset.tikzStyleName),
  )
  const preset = createUserStylePreset(
    id,
    name,
    kind,
    style,
    tikzStyleName,
    importedTikzStyleReferenceId,
  )
  const userStylePresets = [...currentPresets, preset]

  return {
    diagram: { ...diagram, userStylePresets },
    preset,
  }
}

export function renameUserStylePreset(
  diagram: Diagram,
  presetId: string,
  rawName: string,
): Diagram {
  const currentPresets = diagram.userStylePresets ?? []
  const preset = currentPresets.find((current) => current.id === presetId)

  if (preset === undefined) {
    return diagram
  }

  const otherPresets = currentPresets.filter((current) => current.id !== presetId)
  const name = normalizeStylePresetName(rawName, preset.kind)
  const tikzStyleName = uniqueTikzStyleName(
    tikzStyleNameFromPresetName(name, preset.kind),
    otherPresets.map((current) => current.tikzStyleName),
  )
  const userStylePresets = currentPresets.map((current) =>
    current.id === presetId ? { ...current, name, tikzStyleName } : current,
  )

  return { ...diagram, userStylePresets }
}

export function updateUserStylePresetStyle(
  diagram: Diagram,
  presetId: string,
  style: StylePresetStyle,
): Diagram {
  const currentPresets = diagram.userStylePresets ?? []
  const preset = currentPresets.find((current) => current.id === presetId)

  if (
    preset === undefined ||
    !isStyleCompatibleWithPresetKind(preset.kind, style)
  ) {
    return diagram
  }

  const updatedPreset = createUserStylePreset(
    preset.id,
    preset.name,
    preset.kind,
    style,
    preset.tikzStyleName,
    preset.importedTikzStyleReferenceId,
  )
  const userStylePresets = currentPresets.map((current) =>
    current.id === presetId ? updatedPreset : current,
  )

  return syncUserStylePresetUsage({ ...diagram, userStylePresets }, updatedPreset)
}

export function deleteUserStylePreset(
  diagram: Diagram,
  presetId: string,
): Diagram {
  const currentPresets = diagram.userStylePresets ?? []

  if (!currentPresets.some((preset) => preset.id === presetId)) {
    return diagram
  }

  const userStylePresets = currentPresets.filter(
    (preset) => preset.id !== presetId,
  )
  const nextDiagram: Diagram = {
    ...diagram,
    ...(userStylePresets.length === 0 ? {} : { userStylePresets }),
  }

  if (userStylePresets.length === 0) {
    delete nextDiagram.userStylePresets
  }

  return clearUserStylePresetUsage(nextDiagram, presetId)
}

export function applyUserStylePresetToStratum(
  diagram: Diagram,
  stratumId: string,
  presetId: string,
): Diagram {
  const preset = findUserStylePreset(diagram, presetId)

  if (preset === undefined) {
    return diagram
  }

  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (stratum.id !== stratumId) {
      return stratum
    }

    const updated = applyPresetToStratum(stratum, preset)

    if (updated !== stratum) {
      changed = true
    }

    return updated
  })

  return changed ? { ...diagram, strata } : diagram
}

export function applyUserStylePresetToLabel(
  diagram: Diagram,
  labelId: string,
  presetId: string,
): Diagram {
  const preset = findUserStylePreset(diagram, presetId)

  if (preset === undefined || preset.kind !== 'label') {
    return diagram
  }

  let changed = false
  const labels = diagram.labels.map((label) => {
    if (label.id !== labelId) {
      return label
    }

    changed = true
    return withImportedTikzStyleReferenceId({
      ...label,
      style: cloneLabelStyle(preset.style),
      stylePresetId: preset.id,
    }, preset.importedTikzStyleReferenceId)
  })

  return changed ? { ...diagram, labels } : diagram
}

export function findUserStylePreset(
  diagram: Diagram,
  presetId: string | undefined,
): UserStylePreset | undefined {
  if (presetId === undefined) {
    return undefined
  }

  return diagram.userStylePresets?.find((preset) => preset.id === presetId)
}

export function stylePresetKindForStyle(
  style: StylePresetStyle,
): StylePresetKind {
  switch (style.kind) {
    case 'regionStyle':
      return 'region'
    case 'sheetStyle':
      return 'sheet'
    case 'curveStyle':
      return 'curve'
    case 'pointStyle':
      return 'point'
    case 'labelStyle':
      return 'label'
  }
}

export function isStylePresetKind(value: string): value is StylePresetKind {
  return (
    value === 'region' ||
    value === 'sheet' ||
    value === 'curve' ||
    value === 'point' ||
    value === 'label'
  )
}

export function isStyleCompatibleWithPresetKind(
  kind: StylePresetKind,
  style: StylePresetStyle,
): boolean {
  return stylePresetKindForStyle(style) === kind
}

export function normalizeStylePresetName(
  rawName: string,
  kind: StylePresetKind,
): string {
  const trimmed = rawName.trim()

  return trimmed.length === 0 ? defaultPresetNames[kind] : trimmed
}

export function tikzStyleNameFromPresetName(
  name: string,
  kind: StylePresetKind,
): string {
  return sanitizeTikzStyleName(
    `stratifiedStyle ${name}`,
    `stratifiedStyle ${defaultPresetNames[kind]}`,
  )
}

export function sanitizeTikzStyleName(
  rawName: string,
  fallback: string,
): string {
  const rawFallbackIdentifier = toIdentifier(fallback) || 'stratifiedStylePreset'
  const fallbackIdentifier = /^[a-zA-Z]/.test(rawFallbackIdentifier)
    ? rawFallbackIdentifier
    : `stratifiedStyle${capitalize(rawFallbackIdentifier)}`
  const identifier = toIdentifier(rawName)
  const safeIdentifier = identifier.length === 0 ? fallbackIdentifier : identifier

  return /^[a-zA-Z]/.test(safeIdentifier)
    ? safeIdentifier
    : `${fallbackIdentifier}${capitalize(safeIdentifier)}`
}

export function uniqueTikzStyleName(
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

export function cloneStylePresetStyle(style: StylePresetStyle): StylePresetStyle {
  switch (style.kind) {
    case 'regionStyle':
      return cloneRegionStyle(style)
    case 'sheetStyle':
      return cloneSheetStyle(style)
    case 'curveStyle':
      return cloneCurveStyle(style)
    case 'pointStyle':
      return clonePointStyle(style)
    case 'labelStyle':
      return cloneLabelStyle(style)
  }
}

export function stylePresetStylesEqual(
  first: StylePresetStyle,
  second: StylePresetStyle,
): boolean {
  if (first.kind !== second.kind) {
    return false
  }

  switch (first.kind) {
    case 'regionStyle':
      return (
        second.kind === 'regionStyle' &&
        first.fillColor === second.fillColor &&
        first.fillOpacity === second.fillOpacity &&
        first.strokeColor === second.strokeColor &&
        first.strokeOpacity === second.strokeOpacity &&
        first.lineWidth === second.lineWidth
      )
    case 'sheetStyle':
      return (
        second.kind === 'sheetStyle' &&
        first.fillColor === second.fillColor &&
        first.fillOpacity === second.fillOpacity &&
        first.strokeColor === second.strokeColor &&
        first.strokeOpacity === second.strokeOpacity &&
        first.lineWidth === second.lineWidth
      )
    case 'curveStyle':
      return (
        second.kind === 'curveStyle' &&
        first.strokeColor === second.strokeColor &&
        first.strokeOpacity === second.strokeOpacity &&
        first.lineWidth === second.lineWidth &&
        first.lineStyle === second.lineStyle
      )
    case 'pointStyle':
      return (
        second.kind === 'pointStyle' &&
        first.color === second.color &&
        first.opacity === second.opacity &&
        first.shape === second.shape &&
        first.fill === second.fill &&
        first.size === second.size
      )
    case 'labelStyle':
      return (
        second.kind === 'labelStyle' &&
        first.color === second.color &&
        first.opacity === second.opacity &&
        first.fontSize === second.fontSize &&
        first.anchor === second.anchor
      )
  }
}

function uniqueStylePresetId(
  kind: StylePresetKind,
  name: string,
  presets: readonly UserStylePreset[],
): string {
  const nameStem = toKebabIdentifier(name)
  const base = `user-${kind}-${nameStem || defaultPresetIdStems[kind]}`
  const usedIds = new Set(presets.map((preset) => preset.id))

  if (!usedIds.has(base)) {
    return base
  }

  let suffix = 2
  while (usedIds.has(`${base}-${suffix}`)) {
    suffix += 1
  }

  return `${base}-${suffix}`
}

function createUserStylePreset(
  id: string,
  name: string,
  kind: StylePresetKind,
  style: StylePresetStyle,
  tikzStyleName: string,
  importedTikzStyleReferenceId?: string,
): UserStylePreset {
  const importedStyleReference =
    importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId }

  switch (kind) {
    case 'region':
      if (style.kind !== 'regionStyle') {
        throw new Error('Region presets require a region style.')
      }

      return {
        id,
        name,
        kind,
        style: cloneRegionStyle(style),
        tikzStyleName,
        ...importedStyleReference,
      }
    case 'sheet':
      if (style.kind !== 'sheetStyle') {
        throw new Error('Sheet presets require a sheet style.')
      }

      return {
        id,
        name,
        kind,
        style: cloneSheetStyle(style),
        tikzStyleName,
        ...importedStyleReference,
      }
    case 'curve':
      if (style.kind !== 'curveStyle') {
        throw new Error('Curve presets require a curve style.')
      }

      return {
        id,
        name,
        kind,
        style: cloneCurveStyle(style),
        tikzStyleName,
        ...importedStyleReference,
      }
    case 'point':
      if (style.kind !== 'pointStyle') {
        throw new Error('Point presets require a point style.')
      }

      return {
        id,
        name,
        kind,
        style: clonePointStyle(style),
        tikzStyleName,
        ...importedStyleReference,
      }
    case 'label':
      if (style.kind !== 'labelStyle') {
        throw new Error('Label presets require a label style.')
      }

      return {
        id,
        name,
        kind,
        style: cloneLabelStyle(style),
        tikzStyleName,
        ...importedStyleReference,
      }
  }
}

function syncUserStylePresetUsage(
  diagram: Diagram,
  preset: UserStylePreset,
): Diagram {
  return {
    ...diagram,
    strata: diagram.strata.map((stratum) =>
      stratum.stylePresetId === preset.id
        ? applyPresetToStratum(stratum, preset)
        : stratum,
    ),
    labels: diagram.labels.map((label) =>
      label.stylePresetId === preset.id && preset.kind === 'label'
        ? withImportedTikzStyleReferenceId(
            { ...label, style: cloneLabelStyle(preset.style) },
            preset.importedTikzStyleReferenceId,
          )
        : label,
    ),
  }
}

function clearUserStylePresetUsage(
  diagram: Diagram,
  presetId: string,
): Diagram {
  return {
    ...diagram,
    strata: diagram.strata.map((stratum) =>
      stratum.stylePresetId === presetId
        ? clearStylePresetId(stratum)
        : stratum,
    ),
    labels: diagram.labels.map((label) =>
      label.stylePresetId === presetId ? clearStylePresetId(label) : label,
    ),
  }
}

function applyPresetToStratum(
  stratum: Stratum,
  preset: UserStylePreset,
): Stratum {
  switch (stratum.geometricKind) {
    case 'region':
      return preset.kind === 'region'
        ? withImportedTikzStyleReferenceId({
            ...stratum,
            style: cloneRegionStyle(preset.style),
            stylePresetId: preset.id,
          }, preset.importedTikzStyleReferenceId)
        : stratum
    case 'sheet':
      return preset.kind === 'sheet'
        ? withImportedTikzStyleReferenceId({
            ...stratum,
            style: cloneSheetStyle(preset.style),
            stylePresetId: preset.id,
          }, preset.importedTikzStyleReferenceId)
        : stratum
    case 'curve':
      return preset.kind === 'curve'
        ? withImportedTikzStyleReferenceId({
            ...stratum,
            style: cloneCurveStyle(preset.style),
            stylePresetId: preset.id,
          }, preset.importedTikzStyleReferenceId)
        : stratum
    case 'point':
      return preset.kind === 'point'
        ? withImportedTikzStyleReferenceId({
            ...stratum,
            style: clonePointStyle(preset.style),
            stylePresetId: preset.id,
          }, preset.importedTikzStyleReferenceId)
        : stratum
  }
}

function withImportedTikzStyleReferenceId<
  T extends { importedTikzStyleReferenceId?: string },
>(value: T, importedTikzStyleReferenceId: string | undefined): T {
  const nextValue = { ...value }

  if (importedTikzStyleReferenceId === undefined) {
    delete nextValue.importedTikzStyleReferenceId
    return nextValue
  }

  nextValue.importedTikzStyleReferenceId = importedTikzStyleReferenceId
  return nextValue
}

function clearStylePresetId<T extends { stylePresetId?: string }>(value: T): T {
  const nextValue = { ...value }

  delete nextValue.stylePresetId

  return nextValue
}

function toIdentifier(rawName: string): string {
  const words = rawName.match(/[a-zA-Z0-9]+/g) ?? []

  return words
    .map((word, index) =>
      index === 0 ? decapitalize(word) : capitalize(word),
    )
    .join('')
}

function toKebabIdentifier(rawName: string): string {
  return (rawName.match(/[a-zA-Z0-9]+/g) ?? [])
    .map((word) => word.toLowerCase())
    .join('-')
}

function capitalize(value: string): string {
  return value.length === 0
    ? value
    : `${value[0].toUpperCase()}${value.slice(1)}`
}

function decapitalize(value: string): string {
  return value.length === 0
    ? value
    : `${value[0].toLowerCase()}${value.slice(1)}`
}
