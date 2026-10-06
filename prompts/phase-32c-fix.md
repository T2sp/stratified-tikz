# Phase 32C Fix: resolve native selection failure with known 32B issues deferred

## Current objective and continuing authorization

All eleven 32C shapes and their required options are implemented. The latest
browser-capable parent ran the existing scoped route and exposed a new native
selection failure. Continue from that implementation: diagnose and make a
bounded correction for the exact failure below, then obtain fresh complete
native evidence and matching independent review. Do not restart the shape
implementation or build a second verification profile.

The user's explicit authorization remains in force: **32B の既知問題は保留に
したままにします。** Full 32B acceptance is not a prerequisite to 32C
implementation or review. This amendment supersedes older conflicting wording
in the paired 32C prompts and plan. Do not ask again for that scope decision.
Preserve accepted 32A behavior and all non-deferred 32B contracts.

32B remains incomplete; `stz-32b-core-v1` remains unadopted. Only the named
residual issues are deferred, not new 32C failures or missing 32C evidence.
Do not resume the 32B geometry/oracle/transfer repair loop, implement 32D,
commit, push, reset, or discard the existing implementation.

## Latest evidence and preserved checkout

Read `AGENTS.md`, the paired 32C prompts, `docs/PHASE_32C_IMPLEMENTATION.md`,
`docs/PHASE_32_PLAN.md`, and the unchanged residual record
`prompts/phase-32b-fix.md`. Inspect the actual working tree before editing.

Immediately before this prompt edit, the actual checkout was on `phase/32c-shapes-geometry`,
HEAD `e80d86b90a0e5daf9802a43cfa00decd0f6b2972`, with six tracked files modified
and no nonignored untracked files. Its pre-update fingerprint is:

```text
d77c44175a923f85c2921a711b58b4c5ab2bacd5a7c24f28786d8865530ea835
```

That identity matches the current native-followup handoff and both before/after
identities of the latest parent verification. The older `c3081eb` dirty checkout
and its `bd71acbd...` fingerprint are historical, not the current starting tree.
Preserve all implementation, tests, reference fixtures, licenses and policy files,
including the six existing modifications:

- `src/ui/inspector/PointShapeFields.tsx`.
- `scripts/checkPointNodeGeometricShapes.mjs`.
- `scripts/pointGeometricShapesContract.mjs`.
- `tests/scripts/phase32cVerification.test.mjs`.
- `docs/PHASE_32C_IMPLEMENTATION.md` and `docs/PHASE_32_PLAN.md`.

These changes add native editable cylinder hexadecimal controls, trusted-input
observations and rejection controls; invalid drafts stay outside saved styles.
Preserve that correction. Its real native cylinder scenario has not yet executed.
This prompt edit changes the full-tree fingerprint; the retained evidence is not
fresh acceptance for the updated tree. Capture the next actual identity, including
untracked files, rather than hard-coding any historical hash.

- Current implementation/child handoff: `/private/tmp/stz-32c-native-followup/HANDOFF.md`.
- Matched child review: `/private/tmp/stz-32c-native-followup/INDEPENDENT_REVIEW.md`.
- Latest browser-capable parent worker: `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-GHnMkv/response.json`.
- Latest parent raw report: `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32c-review-only-eeZs2F/verification.json`.
- Latest parent disposition: `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32c-review-only-eeZs2F/32c-acceptance.json`.

Distinguish historical child startup failures from the latest real browser result:

| Evidence | Actual result |
| --- | --- |
| Current native-followup child | 4,797 tests, build, strict TypeScript, changed-file lint/syntax and diff passed. Native attempts hit localhost `EPERM`; its `dwfcgN` disposition is failed. |
| Independent PGF references | 92 fixed-box cases and 94 reference tests passed; independent regeneration matched all three fixture artifacts. PGF 3.1.11a, recorded source hash/license and TeX commands are retained. |
| Matched child review | Needs changes, Medium M1 for missing native acceptance, `ready_to_commit: false`; no unresolved confirmed code finding at that earlier review. |
| Latest parent `eeZs2F` | Tests, build, diff and the full label-assets command passed. Both strict and scoped free-labels started Chrome and failed at different assertions. This result is not `EPERM`. |

