# Phase 27 / 26 Fix Prompt: Allow coordinate-anchor picking for work-plane setup and 3-point arc cursor creation

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

Also run:

```bash
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

## Context

You are working on the StratifiedTikZ project.

Coordinate anchors are now a first-class feature:

- `Add coordinate` creates global TikZ coordinate anchors distinct from visible point strata.
- Coordinate anchors are not layer-bound.
- Coordinate anchors are shown in the Preview when `Coordinates: Show` is enabled.
- Coordinate anchors are preview-only markers and export as `\coordinate`.
- Coordinate anchors can be referenced from supported geometry fields via `coordinateRef`.
- Direct input already supports coordinate anchors in several places.
- Cursor input has been progressively updated to preserve coordinate references instead of silently copying numeric preview points.

Current user request:

1. During work-plane setup, users should be able to pick coordinate anchors as well as point strata.
2. During arc-segment cursor creation, the current workflow picks three points:
   - start point;
   - center point;
   - end point.

   Coordinate anchors should also be selectable in this 3-point arc cursor workflow.

Current missing behavior:

- Work-plane pick mode supports point strata but not coordinate anchors.
- Arc cursor mode supports point-like picks but does not support coordinate anchors.
- The user wants coordinate anchors to be selectable in these workflows.

## Goal

Implement coordinate-anchor picking in:

1. Work-plane setup / “Pick 3 points for work plane”.
2. Arc-segment cursor input using start / center / end picks.

Required behavior:

- Coordinate anchors can be clicked in these modes when `Coordinates: Show` is enabled.
- Coordinate anchors are not pickable when `Coordinates: Hide` is enabled.
- Coordinate anchors keep their usual high hit-test priority over layer-bound geometry.
- Picking a coordinate anchor should use the anchor’s current resolved preview position.
- For arc creation, coordinate anchors should be stored as `coordinateRef` sources in supported arc fields whenever TikZ export can preserve them.
- If a particular arc field cannot preserve coordinateRef in TikZ, the UI/validation must reject it with a clear message rather than silently copying numeric coordinates.
- Work-plane setup may capture a frame snapshot from selected anchor positions; it does not need to create live references to anchors unless the existing work-plane model already supports that safely.
- Existing point-based workflows must continue to work.

## Scope

This is a targeted work-plane and arc cursor input fix.

Implement:

- coordinate-anchor target support in work-plane point picking;
- coordinate-anchor target support in arc cursor picking;
- model/export/validation updates for arc coordinateRef support;
- UI status/highlighting updates;
- tests.

Do not implement:

- fully live coordinate-reference work planes unless already supported;
- new coordinate anchor model fields;
- new arc geometry model unrelated to coordinateRef support;
- broad hit-testing rewrite;
- new TikZ export modes beyond what is needed for reference-preserving arcs;
- new dependencies.

Do not change:

- Add coordinate behavior;
- direct input coordinateRef behavior;
- coordinate deletion/detach;
- layer translation detach;
- coordinate multi-selection/translation;
- existing work-plane setup from point strata;
- existing arc cursor creation from ordinary points/background;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## Part 1: Work-plane setup should accept coordinate anchors

### 1. Inspect current work-plane picking flow

Inspect:

- work-plane setup UI;
- “Pick 3 points for work plane” mode;
- SVG/PGF Preview click handling;
- hit-testing for point strata and coordinate anchors;
- work-plane frame construction helpers;
- selection/highlight state for picked work-plane points.

Likely files include:

- `src/App.tsx`;
- `src/rendering/SvgDiagram.tsx`;
- work-plane UI/components;
- geometry/work-plane helpers;
- coordinate anchor preview/hit-test helpers.

Find where the picker currently filters to point strata only.

### 2. Add coordinate-anchor pick targets

Work-plane picking should accept:

```ts
type WorkPlanePickTarget =
  | { kind: "pointStratum"; id: string; position: Vec3 }
  | { kind: "coordinateAnchor"; id: string; position: Vec3 }
  | ...
