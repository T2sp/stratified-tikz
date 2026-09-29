# Point-node shape solvers

`solvePointNodeShape` constructs the eleven PGF `shapes.geometric` background
paths, plus basic circle/rectangle and the legacy regular-polygon square/triangle.
It consumes no browser, React, MathJax or TeX runtime state.

Inputs keep the upright body's width, height above baseline and depth below
baseline separate from inner/outer x/y separation, minimum width/height, border
line width and shape parameters. All lengths use one caller-selected unit;
`unitScale` specifies units per TeX point so PGF's fixed-point minimum arithmetic
remains stable across preview scaling. Dimensional shape parameters such as star
point height use that same unit. `bodyOrigin` is the top-left SVG position and
`baseline` is its baseline y-coordinate. The node origin is the body center, not
the asymmetric shape's bounding-box center.

The first closed contour is the outside boundary. Cylinder additionally returns
an open half-ellipse seam and separate closed body/end paint regions. Curves use
actual SVG ellipse arc commands. Bounded adaptive samples provide the shared hit
boundary (0.005-unit sagitta, at most 2048 samples per arc; larger work rejects
with an explicit limitation), with analytic arc extrema included in bounds; outer clearance never
changes those painted paths. Rotation transforms the border, never the upright
body. Ellipse/diamond ignore the border keys as upstream does. Polygon/star
always use their radius fitting; the remaining shapes honor their PGF incircle
and restricted-rotation branches, including the upstream negative-angle order.

The implementation is a separately named TypeScript adaptation of algorithms in
PGF **3.1.11a**, `pgflibraryshapes.geometric.code.tex`, copyright 2018 Till Tantau
and Mark Wibrow, distributed under **LPPL 1.3c**. See
[`docs/licenses/LPPL-1.3c.txt`](../../../docs/licenses/LPPL-1.3c.txt). The official
source SHA-256 is
`bbd6abe9df51153e2f4f61cca3ad669de34a6648cf37795df44da931402b69ee`.
PGF's minimum-growth branches use the bounded precision of its reciprocal macro;
replacing these calculations with exact floating-point division measurably
changes PGF's output, so the relevant precision is preserved explicitly.

Independent fixed boxes and their raw PGF path tokens live in
[`tests/fixtures/point-node-shapes`](../../../tests/fixtures/point-node-shapes).
The geometry tests compare those externally generated contours and body anchors;
they do not derive expected contours from this solver.

Counts are bounded to 3–64; ratios and aspect use the model's finite supported
domains. A singular or invalid input throws `RangeError`, never selects another
shape. Sector preview angles are limited to 1–179 degrees: PGF itself fails for
exact angle 180 (`sec(90)`), and reflex sectors can fail body enclosure even when
the upstream algorithm produces a finite path. Preserve unsupported reflex intent
for export, with an explicit preview limitation. A body with zero
width/height and zero inner separation may be singular in a shape's proportional
minimum calculation; callers must retain authoritative style intent and display
an explicit preview limitation. Full configurable spacing and named/numeric
anchor resolution remain Phase 32D work; this module already preserves their
independent solver inputs and separate clearance bounds.
