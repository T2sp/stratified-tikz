# Phase 31E Targeted Fix Prompt: Repair standalone browser-page ownership and finish export acceptance

## Environment

Work on the current `phase/31e-tex-label-svg-export` checkout. Preserve the
pending Phase 31E implementation, fixtures, tests, documentation and user
changes. Do not reset the branch or rerun implementation from scratch.

The latest parent run used `0295895ef059f2ccd0279308bbfe171d1c5ec7f7` plus
nine modified tracked files and two untracked files:
`scripts/fixtures/settledSvgExportOracle.ts` and
`tests/scripts/settledSvgExportOracle.test.ts`. The eleven-file handoff is
`/private/tmp/stz-31e-diagnostic-checks/handoff.json`. Preserve the added
settlement observations, policy-specific artifacts, exact-source oracle,
negative controls and registered regressions.

Inspect current status; files may since have been committed or changed. Preserve
Phase 31D's merged candidate-cycle correction and recovery coverage. This
failure belongs to 31E export acceptance, not the historical 31D Alt assertion.

The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Preserve pinned
MathJax, shared parser/adapter/cache/rendering semantics and authoritative raw
model text. Limit work to this export failure and further demonstrated 31E
regressions. Phase 31F's combined audit and unrelated lint cleanup remain
out of scope. Settled export is required in this phase, not deferred to 31F.

## Latest execution findings

The supplied report contains a child handoff followed by a **new parent
verification failure before 31E review**. The child's `listen EPERM` restriction
and statement that parent evidence was pending are historical within this log.
The parent did launch Chrome and encountered the concrete harness error below.
No new review ran; do not invent severity counts, `REVIEW_JSON` or approval.

### Current failure: attempting a second page in a page-owned context

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-HVvae4
```

Read `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json`, `checkout.diff`, `checkout-untracked.json`;
- `settled-export-autoHide-completed.json` and
  `settled-export-autoHide-failure.json`;
- `settled-export-autoHide-completed-serialized.svg`, the retained capture/live/
  detached SVGs, and `settled-export-autoHide-failure-live-preview.png`.

The checkout was unchanged during verification. Its fingerprint was
`0f048c1fb81251ba0652e4335077c3e24418e21ad0468bf0b439511f68efcd34`, and
tracked diff SHA-256 was
`4a33aa2a09b5e9b97b54f29e9cd8b4dc5bac1f7fe0f603b9de70a5cbdb2f78ff`.
The report also hashes both untracked oracle/test files. It used Node v26.9.0,
Chrome `153.0.8010.52`, and the Vite fixture at `http://127.0.0.1:5174`.

`check:free-labels` exited 1 at `settled-SVG-export-standalone`:

```text
Error: Please use browser.newContext()
    at _BrowserContext.newPage (.../playwright-core/lib/coreBundle.js:62018:17)
    at runSettledSvgVisibilityChecks (scripts/checkSettledSvgExports.mjs:476:49)
    at scripts/checkFreeLabels.mjs:456:3
```

The last checkpoint is `settled-export-autoHide-failure`. The new diagnostic
reopen code calls `page.context().newPage()` while the main fixture page was
created with `browser.newPage()` in `scripts/checkFreeLabels.mjs` near line 96.
The installed Playwright implementation creates an implicitly page-owned
context for that convenience API, then rejects another page in it with exactly
this error. This is a **confirmed browser-harness API misuse**, not a Vite
permission failure or evidence of a product SVG-rendering defect.

The autoHide export was already serialized before the invalid page creation:

| Saved observation | Latest result |
| --- | --- |
| Captured label count / source-specific conversion requests | 0 / 0 |
| Preparation outcome | `success`, about 8 ms |
| Exported label count / math paths | 0 / 0, appropriate for this hidden label |
| Live SVG preserved during serialization | `true` |
| Standalone reopening | Failed before a standalone page was created |

Zero formula paths are correct for this autoHide case. It must not be subjected
to the positive math requirement used for visible dimmed labels. Although the
serialization diagnostics are saved, the full autoHide scenario did not pass
and no `settled-export-autoHide-visibility` record was emitted in this run.

### Earlier autoDim issue remains a separate, unverified follow-up

The preceding parent run in `stz-phase31e-before-review-r43lZG` passed autoHide
and failed `assert.ok(observed.formulas > 0)` for `$\frac{autoDim}{x}$`.
It did not retain the failing exported SVG or settlement outcome. Its live
preview showed the formula, which did not establish detached export success.

