import assert from 'node:assert/strict'
import test from 'node:test'
import {
  copyTextToClipboard,
  downloadTextFile,
  type ClipboardWriter,
  type DownloadAnchor,
  type TextFileDownloadEnvironment,
} from '../../src/ui/fileTransfer.ts'

test('copy helper writes text to the provided clipboard', async () => {
  const writes: string[] = []
  const clipboard: ClipboardWriter = {
    writeText: async (text) => {
      writes.push(text)
    },
  }

  assert.equal(await copyTextToClipboard('\\begin{tikzpicture}', clipboard), true)
  assert.deepEqual(writes, ['\\begin{tikzpicture}'])
})

test('copy helper reports unavailable or failing clipboards', async () => {
  const failingClipboard: ClipboardWriter = {
    writeText: async () => {
      throw new Error('denied')
    },
  }

  assert.equal(await copyTextToClipboard('tikz', null), false)
  assert.equal(await copyTextToClipboard('tikz', failingClipboard), false)
})

test('download helper creates, clicks, removes, and revokes an anchor URL', () => {
  const calls: string[] = []
  const anchor: DownloadAnchor = {
    href: '',
    download: '',
    click: () => calls.push('click'),
    remove: () => calls.push('remove'),
  }
  const environment: TextFileDownloadEnvironment = {
    createObjectUrl: (blob) => {
      calls.push(`${blob.type}:${blob.size}`)
      return 'blob:test-url'
    },
    revokeObjectUrl: (url) => calls.push(`revoke:${url}`),
    createAnchor: () => anchor,
    appendAnchor: (appendedAnchor) => {
      assert.equal(appendedAnchor, anchor)
      calls.push('append')
    },
  }

  const downloaded = downloadTextFile(
    '\\draw (0,0) -- (1,1);',
    {
      filename: 'diagram.tex',
      mimeType: 'text/x-tex;charset=utf-8',
    },
    environment,
  )

  assert.equal(downloaded, true)
  assert.equal(anchor.href, 'blob:test-url')
  assert.equal(anchor.download, 'diagram.tex')
  assert.deepEqual(calls, [
    'text/x-tex;charset=utf-8:21',
    'append',
    'click',
    'remove',
    'revoke:blob:test-url',
  ])
})

test('download helper reports failures without leaking object URLs', () => {
  const calls: string[] = []
  const environment: TextFileDownloadEnvironment = {
    createObjectUrl: () => {
      calls.push('create-url')
      return 'blob:test-url'
    },
    revokeObjectUrl: (url) => calls.push(`revoke:${url}`),
    createAnchor: () => ({
      href: '',
      download: '',
      click: () => {
        throw new Error('click failed')
      },
      remove: () => calls.push('remove'),
    }),
    appendAnchor: () => calls.push('append'),
  }

  assert.equal(
    downloadTextFile(
      'tikz',
      {
        filename: 'diagram.tex',
        mimeType: 'text/plain',
      },
      environment,
    ),
    false,
  )
  assert.deepEqual(calls, ['create-url', 'append', 'revoke:blob:test-url'])
})
