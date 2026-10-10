# Phase 32D Fix for the wrapped Hidden points select locator

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and completed Clear,
Inspector/toolbar selection, native drag, and document revision corrections.
Repair the next concrete browser harness failure: the exact-label locator for
the source panel's Hidden points select times out because its wrapping label
also contains the option text.

The latest parent passes all eleven shape cases and the complete eight-case
2D/3D contour interaction scenario. Preserve that native preparation and
evidence coverage while correcting the visibility control lookup.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing. Preserve
implementation, regressions, raw contracts, PGF references, and documentation.
Do not repeat resolved fixes or rewrite unrelated files.

Keep strict cumulative 32D verification and the parent workflow's
verification-before-review/commit contract. Historical scoped evidence cannot
establish a 32D pass. Phase 32 remains incomplete until the actual tree has
complete accepted verification and matching independent review.

## Latest evidence and checkout identity

The completed toolbar-fix handoff is
`/private/tmp/stz-32d-toolbar-fix-20261010/HANDOFF.md`.
Its inventory, tracked/untracked diff, preservation hashes, logs, and final
identity are retained in the same directory. Its child strict report stopped
at browser startup; the newer browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-rcS2K4/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-yYQ7Zh/verification.json`.
- Primary browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-yYQ7Zh/05-check-free-labels/command.log`.
- Native observations and failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-yYQ7Zh/05-check-free-labels/artifacts/`.

At this prompt update, the branch is `phase/32d-margin-minsize-anchor`, HEAD
`c2ddd167d5f0a6c99dc392368b02bc9d477ff629`. The pre-update tree matches both
before/after identities of the latest parent report:

```text
0247ca3751fb2e6771938de81afba251c8a464b0729b6f2e8136473803ca472b
```

Preserve the twelve modified tracked files: both Phase 32 documents,
`scripts/checkPointLayoutAnchors.mjs`, shared selection/native drag helpers,
both geometric/layout contracts, both Phase 32C/32D policy suites,
`tests/scripts/pointNativeDrag.test.mjs`,
`tests/scripts/pointNativeDragFixture.mjs`, and
`tests/scripts/runPhaseRunner.test.mjs`.
Also preserve the new untracked
`tests/scripts/pointGeometricSelectionFixture.mjs`.
Earlier corrections are already tracked. Updating this prompt changes the
identity again; capture the actual current tree rather than hard-coding a
historical fingerprint.

| Retained run | Actual result |
| --- | --- |
| Toolbar-fix child | 647 focused checks and final 5,830/5,830 full tests passed without failures/skips. Build, diff, and thirteen syntax checks passed. No new lint errors; five reproduced baseline errors remain. Direct browser commands failed before Chrome at fresh-server `listen EPERM`; strict child verification stopped at `check:label-assets`, without review/commit. |
| Latest browser-capable parent | 5,830/5,830 tests, build, diff, and full `check:label-assets` passed. Chrome 154.0.8037.98 ran native scenarios. Paint/import, all eleven named shapes, and `point-geometric-native-contours-2d-3d` passed. The next visibility scenario stopped at its Hidden points locator. |

The parent completed 15 of 18 cumulative groups. All eight contour
interactions have terminal scenario evidence, including trusted native
selection/drag, one bounded commit, exact Undo/Redo, and maintained epochs
100 through 107. This does not complete `point-node-geometric-shapes`:
visibility and subsequent geometric downloads remain pending. The layout/
anchor group and final standalone-export group did not execute.
Page errors are empty. The latest native locator failure is distinct from the
child's startup failure and the resolved toolbar/drag/revision assertions.

## Preserve the completed native contracts

Keep Clear's detached imported paint/shape/layout behavior, exact persistence
comparisons, raw source, policy/UI regressions, history, and JSON reload.

Keep scoped native Inspector preparation and toolbar handling:
Select access before conditional collapse, unique real controls, bounded
detached/collapsed confirmation, exact model/history/epoch/selection invariance
of UI actions, fresh connected fixed .23 contour measurement/current CTM/hit
stack, one intended native click, trusted owner/path delivery, owned native
restoration, and first-error-preserving diagnostics/cleanup.
Preserve the precise native SVGPoint binary32 allowance without changing PGF
geometry/reference tolerances or accepting altered requested coordinates.

Keep drag/layout preparation and owner cycling, selected-point-only movement,
original gesture, pointer identity/capture/release, exactly one bounded history
commit, exact saved/runtime Undo/Redo, and raw parent-imported evidence
validation. Preserve native Inspector reopening for Shape/parameter controls,
subsequent Select access, History controls, runner fixture dependencies, and
all current test registration.

Keep valid same-document revision equality through preparation/drag/Undo/Redo,
observed/authoritative and event epoch comparisons, and all revision regressions.
Native JSON load/example replacement still advances document ownership;
load's exact +1 and reused-ID stale completion isolation remain required.
Do not modify production revision/cache/model behavior.

## Diagnose the wrapped-label lookup failure

The current failure is:

```text
locator.selectOption: Timeout 30000ms exceeded.
waiting for getByLabel('Hidden points:', { exact: true })