The latest strict `check:free-labels` retains the named 32B failure:
`positive-full-closed-control`, connected-live candidate `(0,-14)`,
`false !== true`, at `pointDashCapMechanismContract.mjs:175`.
It is diagnostic evidence for the existing exact classifier, not permission to
repair or waive additional 32B behavior.

The scoped `check:free-labels:32c` progressed past that deferral, completed
**15 of 17 cumulative groups**, including `point-node-paint-import-persistence`,
and saved `point-geometric-ellipse` as passed. It then failed within
`point-node-geometric-shapes`, scenario `point-geometric-diamond`.
`settled-SVG-export-standalone` did not execute. There are no recorded page
errors, but incomplete groups and missing remaining shape/actions/download
evidence still block acceptance.

Both raw `verification.json` and separate `32c-acceptance.json` are **failed**.
The acceptance gate stopped routed independent review; the earlier review M1
is still open. Do not keep describing the parent as strict-only or blocked by
localhost permissions, and do not relabel this scoped failure as deferred 32B.

## Diagnose the exact native selection failure first

The primary assertion is:

```text
Native contour click selects its point
actual: undefined
expected: 'app-point'
select: scripts/checkPointNodeGeometricShapes.mjs:87
caller: scripts/checkPointNodeGeometricShapes.mjs:184
```

Read the retained scoped artifacts under:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32c-review-only-eeZs2F/06-check-free-labels-32c/artifacts/
```

Start with `free-labels-evidence.json`, `point-geometric-ellipse.json`,
`point-geometric-failure.json`, `point-geometric-app-failure.json`,
`point-geometric-app-failure.png` and `point-geometric-app-lifecycle.json`.
Retain the corresponding `command.log` and original strict artifacts separately.

The scenario name does **not** establish a diamond solver defect. At the failing
call, the loop has loaded a fresh **circle** with body `native shape` and calls
`select()` before changing the Shape control to diamond. `boundary` defaults to
`false`, so the actual click uses `rendered.center`, despite the generic assertion
text saying contour. The failure snapshot still has `data-point-shape="circle"`.
The first ellipse scenario completed; the failure occurs while setting up the
next scenario on the reused App page. Neither a diamond boundary click nor the
eight 2D/3D contour interactions had executed.

The failure DOM retains an open inspector drawer and `No selection`. The native
action history opens/expands the drawer in the ellipse scenario and contains no
close before this failure; the screenshot shows the circle partly behind the
drawer. Overlay interception is a concrete hypothesis, but the existing evidence
does not record the actual click target or screen click coordinates. Confirm
event delivery before attributing the failure to geometry or to the drawer.

Use bounded native reproduction to compare the first successful setup with
the next failing setup. Capture observations **before** asserting selection:
scenario/setup shape, source/model and layout revision, selected tool and
selection before/after, canvas/point bounds, screen CTMs, requested click
coordinates, viewport and scroll offsets, inspector/drawer state and bounds,
`elementFromPoint`/`elementsFromPoint` at the click location, and trusted pointer
events/targets. Observe the geometry after the Select toolbar action and canvas
scrolling, as the current helper does. Keep diagnostics separate from passed
scenario records and retain the primary assertion if observation or cleanup fails.

Determine whether the native click reaches the current rendered point, an
overlay, an offscreen location, or a stale layout, and whether a completed App
update is being observed. Inspect actual screen-to-model picking only after
confirming event delivery. Drawer persistence, scrolling, layout readiness and
selection update timing are hypotheses to measure, not established causes.

Fix only the demonstrated cause in the product or harness and add a meaningful
registered regression for the failing sequence. A justified harness correction
may close an obstructing drawer through its real UI, bring the real canvas
target into view, or wait for a specific App state. Preserve native mouse input,
the expected selected point, later contour-boundary checks and original failure
evidence. Do not select through fixture state mutation, dispatch synthetic
events, retry blindly, add arbitrary sleeps, nudge coordinates to hide a failure,
inflate hit tolerance, skip diamond or waive the shape group. Do not alter shape
solvers/PGF references unless reproduction demonstrates a geometry defect.

## Use the implemented route, not another strict-only fix cycle

The needed route already exists in `scripts/automation/run-phase.mjs`,
`phase-verification.mjs`, `phase-verification-worker.mjs`, and
`phase32c-profile.mjs`. Its profile is
`32c-geometric-shapes-deferred-32b-v1`. The package command is
`check:free-labels:32c`.

**Final parent action after the targeted correction and finalized files:**

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32C review-deferred
```

