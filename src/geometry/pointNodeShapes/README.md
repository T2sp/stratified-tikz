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
`baseline` is its baseline y-coordinate. Optional `body.originX` records the actual
text advance origin when glyph ink overhang differs from the enclosing box;
the `text` anchor uses it without moving the box. The node origin is the body
center, not the asymmetric shape's bounding-box center.

The first closed contour is the outside boundary. Cylinder additionally returns
an open half-ellipse seam and separate closed body/end paint regions. Curves use
actual SVG ellipse arc commands. Bounded adaptive samples provide the shared hit
boundary (0.005-unit sagitta, at most 2048 samples per arc; larger work rejects
with an explicit limitation), with analytic arc extrema included in bounds; outer
clearance is separate from paint, subject to the PGF diamond exception below.
Rotation transforms the border, never the upright
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
changes PGF's output. TeX's `.1` factor is 6554 scaled points divided by 65536,
with truncation at each multiplication. The calibrated adaptation retains that
detail, five-decimal trig and inverse-sine lookup/interpolation, TeX's scanned
scalar fractions and truncating dimensional products, decimal-divisor
iteration, and the basic circle's integer-normalized-vector radius algorithm.
These differ from exact JavaScript floating division or `Math.hypot`. Nearly
parallel border lines retain PGF's rounded affine-matrix inverse and original
named/numeric external-vector lengths.

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
an explicit preview limitation. Finite negative inner/outer separation is accepted.
Cylinder's PGF `asin` fitting rejects negative inner y separation, including
minimum-dominant cases; the solver diagnoses the upstream domain failure instead
of inventing a contour. Signed minimum dimensions are accepted, with negative
minima inactive under PGF's content-dominant max rules.

## Placement and anchors

`resolvePointNodeAnchor(input, solution, source)` returns a supported coordinate
or an explicit diagnostic. `pointNodeAnchorIssue` validates names and positive
integer indices before measurement. Unknown names, out-of-range indices and
documentation placeholders such as `corner N` never resolve to center. The
source is preserved. Finite numeric strings specify border directions in degrees.
PGF converts them through `pgfmathsetcounter`: unsigned/leading-plus literals use
their integer prefix, while a leading minus invokes TeX dimensional rounding
before count truncation. Positive leading-dot forms lack a valid count prefix;
negative leading-dot forms use the full parser. Counts at 16,384 degrees fail
polar math, and negative values can fail earlier at the dimensional boundary.
The source spelling remains unchanged. Directions use PGF's positive-up convention and returned
coordinates use SVG's downward y sign.

The solution carries `anchors`, `placementAnchor`, `anchorDiagnostic`,
`textCenter`, `shapeCenter` and `anchorBounds`. Painted paths remain relative to
the upright body center. Rendering translates the complete body and shape by
minus `placementAnchor`, keeping the selected anchor at the model coordinate.
`base` uses the measured baseline; `mid` uses baseline minus half the explicit
font-context x-height; `text` uses the measured text origin. Border rotation
changes shape-specific anchors and retains upright text/base/mid. Compass names
retain the fixed global directions passed by PGF; strong negative outer
separation can reverse a shape's signed compass radius. Ellipse's named
diagonal anchors use eccentric angles while numeric directions use radial
intersection.

Every shape declares center, text, base, mid, eight compass directions and
numeric border directions. Additional names match PGF **3.1.11a** exactly:

| Shape | Additional text-side anchors | Shape-specific anchors |
| --- | --- | --- |
| circle, rectangle, ellipse | base east/west, mid east/west | none |
| diamond | none | none |
| regular polygon; legacy square/triangle | none | corner 1…N, side 1…N |
| star | none | outer point 1…N, inner point 1…N |
| trapezium | base east/west, mid east/west | bottom left/right corner, top left/right corner; left/right/top/bottom side |
| isosceles triangle | base east/west, mid east/west | apex, left/right corner, left/right/lower side |
| kite | base east/west, mid east/west | upper/lower/left/right vertex; upper/lower left/right side |
| dart | base east/west, mid east/west | tip, left/right tail, tail center, left/right side |
| semicircle | base east/west, mid east/west | apex, arc start/end, chord center |
| circular sector | none | arc start/end, sector center, arc center |
| cylinder | base east/west, mid east/west | shape center, before top, top, after top, before bottom, bottom, after bottom |

Outer clearance follows per-shape axes, maximum separation, radial and miter
rules, separately from stroke/selection/hit geometry. PGF's diamond background is
an explicit upstream exception to paint invariance: geometric source lines
329–341 subtract `1.414213 * outer sep` from saved anchor axes. The painted axis
is therefore fitted axis plus `(1 - 1.414213) * outer sep`; positive separation
shrinks it and negative separation enlarges it. The anchor axis remains fitted
axis plus separation. This behavior is retained and independently tested.
Cylinder clearance retains PGF's distinct max(xsep,ysep) end radii, ysep side
anchors and rotation-sensitive base/mid border classification. Clearance bounds
are never a generic enlarged hit box.

Strong negative separation can invert clearance. Polygon, star, trapezium,
triangle, kite and dart retain PGF's declared angular edge selection and infinite
line intersection rather than selecting a nearest positive ray. Semicircle and
sector use ordered arc/chord decisions and the bounded offset-circle formula.
Cylinder adapts `pgfmathcalc.code.tex`'s angular bisection, including its finite
upstream estimate when the selected arc is not crossed. Zero-axis ellipse
directions use PGF's `(0,0)` normalization to 90 degrees. All anchor results
enforce finite coordinates. Singular names/directions produce a diagnostic
individually, so unused invalid sector directions cannot hide a finite selected
anchor. The relevant seven upstream source hashes are retained with the oracle.
Returned anchor coordinates also obey TeX's finite dimensional range.

No paragraph wrapping or fake text height/depth metrics are supplied here;
deferred text-box overrides require caller diagnostics. Typography and actual
MathJax success/fallback measurements remain separate from the fixed-box oracle.

Independent Phase 32D evidence lives in
[`tests/fixtures/point-node-anchors`](../../../tests/fixtures/point-node-anchors):
172 fixed boxes and 4,925 anchor coordinates covering all fifteen saved shape
names; unequal, zero and PGF-valid negative spacing; independent/coupled minima;
stretch/aspect; star height/ratio; cylinder ends; restricted rotation and rotated
incircle branches. `pointNodeAnchorReferences.test.ts` compares anchors within
0.025 TeX pt and contours within 0.03pt, accounting for an 80pt PGF cubic-circle
deviation plus the solver's separate 0.005-unit sampling sagitta. Source/raw
hashes are authenticated. Independent negative controls reject wrong circle
diameter, independently stretched triangles, wrong body origin and ignored outer
clearance. Eleven independent expected-failure artifacts cover actual PGF fitting
and anchor singularities. Original 32C references retain their unchanged
0.025pt comparison.
