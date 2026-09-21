# Phase 31E Targeted Fix Prompt: Diagnose dimmed-label export geometry and complete standalone acceptance

## Environment

Work on the current `phase/31e-tex-label-svg-export` checkout. Preserve the
pending Phase 31E implementation, fixtures, tests, documentation and user
changes. Do not reset the branch or rerun implementation from scratch.

The failed parent run used `7714be1ec5bafc2c99df74055e32ee7bfdaceec8` plus
working-tree changes, including these five then-untracked files:

- `scripts/checkSettledSvgExports.mjs`;
- `src/rendering/svgLabelExportRegistry.ts`;
- `src/rendering/svgLabelView.ts`;
- `src/ui/svgSettledExport.ts`;
- `tests/ui/svgSettledExport.test.ts`.

Inspect current status; these files may since have been committed. Preserve
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

The supplied report is a **parent verification failure before 31E review**,
not a review with severity counts. Do not invent a review result or approval.
Browser startup succeeded; historical child `EPERM` attempts are separate.

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-r43lZG
```

Read `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json`;
- `checkout.diff` and `checkout-untracked.json`;
- `failure.png` and the preceding scenario observations.

The checkout did not change during verification. Its fingerprint was
`0b8395cac3fad28b360ad8ac377f00bfdc086a2375a291d6273208aedefcc467`;
tracked diff SHA-256 was
`0d224801f40eec510dcd36183d022506864987d9dd44cfe20bbd28a06c82b5e9`.
The report also hashes all five untracked files. The run used Node v26.9.0,
Chrome `153.0.8010.52`, and the Vite production-component fixture at
`http://127.0.0.1:5174`.

### Current failure: dimmed exported label has no observed formula paths

`check:free-labels` exited 1 at `settled-SVG-export-standalone`:

```text
AssertionError [ERR_ASSERTION]:
assert.ok(observed.formulas > 0)
runSettledSvgVisibilityChecks
scripts/checkSettledSvgExports.mjs:358
```

The visibility loop is ordered `autoHide`, `autoDim`, `layerFilter`,
`hiddenLayer`. Only `settled-export-autoHide-visibility` was recorded as passed.
The failing iteration is therefore **autoDim**, with source:

```text
$\frac{autoDim}{x}$
```

The failing code counts `label.querySelectorAll('svg path')`, where `label`
is the parent of the first `g > title` in the parsed exported SVG. The earlier
assertions established a captured visible label, dimmed opacity, pending export
while delivery was held, and an exported label count matching the capture.
The formula-path count was zero. These observations do not yet establish why.

`failure.png` shows the fraction in the live dimmed preview after delivery.
That screenshot is not the detached exported SVG and cannot prove its content.
The failing export string, selected label subtree, conversion outcome/reason
and precise timings were not retained before the assertion. In particular,
do not conclude that the selector is wrong or that export lost geometry solely
from the live screenshot and zero count.

### Passing results and the actual remaining gap

| Check | Latest parent result |
| --- | --- |
| `npm test` | Exit 0; 2,380 passed, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at autoDim export geometry |
| 31E independent review | Not reached in this run |

All ten preceding free-label/inline-node/App groups completed. There are 120
passing scenario records and no `pageErrors`. The 31D initial/moved-camera
interaction and same-owner valid–invalid–valid recovery records are present;
do not reopen their old coverage or Alt-cycle failures as current blockers.

The eleventh group, `settled-SVG-export-standalone`, started but is incomplete.
Its `unexecuted: []` field is group-level bookkeeping: it does not mean every
export scenario ran. Specifically, these checks were not reached:

- the rest of autoDim, then layerFilter and hiddenLayer visibility;
- malformed detached viewport and successful retry;
- `runSettledSvgExportChecks`, including actual App downloads, click-time
  edit/document isolation, standalone reopening, white/transparent output,
  3D export, resource recovery and serialization-failure retry.

The existing `settled-export.png` comes from earlier current-SVG-cloning checks,
not from successful execution of the new settled-download/reopen workflow.
Passing helper tests or an in-app screenshot cannot close this gate.

## Goal

Identify whether the zero-path observation comes from export settlement,
detached rendering/sanitization, fixture timing, or the browser oracle. Apply
an evidence-supported minimal correction, preserve snapshot/visibility/fallback
contracts, and obtain complete fresh 31E parent evidence before review.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31e-implement.md`, and
  `prompts/phase-31e-review.md`;
- the failed parent evidence above, including the pending-file snapshot;
- `scripts/checkSettledSvgExports.mjs`, `scripts/checkFreeLabels.mjs`,
  `scripts/fixtures/freeLabels.tsx`, `scripts/fixtures/freeLabelsApp.tsx`, and
  `scripts/fixtures/tsconfig.json`;
- `src/ui/svgSettledExport.ts`, `src/ui/svgPreviewExport.ts`,
  `src/rendering/svgLabelExportRegistry.ts`, `src/rendering/svgLabelView.ts`,
  `SvgTexLabel`, shared label service/runtime and relevant App export handling;
- `src/ui/fileTransfer.ts`, registered export/file-transfer tests, `package.json`,
  and relevant preview/roadmap documentation;
- `scripts/automation/phase-verification.mjs`, `run-phase.mjs`, and their tests.

## 1. Retain the failing export and settlement observations before assertions

Extend the existing harness observation/artifact plumbing rather than starting
another independent acceptance framework. Keep policy-specific checkpoints so
failures distinguish autoHide, autoDim, layerFilter and hiddenLayer.

Before the formula assertion, retain a bounded diagnostic bundle containing:

- policy, exact source, owner/request/document identity, captured label count,
  source/settings/style, camera, and background mode;
- the exact serialized settled SVG and a separately identified live-preview
  snapshot; the exported target label subtree, title/source, namespace and
  selected foreground;
- XML parse errors, label/title counts, nested SVG counts, foreground path and
  other geometry counts, and literal text fragments in the exported label;
- actual conversion kind/reason and export settlement outcome, including
  whether captured output used success, timeout or another complete fallback;
- timing for capture, conversion request/start/completion, hold, release,
  export completion and deadline, plus applicable service/export limits;
- captured and exported effective opacity, including ancestor opacity, and
  relevant explicit color/transform/visibility attributes;
- saved export rendering/reopen observations and screenshots where available.

Persist useful state before assertions and retain it on failure. Distinguish
successful scenario records from diagnostics. Do not copy the entire accumulated
request history into every checkpoint when only current-source requests matter.
Do not add model fields or user-facing debug controls for this investigation.

## 2. Diagnose the cause and make the smallest justified correction

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

Do not treat fixing the first autoDim assertion as full acceptance. Diagnose
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
identity and retained artifacts. Distinguish historical startup restrictions
from this executed parent assertion and the new outcome. The preceding ten
groups passed in this run; do not describe the old 31D failures as unresolved
on this snapshot or infer an independent review result from browser success.

The normal runner performs fix -> parent verification -> independent review.
This run failed before the 31E review. A standalone `verify` success does not
itself run review or establish approval. Keep that order and commit gate.

31E is ready for review only when:

- the zero-formula-path observation has an evidence-supported explanation and
  minimal fix, with useful failing-case artifacts and a meaningful regression;
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

Report changed files; exact failure policy/source and retained SVG/settlement
measurements; whether the cause was product export, fixture timing or oracle;
the minimal correction and regression; visibility/opacity and full standalone
results; preserved snapshot/raw-source/history behavior; commands, versions,
exit statuses and focused/full counts; evidence paths and checkout identity;
and remaining unavailable or failing checks. State parent verification and
independent review status separately, without claiming future steps passed.
