# Phase 32B Targeted Fix Prompt: Frame responsive point fixtures before measuring native paint

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status first and preserve the namespace/
canonical-alias correction, geometrically scaling point contours, new PGF fixtures,
responsive scenarios, prior 31/32A and Inspector fixes, tests, documentation and
user changes, including untracked files. Do not reset or restart implementation.

The latest parent checked revision `d9345434d8051e045d3dfd9c3a31665af8c1d484`
plus working-tree changes. Its before/after fingerprint was:

```text
be4e5fe6e9cd755f6994d642c651add632979d7a3dc28750bf4504c0e2357262
```

This matches the inspected checkout before this prompt update, including the
untracked responsive harness and PGF namespace artifacts. Updating this prompt
and implementing the correction changes identity; obtain fresh final-tree evidence.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated responsive-fixture framing/capture failure,
focused regressions and diagnostics, and further demonstrated 32B acceptance
failures. Keep strict TypeScript. Avoid new dependencies, schema changes and
unrelated lint cleanup. Preserve the production fixes and defer 32C/32D.

## Latest execution findings

The earlier `yeWQVG` checkout passed verification before independent review found
two production defects. Those findings motivated the current namespace and
stroke-scaling corrections. The latest parent successfully launches Chrome and
passes namespace acceptance and all five earlier paint scenarios, then fails
on the first new responsive-circle pixel comparison.

This is separate from the child's localhost `EPERM`. It is also separate from
the already corrected Inspector locator/disabled-control tests. The new native
run has not yet established complete responsive paint acceptance or a fresh
independent acceptance review.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-cI6r6H
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and matching checkout snapshots;
- `point-paint-responsive-circle-scale-0.5-initial.json`, `.png` and `.svg`;
- `point-paint-responsive-circle-scale-0.5.json`, `.png` and `.svg`;
- `point-paint-responsive-circle-scale-0.5-non-scaling.json`, `.png` and `.svg`;
- responsive probe/control diagnostics, including
  `point-paint-observation-0147.json` through `0159.json`;
- completed namespace and earlier paint/download scenario artifacts.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-HQDJFV/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,815 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `pointPaintOracle.mjs:259`, called from `checkPointResponsivePaint.mjs:88` |
| Stage / scenario | `point-node-paint-import-persistence` / `point-paint-responsive-circle` |
| Completed groups / evidence records | 14 of 16 / 151 |
| Completed point scenarios | 17 of 20: all 11 cumulative 32A, all five earlier paint, plus namespace aliases |
| Browser / Node | Chrome 153.0.8010.53 / Node v26.9.0 |
| Page errors | Empty |
| Checkout before/after | Same fingerprint |
| Fresh independent acceptance review | Not reached |

The initial circle at scale 0.5 was captured, ordinary/Alt inside/outside probes
ran, and selected/non-scaling-control images were saved. The initial paint-extent
assertion then failed before the negative-control rejection was evaluated.
Do not mark this circle case or the control as passed merely because files exist.
Scale 2, later circle variants, triangle coverage and responsive downloads were
not reached. The separate `settled-SVG-export-standalone` group also remains
unexecuted; cumulative point exports and earlier paint exports did pass.

## Confirmed cause: the expected contour extends below the captured SVG root

The saved initial PNG visibly truncates the circle along its bottom edge.
Its measurements are:

| Quantity | Saved value |
| --- | --- |
| Root viewBox | `0 0 520 360` |
| Root CSS rectangle | `(20,20)`, width 260, height 180 |
| Root/contour display scale | 0.5 on both axes |
| Contour screen center | `(78,182)` |
| Center relative to PNG | `(58,162)` |
| Contour radius | About `41.50710678` local units |
| Declared geometric border | 20pt = 24 local units; half-width 12 |
| Expected PNG bottom | `162 + (41.50710678 + 12) * 0.5 = 188.75355339` |
| Actual raster bottom / PNG height | 180 / 180 |
| Actual east border thickness | 12px, matching `24 * 0.5` |

The comparison asks a 180px-high image to contain paint ending at 188.75px.
The discrepancy is clipping, not a 1.75px antialiasing tolerance issue. The saved
broken non-scaling control has east thickness 24px, while the valid contour has
12px; both images are clipped at the bottom. This supports the geometric stroke
correction at the measured east edge but does not establish all remaining
responsive geometry checks.

