import {
  defaultCurveStyle,
  defaultLabelStyle,
  defaultPointStyle,
} from '../model/styles.ts'
import {
  applyUserStylePresetToLabel,
  applyUserStylePresetToStratum,
  findUserStylePreset,
} from '../model/stylePresets.ts'
import type {
  Diagram,
  EndpointArrowMode,
  ExternalTikzStyleSource,
  ImportedTikzStyleReference,
  PointFill,
  StylePresetKind,
  UserStylePreset,
} from '../model/types.ts'
import { endpointArrowModes, pointFills } from '../model/types.ts'
import {
  applyBulkStyleField,
  bulkMixedValueLabel,
  createBulkStyleEditorModel,
  defaultFilledSurfaceLineWidth,
  type BulkFieldScalarValue,
  type BulkFieldValue,
  type BulkStyleField,
  type BulkStyleFieldId,
} from './bulkEditing.ts'
import {
  parseOpacity,
  parsePositiveFiniteNumber,
} from './diagramUpdates.ts'
import {
  opacityDraftWarning,
  positiveNumberDraftWarning,
  updateInspectorNumericDraft,
  type InspectorNumberParser,
  type InspectorNumericDraftUpdate,
} from './inspector/numericInput.ts'
import {
  findSelectedElement,
  selectedElements,
  type SelectableGeometricKind,
  type SelectedElement,
  type SingleSelectedElement,
} from './selection.ts'

export const contextQuickStyleMixedValueLabel = bulkMixedValueLabel

export type ContextQuickStyleChangeOptions = {
  coalesceUndo?: boolean
}

export type ContextQuickStyleSliderParseKind = 'opacity' | 'positiveNumber'

export type ContextQuickStyleSliderSpec = {
  min: number
  max: number
  step: number
  fallbackValue: number
  unit?: string
  parseKind: ContextQuickStyleSliderParseKind
}

export type ContextQuickStyleField =
  | {
      id: BulkStyleFieldId
      label: string
      input: 'color'
      value: BulkFieldValue<string>
    }
  | {
      id: BulkStyleFieldId
      label: string
      input: 'select'
      value: BulkFieldValue<string>
      options: readonly string[]
      optionLabel: (value: string) => string
    }
  | {
      id: BulkStyleFieldId
      label: string
      input: 'slider'
      value: BulkFieldValue<number>
      slider: ContextQuickStyleSliderSpec
    }

export type ContextQuickStyleBarModel = {
  geometricKind: SelectableGeometricKind
  count: number
  label: string
  fields: ContextQuickStyleField[]
}

export type ContextQuickStylePresetOption = {
  presetId: string
  name: string
  tikzStyleName: string
  origin: 'user' | 'imported'
  recent: boolean
  importedKey?: string
  sourceName?: string
}

export type ContextQuickStylePresetCurrentState =
  | { kind: 'none' }
  | { kind: 'mixed' }
  | {
      kind: 'preset'
      presetId: string
      label: string
    }

export type ContextQuickStylePresetModel = {
  geometricKind: StylePresetKind
  count: number
  options: ContextQuickStylePresetOption[]
  current: ContextQuickStylePresetCurrentState
}

export type ContextQuickStylePresetApplyResult =
  | {
      ok: true
      diagram: Diagram
      appliedCount: number
      message: string
    }
  | {
      ok: false
      diagram: Diagram
      message: string
    }

type ContextQuickStyleTarget = {
  kind: 'stratum' | 'label'
  id: string
  geometricKind: StylePresetKind
}

export const maxRecentContextQuickStylePresetIds = 6

export const contextQuickStyleEndpointArrowLabels: Readonly<
  Record<EndpointArrowMode, string>
> = {
  none: 'None',
  forward: 'Forward',
  backward: 'Backward',
  both: 'Both',
}

export const contextQuickStylePointFillLabels: Readonly<
  Record<PointFill, string>
> = {
  filled: 'Filled',
  hollow: 'Hollow',
}