The follow-up has now implemented diagnostic retention and exact-source oracle
checks; preserve them instead of implementing another diagnostic framework.
However, the latest run fails at autoHide reopening **before autoDim begins**.
It neither reproduces nor resolves the original zero-path observation. The
20,000 ms fixture service versus 10,050 ms export boundary remains an unconfirmed
timing hypothesis for that older failure. Repair page ownership first, then
use the existing diagnostics to determine the autoDim result and fix any
remaining demonstrated problem.

### Passing results and unexecuted scenarios

| Check | Latest parent result |
| --- | --- |
| `npm test` | Exit 0; 2,390 passed, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at autoHide standalone page creation |
| 31E independent review | Not reached |

All ten preceding free-label/inline-node/App groups completed. There are 119
passing scenario records and no `pageErrors`; the thrown Node-side Playwright
error is still fatal. Preserve 31D's passing camera interaction, candidate
cycling, same-owner recovery and halo checks.

The eleventh group started but did not complete. Its `unexecuted: []` field
tracks groups, not individual scenarios. AutoDim, layerFilter, hiddenLayer,
invalid-viewport retry and the actual App settled-download/reopen workflow
were not reached. No new standalone visibility scenario passed in this run.
The existing `settled-export.png` belongs to earlier current-SVG-cloning checks;
it is not proof that these new workflows completed.

The child reported 115 focused tests (included in 2,390 full-suite passes),
strict fixture TypeScript, targeted ESLint, syntax checks and diff checks.
Its exact commands are retained in `/private/tmp/stz-31e-diagnostic-checks/`.
Treat those as prior results, not verification of the next correction.

## Goal

Correct the confirmed page/context ownership misuse with a small harness
change. Then execute autoDim and all remaining settled-export checks, diagnosing
any actual geometry/timing/oracle failure with the retained evidence. Preserve
snapshot/visibility/fallback contracts and obtain complete fresh parent evidence
before independent review.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31e-implement.md`, and
  `prompts/phase-31e-review.md`;
- the latest parent evidence and child handoff above, including the pending-file
  snapshot; use the earlier autoDim report only as historical evidence;
- `scripts/checkSettledSvgExports.mjs`, `scripts/checkFreeLabels.mjs`,
  `scripts/fixtures/freeLabels.tsx`, `scripts/fixtures/freeLabelsApp.tsx`, and
  `scripts/fixtures/tsconfig.json`;
- `src/ui/svgSettledExport.ts`, `src/ui/svgPreviewExport.ts`,
  `src/rendering/svgLabelExportRegistry.ts`, `src/rendering/svgLabelView.ts`,
  `SvgTexLabel`, shared label service/runtime and relevant App export handling;
- `scripts/fixtures/settledSvgExportOracle.ts`,
  `tests/scripts/settledSvgExportOracle.test.ts`, and the new observer regressions;
- the installed Playwright `Browser.newPage` and `BrowserContext.newPage`
  ownership guards where needed to confirm the error; do not modify the runtime;
- `src/ui/fileTransfer.ts`, registered export/file-transfer tests, `package.json`,
  and relevant preview/roadmap documentation;
- `scripts/automation/phase-verification.mjs`, `run-phase.mjs`, and their tests.

## 1. Repair standalone-page ownership without losing the live fixture

Pass the existing `browser` into `runSettledSvgVisibilityChecks` at its call
site if needed. Create the standalone reopen page with a supported ownership
model, following the existing `readStandalone` pattern in this harness:

- create an independent `browser.newPage(...)`, then close that page in
  `finally` (its implicitly owned context is released with it); or
- explicitly create `browser.newContext(...)`, create its page inside the
  protected block, and close the owned context in `finally`, including when
  page creation or navigation fails.

Choose one small, consistent approach. Keep viewport and other relevant
options explicit. The existing main fixture page/context must remain open
and untouched for subsequent visibility policies; do not navigate it to the
exported SVG or close its context during diagnostic cleanup.

Continue opening the exact saved serialized SVG with its `file://` URL outside
the application. Retain screenshots, exact-source/foreground geometry,
namespace, opacity and bounds assertions. Observe standalone page errors and
preserve the policy/checkpoint/file path and failure details. Ensure cleanup
also runs on assertion/navigation failure without masking the original error.

Inspect related page creation in the same workflow for this specific ownership
mistake. Existing standalone `browser.newPage()` calls are valid; do not turn
the fix into a wholesale browser lifecycle rewrite. No product source change
is needed to repair this confirmed harness error.

Do not patch Playwright private ownership fields, modify its installed package,
upgrade dependencies, disable the ownership guard, swallow the error, or skip
saved-file reopening. Do not change sandbox flags or start another automation
flow to evade it. A static syntax check or mock alone cannot establish the
repair: require successful native autoHide reopening, then continue the full
browser workflow. Add focused tests only for meaningful new helper behavior.

