# Phase 31E Targeted Fix Prompt: Preserve settled label subtrees across SVG server rendering

## Environment

Work on the current `phase/31e-tex-label-svg-export` checkout. Preserve the
pending Phase 31E implementation, fixtures, tests, documentation and all user
changes, including untracked files. Inspect current status first; do not reset
the branch, restore a historical base, or rerun implementation from scratch.

The latest failed parent verification used
`5f357d1b186302fda951ff073f2e32c68a34b2ce` plus four modified tracked files:
`docs/PREVIEW_UI.md`, `docs/ROADMAP.md`, `package.json`, and
`scripts/checkSettledSvgExports.mjs`. Two files were untracked:
`scripts/standaloneSvgCapture.mjs` and
`tests/scripts/standaloneSvgCapture.test.mjs`. Preserve these bounded-capture
changes and their registered tests. Files may since have changed or been
committed; the recorded snapshot is evidence, not a checkout to restore.

Preserve independent standalone-page ownership, pre-capture diagnostics,
settlement observations, exact-source oracles and negative controls. Preserve
the runner's parent verification/review gates and Phase 31D's merged
candidate-cycle correction and recovery coverage.

The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Preserve pinned
MathJax, shared parser/adapter/cache/rendering semantics and authoritative raw
model text. Limit work to the confirmed export defect and further demonstrated
31E regressions. Phase 31F's combined audit and unrelated lint cleanup remain
out of scope. Settled export is required in this phase, not deferred to 31F.

## Execution priority for this follow-up

The supplied report combines the earlier **screenshot-correction child
handoff** with its subsequent **failed parent verification**. These are two
stages of the same run, not evidence that the production subtree-loss fix has
already been attempted. The parent evidence directory remains
`stz-phase31e-before-review-Qku3Ld`; a repeated copy of that log is not a new
verification result.

Complete the work in this order:

1. Confirm the current production render/parse/extract/replace path against the
   retained title-only artifact. The faulty implementation is in
   `src/ui/svgSettledExport.ts`, not the bounded screenshot helper.
2. Correct that production boundary as specified in section 1 and add the
   regression in section 2. If a later checkout already contains a correction,
   identify it and verify the actual path instead of duplicating the change.
3. Preserve the completed screenshot work and run the applicable checks. A
   child browser-startup restriction does not prevent the source correction or
   available Node regressions; report remaining native checks accurately.
4. Hand off the corrected checkout for fresh parent verification of all eleven
   groups, followed by independent review.

A screenshot-only change or another report of its passing helper tests does
not fulfill this follow-up. The requested result is a production correction
that retains the captured label subtree, with regression evidence. Do not stop
at the diagnosis or replace this implementation task with another fix prompt.

## Latest execution findings

This is a **parent verification failure before independent 31E review**.
Chrome started, the preceding ten groups completed, autoHide passed, and the
autoDim standalone PNG was saved successfully. The failing assertion now
detects missing exported foreground geometry. Do not describe the current
failure as a screenshot timeout, child sandbox restriction, or page/context
ownership error. Do not invent severity counts, `REVIEW_JSON` or approval.

The child handoff at `/private/tmp/stz-31e-bounded-capture/handoff.json` records
128 focused tests within 2,403 full tests and no child-native PNG because its
Chrome startup was blocked. Preserve those results as child-only history.
The subsequent parent observations below establish actual document/body state
and saved PNGs. Do not carry the child's "No new document/body measurement or
native PNG exists" statement into the current combined status, or treat the
parent's successful image capture as successful foreground verification.

### Current failure: a successful conversion exports only its title

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-Qku3Ld
```

Read `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json`, `checkout.diff`, `checkout-untracked.json`;
- `settled-export-autoDim-completed.json` and its referenced capture/live SVGs;
- `settled-export-autoDim-completed-label-2-before-sanitize.svg`;
- `settled-export-autoDim-completed-detachedBeforeSanitization.svg` and
  `settled-export-autoDim-completed-serialized.svg`;
- `settled-export-autoDim-standalone.json` and
  `settled-export-autoDim-standalone.png`;
- the corresponding autoHide completion/standalone evidence and autoDim
  failure diagnostics.

The checkout was unchanged during verification. Its fingerprint was
`1cfe1d338e653e6040d1922168cc25607c68778f4e6b651cb1989103aa35a80c`.
The run used Node v26.9.0, Chrome `153.0.8010.52`, the external Playwright
runtime, and the Vite fixture at `http://127.0.0.1:5174`.