`pointResponsivePaintDocumentJson()` places the point at model `(0,0,0)`.
The normal App framing includes the coordinate axes, and this fixture's origin
projects to `(116,324)` in the 520-by-360 root. Only 36 local units remain below
its center, less than the approximately 53.51 required for the border.
`setPointDisplayScale()` adjusts CSS size/placement and the browser viewport;
it intentionally leaves the camera, model and root viewBox alone. It does not
establish that the test content fits inside that root.

Increasing only the browser viewport, using a full-page screenshot, or waiting
longer cannot establish the missing root-content coverage. Do not change actual
stroke width, contour/body dimensions or production clipping semantics to make
this test fixture fit.

## Required reading

Read `AGENTS.md`, `prompts/phase-32b-implement.md`,
`prompts/phase-32b-review.md`, and the latest section of
`docs/PHASE_32B_IMPLEMENTATION.md`. Trace:

- `scripts/fixtures/freeLabelsApp.tsx`, especially the responsive input document;
- `scripts/checkPointResponsivePaint.mjs`, including both `loadCase()` and the
  separate download loop that reloads the fixture;
- `scripts/pointPaintOracle.mjs`, including CSS scaling, capture and assertions;
- `tests/scripts/pointPaintOracle.test.mjs` and applicable capture tests;
- the actual App fit/pan/projection path and `scripts/standaloneSvgCapture.mjs`;
- `scripts/automation/phase-verification.mjs` and its 20-point-scenario policy.

The existing synthetic responsive observations put the node at the root center,
so they do not reproduce the origin fixture's actual placement. Line numbers
identify the inspected failure; locate current equivalents if they have shifted.

## Required correction

### 1. Establish a fully visible test scene before taking invariant baselines

Use a deliberately interior input-fixture position or the normal preview camera
pan/framing path to put the point safely inside the existing viewBox. Prefer the
smallest fixture/setup correction that works for all required shapes and cases.
Choose framing from the actual supported geometry and available viewport;
do not hard-code this run's screen coordinates or rewrite generated SVG geometry.

Keep display scale controlled through CSS at exactly 0.5 and 2, confirmed by
native CTMs. Framing must not substitute camera zoom for display scaling or
change the 20pt declaration, body source/font, shape size, dash pattern or phase.
If setup changes the view/pan, finish and settle that setup before capturing the
model/history/request baseline used for the measured interactions. Do not relax
invariants during the actual scale/probe/capture sequence.

Apply the same framed fixture/setup to the real download branch, which loads
fresh input independently. Frame the actual App before clicking Export, then
reopen the unmodified downloaded SVG at both CSS scales. Do not repair a saved
file's viewBox/point positions after download to conceal a truncated export.

Allow enough space for the complete circle and triangle miter, all variants,
selection ring, positive/negative probe locations, and the deliberately broken
non-scaling control. At scale 0.5 that control has a larger visible border than
the valid geometric version. The overlay's own 3px non-scaling stroke must also
fit. A negative control must fail because its physical width is wrong, not
because the setup clips it.

### 2. Check framing independently before pixels or clicks are judged

Add a bounded preflight that transforms an independent expected envelope from
local point coordinates into the actual root/capture/viewport coordinates.
Use the declared 20pt width, measured path geometry, known miter extension,
selection/probe padding and relevant negative-control extent. Do not use the
production painted bounds as the sole oracle for their own correctness.

Require the complete envelope and intended click positions to fit with a
positive margin inside the SVG root and browser viewport/capture area. This
also applies to disabled/zero-opacity cases, where an empty red-pixel mask
cannot prove coverage. Record root/viewBox/CSS dimensions, shape/body bounds,
CTMs, camera/framing state, expected envelope, margins and capture dimensions.
Report insufficient framing as a setup error before a misleading paint-extent
comparison. Reject nonfinite/invalid measurements rather than silently clipping
them to the image bounds.

Keep native raster bounds independent. Do not clamp the expected 188.75 to 180,
ignore the bottom edge, increase the 1.75px tolerance, shrink the fixture's shape
or stroke, remove the uncropped-output assertion, or synthesize pixels from
production geometry. Retain the actual screenshot PNG as the pixel-mask input.

### 3. Keep measurement and screenshot coordinates coherent

