import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SetStateAction,
} from 'react'
import './App.css'
import {
  emptyThreeDimensionalDiagram,
  emptyTwoDimensionalDiagram,
  threeDimensionalExample,
  twoDimensionalExample,
} from './examples'
import {
  createWorkPlanePatch,
  normalizePointForAmbientDimension,
  screenToModelOnWorkPlane,
} from './geometry'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from './model/serialization.ts'
import type {
  AmbientDimension,
  Camera,
  CoordinateInputMode,
  Diagram,
  Vec2,
  Vec3,
  WorkPlane,
} from './model/types'
import { SvgDiagram } from './rendering'
import { generateTikz } from './tikz'
import {
  addCubicBezierCurveFromDirectInput,
  addCubicBezierCurveStratumWithResult,
  addPolygonSheetFromDirectInput,
  addPolygonSheetStratumWithResult,
  addPolylineCurveFromDirectInput,
  addPolylineCurveStratumWithResult,
  addPointStratumWithResult,
  addPointStratumFromDirectInput,
  addTextLabelWithResult,
  addTextLabelFromDirectInput,
  applyDirectCreationCommitToEditorState,
  appendSheetPolygonDraftPoint,
  areFinitePoints,
  arePointsOnWorkPlane,
  allLayersFilter,
  clearSelectionIfMissing,
  clearSelectionForLayerFilter,
  cloneDiagram,
  commitDiagramChange,
  commitDirectCreationResult,
  createSheetPolygonDraft,
  defaultJsonDownloadFilename,
  deriveAvailableLayers,
  EditableInspector,
  findSelectedElement,
  layerFilterIncludesLayer,
  normalizeLayerFilterForDiagram,
  normalizeJsonDownloadFilename,
  parseDirectCoordinateRows,
  parseDirectLayerInput,
  removeSelectedElementWithLayerFilter,
  sheetDraftBlocksWorkPlaneChange,
  shouldShowWorkPlanePreview,
  undoLastDiagramChange,
  updateDiagramGeometryHandle,
  type DirectCoordinateInput,
  type DirectPathCreationError,
  type GeometryHandleTarget,
  type LayerFilter,
  type SelectedElement,
  type SheetPolygonDraft,
  type WorkPlanePreviewTool,
} from './ui'

type ExampleId = 'empty2d' | 'empty3d' | '2d' | '3d'
type CopyStatus = 'idle' | 'copied' | 'failed'
type SaveLoadStatus = 'idle' | 'saved' | 'loaded' | 'failed'
type CreationTool = WorkPlanePreviewTool
type DirectCreationTool =
  | 'createPoint'
  | 'createLabel'
  | 'createPolyline'
  | 'createCubicBezier'
  | 'createSheet'
type PolylineDraft = {
  points: Vec3[]
} | null
type CubicBezierDraft = {
  points: Vec3[]
} | null

type EditableEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  polylineDraft: PolylineDraft
  cubicBezierDraft: CubicBezierDraft
  sheetPolygonDraft: SheetPolygonDraft | null
  undoDiagram: Diagram | null
}

type ExampleOption = {
  id: ExampleId
  name: string
  summary: string
  diagram: Diagram
}

const exampleOptions: ExampleOption[] = [
  {
    id: '2d',
    name: '2D example',
    summary: 'codim 1 curves, codim 2 points',
    diagram: twoDimensionalExample,
  },
  {
    id: '3d',
    name: '3D example',
    summary: 'codim 1 sheets, codim 2 curves, codim 3 points',
    diagram: threeDimensionalExample,
  },
  {
    id: 'empty2d',
    name: 'Empty 2D',
    summary: 'blank 2D canvas',
    diagram: emptyTwoDimensionalDiagram,
  },
  {
    id: 'empty3d',
    name: 'Empty 3D',
    summary: 'blank 3D canvas',
    diagram: emptyThreeDimensionalDiagram,
  },
]

const coordinateInputModes: CoordinateInputMode[] = ['cursor', 'direct']
const defaultDirectCoordinates: DirectCoordinateInput = {
  x: '0',
  y: '0',
  z: '0',
}
const creationTools: Array<{ id: CreationTool; label: string }> = [
  { id: 'select', label: 'Select' },
  { id: 'createPoint', label: 'Add point' },
  { id: 'createLabel', label: 'Add label' },
  { id: 'createPolyline', label: 'Add polyline' },
  { id: 'createCubicBezier', label: 'Add cubic Bezier' },
  { id: 'createSheet', label: 'Add sheet' },
]
const workPlaneKinds: WorkPlane['kind'][] = ['xy', 'xz', 'yz']

