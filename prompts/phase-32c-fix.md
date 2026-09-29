# Phase 32C Fix: implement geometric shapes with known 32B issues deferred

## Authorized prerequisite change

The user explicitly requested: **「32C fix を生成．特に，32B の既知問題は
保留にしたままにします．」** Proceed with 32C implementation on the existing
32A/32B code. Do not ask again whether incomplete 32B acceptance permits 32C.

This instruction supersedes the requirement that 32B be fully verified and
reviewed before 32C, in `prompts/phase-32c-implement.md`,
`prompts/phase-32c-review.md`, and `docs/PHASE_32_PLAN.md`. It also supersedes
older statements that 32C must remain deferred. Apply this amendment to both
implementation and independent review, including their verification context.
Preserve all other 32C requirements and the accepted 32A contracts.

**Implement 32C; keep the known 32B problems on hold.** Do not start another
32B geometry/oracle/transfer repair cycle, require their resolution as a 32C
prerequisite, or implement 32D. This is an explicit scope decision, not a claim
that 32B passed, nor adoption of the old conditional `stz-32b-core-v1` proposal.
New 32C defects, regressions outside the named deferrals, and missing required
32C evidence remain blockers to 32C acceptance.

## Starting state and evidence

Read `AGENTS.md`, the paired 32C prompts, `docs/PHASE_32_PLAN.md`, and
`prompts/phase-32b-fix.md`. The latter is the preserved 32B residual-issue
record, not an instruction to resume its fixes. Inspect the actual checkout;
preserve later compatible work and existing uncommitted changes.

At prompt creation, the checkout is clean on `phase/32c-shapes-geometry`, HEAD
`7ebfcd283502e6dacad5a40cec7e96c023ba7d1c`, fingerprint:

```text
4baeb656ab57b9a579044a26ea7da401cf1715561cd3a4bc2eb1d929c415c8be
```

32C is **unimplemented**. The previous attempt stopped at its obsolete
prerequisite and changed no source. This task includes the actual implementation,
not just another prerequisite audit or a documentation-only status change.

- Prerequisite handoff: `/private/tmp/stz-phase32c-prerequisite/HANDOFF.md`.
- Matching parent verification: `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32c-before-review-ZRaJil/verification.json`.
- Worker handoff: `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-PJUXgs/response.json`.

That parent ran successfully past browser startup: tests (4,451), build, diff,
and label-assets passed; free-labels failed at the known supplemental
`positive-full-closed-control`, connected-live candidate `(0,-14)`:
`false !== true`, in `pointDashCapMechanismContract.mjs`. The cumulative report
is failed, not a localhost EPERM result and not evidence that 32C was tested.
These identities describe the pre-prompt tree; adding this file or implementing
32C requires a new identity for subsequent evidence.

## Explicitly deferred 32B inventory

Retain the details and original evidence in `prompts/phase-32b-fix.md` and
`/private/tmp/stz-32b-one-pass-fYEVjj/HANDOFF.md` without rewriting failures.

| Deferred item | Existing scope and evidence limit |
| --- | --- |
| Full-closed dash proximity disagreement | Literal triangle `0,0 24,0 12,16`, width 12, square caps, bevel joins, `[100,100]`, phase 1; 24 omissions. At `(0,-14)`, connected paint distance is about 5.77322 while production distance is 8, beyond the existing six-unit tolerance. |
| Supported-shape transfer disagreements | Existing triangle/square/star/circle settings retain 20/7/12/6 omissions. Paint was captured at scale 16 and actions at scale 1; same-framing paint/action agreement remains unproven. These 45 observations are unresolved, not four passing workflows. |
| Separate transfer harness reopening | `checkPointClosedDashTransfer.mjs` creates an owned-context page and later requests a second page from that context, causing `Please use browser.newContext()`. Saved SVGs exist, but reopening did not run; cleanup/error ordering obscures the earlier retained action failure. |
| Full strict 32B acceptance | Historical 14/16 completed groups, incomplete paint/import and unexecuted final settled-SVG group do not establish full acceptance. All 22 App dash entries passed in the final bounded 32B run; the supplemental full-closed failure remains separate. |

Do not reopen these investigations, broaden their parameter grids, repair the
separate transfer script, reinstate the rejected generic seam cap, inflate hit
tolerance, perturb raw dash values, or weaken unrelated assertions as a way to
finish 32C. Preserve completed solid-join, dash-cap, paint/import, lifecycle,
normalization and local-override fixes and their regressions.

An old incomplete aggregate report is not a blanket exemption for exports,
native editing, or new shapes. Do not classify a new shape/parameter failure as
known 32B solely because it reaches a shared geometry helper or the same stack.
Bind any deferral to the named baseline case and retained observations. Record
new failures separately; fix regressions introduced by 32C within its scope.