## 2. Preserve the implemented diagnostics and resolve any remaining autoDim failure

The previous follow-up already added the evidence needed for the original
failure. Retain the production observation hook, source-specific request and
settlement timings, policy-specific pre-assertion artifacts, exact-source
foreground oracle and negative controls. Keep observers non-mutating and
preserve the pinned conversion/export limits.

For each policy, preserve capture/live/detached/serialized SVGs and its bounded
JSON diagnostics: exact source/owner/settings, conversion kind/reason, deadline
and hold/release ordering, foreground geometry/text/namespace, effective opacity,
serialization non-mutation and standalone reopen measurements. Keep diagnostics
separate from passed scenario records. Do not duplicate the entire accumulated
request history at each checkpoint or add model/UI debug fields.

The latest autoHide files establish that retention now works for that empty
capture. They do not establish that a visible successful formula survives
export. Once reopening works, obtain the corresponding autoDim artifacts and
use actual observations to diagnose its result; do not declare the old issue
fixed merely because the page-creation exception is gone.

Compare the captured revision, conversion result, detached label before
sanitization, serialized XML and browser-selected subtree. The shared
`SvgTexLabelView` normally emits a label group/title, paint group, foreground
group, then nested SVG math geometry. Determine exactly where the observed
formula disappears or becomes unobservable.

Investigate these possibilities without treating any as already proven:

- **Oracle selection/structure:** verify that the selected title identifies
  this exact label, namespaces are correct, and the observed foreground belongs
  to it. Do not count unrelated diagram paths, halo copies or another label as
  successful math. If the oracle is wrong, correct it and retain checks that
  reject a genuinely missing formula or whole-source fallback for this expected
  successful source. Do not alter valid production markup merely to satisfy a
  mistaken selector.
- **Settlement/timing:** the fixture service currently allows 20,000 ms,
  whereas the export boundary defaults to the production service limit plus
  50 ms (currently 10,050 ms). After `changeService('real')`, autoHide performs
  no represented-label conversion; autoDim is the first cold-service case.
  A live formula after release does not exclude an earlier export timeout
  fallback. Measure actual timings and reasons; this is only a hypothesis.
  Check hold/request/release ordering and cache/runtime ownership. Correct a
  demonstrated fixture setup problem without replacing pending-at-capture
  coverage with a pre-settled capture. Do not simply enlarge limits, add sleeps
  or retry until the assertion passes. Preserve bounded failure and retry tests.
- **Product export:** if successful captured conversion really loses geometry
  during detached rendering, replacement or sanitization, fix that boundary
  and add a focused regression. Keep the capture immutable, use settled output
  directly, and preserve layout, color and opacity. Do not wait for a later
  live React commit and clone a potentially different current view as a fix.

Preserve all four visibility policies: autoHide and hidden layers exclude
labels and must not trigger export-only conversion; autoDim and layer-filter
dimming retain visible labels, await them normally, and retain the captured
effective opacity after classes are removed. Expected successful math must
remain self-contained geometry; actual failed labels retain their complete
captured raw source. Do not hide/export-exclude dimmed labels, weaken the
positive geometry assertion, or accept arbitrary paths as proof of success.

Protect model/history/TikZ and the live SVG from export-side mutations.
Intentional user edits during a pending export remain permitted; compare
asynchronous completion against the state after those edits. Do not require
history to stay unchanged across deliberate edits.

## 3. Finish the complete standalone browser workflow

Run all remaining visibility checks and the existing actual App download/reopen
workflow. Preserve and verify:

- pending free and inline labels, repeated formulas, ordinary Unicode text,
  successful math and full-source malformed/resource-failure fallback;
- synchronous capture before suspension, edits/style/view/document changes
  during preparation, and a later export reflecting the new 3D view;
- accessible pending/success/failure status, duplicate-click suppression,
  finite failure handling, retry and temporary-resource cleanup;
- saved transparent and white SVG files reopened outside the application,
  including actual formula geometry, placement, explicit colors, glyph-local
  white outlines, multiline/tab/markup-like fallback and visible raster pixels;
- finite dimensions, valid local references without collisions, no remote
  resources/page CSS/runtime dependence, and exclusion of editor overlays;
- serialization/invalid-viewport failure without malformed downloads or
  live-view mutation, followed by successful retry.

Do not treat fixing page creation or one autoDim assertion as full acceptance. Diagnose
and minimally fix any later observed failure. Preserve the ten preceding
groups and the additional `settled-SVG-export-standalone` group: 31E requires
**all eleven**, with actual saved/downloaded/reopened artifacts for this group.
The parent validator already implements the extended group contract; retain
its rejection tests and compatibility with complete earlier-phase reports.
Do not weaken it to accept ten groups for 31E or change sandbox/review gates.

