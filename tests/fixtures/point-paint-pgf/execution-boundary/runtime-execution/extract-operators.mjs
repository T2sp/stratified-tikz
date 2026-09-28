// Read actual uncompressed offline PGF PDFs; never consult the app resolver.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'

const fixture = new URL('./', import.meta.url)
const expected = [
  { name: 'external', body: 'PGF', text: '0 0 1 rg' },
  { name: 'untouched', body: 'APP', text: '0 0 1 rg', fill: '0 0 0 rg' },
  { name: 'reloaded', body: 'APP', text: '0 0 1 rg', fill: '0 0 0 rg' },
  { name: 'stale-reloaded', body: 'APP', text: '0 0 1 rg', fill: '0 0 0 rg' },
  { name: 'preset-reapplied', body: 'APP', text: '0 0 1 rg', fill: '0 0 0 rg' },
  { name: 'local-text-red', body: 'APP', text: '1 0 0 rg', fill: '0 0 0 rg' },
  { name: 'local-text-fallback', body: 'APP', text: '0 0 0 rg', fill: '0 0 0 rg' },
  { name: 'local-fill-yellow', body: 'APP', text: '0 0 1 rg', fill: '1 1 0 rg' },
  { name: 'local-fill-fallback', body: 'APP', text: '0 0 1 rg', fill: '0 0 0 rg' },
]
const observations = []
const pgfVersions = new Set()
for (const mode of ['standalone', 'inlineMath']) {
  const log = readFileSync(new URL(`runtime-${mode}.log.txt`, fixture), 'utf8')
  const pgfVersion = log.match(/STZ-PGF-VERSION=([^\s]+)/)?.[1]
  assert.ok(pgfVersion)
  pgfVersions.add(pgfVersion)
  for (const row of expected.slice(1)) assert.ok(log.includes(`(./${row.name}-${mode}.tex`), `${mode} compiler loaded ${row.name}`)
  const pdf = readFileSync(new URL(`runtime-${mode}.pdf`, fixture)).toString('latin1')
  const streams = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((match) => match[1]).filter((stream) => /\[\((?:PGF|APP)\)\]TJ/.test(stream))
  const stream = streams.join('\n')
  assert.ok(streams.length > 0)
  writeFileSync(new URL(`${mode}-pdf-operators.txt`, fixture), stream + '\n')
  const bodies = [...stream.matchAll(/\[\((PGF|APP)\)\]TJ/g)]
  assert.equal(bodies.length, expected.length)
  let offset = 0
  const colorBefore = (part) => [...part.matchAll(/(?:^|\s)([\d.]+ [\d.]+ [\d.]+ rg)(?=\s)/g)].at(-1)?.[1]
  const nodes = bodies.map((match, index) => {
    const row = expected[index]
    assert.equal(match[1], row.body)
    const node = stream.slice(offset, match.index)
    const textOperator = colorBefore(node)
    assert.equal(textOperator, row.text, `${mode} ${row.name} text`)
    let fillOperator
    if (row.fill !== undefined) {
      const shape = [...node.matchAll(/(?:^|\n)(?:f|B)\s*\n/g)].at(-1)
      assert.ok(shape, `${mode} ${row.name} actual filled shape`)
      fillOperator = colorBefore(node.slice(0, shape.index))
      assert.equal(fillOperator, row.fill, `${mode} ${row.name} fill`)
    }
    offset = match.index + match[0].length
    return { name: row.name, body: row.body, textOperator, ...(fillOperator === undefined ? {} : { fillOperator }) }
  })
  observations.push({ mode, nodes })
}
assert.deepEqual([...pgfVersions], ['3.1.11a'])
writeFileSync(new URL('independent-pgf-observations.json', fixture), JSON.stringify({
  pgfVersion: [...pgfVersions][0],
  compilationExitCode: 0,
  expectedExternalTextOperator: '0 0 1 rg',
  expectationSource: 'The preserved independently compiled before/probe.pdf external PGF node, not application resolution.',
  observations,
}, null, 2) + '\n')
