// Extract the uncompressed page stream from this known, single-page PGF fixture.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'

const fixture = new URL('./', import.meta.url)
const pdf = readFileSync(new URL('reference.pdf', fixture)).toString('latin1')
const streams = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
const pageStreams = streams.map((match) => match[1]).filter((stream) => stream.includes('[(PGF)]TJ') && stream.includes('[(APP)]TJ'))
assert.equal(pageStreams.length, 1)
writeFileSync(new URL('pdf-operators.txt', fixture), pageStreams[0] + '\n')
