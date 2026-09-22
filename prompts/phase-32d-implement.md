# Phase 32D Implementation Prompt: Precise point-node spacing, minima, and anchors

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0. Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Browser execution/evidence ownership is specified below. Run focused TypeScript,
ESLint, and script syntax checks for changed code. Run repository-wide lint only
if the repository is already lint-clean; report demonstrated baseline debt
separately. Do not turn this subphase into unrelated cleanup. Never report an
unavailable or skipped check as passed.

## Project context

You are working on StratifiedTikZ. Read `AGENTS.md`, the current
`docs/PHASE_32_PLAN.md`, and `prompts/phase-32d-review.md`.
Inspect the actual checkout and preserve later compatible changes; file names
below identify starting points, not an exhaustive change list.

| Subphase | Responsibility |
| --- | --- |
| 32A | MathJax bodies for Add point, synchronized contours/picking, and whole-node settled export |
| 32B | Independent text/fill/border paint and faithful imported style resolution |
| 32C | All eleven shapes.geometric shapes, their parameters, and shape-specific body fitting |
| 32D | Complete shape-specific spacing, minimum dimensions, anchors, and combined acceptance |

Implement or review only the named subphase. Preserve completed earlier
contracts; do not require deferred later features prematurely. In particular,
32C requires correct shape-specific default body fitting and parameter-intrinsic
sizing, while 32D completes configurable layout and anchor conformance.

## Phase 32 shared contract

- Target nodes created by Add point through direct/cursor input:
  `geometricKind: "point"`, codim 2 in 2D and codim 3 in 3D.
  Keep ambient dimension and codimension distinct.
- Preserve free-label and path inline-node behavior. Coordinate names, axes,
  handles, saved-path identifiers, and undisplayed metadata are not new TeX labels.
- Reuse the Phase 31 bounded parser, MathJax service, validated SVG, metrics,
  cache, and lifecycle. Ordinary Unicode may mix with `$...$`, `\(...\)`, `$$...$$`, and `\[...\]`.
  MathJax does not execute TikZ, arbitrary preambles/packages, or style-file macros.
- Keep source text authoritative. Never automatically add delimiters, trim or
  normalize saved text, or persist generated SVG, measurements, requests, or
  caches in Diagram/history.
- Pending, invalid, unsupported, resource-failed, or bounded-work-failed bodies
  display the entire latest source literally, including delimiters, backslashes,
  repeated/edge spaces, tabs, and physical newlines. Do not show partial typesetting,
  a previous successful formula, unsafe HTML, or an error image.
- Use one current layout revision for body, contour, picking, and selection.
  Export uses the same pure layout/view functions with immutable click-time
  inputs. Keep body, shape, painted, and anchor-clearance bounds distinct.
- Preserve 2D/3D projection, pan/zoom, work planes, authoritative coordinates,
  references, visibility, locking, overlap cycling, drag, history, and clipboard.
- Preserve legacy meanings: size/2 is inner separation, hollow is white-filled,
  square/triangle are regular polygons with four/three sides, text is black,
  and border width is 0.4pt. New transparency, rectangle, and isosceles triangle
  must be represented distinctly. Preserve existing empty-node defaults.
- 32A needs no saved-schema change. From 32B, persist explicit style values
  with documented version/normalization rules and deterministic old-document
  and user-preset loading. Preserve raw text and avoid lossy migrations.
- Keep human-readable TikZ, named xcolor definitions for custom paint, existing
  standalone/inline output conventions, and external style reference semantics.
- Use strict TypeScript without `any`; separate model, geometry, rendering,
  UI, and TikZ generation. Explain any new dependency before adding it.
- Full LaTeX paragraph/font compatibility, other shape libraries, and arbitrary
  TeX/PGF code execution are outside this series.

## Prerequisites and scope

32A-32C must be implemented, verified, and independently reviewed. Read their
paired prompts and current evidence; preserve all completed behavior. This stage
completes configurable layout and anchor fidelity for every supported point shape
and performs the combined Phase 32 completion audit.

The scope includes common spacing/minimum options, unit semantics, and each
shape's supported standard/numeric/specific anchors. Paragraph wrapping and
arbitrary LaTeX font/TeX-program support remain outside scope.

## Goal

Make node placement and dimensions follow PGF's per-shape rules across import,
editing, preview, picking, both TikZ modes, and settled standalone SVG output.
The chosen anchor stays at the model coordinate while body dimensions change.

