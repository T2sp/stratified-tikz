import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultJsonDownloadFilename,
  normalizeJsonDownloadFilename,
} from '../../src/ui/jsonFilename.ts'

test('blank JSON download filenames fall back to the default', () => {
  assert.equal(normalizeJsonDownloadFilename(''), defaultJsonDownloadFilename)
  assert.equal(normalizeJsonDownloadFilename('   '), defaultJsonDownloadFilename)
})

test('JSON download filenames are trimmed and receive a .json extension', () => {
  assert.equal(normalizeJsonDownloadFilename('  my-diagram  '), 'my-diagram.json')
  assert.equal(normalizeJsonDownloadFilename('my-diagram.json'), 'my-diagram.json')
  assert.equal(normalizeJsonDownloadFilename('my-diagram.JSON'), 'my-diagram.JSON')
})

test('JSON download filenames replace path separators', () => {
  assert.equal(
    normalizeJsonDownloadFilename('folder/my\\diagram'),
    'folder-my-diagram.json',
  )
  assert.equal(
    normalizeJsonDownloadFilename('folder/my\\diagram.json'),
    'folder-my-diagram.json',
  )
})
