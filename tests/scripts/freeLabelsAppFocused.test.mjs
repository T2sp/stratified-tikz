import assert from 'node:assert/strict'
import test from 'node:test'
import { finishFocusedResources, runAppChecksWithGeometryControls } from '../../scripts/checkFreeLabelsAppFocused.mjs'

test('cumulative App completion follows the full workflow and all native geometry controls', async () => {
  const calls = [], context = { owned: 'same cumulative browser context' }
  await runAppChecksWithGeometryControls(context,
    async (actual) => { assert.equal(actual, context); calls.push('App workflow including pending download') },
    async (actual) => { assert.equal(actual, context); calls.push('native geometry controls') })
  calls.push('complete App group')
  assert.deepEqual(calls, ['App workflow including pending download', 'native geometry controls', 'complete App group'])
})

test('App workflow or native geometry control failure leaves cumulative App completion unreachable', async () => {
  for (const failing of ['workflow', 'control']) {
    const primary = new Error(`${failing} failure`), calls = []
    const group = async () => {
      await runAppChecksWithGeometryControls({}, async () => {
        calls.push('workflow'); if (failing === 'workflow') throw primary
      }, async () => { calls.push('control'); throw primary })
      calls.push('complete')
    }
    await assert.rejects(group(), (error) => error === primary)
    assert.deepEqual(calls, failing === 'workflow' ? ['workflow'] : ['workflow', 'control'])
  }
})

test('focused cleanup preserves the primary error despite diagnostic/image and close failures', async () => {
  const primary = new Error('native SVG scroll timeout')
  const calls = []
  const actual = await finishFocusedResources(primary, [
    ['image', async () => { calls.push('image'); throw new Error('image failed') }],
    ['owned page close', async () => { calls.push('page'); throw new Error('page close failed') }],
    ['owned browser close', async () => { calls.push('browser') }],
  ], async (name) => { calls.push(name); throw new Error('diagnostic failed') }, 50)
  assert.equal(actual, primary)
  assert.deepEqual(calls, ['image', 'image', 'page', 'owned page close', 'browser'])
})

test('focused cleanup has a host deadline and still closes the remaining owned resources', async () => {
  const calls = []
  const actual = await finishFocusedResources(undefined, [
    ['stalled owned page close', () => new Promise(() => {})],
    ['owned browser close', async () => { calls.push('browser') }],
  ], async (name, error) => { calls.push(name); assert.match(error.message, /Timed out after 20ms/) }, 20)
  assert.match(actual.message, /stalled owned page close/)
  assert.deepEqual(calls, ['stalled owned page close', 'browser'])
})

test('focused cleanup consumes a late rejected close without changing its original timeout', async () => {
  let rejectClose
  const actual = await finishFocusedResources(undefined, [
    ['late page close', () => new Promise((resolve, reject) => { rejectClose = reject })],
  ], async () => {}, 20)
  assert.match(actual.message, /Timed out after 20ms during late page close/)
  rejectClose(new Error('late close rejection'))
  await new Promise((resolve) => setImmediate(resolve))
})