export function createContextQuickStyleBarModel(
  diagram: Diagram,
  selection: SelectedElement,
): ContextQuickStyleBarModel | null {
  const bulkModel = createBulkStyleEditorModel(diagram, selection)

  if (bulkModel === null || bulkModel.count === 0) {
    return null
  }

  const allBulkFields = [...bulkModel.fields, ...bulkModel.arrowFields]
  const fieldsById = new Map(
    allBulkFields.map((field) => [field.id, field] as const),
  )

  switch (bulkModel.geometricKind) {
    case 'curve':
      return {
        geometricKind: bulkModel.geometricKind,
        count: bulkModel.count,
        label: contextQuickStyleSelectionLabel('curve', bulkModel.count),
        fields: compactFields([
          colorQuickField(fieldsById, 'curve.strokeColor', 'Stroke'),
          sliderQuickField(fieldsById, 'curve.lineWidth', 'Width', {
            min: 0.1,
            max: 8,
            step: 0.1,
            fallbackValue: defaultCurveStyle.lineWidth,
            unit: 'pt',
            parseKind: 'positiveNumber',
          }),
          selectQuickField(
            fieldsById,
            'curve.arrowEndpoint',
            'Arrow',
            endpointArrowModes,
            endpointArrowLabel,
          ),
        ]),
      }
    case 'point':
      return {
        geometricKind: bulkModel.geometricKind,
        count: bulkModel.count,
        label: contextQuickStyleSelectionLabel('point', bulkModel.count),
        fields: compactFields([
          colorQuickField(fieldsById, 'point.color', 'Color'),
          sliderQuickField(fieldsById, 'point.size', 'Radius', {
            min: 0.1,
            max: 12,
            step: 0.1,
            fallbackValue: defaultPointStyle.size,
            unit: 'pt',
            parseKind: 'positiveNumber',
          }),
          selectQuickField(
            fieldsById,
            'point.fill',
            'Fill',
            pointFills,
            pointFillLabel,
          ),
        ]),
      }
    case 'sheet':
      return filledSurfaceQuickStyleModel(
        bulkModel.geometricKind,
        bulkModel.count,
        fieldsById,
        'sheet',
      )
    case 'region':
      return filledSurfaceQuickStyleModel(
        bulkModel.geometricKind,
        bulkModel.count,
        fieldsById,
        'region',
      )
    case 'label':
      return {
        geometricKind: bulkModel.geometricKind,
        count: bulkModel.count,
        label: contextQuickStyleSelectionLabel('label', bulkModel.count),
        fields: compactFields([
          colorQuickField(fieldsById, 'label.color', 'Text'),
          sliderQuickField(fieldsById, 'label.fontSize', 'Font size', {
            min: 1,
            max: 48,
            step: 0.1,
            fallbackValue: defaultLabelStyle.fontSize,
            unit: 'pt',
            parseKind: 'positiveNumber',
          }),
        ]),
      }
    case 'coordinate':
      return null
  }
}

export function applyContextQuickStyleField(
  diagram: Diagram,
  selection: SelectedElement,
  fieldId: BulkStyleFieldId,
  value: BulkFieldScalarValue,
): Diagram {
  const model = createContextQuickStyleBarModel(diagram, selection)

  if (model === null || !model.fields.some((field) => field.id === fieldId)) {
    return diagram
  }

  return applyBulkStyleField(diagram, selection, fieldId, value)
}

