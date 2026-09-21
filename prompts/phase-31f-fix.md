# Phase 31F Targeted Fix Prompt: Refresh parent verification after implementation changes

## Environment

Work on the current `phase/31f-tex-label-regression-docs` checkout. Inspect
current status first and preserve the Phase 31F implementation, fixtures,
tests, documentation and all user changes, including untracked files. Do not
reset the branch, restore a historical base, or rerun implementation from scratch.

The failed parent verification used
`1302a03dd28af8eea0fe2930f066fff695ea5d1e` plus eleven modified tracked files:
`docs/LABEL_ADAPTER.md`, `docs/PREVIEW_UI.md`, `docs/ROADMAP.md`, `docs/SPEC.md`,
`package.json`, `scripts/automation/phase-verification.mjs`,
`scripts/checkFreeLabels.mjs`, `scripts/fixtures/freeLabels.tsx`,
`tests/scripts/freeLabelsFailureEvidence.test.mjs`,
`tests/scripts/runPhaseRunner.test.mjs`, and
`tests/scripts/runPhaseVerification.test.mjs`.

Four files were untracked: `docs/PHASE_31_COMPLETION_AUDIT.md`,
`scripts/checkCombinedLabels.mjs`, `scripts/fixtures/combinedLabels.ts`, and
`tests/integration/phase31fCombinedLabels.test.ts`. These changes may since have
been committed; the recorded snapshot is evidence, not a checkout to restore.

The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Limit work to the
stale parent-verifier defect, focused automation regressions, accurate completion
documentation and further demonstrated Phase 31 acceptance failures. Preserve
the integrated 31A–31E implementation, twelve-group 31F contract, child sandbox
policy and verification/review/commit gates. No new engine, syntax, schema,
rendering feature or unrelated lint cleanup is required.

## Latest execution findings

This is a **parent evidence-validation failure before independent 31F review**.
Both browser commands ran in the parent. The free-label browser command exited
zero and reported complete success, but the parent rejected its evidence using
an older group contract. Do not describe the current failure as browser startup
`EPERM`, missing combined browser coverage, or a demonstrated rendering defect.
Do not invent review severity counts, `REVIEW_JSON` or approval.

### Current failure: a twelve-group report is checked by the old eleven-group validator

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31f-before-review-HHcakE
```

Read `verification.json`, `05-check-free-labels/command.log`, its stdout/stderr
and exit-status files, and these files in `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json`, including combined workflow and export records;
- `checkout.diff` and `checkout-untracked.json`;
- the combined fixture screenshots/observations referenced by the report;
- actual transparent/white downloaded SVGs and standalone/raster observations,
  including `export-click-time-2d-transparent`, `export-later-3d-white`, and
  `export-serialization-retry` artifacts.

The checkout identity before and after verification matched. Its fingerprint
was `9109342812ad20fc3f5db0c01787af3b3fd03d349fe09e65bf1a3aa66f854e56`.
The run used Node v26.9.0, Chrome `153.0.8010.52`, the external Playwright
runtime, and the Vite fixture at `http://127.0.0.1:5174`.

The command finished with:

```text
result: free-label-browser-check-passed
checks: 144
```

The parent then rejected it with:

```text
check:free-labels evidence is incomplete or invalid:
Phase 31F browser evidence must complete 11 required groups;
only complete supported group sets are accepted
```

| Observation | Recorded result |
| --- | --- |
| Browser command exit status | 0 |
| Browser report result / stage | `passed` / `complete` |
| Completed groups | 12, including `combined-free-inline-workflows` |
| Passing scenario records | 144 |
| Combined workflow records | 15 |
| Incomplete / unexecuted groups | Empty |
| Page errors | Empty |
| Parent check status | `failed`, despite command `exitCode: 0` |
| Parent report status | `failed` |
| Independent review | Not reached |

The twelve-group report includes all previous eleven groups plus the new
combined workflow. It includes the previously repaired 31E visibility, native
render boundary, first captured transparent export, later 3D white export and
serialization failure/retry. Preserve those executed passes as historical
evidence for this checkout; do not describe them as still unexecuted.

