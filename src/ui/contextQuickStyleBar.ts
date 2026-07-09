import {
  defaultCurveStyle,
  defaultLabelStyle,
  defaultPointStyle,
} from '../model/styles.ts'
import type {
  Diagram,
  EndpointArrowMode,
  PointFill,
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
import type { SelectedElement, SelectableGeometricKind } from './selection.ts'

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
