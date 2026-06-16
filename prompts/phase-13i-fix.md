# Phase 13I Fix Prompt: Align SVG preview and TikZ camera export

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

Phase 13I implemented TikZ camera/export alignment using `tikz-3dplot`-style `thetaDeg` / `phiDeg`.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

Medium issue:

- `src/tikz/generateTikz.ts` exports only `thetaDeg` / `phiDeg`.
- The live SVG projection still prefers `projectionBasis` when present.
- The initial/reset camera has both:
  - `thetaDeg: 13`;
  - `phiDeg: -23`;
  - a legacy `projectionBasis`.
- Therefore the reset/default SVG preview orientation can differ from the exported TikZ orientation.
- Example from review:
  - initial camera previews `{x:2,y:4,z:3}` as approximately `(3.8,4)`;
  - exported `\tdplotsetmaincoords{13}{-23}` projects it near `(0.278,5.024)`.
- This violates Phase 13I's goal that generated TikZ should reflect the current 3D camera/view.

## Goal

Fix Phase 13I camera/export alignment.

SVG preview and TikZ export must use the same `tikz-3dplot` `thetaDeg` / `phiDeg` orientation for current/default/reset 3D cameras.

This includes cameras that still carry a legacy `projectionBasis`.

After the fix:

- the current SVG preview orientation and exported `\tdplotsetmaincoords{theta}{phi}` should agree;
- reset/default camera should not produce a preview/export mismatch;
- users can still reset to a stable initial/default camera;
- no geometry is pre-flattened into 2D for TikZ export.

## Scope

This is a targeted Phase 13I fix.

Do not implement:

- perspective projection;
- new camera UI features;
- full camera redesign;
- new geometry features;
- TikZ import;
- new dependencies.

Do not change:

- diagram geometry;
- work-plane geometry;
- SVG rendering semantics beyond camera orientation alignment;
- TikZ coordinate naming;
- layer-aware TikZ output;
- ordinary 2D TikZ output;
- save/load format unless necessary for camera normalization;
- creation/editing behavior except where camera orientation must be read consistently.

## Required design decision

Choose one clear policy and implement it consistently.

Preferred policy:

- `thetaDeg` / `phiDeg` are the source of truth for 3D camera orientation.
- `projectionBasis` should not override `thetaDeg` / `phiDeg` for live preview when TikZ export uses `thetaDeg` / `phiDeg`.
- Legacy `projectionBasis` should be removed, ignored, or normalized so it cannot create preview/export mismatch.
- Reset/default camera should have `thetaDeg` / `phiDeg` values that reproduce the intended initial/default display as closely as possible.

Alternative acceptable policy:

- keep `projectionBasis` only if the export can derive equivalent `thetaDeg` / `phiDeg` from it reliably and tests prove preview/export alignment.
- If exact derivation is not reliable, do not use this policy.

Do not leave the system in a state where preview uses `projectionBasis` and export uses unrelated `thetaDeg` / `phiDeg`.

## 1. Inspect current camera flow

Inspect:

- `src/model/camera.ts`;
- `INITIAL_CAMERA_3D`;
- any camera preset definitions;
- `src/geometry/projection.ts`;
- camera basis selection logic around `projectionBasis`;
- `cameraBasisFromTikz3dplotAngles`;
- `src/tikz/generateTikz.ts`;
- tests for camera projection/export.

Identify every path where:

- SVG preview chooses a projection basis;
- TikZ export chooses `thetaDeg` / `phiDeg`;
- reset/default camera is constructed;
- camera presets are applied.

## 2. Normalize initial/reset camera behavior

Fix initial/reset camera behavior so preview and TikZ export agree.

Required:

- reset/default preview should be computed from the same `thetaDeg` / `phiDeg` that will be exported;
- reset/default export should use the same `thetaDeg` / `phiDeg` that define preview orientation;
- no stale legacy `projectionBasis` should override this orientation.

If preserving the exact pre-camera legacy display is impossible while staying `tikz-3dplot`-aligned, prefer preview/export alignment and report the small visual change clearly.

However, keep a stable reset-to-initial camera available.

## 3. Handle `projectionBasis`

Update the model/helper behavior for `projectionBasis`.

Acceptable fixes:

### Option A: Remove/stop using `projectionBasis`

- Remove `projectionBasis` from `INITIAL_CAMERA_3D` and any regular camera states.
- Always compute projection basis from `thetaDeg` / `phiDeg`.
- Keep any legacy basis only in tests/docs if needed.

### Option B: Treat `projectionBasis` as deprecated

