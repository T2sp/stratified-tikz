# Phase 32 Plan: Point-node math, paint, geometric shapes, and layout

Current 32D implementation (2026-10-09): explicit spacing/minimum/anchor model,
ordered unit-aware import and controls, per-shape anchor placement, and strict
combined verification are present on the current compatible checkout.
32A and main's later 32B acceptance remain recorded below. This checkout's 32C
fresh strict native acceptance and independent review are still unaccepted;
implementation presence does not close that prerequisite or the final gate.
32D now requires `point-node-layout-anchors-combined` cumulatively with every
31F/32A–32C group. The browser-capable parent completed 14 of 18 groups, then
failed a stale imported-style Clear expectation that retained layout provenance
after detachment. Both expected clones are corrected without changing explicit
layout or production geometry. The historical child startup `EPERM` is separate
from that native assertion failure. Fresh cumulative native browser and
downloaded/reopened SVG acceptance and independent review remain pending.
Phase 32 is **not complete**. See [32D implementation and combined audit](PHASE_32D_IMPLEMENTATION.md).
The execution records that follow are historical and retain their original
stage/deferral dispositions.

Current 32B countermeasure execution (2026-10-06): the authenticated parent
reproduced the four-shape transfer, exercised native point workflows, and applied
the measured uninterrupted-dash seam correction and both-page ownership guards.
See [the current investigation](PHASE_32B_OWNED_APP_NAVIGATION.md). Matching complete
strict verification and independent read-only review passed: 4,550 tests, all
16 browser groups, native transfer and saved SVG reopening. Their outcomes and
immutable accepted tree identity are retained at
`/private/tmp/stz-32b-four-countermeasures-20261006/HANDOFF.md`.
Completed 32B was merged into main before this 32C merge and takes precedence
over the incoming branch's earlier 32B deferrals. The combined 32C checkout still
requires fresh strict browser acceptance and independent review. No core profile
is adopted; 32D remains deferred. The records below are historical.

Previous 32B residual status: [closed-dash work resumed](PHASE_32B_CLOSED_DASH_RESUME.md).
The latest `03pAet` stopped earlier at an independent
[owned-App document replacement](PHASE_32B_OWNED_APP_NAVIGATION.md), with 13/16
groups complete. Its initiating disconnect is unproven. Server isolation and
bounded lifetime/traffic diagnostics are corrected without waiving ownership.
The earlier retained `c0eiFc` strict report remains failed at the full-closed
supplemental, with 22/22 App entries passed and 14/16 groups complete. The
corrected transfer was attempted on preserved `494c7d7`; localhost `EPERM`
stopped it before Chrome, leaving all four shapes `not_run`. Native transfer,
complete matching strict verification and subsequent independent review remain
required. No core profile is adopted and 32C/32D implementation has not begun.

Status: 32A is accepted. The `gtRban` parent report completed all 15 groups,
all 11 named point scenarios and required artifacts, followed by an independent
passing review. Its tracked diff and four then-untracked file hashes match the
32A changes committed in `1d3e748` and merged into `595139d`. This supersedes the
historical contaminated-reference failure and the earlier child-only handoff.
See the prerequisite audit in [32B implementation](PHASE_32B_IMPLEMENTATION.md).

32B's accepted `wPPGzN` parent verification passed all five commands, 16 groups,
28 point scenarios and 386 required artifacts on fingerprint
`121aaf324b9b9945e785e9aaf0bdc0e07a0f68895b703007e22cda5b1dba5e42`.
The independent review subsequently found a Medium dashed square-cap bounds/
picking defect and a distinct full-suite lifecycle-test timeout (3,986/3,987
passed; the separate 11/11 rerun did not explain the failure). The targeted
correction shares effective dash settings, adds endpoint cap geometry and stale
layout guards, and separates controlled diagnostic timeout testing from real
filesystem scheduling. The native policy now requires 29 scenarios in the same
16 groups and 856 artifacts, preserving all earlier coverage, including six
responsive downloads and their 91 artifacts. Fresh matching parent verification
and independent review must accept the new tree before 32B is complete.
At that historical handoff 32C/32D remained deferred. The later explicit
[32C fix amendment](../prompts/phase-32c-fix.md) authorizes 32C now; 32D stays deferred. See the final section of the implementation report for
executed checks and the frozen-tree handoff; historical browser evidence does
not cover these new fixes.
The [native endpoint continuation](PHASE_32B_NATIVE_ENDPOINT_INVESTIGATION.md)
records the subsequent isolated-dot passes, remaining endpoint defects and
live-paint gates, retaining all prior 705 artifacts and extending both matrices.
The [connected-paint followup](PHASE_32B_LIVE_PAINT_ACCEPTANCE.md) supersedes
the square clone-based interaction premise with independently observed live
paint. Its finite core inventory remains a proposal, not a policy change;
strict verification and the bounded full-closed transfer decision remain open.