## Implement the complete 32C scope

Use the paired implementation prompt for detailed requirements, subject to the
prerequisite and verification amendments here. Work in reviewable internal
batches, completing all eleven shapes before claiming 32C implementation done:

1. Ellipse, diamond, regular polygon, star.
2. Trapezium, isosceles triangle, kite, dart.
3. Semicircle, circular sector, cylinder.

| Shape | Required configuration/behavior |
| --- | --- |
| diamond | `aspect` / `shape aspect` |
| ellipse | Actual elliptical body enclosure |
| trapezium | Left/right angles, angle shorthand, stretches, stretches body |
| semicircle | Actual semicircular enclosure and content offset |
| regular polygon | Sides and circle/radius fitting |
| star | Points, point height, point ratio, ordered height/ratio mode |
| isosceles triangle | Apex angle and stretches |
| kite | Upper/lower vertex angles and vertex-angles shorthand |
| dart | Tip and tail angles |
| circular sector | Sector angle and content placement |
| cylinder | `aspect` / `shape aspect`, custom-fill boolean, end/body fills |

Keep basic circle and true rectangle supported. Legacy square and triangle
remain regular polygons with four and three sides, distinct from rectangle and
isosceles triangle. Preserve existing empty-node defaults and legacy size,
hollow, paint and saved-document meanings.

- Use typed shape parameters, deterministic defaults, ordered aliases and
  overrides, explicit false, finite-domain validation and bounded work limits.
  Preserve unsupported raw imported intent with a preview limitation; never
  execute TeX, silently substitute a circle, or overwrite uncertain external
  styles with invented defaults. Explicit local overrides must still work.
- Implement pure shape solvers, preferably under `src/geometry/pointNodeShapes/`.
  Carry body width/height/depth, inner/outer x/y separation, minimum width/height,
  shape parameters, body origin and baseline as distinct inputs/results.
  Return curved/compound contours, paint regions, bounds and usable hit data.
- Implement actual shape-specific fitting, asymmetric offsets, polygon/star
  radius rules, stretches and parameter-intrinsic minimum-size interactions.
  Generic stock-path bounding-box scaling does not satisfy this scope.
- Honor shape-border rotation and incircle rules, including shape-specific
  restrictions/rounding, while leaving body glyphs upright. Cylinder requires
  separate body/end fill regions with preserved independent paint semantics.
- Integrate model/validation, imported styles, presets, inspector, cloning,
  clipboard, JSON/history, both readable TikZ modes and library declarations.
  Share current layout between preview, picking/drag and immutable settled
  exports; retain separate body, shape, painted and anchor-clearance bounds.
- Preserve authoritative raw text, whole-source pending/error fallback, MathJax
  ownership and stale-result protection. Keep generated assets out of history.
  Preserve direct/cursor input, 2D/3D work planes and model coordinates; point
  `codim` remains 2 in 2D and 3 in 3D. Use strict TypeScript without `any`.

32D still owns full configurable spacing/minimum-dimension controls and complete
standard/numeric/shape-specific anchors. Prepare the independent solver inputs
now; this deferral does not excuse incorrect default fitting or shape-parameter
sizing in 32C. Avoid unrelated cleanup and explain any new dependency.

## Independent references and finite 32C acceptance

Use official PGF shape algorithms and record exact source/version, license,
TeX engine, generation commands, units and tolerance rationale. The prior
readiness probe found PGF 3.1.11a at
`/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`;
verify the current installation. `/private/tmp/stz-32c-readiness/` is preparation,
not an eleven-shape conformance suite.

Generate independent fixed-box references with known width/height/depth matching
solver inputs. Compare contours and body placement, separating font/MathJax
metrics from geometry. Expected results must not come from the solver under
test. Keep TeX an offline reference tool, not an application runtime dependency.

Register tests explicitly in `package.json`. Cover every shape's default and
nondefault parameters; empty, wide, tall and asymmetric fixed boxes; each option's
effect and validation boundary; alias/boolean/star ordering; representative
rotation/incircle/stretch interactions; round trips and both TikZ modes.
Use a finite per-shape manifest from the paired prompt, not an expanding general
dash-conformance research matrix.

Register `point-node-geometric-shapes` with actual production App scenarios:
plain/math/mixed bodies, trusted selection and drag across convex/concave/curved/
asymmetric contours, 2D/3D and hidden/locked/dimmed behavior. Require actual
transparent/white downloads with all eleven shapes and separate cylinder paints,
standalone reopening and immutable click-time source/shape parameters. Use an
explicitly owned browser context for new multi-page checks. Do not inherit the
deferred transfer harness's context-lifetime defect.