export function createContextQuickStylePresetModel(
  diagram: Diagram,
  selection: SelectedElement,
  recentPresetIds: readonly string[] = [],
): ContextQuickStylePresetModel | null {
  const resolvedTargets = resolveContextQuickStyleTargets(diagram, selection)

  if (!resolvedTargets.ok) {
    return null
  }

  const importedReferencesById = new Map(
    (diagram.importedTikzStyleReferences ?? []).map((reference) => [
      reference.id,
      reference,
    ]),
  )
  const externalSourcesById = new Map(
    (diagram.externalTikzStyleSources ?? []).map((source) => [
      source.id,
      source,
    ]),
  )
  const currentPresetId = commonPresetId(diagram, resolvedTargets.targets)
  const options = contextQuickStylePresetOptions(
    diagram.userStylePresets ?? [],
    resolvedTargets.geometricKind,
    importedReferencesById,
    externalSourcesById,
    currentPresetId.kind === 'preset' ? currentPresetId.presetId : undefined,
    recentPresetIds,
  )

  return {
    geometricKind: resolvedTargets.geometricKind,
    count: resolvedTargets.targets.length,
    options,
    current: contextQuickStylePresetCurrentState(options, currentPresetId),
  }
}

export function updateRecentContextQuickStylePresetIds(
  current: readonly string[],
  presetId: string,
): string[] {
  return [
    presetId,
    ...current.filter((candidate) => candidate !== presetId),
  ].slice(0, maxRecentContextQuickStylePresetIds)
}

export function filterContextQuickStylePresetOptions(
  options: readonly ContextQuickStylePresetOption[],
  filter: string,
): ContextQuickStylePresetOption[] {
  const normalizedFilter = filter.trim().toLowerCase()

  if (normalizedFilter.length === 0) {
    return [...options]
  }

  return options.filter((option) =>
    [
      option.name,
      option.tikzStyleName,
      option.origin,
      option.importedKey,
      option.sourceName,
    ]
      .filter((value): value is string => value !== undefined)
      .join(' ')
      .toLowerCase()
      .includes(normalizedFilter),
  )
}

export function applyContextQuickStylePreset(
  diagram: Diagram,
  selection: SelectedElement,
  presetId: string | null,
): ContextQuickStylePresetApplyResult {
  const resolvedTargets = resolveContextQuickStyleTargets(diagram, selection)

  if (!resolvedTargets.ok) {
    return {
      ok: false,
      diagram,
      message: resolvedTargets.message,
    }
  }

  if (presetId === null) {
    const nextDiagram = clearContextQuickStylePresetReferences(
      diagram,
      resolvedTargets.targets,
    )

    return {
      ok: true,
      diagram: nextDiagram,
      appliedCount: resolvedTargets.targets.length,
      message:
        nextDiagram === diagram
          ? 'No TikZ style reference to clear.'
          : `Cleared TikZ style from ${styleObjectCountLabel(
              resolvedTargets.targets.length,
            )}.`,
    }
  }

  const preset = findUserStylePreset(diagram, presetId)

  if (preset === undefined) {
    return {
      ok: false,
      diagram,
      message: 'Selected TikZ style is no longer available.',
    }
  }

  if (preset.kind !== resolvedTargets.geometricKind) {
    return {
      ok: false,
      diagram,
      message: `TikZ style "${preset.name}" can only be applied to ${preset.kind} objects.`,
    }
  }

  const nextDiagram = resolvedTargets.targets.reduce((currentDiagram, target) => {
    return target.kind === 'label'
      ? applyUserStylePresetToLabel(currentDiagram, target.id, preset.id)
      : applyUserStylePresetToStratum(currentDiagram, target.id, preset.id)
  }, diagram)

  return {
    ok: true,
    diagram: nextDiagram,
    appliedCount: resolvedTargets.targets.length,
    message: `Applied TikZ style "${preset.name}" to ${styleObjectCountLabel(
      resolvedTargets.targets.length,
    )}.`,
  }
}

export function updateContextQuickStyleNumericDraft(
  field: Extract<ContextQuickStyleField, { input: 'slider' }>,
  draft: string,
): InspectorNumericDraftUpdate {
  return updateInspectorNumericDraft(
    draft,
    parserForSliderSpec(field.slider),
    contextQuickStyleNumericWarning(field),
  )
}

export function contextQuickStyleNumericWarning(
  field: Extract<ContextQuickStyleField, { input: 'slider' }>,
): string {
  return field.slider.parseKind === 'opacity'
    ? opacityDraftWarning(field.label)
    : positiveNumberDraftWarning(field.label)
}