### Cause: the long-lived parent retains a pre-implementation ESM import

`scripts/automation/run-phase.mjs` statically imports
`browserChecksForPhase`, `runPhaseVerification` and
`verificationMatchesCheckout` from `phase-verification.mjs` at startup. It
then runs the implementation/fix child and calls the already imported
`runPhaseVerification()` afterward.

The saved checkout diff shows that this child changed the validator from the
old eleven-group contract to a twelve-group contract. The current module
requires twelve groups for 31F and recognizes `combined-free-inline-workflows`.
The parent error instead reports eleven, consistent with the old module that
was loaded before the child edited it. Editing a module on disk does not update
the already imported ESM bindings in the parent process.

The old validator recognizes only complete supported sets and rejects unknown
groups. Thus the extra valid combined group is rejected; this is not evidence
that the browser completed too few groups. Changing only the error text or
loosening the count check would miss the lifecycle defect.

Existing tests launch a fresh runner against a module already updated on disk.
They cover the twelve-group policy, but not a verifier changed by an
implementation child while the parent remains alive. Add a regression for that
exact lifecycle, rather than another static group-count test.

### Existing checks and completion status

| Check | Latest parent result |
| --- | --- |
| `npm test` | Exit 0; 2,434 passed, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 0; parent evidence accepted |
| `check:free-labels` command | Exit 0; all twelve groups passed |
| `check:free-labels` parent validation | Failed with the old eleven-group policy |
| Independent 31F review | Not reached |

The implementation child recorded localhost `EPERM` before browser launch.
That is child-only history. The subsequent parent browser execution established
the results above. The completion audit/docs must distinguish those stages.
The failed parent report remains failed; do not edit it to passed or treat
console success as a substitute for an accepted complete parent report.

## Goal

