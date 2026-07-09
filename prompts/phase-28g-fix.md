# Phase 28G Fix Prompt: Clarify normal-vector theta/phi convention in the Preview work-plane panel

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

Phase 28G improves the 3D work-plane setup UX.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

The Preview work-plane panel’s `Origin + normal vector` UI exposes:

```text
Normal θ
Normal φ
```

but does not clearly define the angle convention for users.

The implementation uses spherical coordinates:

```text
θ = polar angle from +z
φ = azimuth in the xy-plane from +x toward +y
```

This is visible in implementation logic, for example in `src/ui/workPlaneControls.ts`, but it is not sufficiently clear in the user-facing UI.

The normal-vector preview/readout helps, but the convention remains ambiguous enough to fail the review checklist.

## Goal

Clarify the `Origin + normal vector` theta/phi convention in the Preview work-plane panel without changing the underlying math.

Required convention:

```text
Normal θ:
  polar angle from +z, in degrees

Normal φ:
  azimuth in the xy-plane from +x toward +y, in degrees
```

Required behavior:

1. The UI must explicitly explain what `θ` means.
2. The UI must explicitly explain what `φ` means.
3. The explanation should be visible or easily discoverable near the `Origin + normal vector` controls.
4. The underlying normal-vector math must remain unchanged.
5. Existing work-plane setup behavior and tests must remain valid.
6. Add focused UI/test coverage.
7. Run `npm test`, `npm run build`, and `git diff --check`.

## Scope

This is a targeted Phase 28G UX/documentation fix.

Implement:

- user-facing angle convention text in the Preview work-plane panel;
- optional tooltip/help text for the theta/phi inputs;
- focused tests.

Do not implement:

- new work-plane setup methods;
- new normal-vector math;
- changed theta/phi convention;
- new camera behavior;
- new TikZ export behavior;
- broad UI redesign;
- new dependencies.

Do not change:

- method order:
  1. Pick 3 existing points;
  2. Origin + normal vector;
  3. Custom 3 points.
- normal-vector conversion math;
- deterministic basis construction;
- normal-vector preview behavior except adding labels/help if useful;
- 2D hidden behavior;
- save/load behavior;
- TikZ generation;
- inline/standalone formatting.

## 1. Inspect current work-plane UI

Inspect:

```text
src/App.tsx
src/ui/workPlaneControls.ts
src/ui/*
tests related to work-plane controls
```

Find:

- Preview work-plane overlay/panel;
- `Origin + normal vector` method controls;
- `Normal θ` input;
- `Normal φ` input;
- normal-vector preview/readout;
- tests for method order and theta/phi conversion.

The review points to:

```text
src/App.tsx around the Preview work-plane panel
src/ui/workPlaneControls.ts around the theta/phi conversion
```

## 2. Add clear convention text near controls

Add concise user-facing help text near the theta/phi controls.

Suggested text:

```text
Angle convention: θ is measured from +z. φ is measured in the xy-plane from +x toward +y.
```

or:

```text
θ: polar angle from +z.
φ: xy-plane azimuth from +x toward +y.
Angles are in degrees.
```

Preferred placement:

- directly below or next to the `Normal θ` / `Normal φ` controls;
- or inside a compact help/tooltip icon next to the `Origin + normal vector` heading;
- or both, if not cluttering.

The text should be visible enough for first-time users. A tooltip alone is acceptable only if the tooltip trigger is obvious and accessible.

## 3. Improve labels/tooltips

Keep the input labels:

```text
Normal θ
Normal φ
```

but add accessible descriptions.

For example:

```tsx
<label>
  Normal θ
  <span className="help-text">polar angle from +z, degrees</span>
</label>
```

or:

```tsx
<input aria-describedby="normal-theta-help" ... />
<div id="normal-theta-help">Polar angle from +z, in degrees.</div>
```

For `φ`:

```text
Azimuth in xy-plane from +x toward +y, in degrees.
```

Requirements:

- screen readers can access the explanation;
- visual users can discover it easily;
- no layout break in compact overlay.

## 4. Optional normal preview annotation

If easy, add small labels to the normal-vector preview:

```text
+z
+x
+y
θ
φ
```

This is optional, because the Medium issue is convention clarity, not preview rendering.

If adding labels makes the preview cluttered, skip this and rely on text.

## 5. Do not change the math

Do not change the existing theta/phi conversion.

Expected formula remains:

```text
normal = (
  sin(θ) * cos(φ),
  sin(θ) * sin(φ),
  cos(θ)
)
```

with degrees converted to radians internally as current code already does.

Existing tests should still pass:

```text
θ = 0      => normal ≈ (0, 0, 1)
θ = 90 φ=0   => normal ≈ (1, 0, 0)
θ = 90 φ=90  => normal ≈ (0, 1, 0)
```

## 6. Tests

Add focused UI/test coverage.

### UI text tests

1. Preview work-plane panel `Origin + normal vector` method includes text explaining:

```text
θ is measured from +z
```

2. The panel includes text explaining:

```text
φ is measured in the xy-plane from +x toward +y
```

3. The panel indicates angles are in degrees.

4. `Normal θ` input has accessible description or tooltip containing `+z`.

5. `Normal φ` input has accessible description or tooltip containing `+x` and `+y`.

If tests are string-based, keep wording stable enough.

### Regression math tests

6. Existing theta/phi normal conversion tests still pass.

7. Add one explicit test if not already present:

```text
theta=90, phi=0 => +x direction
```

8. Add one explicit test if not already present:

```text
theta=90, phi=90 => +y direction
```

### Layout/regression tests

9. Method order remains:

```text
Pick 3 existing points
Origin + normal vector
Custom 3 points
```

10. Normal-vector preview still renders.

11. 2D mode still hides the work-plane overlay.

12. Work-plane apply behavior unchanged.

13. TikZ output unaffected by overlay help text.

## 7. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Open a 3D diagram.
2. Open the Preview work-plane overlay.
3. Select `Origin + normal vector`.
4. Confirm the UI clearly states:
   - `θ` is measured from `+z`;
   - `φ` is measured in the `xy` plane from `+x` toward `+y`;
   - angles are degrees.
5. Set `θ=0`; confirm preview normal points along +z.
6. Set `θ=90, φ=0`; confirm preview normal points along +x.
7. Set `θ=90, φ=90`; confirm preview normal points along +y.
8. Apply a work plane; confirm existing behavior is unchanged.

## 8. Preserve existing behavior

Do not regress:

- work-plane method order;
- Pick 3 existing points;
- Origin + normal vector math;
- Custom 3 points;
- coordinate-anchor picking;
- normal-vector preview;
- 2D hidden behavior;
- Add coordinate/Add point local polar input;
- save/load;
- TikZ export;
- undo/redo;
- inline no-blank-lines;
- 4-space indentation.

## 9. Verification

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

## 10. Report after implementation

Please report:

- files modified;
- exact convention text added;
- tooltip/accessibility behavior;
- confirmation that theta/phi math was unchanged;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