```

or equivalent.

Requirements:

- coordinate anchor position is resolved from current coordinate anchor state;
- support global symbolic anchors and work-plane-local anchors through their finite preview positions;
- reject coordinate anchors with non-finite preview positions;
- preserve existing point pick behavior;
- show picked coordinate anchor name in the work-plane picking UI/status if possible.

### 3. Frame construction policy

MVP policy:

```text
The work-plane frame captures a snapshot of the three picked positions.
```

If the user later moves a coordinate anchor, the work-plane does not automatically change unless the project already has live work-plane references.

This is safer and matches current frame snapshot behavior.

Requirements:

- three picked positions must be finite;
- points must be non-collinear / define a valid plane according to existing validation;
- coordinate anchors can be mixed with point strata:
  - point + coordinate + coordinate;
  - coordinate + coordinate + coordinate;
- duplicate picked targets rejected or handled according to existing point-pick policy;
- selected coordinate anchors highlighted while picking if current work-plane picking highlights points.

### 4. Show/hide behavior

When `Coordinates: Hide`:

- coordinate anchors should not be pickable for work-plane setup;
- underlying geometry should receive clicks as usual.

When `Coordinates: Show`:

- coordinate anchors should be pickable;
- coordinate anchor hit priority should be respected.

### 5. Work-plane tests

Add tests:

1. Work-plane picker accepts three point strata as before.

2. Work-plane picker accepts three coordinate anchors.

3. Work-plane picker accepts a mix of point strata and coordinate anchors.

4. Coordinate anchors with finite global previews produce a valid work-plane frame.

5. Work-plane-local coordinate anchors resolve to finite preview positions and can be picked.

6. Hidden coordinate anchors are not pickable.

7. Moving an anchor after creating the work plane does not mutate the stored work-plane frame, if using snapshot policy.

8. Invalid collinear anchor picks are rejected.

9. Duplicate anchor picks are rejected or handled according to existing policy.

10. Work-plane pick UI/status shows coordinate anchor identity if supported.

## Part 2: Arc segment cursor workflow should accept coordinate anchors

### 6. Inspect current arc cursor creation flow

Inspect:

- Add path / Arbitrary path cursor creation;
- arc segment cursor workflow;
- start-center-end pick state;
- click target payload from SVG/PGF Preview;
- arc validation;
- arc TikZ export;
- coordinateRef support boundary from Phase 26C;
- direct input arc behavior if any.

The current workflow selects:

```text
start point
center point
end point
```

Coordinate anchors should be usable in that workflow.

### 7. Add coordinate-anchor target identity to arc picks

Arc cursor picking must receive coordinate anchor target identity, not just numeric preview points.

Suggested pick target:

```ts
type ArcPickTarget =
  | { kind: "canvas"; point: Vec3; source: CoordinateSource }
  | { kind: "pointStratum"; id: string; point: Vec3; source?: ... }
  | { kind: "coordinateAnchor"; id: string; point: Vec3; source: CoordinateRefSource };
```

Requirements:

- clicking coordinate anchor `A` for a supported pick creates a coordinateRef source to `A`;
- clicking background creates ordinary numeric/global/work-plane-local coordinate as before;
- clicking point stratum preserves existing behavior;
- coordinate marker clicks should not select the coordinate anchor while in arc creation mode; they should feed the arc pick.

### 8. Arc coordinateRef support policy

The user specifically wants coordinate anchors in the start-center-end arc workflow.

Implement the strongest support that can be exported correctly.

#### Required model behavior

The arc should be able to preserve coordinateRef sources for the three user-picked anchors when supported:

```text
start = coordinateRef(A)
center = coordinateRef(O)
end = coordinateRef(B)
```

Preview should resolve from current anchor positions.

Moving `A`, `O`, or `B` should update the arc preview.

#### TikZ export policy

Do not silently numericize accepted coordinateRef fields.

Choose and implement one of the following:

### Preferred: reference-preserving arc export

For 2D arcs and work-plane-local 3D arcs where possible, export an arc using coordinate anchors.

For example, in 2D TikZ, a center-referenced arc can be exported using TikZ `calc`/`let` syntax to compute radius and angles from coordinate anchors.

Conceptual output:

```tex
\path let
    \p1 = ($(A)-(O)$),
    \p2 = ($(B)-(O)$),
    \n1 = {veclen(\x1,\y1)},
    \n2 = {atan2(\y1,\x1)},
    \n3 = {atan2(\y2,\x2)}
in
    \draw (A) arc[start angle=\n2, end angle=\n3, radius=\n1];