## Inspect first

- All 32A-32C runtime, paint, shape solvers, inspector, and migration changes;
- `src/model/importedTikzStyles.ts`, dimension/option parsing and saved styles;
- point layout/view, `src/rendering/svgHitTesting.ts`, drag/coordinate references;
- `src/ui/svgSettledExport.ts`, `src/tikz/generateTikz.ts`;
- 32C PGF reference fixtures and per-shape support matrix;
- native App/point acceptance, parent verification policy, and documentation.

Confirm exact baseline/depth and text-center inputs available from the shared
body layout. Do not infer all anchors from width/height or the screen rectangle.

## Common options with shape-specific semantics

1. Complete ordered resolution and controls for `inner sep`, `inner xsep`, `inner ysep`,
   `outer sep`, `outer xsep`, `outer ysep`, `minimum size`,
   `minimum width`, `minimum height`, and `anchor`.
   Shorthand sets both axes at its position in the option stream; later explicit
   values override the relevant axis. Preserve omitted-versus-explicit semantics.
2. Support zero and PGF-valid negative separation with finite behavior. Distinguish
   scalar angles/counts from dimensions. Support pt/mm/cm/in and contextual em/ex,
   record font context and unit conversion, and distinguish TeX pt from CSS px.
   Do not retain the positive-only parser or 72-TeX-pt-per-inch approximation.
3. Apply each minimum inside the relevant solver: rectangle dimensions, ellipse
   radii, polygon/star circumcircle, triangle/trapezium coupled or stretched
   dimensions, and cylinder body/end adjustment. Preserve aspect/angle/radius
   mode exactly as PGF specifies. A universal final bounding-box scale is invalid.
4. Apply outer separation to anchor clearance, including shape-specific corner/
   miter/axis rules. Keep painted contour, stroke bounds, and hit region separate;
   changing outer sep must not draw a bigger node or inflate selection arbitrarily.
5. Complete the explicit model/inspector/preset/clipboard/save/load/TikZ path for
   these settings. Preserve legacy size/2 compatibility with unambiguous precedence;
   do not leave old and new fields independently controlling the same layout.

## Anchors and placement

- Create a documented per-shape anchor support table from the recorded PGF
  implementation: standard compass, text/base/mid where supported, numeric border
  angles, and all documented shape-specific anchors (corners/sides, apex, star
  inner/outer points, cylinder shape center, sector/arc anchors).
- Do not fabricate unsupported anchors as the center. Resolve supported names
  and indices deterministically; retain unsupported source with visible diagnostics.
- Preserve text baseline/depth and distinguish body origin, placement reference,
  geometric center, and shape center. The selected anchor equals the stored point
  coordinate; derive all other offsets without rewriting the model position.
- Border-only rotation must follow the distinction between compass/text anchors
  and rotating shape-specific anchors, including incircle/restricted modes.
- Dragging, coordinate input/references, highlights, overlap cycling, and 2D/3D
  projection must use the same placement contract as emitted TikZ. Do not change
  existing reference semantics to compensate for a preview offset.
- If supporting `text height` / `text depth`, keep their layout-box
  overrides distinct from actual ink and test their anchor effects. Otherwise
  explicitly diagnose them as unsupported; do not silently apply fake metrics.
  `text width` / `align` paragraph wrapping remains deferred.

## Shared live and exported geometry

Use the same pure layout/anchor resolver for live rendering and settled export.
Formula success/failure, font readiness, and async completion may change body
dimensions but cannot move the chosen placement anchor. Capture all dimensions,
anchor and shape parameters, font context, and projection in the click-time
snapshot; later edits must not affect the downloaded node.

Keep shape, paint, anchor-clearance, and content bounds independently testable.
Painting-only, anchor-only, or view-only changes reuse existing typesetting where
its source/font identity is unchanged. Preserve bounded whole-source fallback.

## Required acceptance and tests

