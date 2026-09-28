# Execution boundary and declaration-overflow PGF comparisons

This directory retains the independent failing cases from
`/private/tmp/stz-32b-model-review` and corrected offline comparisons. The
importer and preview never invoke TeX. These fixtures invoke the installed
compiler only to compare application output against independently supplied
external definitions.

## Original evidence

`before/` preserves every file from the original review directory byte for byte.
Only compiler log filenames change from `.log` to `.log.txt`; the content is
unchanged. `before-sha256.json` records each original filename, size and SHA-256
captured before corrections. `original-evidence-verification.json` records a
subsequent verification of every original file and retained copy. No original
reproduction, source, generated fragment, compiler log, PDF or paint-operator
artifact was overwritten. The original commands and production observations
are retained in `before/` alongside the reproduction scripts.

The exact original external `.sty` bytes are copied into this directory:

| Case | Independent external source behavior | Old application behavior |
| --- | --- | --- |
| `macro` | Unused `\newcommand` body does not run; `myPoint` stays blue. | Red text after the external key. |
| `conditional` | `\iffalse` branch does not run; `myPoint` stays blue. | Red text after the external key. |
| `groupedColor` | Local red color definition does not survive its group; `Custom` stays blue. | Red text after the external key. |
| `bounds` | Declaration 513 redefines `myPoint` to red. | Blue text from the truncated prefix after the external key. |

Original PDFs contain an independent `PGF` node followed by both old application
export modes. Their actual page operators establish blue/red/red for the first
three cases and red/blue/blue for `bounds`. These expected colors are independent
of the application parser.

## Corrected paths

`model.mjs` calls the actual importer on each source and asserts atomic rejection:
the original diagram object and serialized bytes are unchanged; references,
definitions, declarations, colors and raw options are empty; an actionable
execution/bounds diagnostic is present. Rejection therefore produces no partial
external source, preset, imported reference or point-style change.

Saved diagrams require a separate check. A supported literal import and actual
preset application establish the previously wrong point-paint snapshot (red for
the first three cases, blue for `bounds`). The retained original raw source then
replaces the literal source before serialization. Stale reference `options`,
the independent review's final `rawOptions`, and empty old preview diagnostics
are deliberately retained. `*-stale.json` records these exact reload inputs.
Reload reconstructs uncertainty from raw source, retains that source verbatim,
adds reference diagnostics and resolves all imported paint as uncertain. Existing
presets are also reapplied and serialized/reloaded again.

`*-observations.json` records these real import/reload observations. Both export
modes have assertions on options **after the actual `myPoint` key**: no untouched
`text=` override is allowed there. Preview fallback paint may appear before the
key; external PGF effects remain authoritative. All four emitted fragments per
case are retained (`*-standalone.tex`, `*-inlineMath.tex`, and their
`*-reapplied-*` counterparts).

Each corrected reference document loads the exact original external file and
contains, in order:

1. Independent external `PGF` node.
2. JSON-reloaded application's standalone output.
3. JSON-reloaded application's inline-math output.
4. Existing-preset reapplied standalone output, after another JSON round trip.
5. Existing-preset reapplied inline-math output, after another JSON round trip.

All four compilations exited **0**, using Node v26.9.0, pdfTeX
3.141592653-2.6-1.40.29 (TeX Live 2026), and PGF 3.1.11a. Exact commands, temporary
output location, versions and exit codes are in `commands.txt`, `versions.json`
and `*-compilation.txt`; actual compiler logs/PDFs are `*.log.txt` and `*.pdf`.

`extract-operators.mjs` reads each actual uncompressed PDF page stream and
asserts the most recent RGB text-paint operator at each `PGF`/`APP` glyph body.
It does not call the application parser or regenerate expected colors. The
retained `*-pdf-operators.txt` and `independent-pgf-observations.json` confirm:

| Case | External | Reloaded standalone | Reloaded inline math | Reapplied standalone | Reapplied inline math |
| --- | --- | --- | --- | --- | --- |
| `macro` | blue | blue | blue | blue | blue |
| `conditional` | blue | blue | blue | blue | blue |
| `groupedColor` | blue | blue | blue | blue | blue |
| `bounds` | red | red | red | red | red |

Blue is the actual PDF operator `0 0 1 rg`; red is `1 0 0 rg`. The comparison
therefore establishes that corrected saved diagrams no longer force the old
incorrect color in either export mode, including after preset reapplication.
