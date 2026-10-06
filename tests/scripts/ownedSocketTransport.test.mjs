import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { observeOwnedSocketTransport } from '../../scripts/ownedSocketTransport.mjs'

function fixture() {
  const socket = new EventEmitter(), events = [], persisted = [], listeners = [], calls = []
  Object.assign(socket, { localPort: 41001, remotePort: 41002, timeout: 0,
    bytesRead: 12, bytesWritten: 34, destroyed: false, readableEnded: false, writableEnded: false })
  for (const method of ['end', 'destroy', 'resetAndDestroy']) socket[method] = function (...args) {
    calls.push({ method, receiver: this, args }); return this
  }
  const originals = { end: socket.end, destroy: socket.destroy, resetAndDestroy: socket.resetAndDestroy }
  const dispose = observeOwnedSocketTransport({ socket, instanceId: 'owned-instance', socketId: 'owned-socket',
    note: (event, data) => events.push({ event, ...data }), persist: (event) => persisted.push(event),
    on: (target, event, listener) => { target.on(event, listener); listeners.push(() => target.off(event, listener)) } })
  return { socket, events, persisted, calls, originals, dispose: () => { dispose(); listeners.forEach((release) => release()) } }
}

test('local TCP shutdown preserves method receiver, arguments, return and error while recording the caller', () => {
  const f = fixture(), error = Object.assign(new Error('local shutdown cause'), { code: 'ECONNRESET' })
  const callback = () => {}
  assert.equal(f.socket.end('bytes', callback), f.socket)
  assert.equal(f.socket.destroy(error), f.socket)
  assert.equal(f.socket.resetAndDestroy(), f.socket)
  assert.deepEqual(f.calls.map(({ method, args }) => ({ method, args })), [
    { method: 'end', args: ['bytes', callback] }, { method: 'destroy', args: [error] }, { method: 'resetAndDestroy', args: [] },
  ])
  assert.ok(f.calls.every(({ receiver }) => receiver === f.socket))
  const shutdowns = f.events.filter(({ event }) => event === 'ws-tcp-local-shutdown')
  assert.equal(shutdowns.length, 3)
  assert.match(shutdowns[1].callsite, /ownedSocketTransport.test.mjs/)
  assert.deepEqual(shutdowns[1].error, { message: error.message, code: error.code })
  f.dispose()
  for (const method of Object.keys(f.originals)) assert.equal(f.socket[method], f.originals[method])
  assert.equal(f.socket.eventNames().length, 0)
})

test('remote end, TCP error, timeout and close retain transport state without initiating a shutdown', () => {
  const f = fixture(), error = Object.assign(new Error('peer reset'), { code: 'ECONNRESET', syscall: 'read' })
  f.socket.emit('end'); f.socket.emit('error', error); f.socket.emit('timeout'); f.socket.emit('close', true)
  assert.equal(f.calls.length, 0)
  assert.equal(f.events.filter(({ event }) => event === 'ws-tcp-local-shutdown').length, 0)
  assert.deepEqual(f.persisted, ['ws-tcp-end', 'ws-tcp-error', 'ws-tcp-timeout', 'ws-tcp-close'])
  const closed = f.events.find(({ event }) => event === 'ws-tcp-close')
  assert.equal(closed.hadError, true); assert.equal(closed.bytesRead, 12); assert.equal(closed.bytesWritten, 34)
  assert.equal(closed.timeout, 0)
  assert.deepEqual(f.events.find(({ event }) => event === 'ws-tcp-error').error,
    { message: error.message, code: error.code, syscall: error.syscall })
  f.dispose()
})
