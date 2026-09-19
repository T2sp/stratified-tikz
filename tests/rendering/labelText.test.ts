import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_LABEL_RUNS,
  MAX_LABEL_SOURCE_LENGTH,
  parseLabelText,
  type ParsedLabel,
} from '../../src/rendering/labelText.ts'

function parsed(source: string): Extract<ParsedLabel, { kind: 'parsed' }> {
  const result = parseLabelText(source)
  assert.equal(result.kind, 'parsed', source)
  if (result.kind !== 'parsed') assert.fail('Expected parsed label')
  assert.equal(result.source, source)
  return result
}

function fallback(
  source: string,
  reason: Extract<ParsedLabel, { kind: 'fallback' }>['reason'],
): void {
  assert.deepEqual(parseLabelText(source), { kind: 'fallback', source, reason })
}

for (const source of [
  'Region A',
  '領域と射',
  '🙂🧑‍🔬e\u0301',
  '  \t \n\r\n ',
  '<script>alert("x")</script>',
  '<svg onload="alert(1)"> & \'quotes\' {braces} 50% >',
]) {
  test('ordinary text stays text: ' + JSON.stringify(source), () => {
    assert.deepEqual(parsed(source).runs, [
      { kind: 'text', sourceStart: 0, sourceEnd: source.length, text: source },
    ])
  })
}

test('empty input is a valid label with no runs', () => {
  assert.deepEqual(parseLabelText(''), { kind: 'parsed', source: '', runs: [] })
})

for (const [source, tex, display] of [
  ['$F^{(1)}L$', 'F^{(1)}L', false],
  ['\\(x_i\\)', 'x_i', false],
  ['$$x^2$$', 'x^2', true],
  ['\\[\\frac{1}{2}\\]', '\\frac{1}{2}', true],
  ['\\(\\)', '', false],
  ['\\[\\]', '', true],
  ['$$$$', '', true],
] as const) {
  test('recognizes math delimiters: ' + source, () => {
    assert.deepEqual(parsed(source).runs, [
      { kind: 'math', sourceStart: 0, sourceEnd: source.length, tex, display },
    ])
  })
}

test('acceptance example preserves text and math bodies', () => {
  const source = 'Map $\\alpha \\colon f \\Rightarrow g$'
  assert.deepEqual(parsed(source).runs, [
    { kind: 'text', sourceStart: 0, sourceEnd: 4, text: 'Map ' },
    {
      kind: 'math', sourceStart: 4, sourceEnd: source.length,
      tex: '\\alpha \\colon f \\Rightarrow g', display: false,
    },
  ])
})

test('text before, between, and after math remains in source order', () => {
  const source = 'A $x$ B \\(y\\) C $$z$$ D \\[w\\] E'
  const result = parsed(source)
  assert.deepEqual(result.runs.map((run) => run.kind === 'text' ? run.text : run.tex),
    ['A ', 'x', ' B ', 'y', ' C ', 'z', ' D ', 'w', ' E'])
  assert.deepEqual(result.runs.filter((run) => run.kind === 'math').map((run) => run.display),
    [false, false, true, true])
})

test('adjacent math uses greedy display opening and opener-specific closing', () => {
  for (const [source, displays] of [
    ['$x$$y$', [false, false]],
    ['$$x$$$$y$$', [true, true]],
    ['$x$$$y$$', [false, true]],
    ['$$x$$$y$', [true, false]],
    ['\\(x\\)\\[y\\]', [false, true]],
    ['\\[x\\]$y$', [true, false]],
  ] as const) {
    const runs = parsed(source).runs
    assert.deepEqual(runs.map((run) => run.kind === 'math' && [run.tex, run.display]),
      [['x', displays[0]], ['y', displays[1]]], source)
  }
  fallback('$$', 'invalid-delimiter')
  fallback('$$$x$$$', 'invalid-delimiter')
})

test('only supported literal text escapes are cooked', () => {
  const source = 'Cost \\$5 \\% \\& \\_ \\# \\{ \\}'
  assert.deepEqual(parsed(source).runs, [{
    kind: 'text', sourceStart: 0, sourceEnd: source.length,
    text: 'Cost $5 % & _ # { }',
  }])
  assert.deepEqual(parsed('\\$x\\$').runs, [{
    kind: 'text', sourceStart: 0, sourceEnd: 5, text: '$x$',
  }])
})

