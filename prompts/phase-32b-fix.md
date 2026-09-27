# Phase 32B Targeted Fix Prompt: Preserve importer certainty across execution contexts and declaration overflow

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Inspect status and preserve the
current implementation, including all existing App diagnostics, harness,
package, documentation and test changes and the four untracked helper/test
files. At this prompt update HEAD is
`f75e3ac2a0868c87f9d216fa7c401b68f37425cf`. The accepted parent verification and
the independently reviewed checkout match this pre-prompt fingerprint:

```text
d47b85b1596b340a97f9ca80a0197fce67d450d368d38b605b0cb7e487ed4dff
```

This identifies the tree before this prompt edit. Recompute final identity
including tracked changes, untracked files and binary bytes after corrections.
Do not reset, discard or restart the existing implementation.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Fix only the two Medium production defects identified below: unsupported
execution/scoping contexts becoming authoritative paint, and declaration-limit
overflow preserving false certainty. Keep strict TypeScript, bounded parsing,
existing dependencies and 32A behavior. Do not execute TeX in the importer or
preview, implement a general TeX interpreter, or expand into deferred 32C/32D.

## Accepted verification and remaining review findings

The matching parent verification passed all five commands, including both
browser commands:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-T5qkan/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-T5qkan/05-check-free-labels/artifacts/free-labels-evidence.json
```

The review accepts all 16 groups, 27 point scenarios and 281 required artifacts,
with no incomplete groups or page errors. Before/after identities match the
reviewed checkout, including untracked files. Independent fresh tests passed
3,345 cases with zero failures/skips; build, strict production/fixture/new-test
TypeScript and script syntax checks also passed. Focused lint reported only
baseline diagnostics independently reproduced at accepted 32A revision
`595139d`; repository-wide lint was not run. The existing build chunk warning
is nonblocking.

The supplied independent review nevertheless returned `needs_changes`, with
zero Critical, two Medium and zero Low issues, and `ready_to_commit: false`.
These are demonstrated production importer/export defects, not missing native
acceptance. Do not reopen the earlier scroll, App continuity or runner task
merely because historical triggers remain unproven. Preserve their fixes and
accepted coverage.

Review reproductions and independent compiler evidence:

```text
/private/tmp/stz-32b-model-review/commands.txt
/private/tmp/stz-32b-model-review/production-observations.log
/private/tmp/stz-32b-model-review/bounds-production-observations.log
```

That directory retains `repro.mjs`, `bounds.mjs`, original `.sty` inputs, both
export modes, four successful PGF 3.1.11a/pdfTeX 1.40.29 compilations and extracted
PDF paint operators. Inspect these before changing code. Preserve the failing
artifacts; put corrected evidence in a separate location.

## 1. Unsupported execution and local scope must not establish global paint

`parseTikzsetStyles()` in `src/model/importedTikzStyles.ts` currently scans
`\tikzset`, `\tikzstyle` and `\definecolor` with a global regex around line 185.
It does not establish whether declarations execute or whether their scope
survives. The exact unused-macro reproduction is:

```tex
\tikzset{myPoint/.style={text=blue}}
\newcommand{\unusedPaint}{\tikzset{myPoint/.style={text=red}}}
```

Importing and applying `myPoint` produces red preview text and explicit red
options after the external key in both `standalone` and `inlineMath` exports.
PGF applies blue. A duplicate-key warning does not make that red authoritative.
The retained false-conditional reproduction has the same mismatch:

```tex
\tikzset{myPoint/.style={text=blue}}
\iffalse\tikzset{myPoint/.style={text=red}}\fi
```

The proven local-group case affects a color binding, not just a style:

```tex
\definecolor{Custom}{HTML}{0000FF}
{\definecolor{Custom}{HTML}{FF0000}}
\tikzset{myPoint/.style={text=Custom}}
```

The importer currently resolves red with no warning; external PGF is blue.
Fix styles and color bindings together.

### Required correction

Define a conservative, bounded supported execution/scope boundary. Declarations
inside unsupported macro bodies, conditional branches or local groups must not
be treated as definitely executed global definitions. Either reject an affected
import atomically with actionable diagnostics and no partial model mutation,
or preserve its source with explicit uncertainty that reaches resolution and
export. Do not silently skip an uncertain later declaration and then declare
an earlier definition certain unless the supported semantics justify that.

Keep ordinary supported top-level literal declarations working, including
legitimate braces in options, comments, color values, namespaces and supported
source ordering. Do not substitute a few string-pattern exclusions for an
explicit bounded policy, or execute macros/conditions to guess their effects.
Unsupported or malformed context must produce an actionable diagnostic.

Trace the complete path through `createImportedTikzResolutionContext()`,
reference diagnostics, preset application, imported point snapshots and
`src/tikz/generateTikz.ts`. Uncertainty must cover affected color bindings,
styles, aliases and dependent references, including references from earlier
source files. Saved `options` or legacy fallback snapshots must not restore
certainty that preserved raw source invalidated. Preserve unaffected supported
values where they can be established, without assuming unknown effects are
local to the key whose name was last scanned.

A parser warning alone is insufficient. The exporter suppresses untouched
post-key paint based on unresolved fields; uncertain preview fallback values
must not become authoritative options overriding the external style. Keep
explicit user edits authoritative, including an intentional value equal to the
preview fallback. Preserve raw source, key spelling and external load hints
for accepted imports; do not strip unsupported TeX from saved/exported sources
to manufacture agreement.

## 2. Declaration overflow must not leave a certain truncated prefix

Around `importedTikzStyles.ts:225`, exceeding 512 declarations currently emits
a warning, truncates `declarations` and stops. The retained reproduction is:

1. Declare `myPoint/.style={text=blue}`.
2. Add 511 filler declarations.
3. Redefine `myPoint/.style={text=red}` as declaration 513.

Preview and both exports use blue, overriding external PGF's actual red.
The reference contains blue `options`, red `rawOptions` and empty
`previewDiagnostics`: the 513th entry already changed metadata before truncation.

Keep the finite declaration bound. Reject overflow atomically, or propagate
unresolved state broadly enough that the incomplete prefix and unseen suffix
cannot establish authoritative style/color effects. Raising the limit,
retaining the first 512 as resolved, adding only a warning, or dropping all
parsed entries while restoring saved fallback references does not fix this.
Keep definitions, declarations, colors, raw options and diagnostics consistent
with the chosen policy.

Apply the same policy during raw-source reconstruction and JSON reload, not
only initial import. Existing saved references/presets and earlier source files
may be affected by a later overflowing source. If choosing atomic import
rejection, verify that no partial source/reference/preset/model changes occur,
and separately handle already-saved raw sources that exceed the bound without
trusting their old snapshots. Preserve the existing input/work/depth bounds.

## Required regressions and independent PGF comparisons

Add focused registered tests using the actual import → preset/application →
resolution → persistence → export path as appropriate:

- Exact unused `\newcommand`, false conditional and grouped `\definecolor`
  reproductions, plus grouped style declarations and supported top-level
  controls. Cover the scanner's supported declaration forms and meaningful
  nested/comment/brace cases without adding general TeX execution.
- Exactly 512 versus 513 declarations, both across separate commands and in
  one `\tikzset` block. Include the retained late redefinition and verify
  diagnostics and metadata consistency, not just array length.
- Affected aliases/dependencies and earlier references after a later uncertain
  source, plus unaffected supported controls where justified by the policy.
- Exact raw-source and diagnostic persistence through save/load, reapplying an
  existing preset, and relevant Undo/Redo. Test stale saved references against
  reconstructed uncertainty and atomic no-mutation behavior if rejecting.
- Untouched imported paint and intentional local text/fill edits, including an
  edit equal to the fallback value. In both export modes, inspect the options
  after the actual external key: uncertain untouched paint must not override
  it, while explicit local edits must remain effective.

Preserve the four independent failing PGF cases (`macro`, `conditional`,
`groupedColor`, `bounds`). Compile corrected generated output in both modes
against the same independent external sources, retaining commands, versions,
logs and actual PDF operators. External nodes must keep blue for the first
three cases and red for the overflow case; application output must no longer
force the incorrect color. If an input is rejected atomically, demonstrate the
rejection and absence of partial output/state, and use retained-source/reload
coverage to establish that affected saved diagrams cannot emit the old false
overrides. Do not regenerate expected paint from the application's own parser.
Compiler use in these independent checks does not authorize TeX execution in
the application.

## Preserve completed work and cumulative acceptance

Keep the current App geometry/ownership diagnostics, bounded frame and host
waits, original native scroll deadline, real pointer and viewport assertions,
JSON download boundary and five native geometry fault controls. Keep the
seven App → SVG → App transitions and three separate continuity controls,
including all 13 continuity artifacts. The historical failures need not be
reproduced again to address these importer findings.

Preserve the previous runtime-directory uncertainty fix, independent PGF
references, supported absolute-option recovery, local override intent and
paint-only mutation recovery. Keep all existing clear/imported-paint scenarios,
the directory scenario and its 11 artifacts, six responsive downloads and
91 responsive artifacts. Preserve the current minimum of 16 cumulative groups
and 27 point scenarios and every currently required artifact; new targeted
coverage must supplement it. Do not weaken verification policy to accept old
or incomplete reports.

Keep the runner's 60-second fixture deadline, bounded owned-child cleanup,
failed-evidence retention, fresh-process verifier loading and transitive
fixture dependencies. Preserve detached provenance cleanup, the bounded
100-entry history contract, raw JSON/CRLF, 2D/3D semantics, independent paint,
opacity/dimming, immutable SVG capture and free/inline-label behavior.

## Verification, documentation and review

Read `AGENTS.md`, paired 32B implement/review prompts and current
`docs/PHASE_32B_IMPLEMENTATION.md`, `docs/IMPORTED_POINT_PAINT.md` and
`docs/DATA_MODEL.md`. Document the supported execution/scope boundary and
overflow policy, diagnostics/persistence behavior, reproduced defects and
corrected independent results. Keep changes confined to these two defects and
necessary regressions/documentation.

Run focused registered tests, applicable strict production/fixture/test
TypeScript, changed-script syntax, targeted lint and `git diff --check`.
Run `npm test` and `npm run build` sequentially because they share asset
preparation. Distinguish established lint debt and the build chunk warning
from new failures; do not perform unrelated cleanup.

The T5qkan parent report is accepted evidence for the pre-fix tree. It does not
verify subsequent importer changes. Before final verification, finalize code,
tests and tracked documentation; record final identities and report paths in
an external handoff. Then run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands and current cumulative native evidence on that final
tree, including tracked/untracked/binary identity. Any subsequent checkout
change requires matching verification again. Obtain independent read-only
review of the same verified tree against `prompts/phase-32b-review.md`, with
both Medium findings explicitly reassessed using the independent PGF evidence.
`32B verify` itself does not perform review.

Do not commit or push while either production finding or verification/review
remains unsuccessful. 32B is incomplete until both defects and both gates are
resolved; 32C/32D remain deferred.
