# Phase 32B Targeted Fix Prompt: Correct imported-style namespaces and responsive point stroke geometry

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status first and preserve all current
implementation, prior 32A fixes, Inspector locator/disabled-control corrections,
selection-oracle corrections, fixtures, tests, documentation and user changes.
Do not reset or restart implementation.

The accepted parent verification and subsequent review cover revision
`a3f5998bd5b74e8622ca5e599390f2c32f65e070` plus working-tree changes. The parent
before/after fingerprint is:

```text
17c0b7af52dc566d3f6a3abb8c6de927c755301d57644cf0481705e2f51a434b
```

This matches the inspected checkout before this prompt update. Updating this
prompt and implementing fixes changes checkout identity; obtain fresh evidence
for the final corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Scope includes the two demonstrated production defects below and their focused
regressions, independent references and documentation. Preserve strict TypeScript
and avoid new dependencies, additional schema changes or unrelated lint cleanup.
Keep 32C geometric shapes and 32D configurable spacing/minimum dimensions/anchors
deferred. Fixing existing border geometry consistency belongs to 32B.

## Current acceptance and review findings

Verification passed, and the independent acceptance review ran. This request is
not another browser-startup or Inspector-harness repair. The review found zero
Critical issues and two Medium production defects; `ready_to_commit` is false.
Do not repeat older claims that the current reviewed tree lacks browser evidence
or that independent review was not reached.

Read the attached review:

```text
/Users/takamatoshinori/.codex/attachments/d7fc032f-fd02-429c-b22e-d4cff741a8b3/pasted-text.txt
```

