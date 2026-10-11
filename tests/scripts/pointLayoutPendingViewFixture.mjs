import assert from 'node:assert/strict'

// Controlled Node records exercise the native evidence contract. No values in
// this fixture are browser measurements or establish native acceptance.
export function syntheticPendingLayoutViewEvidence({ click, source }) {
  assert.ok(click?.snapshot?.runtimeDiagramJson, 'Supply the original complete synthetic pending click')
  const immutableClick = structuredClone(click), captured = click.snapshot
  const old = JSON.parse(captured.runtimeDiagramJson), diagram = structuredClone(old)
  const circle = diagram.strata.find(({ id }) => id === 'layout-circle')
  assert.equal(circle.text, source)
  circle.text = 'later $changed$'
  const sourceEdit = structuredClone(diagram)
  circle.style.layout.anchor = 'north'
  const anchorEdit = structuredClone(diagram)
  circle.style.layout.minimumWidth = 110
  const saved = JSON.parse(captured.json), oldHistory = JSON.parse(captured.history)
  const state = { json: JSON.stringify({ ...saved, diagram }), runtimeDiagramJson: JSON.stringify(diagram),
    history: JSON.stringify({ past: [...oldHistory.past, old, sourceEdit, anchorEdit].slice(-100), present: diagram, future: [] }),
    selection: structuredClone(captured.selection), labelDocumentRevision: captured.runtime.documentRevision,
    uiSettings: captured.uiSettings, requests: 15 }
  const ids = ['layout-circle', 'layout-rectangle', 'layout-cylinder'], hold = { started: 2, completed: 0, released: false }
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  const rootScreen = { a: 2, b: 0, c: 0, d: 2, e: 100, f: 200 }
  const numberControl = (name, value, min, max, type = 'number') => ({ count: 1, tag: 'input', type,
    accessibleName: name, value: String(value), min: String(min), max: String(max), step: type === 'range' ? '.1' : 'any',
    connected: true, sameIdentity: true, inPanel: true, inDetails: true, valid: true,
    bounds: { x: 20, y: 20, width: 100, height: 24 } })
  const points = (zoom) => ids.map((id) => {
    const model = structuredClone(diagram.strata.find((point) => point.id === id))
    const root = { x: 20 + 10 * zoom * model.position.x, y: 25 - 10 * zoom * model.position.y }
    const screen = { x: rootScreen.a * root.x + rootScreen.e, y: rootScreen.d * root.y + rootScreen.f }
    const request = id === 'layout-circle' ? `synthetic-view:${state.labelDocumentRevision}:${id}:${model.text}`
      : captured.points.find((point) => point.id === id).request
    return { id, count: 1, connected: true, sameIdentity: true, inRoot: true, model,
      owner: JSON.stringify(['point-node', state.labelDocumentRevision, id]), request, bodyRequest: request, source: model.text,
      status: id === 'layout-circle' ? 'pending' : 'ready', anchor: model.style.layout.anchor,
      layout: JSON.stringify({ ...model.style.layout, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } }),
      nodeTransform: `translate(${root.x} ${root.y})`, root, screen,
      rootMatrix: { ...identity, e: root.x, f: root.y }, CTM: { ...identity, e: root.x, f: root.y },
      screenCTM: { ...rootScreen, e: screen.x, f: screen.y } }
  })
  const stage = (boundary, zoom, at) => ({ boundary, at, state: structuredClone(state), errors: [], points: points(zoom),
    click: structuredClone(immutableClick), hold: structuredClone(hold),
    controls: { panelCount: 1, panelHeading: 'Preview view', associated: true,
      zoom: numberControl('zoom value', zoom, .1, 10), slider: numberControl('zoom slider', zoom, .1, 10, 'range'),
      panX: numberControl('pan x value', 0, -1000, 1000), panY: numberControl('pan y value', 0, -1000, 1000),
      disclosure: { count: 1, connected: true, sameIdentity: true, controls: 'camera-details', expanded: 'true',
        accessibleName: 'Preview view zoom 1 pan x 0 pan y 0' } },
    canvas: { count: 1, connected: true, sameIdentity: true, viewBox: '0 0 520 360',
      preserveAspectRatio: 'xMidYMid meet', width: '520', height: '360',
      client: { x: 100, y: 200, width: 1040, height: 720 }, screenCTM: structuredClone(rootScreen), CTM: structuredClone(identity) },
    viewport: { width: 1700, height: 1300, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
    scroll: [{ tag: 'div', id: 'preview', className: 'preview-panel', scrollTop: 0, scrollLeft: 0,
      bounds: { x: 100, y: 200, width: 1040, height: 720 } }], events: [], droppedEvents: 0 })
  const before = stage('before', 1, 100), immediate = stage('immediate-input', 1.4, 120), after = stage('after', 1.4, 140)
  const event = { order: 0, at: 110, type: 'input', trusted: true,
    target: { tag: 'input', type: 'number', accessibleName: 'zoom value', connected: true, sameIdentity: true, inDetails: true },
    value: '1.4', sliderValue: '1', inputType: 'insertText', data: '1.4',
    state: structuredClone(state), hold: structuredClone(hold),
    points: before.points.map(({ id, owner, request, source }) => ({ id, owner, request, source, connected: true, sameIdentity: true })) }
  immediate.events = [structuredClone(event)]; after.events = [structuredClone(event)]
  return { scenario: 'point-layout-pending-transparent-edit', source, click: immutableClick, target: 1.4, ids,
    result: 'passed', stages: [before, immediate, after], fillCount: 1, resolution: { numericCount: 1, sliderCount: 1 },
    preparation: { stateBefore: structuredClone(state), disclosureCount: 1, originalExpanded: 'false' },
    cleanup: { observerRemoved: true, disclosureRestored: true, observation: { state: structuredClone(state),
      hold: structuredClone(hold), click: structuredClone(immutableClick), disclosureCount: 1, expanded: 'false' } }, secondaryErrors: [] }
}
