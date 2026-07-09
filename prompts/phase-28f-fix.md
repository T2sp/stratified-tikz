# Phase 28F Fix Prompt: Complete the Preview work-plane overlay editor

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

Do not treat lint as a required gate if the repository still has existing repo-wide lint debt.

## Context

You are working on the StratifiedTikZ project.

Phase 28F adds:

- a 3D-only work-plane overlay near the SVG/PGF Preview left-bottom;
- active work-plane local polar coordinate input for Add coordinate / Add point;
- active work-plane origin reference display.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.
- One Low-priority issue remains.

## Medium issue

The Preview work-plane overlay is not yet the full work-plane editor required for Phase 28F.

Current state:

- The overlay is 3D-only and positioned correctly.
- It exposes preset/fixed plane controls and existing-point picking.
- But the full required work-plane setup editor is still split:
  - `Origin + normal` controls remain in the old toolbar panel.
  - `Custom 3 points` controls remain in the old toolbar panel.
  - The required method order is not reflected in the overlay.
  - `Origin + normal` still uses raw normal vector `x/y/z` fields instead of `theta/phi` plus a normal-vector preview.

Review locations:

```text
src/App.tsx around the Preview work-plane overlay
src/App.tsx around the older toolbar work-plane panel
```

## Low-priority issue

In the overlay, `Apply` for point picking is enabled whenever point-picking is active.

It should be enabled only after exactly 3 picks.

The older toolbar correctly uses something like:

```ts
workPlanePointPickingCount(...) === 3
```

The overlay should match that behavior.

## Goal

Update the Preview work-plane overlay so it becomes the complete 3D work-plane editor required by Phase 28F.

Required behavior:

1. The Preview overlay, not the old toolbar panel, should expose the full 3D work-plane setup editor.
2. Setup methods must be listed in this order:

```text
Pick 3 existing points
Origin + normal vector
Custom 3 points
```

3. `Origin + normal vector` controls must be available in the Preview overlay.
4. `Custom 3 points` controls must be available in the Preview overlay.
5. `Origin + normal vector` should use `theta` / `phi` normal input with a small normal-vector preview, not raw normal `x/y/z` fields.
6. Point-picking `Apply` must be disabled until exactly 3 picks are available.
7. Preserve:
   - 3D-only overlay behavior;
   - 2D hidden/reset behavior;
   - local polar input behavior for Add coordinate / Add point;
   - UI-only overlay state;
   - save/load behavior;
   - TikZ export behavior;
   - existing work-plane geometry semantics.

## Scope

This is a targeted Phase 28F fix.

Implement:

- complete work-plane editor controls inside the Preview overlay;
- method order update;
- Origin + normal vector method with normal `theta/phi`;
- small normal-vector preview;
- Custom 3 points controls in the overlay;
- point-picking Apply enablement fix;
- tests.

Do not implement:

- new work-plane model semantics;
- live coordinateRef work planes;
- new camera model;
- new TikZ export behavior;
- broad toolbar redesign;
- new dependencies.

Do not change:

- active work-plane local polar input semantics;
- Add coordinate / Add point local polar conversion;
- existing work-plane save/load format;
- current work-plane frame construction math except for normal theta/phi conversion;
- SVG preview rendering beyond overlay UI;
- TikZ generation;
- inline/standalone formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect current overlay and old toolbar controls

Inspect:

```text
src/App.tsx
src/ui/*
src/geometry/workPlane.ts
src/model/*
tests related to work-plane UI
```

Find:

- Preview work-plane overlay controls around the current left-bottom overlay implementation.
- Older toolbar/panel controls for:
  - Origin + normal;
  - Custom 3 points.
- Existing handlers/state for:
  - preset/fixed plane selection;
  - point picking;
  - origin + normal input;
  - custom 3 points input;
  - Apply/Reset behavior.

The fix should move/reuse functionality into the Preview overlay instead of duplicating divergent logic.

## 2. Overlay method order

The overlay should present methods in exactly this order:

