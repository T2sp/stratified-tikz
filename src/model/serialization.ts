import type { Diagram, DiagramValidationResult } from './types.ts'
import { validateDiagram } from './validation.ts'

export const savedDiagramFormat = 'stratified-tikz-diagram'
export const savedDiagramVersion = 1

export type SavedDiagramFile = {
  format: typeof savedDiagramFormat
  version: typeof savedDiagramVersion
  diagram: Diagram
}

export type ParseSavedDiagramResult =
  | {
      ok: true
      diagram: Diagram
    }
  | {
      ok: false
      error: string
    }

export function serializeDiagram(diagram: Diagram): string {
  const savedFile: SavedDiagramFile = {
    format: savedDiagramFormat,
    version: savedDiagramVersion,
    diagram,
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

  const diagram = parsed.diagram as Diagram
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
  }
}

function isDiagramLike(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.version === 1 &&
    (value.ambientDimension === 2 || value.ambientDimension === 3) &&
    isRecord(value.camera) &&
    Array.isArray(value.strata) &&
    value.strata.every(isRecord) &&
    Array.isArray(value.labels) &&
    value.labels.every(isRecord)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