test('escaped dollar next to a real opener stays in its text run', () => {
  const result = parsed('\\$$x$')
  assert.deepEqual(result.runs, [
    { kind: 'text', sourceStart: 0, sourceEnd: 2, text: '$' },
    { kind: 'math', sourceStart: 2, sourceEnd: 5, tex: 'x', display: false },
  ])
})

test('backslash pairs outside math are unsupported, even before delimiters', () => {
  for (const count of [2, 3, 4, 5]) {
    for (const suffix of ['$x$', '(x\\)', '[x\\]', ' plain']) {
      fallback('\\'.repeat(count) + suffix, 'unsupported-text')
    }
  }
})

test('backslash parity inside math decides whether dollars are escaped', () => {
  for (const count of [1, 2, 3, 4, 5, 6]) {
    const body = 'x' + '\\'.repeat(count)
    if (count % 2 === 0) {
      assert.deepEqual(parsed('$' + body + '$').runs, [{
        kind: 'math', sourceStart: 0, sourceEnd: body.length + 2,
        tex: body, display: false,
      }])
    } else {
      fallback('$' + body + '$', 'invalid-delimiter')
      const tex = body + '$y'
      const source = '$' + tex + '$'
      assert.deepEqual(parsed(source).runs, [{
        kind: 'math', sourceStart: 0, sourceEnd: source.length,
        tex, display: false,
      }])
    }
  }
})

test('backslash delimiter tokens respect paired backslashes inside math', () => {
  for (const [opener, closeCharacter] of [['\\(', ')'], ['\\[', ']']] as const) {
    for (const count of [1, 2, 3, 4, 5, 6]) {
      const source = opener + 'x' + '\\'.repeat(count) + closeCharacter
      if (count % 2 === 0) {
        fallback(source, 'invalid-delimiter')
      } else {
        const runs = parsed(source).runs
        assert.equal(runs.length, 1)
        assert.equal(runs[0]?.kind === 'math' && runs[0].tex,
          'x' + '\\'.repeat(count - 1))
      }
    }
  }
})

test('nested braces and text arguments protect delimiter-looking tokens', () => {
  const bodies = [
    'F^{(1)}_{a_{b}}',
    '\\text{cost $5; $$; \\(x\\); \\[y\\]; {nested $}} + x',
    '\\text{\\{literal\\} and $} + \\{x\\}',
    'a\\\\{\\text{nested $}}',
  ]
  for (const tex of bodies) {
    for (const [open, close, display] of [
      ['$', '$', false], ['$$', '$$', true],
      ['\\(', '\\)', false], ['\\[', '\\]', true],
    ] as const) {
      const source = open + tex + close
      assert.deepEqual(parsed(source).runs, [{
        kind: 'math', sourceStart: 0, sourceEnd: source.length, tex, display,
      }])
    }
  }
})

test('escaped braces do not open or close nesting', () => {
  for (const tex of ['\\{x', '\\}x', '{x\\}}', '\\\\{x}']) {
    assert.equal(parsed('$' + tex + '$').runs[0]?.kind, 'math')
  }
  fallback('$x\\\\}$', 'invalid-delimiter')
  fallback('$x\\\\{$', 'invalid-delimiter')
})

test('physical newlines in a matrix remain in one math body', () => {
  const tex = '\\begin{matrix}\na & b \\\\\r\nc & d\n\\end{matrix}'
  const source = 'top\r\n$$' + tex + '$$\nbottom'
  assert.deepEqual(parsed(source).runs, [
    { kind: 'text', sourceStart: 0, sourceEnd: 5, text: 'top\r\n' },
    {
      kind: 'math', sourceStart: 5, sourceEnd: 9 + tex.length,
      tex, display: true,
    },
    {
      kind: 'text', sourceStart: 9 + tex.length, sourceEnd: source.length,
      text: '\nbottom',
    },
  ])
})

test('missing, mismatched, nested, and stray delimiters fail the whole label', () => {
  for (const source of [
    'prefix $x', '$x$$', '$$x$', '$$x', '\\(x', '\\[x',
    '\\(x\\]', '\\[x\\)', '$x\\)', '$x\\]', '\\(x$', '\\[x$$',
    '\\(x\\(y\\)\\)', '$x\\[y\\]$', 'before \\) after', '\\]',
    '$x$ then \\]', '$x\\', '$',
  ]) {
    fallback(source, 'invalid-delimiter')
  }
})

test('malformed brace nesting fails without repairing or rendering a prefix', () => {
  for (const source of [
    '$x}$', '$' + '{x$', '$' + '{x}}$', '$' + '{{x}$', '\\({x\\)', '\\[x}\\]',
    '$ok$ then $\\text{unclosed $',
  ]) {
    fallback(source, 'invalid-delimiter')
  }
})