Implement the following stages in the user's requested order. Each stage must
remain usable and pass its own acceptance checks, subject to the explicit 32C
exception: carry the named [32B residual issues](../prompts/phase-32b-fix.md)
forward without another repair cycle. The raw strict 32B result remains failed.
32C uses a separate narrow acceptance disposition, with all new shapes and
non-deferred earlier behavior still required. See [32C implementation and
verification](PHASE_32C_IMPLEMENTATION.md).

32C's eleven-shape implementation is present, but native acceptance remains
pending. The 2026-10-04 child review-only attempt passed 4,780 tests/build/diff
and then hit label-assets localhost `EPERM`. A bounded correction replaces
synthetic cylinder color-parameter input with direct hexadecimal controls and
trusted-input evidence requirements. Fresh complete scoped evidence and matching
independent review are still required; the named 32B backlog and deferred 32D
scope are unchanged. See the [current 32C handoff](/private/tmp/stz-32c-native-followup/HANDOFF.md).

The subsequent browser-capable `eeZs2F` parent passed label-assets and reached
the scoped shape group, then failed native center selection of the fresh circle
while setting up diamond, after ellipse passed (15/17 groups complete). Its raw
and scoped disposition are both failed; this new failure is not deferred 32B.
The clean `e9413f5` continuation adds separate bounded selection diagnostics and
registered failure-ownership regressions. Child localhost `EPERM` prevents
event-delivery reproduction, so the overlapping drawer remains a hypothesis
and no cause correction or acceptance is claimed. The fresh browser-capable
parent must diagnose those observations and complete the existing
`32C review-deferred` route; see the
[selection follow-up handoff](/private/tmp/stz-32c-selection-followup/HANDOFF.md).

| Stage | Deliverable |
| --- | --- |
| 32A | MathJax bodies for nodes created by Add point, with matching geometry, picking, and settled SVG export |
| 32B | Independent text, fill, and border paint; faithful imported paint options |
| 32C | All eleven `shapes.geometric` shapes and their documented shape parameters |
| 32D | Complete shape-specific spacing, minimum dimensions, and anchors |

The 31F prerequisite was confirmed from the accepted `im78Xe` parent report and
independent passing review before 32A implementation; see PHASE_31_COMPLETION_AUDIT.md.
Historical evidence does not verify later Phase 32 changes.

## Scope and compatibility

- The target is `geometricKind: "point"`, created through Add point by direct or
  cursor input. Such nodes have codim 2 in 2D and codim 3 in 3D. Path inline
  nodes and free labels retain their existing behavior and regression coverage.
- Keep raw node text authoritative. Do not add math delimiters or rewrite saved
  text/TikZ. Reuse the Phase 31 supported math grammar and whole-source fallback.
- Keep compiled SVG, measurement, errors, pending requests, and caches outside
  the saved model and history. Persist explicit user-selected style values.
- Preserve model coordinates, work planes, existing coordinate references,
  visibility, locking, history, cloning, clipboard, and both TikZ output modes.
- Preserve legacy style meaning: `size / 2` is inner separation; hollow nodes
  are white-filled; square/triangle are regular polygons with four/three sides.
  Do not reinterpret them as minimum size, transparent fill, rectangle, or
  isosceles triangle. Preserve existing empty-node defaults, black node text,
  and the legacy 0.4pt border width.
- Add a distinct transparent fill state and distinct rectangle/isosceles
  triangle identities. Specify legacy normalization and the saved-format version
  policy in 32B before changing serialization. Old documents and user presets
  must load deterministically; new explicit fields must survive save/load.
- Parse both `\tikzstyle{name}=[...]` and `\tikzset{name/.style={...}}`.
  Support bounded references between known imported styles with cycle detection,
  and preserve option order, aliases, boolean defaults, and explicit false values.
  Preserve external references and unsupported options for TikZ output; report
  unsupported preview options rather than silently claiming full compatibility.
- Support documented shape keys with literal numeric/boolean/color/dimension
  values. Record the supported value grammar. Arbitrary TeX programs, `.code`,
  package execution, and user macro expansion are not supplied by MathJax.
- Full LaTeX paragraph/font compatibility and other shape libraries are outside
  these four stages. No new runtime typesetting engine or dependency is planned.

## Architecture shared by the four stages

