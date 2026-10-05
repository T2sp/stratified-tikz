import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

export const closedDashTransferErrorDetails = (error) => ({
  message: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  captureDiagnostic: error?.captureDiagnostic,
})

/** Keep the first observed failure while later export/reopen work still runs.
 * A secondary observation or cleanup failure never turns a failed row green. */
export function createClosedDashTransferFailures(record) {
  let primary
  const observed = []
  return {
    get primary() { return primary },
    note(stage, error) {
      const retained = observed.find((entry) => entry.stage === stage && entry.error === error)
      if (retained) return retained.failure
      const failure = { stage, ...closedDashTransferErrorDetails(error) }
      observed.push({ stage, error, failure })
      ;(record.failures ??= []).push(failure)
      if (!primary) {
        primary = error
        record.error = closedDashTransferErrorDetails(error)
        record.primaryFailureStage = stage
      }
      record.result = 'failed'
      return failure
    },
    async attempt(stage, operation) {
      try { return await operation() }
      catch (error) { this.note(stage, error); return undefined }
    },
    throwIfFailed() { if (primary) throw primary },
  }
}

/** browser.newPage() owns an implicit context which cannot create sibling pages.
 * This explicit context owns the fixture, standalone SVGs and any popup pages;
 * every page is observed from creation until bounded resource cleanup. */
export async function createClosedDashTransferContext({ browser, pageErrors, ownedPages, timeoutMs = 5000 }) {
  const context = await boundedPointDiagnostic(() => browser.newContext({ viewport: { width: 1600, height: 1600 } }), 'transfer explicit browser context creation', timeoutMs)
  const pages = new Map()
  const track = (page, role = 'context-page') => {
    let owned = pages.get(page)
    if (owned) { if (role !== 'context-page') owned.record.role = role; return owned }
    const record = { pageId: `transfer-page-${pages.size + 1}`, role, closed: false, pageErrors: [] }
    const pageerror = (error) => {
      const observation = { pageId: record.pageId, role: record.role, url: page.url(), ...closedDashTransferErrorDetails(error) }
      record.pageErrors.push(observation); pageErrors.push(observation)
    }
    const close = () => { record.closed = true }
    page.on('pageerror', pageerror); page.on('close', close)
    owned = { record, release: () => { page.off('pageerror', pageerror); page.off('close', close) } }
    pages.set(page, owned); ownedPages.push(record)
    return owned
  }
  const created = (page) => track(page)
  context.on('page', created)
  const closePage = async (page) => {
    const owned = pages.get(page)
    assert.ok(owned, 'Transfer cleanup must only close a page owned by its context')
    if (owned.record.closed || page.isClosed()) return
    try {
      await boundedPointDiagnostic(() => page.close(), `transfer ${owned.record.role} page cleanup`, timeoutMs)
      owned.record.closed = true
    } catch (error) { owned.record.closeError = closedDashTransferErrorDetails(error); throw error }
  }
  return {
    context,
    async newPage(role) { const page = await boundedPointDiagnostic(() => context.newPage(), `transfer ${role} page creation`, timeoutMs); track(page, role); return page },
    assertNoPageErrors(page) {
      assert.ok(pages.has(page), 'Transfer page errors must belong to its explicit context')
      assert.deepEqual(pages.get(page).record.pageErrors, [], 'Owned transfer page errors')
    },
    closePage,
    async cleanup() {
      const failures = []
      for (const [page, owned] of [...pages].reverse()) {
        try { await closePage(page) }
        catch (error) { failures.push({ name: `${owned.record.role}-page`, error }) }
      }
      try { await boundedPointDiagnostic(() => context.close(), 'transfer owned browser context cleanup', timeoutMs) }
      catch (error) { failures.push({ name: 'browser-context', error }) }
      finally { context.off('page', created); for (const owned of pages.values()) owned.release() }
      return failures
    },
  }
}