```text
Pick 3 existing points
Origin + normal vector
Custom 3 points
```

This is the required order.

Use tabs, segmented controls, radio cards, or an accordion. Choose the compact UI that best fits the overlay.

Requirements:

- method selection is clear;
- only relevant controls for the selected method are shown;
- current method state is visible;
- keyboard/ARIA labels are reasonable.

## 3. Pick 3 existing points method

The overlay already has point picking, but polish/fix it.

Requirements:

- can pick existing point strata and coordinate anchors if current work-plane picking supports both;
- shows count:

```text
0 / 3 selected
1 / 3 selected
2 / 3 selected
3 / 3 selected
```

- lists selected targets if space allows;
- `Apply` disabled unless exactly 3 picks exist;
- `Clear picks` or equivalent available;
- invalid/collinear selections rejected with status;
- 2D mode hides/resets overlay state.

Low-priority review fix:

```text
Apply must be enabled only when workPlanePointPickingCount(...) === 3.
```

## 4. Origin + normal vector method

Move/add this method into the Preview overlay.

### Origin controls

Origin should support the same origin entry behavior as the old toolbar panel:

- direct numeric/symbolic xyz if supported;
- pick existing point/coordinate anchor if already supported;
- current preview shown if helpful.

Keep behavior consistent with existing old panel.

### Normal vector input

Replace raw normal x/y/z fields with theta/phi controls.

Use spherical coordinates.

Preferred convention:

```text
theta = polar angle from +z axis, in degrees
phi   = azimuth angle in xy plane from +x axis, in degrees

normal = (
    sin(theta) * cos(phi),
    sin(theta) * sin(phi),
    cos(theta)
)
```

If the project already uses a different convention for normal vectors, keep the project convention but label it unambiguously.

Important:

- label these controls `Normal θ` and `Normal φ` to avoid confusion with camera theta/phi;
- use sliders plus numeric input;
- numeric input should allow temporary invalid drafts if using the shared lenient numeric input pattern;
- normalized normal vector must be finite and nonzero.

### Normal preview

Add a small normal-vector preview next to the theta/phi controls.

MVP preview:

- small SVG or canvas-like component;
- shows x/y/z axes;
- shows the normal vector arrow;
- optionally shows theta/phi arcs;
- updates as theta/phi changes.

Requirements:

- compact enough for overlay;
- no heavy 3D engine;
- finite rendering for valid theta/phi;
- hidden/placeholder if theta/phi draft invalid.

### Basis construction

Given origin and normal, construct the plane basis deterministically.

Preferred rule:

1. Project world +x onto the plane and normalize it as plane x.
2. If world +x is nearly parallel to normal, use world +y.
3. Set plane y using the existing handedness convention, e.g.:

```text
plane y = normal × plane x
```

or the project’s existing rule.

Requirements:

- generated frame is orthonormal/valid according to existing frame validation;
- edge cases such as normal near +x handled;
- tests cover expected normal and basis validity.

## 5. Custom 3 points method

Move/add the old Custom 3 points controls into the Preview overlay.

Requirements:

- supports entering three point coordinates directly;
- preserves existing symbolic/direct input behavior;
- validates finite points;
- rejects collinear/invalid triples;
- creates a work-plane frame using existing helper;
- UI is compact inside overlay;
- old toolbar panel should not be the only way to use this method.

If the old toolbar panel remains temporarily for backward compatibility, it must not be the only implementation path and must not contradict the overlay. Prefer removing or de-emphasizing old duplicate controls after overlay is complete.

## 6. Old toolbar work-plane panel cleanup

After the overlay becomes complete:

- avoid duplicated competing work-plane editors.
- Either:
  - remove old toolbar work-plane controls; or
  - make old toolbar button open/focus the new Preview overlay.

Do not leave users with two divergent work-plane editors where one has old raw x/y/z normal fields and the other has theta/phi.

If removal is risky, hide/deprecate the old controls and route to overlay.

