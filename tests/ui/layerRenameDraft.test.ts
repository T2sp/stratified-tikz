import assert from 'node:assert/strict'
import test from 'node:test'

import { committedLayerNameDraft } from '../../src/ui/layerRenameDraft.ts'

test('committedLayerNameDraft preserves nonblank layer names', () => {
  assert.equal(
    committedLayerNameDraft(2, 'Presentation layer'),
    'Presentation layer',
  )
})

test('committedLayerNameDraft replaces blank layer names with the layer default', () => {
  assert.equal(committedLayerNameDraft(2, '   '), 'Layer 2')
  assert.equal(committedLayerNameDraft(-1, ''), 'Layer -1')
})
