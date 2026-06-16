# Phase 13I Implementation Prompt: TikZ camera/export alignment with tikz-3dplot

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

Phase 12 is complete. The app supports:

- 2D and 3D diagrams;
- axis-aligned and custom work planes;
- cursor creation and direct creation;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- selection, inspector, layer filtering, and style editing.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Camera/view state is editor/view state unless explicitly persisted as diagram view options.
- Camera/view state is not a stratum.
- Work planes remain model-space geometry.
- Projection/camera and work planes must remain separate concerns.
- Generated TikZ must remain readable.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve Phase 12 work-plane behavior.


## Goal

Align generated TikZ output with the current 3D camera/view.

Use `tikz-3dplot`-style camera notation:

```tex
\tdplotsetmaincoords{theta}{phi}
\begin{tikzpicture}[tdplot_main_coords]
...
\end{tikzpicture}
```

The generated TikZ should use the current camera's `thetaDeg` and `phiDeg`, so TikZ output reflects the same view orientation as SVG preview.

This should apply a TikZ-side 3D view transform rather than flattening all geometry to 2D coordinates.

The user must still be able to reset the app camera to the initial/default display.

## Prerequisites

Phases 13E-13H are complete.

## Scope

Implement TikZ camera/view export.

Do not implement:

- perspective projection;
- camera animation;
- TikZ import;
- full tikz-3dplot advanced rotated coordinate frames unless needed;
- new geometry.

## Required TikZ behavior

For 3D diagrams:

- emit `\usepackage{tikz-3dplot}` or a comment/package/library instruction according to existing output style;
- emit `\tdplotsetmaincoords{theta}{phi}` using current camera values;
- use `tdplot_main_coords` in the `tikzpicture` options;
- keep 3D coordinates as 3D coordinates;
- do not pre-project them into 2D coordinate pairs;
- ensure coordinate axes guide export, if enabled, uses same camera view;
- ensure work-plane-local `canvas is plane` scoped Bézier export remains compatible.

For 2D diagrams:

- do not emit tikz-3dplot camera setup unless already required by other 3D-specific output;
- preserve existing 2D output.

## Camera values

Use the current camera `thetaDeg` and `phiDeg`.

Zoom/pan policy:

- TikZ output should use theta/phi orientation.
- It is acceptable for zoom/pan to remain SVG-view-only initially, if documented.
- If zoom is mapped to TikZ scale, do so explicitly and test it.
- Pan should not silently shift geometry unless there is a clear export option.

Preferred MVP:

- export theta/phi orientation;
- do not export pan;
- do not export zoom except through existing scale if already present;
- document limitations.

## Library/package policy

Use existing generator conventions.

If the project emits standalone snippets, add comments such as:

```tex
% Requires \usepackage{tikz-3dplot}
\tdplotsetmaincoords{70}{110}
\begin{tikzpicture}[tdplot_main_coords]
```

If the project emits full LaTeX, include the package in the preamble.

Do not duplicate package/library lines unnecessarily.

## Tests

Add tests:

1. 3D TikZ output includes `\tdplotsetmaincoords{theta}{phi}` with current camera values.
2. 3D TikZ picture uses `tdplot_main_coords`.
3. 3D coordinates remain 3D, not pre-flattened 2D.
4. Changing camera theta/phi changes generated TikZ.
5. Reset to initial camera restores initial TikZ camera values.
6. 2D TikZ output does not include unnecessary tikz-3dplot setup.
7. Layer-aware output preserved.
8. Work-plane-local `canvas is plane` scoped export remains valid if present.
9. Axes guide TikZ export, if enabled, uses same camera.

## Documentation

Update `docs/TIKZ_OUTPUT.md`:

- generated 3D TikZ uses tikz-3dplot-compatible `theta` / `phi`;
- `\tdplotsetmaincoords` controls view orientation;
- geometry remains 3D coordinates;
- reset-to-initial app camera restores initial view;
- limitations for zoom/pan if not exported.

## Preserve existing behavior

Do not regress:

- 2D TikZ;
- 3D geometry export;
- layer output;
- coordinate naming;
- relative Bézier export;
- work-plane-local scoped export;
- SVG preview;
- save/load.

## Report after implementation

Please report:

- files modified;
- TikZ camera export format;
- package/library/comment policy;
- zoom/pan export policy;
- interaction with axes guide and work-plane-local scopes;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