## 7. Preserve active work-plane local polar input

Review says this is already correct:

- Add coordinate/Add point expose Cartesian/Polar only for 3D work-plane-local direct input.
- Numeric polar conversion uses degrees and maps to local `a/b`.
- Symbolic polar input is preserved as local expressions.
- Direct coordinate fields remain text inputs and are not snapped.

Do not regress this.

Add a regression test if needed.

## 8. Preserve 2D hidden/reset behavior

Review says this is already correct:

- overlay is 3D-only;
- 2D mode hides/resets overlay and local-polar UI state.

Do not regress this.

Tests should cover:

- switching to 2D hides overlay;
- switching to 2D clears incompatible work-plane overlay state;
- 2D Add coordinate/Add point does not show confusing work-plane-local polar UI.

## 9. Tests

Add focused tests.

### Overlay completeness tests

1. Preview work-plane overlay lists setup methods in this order:

```text
Pick 3 existing points
Origin + normal vector
Custom 3 points
```

2. Origin + normal controls are present inside the Preview overlay.

3. Custom 3 points controls are present inside the Preview overlay.

4. Old toolbar raw normal x/y/z editor is not the only available Origin + normal UI. If removed/hidden, test that it is not shown.

### Pick 3 existing points tests

5. Apply disabled with 0 picks.

6. Apply disabled with 1 pick.

7. Apply disabled with 2 picks.

8. Apply enabled with exactly 3 picks.

9. Applying with 3 valid picks creates/updates the work plane.

10. Invalid/collinear picks rejected.

11. Picked coordinate anchors still work if current picking supports them.

### Origin + normal theta/phi tests

12. `theta=0`, any `phi`, gives normal approximately `(0,0,1)`.

13. `theta=90`, `phi=0`, gives normal approximately `(1,0,0)`.

14. `theta=90`, `phi=90`, gives normal approximately `(0,1,0)`.

15. Frame basis is valid/orthonormal.

16. Edge case normal near world +x uses fallback basis and validates.

17. Invalid theta/phi draft disables Apply or shows warning without mutating diagram.

18. Normal-vector preview renders and updates when theta/phi changes.

### Custom 3 points tests

19. Custom 3 point input in overlay creates valid work plane.

20. Invalid collinear custom points rejected.

21. Existing custom 3 point behavior preserved.

### Regression tests

22. Add coordinate/Add point work-plane-local polar input still works.

23. 2D hides overlay and polar UI.

24. Work-plane overlay state is UI-only and not saved to Diagram.

25. TikZ output unchanged by overlay open/closed state.

26. Save/load behavior unchanged.

## 10. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Open a 3D diagram.
2. Open the Preview work-plane overlay at left-bottom.
3. Confirm method order:
   - Pick 3 existing points;
   - Origin + normal vector;
   - Custom 3 points.
4. Use Pick 3 existing points:
   - confirm Apply disabled until 3 picks.
5. Use Origin + normal:
   - set Normal θ / Normal φ;
   - confirm mini preview updates;
   - Apply and confirm work plane changes.
6. Use Custom 3 points:
   - enter valid points;
   - Apply.
7. Switch to 2D:
   - confirm overlay hidden/reset.
8. Confirm old toolbar panel no longer contains confusing stale normal x/y/z-only workflow, or routes to overlay.

## 11. Preserve existing behavior

Do not regress:

- existing preset/fixed plane controls;
- point picking;
- coordinate anchor picking;
- active work-plane local polar input;
- 2D hidden behavior;
- work-plane save/load;
- cursor/direct creation;
- SVG preview;
- TikZ export;
- undo/redo;
- inline no-blank-lines;
- 4-space indentation.

## 12. Verification

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

## 13. Report after implementation

Please report:

- files modified;
- overlay method order;
- old toolbar panel cleanup/routing;
- Origin + normal theta/phi convention;
- normal-vector preview implementation;
- basis construction rule;
- Pick 3 Apply enablement fix;
- Custom 3 points overlay behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