export function snapContextQuickStyleSliderValue(
  value: number,
  spec: Pick<ContextQuickStyleSliderSpec, 'min' | 'max' | 'step'>,
): number {
  if (!Number.isFinite(value)) {
    return spec.min
  }

  const clamped = Math.min(spec.max, Math.max(spec.min, value))
  const snapped = Math.round(clamped / spec.step) * spec.step

  return Number(snapped.toFixed(decimalPlaces(spec.step) + 2))
}

function filledSurfaceQuickStyleModel(
  geometricKind: Extract<SelectableGeometricKind, 'region' | 'sheet'>,
  count: number,
  fieldsById: ReadonlyMap<BulkStyleFieldId, BulkStyleField>,
  fieldPrefix: 'region' | 'sheet',
): ContextQuickStyleBarModel {
  return {
    geometricKind,
    count,
    label: contextQuickStyleSelectionLabel(geometricKind, count),
    fields: compactFields([
      colorQuickField(fieldsById, `${fieldPrefix}.fillColor`, 'Fill'),
      sliderQuickField(fieldsById, `${fieldPrefix}.fillOpacity`, 'Opacity', {
        min: 0,
        max: 1,
        step: 0.05,
        fallbackValue: 0.35,
        parseKind: 'opacity',
      }),
      colorQuickField(fieldsById, `${fieldPrefix}.strokeColor`, 'Stroke'),
      sliderQuickField(fieldsById, `${fieldPrefix}.lineWidth`, 'Stroke width', {
        min: 0.1,
        max: 8,
        step: 0.1,
        fallbackValue: defaultFilledSurfaceLineWidth,
        unit: 'pt',
        parseKind: 'positiveNumber',
      }),
    ]),
  }
}

function colorQuickField(
  fieldsById: ReadonlyMap<BulkStyleFieldId, BulkStyleField>,
  id: BulkStyleFieldId,
  label: string,
): ContextQuickStyleField | null {
  const field = fieldsById.get(id)

  if (field === undefined || field.input !== 'color') {
    return null
  }

  return {
    id,
    label,
    input: 'color',
    value: stringBulkValue(field.value),
  }
}

function sliderQuickField(
  fieldsById: ReadonlyMap<BulkStyleFieldId, BulkStyleField>,
  id: BulkStyleFieldId,
  label: string,
  slider: ContextQuickStyleSliderSpec,
): ContextQuickStyleField | null {
  const field = fieldsById.get(id)

  if (
    field === undefined ||
    (field.input !== 'positiveNumber' && field.input !== 'opacity')
  ) {
    return null
  }

  return {
    id,
    label,
    input: 'slider',
    value: numberBulkValue(field.value),
    slider,
  }
}

function selectQuickField(
  fieldsById: ReadonlyMap<BulkStyleFieldId, BulkStyleField>,
  id: BulkStyleFieldId,
  label: string,
  options: readonly string[],
  optionLabel: (value: string) => string,
): ContextQuickStyleField | null {
  const field = fieldsById.get(id)

  if (field === undefined || field.input !== 'select') {
    return null
  }

  return {
    id,
    label,
    input: 'select',
    value: stringBulkValue(field.value),
    options,
    optionLabel,
  }
}

function stringBulkValue(value: BulkFieldValue): BulkFieldValue<string> {
  return value.kind === 'value' && typeof value.value === 'string'
    ? { kind: 'value', value: value.value }
    : { kind: 'mixed' }
}

function numberBulkValue(value: BulkFieldValue): BulkFieldValue<number> {
  return value.kind === 'value' && typeof value.value === 'number'
    ? { kind: 'value', value: value.value }
    : { kind: 'mixed' }
}

function compactFields(
  fields: readonly (ContextQuickStyleField | null)[],
): ContextQuickStyleField[] {
  return fields.flatMap((field) => (field === null ? [] : [field]))
}

