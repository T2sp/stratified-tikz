# Independent PGF import-order and local-override evidence

Compiled 2026-09-25 with PGF 3.1.11a, pdfTeX 1.40.29 (TeX Live 2026).
The source loads actual `base.sty` followed by `outer.sty`; no application
parser or generated expectations are involved. Existing opacity and namespace
reference artifacts are unchanged.

Executed from this fixture directory:

```sh
mkdir -p /private/tmp/stz-32b-import-order
PATH=/opt/homebrew/bin:$PATH pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/private/tmp/stz-32b-import-order reference.tex > compilation.txt
```

Exit status: **0**. `reference.pdf` and `reference.log.txt` copy the actual
compiler results. `pdf-operators.txt` is the uncompressed page stream extracted
from the PDF bytes (compression is disabled in the source). `observations.json`
records manually inspected effective paint operators, not parser output.

| Body | Observed result |
| --- | --- |
| A | Cross-file base: red fill, green text, blue stroke |
| B | Prior-file named color: #123456 fill/text |
| C | Later canonical root alias: blue text despite old root declaration |
| D | Color declared after its style body: #2468AC fill/text at invocation |
| E | Untouched macro fill: cyan, text red |
| F | Explicit post-key fill: black, text still red |
| G | Unsupported-to-preview CMYK redefinition of red: actual cyan fill/text |
| H | Explicit post-key fill/text: black |
| I | Later supported redefinition: #654321 fill/text |

Cyan is emitted as `1 0 0 0 k`, black as `0 g`; the repeated state operators
before each path/text show the final state. The app deliberately does not add
CMYK/macro evaluation. It must preserve G/E's external effect until overridden.
Registered export regressions inspect post-key options and named-color definitions,
and compare supported model resolution to these independently recorded results.
