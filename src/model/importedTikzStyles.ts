import { tikzStyleTargets } from './types.ts'
import type { TikzStyleTarget } from './types.ts'

const defaultExternalStyleSourceName = 'External TikZ style source'

export function isTikzStyleTarget(value: string): value is TikzStyleTarget {
  return tikzStyleTargets.includes(value as TikzStyleTarget)
}

export function normalizeExternalTikzStyleSourceName(name: string): string {
  return normalizeSingleLineCommentText(name, defaultExternalStyleSourceName)
}

export function normalizeExternalTikzStyleLoadHint(
  loadHint: string,
  sourceName: string,
): string {
  const fallback = `\\input{${sourceName}}`

  return normalizeSingleLineCommentText(loadHint, fallback)
}

export function normalizeImportedTikzStyleDisplayName(
  displayName: string,
  key: string,
): string {
  return normalizeSingleLineCommentText(displayName, key)
}

export function normalizeImportedTikzStyleKey(key: string): string {
  return key.trim()
}

export function hasTikzOptionLineBreak(value: string): boolean {
  return /[\r\n]/.test(value)
}

export function normalizeSingleLineCommentText(
  value: string,
  fallback: string,
): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length === 0 ? fallback : normalized
}
