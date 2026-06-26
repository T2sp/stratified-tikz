# ROADMAP update snippet for Phase 25

Add or replace the Phase 25 section with the following.

## Phase 25: Work-plane-local symbolic coordinates

Phase 25 connects Phase 12 work planes with Phase 19 symbolic input.

Users can enter symbolic 2D local coordinates on a 3D work plane, such as:

```text
a = R*cos(q)
b = R*sin(q)
```

The editor stores the work-plane frame snapshot and local scalar expressions, uses finite global preview values for SVG, and exports local expressions using `canvas is plane` scopes where practical.

Important user decision:

- During global translation, move each object's stored frame origin.
- Do not expand local symbolic expressions into global expressions.
- Do not mutate a shared active work plane.

Recommended `phaseSlugs` entries:

```js
"25A": "work-plane-local-symbolic-model",
"25B": "work-plane-local-symbolic-ui",
"25C": "work-plane-local-preview-import",
"25D": "work-plane-local-tikz-export",
"25E": "work-plane-local-editing-translation",
"25F": "work-plane-local-polish",
```

### Phase 25A: Work-plane-local symbolic coordinate model and validation

- Add coordinate source model.
- Store frame snapshot and local scalar expressions.
- Compute finite global preview point.
- Add validation and save/load support.

### Phase 25B: Direct input and Inspector UI

- Add Global xyz / Active work-plane local mode.
- Accept symbolic local scalars.
- Show preview values.
- Edit local coordinates in Inspector.

### Phase 25C: Preview refresh, JSON import, and geometry integration

- Refresh local previews when variables change.
- Detect variables in local scalars and frames during JSON import.
- Extend support to geometry fields.

### Phase 25D: TikZ export using canvas-is-plane scopes

- Export same-frame local symbolic paths/sheets in `canvas is plane` scopes.
- Preserve local expressions.
- Document mixed-frame policy.

### Phase 25E: Editing integration and translation policy

- Global translation moves object frame origins.
- Local expressions remain unchanged.
- Integrate with multi-selection, layer translation, snap, and path concatenation.

### Phase 25F: Polish, docs, and regression hardening

- Add docs/examples.
- Add combined workflow tests.
- Harden save/load/export behavior.
