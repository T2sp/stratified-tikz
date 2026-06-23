import {
  arrowHeadKinds,
  endpointArrowModes,
  midArrowDirections,
} from './types.ts'
import type {
  ArrowHeadKind,
  EndpointArrowMode,
  MidArrowDecoration,
  MidArrowDirection,
  PathArrowOptions,
} from './types.ts'

export const defaultMidArrowPosition = 0.5

export const defaultMidArrowDecoration: MidArrowDecoration = {
  enabled: false,
  position: defaultMidArrowPosition,
  direction: 'forward',
  head: 'standard',
}

export const defaultPathArrowOptions: PathArrowOptions = {
  endpoint: 'none',
  mid: defaultMidArrowDecoration,
}

export type MidArrowDecorationInput = Partial<MidArrowDecoration>

export type PathArrowOptionsInput = Partial<{
  endpoint: EndpointArrowMode
  mid: MidArrowDecorationInput
}>

export function createPathArrowOptions(
  input: PathArrowOptionsInput = {},
): PathArrowOptions {
  return {
    endpoint: input.endpoint ?? defaultPathArrowOptions.endpoint,
    mid: {
      enabled: input.mid?.enabled ?? defaultMidArrowDecoration.enabled,
      position: input.mid?.position ?? defaultMidArrowPosition,
      direction: input.mid?.direction ?? defaultMidArrowDecoration.direction,
      head: input.mid?.head ?? defaultMidArrowDecoration.head,
    },
  }
}

export function clonePathArrowOptions(
  options: PathArrowOptions,
): PathArrowOptions {
  return {
    endpoint: options.endpoint,
    mid: cloneMidArrowDecoration(options.mid),
  }
}

export function cloneMidArrowDecoration(
  decoration: MidArrowDecoration,
): MidArrowDecoration {
  return {
    enabled: decoration.enabled,
    position: decoration.position,
    direction: decoration.direction,
    head: decoration.head,
  }
}

export function resolvePathArrowOptions(
  options: PathArrowOptions | undefined,
): PathArrowOptions {
  return options === undefined
    ? clonePathArrowOptions(defaultPathArrowOptions)
    : clonePathArrowOptions(options)
}

export function isArrowHeadKind(value: unknown): value is ArrowHeadKind {
  return isOneOfStringValues(arrowHeadKinds, value)
}

export function isEndpointArrowMode(
  value: unknown,
): value is EndpointArrowMode {
  return isOneOfStringValues(endpointArrowModes, value)
}

export function isMidArrowDirection(
  value: unknown,
): value is MidArrowDirection {
  return isOneOfStringValues(midArrowDirections, value)
}

export function isValidMidArrowPosition(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 1
  )
}

function isOneOfStringValues<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' &&
    (values as readonly string[]).includes(value)
  )
}
