# Phase 32A Implementation Prompt: MathJax bodies for Add point nodes

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
`docs/PHASE_32_PLAN.md`, and `prompts/phase-32a-review.md`.
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

Read the Phase 31 completion audit and current reports. At plan creation 31F
still recorded an open fresh-verification/review gate. Verify its current status
and close any still-open prerequisite before starting 32A; do not assume the old
status is permanent or infer completion from successful browser stdout alone.

This stage typesets point-node bodies using the established Phase 31 grammar.
It includes matching contour sizing/picking and settled whole-node SVG export.
Paint-model changes, imported-style expansion, new shapes, and general anchor/
minimum-dimension controls remain for 32B-32D.

## Goal

A point node's visible body, surrounding shape, selection bounds, and exported
SVG must all describe the same source revision and body measurement, including
pending/fallback states. Preserve raw model text and existing TikZ output.

## Inspect first

- `src/rendering/SvgDiagram.tsx`, `SvgTexLabel.tsx`, `svgLabelView.ts`;
- `src/rendering/svgPointNodeText.ts`, `svgPointNodeGeometry.ts`, `svgHitTesting.ts`;
- `src/rendering/labels/` service, runtime, layout, font/ink measurement;
- `src/rendering/svgLabelBounds.ts`, `svgLabelExportRegistry.ts`;
- `src/ui/svgSettledExport.ts`, `svgPreviewExport.ts`, `diagramUpdates.ts`;
- `src/ui/inspector/StratumInspector.tsx`, `src/App.tsx`;
- `tests/integration/nodeTextEditing.test.ts`, point geometry/picking tests,
  existing label lifecycle/export tests, and browser fixtures;
- `scripts/automation/run-phase.mjs`, `phase-verification.mjs` and runner tests.

The baseline point path uses literal text measurement independently in rendering
and hit testing. The existing settled exporter replaces captured label subtrees;
simply nesting SvgTexLabel inside a point would leave its border at old dimensions.
Inspect these actual interfaces before designing the integration.

## Implementation requirements

1. Factor reusable subscription/state handling from the shared label runtime if
   needed and introduce a point-node component/controller. Do not instantiate a
   second MathJax engine or call asynchronous conversion directly during render.
2. Derive body placement and current circle/regular-polygon/star contours from
   the same layout. Preserve width, height, baseline/depth, ordinary text/math
   alignment, and font readiness. Empty source keeps current empty-node sizing.
   Reuse full-source multiline/tab fallback rather than the old whitespace collapse.
3. Publish/reuse committed geometry for point picking, highlighting, and overlap
   cycling. Bind it to document/point/source/font identity; mismatched or removed
   owners cannot supply bounds. Point text belongs to its point, not a separate
   free-label selection target. Preserve finite hit behavior while pending.
4. Preserve generation cleanup for edits, deletion, duplication, unmount, load,
   undo/redo, and reused IDs. Changes to paint, position, camera, or visibility
   cannot accidentally restore earlier content or trigger unnecessary compilation.
5. Capture the complete point node synchronously for SVG export: current source,
   shape/style, placement/projection, visibility, and parent opacity context.
   Settle the body and reconstruct both contour and body with shared pure layout/
   view functions in the detached snapshot. Avoid nested duplicate captures.
6. Retain existing bounded settlement, literal fallback, explicit paint/local
   references, SVG-context server rendering, structural validation, duplicate-click
   policy, and editor-overlay exclusion. A successful formula cannot be exported
   with a pending/literal-sized contour. Live edits continue independently.
7. Register 32A-32D slugs from the plan in the runner and configure cumulative
   Phase 32 browser policy. Activate this stage's concrete requirements now;
   future groups become required in their own implementations. Keep earlier
   phases' policy and the fresh-process loading contract intact.

## Required acceptance and tests

| Area | Required evidence |
| --- | --- |
| Entry points | Native Add point, direct/cursor placement, inspector editing, 2D/3D work planes |
| Body/layout | Empty, spaces, plain/Japanese text, every supported delimiter, mixed runs, fractions/roots/scripts/depth |
| Failure/recovery | Same owner valid-invalid-valid; exact full source, spaces/tabs/newlines; bounded resource failure/retry |
| Races | Controlled A-B-C completion, deletion, duplicate, undo/redo, document replacement and reused point IDs |
| Interaction | Measured inner/outer contour boundary clicks, normal/Alt owner cycling, pan/zoom and moved 3D camera |
| Policy | Hidden/filtered/locked/dimmed nodes and unrelated free/inline labels |
| Export | Real transparent/white downloads while pending, then edit/load; standalone reopen with matching body and contour |
| Persistence | Actual JSON/history and both generated TikZ modes preserve authoritative input and existing schema |

Use real MathJax conversions plus deterministic delayed adapters for race cases.
Compare rendered and picked geometry at the same state; a test of the measuring
helper alone is insufficient. Verify font-ready remeasurement reaches all layout
consumers. Keep data/history unchanged by completion and export.

Add required browser groups `point-node-body-layout-lifecycle`,
`point-node-picking-visibility`, and `point-node-settled-export`.
Map all acceptance rows to completed scenarios within them, preserve all Phase 31F
groups, and test that the parent rejects an otherwise successful old report.

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
