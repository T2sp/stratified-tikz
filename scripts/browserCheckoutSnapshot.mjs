import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { captureCheckoutIdentity } from './automation/phase-verification.mjs'

/** Preserve binary fixtures and symlink target bytes, using the identical raw
 * byte identity as the parent verifier. UTF-8 decoding is not a hash input. */
export function captureBrowserCheckoutSnapshot({ cwd = process.cwd(), env = process.env } = {}) {
  const checkout = captureCheckoutIdentity({ cwd, env })
  const git = (...args) => execFileSync('git', args, { cwd, env, maxBuffer: 100 * 1024 * 1024 })
  const diff = git('diff', 'HEAD', '--binary', '--no-ext-diff', '--no-textconv', '--no-color')
  const files = Object.fromEntries(Object.keys(checkout.untrackedSha256).map((name) => {
    const path = resolve(cwd, name), symlink = lstatSync(path).isSymbolicLink()
    const bytes = symlink ? readlinkSync(path, { encoding: 'buffer' }) : readFileSync(path)
    return [name, { kind: symlink ? 'symlink' : 'file', encoding: 'base64', data: bytes.toString('base64') }]
  }))
  return { checkout: { ...checkout, status: git('status', '--short').toString('utf8') }, diff,
    untracked: { version: 2, files } }
}