| Area | Required cases |
| --- | --- |
| Per-shape sizing | Unequal x/y padding; zero; valid negative separation; content/minimum-dominant regimes; unequal minima; outer sep |
| Shape interactions | Aspect/angles; coupled/stretch behavior; polygon/star circumdiameter; star height/ratio; cylinder ends/body |
| Units/order | Equivalent physical units, contextual em/ex, shorthand/axis ordering, omitted defaults, legacy size migration |
| Anchors | Every documented supported name/index category, numeric border directions, base/mid/depth, asymmetric centers |
| Rotation | Border-only versus node transform; restricted/incircle modes; compass/text versus shape-specific anchors |
| Async placement | Wide/tall source edits, pending-success, valid-invalid-valid, font readiness, stale completion during load/undo |
| Interaction | Actual 2D/3D boundary clicks, anchor-based dragging, references, Alt cycling, pan/zoom/camera, locking/visibility |
| Export | Actual pending transparent/white downloads, post-click style/source/load changes, standalone reopen and captured anchor |
| Persistence | Legacy/new diagrams and presets, clipboard, undo/redo, and actual standalone/inline TikZ |

Extend independent PGF fixed-box references from 32C for spacing/minimum/anchor
coordinates, using identical width/height/depth and normalized units. Keep actual
MathJax/font checks separate. Include controls that detect incorrect circle
diameter, independently stretched triangles, wrong body offset, ignored outer sep,
and a stale pending-sized exported contour.

Register `point-node-layout-anchors-combined` and its matrix in cumulative
parent policy. Require all Phase 31F and 32A-32C groups as well. Combined fixtures
must include points, free labels, and path inline nodes; failure of one must not
alter unrelated labels, styles, history, or export.

## Final Phase 32 audit

Map every 32A-32D acceptance requirement to a production path, registered test,
native scenario/reference artifact, and actual result. Document grammar, shape/
anchor coverage, defaults, compatibility, unsupported values, and typography
limits in the user docs. Keep PGF version/fixture regeneration instructions.

Mark Phase 32 complete only after the full current checkout passes required
Node/build/diff, native browser/standalone SVG, independent reference checks, and
independent review. Historical or partial evidence cannot close the final gate.

## Browser verification and evidence

Use real production components and native App events, actual MathJax conversions,
and downloaded SVGs reopened outside the App. Controlled delayed adapters are
appropriate for races, but cannot replace real conversion and native evidence.
Screenshots alone do not prove source identity, bounds, paint, or history.

Register new Node tests in the explicit `package.json` test list. Extend
`scripts/checkFreeLabels.mjs` and its fixtures with the required groups
specified for this subphase, and extend `scripts/automation/phase-verification.mjs` together.
Retain all twelve Phase 31F groups and all completed earlier Phase 32 groups.
Validate completed scenario identities, terminal success, no unhandled page
errors, and artifacts, not only an exit code, a group count, or started groups.

The browser-capable parent runner performs fresh verification after implementation
and before independent review. If the child cannot start a local server/browser,
retain the failure and an exact handoff; the parent must still execute those
checks. Do not broaden sandbox settings or waive checks to get a pass.
An independent reviewer may inspect accepted parent browser evidence instead of
repeating browser commands when its fingerprint matches the exact reviewed
checkout, including relevant untracked files/fixtures. Check the actual report
and artifacts, not the implementation summary. A child's startup restriction
does not invalidate genuinely matching complete parent evidence, and does not
itself establish a pass.

Preserve the fresh-process verifier loading introduced in 31F. Add runner/policy
regressions for cumulative Phase 32 requirements, exit-zero incomplete evidence,
checkout mismatch, and failure before review/commit. Never accept an old Phase 31
report as evidence for new point-node scenarios. When implementation changes
verification policy, the running parent must use the updated policy.

Retain commands, Node/browser versions, logs, scenario observations, SVG/PNG
artifacts, and verified checkout identity. Save observations before bounded
screenshots; own asynchronous event/action rejections and preserve primary
failures through cleanup. Required browser or PGF-reference evidence that is
missing remains an explicit acceptance gap, not a successful check.

## Documentation and completion

Update `docs/PREVIEW_UI.md`, `docs/SPEC.md`, `docs/ROADMAP.md`, and relevant
adapter/style documentation to describe observed support and limitations.
Keep the plan's stage status accurate. Earlier-stage completion must not claim
later-stage features, and child-only checks must not claim final acceptance.

Report files changed; model/migration decisions where applicable; focused and
full test results; native scenario/artifact coverage; standalone and inline TikZ
behavior; standalone SVG results; unsupported inputs; and remaining gates.
Complete this subphase only after fresh accepted verification and independent
review. Do not implement the next subphase as part of this invocation.
