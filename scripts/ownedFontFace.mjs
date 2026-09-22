import assert from 'node:assert/strict'

/** Keep the actual face and its original FontFaceSet in one browser handle.
 * FontFace.family is serialized by the browser and is not an ownership key. */
export function observeOwnedFontFace(handle) {
  return handle.evaluate((owned) => {
    const describe = (face) => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })
    return { documentUrl: owned.owner.URL, sameDocument: owned.owner === document,
      sameFontFaceSet: owned.fonts === document.fonts, owned: describe(owned.font),
      ownedFacePresent: owned.fonts.has(owned.font),
      previousFaces: owned.previous.map((face) => ({ ...describe(face), present: owned.fonts.has(face) })),
      faces: [...owned.fonts].map(describe) }
  })
}

/** Acquisition, loading, assertions and evidence writing share one lifetime.
 * Restoration still runs after a primary failure; every handle is released.
 * A cleanup/evidence error is reported without replacing the primary error. */
export async function withOwnedFontFace(page, { family, source, acquired, use, restore, diagnoseFailure }) {
  let handle, primary, value, restored, removal
  const cleanupErrors = []
  try {
    // No registration occurs before the handle has been returned to its owner.
    handle = await page.evaluateHandle(({ family, source }) => ({ owner: document,
      fonts: document.fonts, previous: [...document.fonts], font: new FontFace(family, source) }), { family, source })
    await acquired?.(handle)
    await handle.evaluate(async (owned) => {
      owned.fonts.add(owned.font)
      await owned.font.load()
      await owned.fonts.ready
      owned.fonts.dispatchEvent(new owned.owner.defaultView.Event('loadingdone'))
    })
    value = await use(handle)
  } catch (error) { primary = error }
  finally {
    if (handle) {
      try {
        removal = await handle.evaluate((owned) => {
          const presentBeforeRemoval = owned.fonts.has(owned.font)
          const deleted = owned.fonts.delete(owned.font)
          return { presentBeforeRemoval, deleted, ownedFacePresent: owned.fonts.has(owned.font),
            previousFacesPresent: owned.previous.map((face) => owned.fonts.has(face)),
            sameDocument: owned.owner === document, sameFontFaceSet: owned.fonts === document.fonts }
        })
      } catch (error) { cleanupErrors.push(error) }
      try {
        // The same supported font event causes current owners to remeasure.
        await handle.evaluate(async (owned) => {
          await owned.fonts.ready
          owned.fonts.dispatchEvent(new owned.owner.defaultView.Event('loadingdone'))
        })
        // This callback captures restoration evidence before its assertions.
        restored = await restore(removal, handle)
      } catch (error) { cleanupErrors.push(error) }
      try {
        assert.ok(removal, 'Owned FontFace removal observation is required')
        assert.equal(removal.ownedFacePresent, false, 'Injected FontFace must be absent after removal')
        assert.equal(removal.deleted, removal.presentBeforeRemoval, 'Delete exactly the owned FontFace')
        assert.ok(removal.previousFacesPresent.every(Boolean), 'Keep every pre-existing FontFace by identity')
        assert.equal(removal.sameDocument, true)
        assert.equal(removal.sameFontFaceSet, true)
      } catch (error) { cleanupErrors.push(error) }
      try { await handle.dispose() } catch (error) { cleanupErrors.push(error) }
    }
  }
  if (primary || cleanupErrors.length) {
    const error = primary ?? cleanupErrors[0]
    try { await diagnoseFailure?.({ primary: error, cleanupErrors, removal }) }
    catch (diagnosticError) { console.error('Injected FontFace failure diagnostics:', diagnosticError) }
    if (cleanupErrors.length) console.error('Injected FontFace cleanup failures:', cleanupErrors)
    throw error
  }
  return { value, restored, removal }
}

/** Independent native widths and line boxes must return with the contour.
 * Request generation is deliberately separate: a new generation alone cannot
 * establish that a previously injected native face has actually disappeared. */
export function assertRestoredPointFont(before, after, { sameOwner = true } = {}) {
  assert.equal(after.source, before.source, 'Restoration keeps exact source')
  assert.deepEqual(after.style, before.style, 'Restoration keeps point style')
  assert.equal(after.runtime.identity, before.runtime.identity, 'Restoration reuses the same runtime')
  if (sameOwner) {
    assert.equal(after.owner, before.owner, 'Restoration keeps the current point owner')
    assert.equal(after.runtime.documentRevision, before.runtime.documentRevision, 'Restoration keeps the model document')
  }
  const request = JSON.parse(after.request)
  assert.equal(request[0], after.source, 'Restored request keeps exact source')
  assert.equal(request[8], after.owner, 'Restored request keeps the point owner')
  assert.equal(request[5], after.runtime.fontGeneration, 'Restored request uses current local font generation')
  assert.equal(after.pointRequest, after.request)
  assert.notEqual(after.status, 'pending')
  for (const key of ['request', 'source', 'pointRequest', 'status']) {
    assert.equal(after.literalObservation[key], after[key], `Restored literal observation keeps current ${key}`)
  }
  for (const key of ['font', 'canvasConfiguration', 'fontProbe', 'space', 'lineContract', 'lines', 'measurements', 'extent']) {
    assert.deepEqual(after.literalObservation[key], before.literalObservation[key], `Restore native ${key}`)
  }
  assert.deepEqual(after.literalObservation.fontReadiness.faces, before.literalObservation.fontReadiness.faces, 'Restore original native FontFaceSet')
  assert.equal(after.literalObservation.fontReadiness.status, 'loaded')
  assert.equal(after.literalObservation.fontReadiness.checked, true)
  for (const key of ['bounds', 'body', 'shape', 'radius', 'contour']) assert.deepEqual(after[key], before[key], `Restore ${key}`)
}
