# Phase 32D Fix for Inspector interception of native point selection

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and the completed Clear
provenance fix. Repair the geometric-shape acceptance workflow's reused-page
selection preparation, then obtain fresh cumulative verification and matching
independent review. The retained native evidence shows the open Inspector
intercepting the second selection click before it reaches the SVG.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing and preserve
all existing implementation, regressions, PGF references, and documentation.
Do not restart Phase 32D or repeat the resolved Clear repair.

Keep strict cumulative 32D verification and the parent workflow's
verification-before-review/commit contract. Historical 32C-only deferrals cannot
establish a 32D pass. Phase 32 remains incomplete until the current tree has
accepted complete evidence and passing independent review.

## Latest evidence and checkout identity

The completed provenance-fix handoff is
`/private/tmp/stz-32d-provenance-fix-20261009/HANDOFF.md`.
Its six-file inventory, complete diff, logs, and final identity are retained in
the same directory. The latest browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-mQPFwa/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-zYGQzv/verification.json`.
- Primary browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-zYGQzv/05-check-free-labels/command.log`.
- Native observations and failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-zYGQzv/05-check-free-labels/artifacts/`.

At this prompt update, the branch is `phase/32d-margin-minsize-anchor`, HEAD
`caf7d4ef9a259fad6017bc187269d6ee8bd9068b`. The pre-update tree matches both
before/after identities of the latest parent report:

```text
52d9fd09cd7bf6d3bb0bc8a6edcbb186503cc2325d6b6f89af78e55e9a42cdf1
```

There are six modified tracked files and no nonignored untracked files before
this prompt update. Preserve those six changes: the imported-paint observer,
independent parent validator, policy and UI Clear regression suites, and
`docs/PHASE_32D_IMPLEMENTATION.md` / `docs/PHASE_32_PLAN.md`.
Earlier 32D implementation and reference fixtures are already tracked.
Updating this prompt changes the tree identity again. Capture the actual
current tracked/untracked identity; do not hard-code an old fingerprint as an
acceptance constant.

| Retained run | Actual result |
| --- | --- |
| Provenance-fix child | 122 policy and 9 UI focused tests passed; 5,373/5,373 full tests passed without failures/skips. Build, diff, strict TypeScript, TS lint, and script syntax passed. Script lint retains the reproduced baseline unused `_role` error. Both browser commands stopped before Chrome launch at `listen EPERM`. |
| Latest browser-capable parent | 5,373/5,373 tests, build, diff, and full `check:label-assets` passed. Chrome 154.0.8037.98 ran native scenarios. `check:free-labels` passed the complete paint/import group, then failed during geometric-shape selection. |

The parent completed 15 of 18 cumulative groups. `point-geometric-ellipse`
passed; `point-geometric-diamond` failed during its initial selection setup.
The geometric group remains incomplete. The layout/anchor group and final
standalone-export group did not execute. The retained page-error list is empty,
but missing scenarios, downloads, and review still block acceptance.
This real parent failure is distinct from the child's startup `EPERM`.

## Preserve the completed Clear correction

The prior stale expectations are fixed in
`scripts/checkPointImportedPaint.mjs` and
`scripts/automation/phase-verification.mjs`. The parent now records
`point-paint-clear-imported-style` as passed and completes
`point-node-paint-import-persistence`.

Keep exact comparisons and rejection controls for detached imported
paint/shape/layout provenance, explicit layout and per-axis units/contexts,
unselected controls, raw source, one effective history commit, no-op repetition,
undo/redo, history capacity, and JSON reload. Preserve the nine UI regressions
and the new synthetic policy fixtures. Synthetic records remain policy tests,
not native evidence. Do not strip layout fields from persistence comparisons
or restore orphaned provenance in production.

## Diagnose the native selection failure

The current primary assertion is:

```text
AssertionError [ERR_ASSERTION]: Native contour click selects its point
actual: undefined
expected: 'app-point'

selectGeometricPoint
  scripts/pointGeometricSelection.mjs:141
select
  scripts/checkPointNodeGeometricShapes.mjs:84
runPointNodeGeometricShapeChecks
  scripts/checkPointNodeGeometricShapes.mjs:183
