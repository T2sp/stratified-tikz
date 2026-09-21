/** Small whole-label expectations, shared by free/path browser fixtures.
 * Original input is deliberately separate from its successful display text. */
export type CombinedLabelCase = Readonly<{
  id: string
  source: string
  status: 'ready' | 'fallback'
  mathRuns: number
  displayedText?: string
}>

export const combinedLabelCases: readonly CombinedLabelCase[] = [
  { id: 'empty', source: '', status: 'ready', mathRuns: 0, displayedText: '' },
  { id: 'spaces', source: '  \t  ', status: 'ready', mathRuns: 0 },
  { id: 'unicode', source: 'Region A 日本語 α', status: 'ready', mathRuns: 0, displayedText: 'Region A 日本語 α' },
  { id: 'dollar', source: '$\\frac{x_1}{y^2}$', status: 'ready', mathRuns: 1, displayedText: '' },
  { id: 'parentheses', source: '\\(\\sqrt{x_i}\\)', status: 'ready', mathRuns: 1, displayedText: '' },
  { id: 'double-dollar', source: '$$\\frac{1}{2}$$', status: 'ready', mathRuns: 1, displayedText: '' },
  { id: 'brackets', source: '\\[x^{y^2}\\]', status: 'ready', mathRuns: 1, displayedText: '' },
  { id: 'mixed-lines', source: 'Map $F$ and $g_1$\n日本語 \\(\\sqrt{x}\\)', status: 'ready', mathRuns: 3 },
  { id: 'math-newline', source: '$\\begin{matrix}a & b \\\\\n c & d\\end{matrix}$', status: 'ready', mathRuns: 1 },
  { id: 'literal-escapes', source: 'Cost \\$5 \\% \\& \\_ \\# \\{ \\}', status: 'ready', mathRuns: 0, displayedText: 'Cost $5 % & _ # { }' },
  { id: 'missing', source: 'prefix $x', status: 'fallback', mathRuns: 0 },
  { id: 'mismatched', source: 'prefix \\(x\\]', status: 'fallback', mathRuns: 0 },
  { id: 'malformed-tex', source: '$\\frac{1}$', status: 'fallback', mathRuns: 0 },
  { id: 'undefined', source: '$\\undefinedCombinedCommand{x}$', status: 'fallback', mathRuns: 0 },
  { id: 'text-command', source: '  <svg>  \\textbf{bad}\t raw\r\n tail  ', status: 'fallback', mathRuns: 0 },
  { id: 'package', source: '$\\require{physics} x$', status: 'fallback', mathRuns: 0 },
  { id: 'macro', source: '$\\newcommand{\\foo}{x}\\foo$', status: 'fallback', mathRuns: 0 },
]
