// Test-owned gates and outcomes. Attach rejection ownership at publication
// creation, before awaiting writer entry or intentionally holding a queue.
export function publicationGate() {
  let resolve, settled = false
  const promise = new Promise(fulfill => { resolve = value => { settled = true; fulfill(value) } })
  return { promise, resolve, get settled() { return settled } }
}

export function ownPublication(publication) {
  return publication.then(value => ({ ok: true, value }), error => ({ ok: false, error }))
}

export function publicationValue(outcome) {
  if (!outcome.ok) throw outcome.error
  return outcome.value
}

export async function awaitPublicationEntry(entry, outcome) {
  await Promise.race([entry.promise, outcome.then(result => {
    publicationValue(result)
    throw new Error('Publication completed before its ordinary writer entered')
  })])
}