```

Read `free-labels-evidence.json`, `point-geometric-failure.json`,
`point-geometric-app-failure.json`, `point-geometric-app-lifecycle.json`,
`point-geometric-app-failure.png`, and all six
`point-geometric-selection-0001.json` through `0006.json` artifacts.
The final checkpoint is
`point-node-geometric-shapes / point-geometric-diamond-observed`.

The selection observations establish this comparison:

| Native selection | Observation |
| --- | --- |
| Ellipse setup, sequence 1, records 0001–0003 | Inspector closed. Center click `(1296.4, 268.975)` reaches the SVG circle owned by `app-point`; trusted pointerdown/up/click are recorded and selection succeeds. |
| Diamond setup, sequence 2, records 0004–0006 | Inspector open with `No selection`. The same center is covered by the drawer. `elementFromPoint` and all trusted pointerdown/up/click targets are `div.empty-inspector`; selection stays `null`. |

The open drawer has screen bounds `x=1227, y=130.375, width=430, height=1170`,
`pointer-events:auto`, and `z-index:40`. The PNG confirms that it covers the
point center. Before/after snapshots have viewport `1700×1300`, `scrollY=129`,
and unchanged point screen CTM scale `3.1` / translation
`(1296.4, 268.975)`. The layout is `ready`; owner, body request, point request,
and document revision `10` agree and remain unchanged.

Both setup selections operate on the loaded `circle` with text `native shape`.
The diamond Shape control is applied only after selection succeeds.
Therefore this retained failure is not evidence of a diamond solver defect.
The lifecycle retains the original App page/API without a new navigation,
crash, or page error. The evidence confirms drawer interception; confirm the
bounded harness correction below through focused native reproduction.

## Correct selection preparation through native UI

Inspect `scripts/pointGeometricSelection.mjs` and its callers in
`scripts/checkPointNodeGeometricShapes.mjs` and
`scripts/checkPointLayoutAnchors.mjs`.

The geometric wrapper opens/expands the Inspector after selection but does not
close it before the next document's selection. The shared helper currently
clicks Select, scrolls the canvas into view, measures, and clicks without
resolving a previously open drawer. Its observer was deliberately diagnostic
when the interception cause was unconfirmed. The layout/anchor caller already
uses the real `Close inspector drawer` button before selection.

Implement one small, clearly owned native preparation sequence:

1. Retain an observation of the inherited obstructing drawer state.
2. If the drawer is open, operate the unique real
   `Close inspector drawer` button once and verify the drawer is closed/detached
   through a bounded DOM condition. A closed drawer requires no close action.
3. Finish the Select/scroll preparation and then obtain fresh body/contour
   measurements and screen CTMs. Recompute the requested center or boundary
   from that current geometry after all UI actions that can affect layout.
4. Check and record the current click target and hit stack before one native
   canvas click. Preserve the expected `app-point` selection assertion and
   trusted event observations. The measured boundary input must stay a boundary
   input in the later interaction scenarios.
5. After selection succeeds, keep the wrapper's native Inspector reopening and
   expansion so actual Shape and parameter controls still exercise production
   handlers.

Place this preparation in the shared helper or a small caller-level path after
checking both callers. Avoid conflicting duplicate close actions. Verify that
native drawer operations leave authoritative model coordinates, raw text,
style, diagram JSON, and history unchanged; UI drawer state is not diagram data.

Preserve observations before assertions, bounded diagnostics, observer cleanup,
owned events, and primary-error precedence. Record actual event targets and
composed paths in addition to event type/trust. For initial unselected circle
setup, require delivery to the intended SVG point rather than accepting an
already-selected point plus an intercepted click. Later tests may legitimately
use existing point drag handles; verify their intended production path rather
than indiscriminately rejecting every target without a point-id attribute.

Do not repair this by changing overlay pointer-events/z-index/event propagation,
forcing clicks through the drawer, relocating the model point, nudging the
viewport until a stale coordinate works, selecting through fixture API state,
dispatching synthetic events, retrying blindly, or adding arbitrary sleeps.
Keep the actual native contour/owner assertion. Existing overlay interception
is intentional UI behavior; the demonstrated issue is test preparation.

If a fresh unobstructed click still fails, retain that new before/after trace
and diagnose its concrete production selection path before changing geometry,
hit tolerance, or renderer logic. Do not assume every later failure has the
same cause.

## Regressions and full native coverage

Extend the existing registered selection controls in
`tests/scripts/phase32cVerification.test.mjs`; there is no need to invent a
separate unregistered selection test file. Cover reused-page success followed
by a JSON load that leaves an expanded/no-selection Inspector, one real close
action, a verified closed state, fresh measurement after closing/scrolling,
and one native click. Include the already-closed no-op path, failed close or
detach confirmation, remaining non-drawer obstruction, and primary native/
assertion errors surviving observation/evidence/cleanup failures.

Use controls that reject stale pre-close coordinates and false success from
preexisting selection or trusted events delivered only to an overlay. Update
controlled event records to include intended target/path information. Keep
these tests explicitly synthetic; they cannot establish browser acceptance.

The real native reproduction must reuse the same App page through ellipse
success, open Inspector, later JSON loads, and diamond setup. Do not replace
the cumulative loop with fresh pages that erase the inherited drawer state.
Then retain every supported shape's default/configured body cases, native
parameter and cylinder color controls, 2D/3D contour-boundary interactions,
owner cycling, visibility/lifecycle cases, and actual pending downloads and
standalone reopening. Keep the complete layout/anchor matrix required as well.

Preserve strict TypeScript without `any`, register any new test file in the
explicit `npm test` list, and add no dependency for this correction.

## Preserve the Phase 32D geometry and persistence contract

Keep saved envelope version 2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution, and per-axis em/ex context. Preserve the
PGF solvers, anchors, body/baseline/depth inputs, unsupported-anchor diagnostics,
overflow-body picking, distinct painted/anchor-clearance bounds, 2D/3D
projection, and immutable click-time export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
its raw inputs/artifacts, and established tolerances. No reference regeneration
or geometry change is justified by this intercepted setup click. The documented
diamond outer-separation exception still requires independent PGF review.
Preserve both TikZ modes, external source and exact saved text, existing
typography/paragraph/TeX-program limitations, free labels, and path inline nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused selection/preparation and
ownership regressions first, then all required commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Run focused TypeScript/lint for changed TypeScript and syntax checks for changed
JavaScript. Report the reproduced baseline script `_role` lint debt separately
from new errors; avoid unrelated cleanup. Required checks that fail or cannot
execute remain failed/unavailable.

Run browsers in the browser-capable parent with a fresh owned server and
supported Playwright/Chrome configuration. Focused diagnostics cannot establish
cumulative acceptance. `check:point-native-focused` does not cover this complete
geometric-shape workflow; the 32C scoped profile cannot close 32D.
If the child hits `listen EPERM`, retain that startup failure and hand the exact
tree to the parent without weakening sandbox or acceptance rules. Do not use
the old startup restriction to describe the latest native failure.

The parent must load updated policy in a fresh verifier process. The manual
route checks the preserved dirty tree without committing:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
```

