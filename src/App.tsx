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
  normalizePointForAmbientDimension,
  screenToModelOnWorkPlane,
} from './geometry'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from './model/serialization.ts'
import type {
  AmbientDimension,
  AxisAlignedWorkPlaneName,
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
  createCustomWorkPlanePreview,
  createDiagramHistory,
  createSheetPolygonDraft,
  defaultCustomOriginNormalWorkPlaneInput,
  defaultCustomThreePointWorkPlaneInput,
  defaultJsonDownloadFilename,
  deriveAvailableLayers,
  EditableInspector,
  findSelectedElement,
  layerFilterIncludesLayer,
  normalizeLayerFilterForDiagram,
  normalizeJsonDownloadFilename,
  normalizeActiveWorkPlaneForDiagram,
  normalizeActiveWorkPlaneForAmbientDimension,
  parseDirectCoordinateRows,
  parseDirectLayerInput,
  redoLastDiagramChange,
  removeSelectedElementWithLayerFilter,
  sheetDraftBlocksWorkPlaneChange,
  shouldShowWorkPlaneControls,
  undoLastDiagramChange,
  updateDiagramGeometryHandle,
  applyCustomOriginNormalWorkPlaneInput,
  applyCustomThreePointWorkPlaneInput,
  applyPickedPointWorkPlane,
  cancelWorkPlanePointPicking,
  inactiveWorkPlanePointPickingState,
  pickWorkPlanePointStratum,
  resetWorkPlanePointPicking,
  shouldBlockCreationForWorkPlanePointPicking,
  startWorkPlanePointPicking,
  validateWorkPlanePointPickingState,
  workPlanePointPickingStatus,
  workPlaneDisplayName,
  workPlaneSelectValue,
  type CustomOriginNormalWorkPlaneInput,
  type CustomThreePointWorkPlaneInput,
  type DirectCoordinateInput,
  type DirectCoordinateMode,
  type DirectCubicBezierControlMode,
  type DirectPathCreationError,
  type DiagramHistory,
  type GeometryHandleTarget,
  type LayerFilter,
  type SelectedElement,
  type SheetPolygonDraft,
  type WorkPlanePointPickingState,
  type WorkPlaneSelectValue,
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
  history: DiagramHistory
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
const directCoordinateModes: DirectCoordinateMode[] = ['global', 'workPlaneLocal']
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
const workPlaneKinds: AxisAlignedWorkPlaneName[] = ['xy', 'xz', 'yz']
const workPlaneVectorAxes: Array<keyof CustomOriginNormalWorkPlaneInput['origin']> =
  ['x', 'y', 'z']
const directCubicBezierControlModes: DirectCubicBezierControlMode[] = [
  'absolute',
  'relativeCartesian',
  'relativePolar',
]

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
  const [directCoordinateMode, setDirectCoordinateMode] =
    useState<DirectCoordinateMode>('global')
  const [directLabelText, setDirectLabelText] = useState<string>('Label')
  const [directLayerInput, setDirectLayerInput] = useState<string>('0')
  const [directPolylineRows, setDirectPolylineRows] = useState<string>(
    defaultDirectPolylineRows(2),
  )
  const [directCubicBezierRows, setDirectCubicBezierRows] = useState<string>(
    defaultDirectCubicBezierRows(2),
  )
  const [directCubicBezierControlMode, setDirectCubicBezierControlMode] =
    useState<DirectCubicBezierControlMode>('absolute')
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
  const [customWorkPlaneInput, setCustomWorkPlaneInput] =
    useState<CustomOriginNormalWorkPlaneInput>(
      defaultCustomOriginNormalWorkPlaneInput,
    )
  const [customThreePointWorkPlaneInput, setCustomThreePointWorkPlaneInput] =
    useState<CustomThreePointWorkPlaneInput>(
      defaultCustomThreePointWorkPlaneInput,
    )
  const [workPlanePointPickingState, setWorkPlanePointPickingState] =
    useState<WorkPlanePointPickingState>(inactiveWorkPlanePointPickingState)
  const [workPlaneStatus, setWorkPlaneStatus] = useState<string>('')
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [editorState, setEditorState] = useState<EditableEditorState>(() => {
    const initialDiagram = cloneDiagram(exampleOptions[0].diagram)

    return {
      editableDiagram: initialDiagram,
      selectedElement: null,
      layerFilter: allLayersFilter,
      polylineDraft: null,
      cubicBezierDraft: null,
      sheetPolygonDraft: null,
      history: createDiagramHistory(initialDiagram),
    }
  })
  const {
    editableDiagram,
    selectedElement,
    layerFilter,
    polylineDraft,
    cubicBezierDraft,
    sheetPolygonDraft,
    history,
  } = editorState
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
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
    return createCustomWorkPlanePreview(
      editableDiagram.ambientDimension,
      creationTool,
      previewWorkPlane,
      {
        label:
          sheetPolygonDraft === null
            ? 'custom work plane'
            : `sheet draft ${workPlaneDisplayName(previewWorkPlane)}`,
      },
    )
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
    setDirectCoordinateMode('global')
    setDirectPolylineRows(defaultDirectPolylineRows(nextDiagram.ambientDimension))
    setDirectCubicBezierControlMode('absolute')
    setDirectCubicBezierRows(defaultDirectCubicBezierRows(nextDiagram.ambientDimension))
    setDirectSheetRows(defaultDirectSheetRows())
    setActiveWorkPlane(
      normalizeActiveWorkPlaneForAmbientDimension(nextDiagram.ambientDimension, {
        kind: 'xy',
        z: 0,
      }),
    )
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setWorkPlaneStatus('')
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
    if (!canUndo) {
      return
    }

    const previousDiagram = history.past[history.past.length - 1]

    setSelectedExampleId(previousDiagram.ambientDimension === 2 ? '2d' : '3d')
    geometryDragUndoDiagramRef.current = null
    setEditorState((current) => undoLastDiagramChange(current))
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setCopyStatus('idle')
    setSaveLoadStatus('idle')
    setSaveLoadMessage('')
    setPolylineStatus('')
    setCubicBezierStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setWorkPlaneStatus('')
  }, [canUndo, history.past])

  const redoLastChange = useCallback(function redoLastChange(): void {
    if (!canRedo) {
      return
    }

    const nextDiagram = history.future[0]

    setSelectedExampleId(nextDiagram.ambientDimension === 2 ? '2d' : '3d')
    geometryDragUndoDiagramRef.current = null
    setEditorState((current) => redoLastDiagramChange(current))
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setCopyStatus('idle')
    setSaveLoadStatus('idle')
    setSaveLoadMessage('')
    setPolylineStatus('')
    setCubicBezierStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setWorkPlaneStatus('')
  }, [canRedo, history.future])

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
    setDirectCoordinateMode('global')
    setDirectPolylineRows(defaultDirectPolylineRows(result.diagram.ambientDimension))
    setDirectCubicBezierControlMode('absolute')
    setDirectCubicBezierRows(defaultDirectCubicBezierRows(result.diagram.ambientDimension))
    setDirectSheetRows(defaultDirectSheetRows())
    setActiveWorkPlane({ kind: 'xy', z: 0 })
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setWorkPlaneStatus('')
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
    setActiveWorkPlane((current) =>
      normalizeActiveWorkPlaneForDiagram(editableDiagram, current),
    )
  }, [editableDiagram])

  useEffect(() => {
    if (editableDiagram.ambientDimension === 2) {
      setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
      setWorkPlaneStatus('')
    }
  }, [editableDiagram.ambientDimension])

  useEffect(() => {
    setWorkPlanePointPickingState((current) => {
      const validation = validateWorkPlanePointPickingState(
        editableDiagram,
        current,
      )

      if (validation.removedStalePointIds.length > 0) {
        setWorkPlaneStatus(
          `${workPlanePointPickingStatus(validation.state)} Removed unavailable points.`,
        )
      }

      return validation.state
    })
  }, [editableDiagram])

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
    function handleHistoryShortcut(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.altKey || isEditableKeyboardTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      const usesCommandModifier = event.metaKey || event.ctrlKey
      const shouldUndo = key === 'z' && usesCommandModifier && !event.shiftKey
      const shouldRedo =
        (key === 'z' && usesCommandModifier && event.shiftKey) ||
        (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey)

      if (shouldUndo && canUndo) {
        event.preventDefault()
        undoLastChange()
        return
      }

      if (shouldRedo && canRedo) {
        event.preventDefault()
        redoLastChange()
      }
    }

    window.addEventListener('keydown', handleHistoryShortcut)

    return () => {
      window.removeEventListener('keydown', handleHistoryShortcut)
    }
  }, [canRedo, canUndo, redoLastChange, undoLastChange])

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
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      return
    }

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
      let modelPoint: Vec3

      try {
        modelPoint = normalizePointForAmbientDimension(
          current.editableDiagram.ambientDimension,
          screenToModelOnWorkPlane(
            { x: svgPoint.x, y: viewportHeight - svgPoint.y },
            placementWorkPlane,
            previewCamera,
          ),
        )
      } catch {
        return current
      }

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
            { x: svgPoint.x, y: viewportHeight - svgPoint.y },
            activeWorkPlane,
            previewCamera,
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

  function updateDirectCubicBezierControlMode(
    mode: DirectCubicBezierControlMode,
  ): void {
    const nextMode =
      editableDiagram.ambientDimension === 3 && mode === 'relativePolar'
        ? 'absolute'
        : mode

    setDirectCubicBezierControlMode(nextMode)
    setDirectCubicBezierRows(
      defaultDirectCubicBezierRows(
        editableDiagram.ambientDimension,
        nextMode,
        effectiveDirectCoordinateMode(
          editableDiagram.ambientDimension,
          directCoordinateMode,
        ),
      ),
    )
    setDirectCreationStatus('')
  }

  function updateDirectCoordinateMode(mode: DirectCoordinateMode): void {
    const nextMode = effectiveDirectCoordinateMode(
      editableDiagram.ambientDimension,
      mode,
    )

    setDirectCoordinateMode(nextMode)
    setDirectPolylineRows(
      defaultDirectPolylineRows(editableDiagram.ambientDimension, nextMode),
    )
    setDirectCubicBezierRows(
      defaultDirectCubicBezierRows(
        editableDiagram.ambientDimension,
        directCubicBezierControlMode,
        nextMode,
      ),
    )
    setDirectSheetRows(defaultDirectSheetRows(nextMode))
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
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setDirectCreationStatus('Finish or cancel point picking first.')
      return
    }

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
        directCreationCoordinateOptions({ layer: directLayer }),
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
        directCreationCoordinateOptions({ layer: directLayer }),
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
      {
        coordinateMode: effectiveDirectCoordinateMode(
          editableDiagram.ambientDimension,
          directCoordinateMode,
        ),
      },
    )

    if (coordinateRows === null) {
      setDirectCreationStatus('Coordinates must be finite rows.')
      return
    }

    if (creationTool === 'createPolyline') {
      const result = addPolylineCurveFromDirectInput(
        editableDiagram,
        coordinateRows,
        directCreationCoordinateOptions({ layer: directLayer }),
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
      directCreationCoordinateOptions({
        layer: directLayer,
        directControlMode: directCubicBezierControlMode,
      }),
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
      {
        coordinateMode: effectiveDirectCoordinateMode(
          editableDiagram.ambientDimension,
          directCoordinateMode,
        ),
      },
    )

    if (coordinateRows === null) {
      setDirectCreationStatus('Coordinates must be finite rows.')
      return
    }

    const result = addPolygonSheetFromDirectInput(
      editableDiagram,
      coordinateRows,
      directCreationCoordinateOptions({ layer: directLayer }),
    )

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

  function directCreationCoordinateOptions<T extends object>(options: T): T & {
    coordinateMode: DirectCoordinateMode
    workPlane: WorkPlane
  } {
    return {
      ...options,
      coordinateMode: effectiveDirectCoordinateMode(
        editableDiagram.ambientDimension,
        directCoordinateMode,
      ),
      workPlane: activeWorkPlane,
    }
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
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setPolylineStatus('Finish or cancel point picking first.')
      return
    }

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
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setSheetStatus('Finish or cancel point picking first.')
      return
    }

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

  function updateWorkPlaneKind(kind: AxisAlignedWorkPlaneName): void {
    if (sheetDraftBlocksWorkPlaneChange(sheetPolygonDraft)) {
      setSheetStatus('Finish or cancel the sheet before changing work plane.')
      setWorkPlaneStatus('Finish or cancel the sheet before changing work plane.')
      return
    }

    setWorkPlaneStatus('')
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
      setWorkPlaneStatus('Finish or cancel the sheet before changing work plane.')
      return
    }

    const fixedValue = Number(rawValue)

    if (!Number.isFinite(fixedValue)) {
      setWorkPlaneStatus('Fixed coordinate must be finite.')
      return
    }

    setWorkPlaneStatus('')
    setActiveWorkPlane((current) => {
      switch (current.kind) {
        case 'xy':
          return { ...current, z: fixedValue }
        case 'xz':
          return { ...current, y: fixedValue }
        case 'yz':
          return { ...current, x: fixedValue }
        case 'axisAligned':
          return { ...current, offset: fixedValue }
        case 'custom':
          return current
      }
    })
  }

  function updateCustomWorkPlaneVectorInput(
    vector: keyof CustomOriginNormalWorkPlaneInput,
    axis: keyof CustomOriginNormalWorkPlaneInput['origin'],
    value: string,
  ): void {
    setCustomWorkPlaneInput((current) => ({
      ...current,
      [vector]: {
        ...current[vector],
        [axis]: value,
      },
    }))
    setWorkPlaneStatus('')
  }

  function updateCustomThreePointWorkPlaneVectorInput(
    point: keyof CustomThreePointWorkPlaneInput,
    axis: keyof CustomThreePointWorkPlaneInput['p0'],
    value: string,
  ): void {
    setCustomThreePointWorkPlaneInput((current) => ({
      ...current,
      [point]: {
        ...current[point],
        [axis]: value,
      },
    }))
    setWorkPlaneStatus('')
  }

  function applyCustomOriginNormalWorkPlane(): void {
    if (sheetDraftBlocksWorkPlaneChange(sheetPolygonDraft)) {
      setSheetStatus('Finish or cancel the sheet before changing work plane.')
      setWorkPlaneStatus('Finish or cancel the sheet before changing work plane.')
      return
    }

    const result = applyCustomOriginNormalWorkPlaneInput(
      activeWorkPlane,
      editableDiagram.ambientDimension,
      customWorkPlaneInput,
    )

    setWorkPlaneStatus(result.status)

    if (result.ok) {
      setActiveWorkPlane(result.workPlane)
    }
  }

  function applyCustomThreePointWorkPlane(): void {
    if (sheetDraftBlocksWorkPlaneChange(sheetPolygonDraft)) {
      setSheetStatus('Finish or cancel the sheet before changing work plane.')
      setWorkPlaneStatus('Finish or cancel the sheet before changing work plane.')
      return
    }

    const result = applyCustomThreePointWorkPlaneInput(
      activeWorkPlane,
      editableDiagram.ambientDimension,
      customThreePointWorkPlaneInput,
    )

    setWorkPlaneStatus(result.status)

    if (result.ok) {
      setActiveWorkPlane(result.workPlane)
    }
  }

  function startExistingPointWorkPlanePicking(): void {
    if (sheetDraftBlocksWorkPlaneChange(sheetPolygonDraft)) {
      setSheetStatus('Finish or cancel the sheet before changing work plane.')
      setWorkPlaneStatus('Finish or cancel the sheet before changing work plane.')
      return
    }

    const result = startWorkPlanePointPicking(editableDiagram.ambientDimension)

    setWorkPlanePointPickingState(result.state)
    setWorkPlaneStatus(result.status)
  }

  function pickExistingPointForWorkPlane(pointId: string): void {
    setWorkPlanePointPickingState((current) => {
      const result = pickWorkPlanePointStratum(current, pointId)

      setWorkPlaneStatus(result.status)
      return result.state
    })
  }

  function resetExistingPointWorkPlanePicking(): void {
    const result = resetWorkPlanePointPicking()

    setWorkPlanePointPickingState(result.state)
    setWorkPlaneStatus(result.status)
  }

  function cancelExistingPointWorkPlanePicking(): void {
    const result = cancelWorkPlanePointPicking()

    setWorkPlanePointPickingState(result.state)
    setWorkPlaneStatus(result.status)
  }

  function applyExistingPointWorkPlane(): void {
    if (sheetDraftBlocksWorkPlaneChange(sheetPolygonDraft)) {
      setSheetStatus('Finish or cancel the sheet before changing work plane.')
      setWorkPlaneStatus('Finish or cancel the sheet before changing work plane.')
      return
    }

    const result = applyPickedPointWorkPlane(
      activeWorkPlane,
      editableDiagram.ambientDimension,
      editableDiagram,
      workPlanePointPickingState,
    )

    setWorkPlaneStatus(result.status)

    if (result.ok) {
      setActiveWorkPlane(result.workPlane)
      setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    }
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
              {editableDiagram.ambientDimension === 3 && (
                <label className="direct-create-field direct-coordinate-mode-field">
                  <span>Coordinate mode</span>
                  <select
                    value={directCoordinateMode}
                    onChange={(event) =>
                      updateDirectCoordinateMode(
                        event.currentTarget.value as DirectCoordinateMode,
                      )
                    }
                  >
                    {directCoordinateModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {directCoordinateModeLabel(mode)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
                directCoordinateAxes(
                  editableDiagram.ambientDimension,
                  effectiveDirectCoordinateMode(
                    editableDiagram.ambientDimension,
                    directCoordinateMode,
                  ),
                ).map((axis) => (
                  <label key={axis} className="direct-create-field">
                    <span>
                      {directCoordinateAxisLabel(
                        axis,
                        editableDiagram.ambientDimension,
                        directCoordinateMode,
                      )}
                    </span>
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
                <>
                  {creationTool === 'createCubicBezier' && (
                    <label className="direct-create-field">
                      <span>Controls</span>
                      <select
                        value={directCubicBezierControlMode}
                        onChange={(event) =>
                          updateDirectCubicBezierControlMode(
                            event.currentTarget
                              .value as DirectCubicBezierControlMode,
                          )
                        }
                      >
                        {directCubicBezierControlModeOptions(
                          editableDiagram.ambientDimension,
                        ).map((mode) => (
                          <option key={mode} value={mode}>
                            {directCubicBezierControlModeLabel(mode)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="direct-create-field direct-coordinate-list">
                    <span>
                      {directRowsLabel(
                        creationTool,
                        directCubicBezierControlMode,
                      )}
                    </span>
                    <textarea
                      value={directRowsForCreationToolValue(creationTool)}
                      rows={directCoordinateRowsTextAreaRows(creationTool)}
                      spellCheck={false}
                      placeholder={directCoordinateRowsPlaceholder(
                        editableDiagram.ambientDimension,
                        creationTool === 'createCubicBezier'
                          ? directCubicBezierControlMode
                          : 'absolute',
                        effectiveDirectCoordinateMode(
                          editableDiagram.ambientDimension,
                          directCoordinateMode,
                        ),
                      )}
                      onChange={(event) =>
                        updateDirectRowsForCreationTool(
                          creationTool,
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>
                </>
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
            disabled={!canUndo}
            onClick={undoLastChange}
            title="Undo last diagram change"
          >
            Undo
          </button>
          <button
            type="button"
            className="toolbar-button"
            disabled={!canRedo}
            onClick={redoLastChange}
            title="Redo the last undone diagram change"
          >
            Redo
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

        {shouldShowWorkPlaneControls(editableDiagram.ambientDimension) && (
          <div className="control-group work-plane-control">
            <span className="control-label">Work plane</span>
            <select
              className="toolbar-select"
              value={workPlaneSelectValue(activeWorkPlane)}
              onChange={(event) => {
                const value = event.currentTarget.value as WorkPlaneSelectValue

                if (value !== 'custom') {
                  updateWorkPlaneKind(value)
                }
              }}
            >
              {activeWorkPlane.kind === 'custom' && (
                <option value="custom">{activeWorkPlane.name}</option>
              )}
              {workPlaneKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {workPlaneLabel(kind)}
                </option>
              ))}
            </select>
            {activeWorkPlane.kind !== 'custom' && (
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
            )}
            <form
              className="custom-work-plane-form"
              aria-label="Custom plane by origin and normal"
              onSubmit={(event) => {
                event.preventDefault()
                applyCustomOriginNormalWorkPlane()
              }}
            >
              <span className="control-label">
                Custom plane by origin + normal
              </span>
              <fieldset className="custom-work-plane-vector">
                <legend>Origin</legend>
                {workPlaneVectorAxes.map((axis) => (
                  <label key={axis} className="custom-work-plane-field">
                    <span>{axis}</span>
                    <input
                      type="number"
                      step="any"
                      value={customWorkPlaneInput.origin[axis]}
                      onChange={(event) =>
                        updateCustomWorkPlaneVectorInput(
                          'origin',
                          axis,
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>
                ))}
              </fieldset>
              <fieldset className="custom-work-plane-vector">
                <legend>Normal</legend>
                {workPlaneVectorAxes.map((axis) => (
                  <label key={axis} className="custom-work-plane-field">
                    <span>{axis}</span>
                    <input
                      type="number"
                      step="any"
                      value={customWorkPlaneInput.normal[axis]}
                      onChange={(event) =>
                        updateCustomWorkPlaneVectorInput(
                          'normal',
                          axis,
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>
                ))}
              </fieldset>
              <button type="submit" className="toolbar-button">
                Apply
              </button>
            </form>
            <form
              className="custom-work-plane-form"
              aria-label="Custom plane by three points"
              onSubmit={(event) => {
                event.preventDefault()
                applyCustomThreePointWorkPlane()
              }}
            >
              <span className="control-label">Custom plane by 3 points</span>
              {(['p0', 'p1', 'p2'] as const).map((point) => (
                <fieldset key={point} className="custom-work-plane-vector">
                  <legend>{point.toUpperCase()}</legend>
                  {workPlaneVectorAxes.map((axis) => (
                    <label key={axis} className="custom-work-plane-field">
                      <span>{axis}</span>
                      <input
                        type="number"
                        step="any"
                        value={customThreePointWorkPlaneInput[point][axis]}
                        onChange={(event) =>
                          updateCustomThreePointWorkPlaneVectorInput(
                            point,
                            axis,
                            event.currentTarget.value,
                          )
                        }
                      />
                    </label>
                  ))}
                </fieldset>
              ))}
              <button type="submit" className="toolbar-button">
                Apply
              </button>
            </form>
            <div
              className="custom-work-plane-form work-plane-point-picker"
              aria-label="Custom plane from existing point strata"
            >
              <span className="control-label">Pick 3 points for work plane</span>
              <button
                type="button"
                className="toolbar-button"
                disabled={workPlanePointPickingState.active}
                onClick={startExistingPointWorkPlanePicking}
              >
                Pick points
              </button>
              <span className="toolbar-status" role="status">
                {workPlanePointPickingState.active
                  ? workPlanePointPickingStatus(workPlanePointPickingState)
                  : ''}
              </span>
              <button
                type="button"
                className="toolbar-button"
                disabled={!workPlanePointPickingState.active}
                onClick={resetExistingPointWorkPlanePicking}
              >
                Reset
              </button>
              <button
                type="button"
                className="toolbar-button"
                disabled={!workPlanePointPickingState.active}
                onClick={cancelExistingPointWorkPlanePicking}
              >
                Cancel
              </button>
              <button
                type="button"
                className="toolbar-button"
                disabled={
                  !workPlanePointPickingState.active ||
                  workPlanePointPickingState.pickedPointIds.length !== 3
                }
                onClick={applyExistingPointWorkPlane}
              >
                Apply
              </button>
            </div>
            <span className="toolbar-status" role="status">
              {workPlaneStatus}
            </span>
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
            showGeometryHandles={
              creationTool === 'select' && !workPlanePointPickingState.active
            }
            onSelectionChange={
              creationTool === 'select' && !workPlanePointPickingState.active
                ? updateSelectedElement
                : undefined
            }
            onCanvasClick={
              creationTool === 'select' || workPlanePointPickingState.active
                ? undefined
                : handlePreviewCreationClick
            }
            onPointStratumClick={
              workPlanePointPickingState.active
                ? pickExistingPointForWorkPlane
                : undefined
            }
            onGeometryHandleDrag={
              creationTool === 'select' && !workPlanePointPickingState.active
                ? handleGeometryHandleDrag
                : undefined
            }
            onGeometryHandleDragStart={
              creationTool === 'select' && !workPlanePointPickingState.active
                ? handleGeometryHandleDragStart
                : undefined
            }
            onGeometryHandleDragEnd={
              creationTool === 'select' && !workPlanePointPickingState.active
                ? handleGeometryHandleDragEnd
                : undefined
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

function workPlaneLabel(kind: AxisAlignedWorkPlaneName): string {
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
  controlMode: DirectCubicBezierControlMode = 'absolute',
  coordinateMode: DirectCoordinateMode = 'global',
): string {
  if (controlMode === 'relativePolar') {
    return '0 0\n1 0\n60 0.7\n120 0.7'
  }

  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return '0 0\n1 0'
  }

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
  coordinateMode: DirectCoordinateMode = 'global',
): string {
  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return '0 0\n1 0'
  }

  return ambientDimension === 2 ? '0 0\n1 0' : '0 0 0\n1 0 0'
}

function defaultDirectCubicBezierRows(
  ambientDimension: AmbientDimension,
  controlMode: DirectCubicBezierControlMode = 'absolute',
  coordinateMode: DirectCoordinateMode = 'global',
): string {
  if (controlMode === 'relativeCartesian') {
    if (
      ambientDimension === 3 &&
      coordinateMode === 'workPlaneLocal'
    ) {
      return '0 0\n1 0\n0.3 0.6\n-0.3 0.6'
    }

    return ambientDimension === 2
      ? '0 0\n1 0\n0.3 0.6\n-0.3 0.6'
      : '0 0 0\n1 0 0\n0.3 0.6 0\n-0.3 0.6 0'
  }

  if (controlMode === 'relativePolar') {
    return '0 0\n1 0\n60 0.7\n120 0.7'
  }

  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return '0 0\n0.3 0.6\n0.7 0.6\n1 0'
  }

  return ambientDimension === 2
    ? '0 0\n0.3 0.6\n0.7 0.6\n1 0'
    : '0 0 0\n0.3 0.6 0\n0.7 0.6 0\n1 0 0'
}

function directCubicBezierControlModeOptions(
  ambientDimension: AmbientDimension,
): DirectCubicBezierControlMode[] {
  return ambientDimension === 2
    ? directCubicBezierControlModes
    : directCubicBezierControlModes.filter((mode) => mode !== 'relativePolar')
}

function directCubicBezierControlModeLabel(
  controlMode: DirectCubicBezierControlMode,
): string {
  switch (controlMode) {
    case 'absolute':
      return 'Absolute'
    case 'relativeCartesian':
      return 'Relative Cartesian'
    case 'relativePolar':
      return 'Relative polar'
  }
}

function directCoordinateModeLabel(mode: DirectCoordinateMode): string {
  switch (mode) {
    case 'global':
      return 'Global 3D coordinates'
    case 'workPlaneLocal':
      return 'Active work-plane local coordinates'
  }
}

function directRowsLabel(
  tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
  controlMode: DirectCubicBezierControlMode,
): string {
  if (tool !== 'createCubicBezier') {
    return 'Vertices'
  }

  switch (controlMode) {
    case 'absolute':
      return 'Points'
    case 'relativeCartesian':
      return 'Start, end, offsets'
    case 'relativePolar':
      return 'Start, end, polar'
  }
}

function defaultDirectSheetRows(
  coordinateMode: DirectCoordinateMode = 'global',
): string {
  if (coordinateMode === 'workPlaneLocal') {
    return '0 0\n1 0\n0 1'
  }

  return '0 0 0\n1 0 0\n0 1 0'
}

function workPlaneFixedAxis(workPlane: WorkPlane): string {
  const kind =
    workPlane.kind === 'axisAligned' ? workPlane.plane : workPlane.kind

  switch (kind) {
    case 'xy':
      return 'z'
    case 'xz':
      return 'y'
    case 'yz':
      return 'x'
    case 'custom':
      return 'offset'
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
    case 'axisAligned':
      return workPlane.offset
    case 'custom':
      return 0
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
  coordinateMode: DirectCoordinateMode = 'global',
): Array<keyof DirectCoordinateInput> {
  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return ['x', 'y']
  }

  return ambientDimension === 2 ? ['x', 'y'] : ['x', 'y', 'z']
}

function directCoordinateAxisLabel(
  axis: keyof DirectCoordinateInput,
  ambientDimension: AmbientDimension,
  coordinateMode: DirectCoordinateMode,
): string {
  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return axis === 'x' ? 'a' : 'b'
  }

  return axis
}

function effectiveDirectCoordinateMode(
  ambientDimension: AmbientDimension,
  coordinateMode: DirectCoordinateMode,
): DirectCoordinateMode {
  return ambientDimension === 3 ? coordinateMode : 'global'
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
