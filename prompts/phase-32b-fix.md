# Phase 32B Targeted Fix Prompt: Diagnose runner termination and complete native acceptance

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Inspect status and preserve the
current implementation and all untracked helpers, tests and PGF artifacts.
At this prompt update HEAD is `120743b6c42f63b5db3bad31804bcc4f0d6a1c93`, with
tracked changes and 22 untracked files. The implementation handoff, independent
review and latest failed parent verification identify the same pre-prompt tree:

```text
daac0abff5402bef2204970154d6b9144198e558ee8b72569568311bd6a7a11e
```

This fingerprint describes the checkout before this prompt edit. Recompute the
final identity after corrections, including untracked files and binary bytes.
Do not reset, discard or restart the existing implementation.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

The immediate task is the runner regression failure below, followed by fresh
native acceptance of the existing continuity and directory-uncertainty changes.
Keep strict TypeScript, bounded parsing and existing dependencies. Preserve 32A
behavior and defer 32C/32D. Do not execute arbitrary TeX in the importer/preview,
upgrade npm because of its update notice, or perform unrelated lint cleanup.

## Evidence and current status

Implementation handoff and independent review:

```text
/private/tmp/stz-32b-continuity-directory-9HrUFj/handoff.json
/private/tmp/stz-32b-continuity-directory-9HrUFj/independent-review.md
```

That implementation passed 3,311 tests, build, diff, strict TypeScript and
targeted checks. Both corrected TikZ modes were independently compiled with PGF.
The independent review found no remaining concrete code defect after a bounded
expansion correction, but required native acceptance was missing. Its final
verifier stopped at `check:label-assets` with localhost `EPERM`; it did not run
`check:free-labels`. The separate direct free-label attempt also stopped before
browser startup. Neither establishes a passing native scenario.

The newer parent attempt failed earlier, in `npm test`:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-kIKYf4/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-kIKYf4/01-npm-test/command.log
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-SeWIhy/response.json
```

| Latest parent observation | Actual result |
| --- | --- |
| `npm test` | 3,311 total; 3,310 passed, 1 failed; zero skipped/cancelled |
| Test duration | 809,024.246583 ms |
| `npm run build`, diff and both browser checks | Not reached in this attempt |
| Checkout before/after | Identical fingerprint shown above |
| Verification / commit readiness | Failed; no commit or push |

Keep the earlier successful static/PGF evidence separate from this latest failed
run. It does not cancel the new failure or satisfy native acceptance.

## 1. Diagnose the runner fixture's abnormal process termination

The failing test is `31F verify accepts its complete 12-group browser report`,
currently declared at `tests/scripts/runPhaseRunner.test.mjs:229`. Its assertion
at approximately line 236 expects the runner process status to equal zero:

```text
31F verify accepts its complete 12-group browser report (107059.951209ms)
null !== 0
```

The fixture's `run()` currently uses `spawnSync(process.execPath, ...)` with
`timeout: 60_000` around line 160. Its failure assertion reports stdout/stderr
but omits `result.error` and `result.signal`. A timeout is a plausible explanation
for a null status, not an established diagnosis. Do not equate null with exit
code 1, presume a changed group policy, or label this the old App-page failure.

The last retained nested output is:

```text
Verifier handoff: .../stz-phase-verifier-TAPYpM/response.json
Verification evidence: .../stz-phase31f-manual-jMFVqX/verification.json
Verification: npm test
Verification passed: npm-test
Verification: npm run build
Verification passed: npm-build
```

These are the isolated runner fixture's commands: its temporary package scripts
invoke `check.cjs` and emit synthetic browser reports. They are not real browser
runs or additional application test/build passes. The omitted prefix above is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T`.

The nested report and handoff directories were absent when inspected after the
failure. The fixture's `t.after` unconditionally removes its temporary checkout
and collected artifact directories, including failed-run evidence.

Other successful tests in the same log took approximately 107,451 ms, 51,726 ms
and 442,690 ms. Investigate the wider timing anomaly as well as this fixture.
Resource contention, scheduling/suspension and child-process stalls remain
hypotheses; the retained log does not distinguish them. The failed test's total
duration includes fixture work and cleanup, not just the configured spawn timeout.

During this prompt-only update, the unchanged implementation passed all 3,311
tests in 214,213.990875 ms, followed by a passing build. Logs are
`/private/tmp/stz-32b-runner-prompt-20260927-npm-test.log` and
`/private/tmp/stz-32b-runner-prompt-20260927-build.log`. No runner fix was made;
this rerun does not establish the earlier termination's cause or close the
native acceptance gap. Preserve both outcomes in the investigation.

### Required investigation and correction

Read the fixture, `scripts/automation/run-phase.mjs`,
`scripts/automation/phase-verification-worker.mjs`,
`scripts/automation/phase-verification.mjs` and related runner/policy tests.
Trace the actual fixture runner, verifier worker and spawned command lifecycle.

1. Make abnormal outcomes actionable. Record command/arguments, fixture cwd,
   configured timeout, elapsed time, PID, `status`, `signal`, and available
   `error.name`, `error.code`, `error.message` and other useful spawn error fields.
   Retain stdout/stderr, the last completed stage and report/handoff paths.
   Distinguish ordinary nonzero exit, spawn failure, signal and timeout. Do not
   dump unrelated environment secrets or replace the primary error with a
   secondary diagnostic failure.
2. Preserve failed-run evidence before cleanup. Retain or copy the relevant
   fixture logs, worker response and available verification artifacts to an
   explicitly reported temporary failure directory. Handle partial/missing
   worker output without inventing completion. Keep normal successful-fixture
   cleanup. Failure evidence must remain readable after the test exits.