Preserve the ordinary implementation/fix runner's clean-tree guard. Do not
reset, discard, stash, commit, or push unfinished work to bypass it. Require all
twelve 31F groups, three 32A groups, the full 32B paint/import group, 32C shapes,
and `point-node-layout-anchors-combined`. Require named terminal successes,
valid artifacts, no page errors, native history/JSON persistence, both TikZ
modes, actual pending transparent/white downloads, and reopened standalone SVG.
Keep raw failures through bounded diagnostics and resource cleanup.

If a subsequent assertion fails, retain its first evidence and diagnose that
specific defect. Do not skip predecessors, reuse historical/scoped reports,
create a deferred 32D profile, or reclassify an unexpected failure as the older
32B backlog.

## Independent review and completion

After complete fresh strict parent verification, obtain read-only independent
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md`. Inspect the actual report/artifacts.
A sandboxed reviewer can use genuinely matching accepted parent browser evidence;
stale, partial, or failed evidence cannot substitute for it.

Update implementation/plan/roadmap status only to observed accepted results.
Keep Phase 32 incomplete while any required native/download/reference or review
gate remains open. Preserve stop-before-review/commit on failed verification
and the parent's checkout identity guard after review.

Report the bounded preparation fix, changed files, focused/full checks, fresh
parent evidence and identity, native target/delivery and download coverage,
review result, and any remaining concrete failure. Leave commit/push to the
existing parent workflow after verification and review pass. Do not claim
completion from child-only or historical results.