function contextQuickStylePresetOptions(
  presets: readonly UserStylePreset[],
  kind: StylePresetKind,
  importedReferencesById: ReadonlyMap<string, ImportedTikzStyleReference>,
  externalSourcesById: ReadonlyMap<string, ExternalTikzStyleSource>,
  currentPresetId: string | undefined,
  recentPresetIds: readonly string[],
): ContextQuickStylePresetOption[] {
  const recentPresetRank = new Map(
    recentPresetIds.map((presetId, index) => [presetId, index] as const),
  )

  return presets
    .filter((preset) => preset.kind === kind)
    .map((preset) =>
      contextQuickStylePresetOption(
        preset,
        importedReferencesById,
        externalSourcesById,
        recentPresetRank.has(preset.id),
      ),
    )
    .sort((a, b) => {
      if (a.presetId === currentPresetId && b.presetId !== currentPresetId) {
        return -1
      }

      if (b.presetId === currentPresetId && a.presetId !== currentPresetId) {
        return 1
      }

      const aRecentRank = recentPresetRank.get(a.presetId)
      const bRecentRank = recentPresetRank.get(b.presetId)

      if (aRecentRank !== undefined || bRecentRank !== undefined) {
        if (aRecentRank === undefined) {
          return 1
        }

        if (bRecentRank === undefined) {
          return -1
        }

        return aRecentRank - bRecentRank
      }

      if (a.origin !== b.origin) {
        return a.origin === 'imported' ? -1 : 1
      }

      return a.name.localeCompare(b.name)
    })
}

function contextQuickStylePresetOption(
  preset: UserStylePreset,
  importedReferencesById: ReadonlyMap<string, ImportedTikzStyleReference>,
  externalSourcesById: ReadonlyMap<string, ExternalTikzStyleSource>,
  recent: boolean,
): ContextQuickStylePresetOption {
  const reference =
    preset.importedTikzStyleReferenceId === undefined
      ? undefined
      : importedReferencesById.get(preset.importedTikzStyleReferenceId)
  const source =
    reference === undefined ? undefined : externalSourcesById.get(reference.sourceId)

  return {
    presetId: preset.id,
    name: preset.name,
    tikzStyleName: preset.tikzStyleName,
    origin: reference === undefined ? 'user' : 'imported',
    recent,
    ...(reference === undefined ? {} : { importedKey: reference.key }),
    ...(source === undefined ? {} : { sourceName: source.name }),
  }
}

function contextQuickStylePresetCurrentState(
  options: readonly ContextQuickStylePresetOption[],
  currentPresetId: CommonPresetId,
): ContextQuickStylePresetCurrentState {
  switch (currentPresetId.kind) {
    case 'none':
    case 'mixed':
      return currentPresetId
    case 'preset': {
      const option = options.find(
        (candidate) => candidate.presetId === currentPresetId.presetId,
      )

      return option === undefined
        ? { kind: 'none' }
        : {
            kind: 'preset',
            presetId: option.presetId,
            label: option.name,
          }
    }
  }
}

type CommonPresetId =
  | { kind: 'none' }
  | { kind: 'mixed' }
  | { kind: 'preset'; presetId: string }

function commonPresetId(
  diagram: Diagram,
  targets: readonly ContextQuickStyleTarget[],
): CommonPresetId {
  const presetIds = targets.map((target) => {
    if (target.kind === 'label') {
      return diagram.labels.find((label) => label.id === target.id)?.stylePresetId
    }

    return diagram.strata.find((stratum) => stratum.id === target.id)?.stylePresetId
  })
  const first = presetIds[0]

  if (first === undefined) {
    return presetIds.every((presetId) => presetId === undefined)
      ? { kind: 'none' }
      : { kind: 'mixed' }
  }

  return presetIds.every((presetId) => presetId === first)
    ? { kind: 'preset', presetId: first }
    : { kind: 'mixed' }
}