runPointNodeGeometricShapeChecks
  scripts/checkPointNodeGeometricShapes.mjs:247
scripts/checkFreeLabels.mjs:482
```

Read `free-labels-evidence.json`, `point-geometric-failure.json`,
`point-geometric-app-failure.json`, `point-geometric-app-lifecycle.json`,
the failure PNG, and `point-geometric-native-contours-2d-3d.json`.
The active failed scenario is `point-geometric-visibility`.
The summary checkpoint still names the last observed contour scenario; it
does not mean visibility preparation never started.

The retained source and failure snapshot establish:

- The Hidden points caption has not been renamed. The control is inside the
  Generated TikZ source panel, not the Inspector or a closed visibility drawer.
- The DOM contains a `label.tikz-export-mode-control` with an exact
  `span` caption `Hidden points:` and its sibling native `select.toolbar-select`.
  It has no explicit `aria-label` or `aria-labelledby`.
- Options are `dimHidden` / `Dim hidden` and `hideHidden` / `Hide hidden`.
  The retained select has no disabled attribute. The preceding
  `Enable approximate 3D visibility` checkbox action returned, and the PNG
  shows that checkbox checked.
- The source-panel heading is an internal scroll area. The PNG does not show
  the lower Hidden points field, but the captured DOM retains it and its
  options. The overall DOM snapshot is truncated; these particular nodes
  were captured. Inspector is closed, which is unrelated to this field.
- The timeout record contains no matched-control count, associated-label
  text, control value, or native input/change trace. Retain those in the next
  focused diagnostics rather than inventing them.

Inspect `src/App.tsx`'s source-panel markup, point visibility options, and
`updateAutoVisibility` / `updatePointVisibility`.
The select is disabled only outside 3D or while approximate visibility is
disabled. There is no separate Open visibility panel action for this markup.

The configured local Playwright implementation can be read in
`/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/lib/coreBundle.js`.
Its internal label engine reads the associated wrapping label through
recursive `elementText`, including descendant option text; the strict matcher
compares the complete normalized label text. Consequently a caption-only exact
`getByLabel('Hidden points:')` does not match this wrapping label.
This is consistent with the established wrapped Inspector select issue.
Do not treat it as missing UI or increase the timeout.

## Resolve the actual source-panel field and retain native evidence

Correct this lookup in the geometric visibility workflow with a small scoped
resolver or local locator:

1. Scope to the actual `.source-panel` and match only its exact
   `Hidden points:` caption span. Require one caption and its direct owning
   production label; do not match option/warning text or unrelated captions.
2. Resolve the native select belonging to that label. Verify exactly one
   connected visible control, its label association/structure, enabled state, and exact
   available option values `['dimHidden', 'hideHidden']`.
   Use appropriate native scrolling in the source header before the action.
   A genuinely hidden/disabled/ambiguous control must fail with diagnostics.
3. Keep the real approximate-visibility checkbox action and confirm 3D/enabled
   prerequisites. Use the resolved control's bounded `selectOption('dimHidden')`;
   verify returned selection and actual final control value.
4. Retain read-only before/after records of caption/label text, old/corrected
   locator counts, connected control/options, DOM enabled state, bounds/scroll
   ancestors, selection result, and authoritative `uiSettings.visibility`.
   Retain precondition observations before control assertions, and capture
   after-action evidence before success assertions.
5. Record actual input/change observations when collected, with their real
   provenance. Do not fabricate trusted flags or require pointer delivery
   from a selectOption action. Keep event observation owned and bounded.
6. Preserve raw source/style/coordinates, saved/runtime model, history,
   document epoch, camera/work plane, and selection through the policy action.
   Permit the intended visibility UI setting change. Verify actual resulting
   rendering and preserve locked/hidden/dimmed assertions.

`scripts/pointInspectorFields.mjs` provides an established exact-caption/
owning-wrapper/native-control pattern, but is intentionally hardwired to
`#preview-inspector-drawer` / `.inspector-field`.
Do not use it unchanged for this source-panel field, open the Inspector to
search for the control, or broadly rewrite Inspector architecture.
A one-caller scoped correction is sufficient unless actual reuse justifies a
small shared helper.

`dimHidden` may already be selected. Record its actual prior value and do not
claim an effective policy transition from a same-value selection. If native
change coverage is needed, exercise both available values through the same
real control and retain the actual resulting states; do not mutate fixture
settings to manufacture a transition.