Make post-implementation verification execute the current checkout's verifier,
prove it with a running-parent regression, and obtain fresh accepted parent
verification followed by independent review. Preserve strict twelve-group
31F acceptance and accurate final Phase 31 documentation.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31f-implement.md`, and
  `prompts/phase-31f-review.md`;
- latest parent report/evidence above, especially the validator change in its
  checkout diff and the mismatch between command exit and parent check status;
- `scripts/automation/run-phase.mjs`, `scripts/automation/phase-verification.mjs`,
  `tests/scripts/runPhaseRunner.test.mjs` and
  `tests/scripts/runPhaseVerification.test.mjs`;
- `scripts/checkFreeLabels.mjs`, `scripts/checkCombinedLabels.mjs`,
  `scripts/fixtures/combinedLabels.ts`, `scripts/fixtures/freeLabels.tsx`,
  `tests/scripts/freeLabelsFailureEvidence.test.mjs`, and
  `tests/integration/phase31fCombinedLabels.test.ts`;
- `docs/PHASE_31_COMPLETION_AUDIT.md`, `docs/PREVIEW_UI.md`, `docs/SPEC.md`,
  `docs/LABEL_ADAPTER.md`, `docs/ROADMAP.md`, and `package.json`;
- relevant accepted 31A–31E prompts/review evidence referenced by the audit.

## 1. Load current verification code after the child finishes

Apply a small automation correction so the verification stage uses the verifier
from the checked-out files after implementation/fix changes have completed.
Prefer a small fresh verifier process at that boundary, or an equivalently
explicit fresh-loading design whose behavior is demonstrated by regression.

A second `import()` of the same previously imported URL is still cached. Do
not keep calling a retained startup binding and merely reread the report or
group arrays. If using cache-busting, account for any participating local module
dependencies rather than assuming only the top-level file can become stale.
Resolve the verifier deliberately from the intended automation checkout, not
an unrelated global installation, historical worktree or temporary test copy.

Preserve phase normalization, working directory, required Node PATH, supported
browser environment, fresh artifact directory, logs and report handoff. A
fresh process must propagate exit/error state and return a concrete, validated
report/path to the parent. Missing or malformed output, failed evidence or
worker failure must stop before review; do not fall back to the stale verifier
or mistake a browser's exit zero for accepted parent verification.

Keep the same current verifier responsible for browser-check selection and
required group validation during a verification stage. Preserve checkout
fingerprints over tracked changes and untracked fixtures, before/after identity
checks, read-only review evidence handoff and the post-review identity gate.
Do not weaken child sandboxing or change commit/push authorization behavior.

Keep manual `verify` mode read-only with respect to implementation, review,
branch changes and commits. It must continue to accept an existing dirty tree
and produce evidence for that exact tree. A new standalone `31F verify` process
may already avoid the stale import in this particular report, but that alone
does not fix the implementation/fix lifecycle that caused the failure.

If a running parent edits its own runner-loading code, that already executing
runner also cannot acquire its new control flow automatically. Distinguish the
current outer process from a fresh invocation of the corrected runner. Exercise
the corrected lifecycle in the isolated regression and restart verification
through the updated entry point before claiming native validation of that code.
Do not recursively launch `31F fix`/`implement` from the fix child.

## 2. Test a validator changed while its parent remains alive

Extend runner tests with an isolated temporary automation checkout. Its fake
implementation child must change the verifier on disk from an older eleven-
group contract to the current twelve-group contract after the parent starts.
Use the real runner/verification entry points and retain the parent lifecycle;
simply launching an already updated validator in a new test process repeats
the existing blind spot.

Keep fixture edits away from the user's repository. Existing runner fixtures
refer to an absolute real runner path; adapt/copy the automation files into
the isolated fixture as needed so the fake child changes the module the parent
actually uses. Do not mock away module loading or validate a separate copy that
the runner never calls.

Require at least:

- updated twelve-group evidence is accepted and reaches the fake review with
  a matching report and the combined group represented;
- old eleven-group evidence is rejected by the newly loaded 31F policy before
  review, with a twelve-group diagnostic and no commit/push;
- verifier startup/import/report failures cannot reuse prior success or enter
  review, and actual failed command/evidence status reaches the parent;
- manual dirty-tree `verify` retains its no-Codex/no-review/no-branch-change/
  no-commit behavior, and a changed checkout during review still blocks commit.

Make fake reviews stop before commit or otherwise isolate side effects; no
regression may touch real remotes or the user's current branch. Demonstrate
that the lifecycle regression detects the old retained-import implementation.
Register any new test file in the explicit `package.json` test list.

Preserve existing contract and rejection tests. Phase 31F requires all twelve
groups, including `combined-free-inline-workflows`; an old eleven-group report
cannot satisfy it. Earlier phases must retain their supported complete sets.
Duplicate/unknown groups, missing combined coverage, partial extensions,
incomplete/unexecuted groups, page errors, unidentified browser, running/failed
reports, nonzero exits, missing/malformed files and checkout changes remain
failures. Do not accept every superset or reduce the rule to a numeric count.

Keep command outcome and evidence validation distinct. The report must be able
to retain a browser command's actual exit zero while marking its check failed
because validation failed. Preserve the underlying error and actionable log/
report paths rather than overwriting them with a generic worker error.

## 3. Preserve combined coverage and reconcile the completion audit

Retain the six combined Node tests, seventeen language fixtures, combined
free/path workflows, real adapter coverage, races/cache isolation, placement/
picking, resource recovery, persistence and both TikZ-output invariants. Keep
`combined-free-inline-workflows` in the browser harness and parent contract.
Do not delete a valid group or rewrite the passing browser report to fit the
old validator. No production rendering change is indicated by this failure.

Inspect the HHcakE combined observations and downloaded standalone artifacts
as actual evidence, then obtain fresh equivalent results for the corrected
automation checkout. Preserve 31E's native click/download ownership, bounded
screenshots, SVG-context extraction, computed-opacity tolerance with exact raw
attribute checks, standalone geometry, fallback, outlines, backgrounds and
failure/retry assertions. Fix only further demonstrated contract failures.

Update `docs/PHASE_31_COMPLETION_AUDIT.md` and relevant Phase 31 sections of
the existing docs. Distinguish:

- the child's blocked browser attempts;
- the parent's successful twelve-group browser execution;
- its failed evidence validation due to the stale verifier;
- fresh results after the runner correction;
- independent review status.

Replace blanket claims that no current browser/download assertion ran with the
actual parent results. Preserve historical evidence and honest remaining gates.
Record concrete commands, versions, exit statuses, current checkout identity
and evidence paths. Do not mark Phase 31 complete merely because browser
assertions passed or because the new runner unit test passes.

Keep supported grammar/configuration/work limits and literal fallback examples
accurate. Preserve raw JSON/history/TikZ semantics and avoid claims of arbitrary
LaTeX packages/macros, full-engine typography or unsupported offline behavior.
Existing App/SvgDiagram lint debt remains separate (10 errors / 4 warnings at
the recorded baseline); do not expand this fix into unrelated cleanup.

## Verification and permitted execution

Use the required Node PATH and run focused checks appropriate to changed files:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test \
  tests/scripts/runPhaseRunner.test.mjs \
  tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/freeLabelsFailureEvidence.test.mjs \
  tests/integration/phase31fCombinedLabels.test.ts
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/automation/run-phase.mjs
node --check scripts/automation/phase-verification.mjs
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkCombinedLabels.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/automation/run-phase.mjs scripts/automation/phase-verification.mjs \
  scripts/checkFreeLabels.mjs scripts/checkCombinedLabels.mjs \
  scripts/fixtures/freeLabels.tsx scripts/fixtures/combinedLabels.ts \
  tests/scripts/runPhaseRunner.test.mjs tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/freeLabelsFailureEvidence.test.mjs \
  tests/integration/phase31fCombinedLabels.test.ts
npm test
npm run build
git diff --check
```

