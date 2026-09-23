# PGF independent paint reference

Generated 2026-09-23 using installed PGF 3.1.11a (2025-08-29), pdfTeX
3.141592653-2.6-1.40.29 / TeX Live 2026. This fixture does not call the
application's resolver. Commands (from repository root):

```sh
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/private/tmp tests/fixtures/point-paint-pgf/ordered-paint.tex
pdftoppm -singlefile -scale-to 1000 -png /private/tmp/ordered-paint.pdf tests/fixtures/point-paint-pgf/ordered-paint
```

`compilation.txt` records successful compilation and actual PGF version;
`ordered-paint.pdf` retains the generated document; `pdf-operators.txt` is the
uncompressed first page's content stream. `observations.json` records manual
observations of that independent PDF graphics state. Uppercase `/pgf@CA` sets
stroke alpha; lowercase `/pgf@ca` sets fill alpha; `q`/`Q` save/restore graphics
state. The text `TJ` operators inherit the active fill alpha unless their own
text scope replaces it. `RG`/`rg` are stroke/fill RGB colors. The ten bodies
A–J identify the rows unambiguously.

A uses .2 for each paint, replacing earlier .8/.7 values. B paints the contour
with stroke .8/fill .7, and text inherits .7. C and D use .6 for text independently
of the order of general opacity .2. E's later color=blue sets text blue; F's
later text=red sets text red. G emits stroke-only `S` (no background). H emits
white fill-only `f`, with text alpha 0. Independent overlapping paints are not
represented by one SVG group opacity. I and J reverse dotted/line-width option
order; both emit `[1.99255 1.99255]` PDF dash units with width `1.99255`,
confirming that these node dash patterns use the final 2pt width in both orders.

The installed `tikz.code.tex` confirms named thickness: thin=.4pt,
semithick=.6pt, thick=.8pt, very thick=1.2pt, ultra thick=1.6pt. Dash patterns:
dashed is on 3pt/off 3pt; dotted is on line width/off 2pt; densely dotted is
on line width/off 1pt. None of these names changes the default butt cap.
Dimensions are TeX points (72.27/inch), not PDF/CSS points.

The source was inspected to understand semantics; no PGF implementation was
copied into the application. The small fixture and observed data are authored
for StratifiedTikZ. Deferred layout/shape fidelity is not verified by this fixture.