Separate style resolution, body measurement, shape layout, and SVG painting.
The resolved layout must carry the body placement/baseline, drawn contour,
anchors, geometric bounds, painted bounds, and selection geometry. Visibility
and projection remain explicit inputs rather than changes to stored geometry.

Use one resolved node layout for the committed preview and picking. Settled
export uses the same pure layout/view functions with immutable click-time inputs.
Content bounds, shape bounds, stroke bounds, and outer-separation anchor bounds
must remain distinguishable. A large anchor separation must not become visible
padding or an accidental giant hit target.

Stages 32C and 32D are related but have different completion criteria. In 32C,
each shape must already fit the measured body using its own algorithm under
the supported/default sizing settings. Prepare independent inner/outer x/y
separation and minimum-width/height inputs in the layout interface. In 32D,
complete their imported/UI controls, interactions, and all anchor semantics.
Do not implement provisional generic polygons or post-scale every shape's
bounding rectangle and call that shape support.

## 32A: MathJax for Add point bodies

### Implementation

1. Reuse the shared parser, conversion service, font measurement, cache, and
   stale-result protection. Factor reusable state subscription if needed; do
   not create another MathJax engine for points.
2. Introduce a point-node view/controller boundary that renders the body and
   contour from the same current body layout. Use the measured width, height,
   and baseline/depth for plain text, mixed text/math, and literal fallback.
3. Initially preserve the current circle/regular-polygon/star geometry and
   paint defaults. Empty source retains existing empty-node dimensions. Pending
   and failed conversion display the entire latest source, including whitespace.
4. Share current committed point geometry with hit testing, selection outlines,
   and overlap cycling. Key runtime ownership by document and point identity;
   reject obsolete source/font/owner generations. Camera and paint-only changes
   must not recompile unchanged formulas.
5. Extend settled SVG capture to own the entire point node. Capture body source,
   style, shape, position/projection, and visibility at click time. After body
   conversion settles, rebuild both body and contour before serialization.
   Replacing only the text subtree would leave a literal-sized border around
   the settled formula and is not acceptable.

### Acceptance

- Actual Add point and inspector editing work in direct/cursor 2D/3D workflows.
- Empty/plain/Japanese/mixed text, fractions, roots, scripts, and deep formulas
  produce finite, matching body/contour/picking layouts.
- Same-node valid-invalid-valid recovery and out-of-order completion during
  edits, deletion, duplication, undo/redo, document load, and reused IDs cannot
  resurrect an old body or contour. Font readiness updates all layout consumers.
- Native boundary clicks, overlap cycling, pan/zoom/camera changes, and
  hidden/dimmed/locked layers preserve current interaction behavior.
- Actual transparent/white downloads during pending conversion reopen as
  standalone SVGs with a correctly resized contour and the captured source.
  Edits or document replacement after the click do not alter the downloaded node.
- Raw text, serialization, history, and both TikZ outputs remain unchanged for
  identical model input; existing free/inline label acceptance still passes.

Primary files: `src/rendering/SvgDiagram.tsx`, `SvgTexLabel.tsx`,
`svgPointNodeText.ts`, `svgPointNodeGeometry.ts`, `svgHitTesting.ts`,
`svgLabelExportRegistry.ts`, `labels/svgLabelRuntime.ts`,
`src/ui/svgSettledExport.ts`, and `tests/integration/nodeTextEditing.test.ts`.

## 32B: Independent text, fill, and border paint

### Implementation

1. Define explicit text color/opacity, fill enablement/color/opacity, and border
   enablement/color/opacity/width/line-style fields. Keep overall opacity separate
   where needed by the existing model and resolve imported TikZ keys in order.
   Verify PGF's general/specific opacity semantics; do not blindly multiply all
   values or assume group opacity equals separate overlapping paint opacities.
2. Specify and test normalization of old documents and user presets. Update
   validation, clone/update helpers, style clipboard, quick controls, inspector,
   default presets, and hidden/dimmed styling together. An explicit new value
   must have one authoritative representation.
3. Extend imported styles for `draw`, `fill`, `text`, `color`, `none`, their
   opacity options, line widths and presets, supported dash patterns/phase,
   caps, and joins. Implement the two style declaration syntaxes and ordered
   named-style expansion described above. Resolve common named/mixed colors
   and explicit supported `\definecolor` forms without executing TeX.
   Distinguish omitted options from explicit values and specify effective defaults
   for legacy, newly created, and imported nodes. An external style that omits
   shape/fill/spacing must not produce application defaults in preview but PGF
   defaults in TikZ; emit the necessary explicit options to preserve the chosen
   effective appearance. Carry this rule into 32C and 32D.
