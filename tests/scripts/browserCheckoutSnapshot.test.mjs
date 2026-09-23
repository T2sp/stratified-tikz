import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { captureBrowserCheckoutSnapshot } from '../../scripts/browserCheckoutSnapshot.mjs'
import { captureCheckoutIdentity } from '../../scripts/automation/phase-verification.mjs'

test('browser checkout snapshots preserve binary untracked fixtures and symlink bytes for the parent fingerprint', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'stz-browser-byte-identity-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' })
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
  writeFileSync(join(cwd, 'source.txt'), 'baseline\n'); git('add', '.')
  git('-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'baseline')
  const binary = Buffer.from([137, 80, 78, 71, 0, 13, 10, 255, 192, 128])
  writeFileSync(join(cwd, 'reference.png'), binary)
  symlinkSync('reference.png', join(cwd, 'reference-link'))
  writeFileSync(join(cwd, 'source.txt'), 'changed\n')
  const result = captureBrowserCheckoutSnapshot({ cwd })
  const expected = captureCheckoutIdentity({ cwd })
  assert.equal(result.checkout.fingerprint, expected.fingerprint)
  const sha = (value) => createHash('sha256').update(value).digest('hex')
  assert.equal(result.checkout.untrackedSha256['reference.png'], sha(binary))
  assert.notEqual(sha(binary.toString('utf8')), sha(binary), 'Fixture exposes the old lossy UTF-8 bug')
  assert.deepEqual(Buffer.from(result.untracked.files['reference.png'].data, 'base64'), binary)
  assert.equal(result.untracked.files['reference-link'].kind, 'symlink')
  assert.equal(Buffer.from(result.untracked.files['reference-link'].data, 'base64').toString(), 'reference.png')
  assert.equal(sha(result.diff), expected.trackedDiffSha256)
})
