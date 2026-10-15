# Additive cylinder singular-domain references

This separate bundle leaves the original 172 fixed boxes, 4,925 anchors and eleven
expected failures, signed-axis/polygonal fixtures and zero-axis paths unchanged.
It records PGF **3.1.11a**, the exact pdfTeX engine/version and executable hash,
upstream source hashes, complete TeX inputs, compiler stdout and full compiler
logs. All commands use `-no-shell-escape -interaction=nonstopmode -halt-on-error`.
The generator imports no application geometry, rendering or export code.

Regenerate with Homebrew Node >=22.12.0 and the recorded TeX Live 2026 engine:

```sh
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/point-node-anchors/cylinder-domain/generate.mjs
```

Each case has its own document, process, raw `geometry.txt` and log. The eleven
`failures/` cases return exit 1 at PGF's cylinder division before any paint/anchor
observations: empty zero spacing/minima, axial-only extent, rotation 90/270 axis
exchange, incircle zero, nonempty transverse padding cancellation, signed negative
radius clamped to zero by minimum width, nonempty incircle cancellation, and
separate minimum-height, outer-separation and thick-line/custom-fill non-rescues.
Partial raw observations contain only the case and font context. The division is
by the fitted effective transverse radius, after rotation/incircle/minimum width;
axial minimum, outer sep and line width cannot rescue it.

The twelve `controls/` cases independently compile with exit 0 and contain 93
raw anchor observations plus paint paths. They preserve positive minimum-width
rescue, `rx=0, ry>0`, rotation 90/270 axis exchange, incircle axial fitting,
negative nonzero fitted cylinder radii, and zero-axis basic/ellipse neighbors.
The negative fitted-radii control deliberately compares the unchanged paint and
only center/text/base/mid/west anchors. It does not claim general radial-anchor
conformance for that additional signed input; the existing cylinder radial-anchor
algorithm is outside this zero-divisor fix. Other controls compare every recorded
anchor. Existing 0.025pt anchor and 0.03pt contour tolerances remain unchanged.
Parsed coordinates reverse PGF's positive-up Y exactly once; no CSS/PDF bp
conversion is made.

`review/` preserves ten exact independent reviewer files from
`/private/tmp/stz-review-cylinder-zero-IrjltG/` with individual hashes. Its historical
`production-layout.json` and SVG show the previous invented tiny contour; these
are retained reproduction evidence, not oracle geometry. The actual retained
production `generateTikz` source is copied at the bundle root and recompiled in a
complete correct article/TikZ wrapper with PGF version reporting. This new run
also returns exit 1 for division by zero. The registered rendering regression
reconstructs its authored empty cylinder model and compares the generated source
byte-for-byte. The original wrapperless context failure is separate and is not
used as cylinder evidence.

`references.json` authenticates all 96 fresh compiler/input/raw/log artifacts, the
ten retained reviewer files, the generator bytes and unchanged original reference
manifest. The registered geometry tests authenticate these bytes before deriving
expectations from raw observations. Rendering/model/TikZ tests retain explicit
raw units/context, version2 persistence, history/model coordinates, both ambient
dimensions and authored cylinder intent while the shared pending/live/settled
view suppresses contour, seam and custom regions and exposes its existing warning.
Controlled fixed-box measurements do not replace the separately required native
browser/download/reopening/SVG/PNG evidence.
