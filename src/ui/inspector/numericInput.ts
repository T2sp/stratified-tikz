export type InspectorNumberParser = (rawValue: string) => number | null

export type InspectorNumericDraftValidation =
  | {
      ok: true
      value: number
    }
  | {
      ok: false
      message: string
    }

export type InspectorNumericDraftUpdate = {
  draft: string
  validation: InspectorNumericDraftValidation
  commitValue: number | null
  warning: string | null
}

export function validateInspectorNumericDraft(
  draft: string,
  parse: InspectorNumberParser,
  invalidMessage: string,
): InspectorNumericDraftValidation {
  const parsedValue = parse(draft)

  return parsedValue === null
    ? {
        ok: false,
        message: invalidMessage,
      }
    : {
        ok: true,
        value: parsedValue,
      }
}

export function updateInspectorNumericDraft(
  draft: string,
  parse: InspectorNumberParser,
  invalidMessage: string,
): InspectorNumericDraftUpdate {
  const validation = validateInspectorNumericDraft(
    draft,
    parse,
    invalidMessage,
  )

  return {
    draft,
    validation,
    commitValue: validation.ok ? validation.value : null,
    warning: validation.ok ? null : validation.message,
  }
}

export function finiteNumberDraftWarning(label: string): string {
  return `${label} must be a finite number.`
}

export function opacityDraftWarning(label: string): string {
  return `${label} must be a number from 0 to 1.`
}

export function positiveNumberDraftWarning(label: string): string {
  return `${label} must be a finite number greater than 0.`
}