`check:free-labels` exited 1 at `settled-SVG-export-standalone`, near
`scripts/checkSettledSvgExports.mjs:563`:

```text
assert.equal(reopened.namespace.foreground, 'http://www.w3.org/2000/svg')
actual: undefined
expected: 'http://www.w3.org/2000/svg'
```

This is the namespace of the missing **foreground element**, not a malformed
root namespace. Root and label owner namespaces passed. The saved XML has no
parser errors; syntactic validity alone does not establish fidelity.

| Saved observation | Latest result |
| --- | --- |
| Policy / source | autoDim / `$\frac{autoDim}{x}$` |
| Captured labels / effective opacity | 1 / approximately 0.245 |
| Settlement outcome / status | `success` / `ready` |
| Settlement elapsed / deadline budget | 137 ms / 10,050 ms |
| Converted math geometry | 1 SVG, 12 groups, 8 paths, 1 rectangle |
| Selected detached label before sanitization | Only `<title>`; no label group or geometry |
| Serialized output | 472 bytes; sheet geometry and the label title, no formula |
| Reopened foreground / bounds | Missing / `null` |
| Standalone document | `image/svg+xml`; no HTML body; valid SVG namespace |
| Root / viewport | 900 × 700 / 1100 × 850 |
| Screenshot | Saved, 1100 × 850 PNG; complete root coverage |
| External requests / browser errors | None / none |

The retained detached-label file contains only:

```xml
<title xmlns="http://www.w3.org/2000/svg">$\frac{autoDim}{x}$</title>
```

The foreground is already absent before sanitization. This is a demonstrated
production subtree-loss defect, not merely an oracle selector issue. Conversion
completed well before its deadline; changing limits does not address it.

### Confirmed cause: React title hoisting and first-child extraction

At `src/ui/svgSettledExport.ts:167`, `prepareSettledSvgExport()` calls
`renderToStaticMarkup(createElement(SvgTexLabelView, ...))`. That view returns
a `<g>` containing a `<title>`, paint group and foreground group. There is no
enclosing React `<svg>` while server rendering occurs.

Installed React DOM 19.2.7 treats this render as HTML context and hoists the
title before the group. A local reproduction using the installed renderer
confirmed this difference:

```xml
<!-- Rendering g(title, path) without a React svg parent -->
<title>$x$</title><g><path d="M0 0 L1 1"></path></g>

<!-- Rendering the same label inside an actual React svg parent -->
<svg xmlns="http://www.w3.org/2000/svg"><g><title>$x$</title><path d="M0 0 L1 1"></path></g></svg>
```

The code adds an SVG wrapper to the already-rendered string, parses it as XML,
and selects `document.documentElement.firstElementChild`. That element is the
hoisted `<title>`, so `target.replaceWith(...)` discards the actual label group
and all its geometry. Adding a namespace after server rendering cannot restore
the missing SVG rendering context.

Existing `tests/ui/svgSettledExport.test.ts` tests settlement/controller
behavior and matches patterns in the entire renderer string. That string still
contains paths, so those assertions pass. They do not execute the production
parse/extract/replace/serialize boundary where the paths are lost.

### What passed, and what remains incomplete

| Check | Latest parent result |
| --- | --- |
| `npm test` | Exit 0; 2,403 passed, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at autoDim foreground namespace assertion |
| Independent 31E review | Not reached |

There are 120 passing scenario records, ten completed groups and no reported
`pageErrors`. The eleventh group started but remains incomplete;
`unexecuted: []` tracks groups, not individual checks. AutoDim did not pass,
and later policies, invalid-viewport retry, and actual App download/reopen
acceptance were not reached in this run.

AutoHide correctly captures zero labels and therefore does not exercise the
broken boundary. Passing `current-SVG-cloning` checks use existing live geometry
and also do not establish settled export correctness. Preserve all passing
31D and App regressions.

