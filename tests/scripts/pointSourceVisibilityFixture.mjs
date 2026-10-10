// Fabricated policy-test records never establish native browser acceptance.
export function syntheticPointSourceVisibilityAction({ state, scenario = 'point-geometric-visibility',
  id = 'app-point', sequence = 1, value = 'dimHidden', beforeRendered, afterRendered } = {}) {
  const point = { id, geometricKind: 'point', codim: 3, position: { x: 0, y: -1, z: 0 },
    text: '$dimmed$', style: { shape: 'semicircle', size: 8, opacity: 1 } }
  const diagram = { ambientDimension: 3, strata: [point], labels: [], camera: { mode: '3d' } }
  const before = state ? structuredClone(state) : {
    json: JSON.stringify({ version: 2, diagram }), runtimeDiagramJson: JSON.stringify(diagram),
    history: JSON.stringify({ past: [], present: diagram, future: [] }), selection: null, labelDocumentRevision: 108,
    uiSettings: JSON.stringify({ camera3d: { thetaDeg: 90, phiDeg: 0 }, workPlane: { kind: 'xy', value: 0 },
      visibility: { enabled: true, pointVisibility: 'dimHidden', labelVisibility: 'visible', surfaceDepthSort: true } }),
  }
  const model = JSON.parse(before.runtimeDiagramJson).strata.find((entry) => entry.id === id)
  const settings = JSON.parse(before.uiSettings), afterSettings = structuredClone(settings)
  afterSettings.visibility.pointVisibility = value
  const after = { ...structuredClone(before), uiSettings: JSON.stringify(afterSettings) }
  const bounds = { x: 100, y: 100, width: 120, height: 24 }
  const scrollAncestors = [{ tag: 'div', class: 'panel-heading', bounds: { x: 0, y: 0, width: 500, height: 500 },
    scrollTop: 180, scrollLeft: 0, clientWidth: 500, clientHeight: 500, scrollWidth: 500, scrollHeight: 800,
    clipsX: false, clipsY: true, scrollport: { x: 0, y: 0, width: 500, height: 500 } }]
  const base = { text: '', outerHTML: '', class: null, connected: true, visible: true, bounds, scrollAncestors,
    inScrollport: true, disabledProperty: null, matchesDisabled: false, ariaDisabled: null, enabledPredicate: true,
    ariaLabel: null, ariaLabelledby: null, matchesProductionLabel: false, directCaptionCount: 0, directControlCount: 0,
    labelControlMatches: false, directOwningProductionLabel: false, associatedOwningLabel: false,
    value: null, labels: [], options: null }
  const control = (selected) => {
    const labelHTML = '<label class="tikz-export-mode-control"><span>Hidden points:</span><select class="toolbar-select"><option value="dimHidden">Dim hidden</option><option value="hideHidden">Hide hidden</option></select></label>'
    const labelText = 'Hidden points:Dim hiddenHide hidden'
    const label = { ...structuredClone(base), tag: 'label', text: labelText, outerHTML: labelHTML,
      class: 'tikz-export-mode-control', matchesProductionLabel: true, directCaptionCount: 1,
      directControlCount: 1, labelControlMatches: true }
    return { scope: '.source-panel', caption: 'Hidden points:', selector: 'select.toolbar-select',
      workPlaneControls: [{ tag: 'select', id: 'work-plane', ariaLabel: 'Work plane', value: 'xy', pressed: null, checked: null }],
      workPlaneStatus: ['xy at z=0'],
      sourcePanelCount: 1, captionCount: 1, wrapperCount: 1, correctedControlCount: 1, exactLabelCount: 0,
      panels: [{ ...structuredClone(base), tag: 'article', class: 'workspace-panel source-panel', outerHTML: `<article class="source-panel">${labelHTML}</article>` }],
      captions: [{ ...structuredClone(base), tag: 'span', text: 'Hidden points:', outerHTML: '<span>Hidden points:</span>', directOwningProductionLabel: true }],
      wrappers: [label], controls: [{ ...structuredClone(base), tag: 'select', class: 'toolbar-select',
        text: 'Dim hiddenHide hidden', outerHTML: '<select class="toolbar-select"><option value="dimHidden">Dim hidden</option><option value="hideHidden">Hide hidden</option></select>',
        disabledProperty: false, directOwningProductionLabel: true, associatedOwningLabel: true,
        value: selected, labels: [{ text: labelText, outerHTML: labelHTML }],
        options: [{ value: 'dimHidden', text: 'Dim hidden', selected: selected === 'dimHidden', disabled: false },
          { value: 'hideHidden', text: 'Hide hidden', selected: selected === 'hideHidden', disabled: false }] }] }
  }
  const rendered = { shape: model.style.shape, source: model.text ?? '', effectiveFillOpacity: .25,
    cumulativeOpacity: .25, contour: { tag: 'path', attributes: { 'fill-opacity': '1' } } }
  const target = { tag: 'select', class: 'toolbar-select', inSourcePanel: true, exactCaption: 'Hidden points:',
    owningLabel: true, sameOwnedControl: true }
  const token = `hidden-points:${scenario}:${sequence}:${id}`, provenance = 'native-select-input-change-observer'
  return { scenario, sequence, id, value, observer: { token, provenance },
    before: { state: before, control: control(settings.visibility.pointVisibility),
      rendered: structuredClone(beforeRendered === undefined ? rendered : beforeRendered) },
    prepared: { state: structuredClone(before), control: control(settings.visibility.pointVisibility),
      rendered: structuredClone(beforeRendered === undefined ? rendered : beforeRendered) },
    afterAction: { state: after, control: control(value), selection: [value],
      transition: { priorValue: settings.visibility.pointVisibility, finalValue: value, effective: settings.visibility.pointVisibility !== value },
      rendered: structuredClone(afterRendered === undefined ? value === 'hideHidden' ? null : rendered : afterRendered),
      events: { token, provenance, connected: true, control: structuredClone(target), droppedEvents: 0, errors: [],
        events: ['input', 'change'].map((type, index) => ({ type, trusted: false, at: 10 + index, value,
          connected: true, target: structuredClone(target), visibility: structuredClone(settings.visibility),
          labelDocumentRevision: before.labelDocumentRevision })) } } }
}
