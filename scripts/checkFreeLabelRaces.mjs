import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { probeLabelBoundaries, probePoint } from './checkFreeLabelGeometry.mjs'

const client = (matrix, point) => ({ x: matrix.a * point.x + matrix.c * point.y + matrix.e,
  y: matrix.b * point.x + matrix.d * point.y + matrix.f })
const preservedKeys = ['json', 'history', 'tikz', 'inlineTikz']
function unchanged(before, after) {
  for (const key of preservedKeys) assert.equal(after[key], before[key], `${key} unchanged by completion`)
  assert.deepEqual(after.selection, before.selection, 'Completion preserves current selection')
}

export async function runRaceChecks({ page, record, artifactDir }) {
  const state = () => page.evaluate(() => window.stzLabels.state())
  const mount = (options) => page.evaluate((value) => window.stzLabels.mount(value), options)
  const mutate = (id, change) => page.evaluate(({ id, change }) => window.stzLabels.mutateLabel(id, change), { id, change })
  const hold = (source) => page.evaluate((value) => window.stzLabels.hold(value), source)
  const held = (source, fontSize) => page.waitForFunction(({ source, fontSize }) => window.stzLabels.state().requests.some(
    (request) => request.source === source && (fontSize === undefined || request.fontSize === fontSize)
      && request.held && request.phase === 'held'), { source, fontSize })
  const release = async (source, fail = false) => {
    await page.evaluate(({ source, fail }) => window.stzLabels.release(source, fail), { source, fail })
    const requests = (await state()).requests.filter((entry) => entry.source === source && entry.held)
    assert.ok(requests.length && requests.every((entry) => entry.phase === 'delivered'), 'Instrumented completion, including unmounted subscribers')
    return requests
  }
  const ready = (id, status = 'ready') => page.waitForFunction(({ id, status }) =>
    document.querySelector(`[data-label-id="${id}"] [data-label-state]`)?.getAttribute('data-label-state') === status, { id, status })
  const inspect = (id) => page.evaluate((value) => window.stzLabels.inspectContent(value), id)
  async function snapshot(name, id, source, status, stale) {
    await ready(id, status)
    const measurement = await inspect(id)
    assert.equal(measurement.source, source)
    assert.equal(JSON.parse(measurement.request)[0], source, 'Published layout identifies current source')
    const model = (await state()).labels.find((entry) => entry.id === id)
    assert.equal(JSON.parse(measurement.request)[2], model.style.fontSize * 1.35, 'Current font request owns the layout')
    const box = measurement.published
    assert.ok(Math.abs(model.style.anchor.includes('west') ? box.minX : model.style.anchor.includes('east') ? box.maxX : box.minX + box.maxX) < 1e-6)
    assert.ok(Math.abs(model.style.anchor.includes('north') ? box.minY : model.style.anchor.includes('south') ? box.maxY : box.minY + box.maxY) < 1e-6)
    if (status !== 'ready') {
      const literal = await page.locator(`[data-label-id="${id}"] [data-label-literal]`).allTextContents()
      assert.equal(literal.join(''), source, 'Complete current pending/fallback text')
    }
    const probes = await probeLabelBoundaries({ page, id, evidence: measurement, state })
    let staleProbe
    if (stale) {
      const point = { x: measurement.published.minX - 24, y: 0 }
      assert.ok(point.x > stale.published.minX + 2 && point.x < stale.published.maxX - 2,
        'Discriminating point lies inside obsolete larger east-anchored layout')
      assert.ok(point.y > stale.published.minY && point.y < stale.published.maxY)
      staleProbe = await probePoint({ page, point: client(measurement.localToClient, point), expected: null, state, alt: true })
      staleProbe = { ...staleProbe, local: point, obsoleteMeasurement: stale }
      await probePoint({ page, point: client(measurement.localToClient, point), expected: null, state })
    }
    // Finish with actual selection, so result arrival cannot silently clear it.
    const point = client(measurement.localToClient, {
      x: measurement.published.minX + (measurement.published.maxX - measurement.published.minX) * 0.7,
      y: measurement.published.minY + (measurement.published.maxY - measurement.published.minY) * 0.7,
    })
    await probePoint({ page, point, expected: { kind: 'label', id }, state })
    const current = await state()
    if (artifactDir) await page.screenshot({ path: resolve(artifactDir, `${name}.png`) })
    await record(name, { source, status, measurement, probes, staleProbe,
      labels: current.labels, selection: current.selection, requests: current.requests, history: current.history })
    return { ...current, measurement }
  }

  for (const obsoleteFailure of [false, true]) {
    const name = obsoleteFailure ? 'obsolete-failure' : 'obsolete-success'
    const oldSource = `$WWWWWWWWWWWW${obsoleteFailure ? 'W' : 'M'}$`
    const newSource = obsoleteFailure ? '$j_2$' : '$i_1$'
    await mount({ labels: [{ id: 'race', text: oldSource, position: { x: 1, y: 0, z: 0 }, style: { anchor: 'east', fontSize: 18 } }] })
    await ready('race')
    const stale = await inspect('race')
    await mutate('race', { text: '$q$' })
    await ready('race')
    await hold(oldSource)
    await hold(newSource)
    await mutate('race', { text: oldSource })
    await held(oldSource)
    await mutate('race', { text: newSource })
    await held(newSource)
    await mutate('race', { position: { x: 0.8, y: 0.8, z: 0 },
      style: { anchor: 'north', fontSize: 24, color: '#2070b0', opacity: 0.3 } })
    await held(newSource, 24 * 1.35)
    const pending = await snapshot(`${name}-current-pending`, 'race', newSource, 'pending', stale)
    const pendingExport = await page.evaluate(() => window.stzLabels.export())
    assert.ok(pendingExport.includes(newSource), 'Current SVG clone retains pending literal')
    const newerRequests = await release(newSource)
    unchanged(pending, await state())
    const settled = await snapshot(`${name}-newer-completed`, 'race', newSource, 'ready', stale)
    const olderRequests = await release(oldSource, obsoleteFailure)
    unchanged(settled, await state())
    const final = await snapshot(`${name}-older-completed-last`, 'race', newSource, 'ready', stale)
    assert.deepEqual(final.measurement.published, settled.measurement.published, 'Obsolete completion leaves current bounds unchanged')
    assert.deepEqual(final.measurement.ink, settled.measurement.ink, 'Obsolete completion leaves current independent visible extent unchanged')
    assert.deepEqual(final.labels, pending.labels, 'Current source/position/font/anchor/color/opacity stay authoritative')
    const paint = page.locator('[data-label-id="race"] [data-label-state] > g')
    assert.equal(await paint.getAttribute('color'), '#2070b0')
    assert.equal(await paint.getAttribute('opacity'), '0.3')
    await record(`${name}-completion-order`, { completionOrder: [newerRequests, olderRequests] })
  }

  await mutate('race', { text: 'complete invalid $ source' })
  await snapshot('valid-invalid-fallback', 'race', 'complete invalid $ source', 'fallback')
  await mutate('race', { text: '$j_2$' })
  await snapshot('valid-again', 'race', '$j_2$', 'ready')

  for (const action of ['delete', 'unmount']) {
    const source = `$WWWWWWWW${action === 'delete' ? 'D' : 'U'}$`
    await hold(source)
    await mount({ labels: [{ id: 'retired', text: source, position: { x: 0, y: 0, z: 0 } }] })
    await held(source)
    const visible = await inspect('retired')
    await page.evaluate((value) => value === 'delete' ? window.stzLabels.deleteLabel('retired') : window.stzLabels.unmount(), action)
    const before = await state()
    const requests = await release(source)
    unchanged(before, await state())
    assert.equal(await page.locator('[data-label-id="retired"]').count(), 0, 'No resurrected DOM')
    if (action === 'delete') {
      const point = client(visible.localToClient, { x: 0, y: 0 })
      await probePoint({ page, point, expected: null, state })
      await probePoint({ page, point, expected: null, state, alt: true })
    } else assert.equal(await page.locator('svg.svg-diagram').count(), 0, 'Unmount leaves no selectable stale canvas')
    await record(`held-${action}-completed`, { source, requests, visible, history: before.history })
  }

  const lockedSource = '$\\frac{lockedPending}{k}$'
  await hold(lockedSource)
  await mount({ labels: [{ id: 'policy', text: lockedSource, layer: 1, position: { x: 0, y: 0, z: 0 } }] })
  await held(lockedSource)
  const pending = await inspect('policy')
  await probePoint({ page, point: client(pending.localToClient, { x: 0, y: 0 }),
    expected: { kind: 'label', id: 'policy' }, state })
  assert.equal(await page.locator('[aria-label="Selected label drag handles"]').count(), 1)
  await page.evaluate(() => window.stzLabels.setLayers([{ value: 1, name: 'Labels', locked: true }]))
  assert.equal(await page.locator('[aria-label="Selected label drag handles"]').count(), 0, 'Lock removes the previously usable drag handle')
  async function policyProbe(name, measurement, hidden = false) {
    const point = client(measurement.localToClient, { x: 0, y: 0 })
    for (const alt of [false, true]) {
      // A hidden 3D label can expose its occluding sheet; assert label exclusion.
      const blank = client(measurement.svgToClient, { x: 30, y: 30 })
      await page.mouse.click(blank.x, blank.y)
      const before = await state()
      if (alt) await page.keyboard.down('Alt')
      try {
        await page.mouse.click(point.x, point.y)
        assert.notEqual((await state()).selection?.kind, 'label', name)
        await page.mouse.move(point.x, point.y)
        await page.mouse.down()
        await page.mouse.move(point.x + 35, point.y + 20, { steps: 3 })
        await page.mouse.up()
      } finally { if (alt) await page.keyboard.up('Alt') }
      const after = await state()
      assert.equal(after.dragCount, before.dragCount, `${name}: drag did not start`)
      assert.deepEqual(after.labels, before.labels)
      if (!hidden) assert.equal(after.selection, null)
    }
    if (artifactDir) await page.screenshot({ path: resolve(artifactDir, `${name}.png`) })
    await record(name, { measurement, pointer: point, state: await state() })
  }
  await policyProbe('locked-while-held', pending)
  assert.ok((await state()).requests.some((entry) => entry.source === lockedSource && entry.phase === 'held'))
  await release(lockedSource)
  await ready('policy')
  await policyProbe('locked-after-completion', await inspect('policy'))
  await page.evaluate(() => window.stzLabels.setLayers([{ value: 1, name: 'Labels', locked: false }]))
  await snapshot('unlocked-latest-layout', 'policy', lockedSource, 'ready')

  const hiddenSource = '$\\frac{hiddenPending}{h}$'
  await hold(hiddenSource)
  await mount({ ambientDimension: 3, occlusion: 'autoDim', labels: [
    { id: 'policy', text: hiddenSource, position: { x: 0, y: -1, z: 0 } },
  ] })
  await held(hiddenSource)
  const dimmedPending = await inspect('policy')
  assert.equal(await page.locator('[data-label-id="policy"]').getAttribute('data-label-visibility'), 'dimmed')
  const dimOpacity = await page.locator('[data-label-id="policy"] [data-label-state] > g').getAttribute('opacity')
  assert.equal(Number(dimOpacity), 0.35, 'Established autoDim opacity multiplier')
  await page.evaluate(() => window.stzLabels.setVisibility('autoHide'))
  assert.equal(await page.locator('[data-label-id="policy"] [data-label-state]').count(), 0)
  await policyProbe('autohide-while-held', dimmedPending, true)
  assert.ok((await state()).requests.some((entry) => entry.source === hiddenSource && entry.phase === 'held'))
  await release(hiddenSource)
  assert.equal(await page.locator('[data-label-id="policy"] [data-label-state]').count(), 0)
  await policyProbe('autohide-after-completion', dimmedPending, true)
  await page.evaluate(() => window.stzLabels.setVisibility('autoDim'))
  await ready('policy')
  assert.equal(await page.locator('[data-label-id="policy"] [data-label-state] > g').getAttribute('opacity'), dimOpacity)
  const restored = await inspect('policy')
  const point = client(restored.localToClient, { x: (restored.published.minX + restored.published.maxX) / 2,
    y: (restored.published.minY + restored.published.maxY) / 2 })
  await probePoint({ page, point, expected: { kind: 'label', id: 'policy' }, state })
  await probePoint({ page, point, expected: { kind: 'label', id: 'policy' }, state, alt: true })
  await record('autodim-restored-current-layout-and-selection', { source: hiddenSource, measurement: restored, dimOpacity, state: await state() })
}