4. Apply independent paint to the body and contour. Preserve explicit colors
   within math content while applying the node text color to inherited paint.
   Painting changes reuse compiled formula geometry.
5. Update standalone and inline TikZ generation, named xcolor definitions, and
   external-style override generation. Keep preview and exported paint semantics
   consistent, including genuine transparent fill and border disabled states.

### Acceptance

- A single node can have red text, a translucent blue fill, and a green dashed
  border of independently chosen width and opacity.
- `fill=none`, white fill, `draw=none`, opacity zero, general/specific option
  ordering, and overlapping body/border paint have explicit regression cases.
- Legacy hollow, color, size, and shape fixtures retain their meaning through
  load/edit/save, presets, clipboard, undo/redo, and both TikZ output modes.
- Imported style references and user overrides remain stable; unsupported
  options are retained and their preview limitations are visible.
- Partial imported styles that omit shape, fill, text paint, or dimensions
  have matching resolved defaults in preview and both TikZ output modes.
- Browser and standalone SVG observations agree, including hidden/dimmed nodes.

Primary files: `src/model/types.ts`, `styles.ts`, `serialization.ts`,
`stylePresets.ts`, `importedTikzStyles.ts`, `src/ui/inspector/PointStyleEditor.tsx`,
style clipboard/quick controls, point rendering, and `src/tikz/generateTikz.ts`.

## 32C: shapes.geometric contours and parameters

Implement every row below. Rectangle and circle remain supported as distinct
base shapes; they are not members of the eleven-shape library inventory.

| Shape | Shape-specific options |
| --- | --- |
| `diamond` | `aspect` / `shape aspect` |
| `ellipse` | Elliptical body enclosure |
| `trapezium` | `trapezium left angle`, `trapezium right angle`, `trapezium angle`, `trapezium stretches`, `trapezium stretches body` |
| `semicircle` | Semicircular enclosure and body offset |
| `regular polygon` | `regular polygon sides` |
| `star` | `star points`, `star point height`, `star point ratio` |
| `isosceles triangle` | `isosceles triangle apex angle`, `isosceles triangle stretches` |
| `kite` | `kite upper vertex angle`, `kite lower vertex angle`, `kite vertex angles` |
| `dart` | `dart tip angle`, `dart tail angle` |
| `circular sector` | `circular sector angle` |
| `cylinder` | `aspect` / `shape aspect`, `cylinder uses custom fill`, `cylinder end fill`, `cylinder body fill` |

### Implementation

1. Add a typed shape specification with parameters and shape-dependent defaults.
   Preserve ordered shorthand/alias expansion, including star height-versus-ratio
   mode. Validate counts, angles, ratios, and finite dimensions. Document bounded
   preview limits; reject or visibly fall back for unsupported/degenerate input
   instead of silently drawing another shape.
2. Implement pure shape layout functions against a recorded PGF release/source.
   Preserve each shape's body enclosure and center offsets; a text center is not
   always the shape's geometric center. Include cylinder's separate fill regions.
3. Implement `shape border rotate` and `shape border uses incircle` only where
   PGF supports them, including restricted-angle rounding and fixed-incircle
   shapes. Keep border rotation distinct from rotation of the entire node/body.
4. Integrate shape selection and parameter controls, style import, persistence,
   SVG painting/picking/export, and readable TikZ options/library inclusion.
5. Use reviewable internal batches: ellipse/diamond/polygon/star; trapezium/
   triangle/kite/dart; semicircle/sector/cylinder. These are checkpoints within
   32C, not permission to mark the stage complete with missing shapes.

### Acceptance

- All eleven shapes render and export with default and nondefault parameters,
  both empty and MathJax-containing bodies, and asymmetric text dimensions.
- Independent PGF reference fixtures verify contours/body placement and rotation
  for equal input text-box metrics. Each documented option has a changing-output
  case and a validation/edge case; use pairwise interaction cases rather than
  an unbounded Cartesian product.
- Side/point counts, angle aliases, star ratio/height mode, stretch switches,
  cylinder custom fills, and border-only rotation are exercised explicitly.
- The shape's body fit uses its own algorithm; minimum-size interactions already
  intrinsic to a shape parameter are implemented here, not postponed as stubs.
- Actual selection/drag and standalone SVG export work for convex, concave,
  curved, and asymmetric representatives in 2D/3D. Old shapes remain compatible.

Primary new module area: `src/geometry/pointNodeShapes/` (proposed), integrated
through `svgPointNodeGeometry.ts`; model/import/UI/TikZ entry points are those
from 32B. Keep algorithms independent of React and browser globals.

