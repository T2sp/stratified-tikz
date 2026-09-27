# Executing-handler follow-up PGF comparison

The read-only review of the first correction identified a remaining execution
hole inside a top-level `\tikzset` block:

```tex
\tikzset{myPoint/.style={text=blue},run/.code={\tikzset{myPoint/.style={text=red}}},run/.try={}}
```

The external handler invocation executes `run` and redefines `myPoint` to red.
Treating `run/.try={}` as only an unsupported passive declaration left the
earlier blue definition falsely certain. `before/` retains all 13 original
reviewer files from
`/private/tmp/stz-32b-execution-fix-hCVgf2/reviewer-probes` byte for byte, with
the compiler log renamed only from `try.log` to `try.log.txt`. The original PDF
operators show red (`1 0 0 rg`) for `PGF`, then blue (`0 0 1 rg`) for both old
application export modes. The original scripts, commands, observations,
source, generated modes, compiler log, PDF and extracted operators are retained.

`before-sha256.json` was captured before correction and
`original-evidence-verification.json` verifies all originals and retained copies
remain unchanged. The corrected `try.sty` is byte-identical to the independent
reviewer's source. The four earlier execution-boundary fixtures were not
rewritten for this follow-up.

The corrected importer admits a closed set of passive definition handlers;
unsupported execution-capable handlers such as `.try` reject the whole initial
import. The fixture's `generate.mjs` asserts the original diagram's object
identity and serialized bytes are unchanged, with empty references, styles,
declarations, colors and raw options plus an actionable diagnostic.

To exercise already-saved diagrams independently of rejection, the script uses
a supported blue literal import and real preset application to create the old
incorrect preview snapshot. It then replaces the preserved source with the
exact reviewer's source, leaves the stale reference and empty old diagnostics
in place, serializes (`try-stale.json`) and reloads. It also reapplies the existing
preset and serializes/reloads a second time. Reconstructed resolution marks text
paint unresolved; `try-observations.json` records the diagnosis and retained raw
source. Generated node options after the actual `myPoint` key contain no
untouched `text=` override in either mode.

The corrected reference document contains the external `PGF` node, reloaded
standalone and inline-math `APP` nodes, then preset-reapplied standalone and
inline-math `APP` nodes. All five are red in the actual PDF. The compiler exited
**0** with pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026), PGF 3.1.11a, and Node
v26.9.0. `commands.txt`, `versions.json`, `compilation.txt`, `try.log.txt` and
`try.pdf` retain the invocation and actual compiler output.

`extract-operators.mjs` extracts the uncompressed page stream into
`pdf-operators.txt` and asserts the actual RGB operator at every `PGF`/`APP`
glyph body is `1 0 0 rg`. `independent-pgf-observations.json` records those five
observations. Expected red comes from the external PGF behavior, independently
of application parsing. No TeX compiler runs in the importer or preview.