Keep bounded failure observations and primary action/assertion precedence.
Do not repair by a loose substring label, `.first()`, selecting a positional
dropdown, concatenating current option text into an exact label, manually
setting DOM/App model state, synthetic event dispatch, force actions, arbitrary
sleeps, timeout inflation, or production markup/style changes solely to
satisfy the harness.

If the corrected real control is disabled, inaccessible, or fails to produce
the expected rendered visibility, retain that new control/state/render trace
and diagnose its own concrete cause. Do not drop the dimmed-opacity assertion
or assume the selector repair proves visibility correctness.

## Regressions and native continuation

Extend registered script controls for the affected visibility locator and
geometric parent evidence. Cover a wrapping label whose exact caption matches
while option descendants contaminate the complete label text; verify the
resolved unique associated native select and exact options.

Include missing/duplicate/wrong-caption/wrong-wrapper/wrong-control cases,
hidden or disabled controls, unavailable/disabled requested options, internal
scroll preparation, exact returned/final value, observed visibility settings,
same-value no-op handling, stale state, and primary errors surviving diagnostic/
artifact/listener cleanup failures. Preserve current toolbar, selection,
revision, capture, history, and runner regressions.

Retain raw control/settings/render observations in the applicable
`point-geometric-visibility` contract and reject fabricated success booleans
or records from an unrelated control. Keep its locked, hidden, dimmed-visible,
and actual opacity requirements. Synthetic fixtures remain policy tests,
not native acceptance.

Reuse the cumulative App page through all eleven shapes and eight contour
interactions, then reproduce the exact 3D visibility setup and resolved policy
action. Complete geometric visibility and both pending geometric downloads,
the full layout/anchor/owner-cycle matrix, and final standalone export.
Require actual pending transparent/white downloads, reopened standalone SVG,
both TikZ modes, and retained raw persistence/history evidence.

Use strict TypeScript without `any`, register any new test file in the explicit
test list, and copy any new imported helper dependency in runner fixtures.
Add no dependency. Preserve model coordinates, 2D z=0, active 3D work planes,
and the mathematical codimension convention.

## Preserve the Phase 32D geometry and persistence contract

Keep saved envelope version 2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution, and per-axis em/ex context. Preserve
PGF solvers/anchors, body/baseline/depth inputs, unsupported-anchor diagnostics,
overflow-body picking, painted/anchor-clearance bounds, 2D/3D projection,
and immutable click-time export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
all reference/raw files and tolerances. No geometry/reference regeneration is
justified by this selector mismatch. The diamond outer-separation exception
still requires independent PGF review. Preserve external source/exact text,
typography/paragraph/TeX-program limitations, free labels, and path inline nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused visibility/selection,
toolbar/drag, ownership, both parent policy suites, and runner regressions.
Run required commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Run applicable focused TypeScript/lint and syntax checks for changed scripts.
Report reproduced baseline lint debt separately from new errors: four
geometric caller `no-unsafe-finally` errors and the verifier's unused `_role`.
Avoid unrelated cleanup. Failed/unavailable checks cannot be reported passed.

Use a fresh owned server and supported Playwright/Chrome in the browser-capable
parent. Focused diagnostics and scoped 32C cannot establish strict 32D
acceptance. If the child hits `listen EPERM`, retain its startup failure and
hand the exact tree to the parent without weakening sandbox/acceptance rules.
Do not describe the latest parent locator failure as startup failure.

Load updated helpers/contracts/policy in a fresh parent process and verify the
preserved dirty tree without committing:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
```

Preserve the implementation/fix runner's clean-tree guard. Do not reset,
discard, stash, commit, or push unfinished work to bypass it.
Require all twelve 31F groups, three 32A groups, full 32B paint/import,
complete 32C shapes, and `point-node-layout-anchors-combined`.
Require terminal successes, valid raw artifacts, no page errors, native
history/JSON persistence, both TikZ modes, actual pending transparent/white
downloads, and reopened standalone SVG. Preserve first failures and cleanup.

Diagnose each later failure from its own first evidence. Do not skip
predecessors, reuse historical/scoped reports, create a deferred 32D profile,
or reclassify an unexpected failure as backlog.

## Independent review and completion

After complete fresh strict parent verification, obtain read-only independent
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md`. Inspect the actual report/artifacts.
Matching accepted parent evidence can support a sandboxed reviewer;
stale, partial, or failed reports cannot substitute for acceptance.

Update implementation/plan/roadmap status only to observed accepted results.
Keep Phase 32 incomplete while any native/download/reference or review gate
remains open. Preserve stop-before-review/commit on failed verification and
the parent's post-review identity guard.

Report the scoped visibility locator/evidence correction, changed files,
focused/full checks, fresh parent evidence/identity, actual visibility/
download/standalone coverage, review result, and any remaining concrete failure.
Leave commit/push to the parent workflow after verification and review pass.
Do not claim completion from child-only or historical results.