- Keep the property for backward compatibility if needed.
- Ignore it for live preview whenever `thetaDeg` / `phiDeg` are present.
- Ensure exported TikZ and preview both use `thetaDeg` / `phiDeg`.

### Option C: Normalize imported legacy cameras

- If a camera has `projectionBasis`, normalize it on load/reset to a valid theta/phi camera.
- Do not let stale basis override preview.

Choose the smallest safe option that preserves save/load compatibility.

## 4. Preserve tikz-3dplot basis formula

Do not regress the Phase 13F fix.

Angle-derived camera basis must follow the `tikz-3dplot` main-coordinate projection:

```text
x = (cos(phi), -cos(theta) * sin(phi))
y = (sin(phi),  cos(theta) * cos(phi))
z = (0,         sin(theta))
```

where `theta` and `phi` are converted from degrees to radians.

Do not swap theta and phi.

Do not restore the old non-`tikz-3dplot` basis.

## 5. Update TikZ export if needed

TikZ export should continue to emit:

```tex
\tdplotsetmaincoords{theta}{phi}
\begin{tikzpicture}[tdplot_main_coords]
...
\end{tikzpicture}
```

or the existing equivalent.

Requirements:

- use the same camera `thetaDeg` / `phiDeg` as preview;
- 3D coordinates remain 3D;
- do not pre-flatten to 2D;
- 2D output remains unpolluted by tikz-3dplot setup;
- layer-aware output remains intact;
- work-plane-local `canvas is plane` scoped export remains intact.

## 6. Tests

Add or update focused regression tests.

Required tests:

1. Initial/reset camera preview and export alignment

- Use the initial/reset camera.
- Project a representative nontrivial point, e.g. `{ x: 2, y: 4, z: 3 }`, with the same basis implied by exported `thetaDeg` / `phiDeg`.
- Assert preview projection matches the `tikz-3dplot` basis for the exported theta/phi within tolerance.

2. `projectionBasis` does not override exported theta/phi

Create a camera with:

- `thetaDeg` / `phiDeg`;
- a deliberately conflicting `projectionBasis`.

Assert that preview/projection uses the theta/phi-aligned basis, or that the camera is normalized so no conflict remains.

3. Reset camera alignment

- Apply a camera change.
- Reset to initial.
- Assert preview basis and export theta/phi agree after reset.

4. TikZ export reflects current camera

- Change theta/phi.
- Generate TikZ.
- Assert `\tdplotsetmaincoords{theta}{phi}` uses the changed values.

5. 2D output regression

- 2D TikZ output does not include unnecessary `\tdplotsetmaincoords` or `tdplot_main_coords`.

6. Existing tests still pass for:

- camera input validation;
- presets;
- zoom/pan behavior;
- undo history separation;
- layer-aware TikZ output;
- work-plane-local scoped export.

## 7. Documentation/comments

Update comments/docs if needed.

Document:

- `thetaDeg` / `phiDeg` are the source of truth for 3D camera orientation;
- `projectionBasis`, if still present, is deprecated or not used for export/preview orientation when theta/phi exist;
- reset/default camera is tikz-3dplot-aligned;
- zoom/pan export policy remains unchanged from Phase 13I.

Do not add large unrelated docs.

## 8. Preserve existing behavior

Do not regress:

- camera controls;
- reset-to-initial availability;
- camera presets;
- 3D preview;
- 2D preview;
- camera-aware creation;
- camera-aware drag editing;
- save/load;
- undo/redo;
- layer filtering;
- TikZ output for ordinary geometry;
- Phase 9A coordinate names;
- Phase 9B layer-aware output;
- Phase 12 work-plane-local `canvas is plane` export.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open a 3D diagram.
2. Confirm default/reset SVG preview appears sensible.
3. Generate TikZ.
4. Confirm exported `\tdplotsetmaincoords{theta}{phi}` corresponds to current camera theta/phi.
5. Change theta.
6. Confirm SVG preview changes.
7. Confirm TikZ theta changes.
8. Change phi.
9. Confirm SVG preview changes.
10. Confirm TikZ phi changes.
11. Reset to initial.
12. Confirm SVG preview returns to reset/default view.
13. Confirm TikZ camera values return to reset/default values.
14. Confirm 2D TikZ output is unchanged.
15. Confirm ordinary creation/selection still works.

## 10. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## 11. Report after implementation

Please report:

- files modified;
- root cause of preview/export mismatch;
- chosen policy for `projectionBasis`;
- whether `projectionBasis` was removed, ignored, deprecated, or normalized;
- how reset/default camera alignment is guaranteed;
- how tests verify preview/export alignment;
- test results;
- build results;
- remaining limitations.
