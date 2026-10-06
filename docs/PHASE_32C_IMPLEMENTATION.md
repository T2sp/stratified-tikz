# Phase 32C geometric point nodes

Merge status (2026-10-06): main's completed 32B takes precedence over the earlier
32B deferrals recorded by this branch. The matching strict verification and
independent review are linked from the [Phase 32 plan](PHASE_32_PLAN.md).
The branch execution records below retain their original failed results; they
do not describe the current 32B status. Fresh strict browser acceptance and
independent review of the combined 32C checkout remain required.

All eleven shape implementation paths are present: ellipse, diamond, regular
polygon, star, trapezium, isosceles triangle, kite, dart, semicircle, circular
sector and cylinder. Basic circle and rectangle are distinct. Legacy square
and triangle retain their four/three-sided regular polygon identities and
their exact accepted default contour order. Acceptance requires fresh matching
verification and independent review; implementation presence alone is not a pass.

The fresh 2026-10-04 child `review-deferred` attempt on HEAD `e80d86b`
completed 4,780 tests, build and diff, then failed at label-assets localhost
startup (`listen EPERM`). Its fingerprint was
`7b1f5bc74fee7a4150822a1b7a9ed55316f92b6ede16f909ad781b6615eac8ed`;
[the failed report](/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32c-review-only-kGjRec/verification.json)
is retained separately from the historical browser-capable parent result.
Independent preflight identified synthetic cylinder color-control events as
a 32C evidence gap. The targeted correction adds editable hexadecimal fields
beside the two cylinder swatches and requires actual trusted input observations,
changed default values, and matching control/model values in the native manifest.
Invalid color drafts do not change saved styles. Geometry and PGF inputs are
unchanged. Native acceptance and final independent review remain pending;
see the [current external handoff](/private/tmp/stz-32c-native-followup/HANDOFF.md)
for final checkout identity, executed checks and exact parent continuation.

The later browser-capable parent `eeZs2F` actually started Chrome: label-assets
passed, raw strict free-labels retained the named 32B full-closed failure, and
scoped free-labels completed 15/17 groups and the ellipse scenario. It failed
selecting the fresh **circle** with body `native shape` during diamond setup,
before changing the Shape control. This is a new 32C blocker, not a deferred
32B case. The open drawer overlaps the circle in the failure image, but retained
artifacts do not establish the click target or event delivery.

The 2026-10-05 continuation began on clean successor HEAD `e9413f5`, which
already contains the six earlier modifications. Child native startup again
fails with localhost `EPERM`, so no cause correction is claimed. The existing
shape loop now saves bounded, separate selection diagnostics before and after
the single native click: current model/source, owner/request/document revision,
tool/selection, bounds/CTMs, viewport/scroll, inspector state, screen hit stack,
and trusted event targets. Registered controlled regressions preserve the
selection assertion through diagnostic/cleanup failures and preserve boundary
coordinates. These are diagnostic tests, not native acceptance. No geometry,
PGF references, shape matrix or verification profile changed. See the
[selection follow-up handoff](/private/tmp/stz-32c-selection-followup/HANDOFF.md)
for frozen identity, current results and the required fresh parent continuation.

## Scope decision

The user's [32C fix amendment](../prompts/phase-32c-fix.md) supersedes the older
full-32B prerequisite for implementation **and review**. The unchanged
[32B residual record](../prompts/phase-32b-fix.md) and its linked original
evidence retain the full-closed triangle proximity disagreement, 45 supported
transfer omissions, transfer-context reopening error and incomplete strict
32B acceptance from before 32B completion. These were deferred during this
branch's implementation; main's later completed 32B now takes precedence.
No 32B repair cycle, generic seam cap,
tolerance increase, raw dash perturbation or `stz-32b-core-v1` adoption is part
of 32C. New shapes/parameters and independent failures are not blanket-exempt.
32D's full configurable spacing, minima and anchors remain outside this work.

## Model and implementation

`PointStyle.shapeParameters` stores explicit typed optional values; omitted
values resolve to the recorded PGF defaults. Point shape parameters and imported
override provenance are copied for presets, clipboard, history and immutable
export captures. No measured boxes or generated MathJax SVG are saved.
Point codimension remains 2 in 2D and 3 in 3D, with authoritative model positions
and unchanged direct/cursor work-plane input.

The inspector exposes each shape's parameters, border rotation and applicable
incircle switch. Imported options retain their order: `aspect`/`shape aspect`,
trapezium angle shorthand, kite vertex-angle pair, explicit false and the latest
star height/ratio mode. Unsupported raw external options remain in their style
source, with preview diagnostics; explicit local overrides remain authoritative.
Both TikZ modes emit readable shape keys and `shapes.geometric` when required.
Custom fills use named xcolor definitions.

The pure solvers in `src/geometry/pointNodeShapes/` take independent body
width/height/depth, x/y inner/outer separations, minimum width/height and current
line width. Shapes fit that fixed upright body with PGF's shape-specific rules;
they are not scaled stock paths. Output includes closed/open curved contours,
cylinder body/end paint regions, body origin/baseline, and distinct shape/body/
anchor-clearance bounds. Rendering derives painted bounds from stroke geometry.
Native picking shares the current solver result; a parameter edit invalidates
the old committed layout. Border-only rotation leaves glyphs upright.

