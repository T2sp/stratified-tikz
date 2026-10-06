/** Observe an invocation's upgraded TCP connection without changing its traffic,
 * timeouts or shutdown behavior. Method callsites distinguish a local close from
 * a remote transport loss; a WebSocket 1006 alone cannot make that distinction. */
export function observeOwnedSocketTransport({ socket, instanceId, socketId, note, on, persist }) {
  if (!socket || typeof socket.on !== 'function') return () => {}
  const releases = []
  const state = () => ({ instanceId, socketId, localAddress: socket.localAddress,
    localPort: socket.localPort, remoteAddress: socket.remoteAddress, remotePort: socket.remotePort,
    destroyed: socket.destroyed, readableEnded: socket.readableEnded,
    writableEnded: socket.writableEnded, bytesRead: socket.bytesRead, bytesWritten: socket.bytesWritten,
    timeout: socket.timeout })
  note('ws-tcp-observation-started', state())
  for (const event of ['end', 'close', 'error', 'timeout']) {
    on(socket, event, (value) => {
      note(`ws-tcp-${event}`, { ...state(),
        ...(event === 'close' ? { hadError: value } : {}),
        ...(event === 'error' ? { error: { message: String(value?.message ?? value).slice(0, 4000),
          code: value?.code, syscall: value?.syscall } } : {}) })
      persist(`ws-tcp-${event}`)
    })
  }
  for (const method of ['end', 'destroy', 'resetAndDestroy']) {
    const original = socket[method]
    if (typeof original !== 'function') continue
    const observed = function (...args) {
      note('ws-tcp-local-shutdown', { ...state(), method,
        callsite: String(new Error().stack ?? '').slice(0, 8000),
        ...(args[0] instanceof Error ? { error: { message: args[0].message, code: args[0].code } } : {}) })
      persist('ws-tcp-local-shutdown')
      return original.apply(this, args)
    }
    socket[method] = observed
    releases.push(() => { if (socket[method] === observed) socket[method] = original })
  }
  return () => { for (const release of releases) release() }
}