## Verification amendment: separate 32C acceptance from deferred 32B results

The current fail-fast free-labels command stops inside 32B paint/import before
the final settled-SVG group. Merely appending 32C checks, accepting 14/16 groups,
or running the unchanged strict gate until it passes will not satisfy this task.

Implement the smallest explicit **32C-only** verification disposition needed to
honor this user decision. Keep the default strict 32B policy unchanged. Inspect
`scripts/checkFreeLabels.mjs`, `scripts/automation/phase-verification.mjs`, its
worker, `scripts/automation/run-phase.mjs`, and their tests together:

1. Ensure all non-deferred earlier scenarios, final settled-SVG export, and the
   complete new 32C manifest actually execute. Isolate the named deferred checks
   in a separate diagnostic run or narrowly record their structured failure and
   continue. Never catch an entire paint/import group and call it complete.
   Preserve independent failures and asynchronous/page errors.
2. Retain raw command results and scenario outcomes (`failed`, `not_run`, etc.).
   Record a separate phase-specific acceptance disposition with the explicit
   user-authorized deferrals, current checkout identity and evidence paths.
   Do not change an old failed report into a pass or drop its assertions/artifacts.
   The separate 32B transfer investigation may remain deferred and need not be
   rerun or repaired to start/accept 32C.
3. Let that disposition reach independent **32C** review when all its required
   checks pass, even if the strict cumulative diagnostic still reports the named
   32B limitation. Keep runner, worker, evidence validator and review context in
   agreement; a prompt-only waiver that the runner cannot honor is insufficient.
   Scope acceptance to 32C and the exact deferrals, never a generic nonzero-exit
   allowance, whole-group waiver or silent global policy reduction.
4. Retain all twelve Phase 31F groups, accepted 32A behavior and non-deferred
   32B contracts. Missing/unexecuted final SVG or 32C cases, new regressions,
   malformed/stale evidence, unexpected errors and missing artifacts still fail
   32C acceptance. Counts alone cannot establish coverage. Old partial browser
   results cannot substitute for fresh runs on the implementation being reviewed.
5. Add focused policy/runner negative tests for unrelated failures disguised as
   known 32B, missing shapes/parameters, incomplete exit-zero reports, identity
   mismatch, and incorrect phase/profile use. Preserve fresh-process loading of
   updated policy and failure-before-commit behavior. Carry the scope amendment
   into paired 32C instructions/plan and review handoff when implementing it, so
   a fresh reviewer does not reimpose the superseded 32B prerequisite.

Prefer a bounded, separate review-only route where that avoids changing the
existing strict success/commit path. Never feed a failed cumulative report into
that path as if it passed; this invocation does not authorize commit or push.

Use Node >=22.12.0; this host requires the Homebrew PATH. Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Also execute the documented 32C-specific acceptance command/disposition above,
focused strict TypeScript, changed-code lint and script syntax checks. Report
demonstrated baseline lint debt separately. Keep exact command lines, versions,
logs and all results; a raw strict failure remains visible alongside the scoped
32C result. Do not require an unrelated lint cleanup or further 32B repair.

Run browser checks with the available authorized execution mechanism. If a child
hits localhost `EPERM`, retain the attempt and exact parent commands; use normal
permission handling without changing sandbox settings. The browser-capable parent
must supply fresh matching 32C and non-deferred acceptance evidence. An unavailable
browser or required PGF reference is an evidence gap, never a pass. It does not
prevent implementing the authorized source changes first.

## Review and handoff

Update 32C support/status in `docs/PREVIEW_UI.md`, `docs/SPEC.md`,
`docs/ROADMAP.md` and `docs/PHASE_32_PLAN.md`. Link the unchanged 32B residual
record, clearly distinguishing deferred defects from new 32C problems. Do not
mark 32B complete or claim the earlier conditional profile was adopted.

Finalize files before verification and retain a binary-aware tracked/untracked
checkout identity. Obtain independent review using the paired 32C review prompt
**with this prerequisite/acceptance amendment**. Known deferred 32B issues alone
do not constitute a new 32C Medium finding; a new 32C defect or missing required
32C/non-deferred evidence does. Keep any changed-tree verification gap explicit.

Report implemented shapes/options, reference results, tests/build/static checks,
native coverage and downloads, raw strict verification status, scoped 32C
acceptance/review status, and the carried 32B backlog separately. If successful,
say **32C accepted with the named 32B issues deferred**, not that all Phase 32
or strict 32B verification passed. If evidence is still missing, give an exact
bounded handoff without restarting the 32B repair loop. Do not implement 32D,
commit or push as part of this fix invocation.
