# Phase 15A Implementation Prompt: Closed-boundary fill data model

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```


## Project context

You are working on the StratifiedTikZ project.

Phase 14 is complete or near complete.

The project goal includes efficiently drawing 2D and 3D stratified diagrams with:

- closed paths;
- filled regions/sheets;
- translucent colored 2-dimensional strata;
- solid and dotted 1-strata;
- point markers;
- labels;
- coordinate axes;
- readable TikZ output.

Phase 15 now prioritizes closed-path filling in both 2D and 3D before more specialized curved surface primitives.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- In 2D:
  - codim 0 strata are regions;
  - codim 1 strata are curves;
  - codim 2 strata are points.
- In 3D:
  - codim 1 strata are sheets;
  - codim 2 strata are curves;
  - codim 3 strata are points.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work planes are model-space editing aids.
- A 3D closed-path filled sheet in this phase should be planar and work-plane-local.
- Preview-only UI state should not be stored in `Diagram`.
- Generated TikZ must remain readable and should preserve style/layer semantics.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load, undo/redo, camera, work-plane, concatenated path, and existing creation/editing behavior.


## Goal

Introduce data models for filled objects whose boundary is one or more closed paths.

This phase should support both:

1. 2D codimension-0 filled regions;
2. 3D codimension-1 planar filled sheets on a work plane.

It should also support multiple closed boundary components with an explicit fill rule, especially `evenOdd`.

## Scope

Implement:

- data model for 2D filled regions;
- data model for 3D work-plane-local filled sheets;
- boundary component model;
- fill rule model;
- validation helpers;
- save/load validation.

Do not implement yet:

- creation UI;
- SVG/TikZ rendering;
- editing UI;
- curved surface primitives such as hemispheres/saddles;
- boolean operations;
- self-intersection resolution;
- live linked boundary references;
- new dependencies.

## Data model requirements

Add a reusable closed-boundary representation.

Suggested model:

```ts
type FillRule = "nonzero" | "evenOdd";

type ClosedPathBoundary = {
  id: string;
  name?: string;
  segments: PathSegment[];
};

type FilledRegion2DStratum = {
  id: string;
  name: string;
  geometricKind: "region";
  codim: 0;
  ambientDimension: 2;
  kind: "filledRegion";
  boundaries: ClosedPathBoundary[];
  fillRule: FillRule;
  style: RegionStyle;
  layer: number;
};

type WorkPlaneFrameSnapshot = {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  normal: Vec3;
};

type WorkPlaneFilledSheet3DStratum = {
  id: string;
  name: string;
  geometricKind: "sheet";
  codim: 1;
  ambientDimension: 3;
  kind: "workPlaneFilledSheet";
  planeFrame: WorkPlaneFrameSnapshot;
  boundaries: ClosedPathBoundary[];
  fillRule: FillRule;
  style: SheetStyle;
  layer: number;
};
```

The exact shape can differ, but it must support:

- multiple closed path boundaries;
- `fillRule: "evenOdd"` for holes/nested boundaries;
- 2D filled regions as codim 0;
- 3D planar filled sheets as codim 1;
- style/layer/name;
- future conversion from selected concatenated paths.

Important:

- Use copy-on-create semantics later.
- Do not store live references to source paths as the filled object's boundary.
- Boundary paths are committed geometry data.

## Validation requirements

Add validation helpers.

Required:

- at least one boundary;
- each boundary has at least one segment;
- each boundary is closed:
  - final endpoint matches initial endpoint within tolerance;
- adjacent segment endpoints match within tolerance;
- all coordinates finite;
- `fillRule` is valid;
- style/layer/name valid according to existing model rules.

For 2D filled regions:

- ambient dimension is 2;
- codim is 0;
- all boundary points have `z = 0` or are normalized/rejected consistently with existing 2D policy.

For 3D work-plane-filled sheets:

- ambient dimension is 3;
- codim is 1;
- plane frame is finite and orthonormal;
- all boundary points lie on the stored plane within tolerance;
- local 2D coordinates can be computed for boundary points.

Do not attempt full robust self-intersection validation in this phase.

For `evenOdd`, self-intersections may still be visually meaningful in SVG/TikZ, but malformed/non-finite geometry must be rejected.

## Style model

If `RegionStyle` does not exist, introduce it with fields analogous to sheet style:

- fill color;
- fill opacity;
- stroke color;
- stroke opacity;
- stroke width;
- optional line style.

For 3D filled sheets, reuse `SheetStyle` if appropriate.

## Tests

Add focused tests:

1. Valid 2D filled region with one closed boundary validates.
2. Valid 2D filled region with two closed boundaries and `evenOdd` validates.
3. 2D open boundary rejected.
4. 2D non-finite boundary rejected.
5. 2D nonzero z rejected or normalized according to policy.
6. Valid 3D work-plane-filled sheet with one closed boundary validates.
7. Valid 3D work-plane-filled sheet with multiple boundaries and `evenOdd` validates.
8. 3D non-planar boundary rejected.
9. Invalid fill rule rejected.
10. Empty boundary list rejected.
11. Save/load round-trip if persistence updated.
12. Existing polygon sheet / concatenated path validation not regressed.

## Documentation

Update docs:

- 2D filled regions are codim 0 strata;
- 3D work-plane-filled sheets are codim 1 strata;
- boundaries are closed paths made from line/cubic segments;
- multiple boundaries are supported;
- `evenOdd` fill rule is supported;
- boundaries are copied geometry, not live references.

## Report after implementation

Please report:

- files modified;
- chosen data model;
- fill rule representation;
- validation policy;
- 2D/3D distinction;
- save/load handling;
- tests added/updated;
- test results;
- build results;
- limitations.