function resolveContextQuickStyleTargets(
  diagram: Diagram,
  selection: SelectedElement,
):
  | {
      ok: true
      geometricKind: StylePresetKind
      targets: ContextQuickStyleTarget[]
    }
  | {
      ok: false
      message: string
    } {
  const model = createContextQuickStyleBarModel(diagram, selection)

  if (model === null) {
    return {
      ok: false,
      message: 'Select compatible styled object(s).',
    }
  }

  if (model.geometricKind === 'coordinate') {
    return {
      ok: false,
      message: 'Coordinate anchors do not have styles.',
    }
  }

  const seen = new Set<string>()
  const targets: ContextQuickStyleTarget[] = []

  for (const selected of selectedElements(selection)) {
    const key = selectedElementKey(selected)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    const resolved = findSelectedElement(diagram, selected)

    if (resolved === null) {
      return {
        ok: false,
        message: 'Selected target is no longer available.',
      }
    }

    if (resolved.kind === 'coordinate') {
      return {
        ok: false,
        message: 'Coordinate anchors do not have styles.',
      }
    }

    if (resolved.element.geometricKind !== model.geometricKind) {
      return {
        ok: false,
        message: 'Select compatible styled object(s).',
      }
    }

    targets.push({
      kind: resolved.kind,
      id: resolved.element.id,
      geometricKind: resolved.element.geometricKind,
    })
  }

  if (targets.length === 0) {
    return {
      ok: false,
      message: 'Select compatible styled object(s).',
    }
  }

  return {
    ok: true,
    geometricKind: model.geometricKind,
    targets,
  }
}

function clearContextQuickStylePresetReferences(
  diagram: Diagram,
  targets: readonly ContextQuickStyleTarget[],
): Diagram {
  const targetKeys = new Set(
    targets.map((target) =>
      selectedElementKey({ kind: target.kind, id: target.id }),
    ),
  )
  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (!targetKeys.has(selectedElementKey({ kind: 'stratum', id: stratum.id }))) {
      return stratum
    }

    const cleared = clearStyleReferences(stratum)
    changed = changed || cleared !== stratum
    return cleared
  })
  const labels = diagram.labels.map((label) => {
    if (!targetKeys.has(selectedElementKey({ kind: 'label', id: label.id }))) {
      return label
    }

    const cleared = clearStyleReferences(label)
    changed = changed || cleared !== label
    return cleared
  })

  return changed ? { ...diagram, strata, labels } : diagram
}

function clearStyleReferences<
  T extends {
    stylePresetId?: string
    importedTikzStyleReferenceId?: string
  },
>(value: T): T {
  if (
    value.stylePresetId === undefined &&
    value.importedTikzStyleReferenceId === undefined
  ) {
    return value
  }

  const nextValue = { ...value }

  delete nextValue.stylePresetId
  delete nextValue.importedTikzStyleReferenceId

  return nextValue
}

function selectedElementKey(element: SingleSelectedElement): string {
  return `${element.kind}:${element.id}`
}

function styleObjectCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'object' : 'objects'}`
}

function parserForSliderSpec(
  spec: ContextQuickStyleSliderSpec,
): InspectorNumberParser {
  return spec.parseKind === 'opacity' ? parseOpacity : parsePositiveFiniteNumber
}

function endpointArrowLabel(value: string): string {
  return endpointArrowModes.includes(value as EndpointArrowMode)
    ? contextQuickStyleEndpointArrowLabels[value as EndpointArrowMode]
    : value
}

function pointFillLabel(value: string): string {
  return pointFills.includes(value as PointFill)
    ? contextQuickStylePointFillLabels[value as PointFill]
    : value
}

function contextQuickStyleSelectionLabel(
  geometricKind: Exclude<SelectableGeometricKind, 'coordinate'>,
  count: number,
): string {
  const noun = count === 1 ? geometricKind : `${geometricKind}s`

  return `Style ${count} ${noun}`
}

function decimalPlaces(value: number): number {
  const [, fraction = ''] = String(value).split('.')

  return fraction.length
}
