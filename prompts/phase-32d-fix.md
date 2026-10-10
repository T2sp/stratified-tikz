# Phase 32D Fix for canonical layer visibility evidence

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and completed Clear,
Inspector/toolbar selection, native drag, document revision, source-panel
Hidden points resolver, and native camera preparation corrections.
Repair the next concrete parent failure: the geometric visibility evidence
contract requires raw `layer.visible === true` even though production
normalizes the visible default by omitting that optional field.

Correct the affected harness/contract and faithful policy fixtures. Preserve
production layer semantics, model serialization, geometry, references, all
completed native helpers, and the actual control/settings/event/render evidence.
Do not repeat resolved fixes or rewrite unrelated files.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing.

Keep strict cumulative 32D verification and the parent workflow's
verification-before-review/commit contract. Historical scoped evidence cannot
establish a 32D pass. Phase 32 remains incomplete until the actual tree has
complete accepted verification and matching independent review.

## Latest evidence and checkout identity

The latest child handoff is
`/private/tmp/stz-32d-visibility-fix-20261010/HANDOFF.md`.
Its exact inventory, tracked/untracked diff, preservation hashes, reports,
and logs remain in the same directory. The browser-capable parent's newer
records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-lq8SsK/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-IocgXz/verification.json`.
- Primary browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-IocgXz/05-check-free-labels/command.log`.
- Native observations and failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-IocgXz/05-check-free-labels/artifacts/`.

At this prompt update, branch is `phase/32d-margin-minsize-anchor`, HEAD
`0c622432757e67d5a37c50a8aa84da969d67d670`. The actual pre-update tree matches
both before/after identities of IocgXz and the child handoff:

~~~text
eed21c4302d499b43d75d5a9ae9a5dbdf9b92d69510bb80a2ab0899e29b26bf6
~~~

The older `c2ddd167` checkout was subsequently tracked by the parent.
Preserve the eight modified tracked files: both Phase 32 documents,
`package.json`, `scripts/checkPointNodeGeometricShapes.mjs`,
`scripts/pointGeometricShapesContract.mjs`, both Phase 32C/32D policy suites,
and `tests/scripts/runPhaseRunner.test.mjs`.
Preserve the four new untracked files:
`scripts/pointSourceVisibility.mjs`,
`tests/scripts/pointSourceVisibility.test.mjs`,
`tests/scripts/pointSourceVisibilityFixture.mjs`, and
`tests/scripts/pointGeometricVisibilityFixture.mjs`.
Earlier native corrections are already tracked. Updating this prompt changes
the identity; capture the actual current tree rather than hard-coding this
historical fingerprint.

| Retained run | Actual result |
| --- | --- |
| Visibility-fix child | Final exact-tree 5,987/5,987 full tests and 870 focused checks passed without failures/skips. Build, diff, and nine syntax checks passed. No new lint errors; five reproduced baseline errors remain. Both direct browser commands failed before Chrome at fresh-server `listen EPERM`. Strict child verification stopped at `check:label-assets`, without review/commit. |
| Latest browser-capable parent | 5,987/5,987 tests, build, diff, and full `check:label-assets` passed. Chrome 154.0.8037.98 ran native scenarios. Paint/import, all eleven named shapes, and the complete eight-case `point-geometric-native-contours-2d-3d` passed. Visibility camera/control actions completed and raw observations were recorded; the final visibility validator rejected omitted `visible`. |

IocgXz completed 15 of 18 cumulative groups. The checkpoint is
`point-geometric-visibility-observed`. The geometric group remains incomplete:
visibility has no terminal pass, and both geometric downloads did not execute.
The layout/anchor group and final standalone-export group did not execute.
Page errors are empty. Distinguish the latest native contract failure from the
child's startup failure and the resolved locator/camera/toolbar/drag assertions.

## Preserve the completed native and visibility contracts

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

Keep the new source-only exact-caption → direct production label → unique
associated native select resolver, connected/visible/enabled checks, exact
options, native source-header scroll preparation, bounded selectOption,
returned/final value readback, authoritative settings, owned event observation,
and primary-error-preserving bounded diagnostics/cleanup.
Keep real approximate-visibility checkbox prerequisites and dim/hide/dim actions.
Do not revert to the caption-only exact wrapping-label locator.

Keep native camera preparation using the actual theta/phi controls, conditional
details expansion, observed state continuity, theta90/phi0 readback, and the
contract that only the intended camera UI angles change.
Saved view.camera3d precedence over diagram.camera was diagnosed and corrected
in the harness. Do not alter production camera loading or manufacture settings.

Keep raw source/style/coordinates, saved/runtime model, history, epoch,
selection, active work plane, and unrelated UI settings invariant through
camera/visibility preparation except their intended UI setting changes.
Keep actual owner/occluder classification, fill opacity, connected opacity
ancestor chain, and recomputed cumulative opacity requirements.
A selectOption action's actual input/change trusted=false is retained honestly;
do not impose native pointer/trusted=true requirements on that API.

## Diagnose the canonical layer visibility mismatch

The latest first failure is:

~~~text
AssertionError: Locked point layer remains visible
+ actual - expected
+ undefined
- true

assertGeometricVisibilityEvidence
  scripts/pointGeometricShapesContract.mjs:384
assertGeometricShapeEvidence
  scripts/pointGeometricShapesContract.mjs:510
save
  scripts/checkPointNodeGeometricShapes.mjs:193
runPointNodeGeometricShapeChecks
  scripts/checkPointNodeGeometricShapes.mjs:362
scripts/checkFreeLabels.mjs:482
~~~

Read `free-labels-evidence.json`, `point-geometric-failure.json`,
`point-geometric-app-failure.json`, `point-geometric-app-lifecycle.json`,
`point-geometric-native-contours-2d-3d.json`, and the seventeen
`point-geometric-visibility-control-*.json` observations.
Read actual layer types, normalization, load/save serialization and rendering/
selection consumers before changing the contract.

The relevant production rules are:

- `src/model/types.ts` defines `DiagramLayer.visible?: boolean` and
  `locked?: boolean`.
- `src/model/layers.ts` `normalizedLayerVisibility` and
  `normalizedLayerState` omit `visible: true` and retain `visible: false`.
  Lock normalization retains `locked: true` and omits the unlocked default.
- `isLayerVisible` treats the optional visible default as visible
  (`layer?.visible !== false`); `isLayerLocked` requires `locked === true`.
- `src/model/serialization.ts` normalizes both persistent layers and loaded
  layer metadata. Supplying `visible: true` in the native loaded JSON does not
  require the field to survive in canonical runtime/saved/history state.

The caller loads an explicit locked/visible dart layer. The contract's
preceding `locked === true` assertion passed, then its raw
`visible === true` assertion rejected the normalized default.
The camera-before history independently retains:
`past[98].layers = [{ value: 0, name: 'locked', locked: true }]` and
`past[99].layers = [{ value: 0, name: 'hidden', visible: false }]`.
These are actual historical observations, not direct replacements for the
missing locked/hidden stage records.

The synthetic fixture constructs runtime/json/history directly and retains
`visible: true` for visible layers without production normalization.
Both parent policy suites accept this same fixture, concealing the native
representation mismatch. Inspect `tests/scripts/pointGeometricVisibilityFixture.mjs`
and both policy suites; do not preserve that faulty canonical-state assumption.

The resolved native actions are also actually observed in IocgXz:

- Native camera settings become theta90/phi0 while zoom1/pan0 are preserved.
- `point-geometric-visibility-control-0011.json` records the initial
  dimHidden → dimHidden same-value no-op and a dimmed semicircle.
- `...-0014.json` records dimHidden → hideHidden with no rendered point.
- `...-0017.json` records hideHidden → dimHidden with the actual occluder,
  fill opacity .28 and cumulative opacity .28.
- All three actions retain document epoch110, selected values, authoritative
  UI settings, and actual input/change records with trusted=false.

These are raw observed actions, not accepted terminal geometric visibility.
The validator stopped at the early locked-layer assertion before validating
its remaining aggregate contract.

## Correct the narrow contract without mutating raw evidence

Validate the effective visible state of the actual layer while preserving
the original raw representation:

1. Resolve the expected point's actual matching layer. Require the layer
   metadata collection and exactly one valid matching layer record for this
   explicitly configured locked scenario; preserve layer identity, name and
   point ownership checks. Missing/duplicate/unrelated metadata must not pass
   via optional chaining or a permissive default.
2. Preserve `locked === true`. Validate the optional `visible` field's
   representation: omission is a valid visible default; a present value must
   be boolean. Accept omitted/true as visible and reject false for this case.
   Reject null, strings, numbers or other invalid raw values.
3. Keep saved/runtime/history layer provenance and their actual agreement.
   Apply effective-state interpretation only to the visibility assertion.
   Do not rewrite observed JSON, normalize away corrupt evidence, insert
   `visible: true` into native state, or relax exact model/history comparisons.
4. Keep the hidden case's explicit `visible: false`, exact point source/style/
   coordinates, absent rendered node, and native load epoch transition.
   Keep actual locked rendering, unchanged state, and not-selected assertions.
5. Leave production model types, normalization, serializer, rendering,
   selection, schema/version, and fixture coordinates unchanged. This
   mismatch supplies no reason to change the app's default semantics.

A bare `layer?.visible !== false` is insufficient for this evidence contract:
it also accepts missing metadata and malformed values. Require valid owned
metadata first. Production may support implicit layers elsewhere; this
explicit locked/hidden fixture must retain its expected records.

## Retain raw observations before contract rejection

The current `save` validates before writing the terminal JSON.
Consequently `point-geometric-visibility.json` is absent after this rejection,
and the locked before/after and hidden stage bundle has no direct diagnostic
artifact. Later camera/selector records do not replace those stage observations.

Use the existing bounded observed-diagnostic mechanism for this scenario:

- Save actual locked before/after state and render observations before the
  next native load, and hidden state/render observations before the dim load.
- Save the completed raw visibility candidate bundle before its final
  contract assertions, including locked, hidden, camera, checkbox, all three
  actions, settings, native event traces and rendering.
- Publish observations as `result: observed`. Emit terminal passed artifacts
  and success records only after the unchanged applicable contract succeeds.
  Never let observed candidates or success booleans satisfy parent acceptance.
- Bound diagnostic/artifact work and retain the original action/assertion
  failure if secondary observation/listener/cleanup work also fails.
  Cover this ordering without broad changes to unrelated scenario saving.

Do not reconstruct absent native stage records from synthetic fixtures or
label IocgXz's visibility scenario passed after offline validator adjustment.
Require fresh cumulative native acceptance for the corrected tree.

## Regressions and native continuation

Make the synthetic visibility fixture faithful to production canonical layer
representation, with visible defaults omitted in saved/runtime/history state.
Use existing production normalization/serialization coverage or a small
meaningful regression to establish the input-visible:true → canonical-omitted
behavior; do not create a duplicate normalization implementation in a fixture.

Extend both 32C and 32D parent policy suites for this concrete mismatch:

- Accept valid canonical omitted visibility while retaining locked=true,
  layer ownership, raw rendering and all existing native evidence requirements.
  Cover valid explicit boolean true where the raw model contract allows it;
  distinguish accepted input from production canonical output.
- Reject false visibility for the locked scenario; missing/duplicate/wrong
  layer records, wrong point layer, missing/false lock, and invalid present
  visibility values. Include saved/runtime/history disagreement.
- Preserve the hidden layer's explicit `visible: false`, absent render, exact load epoch,
  exact point data, and all camera/control/settings/event/opacity regressions.
- Verify stage/candidate observations survive a rejecting validator, remain
  observed rather than passed, and preserve the first failure through
  secondary diagnostic/cleanup failures.

Do not inflate tests by mirroring each fixture assignment. Synthetic policy
controls remain distinct from actual native browser acceptance.

Reuse the cumulative App page through all eleven shapes and eight contour
interactions, then the locked/hidden/3D occlusion setup and native dim/hide/dim
actions. Complete terminal geometric visibility and both geometric downloads,
the full layout/anchor/owner-cycle matrix, and final standalone export.
Require actual pending transparent/white downloads, reopened standalone SVG,
both TikZ modes, and retained raw persistence/history evidence.

Use strict TypeScript without `any`, register any new test file in the explicit
test list, and copy new imported dependencies in isolated runner fixtures.
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
justified by this layer-evidence mismatch. The diamond outer-separation exception
still requires independent PGF review. Preserve external source/exact text,
typography/paragraph/TeX-program limitations, free labels, and path inline nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused visibility/selection,
toolbar/drag, ownership, both parent policy suites, diagnostics and runner
regressions. Run required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused TypeScript/lint and syntax checks for changed scripts.
Report reproduced baseline lint debt separately from new errors: four
geometric caller `no-unsafe-finally` errors and the verifier's unused `_role`.
Avoid unrelated cleanup. Failed/unavailable checks cannot be reported passed.

Use a fresh owned server and supported Playwright/Chrome in the browser-capable
parent. Focused diagnostics and scoped 32C cannot establish strict 32D
acceptance. If the child hits `listen EPERM`, retain its startup failure and
hand the exact tree to the parent without weakening sandbox/acceptance rules.
Do not describe the latest parent layer-contract failure as startup failure.

Load updated helpers/contracts/policy in a fresh parent process and verify the
preserved dirty tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

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

Report the scoped canonical-layer evidence correction, faithful fixtures,
diagnostic ordering, changed files, focused/full checks, fresh parent
evidence/identity, actual visibility/download/standalone coverage, review result,
and any remaining concrete failure.
Leave commit/push to the parent workflow after verification and review pass.
Do not claim completion from child-only or historical results.