```

The exact syntax should match existing project TikZ style and should be validated with tests. If `calc` is required, emit/include:

```tex
\usetikzlibrary{calc}
```

according to existing library-handling policy.

For 3D/work-plane arcs, if the arc is emitted inside a `canvas is plane` scope and the references can be interpreted in the same plane, preserve `(A)`, `(O)`, `(B)` in that local 2D scope where safe.

### Acceptable fallback only when explicit

If reference-preserving arc export is not implemented for some arc modes:

- reject coordinateRef in those unsupported fields at creation/validation time; or
- use a clear explicit fallback comment and numeric preview only if the user’s workflow still needs to proceed and the project has an established explicit fallback policy.

However, the user requested coordinate-anchor selection for start/center/end, so at minimum implement support for the common 2D arc case and for 3D work-plane arcs where feasible.

Do not accept refs and silently export numeric cubic approximations without warning.

### 9. Update validation/support boundary

CoordinateRef support boundary must match export support.

If start/end/center are now supported:

- validation should accept coordinateRef in those fields;
- save/load should preserve them;
- TikZ should preserve or explicitly fallback.

If any field remains unsupported in some context:

- validation should reject it with a clear error before export.

Update prior Phase 26C restrictions that rejected arc centers if the new export support is implemented.

### 10. Arc cursor UI/status behavior

During the three-pick workflow, show picked coordinate anchors clearly:

```text
Start: coordinate A
Center: coordinate O
End: coordinate B
```

If user clicks a coordinate anchor for an unsupported pick:

```text
Coordinate anchors are not supported for this arc field in the current mode.
```

Avoid silent numeric copy.

### 11. Arc tests

Add tests.

#### Cursor creation tests

1. Arc cursor start pick from coordinate anchor creates coordinateRef start.

2. Arc cursor center pick from coordinate anchor creates coordinateRef center if supported.

3. Arc cursor end pick from coordinate anchor creates coordinateRef end.

4. Mixed picks work:
   - start coordinate anchor;
   - center point stratum/background;
   - end coordinate anchor.

5. Hidden coordinate anchors are not pickable for arc cursor creation.

6. Clicking background still creates ordinary numeric arc point.

7. Clicking point stratum preserves existing behavior.

#### Preview tests

8. Moving start anchor updates arc preview.

9. Moving center anchor updates arc preview.

10. Moving end anchor updates arc preview.

11. Non-collinear/valid arc checks still apply.

12. Degenerate arc with coincident start/center/end is rejected.

#### TikZ tests

13. 2D arc with start/center/end coordinateRefs exports `(A)`, `(O)`, `(B)` references or reference-preserving calc syntax.

14. Required libraries such as `calc` are emitted if used.

15. Inline output has no blank lines.

16. 4-space indentation preserved.

17. No NaN/Infinity.

18. If 3D/work-plane arc ref support is implemented, test that references are preserved or explicit fallback comment appears.

19. If some arc mode rejects coordinateRefs, test the clear validation error.

#### Save/load tests

20. Save/load round-trips arc coordinateRefs.

21. Missing coordinate anchor in arc ref fails validation/load.

22. Deleting a referenced coordinate detaches arc refs according to existing detach policy if arc refs are supported.

#### Regression tests

23. Existing numeric arc cursor creation unchanged.

24. Existing arc TikZ export for numeric arcs unchanged.

25. Existing Add path arbitrary/line coordinate-anchor cursor refs still work.

## Part 3: Shared target-aware cursor input infrastructure

### 12. Avoid duplicated target handling

Work-plane picker, Add point, Add label, Add path, and arc cursor workflows all need target-aware clicks.

If possible, centralize:

```ts
previewClickToCoordinateSource(...)
```

or:

```ts
makeCoordinateSourceFromPreviewTarget(...)
```

Inputs:

```text
target kind
field support policy
current diagram
active work plane
cursor snap settings
```

Outputs:

```text
coordinateRef for coordinate anchor if supported
ordinary coordinate source for background
error for unsupported coordinateRef field
```

This prevents future bugs where direct input supports coordinate anchors but cursor input numericizes them.

### 13. Cursor snap interaction

Policy:

- Coordinate anchor click:
  - creates coordinateRef;
  - snap does not alter the reference.
- Background click:
  - creates ordinary coordinate;
  - snap applies as before.
- Work-plane setup:
  - if picking coordinate anchor, use its current resolved preview position, not snap-modified position.
  - if picking background point for work-plane setup, preserve existing snap policy if any.

## Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

### Work plane

1. Create coordinate anchors A, B, C.
2. Turn on Coordinates: Show.
3. Open Pick 3 points for work plane.
4. Click A, B, C.
5. Confirm work plane is created.
6. Hide coordinates and confirm anchors cannot be picked.
7. Move A after work plane creation and confirm snapshot behavior if chosen.

### Arc

8. Create coordinate anchors A, O, B.
9. Select Add path / Arbitrary path / Arc segment cursor mode.
10. Click A as start.
11. Click O as center.
12. Click B as end.
13. Confirm arc preview appears.
14. Move O.
15. Confirm arc updates if refs are preserved.
16. Generate TikZ.
17. Confirm references are preserved or explicit fallback/rejection policy is followed.

## Preserve existing behavior

Do not regress:

- point-based work-plane setup;
- existing arc cursor creation;
- Add point/Add label coordinate anchor cursor support;
- Add path arbitrary coordinate anchor cursor support;
- direct input coordinateRef workflows;
- coordinate show/hide;
- coordinate selection/multi-selection;
- coordinate deletion/detach;
- layer translation detach;
- work-plane-local symbolic coordinates;
- save/load;
- undo/redo;
- TikZ export;
- inline no-blank-lines.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Optional:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Only treat lint as required if the repository is already lint-clean.

## Report after implementation

Please report:

- files modified;
- work-plane coordinate-anchor picking behavior;
- work-plane snapshot/live policy;
- arc coordinate-anchor picking behavior;
- arc start/center/end coordinateRef support policy;
- TikZ export strategy for reference-preserving arcs;
- unsupported arc mode behavior, if any;
- shared cursor target handling helpers;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
