import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const runner = fileURLToPath(new URL('../../scripts/automation/run-phase.mjs', import.meta.url))

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'stz-runner-test-'))
  const artifacts = new Set()
  t.after(() => {
    rmSync(cwd, { recursive: true, force: true })
    for (const path of artifacts) rmSync(path, { recursive: true, force: true })
  })
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  mkdirSync(join(cwd, 'prompts'))
  writeFileSync(join(cwd, '.gitignore'), 'logs/\n')
  writeFileSync(join(cwd, 'prompts/phase-31b-implement.md'), 'IMPLEMENT_FIXTURE')
  writeFileSync(join(cwd, 'prompts/phase-31b-review.md'), 'REVIEW_FIXTURE')
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({
    private: true,
    scripts: { test: 'node check.cjs test', build: 'node check.cjs build', 'check:label-assets': 'node check.cjs browser' },
  }))
  writeFileSync(join(cwd, 'check.cjs'), `
const { mkdirSync, writeFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const stage = process.argv[2];
mkdirSync('logs', { recursive: true });
appendFileSync('logs/checks.jsonl', JSON.stringify({ stage, artifactDir: process.env.STZ_SMOKE_ARTIFACT_DIR }) + '\\n');
if (stage === 'browser') {
  const dir = process.env.STZ_SMOKE_ARTIFACT_DIR;
  mkdirSync(dir, { recursive: true });
  for (const [file, value] of Object.entries({
    'native-retry-evidence.json': { browser: 'fixture-browser', affectedBrowserRecoveryVerified: true, nativeFailureCaching: { cachesFailedNativeImports: true } },
    'asset-graph-evidence.json': { mainEntries: 3, workerChunks: 43, approvedFontModules: 40 },
    'containment-evidence.json': { fixtures: [], croppedOracle: { geometryInside: false, outsideInkPixels: 1, lostInkPixels: 1 } },
  })) writeFileSync(join(dir, file), JSON.stringify(value));
}
`)
  const codex = join(cwd, 'codex-fixture.cjs')
  writeFileSync(codex, `#!${process.execPath}
const { mkdirSync, writeFileSync } = require('node:fs');
const prompt = process.argv.at(-1);
mkdirSync('logs', { recursive: true });
if (prompt.startsWith('REVIEW_FIXTURE')) {
  writeFileSync('logs/review-prompt.txt', prompt);
  if (process.env.STZ_TEST_REVIEW_MUTATES === 'yes') writeFileSync('implemented.txt', 'changed by review');
  console.log('REVIEW_JSON_START');
  console.log(JSON.stringify({ summary: 'needs_changes', critical_count: 0, medium_count: 1, low_count: 0,
    ready_to_commit: process.env.STZ_TEST_REVIEW_MUTATES === 'yes', suggested_fix_prompt: 'Fixture stops before commit.' }));
  console.log('REVIEW_JSON_END');
} else {
  writeFileSync('logs/implementation-prompt.txt', prompt);
  writeFileSync('implemented.txt', 'implementation from fixture');
  console.log('Implementation fixture complete');
}
`)
  chmodSync(codex, 0o755)
  git('init', '-q')
  git('config', 'user.name', 'Phase Runner Test')
  git('config', 'user.email', 'phase-runner@example.invalid')
  git('add', '.')
  git('-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Fixture baseline')
  const initialHead = git('rev-parse', 'HEAD')
  const initialBranch = git('branch', '--show-current')
  const run = (mode, extraEnv = {}) => {
    const result = spawnSync(process.execPath, [runner, '31B', mode], {
      cwd, encoding: 'utf8', timeout: 60_000,
      env: { ...env, CODEX_BIN: codex, ...extraEnv },
    })
    try {
      const checks = readFileSync(join(cwd, 'logs/checks.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
      for (const check of checks) {
        if (check.artifactDir) {
          // Browser artifacts are a child of the verification directory.
          artifacts.add(join(check.artifactDir, '..', '..'))
        }
      }
    } catch { /* Early usage failures have no check log. */ }
    return result
  }
  return { cwd, git, run, initialHead, initialBranch }
}

test('verify mode accepts pending changes and never invokes Codex or changes branches/commits', t => {
  const { cwd, git, run, initialHead, initialBranch } = fixture(t)
  writeFileSync(join(cwd, 'pending.txt'), 'uncommitted work')
  const result = run('verify', { CODEX_BIN: join(cwd, 'must-not-run-codex') })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /Verification passed/)
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.equal(git('branch', '--show-current'), initialBranch)
  assert.match(git('status', '--short'), /pending\.txt/)
  const checks = readFileSync(join(cwd, 'logs/checks.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  assert.deepEqual(checks.map(check => check.stage), ['test', 'build', 'browser'])
})

test('parent browser evidence is handed to the review while child Codex remains sandboxed', t => {
  const { cwd, git, run, initialHead } = fixture(t)
  const result = run('implement')
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /Not committing/)
  const prompt = readFileSync(join(cwd, 'logs/review-prompt.txt'), 'utf8')
  assert.match(prompt, /Verification evidence from the parent runner/)
  assert.match(prompt, /check:label-assets: passed, exit 0/)
  assert.match(prompt, /do not need to repeat those browser commands/)
  const summaryPath = /^Summary: (.+)$/m.exec(prompt)?.[1]
  assert.ok(summaryPath, 'Review receives a concrete report path')
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  assert.equal(summary.status, 'passed')
  assert.equal(summary.checkout.revision, initialHead)
  assert.ok(summary.checkout.untrackedSha256['implemented.txt'])
  assert.match(readFileSync(join(cwd, 'logs/codex/31B-review.log'), 'utf8'), /"--sandbox" "workspace-write"/)
  assert.match(readFileSync(join(cwd, 'logs/implementation-prompt.txt'), 'utf8'), /Parent-runner verification/)
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
})

test('a review that changes verified content cannot commit even when it returns ready_to_commit', t => {
  const { git, run, initialHead } = fixture(t)
  const result = run('implement', { STZ_TEST_REVIEW_MUTATES: 'yes' })
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /Checkout changed during review/)
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.equal(git('rev-list', '--count', 'HEAD'), '1')
})