## Verification and permitted execution

Run focused checks with the required Node PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test \
  tests/scripts/settledSvgExportOracle.test.ts \
  tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts \
  tests/ui/fileTransfer.test.ts \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/runPhaseRunner.test.mjs
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/checkSettledSvgExports.mjs
node --check scripts/checkInlineLabels.mjs
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkFreeLabelGeometry.mjs
node --check scripts/checkFreeLabelRaces.mjs
node --check scripts/checkFreeLabelsApp.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/checkSettledSvgExports.mjs scripts/checkFreeLabels.mjs \
  scripts/fixtures/freeLabels.tsx scripts/fixtures/freeLabelsApp.tsx \
  scripts/fixtures/settledSvgExportOracle.ts \
  tests/scripts/settledSvgExportOracle.test.ts \
  src/ui/svgSettledExport.ts src/ui/svgPreviewExport.ts src/ui/fileTransfer.ts \
  src/rendering/svgLabelExportRegistry.ts src/rendering/svgLabelView.ts \
  src/rendering/SvgTexLabel.tsx tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts tests/ui/fileTransfer.test.ts
git diff --check
```

Include additional changed files in applicable targeted checks. Register any
new Node test in the explicit `package.json` test command. Keep focused counts
within the full-suite total. Compare App/SvgDiagram lint with baseline if
changed; do not clean up unrelated pre-existing diagnostics.

Complete authorized parent/Terminal verification is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31E verify
```

This runs `npm test`, `npm run build`, `git diff --check`, `check:label-assets`
and `check:free-labels` on the dirty checkout, with fresh logs/artifacts and
tracked/untracked checkout identity. It does not implement, review, commit or
push. Do not recursively run `31E fix` or `31E implement` as verification.

If acting as the automated fix child, run available focused/full Node checks
and build, then let the outer runner perform browser verification after the
handoff. Accurately report child restrictions and pending parent gates. In a
standalone run, use supported permission escalation when necessary and
available, or hand off to the authorized Terminal. Do not change persistent
sandbox settings or weaken browser/security checks to bypass restrictions.

Require fresh complete matching evidence after correction. A review may use
successful matching parent browser results without rerunning commands in its
restricted child environment. Partial or stale evidence cannot close the gate.

## Documentation and acceptance criteria

Update only relevant Phase 31E preview/export and roadmap status. Record the
actual diagnosis, minimal fix, commands, versions, exit statuses, checkout
identity and retained artifacts. Distinguish the earlier autoDim assertion,
child startup restriction, this confirmed autoHide page-ownership error and
new results. Replace stale claims that fresh parent verification is still
pending with its actual failed/partial result until a new complete run passes.
The preceding ten groups passed; do not reopen old 31D failures or infer an
independent review result from browser success.

The normal runner performs fix -> parent verification -> independent review.
This run failed before the 31E review. A standalone `verify` success does not
itself run review or establish approval. Keep that order and commit gate.

31E is ready for review only when:

- standalone reopening uses valid page/context ownership and closes only its
  own resources, with native autoHide reopen evidence and retained failures;
- the earlier autoDim zero-path issue is resolved or its current non-reproduction
  is reported accurately, with successful current-source settlement/geometry,
  measured timings and complete retained evidence; any remaining failure has
  an evidence-supported diagnosis and minimal correction;
- all visibility policies pass and successful dimmed math retains captured
  geometry and effective opacity without live/model/history mutation;
- actual App downloads and standalone reopen checks pass in both background
  modes, including pending edits, later 3D view and failure/retry cases;
- fresh matching parent browser evidence is `passed`/`complete`, identifies the
  browser, completes all eleven groups, and has no incomplete/unexecuted groups
  or page errors, with actual observations for the formerly unexecuted cases;
- all required tests, build, static checks and diff checks pass, earlier-phase
  regressions remain intact, and documentation matches observed results.

Do not mark 31E complete before required verification and independent review
succeed. Phase 31F remains deferred.

## Report after implementation

Report changed files; the page/context ownership cause and minimal repair;
cleanup behavior and native saved-file reopen results; autoDim's actual
settlement/geometry/timing outcome, separating any further product/fixture/oracle
issue from the confirmed API misuse; all visibility and standalone results;
preserved snapshot/raw-source/history behavior; commands, versions, exit
statuses and focused/full counts; evidence paths and checkout identity; and
unavailable or failing checks. State parent verification and independent review
status separately, without claiming future steps passed.