3. Reproduce the exact case in isolation, then the runner suite and ordinary
   full-suite conditions. Capture process results and timings. Fix the measured
   cause with a small change. If a finite timeout needs adjustment, justify its
   budget from evidence and keep deterministic tests of timeout behavior. Do
   not merely remove the deadline, skip this case, relax the status assertion,
   accept null, or retry until green. Avoid changing global test concurrency or
   production verification policy without evidence that it is necessary.
4. On timeout/cancellation, ensure the fixture's owned runner/worker/command
   processes finish or are terminated before deleting their directories. Keep
   termination bounded and scoped to owned processes; do not kill unrelated
   Node, Vite or browser processes. Diagnose inherited pipes or delayed cleanup
   if they contribute to the observed wall time.

Useful initial reproduction:

```bash
PATH=/opt/homebrew/bin:$PATH node --test --test-name-pattern='^31F verify accepts its complete 12-group browser report$' tests/scripts/runPhaseRunner.test.mjs
PATH=/opt/homebrew/bin:$PATH node --test tests/scripts/runPhaseRunner.test.mjs
```

An isolated pass does not establish a fix for a failure seen in the full suite.
Retain the failed attempt and explain any demonstrated environmental cause;
if the trigger remains unproven, say so explicitly. Do not claim that a longer
budget or one passing rerun proves the cause.

### Required regressions and preserved runner guarantees

Add focused registered tests for actionable timeout, signal and spawn-failure
outcomes and for evidence survival through cleanup. Use controlled short-lived
fixtures instead of long sleeps. Where process ownership changes, exercise
child cleanup and late failures without touching unrelated processes.

Keep the real fresh-process verifier handoff. A live parent must load verifier
changes made by its implementation child, including transitive dependencies;
keep isolated fixture dependency copying accurate. Preserve the 31F twelve-group
acceptance case and rejection of incomplete/old/tampered reports, bad worker
responses, checkout mismatch, failed commands and review-time mutations.
Failure must stop before review, commit or push. An abnormal runner termination
must never be interpreted as successful verification.

## 2. Preserve completed 32B work and close native acceptance

Do not reimplement the previous prompt's production fix. The current working
tree already propagates directory uncertainty from unsupported mutation bodies
and nested dependencies, including body/work/depth exhaustion. Preserve later
relative-option uncertainty, supported absolute-option recovery, local override
intent, paint-only mutation recovery, source ordering and reconstruction.
Keep the independent failing and corrected PGF fixtures under
`tests/fixtures/point-paint-pgf/mutation-directory/`, including actual compilation
of both corrected modes and generator-to-compiled-byte/operator checks. Do not
regenerate these or earlier references merely to repair runner orchestration.

The new `scripts/ownedAppPage.mjs` already checks owned page/URL, document
generation, API identity, exact saved/runtime JSON, history and editor revision.
It records API-independent lifecycle/DOM/failure images and preserves primary
errors through bounded capture and cleanup. Keep the existing seven App → SVG →
App transitions, helper-return/next-load checks and three separate native
negative-control pages. Do not reload/recreate the main App, reset history,
wait away a replaced API/document, or weaken ownership assertions.

The historical intermittent loss of `window.stzAppLabels` remains unproven.
Diagnostics and negative-control tests are implemented; they do not establish
its trigger or a deterministic fix. If fresh native execution fails, use the
owned App evidence to identify the actual failure before making a targeted
correction. Do not merge localhost `EPERM`, runner termination and document loss
into one unsupported diagnosis.

Once the runner issue is addressed, obtain native evidence in an authorized
browser-capable environment. The current cumulative policy requires:

- All 16 groups / 27 named point scenarios, including
  `point-paint-mutation-directory-uncertainty` and `point-paint-app-continuity`.
- All seven actual standalone transitions and three native continuity fault
  controls, including 13 required continuity artifacts.
- The directory-mutation import/edit/history/persistence scenario and its 11
  artifacts, plus all existing clear and imported-paint acceptance.
- All six responsive downloads and 91 responsive artifacts, physical border /
  body / font checks, .5 → 2 → .5 captures, negative controls, white-background
  validation and immutable click-time SVG inputs.

Preserve detached-provenance cleanup, runtime-model validation separate from
camera-free persistent JSON, the exact bounded 100-entry history contract,
unsupported color shadowing, raw source text, 2D/3D semantics and existing
free/inline-label behavior. Old 25-scenario reports and synthetic policy tests
cannot satisfy the current native requirements.

## Verification, documentation and review

Read `AGENTS.md`, paired 32B implement/review prompts and current
`docs/PHASE_32B_IMPLEMENTATION.md`, `docs/IMPORTED_POINT_PAINT.md` and
`docs/DATA_MODEL.md`. Keep implementation changes focused on the demonstrated
runner/evidence issue and any concretely observed native failure.

Run focused regressions, applicable strict TypeScript, changed-script syntax,
targeted lint and `git diff --check`. Run `npm test` and `npm run build`
sequentially because they share asset preparation. Distinguish unrelated
established lint debt and the nonblocking build chunk warning from failures.

Before final verification, update the implementation report with the actual
root-cause findings, changes, command results and external handoff location.
Do not mark earlier successes as new native results. Freeze code, tests and
tracked docs; keep the final report path/fingerprint in an external handoff.
Then run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands and current cumulative native evidence to pass on the
same final tree, including tracked/untracked/binary identity. Preserve failed
attempts. Any checkout change after verification requires matching verification
again. Obtain independent read-only review of that same tree against
`prompts/phase-32b-review.md`; `32B verify` itself does not perform review.

Do not commit or push while verification or review is unsuccessful. 32B remains
incomplete until both gates pass; 32C/32D remain deferred.
