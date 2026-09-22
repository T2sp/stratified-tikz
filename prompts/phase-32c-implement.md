# Phase 32C Implementation Prompt: Geometric point-node shapes and parameters

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
`docs/PHASE_32_PLAN.md`, and `prompts/phase-32c-review.md`.
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

32A and 32B must be implemented, verified, and reviewed. Preserve shared runtime,
whole-node export, independent paint, ordered import resolution, and migration
contracts. Read their paired prompts and actual interfaces.

This stage implements every shapes.geometric shape and its documented parameters.
Correct default body fitting and sizing intrinsic to those parameters are required
now. General custom inner/outer spacing, complete minimum-dimension controls,
and the full standard/numeric/shape-specific anchor API are completed in 32D.

## Goal

Offer all eleven geometric shapes with faithful contours, body placement, parameters,
and paint in the real editor, while retaining basic circle/rectangle and old
regular-polygon square/triangle identities.

## Inspect first

- 32A point view/capture/picking and 32B model/import/UI/serialization/TikZ changes;
- `src/rendering/svgPointNodeGeometry.ts`, `svgHitTesting.ts`;
- `src/model/types.ts`, `validation.ts`, `stylePresets.ts`, `importedTikzStyles.ts`;
- `src/ui/inspector/PointStyleEditor.tsx`, `src/tikz/generateTikz.ts`;
- geometry tests, native point fixtures, exported SVG tests, and parent policy;
- official PGF sources and manual, recording the exact release/commit used.

A proposed pure-module location is `src/geometry/pointNodeShapes/`.
Keep geometry independent of React/browser globals. Expand the geometry contract
beyond circle-or-polygon to support curved/compound contours and multiple paints.

## Required shape inventory

| Shape | Shape-specific configuration |
| --- | --- |
| diamond | aspect / shape aspect |
| ellipse | Elliptical enclosure |
| trapezium | trapezium left angle; trapezium right angle; trapezium angle; trapezium stretches; trapezium stretches body |
| semicircle | Semicircular enclosure and content offset |
| regular polygon | regular polygon sides |
| star | star points; star point height; star point ratio |
| isosceles triangle | isosceles triangle apex angle; isosceles triangle stretches |
| kite | kite upper vertex angle; kite lower vertex angle; kite vertex angles |
| dart | dart tip angle; dart tail angle |
| circular sector | circular sector angle |
| cylinder | aspect / shape aspect; cylinder uses custom fill; cylinder end fill; cylinder body fill |

Basic circle and true rectangle are additional supported shapes. Old square and
triangle keep their regular polygon meanings. Do not implement placeholders or
silently substitute the nearest available shape.

## Shape model, layout, and controls

1. Use typed shape-specific parameters and deterministic defaults. Parse aliases,
   shorthand pairs, booleans including explicit false, ordered overrides, and
   star point-height versus ratio mode. Validate finite values and legal domains;
   document bounded count/work limits and explicit handling of degeneracy.
2. Give each pure solver body width/height/depth, inner/outer x/y separation,
   minimum width/height, and shape parameters as distinct inputs. Preserve body
   origin/baseline and geometric-center differences. Return contours/paint regions,
   relevant bounds, and boundary/hit data, with room for 32D anchor resolution.
3. Implement actual PGF body-enclosure algorithms under the currently supported
   sizing settings. Regular polygons and stars use their circle/radius rules;
   non-symmetric shapes require body offsets; cylinder needs body/end fill regions.
   Do not just stretch a stock path to a generic body bounding rectangle.
4. Honor shape-specific stretches and star height/ratio behavior, including their
   interaction with minimum dimensions at solver level. Prepare those independent
   inputs now even if full UI/imported layout controls are deferred to 32D.
5. Implement `shape border rotate` and `shape border uses incircle`
   where supported, fixed-incircle behavior where applicable, and restricted
   rotation rounding. Border-only rotation must not rotate formula glyphs.
   Do not use SVG rotation blindly when PGF's fitting rule also changes.
6. Add real shape/parameter inspector controls, ordered imported-style handling,
   saved preset/diagram round trips, readable TikZ options, and required library
   inclusion. Preserve partial imported style defaults from 32B.
7. Integrate shared live/export layout and actual point picking/drag, including
   concave and compound contours. Keep anchor-clearance space separate from paint
   and selection. Preserve finite behavior for unsupported/invalid inputs and
   show an explicit limitation while retaining raw export intent.

Implement in reviewable internal batches: ellipse/diamond/polygon/star;
trapezium/triangle/kite/dart; semicircle/sector/cylinder. The stage completes only
after all eleven shapes and their listed parameters meet acceptance.

## Independent PGF reference fixtures

Use the official node/shape manuals and
`pgflibraryshapes.geometric.code.tex`. Record the PGF version/commit,
TeX engine, fixture source, unit normalization, generation commands, and any
source-porting license requirements.

Generate reference contours/body placement using fixed boxes with known width,
height, and depth, identical to the solver inputs. Separate this from actual
MathJax/font measurement checks; font differences must not conceal a geometry
error. Keep reproducible reference artifacts and numeric tolerances justified
by PGF output precision. Expected geometry must not come from the solver under
test. TeX is a fixture-generation tool, not a browser runtime dependency.
If required reference generation cannot run, retain the gap rather than inventing
expected results or claiming reference conformance.

## Required acceptance and tests

- Every shape: default/nondefault parameters, empty body, wide/tall/asymmetric
  fixed boxes, and actual MathJax/plain/mixed text. Verify body enclosure/offset.
- Every listed option: a case showing its effect plus validation/edge coverage.
  Include alias precedence, boolean false, and star mode ordering.
- Include polygon sides, star points/height/ratio, triangle/trapezium stretch
  modes, kite angle shorthand, dart angles, sector angle, and cylinder custom fills.
- Border-only rotation and incircle/restricted modes preserve glyph orientation
  and fit. Match independent PGF contours/body positions for representative angles.
- JSON/presets, clone/clipboard, undo/redo, partial imported styles, both TikZ
  modes, and library declarations preserve the selected shape and parameters.
- Actual browser selection/drag and 2D/3D view changes cover convex, concave,
  curved, and asymmetric cases, including locked/hidden/dimmed nodes.
- Actual transparent/white SVG downloads reopen with all eleven shapes represented,
  readable formulas, separate cylinder surfaces, and immutable click-time parameters.
- Register `point-node-geometric-shapes` and its per-shape scenario manifest
  with cumulative parent policy. Keep Phase 31F and 32A/32B groups required.

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