Accepted parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-yeWQVG
```

Inspect `verification.json`, the command logs, and
`05-check-free-labels/artifacts/free-labels-evidence.json`, including actual point
paint/download/reopen artifacts and the matching checkout snapshots.

| Observation | Latest actual result |
| --- | --- |
| Parent required commands | All five passed, including both browser commands |
| Browser evidence | Passed; 16/16 groups, 16/16 named point scenarios, 160 evidence records |
| Browser page errors / incomplete groups | Empty |
| Browser / Node | Chrome 153.0.8010.53 / Node v26.9.0 |
| Independent review tests / build | 2,769 passed, no failures/skips; build passed |
| Independent review | Needs changes: two Medium production defects |
| Checkout before/after | Same fingerprint, matching reviewed tree |

The review's additional exploratory browser launch was sandbox-blocked, but the
matching parent evidence satisfies the browser gate for this reviewed checkout.
Existing helper/native checks did not cover the namespace and responsive-stroke
contracts sufficiently; passing them does not invalidate these findings.

Retain the documented baseline: 25 existing `no-regex-spaces` lint errors and
85 broader changed-test TypeScript diagnostics were reproduced against pre-32B
`595139d`. Production/fixture/new-paint strict checks and changed-JavaScript lint
passed. Do not expand the repair into unrelated debt cleanup.

## Defect 1: declaration directory is mistaken for runtime lookup directory

Read `src/model/importedTikzPaint.ts`, `src/model/importedTikzStyles.ts`,
`tests/model/pointPaintImport.test.ts`, `src/tikz/generateTikz.ts`, and
`docs/IMPORTED_POINT_PAINT.md`.

The current resolver searches the declaring style's directory first and changes
that owner on nested expansion. For:

```tex
\tikzset{base/.style={text=red},ns/.cd,base/.style={text=blue},outer/.style={base}}
```

applying `ns/outer` from a normal node invocation resolves `base` to `/tikz/base`
in PGF and renders red. The app instead finds `ns/base`, silently stores blue,
and emits an explicit blue text override after the external style.

The style body does not automatically enter the directory of its declaration.
PGF `.style` expands its body through `pgfkeysalso` using the invocation's active
key directory; an explicit `.cd` is a separate operation.

Retained independent evidence is in `/private/tmp/stz-paint-review/`:

- `repro.txt` / `repro.mjs`: app import and incorrect generated TikZ;
- `namespace.tex`, `namespace.pdf`, `namespace-compilation.txt`,
  `namespace.log`, `namespace-pdf-operators.txt`: PGF 3.1.11a renders red;
- `namespace-only.tex`, `namespace-only-compilation.txt`, `namespace-only.log`:
  removing the root `base` produces unknown `/tikz/base`, while the app still
  incorrectly resolves the namespaced blue definition without diagnostics.

Canonical aliases are also inconsistent. Bare `base` and `/tikz/base` denote
the same key in the normal TikZ directory, but current parsing/deduplication and
lookup treat them independently. Normalizing only the final resolver Map is
insufficient because raw-key deduplication may already have lost declaration
order. For example, `base(red), /tikz/base(blue), base(green)` must not end in blue
because an earlier alias retained a later Map position.

### Required namespace correction and independent regressions

1. Separate declaration location from invocation directory. Resolve supported
   relative references in the active runtime directory, preserving that context
   through nested style bodies. Explicit qualified/absolute references must
   retain PGF meaning; do not substitute the declaration owner's directory.
2. Use consistent canonical key identity for lookup, ordered duplicate handling,
   and cycle detection. Bare `base` and `/tikz/base` must agree in the normal
   TikZ context, including last-definition-wins ordering in both declaration
   directions and repeated alias overwrites. Keep `/other/base` and relative
   `tikz/base` distinct from `/tikz/base`; do not strip arbitrary path prefixes.
3. Preserve raw source/options, external style key spelling/load hints, readable
   TikZ, saved explicit values and reference identity compatibility. Internal
   canonicalization must not silently rewrite user source. Preserve application
   defaults, option order and explicit local override precedence.
4. For missing/unsupported references, retain diagnostics and unresolved-field
   tracking. Do not fabricate a nearby namespaced definition or emit its paint
   as a known override. Keep the existing behavior that preserves unresolved
   external properties unless later known options or actual local edits resolve
   them. Verify this through both standalone and inline TikZ output.
5. Keep literal parsing and depth/work/source/diagnostic limits. If literal
   runtime `.cd` is supported, independently verify its propagation through
   nested expansion and following options. Otherwise diagnose it explicitly as
   unsupported/unresolved; do not approximate it as declaration-directory lookup.
   Do not broaden into executing arbitrary imported TeX, macros or handlers.

Add registered tests and retained independent PGF fixtures for root-vs-namespace
shadowing, a missing root reference despite an existing namespaced key, explicit
qualified nested references, relative/absolute aliases in both directions,
repeated alias overwrite and distinct absolute directories. Cover alias-aware
cycles and depth/work termination in bounded resolver tests; compiling recursive
PGF styles is not required for these preview limits.
Use actual compiled PGF results, not expected values generated by the resolver.
The expected unknown-key compilation failure is valid negative evidence and
must be identified as such, with its diagnostic retained.

The existing `known nested references ... namespaced lookup` regression at
`tests/model/pointPaintImport.test.ts:73` encodes the incorrect owner-relative
rule. Correct its expectations/fixtures to PGF semantics rather than preserving
it as the specification. Likewise replace the incorrect enclosing-directory-first
rule documented in `docs/IMPORTED_POINT_PAINT.md`. Retain the existing independent
ten-row opacity/color-order fixture; extend reference coverage for namespaces
and aliases without erasing those checks.

Exercise real imported-preset application, local edits, JSON save/reload and both
TikZ modes. The shadowing example must produce red effective paint and no
invented blue export override. The missing-reference example must be visibly
unresolved, with raw external key/source preserved.

## Defect 2: non-scaling border paint disagrees with local bounds and picking

Read `src/rendering/svgPointPaint.ts`, `svgPointNodeLayout.ts`,
`svgPointNodeView.ts`, `SvgPointNode.tsx`, `svgHitTesting.ts`, the point export
capture path, `tests/rendering/svgPointPaint.test.ts`, and
`scripts/checkPointNodePaint.mjs` / `scripts/pointPaintOracle.mjs`.

`pointStyleToSvgPaint()` applies `vector-effect="non-scaling-stroke"` to the
contour. Shared layout, painted bounds, miter geometry, selection and picking
instead use local width `declared TeX points * 1.2`. A responsive root SVG/viewBox
transform makes these contracts disagree even though computed `stroke-width`
still reports the same nominal value.

Read `/private/tmp/stz-32b-review-stroke-scale-repro.json`. It records execution
of production pure helpers plus stroke geometry derived from vector-effect
semantics; it is not a new native browser run. With a 20pt border:

| Display scale | Modeled local half-width | Non-scaling painted local half-width |
| --- | --- | --- |
| 0.5 | 12 | 24 |
| 2.9076923076923076 | 12 | About 4.127 |

At 0.5, `radius + 20` lies in visible stroke but beyond the current modeled hit
limit `radius + 18`. At about 2.908, `radius + 17` is selected even though it is
beyond the actual painted edge plus the existing 6-local-unit tolerance. The
higher scale is observed in the accepted parent's
`point-paint-lifecycle-dimming.json` coordinate diagnostics. Resizing standalone
SVG also changes stroke thickness relative to the node body.

### Required stroke correction and native regressions

Prefer ordinary geometric SVG scaling for point contours, consistent with the
existing local layout contract. Keep `width * 1.2`, dash lengths/phase, miter
geometry and current local picking/selection padding coherent. Preview and
detached settled export already share `SvgPointNodeView`; apply the same rule
in both. Avoid introducing viewport-dependent layout/cache/export machinery
when removing the point contour's non-scaling behavior resolves the mismatch.

The editor selection ring's own non-scaling outline is a separate overlay and
may remain so. Do not globally remove vector effects from unrelated curves,
markers, handles or formula paths. Preserve body/font sizing, camera projection,
model coordinates, source-keyed conversion reuse, legacy 0.4pt width and size/2
meaning, disabled/zero-opacity distinctions and immutable pending capture.

Update tests that currently require the defective contour vector effect.
Demonstrate the coherent paint/bounds/picking contract, not just removal of an
attribute. Keep shape/body/painted bounds distinct and preserve polygon miter
extension and the existing picking tolerance. The review's two click examples
diagnose the old mixed contract; after choosing geometric strokes, derive probe
expectations from the corrected physical paint and documented tolerance rather
than preserving the old non-scaling appearance.

Extend required native acceptance with:

- A wide 20pt solid circular border at measured uniform display scales below
  and above 1, such as 0.5 and 2. Its full local width is independently 24 and
  half-width 12; displayed thickness must follow the actual CTM. Camera zoom
  alone is not a substitute for responsive SVG display scaling.
- Native painted extent, local painted bounds and selection alignment checks.
  Probe inside visible border and beyond the border plus current selection
  tolerance using both ordinary and Alt-click/candidate selection paths. An
  ordinary contour click alone can use its group handler and bypass geometric
  candidate collection. Clear selection before negative probes.
- A supported triangle's wide miter join at both scales, retaining the existing
  independent 60-degree-corner geometry, plus disabled-border/zero-opacity
  distinctions and dash/phase scaling coverage.
- Actual transparent and white SVG downloads reopened outside the App at scales
  below and above 1. Border/body proportions, dash lengths/phase, contour extent
  and uncropped output must agree with the chosen geometry contract. Preserve
  pending-edit/load capture isolation and removal of editor overlays.

Collect the actual root/contour `getScreenCTM`, viewport and CSS dimensions,
viewBox, device pixel ratio, local/screen probe coordinates, declared width,
rendered paint observations and selection outcomes before assertions can abort.
Retain required SVG/JSON/PNG artifacts and bounded capture/error handling.

Use independent native raster/paint measurements retaining the actual display
transform. `getBBox()` without stroke, computed `strokeWidth`, and the current
`rasterPointOverlap()` reconstruction at scale 1 cannot establish responsive
stroke correctness by themselves. Keep the opacity oracle's existing purpose;
add the missing transform-sensitive check. Include a deliberate non-scaling
contour negative control that the new test rejects at nonunit scales. Do not
recompute expected painted extent from the same production layout under test.

## Preserve earlier work and integrate coverage

Keep the accepted Inspector caption resolver, exact disabled-rejection oracle,
local-DOM-vs-Playwright diagnostics, NaN/recovery checks, selection half-width
oracle and owned-FontFace cleanup. These historical harness failures now pass
native acceptance and are not the current repair targets.

Preserve 31/32A behavior, separate text/fill/stroke alpha, migration/validation,
clipboard/bulk/history, import ordering outside the corrected semantics, TikZ
local override rules, raw source preservation and pending export snapshots.
Register new tests and integrate the new native cases into the mandatory browser
workflow. If adding named scenarios/artifacts, extend the verifier policy and
its fail-closed tests; do not weaken or replace the existing 16 groups/16 point
scenarios. Preserve binary-aware evidence identity for retained PGF artifacts.

## Verification and completion criteria

Run focused regressions, the registered full suite, build, applicable strict
TypeScript/fixture checks, changed-script syntax checks, targeted lint and
`git diff --check` with the supported PATH. Record independent PGF compilation
commands/version and expected-failure diagnostics. Preserve baseline lint/type
debt separately and retain the existing nonblocking build warning accurately.

Obtain fresh browser-capable parent verification for the corrected checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands to pass, including both browser checks, all existing
16 groups/16 named point scenarios and the newly required namespace/scale
regressions. Inspect terminal success, page-error arrays, actual required
artifacts and matching final checkout identity, including untracked/binary files.
The accepted `yeWQVG` evidence is a valid baseline but does not validate later
production changes.

After fresh verification succeeds, independently review that same checkout
against `prompts/phase-32b-review.md`, explicitly checking both production findings.
`32B verify` itself does not run review. Phase 32B is complete only after the two
findings are resolved and both gates pass. If a child cannot start its browser,
report that separately and use the established browser-capable parent path;
do not recast the accepted baseline as missing verification.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md`, `docs/IMPORTED_POINT_PAINT.md` and
relevant preview/adapter notes with corrected namespace and stroke contracts.
State that the prior checkout passed verification and was then rejected by
independent review for two production defects. Report each cause/fix, changed
files, independent PGF/native regression evidence, exact commands/results,
final checkout fingerprint and fresh review outcome. List genuinely unexecuted
checks without carrying forward superseded harness failures. Keep 32C/32D
explicitly deferred.
