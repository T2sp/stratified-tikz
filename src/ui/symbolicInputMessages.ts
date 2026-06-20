import type { DiagramValidationIssue } from '../model/types.ts'
import type { GridValidationIssue } from '../model/grids.ts'

export function formatSymbolicInputError(error: string): string {
  if (/^Unknown variable /.test(error)) {
    return `${error} Define it in Variables first.`
  }

  if (
    /Backslash|raw TeX|Braces|Semicolons|single-line|reserved|dangerous TeX/i.test(
      error,
    )
  ) {
    return `Unsafe TikZ token: ${error}`
  }

  if (
    /non-finite|not finite|Division by zero|Missing preview value|evaluated to/i.test(
      error,
    )
  ) {
    return `Non-finite preview value: ${error}`
  }

  return `Invalid expression: ${error}`
}

export function formatGridIssue(issue: GridValidationIssue | undefined): string {
  return issue === undefined
    ? 'Grid ranges, clipping bounds, and line count must be valid.'
    : formatGridIssueMessage(issue.message)
}

export function formatGridIssueMessage(message: string): string {
  if (/line count|line cap|exceed/i.test(message)) {
    return `Grid line count too large: ${message}`
  }

  if (/step must be positive|non-positive step/i.test(message)) {
    return `Invalid grid step: ${message}`
  }

  if (/symbolic.*range|range.*symbolic|foreach ranges currently require numeric/i.test(message)) {
    return `Unsupported symbolic grid range: ${message}`
  }

  if (/finite|NaN|Infinity/i.test(message)) {
    return `Non-finite preview value: ${message}`
  }

  if (/max must be greater|clipped bounds|clip|range/i.test(message)) {
    return `Invalid grid range: ${message}`
  }

  return message
}

export function formatDiagramValidationIssue(
  issue: DiagramValidationIssue,
): string {
  return `${issue.path}: ${issue.message}`
}