The independent-page ownership error and earlier full-page screenshot timeout
are repaired in the executed visibility path. Both autoHide and autoDim now
have native capture evidence. Preserve that work; later App download/reopen
capture still requires execution. The historical autoDim failure in
`stz-phase31e-before-review-r43lZG` lacked its original output, so do not claim
this run proves every detail of that older failure.

## Goal

Preserve the complete shared label renderer output through detached SVG
preparation, extraction, replacement and serialization. Add regression coverage
that fails for the current title-only result, then obtain fresh complete parent
browser verification and independent review without weakening existing gates.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31e-implement.md`, and
  `prompts/phase-31e-review.md`;
- the latest parent evidence above, including tracked/untracked file snapshots;
- `src/ui/svgSettledExport.ts`, `src/ui/svgPreviewExport.ts`,
  `src/rendering/svgLabelExportRegistry.ts`, `src/rendering/svgLabelView.ts`,
  `src/rendering/SvgTexLabel.tsx`, and the shared label service/runtime;
- `tests/ui/svgSettledExport.test.ts`, `tests/ui/svgPreviewExport.test.ts`,
  inline-label runtime tests and App export/file-transfer handling;
- `scripts/checkSettledSvgExports.mjs`, `scripts/checkFreeLabels.mjs`,
  `scripts/fixtures/freeLabels.tsx`, `scripts/fixtures/freeLabelsApp.tsx`, and
  `scripts/fixtures/tsconfig.json`;
- `scripts/fixtures/settledSvgExportOracle.ts` and its registered tests;
- `scripts/standaloneSvgCapture.mjs` and its registered helper tests;
- installed React DOM server-renderer title/SVG-context handling as needed;
  do not patch or downgrade installed dependencies;
- `package.json`, relevant preview/roadmap documentation,
  `scripts/automation/phase-verification.mjs`, `run-phase.mjs`, and their tests.

## 1. Repair the actual detached-render boundary

Apply a small production correction in the settled export path. Render the
shared `SvgTexLabelView` within an actual React `<svg>` element with the SVG
namespace before calling `renderToStaticMarkup`, then parse that complete SVG
document. Preserve the renderer's title inside its owning label group.

Before replacing the captured target, validate the parsed root and extracted
label: they must have the expected SVG namespace and local names, and the
wrapper must contain the expected single direct label `<g>`. Check captured
label identity/source and required renderer structure at this boundary where
appropriate. A non-null first child is insufficient. Do not silently accept a
title-only result, foreign namespace, parser error, or unexpected structure as
successful preparation.

Preserve the complete subtree: title, layout/placement transforms, paint group,
foreground text/math geometry, optional glyph-local white outline, explicit
color and captured effective opacity. Keep raw source escaped by React as text
and geometry supplied by the validated adapter. The temporary wrapper must
not introduce a nested viewport or change the final label's placement.

Do not delete the title, select an arbitrary descendant group, strip hoisted
nodes with a regular expression, or duplicate the shared renderer to satisfy
the assertion. Do not change live preview markup solely to bypass this export-
context error. Preserve accessibility and exact-source ownership.

Use captured settled results directly in the detached snapshot. Do not wait
for a later live React commit and clone a potentially different current view.
Preserve immutable click-time captures, cancellation/identity checks, bounded
settlement and the existing sanitization boundary. Export must not mutate the
live SVG, authoritative model, history or TikZ output.

Treat invalid detached structure as export-preparation failure, with no
malformed download or false success. Preserve normal per-label literal
fallback for actual conversion failures; do not hide a structural defect by
converting successful math into fallback. Empty legitimate labels and snapshots
with no represented labels remain valid: do not require math paths for every
label or reject autoHide/hidden-layer zero-label exports.

## 2. Test the boundary that lost the subtree

Add a regression exercising the real `prepareSettledSvgExport()` path,
including server rendering, native XML parsing, child extraction, replacement,
sanitization and final serialization. Use existing browser fixtures for native
DOM behavior; no new DOM-emulation dependency is necessary. A focused Node
regression for a factored production helper can supplement this coverage, but
cannot replace the preparation path with a mock or copied algorithm.

Demonstrate that the regression detects the pre-fix title-only result. Checking
only that the entire intermediate string contains paths, opacity or source
repeats the existing blind spot. Check the selected/replaced subtree and the
final parsed SVG for the same captured label.

Cover these cases through the repaired boundary:

- successful math retains its owning title/group, SVG foreground geometry,
  placement, explicit color and captured dimmed opacity;
- ordinary Unicode and failed full-source literal fallback retain visible text,
  including markup-like characters, delimiters, backslashes, whitespace, tabs
  and physical newlines, without interpreting source as markup;
- an inline label retains its foreground and separate glyph-local halo with
  captured position/color/opacity; halo paths alone cannot prove foreground;
- repeated formulas and reused local IDs retain their captured owners and
  valid self-contained references;
- empty source and zero represented labels remain valid;
- malformed, title-only, wrong-namespace or structurally missing label output
  cannot be accepted as successful preparation, using focused validation tests
  or controlled fixture cases without adding production debug switches.

Retain the exact-source oracle and negative controls. Exercise controls against
an actual valid foreground target, not an absent target that makes every
corrupted case fail trivially. Do not count unrelated sheet paths, another
label, halo copies or raw fallback as successful expected math. Preserve
source-specific geometry, finite nonzero bounds, effective opacity and native
raster assertions. Do not depend on test-only selectors/metadata surviving
sanitization for the final standalone fidelity checks.

## 3. Preserve repaired capture and retain proof of the correction

Keep `captureStandaloneSvg()` in both visibility and actual download/reopen
workflows: `fullPage: false`, explicit 5-second capture timeout, measured full
SVG-root coverage, finite viewport expansion and verified PNG dimensions.
Preserve independent page ownership and cleanup. Do not reintroduce full-page
capture that depends on an HTML body, wrap saved SVG files in HTML, disable
font waiting, or patch Playwright.

Retain DOM/document, geometry, opacity, raster and request observations before
capture and assertions. A saved-image claim requires a successful write and
an existing matching PNG. Preserve bounded failure handling with no second
screenshot attempt, and cleanup that does not mask the primary error.

Keep policy-specific captured/live/detached/serialized SVGs, source-specific
request/settlement timings and the production non-mutating observer. Show that
autoDim now retains a complete label group before and after sanitization, then
reopens with its own foreground, finite bounds and the captured approximately
0.245 opacity. Use the actual capture value; do not hard-code this fixture
number into production.

Keep observations diagnostic until the scenario passes. Add only missing
evidence needed to establish the repaired boundary; do not redesign diagnostics
or duplicate the entire request history at each checkpoint. Do not use sleeps,
retry-until-green loops, extended conversion deadlines or a pre-settled capture
to evade pending-at-click coverage.

## 4. Finish all visibility and standalone download acceptance

Run autoDim and the remaining visibility policies, then the actual App
download/reopen workflow. Preserve and verify:

- autoHide and hidden-layer labels remain excluded without export-only
  conversion; autoDim and layer-filter dimming settle represented labels and
  retain captured effective opacity after classes are removed;
- pending free/inline labels, repeated formulas, Unicode text, successful math,
  and complete malformed/resource-failure literal fallback;
- synchronous capture before suspension, edits/style/view/document changes
  during preparation, and a later export reflecting the new 3D view;
- accessible pending/success/failure status, duplicate-click suppression,
  finite failure handling, retry and temporary-resource cleanup;
- actual transparent and white SVG downloads reopened outside the application,
  preserving geometry, placement, explicit colors, glyph-local white outlines,
  multiline/tab/markup-like fallback, backgrounds and visible raster pixels;
- finite dimensions, valid collision-free local references, no external
  resources/page CSS/runtime dependence, and exclusion of editor overlays;
- invalid-viewport/serialization failure without malformed downloads or live
  mutation, followed by successful retry.

Compare export-side non-mutation against the state after intentional user
edits; do not require history to remain unchanged across deliberate edits.
Diagnose and minimally fix later demonstrated 31E failures. Passing the one
foreground assertion does not establish complete standalone acceptance.

Preserve the ten preceding groups and the additional
`settled-SVG-export-standalone` group. Phase 31E requires **all eleven**, with
actual saved/downloaded/reopened artifacts for this group. Retain the parent
validator's rejection tests and compatibility with complete earlier-phase
reports. Do not weaken it to accept ten groups for 31E or change sandbox,
verification, review, commit or push gates.

## Verification and permitted execution

Run focused checks with the required Node PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test \
  tests/scripts/settledSvgExportOracle.test.ts \
  tests/scripts/standaloneSvgCapture.test.mjs \
  tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts \
  tests/ui/fileTransfer.test.ts \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/runPhaseRunner.test.mjs
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/standaloneSvgCapture.mjs
node --check tests/scripts/standaloneSvgCapture.test.mjs
node --check scripts/checkSettledSvgExports.mjs
node --check scripts/checkInlineLabels.mjs
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkFreeLabelGeometry.mjs
node --check scripts/checkFreeLabelRaces.mjs
node --check scripts/checkFreeLabelsApp.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/standaloneSvgCapture.mjs tests/scripts/standaloneSvgCapture.test.mjs \
  scripts/checkSettledSvgExports.mjs scripts/checkFreeLabels.mjs \
  scripts/fixtures/freeLabels.tsx scripts/fixtures/freeLabelsApp.tsx \
  scripts/fixtures/settledSvgExportOracle.ts \
  tests/scripts/settledSvgExportOracle.test.ts \
  src/ui/svgSettledExport.ts src/ui/svgPreviewExport.ts src/ui/fileTransfer.ts \
  src/rendering/svgLabelExportRegistry.ts src/rendering/svgLabelView.ts \
  src/rendering/SvgTexLabel.tsx tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts tests/ui/fileTransfer.test.ts
npm test
npm run build
git diff --check
```

