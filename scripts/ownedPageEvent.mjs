/** Own one staged Playwright page event without ever parking a rejecting
 * promise between the listener and its triggering action. Native actions still
 * need their own (shorter) timeout. On failure the caller closes its owned page
 * to cancel Playwright work, then calls drain() before completing cleanup. */
export function ownPageEvent(page, eventName, { timeoutMs, name = eventName }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Page event timeout must be finite and positive')
  const controller = new AbortController()
  let settleEvent
  let eventResult
  let actionOutcome
  let actionResult
  let started = false
  let timer
  // Outcomes are values from creation onward, including before run() starts.
  const outcome = new Promise((resolve) => { settleEvent = resolve })
  const cleanup = () => {
    clearTimeout(timer)
    timer = undefined
    page.off(eventName, receive)
    page.off('close', closed)
  }
  const settle = (result) => {
    if (eventResult) return
    eventResult = result
    if (!result.ok && !controller.signal.aborted) controller.abort(result.error)
    cleanup()
    settleEvent(result)
  }
  const receive = (event) => settle({ ok: true, event })
  const closed = () => settle({ ok: false, error: new Error(`Page closed while waiting for ${name}`) })
  const dispose = (error = new Error(`Disposed wait for ${name}`)) => {
    settle({ ok: false, error })
    cleanup()
    if (!controller.signal.aborted) controller.abort(error)
  }
  const check = () => controller.signal.throwIfAborted()
  page.on(eventName, receive)
  page.on('close', closed)
  timer = setTimeout(() => settle({ ok: false, error: new Error(`Timed out after ${timeoutMs}ms waiting for ${name}`) }), timeoutMs)
  if (page.isClosed()) closed()

  return {
    outcome,
    dispose,
    // A rejected action remains observed even while caller diagnostics run.
    // Closing the owned page is Playwright's supported cancellation mechanism.
    async drain() { await actionOutcome },
    async run(action) {
      if (started) throw new Error(`Wait for ${name} already has an action`)
      started = true
      actionOutcome = Promise.resolve().then(() => {
        check()
        return action({ signal: controller.signal, check })
      }).then((value) => {
        actionResult = { ok: true, value }
        return actionResult
      }, (error) => {
        actionResult = { ok: false, error }
        return actionResult
      })
      try {
        const first = await Promise.race([outcome, actionOutcome])
        if (!first.ok) throw actionResult?.ok === false ? actionResult.error : first.error
        const actionCompleted = await actionOutcome
        if (!actionCompleted.ok) throw actionCompleted.error
        const received = await outcome
        if (!received.ok) throw received.error
        return { event: received.event, value: actionCompleted.value }
      } catch (error) {
        dispose(error)
        throw error
      } finally {
        cleanup()
      }
    },
  }
}
