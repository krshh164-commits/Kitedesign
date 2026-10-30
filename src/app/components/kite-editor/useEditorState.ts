import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { snapshotEditorFlight, type FlightAdapterOptions } from './flightAdapter';
import { type DrawTool, type TweenState, type HitInfo, type HistoryAction } from './types';
import { SURFACE_POLYS, type CornerKey } from './templates';
export function useEditorState(kiteType: KiteType) {
  const [activeTool, setActiveTool] = useState<DrawTool>('pointer');
  const [stampColor, setStampColor] = useState('#ff3333');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [mode, setMode] = useState<'build' | 'design'>('build');
  const [cornerHover, setCornerHover] = useState<CornerKey | null>(null);
  const [cornerHoverPos, setCornerHoverPos] = useState({
    x: 0,
    y: 0
  });
  const [panelCorner, setPanelCorner] = useState<CornerKey | null>(null);
  const [fadeKey, setFadeKey] = useState(0);
  const bumpHistory = () => setHistoryTick(t => t + 1);
  const modeRef = useRef<'build' | 'design'>('build');
  const FACE_COLORS = [0xff0000, 0xffff00, 0x0000ff, 0x00ff00];
  const BUILD_GRAY = 0xB0B0B0;
  const SPAR_COLOR = 0x4a2c0a;
  const applyModeColors = (m: 'build' | 'design') => {
    const isBuild = m === 'build';
    kiteFacesRef.current.filter(mesh => mesh.userData.surfaceIdx === 0).forEach(mesh => {
      (mesh.material as THREE.MeshPhongMaterial).color.setHex(isBuild ? BUILD_GRAY : 0xf5f5f5);
    });
    if (tailMeshRef.current) {
      const origColor = tailMeshRef.current.userData.originalColor as number | undefined ?? 0xff0000;
      (tailMeshRef.current.material as THREE.MeshPhongMaterial).color.setHex(isBuild ? BUILD_GRAY : 0xf5f5f5);
    }
    if (vSparRef.current) (vSparRef.current.material as THREE.MeshPhongMaterial).color.setHex(isBuild ? 0x333333 : SPAR_COLOR);
    if (hSparRef.current) (hSparRef.current.material as THREE.MeshPhongMaterial).color.setHex(isBuild ? 0x333333 : SPAR_COLOR);
    // Hide paint layers on build parts in Build mode; show them in Design mode.
    surfaceDrawingsRef.current.slice(SURFACE_POLYS.length).forEach(g => {
      if (g) g.visible = !isBuild;
    });
  };
  const activeToolRef = useRef<DrawTool>('pointer');
  const stampColorRef = useRef('#ff3333');
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    stampColorRef.current = stampColor;
  }, [stampColor]);
  const containerRef = useRef<HTMLDivElement>(null);
  const gizmoCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const kiteGroupRef = useRef<THREE.Group | null>(null);
  const kiteFacesRef = useRef<THREE.Mesh[]>([]);
  const buildSurfMeshesRef = useRef<THREE.Mesh[]>([]);
  const cornerPartsRef = useRef<Partial<Record<CornerKey, THREE.Mesh>>>({});
  const cornerMorphRef = useRef<{
    mesh: THREE.Mesh;
    startTime: number;
    dir: 1 | -1;
    onDone?: () => void;
  } | null>(null);
  const cornerHoverRef = useRef<CornerKey | null>(null);
  const tailMeshRef = useRef<THREE.Mesh | null>(null);
  const vSparRef = useRef<THREE.Mesh | null>(null);
  const hSparRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const tweenRef = useRef<TweenState | null>(null);
  const highlightMeshesRef = useRef<THREE.Mesh[]>([]);
  const borderMeshesRef = useRef<THREE.Mesh[]>([]);
  const selectedFaceRef = useRef<number>(-1);
  const clippingPlanesRef = useRef<THREE.Plane[]>([]);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<HitInfo | null>(null);
  const previewMeshRef = useRef<THREE.Mesh | null>(null);
  const brushGroupRef = useRef<THREE.Group | null>(null);
  const brushLastPtRef = useRef<THREE.Vector3 | null>(null);
  const surfaceDrawingsRef = useRef<THREE.Group[]>([]);
  const buildGroupRef = useRef<THREE.Group | null>(null);
  const drawOrderRef = useRef(10);
  const undoStacksByModeRef = useRef<Record<'build' | 'design', HistoryAction[][]>>({
    build: [],
    design: []
  });
  const redoStacksByModeRef = useRef<Record<'build' | 'design', HistoryAction[][]>>({
    build: [],
    design: []
  });
  const getUndo = () => undoStacksByModeRef.current[modeRef.current];
  const getRedo = () => redoStacksByModeRef.current[modeRef.current];
  const selectedStampRef = useRef<THREE.Mesh | null>(null);
  const selectionGroupRef = useRef<THREE.Group | null>(null);
  const handleMeshesRef = useRef<{
    mesh: THREE.Mesh;
    role: string;
  }[]>([]);
  const dragStateRef = useRef<null | {
    mode: DragMode;
    startPointerLocal: THREE.Vector3; // pointer on surface plane (kite-local) at drag start
    before: TransformSnap;
    linked?: { obj: THREE.Mesh; before: TransformSnap };
    centerLocal: THREE.Vector3;
    halfLocal: THREE.Vector2; // half extents in stamp-local space (unscaled geometry bbox)
    rotZ: number; // initial rotation around local Z
    surfaceIdx: number;
  }>(null);
  const gizmoRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gizmoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const gizmoSpritesRef = useRef<{
    sprite: THREE.Sprite;
    key: AxisKey;
    faded: boolean;
  }[]>([]);
  const gizmoAllRef = useRef<THREE.Object3D[]>([]);
  return {
    snapshotFlight: (options: FlightAdapterOptions = {}) => snapshotEditorFlight({
      kiteGroupRef, kiteFacesRef, buildGroupRef, vSparRef, hSparRef,
    }, options),
    activeTool,
    setActiveTool,
    stampColor,
    setStampColor,
    colorPickerOpen,
    setColorPickerOpen,
    historyTick,
    setHistoryTick,
    mode,
    setMode,
    cornerHover,
    setCornerHover,
    cornerHoverPos,
    setCornerHoverPos,
    panelCorner,
    setPanelCorner,
    fadeKey,
    setFadeKey,
    bumpHistory,
    modeRef,
    FACE_COLORS,
    BUILD_GRAY,
    SPAR_COLOR,
    applyModeColors,
    activeToolRef,
    stampColorRef,
    containerRef,
    gizmoCanvasRef,
    cameraRef,
    controlsRef,
    rendererRef,
    kiteGroupRef,
    kiteFacesRef,
    buildSurfMeshesRef,
    cornerPartsRef,
    cornerMorphRef,
    cornerHoverRef,
    tailMeshRef,
    vSparRef,
    hSparRef,
    animationFrameRef,
    tweenRef,
    highlightMeshesRef,
    borderMeshesRef,
    selectedFaceRef,
    clippingPlanesRef,
    isDrawingRef,
    drawStartRef,
    previewMeshRef,
    brushGroupRef,
    brushLastPtRef,
    surfaceDrawingsRef,
    buildGroupRef,
    drawOrderRef,
    undoStacksByModeRef,
    redoStacksByModeRef,
    getUndo,
    getRedo,
    selectedStampRef,
    selectionGroupRef,
    handleMeshesRef,
    dragStateRef,
    gizmoRendererRef,
    gizmoCameraRef,
    gizmoSpritesRef,
    gizmoAllRef,
    kiteType
  };
}
