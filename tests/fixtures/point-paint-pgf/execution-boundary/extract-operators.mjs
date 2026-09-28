// Read actual uncompressed PDF paint operators, independently of app parsing.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'

const fixture = new URL('./', import.meta.url)
const observations = []
for (const [name, expectedTextOperator] of [
  ['macro', '0 0 1 rg'],
  ['conditional', '0 0 1 rg'],
  ['groupedColor', '0 0 1 rg'],
  ['bounds', '1 0 0 rg'],
]) {
  const pdf = readFileSync(new URL(`${name}.pdf`, fixture)).toString('latin1')
  const streams = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((match) => match[1])
    .filter((stream) => stream.includes('[(PGF)]TJ'))
  assert.equal(streams.length, 1)
  const stream = streams[0]
  writeFileSync(new URL(`${name}-pdf-operators.txt`, fixture), stream + '\n')
  const nodes = [...stream.matchAll(/\[\((PGF|APP)\)\]TJ/g)].map((match) => {
    const before = stream.slice(0, match.index)
    const operators = [...before.matchAll(/(?:^|\s)([\d.]+ [\d.]+ [\d.]+ rg)(?=\s)/g)]
    assert.ok(operators.length > 0)
    const textOperator = operators.at(-1)[1]
    assert.equal(textOperator, expectedTextOperator)
    return { body: match[1], textOperator }
  })
  assert.deepEqual(nodes.map((node) => node.body), ['PGF', 'APP', 'APP', 'APP', 'APP'])
  observations.push({ name, expectedTextOperator, nodes })
}
writeFileSync(new URL('independent-pgf-observations.json', fixture), JSON.stringify(observations, null, 2) + '\n')
