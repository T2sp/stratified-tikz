# Phase 13F Fix Prompt: Align edited camera theta/phi with tikz-3dplot

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

## Context

You are working on the StratifiedTikZ project.

Phase 13F implemented camera controls UI using `theta` / `phi` notation intended to match `tikz-3dplot`.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

Medium issue:

- Edited `theta` / `phi` camera states do not match `tikz-3dplot`'s `\tdplotsetmaincoords{theta}{phi}` transform.
- The current implementation in `src/geometry/projection.ts` uses a different projection basis.
- The installed `tikz-3dplot.sty` defines the main-coordinate projected basis as:

```text
x = (cos(phi), -cos(theta) * sin(phi))
y = (sin(phi),  cos(theta) * cos(phi))
z = (0,         sin(theta))
```

The current implementation reportedly uses something like:

```text
x = ( cos(phi),  sin(phi) * sin(theta))
y = (-sin(phi),  cos(phi) * sin(theta))
z = (0,          cos(theta))
```

This makes the UI's `theta` / `phi` notation misleading and will make SVG preview / TikZ export alignment fail in later phases.

## Goal

Fix the angle-derived camera basis so that edited camera states match `tikz-3dplot` main-coordinate projection.

Specifically, update `cameraBasisFromTikz3dplotAngles` or the equivalent helper so that:

```text
x = (cos(phi), -cos(theta) * sin(phi))
y = (sin(phi),  cos(theta) * cos(phi))
z = (0,         sin(theta))
```

where `theta` and `phi` are converted from degrees to radians.

Preserve the explicit initial/default camera behavior so that Reset still returns to the legacy pre-camera display.

## Scope

This is a targeted Phase 13F fix.

Do not implement:

- Phase 13G camera-aware cursor creation;
- Phase 13H camera persistence;
- Phase 13I TikZ camera export;
- perspective projection;
- new camera UI controls beyond what is required for this fix;
- new geometry features;
- broad refactors;
- new dependencies.

Do not change:

- diagram data model;
- save/load format;
- TikZ output semantics;
- SVG rendering semantics except the corrected edited-camera projection;
- work-plane geometry;
- creation behavior;
- layer/filter behavior.

## 1. Fix angle-derived camera basis

Inspect:

- `src/geometry/projection.ts`;
- `cameraBasisFromTikz3dplotAngles`;
- any camera/preset helpers added in Phase 13E/13F;
- tests for camera basis/projection.

Update the angle-derived camera basis so that it matches `tikz-3dplot`:

```ts
const theta = degToRad(thetaDeg);
const phi = degToRad(phiDeg);

const xVector = {
  x: Math.cos(phi),
  y: -Math.cos(theta) * Math.sin(phi),
};

const yVector = {
  x: Math.sin(phi),
  y: Math.cos(theta) * Math.cos(phi),
};

const zVector = {
  x: 0,
  y: Math.sin(theta),
};
```

Adjust names/types to match the existing code.

Important:

- Use `thetaDeg` / `phiDeg` in the public camera model.
- Do not silently reinterpret them as yaw/pitch.
- Do not swap theta and phi.
- Do not use the old non-`tikz-3dplot` basis for edited camera states.

## 2. Preserve initial/default camera reset behavior

The review says that Reset currently returns to the legacy initial display via explicit `INITIAL_CAMERA_3D.projectionBasis`.

Preserve this.

Required:

- `INITIAL_CAMERA_3D` or equivalent should still match the pre-camera default display as closely as before.
- Reset to initial should still use that explicit initial/default basis if needed.
- Fixing `cameraBasisFromTikz3dplotAngles` must not force the initial/reset display to change unless the project intentionally updates the default.
- If initial camera uses a custom `projectionBasis`, keep it.
- Edited camera states should use the corrected `tikz-3dplot`-aligned basis.

In other words:

```text
Reset to initial:
  preserve old/default display.

User-edited theta/phi camera:
  use tikz-3dplot basis.
```

## 3. Update presets if needed

Inspect camera presets:

- top;
- front;
- side;
- isometric;
- initial/default.

Update any preset expectations that were based on the old incorrect basis.

Requirements:

- presets should remain finite and valid;
- preset labels should still make sense;
- initial/default preset should preserve legacy display;
- angle-based presets should use the corrected `tikz-3dplot` interpretation.

If a preset is difficult to name precisely after the basis correction, keep behavior simple and document it in tests/report.

## 4. Update tests

Add or update focused tests.

Required tests:

1. `cameraBasisFromTikz3dplotAngles` matches `tikz-3dplot` formulas.

For representative angles, assert:

```text
x = (cos(phi), -cos(theta) * sin(phi))
y = (sin(phi),  cos(theta) * cos(phi))
z = (0,         sin(theta))
```

Use a small numeric tolerance.

2. Test a nontrivial pair such as:

```text
theta = 60
phi = 30
```

or another non-axis-aligned pair so sign/swapping mistakes are caught.

3. Test a simple pair such as:

```text
theta = 90
phi = 0
```

or another easy-to-reason value.

4. Reset to initial still uses/preserves `INITIAL_CAMERA_3D.projectionBasis`.

5. Camera controls still validate finite theta/phi/zoom/pan values.

6. Presets remain valid.

7. Existing tests for camera input validation, reset, preview override immutability, and undo history separation still pass.

Avoid weakening tests to match the incorrect old formula.

## 5. Documentation/comments

If there is a comment near the camera-basis helper, update it to explicitly say that the basis follows `tikz-3dplot` main-coordinate projection.

Include the formula in a comment if helpful:

```text
x = (cos phi, -cos theta sin phi)
y = (sin phi,  cos theta cos phi)
z = (0,        sin theta)
```

Do not add large unrelated documentation.

## 6. Preserve existing behavior

Do not regress:

- camera controls visibility in 3D;
- hidden/disabled camera controls in 2D;
- invalid numeric input rejection;
- nonpositive zoom rejection;
- reset to initial/default display;
- camera state separation from diagram geometry/history;
- SVG preview rendering generally;
- work-plane preview;
- cursor/direct creation;
- selection;
- layer filtering;
- save/load;
- undo/redo;
- TikZ generation.

## 7. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open a 3D diagram.
2. Change `theta`.
3. Preview changes.
4. Change `phi`.
5. Preview changes.
6. Reset to initial.
7. Display returns to the legacy/default arrangement.
8. Try presets.
9. Presets produce finite sensible views.
10. Switch to 2D.
11. Camera controls remain hidden/disabled.
12. Existing creation/selection still works.

## 8. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## 9. Report after implementation

Please report:

- files modified;
- root cause of the theta/phi mismatch;
- corrected `tikz-3dplot` basis formula;
- how `INITIAL_CAMERA_3D.projectionBasis` / reset behavior was preserved;
- which presets were updated, if any;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
