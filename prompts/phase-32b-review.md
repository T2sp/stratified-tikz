# Phase 32B Review Prompt: Independent point-node paint and imported styles

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
`docs/PHASE_32_PLAN.md`, and `prompts/phase-32b-implement.md`.
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

## Focused review checklist

- The paint model has one authoritative value per explicit user setting and a
  documented saved-version/legacy normalization policy.
- Legacy nodes AND saved presets preserve white hollow, black text, 0.4pt border,
  regular-polygon shape identities, size/2 spacing, and empty defaults.
- Validation, equality, deep cloning, clipboard, bulk edits, presets, quick
  controls, inspector, visibility transforms, and history all handle new fields.
- None, zero opacity, and omitted values are distinct. Ordered general/specific
  paint keys match observed PGF semantics rather than unconditional multiplication.
- Both declaration syntaxes and bounded known-style expansion work; malformed
  source, cycles, macros, unsupported colors/options are handled explicitly.
- A partial imported style has the same effective defaults in preview and both
  TikZ modes; external references and local overrides remain correct.
- Math inherits current text color without overwriting explicitly colored math
  fragments. Paint edits reuse existing conversion/layout.
- Independent overlapping paint, stroke width, transparency, and autoDim are
  correct in real rendered output, including pending/failed formulas.
- Whole-node SVG exports capture paint immutably and preserve exact current source.
  Native inspector edits, actual downloads, and standalone reopen were exercised.

## Required evidence checklist

Require all Phase 31F and 32A groups plus
`point-node-paint-import-persistence`. Check actual serialized old/new
fixtures and user presets, both generated TikZ modes, current browser observations,
and standalone artifacts. Review the targeted opacity/default-resolution oracle
rather than accepting a helper that generates its own expectations.

Confirm explicit unsupported diagnostics and documentation of value grammar.
Eleven-shape implementation and configurable anchor/minimum conformance are
deferred; preserving their options without misrepresenting preview support is
required now.

## Browser verification and evidence

Use real production components and native App events, actual MathJax conversions,
and downloaded SVGs reopened outside the App. Controlled delayed adapters are
appropriate for races, but cannot replace real conversion and native evidence.
Screenshots alone do not prove source identity, bounds, paint, or history.

Check that new Node tests are registered in the explicit `package.json` list.
Verify `scripts/checkFreeLabels.mjs`, its fixtures, and
`scripts/automation/phase-verification.mjs` enforce the required groups specified
for this subphase. All twelve Phase 31F groups and all completed earlier Phase 32
groups must remain required. Inspect completed scenario identities, terminal
success, page errors, and artifacts, not just exit codes or group counts.

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

Confirm fresh-process verifier loading from 31F remains intact. Inspect runner/
policy regressions for cumulative Phase 32 requirements, exit-zero incomplete
evidence, checkout mismatch, and failure before review/commit. Never accept an old Phase 31
report as evidence for new point-node scenarios. When implementation changes
verification policy, the running parent must use the updated policy.

Retain commands, Node/browser versions, logs, scenario observations, SVG/PNG
artifacts, and verified checkout identity. Save observations before bounded
screenshots; own asynchronous event/action rejections and preserve primary
failures through cleanup. Required browser or PGF-reference evidence that is
missing remains an explicit acceptance gap, not a successful check.

## Review instructions

Review the actual production changes and tests against the paired implementation
prompt and the shared contract. Do not modify source, tests, prompts, or docs.
Temporary verification artifacts outside the tracked tree are allowed.

Run the required Node/build/diff and focused checks. For browser commands follow
the matching parent-evidence rule above; otherwise obtain fresh execution in an
authorized browser-capable environment or report the missing required evidence.
Separate executed results, code inspection, historical evidence, and unavailable
checks. Do not repeat the implementation report as proof.

For each finding provide a concrete trigger, consequence, and file/line reference.
Distinguish production defects from missing acceptance evidence and from optional
improvements. Do not demand deferred features from later subphases.

Output a human-readable review using:

```markdown
**Summary:** pass / needs changes

**Critical Issues**
- ...

**Medium Issues**
- ...

**Low-Priority Issues**
- ...

**What Looks Correct**
- ...

**Test Results**
...

**Build Results**
...

**Ready To Call This Subphase Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
...
```

Then emit exactly one valid JSON object between these markers:

```text
REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END
```

Replace the summary placeholder with exactly `pass` or `needs_changes`.
Counts must agree with the human review. Any Critical/Medium issue or missing
required acceptance evidence requires `needs_changes` and
`ready_to_commit: false` with a concrete targeted fix prompt.
Passing static/helper tests cannot substitute for browser or independent PGF
reference requirements. Do not require rerunning a matching successful parent
browser report merely because the reviewer is sandboxed.

Critical issues include authoritative data loss, history corruption, or unsafe
execution of user input. Medium issues include violated subphase behavior,
preview/picking/export disagreement, lossy migration, omitted required scenarios,
unregistered tests, or unaccepted verification. Low-priority issues are
nonblocking presentation/documentation polish.
