# Phase 32C Fix: finish native acceptance with known 32B issues deferred

## Current objective and continuing authorization

All eleven 32C shapes and their required options are implemented. Continue from
that implementation: obtain fresh native evidence through the existing 32C
review-only route, fix concrete new 32C defects if that run exposes any, and
obtain matching independent review. Do not restart the shape implementation or
build a second verification profile merely because the strict parent run failed.

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

At this prompt update, the implementation is on `phase/32c-shapes-geometry`,
HEAD `c3081ebea181bffeba791c701f45dd05711521a2`, with existing tracked changes
and 24 nonignored untracked files. Its pre-update fingerprint is:

```text
bd71acbdee90f4b13992e3127276e5e71628fec73b4345c9f1832cee21fff2d0
```

That identity matches the implementation handoff, independent review, and both
before/after identities of the latest parent verification. Preserve all code,
tests, reference fixtures, licenses, and policy files. This prompt edit changes
the full-tree fingerprint; historical evidence is not fresh acceptance for the
updated tree. Capture and verify the next actual identity, including untracked
files, rather than hard-coding the old hash.

- Implementation handoff: `/private/tmp/stz-32c-fix-verification/HANDOFF.md`.
- Independent review: `/private/tmp/stz-32c-independent-review.md`.
- Latest parent report: `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32c-before-review-BTrZUZ/verification.json`.
- Parent worker handoff: `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-rfjdHZ/response.json`.
- Earlier child disposition: `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32c-review-only-VBqL1l/32c-acceptance.json`.

Distinguish the two execution environments:

| Evidence | Actual result |
| --- | --- |
| Final implementation/child checks | 4,780 tests, build, strict TypeScript, changed-file lint/syntax and diff passed. All three native commands hit localhost `EPERM`; the child disposition is failed. |
| Independent PGF references | 92 fixed-box cases and 94 reference tests passed; independent regeneration matched all three fixture artifacts. PGF 3.1.11a, recorded source hash/license and TeX commands are retained. |
| Independent review | No unresolved confirmed code finding; Medium M1 remains for missing native acceptance. This is not a passing review. |
| Latest parent `BTrZUZ` | 4,780 tests, build, diff and the full label-assets command passed. Chrome started and strict free-labels reached the known 32B full-closed assertion. This parent result is not `EPERM`. |

The parent completed **14 of the now-required 17 groups**, with no page errors.
All **22/22 App dash entries** passed; **20/21 supplemental mechanisms** passed.
The only failed mechanism is `positive-full-closed-control`, connected-live
candidate `(0,-14)`, `false !== true`. The existing exact named-failure
classifier accepts these retained observations when replayed read-only.
That classification is not scoped verification or fresh browser acceptance.

The paint/import group is incomplete; `settled-SVG-export-standalone` and
`point-node-geometric-shapes` did not execute. `BTrZUZ` contains only the five
strict checks, not `check:free-labels:32c` or an accepted `32c-acceptance.json`.
It therefore does not close review M1 or establish a new 32C geometry defect.

## Use the implemented route, not another strict-only fix cycle

The needed route already exists in `scripts/automation/run-phase.mjs`,
`phase-verification.mjs`, `phase-verification-worker.mjs`, and
`phase32c-profile.mjs`. Its profile is
`32c-geometric-shapes-deferred-32b-v1`. The package command is
`check:free-labels:32c`.

**Recommended next parent action, from the preserved working tree:**

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
historical `BTrZUZ` or child `VBqL1l` evidence as accepted.

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