Include any new worker/helper/tests in applicable focused, syntax and lint
checks. Report proven baseline lint separately if a touched automation file
already has unrelated diagnostics. Run tests and build sequentially; keep
focused counts within the full-suite total.

Complete authorized parent/Terminal verification through a fresh invocation is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31F verify
```

This runs tests, build, diff check, label assets and the full browser harness on
the dirty checkout, with fresh logs/artifacts and tracked/untracked identity.
It does not implement, review, commit or push. It must accept the complete
twelve-group evidence using the current verifier.

If acting as the automated fix child, complete the code/regressions and available
Node/build/static checks, then report the required fresh parent verification.
If the outer runner still executes old loading logic, state that limitation and
the exact fresh verification command. In a standalone run, use supported
permission escalation when needed and available, or hand off to the authorized
Terminal. Do not change persistent sandbox settings or weaken browser checks.

Require fresh accepted parent evidence after correction. Successful matching
parent results may support independent review without rerunning browsers in a
restricted review child. Historical complete browser evidence is useful, but a
failed parent report or evidence for a different checkout cannot close the gate.

## Acceptance criteria

31F is ready for independent review only when:

- post-implementation/fix verification uses the current verifier, demonstrated
  by an in-flight eleven-to-twelve-group runner regression;
- current twelve-group evidence is accepted and old/incomplete/invalid evidence
  remains rejected, with command and validator outcomes preserved accurately;
- fresh invocation of the corrected runner records a passed parent report for
  an unchanged tracked/untracked checkout, with successful assets and all twelve
  browser groups, identified browser and no page errors or unfinished groups;
- combined production workflows and actual transparent/white standalone export
  artifacts remain correct, with no model/history/TikZ regression;
- required tests/build/static/diff checks pass, and the completion audit maps
  claims to executed checks while separating child, parent and review status;
- sandbox, review handoff, read-only verification mode and checkout/commit gates
  remain intact.

The normal order remains implementation/fix -> parent verification -> independent
review. A standalone `verify` success does not itself run review. Do not mark
Phase 31F or Phase 31 complete before required verification and independent
review succeed. No later phase substitutes for this final combined audit.

## Report after implementation

Lead with the stale-verifier cause and corrected loading lifecycle. Report
changed files; the regression that changes verifier policy while the parent is
alive; preserved twelve-group/earlier-phase contracts and rejection behavior;
fresh parent browser/export evidence; commands, versions, exit statuses and
focused/full counts; current checkout fingerprint and report paths; completion
audit updates; and any remaining limitations. Separate browser command success,
parent evidence acceptance and independent review rather than combining them
into a single pass claim.