function App() {
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleId>('2d')
  const [coordinateInputMode, setCoordinateInputMode] =
    useState<CoordinateInputMode>('cursor')
  const [creationTool, setCreationTool] = useState<CreationTool>('select')
  const [polylineStatus, setPolylineStatus] = useState<string>('')
  const [cubicBezierStatus, setCubicBezierStatus] = useState<string>('')
  const [sheetStatus, setSheetStatus] = useState<string>('')
  const [directCreationStatus, setDirectCreationStatus] = useState<string>('')
  const [directCoordinates, setDirectCoordinates] = useState<DirectCoordinateInput>(
    defaultDirectCoordinates,
  )
  const [directLabelText, setDirectLabelText] = useState<string>('Label')
  const [directLayerInput, setDirectLayerInput] = useState<string>('0')
  const [directPolylineRows, setDirectPolylineRows] = useState<string>(
    defaultDirectPolylineRows(2),
  )
  const [directCubicBezierRows, setDirectCubicBezierRows] = useState<string>(
    defaultDirectCubicBezierRows(2),
  )
  const [directSheetRows, setDirectSheetRows] = useState<string>(
    defaultDirectSheetRows(),
  )
  const [saveLoadStatus, setSaveLoadStatus] = useState<SaveLoadStatus>('idle')
  const [saveLoadMessage, setSaveLoadMessage] = useState<string>('')
  const [jsonDownloadFilename, setJsonDownloadFilename] = useState<string>(
    defaultJsonDownloadFilename,
  )
  const loadFileInputRef = useRef<HTMLInputElement | null>(null)
  const geometryDragUndoDiagramRef = useRef<Diagram | null>(null)
  const [activeWorkPlane, setActiveWorkPlane] = useState<WorkPlane>({
    kind: 'xy',
    z: 0,
  })
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [editorState, setEditorState] = useState<EditableEditorState>(() => ({
    editableDiagram: cloneDiagram(exampleOptions[0].diagram),
    selectedElement: null,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    sheetPolygonDraft: null,
    undoDiagram: null,
  }))
  const {
    editableDiagram,
    selectedElement,
    layerFilter,
    polylineDraft,
    cubicBezierDraft,
    sheetPolygonDraft,
    undoDiagram,
  } = editorState
  const selectedExample =
    exampleOptions.find((example) => example.id === selectedExampleId) ??
    exampleOptions[0]
  const tikzSource = useMemo(
    () => generateTikz(editableDiagram),
    [editableDiagram],
  )
  const availableLayers = useMemo(
    () => deriveAvailableLayers(editableDiagram),
    [editableDiagram],
  )
  const previewWorkPlane = sheetPolygonDraft?.workPlane ?? activeWorkPlane
  const workPlanePreview = useMemo(() => {
    if (!shouldShowWorkPlanePreview(editableDiagram.ambientDimension, creationTool)) {
      return undefined
    }

    return {
      ...createWorkPlanePatch(previewWorkPlane),
      label:
        sheetPolygonDraft === null
          ? `active ${previewWorkPlane.kind} plane`
          : `sheet draft ${previewWorkPlane.kind} plane`,
    }
  }, [
    creationTool,
    editableDiagram.ambientDimension,
    previewWorkPlane,
    sheetPolygonDraft,
  ])

  async function copyTikz(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable.')
      }

      await navigator.clipboard.writeText(tikzSource)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  function selectExample(exampleId: ExampleId): void {
    const nextExample =
      exampleOptions.find((example) => example.id === exampleId) ?? exampleOptions[0]
    const nextDiagram = cloneDiagram(nextExample.diagram)

    setSelectedExampleId(exampleId)
    if (nextDiagram.ambientDimension === 2 && creationTool === 'createSheet') {
      setCreationTool('select')
    }
    setEditorState((current) =>
      commitDiagramChange(current, {
        ...current,
        editableDiagram: nextDiagram,
        selectedElement: clearSelectionIfMissing(
          nextDiagram,
          current.selectedElement,
        ),
        layerFilter: allLayersFilter,
        polylineDraft: null,
        cubicBezierDraft: null,
        sheetPolygonDraft: null,
      }),
    )
    setCopyStatus('idle')
    setSaveLoadStatus('idle')
    setSaveLoadMessage('')
    setPolylineStatus('')
    setCubicBezierStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setDirectLayerInput('0')
    setDirectPolylineRows(defaultDirectPolylineRows(nextDiagram.ambientDimension))
    setDirectCubicBezierRows(defaultDirectCubicBezierRows(nextDiagram.ambientDimension))
    setDirectSheetRows(defaultDirectSheetRows())
  }

  function updateEditableDiagram(update: SetStateAction<Diagram>): void {
    setEditorState((current) => {
      const nextDiagram =
        typeof update === 'function' ? update(current.editableDiagram) : update
      const nextSelection = clearSelectionForLayerFilter(
        nextDiagram,
        current.selectedElement,
        current.layerFilter,
      )
      const nextLayerFilter = normalizeLayerFilterForDiagram(
        nextDiagram,
        current.layerFilter,
      )

      return commitDiagramChange(current, {
        ...current,
        editableDiagram: nextDiagram,
        selectedElement: nextSelection,
        layerFilter: nextLayerFilter,
      })
    })
    setCopyStatus('idle')
  }

  const undoLastChange = useCallback(function undoLastChange(): void {
    if (undoDiagram === null) {
      return
    }

    setSelectedExampleId(undoDiagram.ambientDimension === 2 ? '2d' : '3d')
    geometryDragUndoDiagramRef.current = null
    setEditorState((current) => undoLastDiagramChange(current))
    setCopyStatus('idle')
    setSaveLoadStatus('idle')
    setSaveLoadMessage('')
    setPolylineStatus('')
    setCubicBezierStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
  }, [undoDiagram])

  function downloadJson(): void {
    try {
      const blob = new Blob([serializeDiagram(editableDiagram)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = normalizeJsonDownloadFilename(jsonDownloadFilename)
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setSaveLoadStatus('saved')
      setSaveLoadMessage('JSON downloaded.')
    } catch {
      setSaveLoadStatus('failed')
      setSaveLoadMessage('Save failed.')
    }
  }

  function openLoadJsonPicker(): void {
    loadFileInputRef.current?.click()
  }

  async function loadJsonFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (file === undefined) {
      return
    }

    let text: string

    try {
      text = await file.text()
    } catch {
      setSaveLoadStatus('failed')
      setSaveLoadMessage('Could not read JSON file.')
      return
    }

    const result = parseSavedDiagramJson(text)

    if (!result.ok) {
      setSaveLoadStatus('failed')
      setSaveLoadMessage(result.error)
      return
    }

    setSelectedExampleId(result.diagram.ambientDimension === 2 ? '2d' : '3d')
    setCreationTool('select')
    setEditorState((current) =>
      commitDiagramChange(current, {
        ...current,
        editableDiagram: result.diagram,
        selectedElement: null,
        layerFilter: allLayersFilter,
        polylineDraft: null,
        cubicBezierDraft: null,
        sheetPolygonDraft: null,
      }),
    )
    setCopyStatus('idle')
    setPolylineStatus('')
    setCubicBezierStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setDirectLayerInput('0')
    setDirectPolylineRows(defaultDirectPolylineRows(result.diagram.ambientDimension))
    setDirectCubicBezierRows(defaultDirectCubicBezierRows(result.diagram.ambientDimension))
    setDirectSheetRows(defaultDirectSheetRows())
    setSaveLoadStatus('loaded')
    setSaveLoadMessage('JSON loaded.')
  }

  function updateSelectedElement(selection: SelectedElement): void {
    setEditorState((current) => ({
      ...current,
      selectedElement: selection,
    }))
  }

  const removeCurrentSelection = useCallback(function removeCurrentSelection(): void {
    if (selectedElement === null) {
      return
    }

    setEditorState((current) => {
      const result = removeSelectedElementWithLayerFilter(
        current.editableDiagram,
        current.selectedElement,
        current.layerFilter,
      )

      if (
        !result.removed &&
        current.selectedElement === result.selectedElement &&
        current.layerFilter === result.layerFilter &&
        current.polylineDraft === null &&
        current.cubicBezierDraft === null &&
        current.sheetPolygonDraft === null
      ) {
        return current
      }

      return commitDiagramChange(current, {
        ...current,
        editableDiagram: result.diagram,
        selectedElement: result.selectedElement,
        layerFilter: result.layerFilter,
        polylineDraft: null,
        cubicBezierDraft: null,
        sheetPolygonDraft: null,
      })
    })
    setPolylineStatus('')
    setCubicBezierStatus('')
    setSheetStatus('')
    setCopyStatus('idle')
  }, [selectedElement])

  useEffect(() => {
    if (layerFilter.kind === 'layer') {
      setDirectLayerInput(String(layerFilter.layer))
    }
  }, [layerFilter])

  useEffect(() => {
    function handleRemoveShortcut(event: KeyboardEvent): void {
      if (
        event.defaultPrevented ||
        (event.key !== 'Delete' && event.key !== 'Backspace') ||
        isEditableKeyboardTarget(event.target) ||
        selectedElement === null
      ) {
        return
      }

      event.preventDefault()
      removeCurrentSelection()
    }

    window.addEventListener('keydown', handleRemoveShortcut)

    return () => {
      window.removeEventListener('keydown', handleRemoveShortcut)
    }
  }, [removeCurrentSelection, selectedElement])

  useEffect(() => {
    function handleUndoShortcut(event: KeyboardEvent): void {
      if (
        event.defaultPrevented ||
        event.key.toLowerCase() !== 'z' ||
        event.altKey ||
        event.shiftKey ||
        (!event.metaKey && !event.ctrlKey) ||
        isEditableKeyboardTarget(event.target) ||
        undoDiagram === null
      ) {
        return
      }

      event.preventDefault()
      undoLastChange()
    }

    window.addEventListener('keydown', handleUndoShortcut)

    return () => {
      window.removeEventListener('keydown', handleUndoShortcut)
    }
  }, [undoDiagram, undoLastChange])

  function updateLayerFilter(nextFilter: LayerFilter): void {
    setEditorState((current) => {
      const normalizedFilter = normalizeLayerFilterForDiagram(
        current.editableDiagram,
        nextFilter,
      )

      return {
        ...current,
        layerFilter: normalizedFilter,
        selectedElement: clearSelectionForLayerFilter(
          current.editableDiagram,
          current.selectedElement,
          normalizedFilter,
        ),
      }
    })
  }

  function updateCreationTool(tool: CreationTool): void {
    if (
      tool === 'createSheet' &&
      editorState.editableDiagram.ambientDimension !== 3
    ) {
      return
    }

    setCreationTool(tool)
    setDirectCreationStatus('')

    if (
      tool !== 'createPolyline' &&
      tool !== 'createCubicBezier' &&
      tool !== 'createSheet'
    ) {
      setEditorState((current) =>
        current.polylineDraft === null &&
        current.cubicBezierDraft === null &&
        current.sheetPolygonDraft === null
          ? current
          : {
              ...current,
              polylineDraft: null,
              cubicBezierDraft: null,
              sheetPolygonDraft: null,
            },
      )
      setPolylineStatus('')
      setCubicBezierStatus('')
      setSheetStatus('')
      return
    }

    setEditorState((current) => ({
      ...current,
      polylineDraft: tool === 'createPolyline' ? current.polylineDraft : null,
      cubicBezierDraft:
        tool === 'createCubicBezier' ? current.cubicBezierDraft : null,
      sheetPolygonDraft:
        tool === 'createSheet' ? current.sheetPolygonDraft : null,
    }))
    setPolylineStatus(
      tool === 'createPolyline' ? 'Click the preview to add vertices.' : '',
    )
    setCubicBezierStatus(
      tool === 'createCubicBezier'
        ? 'Click Start, Control 1, Control 2, then End.'
        : '',
    )
    setSheetStatus(
      tool === 'createSheet' ? 'Click the preview to add sheet vertices.' : '',
    )
  }

  function handlePreviewCreationClick(
    svgPoint: Vec2,
    viewportHeight: number,
    previewCamera: Camera,
  ): void {
    if (creationTool === 'select') {
      return
    }

    if (
      coordinateInputMode === 'direct' &&
      (creationTool === 'createPoint' || creationTool === 'createLabel')
    ) {
      return
    }

    const nextCubicBezierPointCount =
      creationTool === 'createCubicBezier'
        ? (cubicBezierDraft?.points.length ?? 0) + 1
        : 0
    const shouldCommitOnClick =
      creationTool === 'createPoint' ||
      creationTool === 'createLabel' ||
      (creationTool === 'createCubicBezier' && nextCubicBezierPointCount >= 4)
    const cursorCreationLayer = shouldCommitOnClick
      ? parseNewElementLayer(
          creationTool === 'createCubicBezier'
            ? setCubicBezierStatus
            : setDirectCreationStatus,
        )
      : null

    if (shouldCommitOnClick && cursorCreationLayer === null) {
      return
    }

    if (creationTool === 'createPolyline') {
      setPolylineStatus(
        `${(polylineDraft?.points.length ?? 0) + 1} vertices in draft.`,
      )
    }

    if (creationTool === 'createCubicBezier') {
      setCubicBezierStatus(
        nextCubicBezierPointCount >= 4
          ? 'Cubic Bezier created.'
          : `${nextCubicBezierPointCount}/4 Bezier points placed.`,
      )
    }

    if (creationTool === 'createSheet') {
      setSheetStatus(
        `${(sheetPolygonDraft?.points.length ?? 0) + 1} sheet vertices in draft.`,
      )
    }

    setEditorState((current) => {
      const placementWorkPlane =
        creationTool === 'createSheet' && current.sheetPolygonDraft !== null
          ? current.sheetPolygonDraft.workPlane
          : activeWorkPlane
      const modelPoint = normalizePointForAmbientDimension(
        current.editableDiagram.ambientDimension,
        screenToModelOnWorkPlane(
          previewCamera,
          { x: svgPoint.x, y: viewportHeight - svgPoint.y },
          placementWorkPlane,
        ),
      )

      if (creationTool === 'createPolyline') {
        const draftPoints = current.polylineDraft?.points ?? []

        return {
          ...current,
          polylineDraft: {
            points: [...draftPoints, modelPoint],
          },
          cubicBezierDraft: null,
          sheetPolygonDraft: null,
        }
      }

      if (creationTool === 'createCubicBezier') {
        const draftPoints = current.cubicBezierDraft?.points ?? []
        const nextPoints = [...draftPoints, modelPoint]

        if (nextPoints.length < 4) {
          return {
            ...current,
            polylineDraft: null,
            cubicBezierDraft: {
              points: nextPoints,
            },
            sheetPolygonDraft: null,
          }
        }

        const result = addCubicBezierCurveStratumWithResult(
          current.editableDiagram,
          nextPoints,
          { layer: cursorCreationLayer ?? undefined },
        )

        if (result.id === null) {
          return {
            ...current,
            cubicBezierDraft: null,
            sheetPolygonDraft: null,
          }
        }

        return commitDiagramChange(
          current,
          applyCreatedElementToEditorState(
            current,
            result.diagram,
            { kind: 'stratum', id: result.id },
            cursorCreationLayer ?? 0,
          ),
        )
      }

      if (creationTool === 'createSheet') {
        if (current.editableDiagram.ambientDimension !== 3) {
          return current
        }

        return {
          ...current,
          polylineDraft: null,
          cubicBezierDraft: null,
          sheetPolygonDraft:
            current.sheetPolygonDraft === null
              ? createSheetPolygonDraft(modelPoint, activeWorkPlane)
              : appendSheetPolygonDraftPoint(
                  current.sheetPolygonDraft,
                  modelPoint,
                ),
        }
      }

      if (creationTool === 'createPoint') {
        const result = addPointStratumWithResult(
          current.editableDiagram,
          modelPoint,
          { layer: cursorCreationLayer ?? undefined },
        )

        return commitDiagramChange(
          current,
          applyCreatedElementToEditorState(
            current,
            result.diagram,
            { kind: 'stratum', id: result.id },
            cursorCreationLayer ?? 0,
          ),
        )
      }

      const result = addTextLabelWithResult(
        current.editableDiagram,
        modelPoint,
        { layer: cursorCreationLayer ?? undefined },
      )

      return commitDiagramChange(
        current,
        applyCreatedElementToEditorState(
          current,
          result.diagram,
          { kind: 'label', id: result.id },
          cursorCreationLayer ?? 0,
        ),
      )
    })

    if (creationTool !== 'createPolyline') {
      setCopyStatus('idle')
    }
  }

  function handleGeometryHandleDrag(
    target: GeometryHandleTarget,
    svgPoint: Vec2,
    viewportHeight: number,
    previewCamera: Camera,
  ): void {
    if (creationTool !== 'select') {
      return
    }

    setEditorState((current) => {
      if (!geometryHandleTargetsSelection(target, current.selectedElement)) {
        return current
      }

      const selected = findSelectedElement(
        current.editableDiagram,
        current.selectedElement,
      )

      if (selected === null) {
        return {
          ...current,
          selectedElement: null,
        }
      }

      if (!layerFilterIncludesLayer(current.layerFilter, selected.element.layer)) {
        return current
      }

      let modelPoint: Vec3

      try {
        modelPoint = normalizePointForAmbientDimension(
          current.editableDiagram.ambientDimension,
          screenToModelOnWorkPlane(
            previewCamera,
            { x: svgPoint.x, y: viewportHeight - svgPoint.y },
            activeWorkPlane,
          ),
        )
      } catch {
        return current
      }

      const nextDiagram = updateDiagramGeometryHandle(
        current.editableDiagram,
        target,
        modelPoint,
      )

      if (nextDiagram === current.editableDiagram) {
        return current
      }

      return commitDiagramChange(
        current,
        {
          ...current,
          editableDiagram: nextDiagram,
          selectedElement: clearSelectionForLayerFilter(
            nextDiagram,
            current.selectedElement,
            current.layerFilter,
          ),
          layerFilter: normalizeLayerFilterForDiagram(
            nextDiagram,
            current.layerFilter,
          ),
          polylineDraft: null,
          cubicBezierDraft: null,
          sheetPolygonDraft: null,
        },
        {
          undoSourceDiagram:
            geometryDragUndoDiagramRef.current ?? current.editableDiagram,
        },
      )
    })
    setCopyStatus('idle')
  }

  function handleGeometryHandleDragStart(): void {
    geometryDragUndoDiagramRef.current = cloneDiagram(editableDiagram)
  }

  function handleGeometryHandleDragEnd(): void {
    geometryDragUndoDiagramRef.current = null
  }

  function updateDirectCoordinate(
    axis: keyof DirectCoordinateInput,
    value: string,
  ): void {
    setDirectCoordinates((current) => ({
      ...current,
      [axis]: value,
    }))
    setDirectCreationStatus('')
  }

  function updateDirectRowsForCreationTool(
    tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
    value: string,
  ): void {
    switch (tool) {
      case 'createPolyline':
        setDirectPolylineRows(value)
        break
      case 'createCubicBezier':
        setDirectCubicBezierRows(value)
        break
      case 'createSheet':
        setDirectSheetRows(value)
        break
    }
    setDirectCreationStatus('')
  }

  function updateNewElementLayerInput(value: string): void {
    setDirectLayerInput(value)
    setDirectCreationStatus('')
  }

  function parseNewElementLayer(
    setStatus: (message: string) => void,
  ): number | null {
    const layer = parseDirectLayerInput(directLayerInput)

    if (layer === null) {
      setStatus('Layer must be a finite number.')
      return null
    }

    return layer
  }

  function createDirectElement(): void {
    if (!isDirectCreationTool(creationTool)) {
      return
    }

    const directLayer = parseNewElementLayer(setDirectCreationStatus)

    if (directLayer === null) {
      return
    }

    if (creationTool === 'createPoint') {
      const result = addPointStratumFromDirectInput(
        editableDiagram,
        directCoordinates,
        { layer: directLayer },
      )

      if (!result.ok) {
        setDirectCreationStatus('Coordinates must be finite numbers.')
        return
      }

      commitCreatedElement(
        result.diagram,
        { kind: 'stratum', id: result.id },
        directLayer,
      )
      setDirectCreationStatus('Point created.')
      setCopyStatus('idle')
      return
    }

    if (creationTool === 'createLabel') {
      const result = addTextLabelFromDirectInput(
        editableDiagram,
        directCoordinates,
        directLabelText,
        { layer: directLayer },
      )

      if (!result.ok) {
        setDirectCreationStatus('Coordinates must be finite numbers.')
        return
      }

      commitCreatedElement(
        result.diagram,
        { kind: 'label', id: result.id },
        directLayer,
      )
      setDirectCreationStatus('Label created.')
      setCopyStatus('idle')
      return
    }

    if (creationTool === 'createSheet') {
      createDirectSheet(directLayer)
      return
    }

    const coordinateRows = parseDirectCoordinateRows(
      directRowsForCreationTool(creationTool),
      editableDiagram.ambientDimension,
    )

    if (coordinateRows === null) {
      setDirectCreationStatus('Coordinates must be finite rows.')
      return
    }

    if (creationTool === 'createPolyline') {
      const result = addPolylineCurveFromDirectInput(
        editableDiagram,
        coordinateRows,
        { layer: directLayer },
      )

      if (!result.ok) {
        setDirectCreationStatus(directCreationErrorMessage(result.error, 'polyline'))
        return
      }

      commitCreatedElement(
        result.diagram,
        { kind: 'stratum', id: result.id },
        directLayer,
      )
      setDirectCreationStatus('Polyline created.')
      setCopyStatus('idle')
      return
    }

    const result = addCubicBezierCurveFromDirectInput(
      editableDiagram,
      coordinateRows,
      { layer: directLayer },
    )

    if (!result.ok) {
      setDirectCreationStatus(
        directCreationErrorMessage(result.error, 'cubicBezier'),
      )
      return
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      directLayer,
    )
    setDirectCreationStatus('Cubic Bezier created.')
    setCopyStatus('idle')
  }

  function createDirectSheet(directLayer: number): void {
    const coordinateRows = parseDirectCoordinateRows(
      directSheetRows,
      editableDiagram.ambientDimension,
    )

    if (coordinateRows === null) {
      setDirectCreationStatus('Coordinates must be finite rows.')
      return
    }

    const result = addPolygonSheetFromDirectInput(editableDiagram, coordinateRows, {
      layer: directLayer,
    })

    if (!result.ok) {
      setDirectCreationStatus(directCreationErrorMessage(result.error, 'sheet'))
      return
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      directLayer,
    )
    setDirectCreationStatus('Sheet created.')
    setCopyStatus('idle')
  }

  function commitCreatedElement(
    diagram: Diagram,
    selection: Exclude<SelectedElement, null>,
    layer: number,
  ): void {
    setEditorState((current) =>
      commitDiagramChange(
        current,
        applyCreatedElementToEditorState(current, diagram, selection, layer),
      ),
    )
  }

  function applyCreatedElementToEditorState(
    current: EditableEditorState,
    diagram: Diagram,
    selection: Exclude<SelectedElement, null>,
    layer: number,
  ): EditableEditorState {
    const commit = commitDirectCreationResult(
      diagram,
      selection,
      layer,
      current.layerFilter,
    )

    return {
      ...applyDirectCreationCommitToEditorState(current, commit),
      polylineDraft: null,
      cubicBezierDraft: null,
      sheetPolygonDraft: null,
    }
  }

  function directRowsForCreationTool(tool: 'createPolyline' | 'createCubicBezier'): string {
    return tool === 'createPolyline' ? directPolylineRows : directCubicBezierRows
  }

  function directRowsForCreationToolValue(
    tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
  ): string {
    switch (tool) {
      case 'createPolyline':
        return directPolylineRows
      case 'createCubicBezier':
        return directCubicBezierRows
      case 'createSheet':
        return directSheetRows
    }
  }

  function finishPolylineDraft(): void {
    if (polylineDraft === null || polylineDraft.points.length < 2) {
      setPolylineStatus('A polyline needs at least 2 vertices.')
      return
    }

    const creationLayer = parseNewElementLayer(setPolylineStatus)

    if (creationLayer === null) {
      return
    }

    setEditorState((current) => {
      const draft = current.polylineDraft

      if (draft === null || draft.points.length < 2) {
        return current
      }

      const result = addPolylineCurveStratumWithResult(
        current.editableDiagram,
        draft.points,
        { layer: creationLayer },
      )

      if (result.id === null) {
        return current
      }

      return commitDiagramChange(
        current,
        applyCreatedElementToEditorState(
          current,
          result.diagram,
          { kind: 'stratum', id: result.id },
          creationLayer,
        ),
      )
    })
    setPolylineStatus('Polyline created.')
    setCopyStatus('idle')
  }

  function cancelPolylineDraft(): void {
    setEditorState((current) =>
      current.polylineDraft === null
        ? current
        : {
            ...current,
            polylineDraft: null,
          },
    )
    setPolylineStatus('Polyline canceled.')
  }

  function cancelCubicBezierDraft(): void {
    setEditorState((current) =>
      current.cubicBezierDraft === null
        ? current
        : {
            ...current,
            cubicBezierDraft: null,
          },
    )
    setCubicBezierStatus('Cubic Bezier canceled.')
  }

  function finishSheetDraft(): void {
    if (sheetPolygonDraft === null || sheetPolygonDraft.points.length < 3) {
      setSheetStatus('A sheet needs at least 3 vertices.')
      return
    }

    if (!areFinitePoints(sheetPolygonDraft.points)) {
      setSheetStatus('Sheet vertices must be finite numbers.')
      return
    }

    if (!arePointsOnWorkPlane(sheetPolygonDraft.points, sheetPolygonDraft.workPlane)) {
      setSheetStatus('Sheet vertices must stay on the draft work plane.')
      return
    }

    const creationLayer = parseNewElementLayer(setSheetStatus)

    if (creationLayer === null) {
      return
    }

    setEditorState((current) => {
      const draft = current.sheetPolygonDraft

      if (
        draft === null ||
        draft.points.length < 3 ||
        !areFinitePoints(draft.points) ||
        !arePointsOnWorkPlane(draft.points, draft.workPlane)
      ) {
        return current
      }

      const result = addPolygonSheetStratumWithResult(
        current.editableDiagram,
        draft.points,
        { layer: creationLayer },
      )

      if (result.id === null) {
        return current
      }

      return commitDiagramChange(
        current,
        applyCreatedElementToEditorState(
          current,
          result.diagram,
          { kind: 'stratum', id: result.id },
          creationLayer,
        ),
      )
    })
    setSheetStatus('Sheet created.')
    setCopyStatus('idle')
  }

  function cancelSheetDraft(): void {
    setEditorState((current) =>
      current.sheetPolygonDraft === null
        ? current
        : {
            ...current,
            sheetPolygonDraft: null,
          },
    )
    setSheetStatus('Sheet canceled.')
  }

  function updateWorkPlaneKind(kind: WorkPlane['kind']): void {
    if (sheetDraftBlocksWorkPlaneChange(sheetPolygonDraft)) {
      setSheetStatus('Finish or cancel the sheet before changing work plane.')
      return
    }

    setActiveWorkPlane((current) => {
      const fixedValue = workPlaneFixedValue(current)

      switch (kind) {
        case 'xy':
          return { kind, z: fixedValue }
        case 'xz':
          return { kind, y: fixedValue }
        case 'yz':
          return { kind, x: fixedValue }
      }
    })
  }

  function updateWorkPlaneFixedValue(rawValue: string): void {
    if (sheetDraftBlocksWorkPlaneChange(sheetPolygonDraft)) {
      setSheetStatus('Finish or cancel the sheet before changing work plane.')
      return
    }

    const fixedValue = Number(rawValue)

    if (!Number.isFinite(fixedValue)) {
      return
    }

    setActiveWorkPlane((current) => {
      switch (current.kind) {
        case 'xy':
          return { ...current, z: fixedValue }
        case 'xz':
          return { ...current, y: fixedValue }
        case 'yz':
          return { ...current, x: fixedValue }
      }
    })
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>StratifiedTikZ</h1>
          <p>Basic preview and TikZ source workspace.</p>
        </div>
        <div className="status-strip" aria-label="Current diagram summary">
          <span>{selectedExample.name}</span>
          <span>{editableDiagram.ambientDimension}D</span>
          <span>{coordinateInputMode}</span>
          <span>{creationTool}</span>
          <span>{layerFilterStatusLabel(layerFilter)}</span>
          <span>{selectedElement === null ? 'no selection' : selectedElement.id}</span>
        </div>
      </header>

      <section className="toolbar" aria-label="Diagram controls">
        <div className="control-stack">
          <div className="control-group">
            <span className="control-label">Example</span>
            <div className="segmented-control">
              {exampleOptions.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className={
                    selectedExampleId === example.id ? 'is-selected' : undefined
                  }
                  aria-pressed={selectedExampleId === example.id}
                  onClick={() => selectExample(example.id)}
                >
                  {example.name}
                </button>
              ))}
            </div>
          </div>
          <p className="toolbar-note">
            Edits are temporary in this phase and reset when switching examples.
          </p>
        </div>

        <div className="control-group">
          <span className="control-label">Tool</span>
          <div className="segmented-control">
            {creationTools
              .filter(
                (tool) =>
                  tool.id !== 'createSheet' || editableDiagram.ambientDimension === 3,
              )
              .map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={creationTool === tool.id ? 'is-selected' : undefined}
                  aria-pressed={creationTool === tool.id}
                  onClick={() => updateCreationTool(tool.id)}
                >
                  {tool.label}
                </button>
              ))}
          </div>
        </div>

        {creationTool === 'createPolyline' && (
          <div className="control-group polyline-draft-control">
            <span className="control-label">Polyline</span>
            <button
              type="button"
              className="toolbar-button"
              onClick={finishPolylineDraft}
            >
              Finish polyline
            </button>
            <button
              type="button"
              className="toolbar-button"
              onClick={cancelPolylineDraft}
            >
              Cancel polyline
            </button>
            <span className="toolbar-status" role="status">
              {polylineStatus}
            </span>
          </div>
        )}

        {creationTool === 'createCubicBezier' && (
          <div className="control-group polyline-draft-control">
            <span className="control-label">Cubic Bezier</span>
            <button
              type="button"
              className="toolbar-button"
              onClick={cancelCubicBezierDraft}
            >
              Cancel cubic Bezier
            </button>
            <span className="toolbar-status" role="status">
              {cubicBezierStatus}
            </span>
          </div>
        )}

        {creationTool === 'createSheet' && editableDiagram.ambientDimension === 3 && (
          <div className="control-group polyline-draft-control">
            <span className="control-label">Sheet</span>
            <button
              type="button"
              className="toolbar-button"
              onClick={finishSheetDraft}
            >
              Finish sheet
            </button>
            <button
              type="button"
              className="toolbar-button"
              onClick={cancelSheetDraft}
            >
              Cancel sheet
            </button>
            <span className="toolbar-status" role="status">
              {sheetStatus}
            </span>
          </div>
        )}

        <div className="control-group">
          <span className="control-label">Input</span>
          <div className="segmented-control">
            {coordinateInputModes.map((mode) => (
              <button
                key={mode}
                type="button"
                className={coordinateInputMode === mode ? 'is-selected' : undefined}
                aria-pressed={coordinateInputMode === mode}
                onClick={() => setCoordinateInputMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group new-element-layer-control">
          <label className="direct-create-field new-element-layer-field">
            <span>New element layer</span>
            <input
              type="number"
              step="any"
              value={directLayerInput}
              onChange={(event) =>
                updateNewElementLayerInput(event.currentTarget.value)
              }
            />
          </label>
          {coordinateInputMode !== 'direct' && directCreationStatus !== '' && (
            <span className="toolbar-status" role="status">
              {directCreationStatus}
            </span>
          )}
        </div>

        {coordinateInputMode === 'direct' && isDirectCreationTool(creationTool) && (
            <form
              className="control-group direct-create-control"
              aria-label="Direct creation"
              onSubmit={(event) => {
                event.preventDefault()
                createDirectElement()
              }}
            >
              <span className="control-label">{directCreationTitle(creationTool)}</span>
              {creationTool === 'createLabel' && (
                <label className="direct-create-field direct-create-text">
                  <span>Text</span>
                  <input
                    className="toolbar-text-input"
                    type="text"
                    value={directLabelText}
                    onChange={(event) => {
                      setDirectLabelText(event.currentTarget.value)
                      setDirectCreationStatus('')
                    }}
                  />
                </label>
              )}
              {(creationTool === 'createPoint' || creationTool === 'createLabel') &&
                directCoordinateAxes(editableDiagram.ambientDimension).map((axis) => (
                  <label key={axis} className="direct-create-field">
                    <span>{axis}</span>
                    <input
                      type="number"
                      step="any"
                      value={directCoordinates[axis]}
                      onChange={(event) =>
                        updateDirectCoordinate(axis, event.currentTarget.value)
                      }
                    />
                  </label>
                ))}
              {isDirectPathCreationTool(creationTool) && (
                <label className="direct-create-field direct-coordinate-list">
                  <span>Vertices</span>
                  <textarea
                    value={directRowsForCreationToolValue(creationTool)}
                    rows={directCoordinateRowsTextAreaRows(creationTool)}
                    spellCheck={false}
                    placeholder={directCoordinateRowsPlaceholder(
                      editableDiagram.ambientDimension,
                    )}
                    onChange={(event) =>
                      updateDirectRowsForCreationTool(
                        creationTool,
                        event.currentTarget.value,
                      )
                    }
                  />
                </label>
              )}
              <button type="submit" className="toolbar-button">
                Create
              </button>
              <span className="toolbar-status" role="status">
                {directCreationStatus}
              </span>
            </form>
          )}

        <div className="control-group layer-filter-control">
          <span className="control-label">Layer</span>
          <select
            className="toolbar-select"
            value={layerFilterSelectValue(layerFilter)}
            onChange={(event) =>
              updateLayerFilter(parseLayerFilterSelectValue(event.currentTarget.value))
            }
          >
            <option value="all">All layers</option>
            {availableLayers.map((layer) => (
              <option key={layer} value={String(layer)}>
                Layer {formatLayerValue(layer)}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <span className="control-label">Selection</span>
          <button
            type="button"
            className="toolbar-button"
            disabled={selectedElement === null}
            onClick={removeCurrentSelection}
          >
            Remove selected
          </button>
        </div>

        <div className="control-group">
          <span className="control-label">History</span>
          <button
            type="button"
            className="toolbar-button"
            disabled={undoDiagram === null}
            onClick={undoLastChange}
          >
            Undo
          </button>
        </div>

        <div className="control-group file-control">
          <span className="control-label">File</span>
          <label className="filename-field">
            <span className="control-label">Name</span>
            <input
              className="toolbar-text-input"
              type="text"
              value={jsonDownloadFilename}
              onChange={(event) =>
                setJsonDownloadFilename(event.currentTarget.value)
              }
            />
          </label>
          <button type="button" className="toolbar-button" onClick={downloadJson}>
            Download JSON
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={openLoadJsonPicker}
          >
            Load JSON
          </button>
          <input
            ref={loadFileInputRef}
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={loadJsonFile}
          />
          <span
            className={`toolbar-status file-status file-status-${saveLoadStatus}`}
            role="status"
          >
            {saveLoadMessage}
          </span>
        </div>

        {editableDiagram.ambientDimension === 3 && (
          <div className="control-group work-plane-control">
            <span className="control-label">Work plane</span>
            <select
              className="toolbar-select"
              value={activeWorkPlane.kind}
              onChange={(event) =>
                updateWorkPlaneKind(event.currentTarget.value as WorkPlane['kind'])
              }
            >
              {workPlaneKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {workPlaneLabel(kind)}
                </option>
              ))}
            </select>
            <label className="work-plane-fixed">
              <span>{workPlaneFixedAxis(activeWorkPlane)}</span>
              <input
                type="number"
                step="any"
                value={String(workPlaneFixedValue(activeWorkPlane))}
                onChange={(event) =>
                  updateWorkPlaneFixedValue(event.currentTarget.value)
                }
              />
            </label>
          </div>
        )}
      </section>

      <section className="workspace" aria-label="Preview and TikZ source">
        <article className="workspace-panel preview-panel">
          <div className="panel-heading">
            <div>
              <h2>SVG Preview</h2>
              <span>{selectedExample.summary}</span>
            </div>
          </div>
          <SvgDiagram
            diagram={editableDiagram}
            fitToView
            selectedElement={selectedElement}
            polylineDraft={polylineDraft?.points}
            cubicBezierDraft={cubicBezierDraft?.points}
            sheetDraft={sheetPolygonDraft?.points}
            workPlanePreview={workPlanePreview}
            layerFilter={layerFilter}
            showGeometryHandles={creationTool === 'select'}
            onSelectionChange={
              creationTool === 'select' ? updateSelectedElement : undefined
            }
            onCanvasClick={
              creationTool === 'select' ? undefined : handlePreviewCreationClick
            }
            onGeometryHandleDrag={
              creationTool === 'select' ? handleGeometryHandleDrag : undefined
            }
            onGeometryHandleDragStart={
              creationTool === 'select' ? handleGeometryHandleDragStart : undefined
            }
            onGeometryHandleDragEnd={
              creationTool === 'select' ? handleGeometryHandleDragEnd : undefined
            }
          />
        </article>

        <article className="workspace-panel inspector-panel">
          <div className="panel-heading">
            <div>
              <h2>Inspector</h2>
              <span>basic fields and coordinates</span>
            </div>
          </div>
          <EditableInspector
            diagram={editableDiagram}
            selectedElement={selectedElement}
            onDiagramChange={updateEditableDiagram}
          />
        </article>

        <article className="workspace-panel source-panel">
          <div className="panel-heading">
            <div>
              <h2>Generated TikZ</h2>
              <span>read-only source</span>
            </div>
            <div className="copy-controls">
              <button type="button" className="copy-button" onClick={copyTikz}>
                Copy TikZ
              </button>
              <span className="copy-status" role="status">
                {copyStatus === 'copied' && 'Copied'}
                {copyStatus === 'failed' && 'Copy failed'}
              </span>
            </div>
          </div>
          <textarea
            className="tikz-source"
            value={tikzSource}
            readOnly
            spellCheck={false}
            aria-label="Generated TikZ source"
          />
        </article>
      </section>
    </main>
  )
}

function workPlaneLabel(kind: WorkPlane['kind']): string {
  switch (kind) {
    case 'xy':
      return 'xy plane'
    case 'xz':
      return 'xz plane'
    case 'yz':
      return 'yz plane'
  }
}

function geometryHandleTargetsSelection(
  target: GeometryHandleTarget,
  selectedElement: SelectedElement,
): boolean {
  if (selectedElement === null) {
    return false
  }

  switch (target.kind) {
    case 'pointPosition':
    case 'curvePoint':
    case 'sheetVertex':
      return (
        selectedElement.kind === 'stratum' &&
        selectedElement.id === target.stratumId
      )
    case 'labelPosition':
      return (
        selectedElement.kind === 'label' &&
        selectedElement.id === target.labelId
      )
  }
}

function isDirectCreationTool(tool: CreationTool): tool is DirectCreationTool {
  return tool !== 'select'
}

function isDirectPathCreationTool(
  tool: DirectCreationTool,
): tool is 'createPolyline' | 'createCubicBezier' | 'createSheet' {
  return (
    tool === 'createPolyline' ||
    tool === 'createCubicBezier' ||
    tool === 'createSheet'
  )
}

function directCreationTitle(tool: DirectCreationTool): string {
  switch (tool) {
    case 'createPoint':
      return 'Point'
    case 'createLabel':
      return 'Label'
    case 'createPolyline':
      return 'Polyline'
    case 'createCubicBezier':
      return 'Cubic Bezier'
    case 'createSheet':
      return 'Sheet'
  }
}

function directCreationErrorMessage(
  error: DirectPathCreationError,
  kind: 'polyline' | 'cubicBezier' | 'sheet',
): string {
  switch (error) {
    case 'invalidCoordinates':
      return 'Coordinates must be finite numbers.'
    case 'tooFewPoints':
      return kind === 'sheet'
        ? 'A sheet needs at least 3 vertices.'
        : 'A polyline needs at least 2 vertices.'
    case 'wrongPointCount':
      return 'A cubic Bezier needs exactly 4 points.'
    case 'unsupportedAmbientDimension':
      return 'Sheets are available only in 3D.'
  }
}

function directCoordinateRowsPlaceholder(
  ambientDimension: AmbientDimension,
): string {
  return ambientDimension === 2 ? '0 0\n1 0' : '0 0 0\n1 0 0'
}

function directCoordinateRowsTextAreaRows(
  tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
): number {
  switch (tool) {
    case 'createPolyline':
      return 3
    case 'createCubicBezier':
      return 4
    case 'createSheet':
      return 4
  }
}

function defaultDirectPolylineRows(
  ambientDimension: AmbientDimension,
): string {
  return ambientDimension === 2 ? '0 0\n1 0' : '0 0 0\n1 0 0'
}

function defaultDirectCubicBezierRows(
  ambientDimension: AmbientDimension,
): string {
  return ambientDimension === 2
    ? '0 0\n0.3 0.6\n0.7 0.6\n1 0'
    : '0 0 0\n0.3 0.6 0\n0.7 0.6 0\n1 0 0'
}

function defaultDirectSheetRows(): string {
  return '0 0 0\n1 0 0\n0 1 0'
}

function workPlaneFixedAxis(workPlane: WorkPlane): string {
  switch (workPlane.kind) {
    case 'xy':
      return 'z'
    case 'xz':
      return 'y'
    case 'yz':
      return 'x'
  }
}

function workPlaneFixedValue(workPlane: WorkPlane): number {
  switch (workPlane.kind) {
    case 'xy':
      return workPlane.z
    case 'xz':
      return workPlane.y
    case 'yz':
      return workPlane.x
  }
}

function layerFilterSelectValue(layerFilter: LayerFilter): string {
  return layerFilter.kind === 'all' ? 'all' : String(layerFilter.layer)
}

function parseLayerFilterSelectValue(value: string): LayerFilter {
  if (value === 'all') {
    return allLayersFilter
  }

  const layer = Number(value)

  return Number.isFinite(layer) ? { kind: 'layer', layer } : allLayersFilter
}

function directCoordinateAxes(
  ambientDimension: AmbientDimension,
): Array<keyof DirectCoordinateInput> {
  return ambientDimension === 2 ? ['x', 'y'] : ['x', 'y', 'z']
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function layerFilterStatusLabel(layerFilter: LayerFilter): string {
  return layerFilter.kind === 'all'
    ? 'all layers'
    : `layer ${formatLayerValue(layerFilter.layer)}`
}

function formatLayerValue(layer: number): string {
  return Number.isInteger(layer) ? String(layer) : String(layer)
}

export default App
