# Phase 32B Implementation Prompt: Independent point-node paint and imported styles

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
`docs/PHASE_32_PLAN.md`, and `prompts/phase-32b-review.md`.
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

32A must be implemented, verified, and independently reviewed. Preserve its
shared body/contour/picking lifecycle and whole-node export. Read its paired
prompts and outstanding findings before changing style state.

This stage separates node text, background, and border paint and resolves
supported user-defined TikZ styles faithfully. New geometric shapes and full
spacing/anchor controls remain for 32C/32D. Small ordered-parser/dimension
foundations needed by paint are in scope; do not claim later layout fidelity.

## Goal

Allow independent text/fill/border color and opacity, disabled fill/stroke, and
border width/style without losing old documents, imported style intent, history,
or agreement between preview, standalone SVG, and TikZ.

## Inspect first

- `src/model/types.ts`, `styles.ts`, `validation.ts`, `serialization.ts`;
- `src/model/stylePresets.ts`, `importedTikzStyles.ts`;
- `src/ui/inspector/PointStyleEditor.tsx`, `StyleEditor.tsx`;
- style clipboard, context quick controls, bulk editing, cloning/update helpers;
- point view/layout from 32A, `pointOcclusion.ts`, `svgStyle.ts`, hidden/dimmed policy;
- `src/tikz/generateTikz.ts`, including external-style baseline/override emission;
- model serialization/styles/import tests, UI editing tests, TikZ tests, and
  the native point fixtures and phase-verification policy introduced by 32A.

## Explicit paint and compatibility

Define one authoritative typed representation for text color/opacity, fill
enabled/color/opacity, and border enabled/color/opacity/width/line settings.
Retain overall opacity where needed by existing model behavior. Resolve TikZ
graphics/text state in option order; do not assume all opacity keys multiply,
or that SVG group opacity equals independent overlapping paint opacities.

Specify saved-format versioning and normalization before editing serialization.
Migrate point strata and saved user presets; update validation, constructors,
deep cloning, equality, clipboard, bulk edits, default/quick controls, inspector,
hidden/dimmed transforms, and imported override generation together.

Preserve old hollow as white fill, old text as black, the 0.4pt border, old shape
identities, size/2 inner separation, and empty-node defaults. Add genuinely
transparent fill and disabled border distinctly. Zero opacity is not absence.
Keep schema compatibility tests for old files and explicit new style round trips.

## Imported style resolution

1. Parse both `\tikzstyle{name}=[...]` and
   `\tikzset{name/.style={...}}`, respecting balanced delimiters, comments,
   namespaces, and option order. Expand known named-style references with bounded
   depth/work and cycle diagnostics. Do not execute arbitrary TeX or PGF code.
2. Support bare/assigned draw/fill/color/text, `draw=none` and `fill=none`,
   opacity/draw opacity/fill opacity/text opacity, line width and named thickness,
   dashed/dotted/densely dotted/solid, supported dash pattern/phase, caps and joins.
   Specify numeric, color, and dimension grammar and reject invalid values visibly.
3. Resolve common named colors, supported xcolor mixtures, and explicit literal
   `\definecolor` forms. Document supported color models; do not silently
   reinterpret an unknown macro or color as black. Preserve raw source/options
   and external file/style references for export.
4. Preserve explicit-versus-omitted fields. Specify effective defaults for legacy,
   newly created, and imported nodes. A style defining only text color must not
   preview as an application-default filled circle but export as a PGF-default
   unfilled rectangle. Materialize necessary effective options consistently and
   preserve local overrides after external styles.
5. Surface unsupported preview options without dropping their TikZ representation.
   Unsupported shape/layout options deferred to 32C/32D are not paint-stage
   implementation defects when explicitly retained and diagnosed.

## Rendering, UI, and export

- Expose independent paint in the point inspector with finite validated edits and
  correct undo granularity. Preserve preset selection, copy/paste, and bulk styles.
- Apply inherited text color to math paths while preserving explicit colors inside
  math. Paint-only edits must not recompile or replace the measured body layout.
- Render actual fill/stroke none and independent alphas, including dimming exactly
  once. Include stroke width in painted bounds where relevant to interaction.
- Emit readable named colors and ordered overrides in standalone and inline TikZ.
  Compare actual generated output for old models and new mixed-paint fixtures.
- Keep 32A click-time whole-node capture immutable; later paint edits cannot alter
  an already requested download.

## Required acceptance and tests

- One node has red text, translucent blue fill, and green dashed stroke with an
  independent width/opacity. Exercise real inspector events and imported presets.
- White hollow versus transparent fill; disabled stroke; zero/one alpha;
  overlapping fill/stroke/text; general/specific option order; dimming once.
- Both style declaration forms, bounded nested references, cycles, invalid values,
  supported mixed/custom colors, local overrides, and partial styles with omitted
  shape/fill/text/dimensions. Compare preview and both TikZ modes.
- Load legacy point and user-preset fixtures, edit, clone/copy/bulk apply, undo/redo,
  save/reload; no sharing of mutable nested styles or lossy normalization.
- Native pending/settled/fallback bodies retain 32A layout/picking while paint
  changes. Real transparent/white downloads reopen with matching colors/opacity
  and border geometry; captured paint survives subsequent edits.
- Register `point-node-paint-import-persistence` in browser acceptance
  and cumulative parent policy, retaining 31F and all 32A requirements.

Use independent paint observations and, for ambiguous TikZ opacity/ordering,
small PGF fixtures with a recorded version. Do not make expected values by calling
the same resolver being tested. Record supported grammar and default precedence.

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
