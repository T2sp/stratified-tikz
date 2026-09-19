/** Changing any parser/output setting requires a new configuration identity. */
export const MATHJAX_VERSION = '4.1.3'
export const MATHJAX_FONT_VERSION = '4.1.3'
export const MATHJAX_EXTENSIONS = Object.freeze(['base', 'ams', 'color'])
export const MATHJAX_IDENTITY =
  '@mathjax/src@4.1.3;@mathjax/mathjax-newcm-font@4.1.3;base,ams,color;svg-none;inline-unbroken;stz-label-v5-worker-ink'

/** Bounds synchronous TeX work as well as the derived SVG snapshot. */
export const MATHJAX_LIMITS = Object.freeze({
  maxMacros: 1_000,
  maxBuffer: 16_384,
  maxTemplateSubstitutions: 1_000,
  maxArrayColumns: 256,
  maxArrayTemplateLength: 16_384,
  maxNesting: 128,
  maxMmlNodes: 12_000,
  maxSvgNodes: 10_000,
  maxSvgPaths: 5_000,
  maxSvgBytes: 2_000_000,
  fontSettlementMs: 8_000,
})

/** The transport also bounds direct engine callers, independently of the service. */
export const MATHJAX_WORKER_LIMITS = Object.freeze({
  pendingRequests: 32,
  settlementMs: 10_000,
})
