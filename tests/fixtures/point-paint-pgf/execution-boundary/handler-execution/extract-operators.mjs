// Actual uncompressed PDF operators; expected red comes from external PGF.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'

const fixture = new URL('./', import.meta.url)
const pdf = readFileSync(new URL('try.pdf', fixture)).toString('latin1')
const streams = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
  .map((match) => match[1])
  .filter((stream) => stream.includes('[(PGF)]TJ'))
assert.equal(streams.length, 1)
const stream = streams[0]
writeFileSync(new URL('pdf-operators.txt', fixture), stream + '\n')
const nodes = [...stream.matchAll(/\[\((PGF|APP)\)\]TJ/g)].map((match) => {
  const before = stream.slice(0, match.index)
  const operators = [...before.matchAll(/(?:^|\s)([\d.]+ [\d.]+ [\d.]+ rg)(?=\s)/g)]
  assert.ok(operators.length > 0)
  const textOperator = operators.at(-1)[1]
  assert.equal(textOperator, '1 0 0 rg')
  return { body: match[1], textOperator }
})
assert.deepEqual(nodes.map((node) => node.body), ['PGF', 'APP', 'APP', 'APP', 'APP'])
writeFileSync(new URL('independent-pgf-observations.json', fixture), JSON.stringify({ expectedTextOperator: '1 0 0 rg', nodes }, null, 2) + '\n')