test('unsupported text-mode commands fail even after successful earlier runs', () => {
  for (const command of [
    '\\textbf{A}', '\\text{A}', '\\documentclass{article}',
    '\\usepackage{foo}', '\\begin{document}', '\\alpha', '\\\\', '\\',
    '\\ ', '\\~', '\\^',
  ]) {
    fallback(command, 'unsupported-text')
    fallback('  \\$5 $x$ \t' + command + ' $y$  ', 'unsupported-text')
  }
  fallback('prefix \\textbf{A} $x$', 'unsupported-text')
})

test('unknown math commands are retained for the later TeX adapter', () => {
  const source = '$\\unknowncommand{x}$'
  assert.deepEqual(parsed(source).runs, [{
    kind: 'math', sourceStart: 0, sourceEnd: source.length,
    tex: '\\unknowncommand{x}', display: false,
  }])
})

test('all source whitespace and escapes survive fallback after a parsed prefix', () => {
  const prefix = ' \t🙂  \\$5 $x$\n\r\n  '
  for (const [suffix, reason] of [
    ['$unclosed  \t\n\r\n', 'invalid-delimiter'],
    ['\\textbf{A}  \t\n\r\n', 'unsupported-text'],
  ] as const) {
    fallback(prefix + suffix, reason)
  }
})

test('source spans partition UTF-16 input exactly without normalizing Unicode', () => {
  const source = '🙂\\$日 $𝛼$🧑‍🔬\\(e\u0301\\)\r\n'
  const result = parsed(source)
  assert.deepEqual(result.runs[0], {
    kind: 'text', sourceStart: 0, sourceEnd: 6, text: '🙂$日 ',
  })
  assert.deepEqual(result.runs[1], {
    kind: 'math', sourceStart: 6, sourceEnd: 10, tex: '𝛼', display: false,
  })
  let previousEnd = 0
  for (const run of result.runs) {
    assert.equal(run.sourceStart, previousEnd)
    assert.ok(run.sourceEnd > run.sourceStart)
    const slice = source.slice(run.sourceStart, run.sourceEnd)
    if (run.kind === 'math') {
      const delimiterLength = slice.startsWith('$') ? 1 : 2
      assert.equal(slice.slice(delimiterLength, -delimiterLength), run.tex)
    }
    previousEnd = run.sourceEnd
  }
  assert.equal(previousEnd, source.length)
  assert.equal(result.runs.map((run) =>
    source.slice(run.sourceStart, run.sourceEnd)).join(''), source)
})

test('input length limit is inclusive and counts UTF-16, not code points', () => {
  const source = '🙂'.repeat(MAX_LABEL_SOURCE_LENGTH / 2)
  assert.equal(source.length, MAX_LABEL_SOURCE_LENGTH)
  assert.equal(parsed(source).runs.length, 1)
  fallback(source + '\n', 'limit')
  fallback(source + '\\textbf{unscanned}\r\n\t ', 'limit')
  fallback('a'.repeat(MAX_LABEL_SOURCE_LENGTH * 20) + ' $x', 'limit')
})

test('deep brace nesting scans without recursive stack growth', () => {
  const depth = Math.floor((MAX_LABEL_SOURCE_LENGTH - 2) / 2)
  const tex = '{'.repeat(depth) + '}'.repeat(depth)
  assert.equal(parsed('$' + tex + '$').runs[0]?.kind, 'math')
  fallback('$' + '{'.repeat(MAX_LABEL_SOURCE_LENGTH - 2) + '$', 'invalid-delimiter')
})

test('run limit includes text and math, returns no truncated prefix', () => {
  const mathOnly = '\\(x\\)'.repeat(MAX_LABEL_RUNS)
  assert.equal(parsed(mathOnly).runs.length, MAX_LABEL_RUNS)
  fallback(mathOnly + '\\(y\\)\n🙂  ', 'limit')
  fallback(mathOnly + ' trailing text', 'limit')
  const mixed = 'a$x$'.repeat(MAX_LABEL_RUNS / 2)
  assert.equal(parsed(mixed).runs.length, MAX_LABEL_RUNS)
  fallback(mixed + ' b', 'limit')
  const finalText = '\\(x\\)'.repeat(MAX_LABEL_RUNS - 1) + ' a'
  assert.equal(parsed(finalText).runs.length, MAX_LABEL_RUNS)
})