Cylinder custom fills follow PGF's operation order: body and end are painted
before the ordinary background fill and border. Set ordinary fill to `none`
to see the custom colors without an overlaid ordinary fill. Custom paints still
operate when ordinary fill is disabled and retain the independent fill opacity.

Preview count limits are 3–64 sides/points. Aspect is .01–100, star ratio 1–100,
height 0–10000 TeX pt; vertex angles are 1–179 degrees, sector angles 1–179
(PGF specifies angles below 180 for body fitting),
and border rotation is bounded to ±360000 degrees. Dart tail must exceed tip.
These are finite preview domains, not a claim to execute arbitrary PGF math.
Curved hit sampling targets .005 local-unit sagitta with at most 2048 samples
per half arc. If work limits, zero-area fitting or unsupported inputs prevent
a safe contour, the body stays selectable and a visible `!` with a descriptive
title marks the unavailable shape preview. No substitute circle is drawn, and
the original style/source remains available for JSON and TikZ export.
The solver prepares independent layout inputs for 32D without adding its UI.

## Independent PGF references

The installed official geometric source is PGF **3.1.11a**, dated 2025-08-29:
`/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`.
SHA-256: `bbd6abe9df51153e2f4f61cca3ad669de34a6648cf37795df44da931402b69ee`.
The [release](https://github.com/pgf-tikz/pgf/releases/tag/3.1.11a),
[official source](https://github.com/pgf-tikz/pgf/blob/3.1.11a/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex)
and [shape manual](https://tikz.dev/library-shapes) establish provenance.

Till Tantau and Mark Wibrow's 2018 PGF shape algorithms are offered under
LPPL/GPL. The independently named TypeScript adaptation selects LPPL 1.3c;
the [complete license](licenses/LPPL-1.3c.txt) is retained. The adaptation is
maintained as part of StratifiedTikZ and is not the original PGF distribution.
Its changed implementation uses JavaScript arithmetic, SVG arcs and bounded
contour samples; upstream source and exact revision are available at the link
above. Other application code is unaffected by this source attribution.

Reproduce the finite oracle without any application solver dependency:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/generatePointShapeReferences.mjs
```

The generator invokes `/Library/TeX/texbin/pdflatex -no-shell-escape
-interaction=nonstopmode -halt-on-error fixed-box.tex` in a fresh temporary
directory and retains the engine output there. The engine is pdfTeX
3.141592653-2.6-1.40.29 (TeX Live 2026). Committed artifacts under
`tests/fixtures/point-node-shapes/` contain the exact TeX, raw PGF soft paths and
JSON records with source hashes. No TeX is used by the application runtime.

The 92-case inventory specifies actual width/height/depth, including empty,
wide, tall and asymmetric boxes for every shape. Additional cases cover each
parameter family, stretching/minima, custom fills, incircle and positive/negative
border rotation. Raw PGF soft-path tokens, including cylinder fill operations
and open seam, are the independent expected geometry. Text anchors verify body
placement independently of font/MathJax metrics. All numbers are TeX pt; y is
flipped for SVG. Preview applies 1.2 SVG units per TeX pt separately; PDF's
72bp/in is never confused with 72.27 TeX pt/in.

The contour comparison tolerance is .025pt, allowing PGF fixed-point arithmetic,
cubic circle approximation and the bounded sampling error. It is .03 preview
units, separate from the existing six-unit selection tolerance. Wrong-radius
and wrong-offset controls must fail. Reference generation is evidence of PGF
availability; passing comparisons, native App actions and downloads are separate
requirements, never inferred from the generator's success.

## Verification and handoff

Use Node >=22.12.0, with Homebrew first in PATH. Keep all command logs and the
binary-aware tracked/untracked fingerprint outside the checkout. The final
external handoff records executed results on the frozen tree; required browser
checks blocked by child localhost permissions remain pending for the parent.

```sh
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels:32c
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32C verify-deferred
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32C review-deferred
```

The default strict commands and commit path keep their policy. The explicit
32C profile is `32c-geometric-shapes-deferred-32b-v1`; it retains a separate
acceptance disposition and raw strict results. It excludes only the named
literal full-closed supplemental mechanism from its acceptance run, recording
`not_run`; the strict diagnostic must still be retained. All remaining 31F,
32A and 32B scenarios, final settled SVG and the complete finite geometric
manifest must execute successfully. The separate failed 32B transfer harness
is neither rerun nor repaired here. Exit-zero incomplete evidence, stale
identities, unexpected errors, missing shape/parameter cases and artifacts fail.
The explicit deferred review route does not commit or push.

Native acceptance exercises production App bodies, selection/drag, 2D/3D,
visibility/locking, and actual transparent/white downloads with all eleven
shapes. New multi-page checks own their browser context explicitly. Immutable
click-time inputs, standalone reopening and cylinder paints must be observed;
helper tests cannot substitute for those artifacts. Successful completion is
reported as **32C accepted with the named 32B issues deferred**, never as full
Phase 32 or strict 32B acceptance.