This fresh process runs tests, build, diff, label-assets, raw strict free-labels,
then scoped free-labels. It validates the separate disposition and, only when
that disposition is accepted, invokes independent review with the explicit
32B deferral amendment. It exits without committing or pushing. It branches
before the ordinary clean-tree/checkout requirement, so the current uncommitted
implementation is supported; do not commit or reset merely to invoke it.

For verification without invoking review, use this alternative:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32C verify-deferred
```

Do not routinely run both sequentially: `review-deferred` already repeats all
verification. Use `verify-deferred` only when deliberately stopping before review.

The ordinary `32C fix`/`implement` path still runs strict
`runVerification("before-review")` after its child and stops at the retained
32B assertion. Repeating that path does not invoke the scoped check. If this
prompt is executed inside that ordinary child, make any demonstrated targeted
fix and provide the exact fresh-process `review-deferred` handoff above to the
browser-capable parent. Do not expect a child-side handoff, environment change,
or an edit to runner code to switch the already running parent's execution mode.
Do not rewrite the ordinary strict success/commit path to accept failures.

For focused diagnosis before the final aggregate run, the existing scoped
browser command can be used with the configured runtime:

```bash
PATH=/opt/homebrew/bin:$PATH \
STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
npm run check:free-labels:32c
```

Retain its report/artifacts. A standalone scoped run does not replace the
aggregate disposition and independent review. Use the available authorized
browser execution mechanism and normal permission escalation if localhost
startup is sandbox-blocked; do not change sandbox settings or route around an
approval denial. If native execution remains unavailable, retain the exact
failed attempt and parent command. Do not report another native pass from
static checks, nor start speculative geometry repairs in response to `EPERM`.

## Keep the finite 32C acceptance contract

Preserve the implemented shapes: diamond, ellipse, trapezium, semicircle,
regular polygon, star, isosceles triangle, kite, dart, circular sector and
cylinder, plus basic circle/rectangle and legacy polygon square/triangle.
Preserve typed parameters, ordered import aliases/false/star modes, independent
paint, raw external intent, finite supported domains, shape-specific fitting,
body offsets, rotation/incircle behavior, and separate cylinder paint regions.
The documented circular-sector preview domain is 1–179 degrees; unsupported
raw imported intent is retained with a limitation. Do not silently broaden it.

Use the existing finite manifest in `scripts/pointGeometricShapesContract.mjs`
and harness in `scripts/checkPointNodeGeometricShapes.mjs`. Required evidence is:

- All 17 cumulative groups, including all non-deferred predecessor scenarios,
  complete paint/import, final settled SVG and `point-node-geometric-shapes`.
- Eleven per-shape scenarios, each with default/configured parameters and
  empty/plain/math/mixed bodies: actual enclosure, offsets, upright glyphs,
  source/model preservation and native shape/parameter controls.
- The eight 2D/3D convex/concave/curved/asymmetric native selection/drag cases,
  undo/redo, and hidden/locked/dimmed behavior.
- Actual transparent and white downloads containing all eleven shapes, immutable
  click-time source/parameters, separate cylinder paints, and standalone reopening
  outside the App with no external assets.
- Complete scenario/artifact identities and no unhandled page or cleanup errors,
  authenticated against the final tracked/untracked checkout. Counts or screenshots
  alone cannot establish acceptance.

Do not replace native input/downloads with fixture state mutation or synthetic
events merely to satisfy a failing assertion. Inspect what any failed check
actually measures before changing either the product or the harness. Keep raw
observations and the first failure through bounded diagnostics and cleanup.

If the scoped run exposes a concrete new 32C bug, reproduce it and fix only
that behavior and its meaningful registered regression. Preserve pure shared
live/export geometry, strict TypeScript without `any`, authoritative source,
pending/error fallback, explicit saved styles, codim/work-plane conventions,
import uncertainty, and both readable TikZ modes. A shared stack/helper alone
does not prove that a new failure belongs to deferred 32B.

Keep independent PGF references at their recorded inputs and justified tolerance.
Regenerate/recompare affected references when geometry or reference generation
changes; do not recreate the entire implementation or enlarge the native matrix
without a demonstrated defect. Preserve 32D's deferred configurable layout and
anchor scope. Existing unrelated lint debt remains separate.

## Exact 32B deferrals and result semantics

The current profile names four carried items, detailed in `prompts/phase-32b-fix.md`:

1. Literal full-closed triangle proximity: 24 retained omissions, including
   `(0,-14)` at paint distance about 5.77322 and production distance 8.
2. Supported-shape transfer's 20/7/12/6 omissions for triangle/square/star/circle,
   with scale-16 paint versus scale-1 action uncertainty.
3. The separate transfer harness's owned-context standalone reopening failure.
4. Outstanding full strict 32B acceptance.

Leave that record, the separate transfer investigation and original evidence
intact. Do not repair them as a prerequisite or adopt the older conditional
32B core proposal. Do not inflate hit tolerances, add the rejected generic seam
cap, perturb dash values, weaken the exact classifier, or waive an entire group.

The strict run retains the actual full-closed failure. The scoped run records
only that exact literal mechanism as explicitly `not_run`, linked to the separate
strict diagnostic; all other required scenarios must execute and pass. The
classifier also checks the exact retained omissions and excludes independent
errors. A similar error message alone is insufficient.

A raw cumulative `verification.json` may correctly remain `failed` while the
separate `32c-acceptance.json` is `accepted`. Require
`phase32CDispositionMatchesCheckout` to authenticate both current reports and
artifacts. Neither a generic nonzero exit nor a hand-edited JSON status is
acceptable. New/moved omissions, missing shapes/options, stale identities,
unexpected failures and page/cleanup errors still block 32C. Do not relabel
historical `BTrZUZ`, child `VBqL1l`/`dwfcgN`, or latest failed `eeZs2F` evidence
as accepted. Earlier reports remain historical: `BTrZUZ` ran only the strict
checks, whereas `eeZs2F` actually ran and failed the scoped shape group.

## Verification, review and completion

After any targeted code/harness fix, run the appropriate registered regressions,
strict TypeScript, changed-file lint and script syntax checks. The final
`review-deferred` route owns the fresh complete tests/build/diff and all three
browser commands; avoid redundant preliminary full runs without a reason.
Finalize files before that route and retain exact commands, logs, versions,
observations, SVG/PNG artifacts and the before/after checkout identity.

Use the paired 32C review prompt with this continuing scope amendment. Review M1
can close only with fresh accepted scoped browser evidence and independent
inspection; the old review found no remaining code issue, not blanket approval
of any later change. The reviewer must verify the actual disposition and native
artifacts and remain read-only. New findings require a bounded targeted correction.

Update current 32C status/handoff from observed results without erasing historical
failures. Report raw strict status, scoped acceptance, independent review and the
unchanged 32B backlog separately. If accepted, say **32C accepted with the named
32B issues deferred**. If still blocked, identify the exact new failing scenario
or missing native evidence and provide a concrete parent handoff. Do not declare
32B complete, implement 32D, commit or push.