Include additional changed files in applicable targeted checks. Register new
Node tests in the explicit `package.json` test command. Keep focused counts
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
successful matching parent browser results without repeating commands in its
restricted child environment. Partial or stale evidence cannot close the gate.

## Documentation and acceptance criteria

Update only relevant Phase 31E preview/export and roadmap status. Record the
confirmed title-hoisting/first-child extraction defect, minimal correction,
regression coverage, commands, versions, exit statuses, checkout identity and
retained artifacts. Replace stale claims that native capture still awaits a
parent attempt with this run's saved PNGs and failed foreground assertion.
Distinguish repaired capture, the current production bug, historical failures
and newly executed results. Do not infer review approval from tests.

The normal runner performs fix -> parent verification -> independent review.
This run failed before review. A standalone `verify` success does not itself
run review or establish approval. Preserve that order and the commit gate.

31E is ready for review only when:

- detached server rendering uses SVG context and preserves the intended label
  group/title/paint/foreground through replacement and final serialization;
- a regression exercising actual preparation detects the old title-only defect,
  including literal and inline-label behavior;
- successful captured math retains source-specific geometry, bounds, placement,
  color and effective opacity; invalid structure cannot report false success;
- native autoDim and all remaining policies pass with pre/post-sanitization and
  standalone evidence, preserving valid zero-label exports;