The current helper measures rects/CTMs and then calls `locator.screenshot()`.
Make scrolling/layout settling explicit before the retained pre-capture snapshot,
and verify relevant root/contour/body transforms and capture bounds remain
consistent through capture. Locator screenshot auto-scrolling or a layout shift
must not pair old coordinates with a new PNG. Persist before/after measurements
and fail clearly on mismatch, with bounded waiting/capture and primary-error
preservation. The latest evidence establishes clipping; it does not demonstrate
that scroll drift caused this particular failure.

Preserve exact CSS-scale observations, native pointer coordinates and saved
image dimensions. Restore temporary root styles/vector effects and release any
owned browser resources even when framing, capture or assertion fails. Keep the
existing safe XML Canvas path for standalone screenshot decoding.

### 4. Add focused framing and capture regressions

Register meaningful tests using the historical 260-by-180 capture, center
`(58,162)`, radius about 41.5071 and half-width 12. The old out-of-frame setup
must be rejected as framing failure; a correctly positioned equivalent must
retain the same width, source, geometry and physical-paint expectations.

Cover circle/triangle, scales below/above 1, selected state, transparent/disabled
variants and the larger non-scaling negative control. Include invalid/stale
transform or crop measurements so screenshot-coordinate mismatch cannot pass.
Keep existing centered oracle tests, but do not treat synthetic observations
alone as proof that the production App fixture is framed correctly.

In native acceptance, prove the preflight succeeds for the real App and actual
standalone downloads, then run the full independent raster/bounds/selection
assertions and ordinary/Alt probes. Both the valid and injected non-scaling
scenes must be uncropped; only the latter must fail the physical-paint oracle.
Keep restored geometry/style, model/history and request-identity assertions.

## Preserve implemented production corrections and coverage

Retain canonical runtime style lookup, alias ordering/cycle detection, unresolved
reference diagnostics and both TikZ modes. Keep the independent PGF namespace
fixtures (11 observations plus the expected missing-root compilation failure),
raw source/persistence and explicit local override behavior. Native namespace
acceptance now passed; no evidence here justifies redoing that implementation.

Retain geometric point contour scaling, independent paint alphas, painted/miter
bounds, the six-local-unit picking tolerance and immutable pending export capture.
Do not reintroduce `non-scaling-stroke` on production point contours or alter
unrelated overlays/curves. Preserve completed Inspector/FontFace/source/metric/
persistence fixes and all cumulative groups.

Keep the four added mandatory scenarios: `point-paint-namespace-aliases`,
`point-paint-responsive-circle`, `point-paint-responsive-triangle`, and
`point-paint-responsive-downloads`. The current policy requires 16 groups and
20 named point scenarios, including required responsive JSON/SVG/PNG artifacts.
Do not revert to the earlier 16-scenario count, skip cases or weaken fingerprint,
artifact, review or commit/push gates. Diagnose any further demonstrated failures
on their evidence instead of assuming every one is a framing problem.

## Verification and completion criteria

Run focused framing/capture/oracle regressions, the registered full suite, build,
applicable strict TypeScript/fixture checks, changed-script syntax checks,
targeted lint and `git diff --check` with the supported PATH. Preserve the
established unrelated lint/type baseline and nonblocking build warning. Do not
regenerate unchanged PGF reference artifacts merely for this framing repair.

Obtain fresh browser-capable parent verification for the final checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands to pass, both browser checks, all 16 groups and all
20 named point scenarios with actual required artifacts and empty page-error
arrays. Inspect both scales, all variants, uncropped native controls and actual
transparent/white responsive downloads. Evidence must match the final checkout,
including the untracked harness and binary PGF files.

The child's startup `EPERM`, the earlier accepted `yeWQVG` tree and the partial
current `cI6r6H` run are distinct results; none substitutes for the corrected
final tree's acceptance. After fresh verification succeeds, independently review
that same tree against `prompts/phase-32b-review.md`, including the original two
production findings. `32B verify` itself does not review. Phase 32B remains
incomplete until both gates pass; 32C/32D remain deferred.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md` and relevant preview/adapter acceptance
notes with the proven clipping cause, numeric evidence, framing/capture correction,
regressions, exact commands/results, artifact paths and final checkout identity.
Distinguish namespace/earlier paint scenarios already passed, partial responsive
progress, remaining native checks and fresh independent review. Do not call the
20pt stroke conversion defective when this failure is explained by the captured
root ending before the expected contour.