## 32D: Precise spacing, minimum dimensions, and anchors

### Implementation

1. Complete independent `inner sep`, `inner xsep`, `inner ysep`, `outer sep`,
   `outer xsep`, `outer ysep`, `minimum size`, `minimum width`, and `minimum height`
   handling through import, model, inspector, layout, and both exports. Preserve
   ordered shorthand expansion. Support zero and define valid negative-separation
   behavior from PGF rather than imposing one generic positive-only parser.
2. Use consistent TeX units, including pt/mm/cm/in and contextual em/ex. Record
   how font context supplies em/ex, distinguish TeX pt from CSS px, and document
   approximations for browser text metrics. Do not treat one inch as 72 TeX pt.
3. Apply minima inside each shape algorithm: rectangular dimensions, ellipse
   radii, polygon/star circumcircle, triangle/trapezium stretch rules, and cylinder
   body/end adjustments. Never use a universal final bounding-box scale operation.
4. Implement standard compass/text/baseline anchors, numeric border anchors, and
   shape-specific anchors such as apex, corners/sides, star inner/outer points,
   and cylinder shape center. Build an explicit per-shape anchor support table.
   Account for border rotation and each shape's outer-separation rules.
5. Keep the stored position as the node's placement reference. Derive the body
   and contour offset from the selected anchor without rewriting coordinates.
   Preserve established coordinate-reference/drag semantics and verify the same
   placement in generated TikZ. Displayed contour and selection follow that offset.
6. If `text height` / `text depth` are accepted, represent them as layout-box
   overrides separate from actual glyph ink, and include their anchor effects.
   Paragraph wrapping (`text width`, `align`) remains a separate future feature.

### Acceptance

- Per-shape PGF comparisons cover unequal x/y separation, zero separation,
  content-dominant/minimum-dominant cases, unequal minima, and outer separation.
- Increasing a minimum on one axis follows the shape's coupling/stretch rules.
  Regular polygon/star minima are checked against the circumcircle contract,
  not the screen bounding rectangle.
- Anchor placement stays fixed as a formula becomes wider/taller, fails, recovers,
  or finishes asynchronously. Include baseline/depth and asymmetric-shape cases.
- Border-only rotation preserves the documented distinction between compass,
  text, and shape-specific anchors. Outer separation changes anchor geometry
  without painting extra padding.
- Tests use the same geometry for rendering, native boundary clicks, selection,
  and settled export after 2D/3D camera changes and pending edits.
- Complete combined coverage for all four stages and update user-facing style
  support documentation before marking Phase 32 complete.

## Reference fixtures and verification

Use the [PGF node documentation](https://tikz.dev/tikz-shapes),
[shape library documentation](https://tikz.dev/library-shapes), and
[PGF geometric-shape implementation](https://github.com/pgf-tikz/pgf/blob/master/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex).
Record the exact PGF version/commit used for fixtures, units, engine, and
generation command. Inspect license requirements before porting source.

Separate two kinds of fidelity checks. Pure geometry checks supply identical,
known body width/height/depth to PGF and the application; use fixed TeX boxes so
font differences cannot disguise an algorithm error. End-to-end browser checks
use actual MathJax/plain-text measurements to verify enclosure, baselines,
interaction, and standalone output. Do not promise identical TeX/MathJax glyph
metrics or compare geometry against a reference produced by the function under
test. Keep reproducible reference artifacts; a TeX installation need not become
a browser/runtime dependency.

Each stage requires Node tests for model/geometry/TikZ behavior, relevant native
App scenarios, and downloaded SVG reopening. Register new tests in the explicit
`package.json` list. Extend existing browser acceptance and the parent verifier
together, with explicit required scenario/group identities and fresh reports;
retain all existing Phase 31 acceptance groups.

Run with the supported Node first in PATH:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Also run focused TypeScript/lint/script checks for changed code. Retain browser
logs, scenario observations, SVG/PNG artifacts, and the verified checkout
fingerprint. Use the outer parent/Terminal environment that permits local server
and browser startup; a child sandbox failure is not a browser pass. Require
fresh accepted verification and independent review before each stage completes.

During implementation, prepare matching `prompts/phase-32a-implement.md` /
`phase-32a-review.md` through 32D in the existing prompt format, and register
their phase slugs and verification policy in `scripts/automation/`. The 32A
implementation registers all four slugs and activates its cumulative browser
requirements; future groups remain the responsibility of their own subphase.

Suggested slugs: `32A: point-node-mathjax`, `32B: point-node-paint`,
`32C: point-node-geometric-shapes`, `32D: point-node-layout-anchors`.