- bounded capture, pre-image diagnostics, PNG coverage and independent resource
  cleanup remain intact without live/model/history mutation;
- actual App downloads/reopens pass for both backgrounds, pending edits,
  subsequent 3D view and failure/retry cases;
- fresh matching parent browser evidence is `passed`/`complete`, identifies the
  browser, completes all eleven groups, and has no incomplete/unexecuted groups
  or page errors, with observations for the formerly unexecuted cases;
- required tests/build/static/diff checks pass, earlier-phase regressions remain
  intact, and documentation matches observed results.

Do not mark 31E complete before required verification and independent review
succeed. Phase 31F remains deferred.

## Report after implementation

Lead with the new production correction and its status. Identify the exact
production function/files changed (or the existing correction verified), the
regression that detects the former title-only output, and the current checkout
fingerprint. Report fresh test results separately from the historical
screenshot handoff. If native verification remains for the parent, name that
pending gate explicitly; do not imply the old Qku3Ld evidence verifies the new
checkout or that "Implemented the bounded screenshot correction" describes
the work requested here.

Report changed files; the reproduced React SVG-context/title-hoisting behavior;
the corrected render/parse/extract/replace boundary and validation; regression
evidence that catches the previous title-only output; preserved full-source
fallback, inline halos and snapshot/raw-source/history semantics; native
autoDim and remaining policy/App download/reopen results; retained SVG/PNG/
diagnostic paths and checkout identity; commands, versions, exit statuses and
focused/full counts; and unavailable or failing checks. State parent
verification and independent review status separately, without claiming future
steps passed.
