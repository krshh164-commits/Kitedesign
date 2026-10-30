import { useEffect } from 'react';
import { useEditorState } from './kite-editor/useEditorState';
import { useSelection } from './kite-editor/useSelection';
import { useHistory } from './kite-editor/useHistory';
import { useDrawing } from './kite-editor/useDrawing';
import { useGizmo } from './kite-editor/useGizmo';
import { useAttachments } from './kite-editor/useAttachments';
import { useKiteScene } from './kite-editor/useKiteScene';
import { EditorControls } from './kite-editor/EditorControls';
export function KiteViewer({
  kiteType = 'classic'
}: {
  kiteType?: KiteType;
}) {
  const state = useEditorState(kiteType);
  const selection = useSelection(state);
  const history = useHistory({
    ...state,
    ...selection
  });
  const drawing = useDrawing({
    ...state,
    ...selection,
    ...history
  });
  const gizmo = useGizmo({
    ...state,
    ...selection,
    ...history,
    ...drawing
  });
  const attachments = useAttachments({
    ...state,
    ...selection,
    ...history,
    ...drawing,
    ...gizmo
  });
  const context = {
    ...state,
    ...selection,
    ...history,
    ...drawing,
    ...gizmo,
    ...attachments
  };
  const {
    activeTool,
    mode,
    setFadeKey,
    bumpHistory,
    modeRef,
    applyModeColors,
    controlsRef,
    kiteGroupRef,
    highlightMeshesRef,
    borderMeshesRef,
    selectedFaceRef,
    clippingPlanesRef,
    selectedStampRef,
    clearSelection
  } = context;
  useEffect(() => {
    drawing.finalizeDrawing();
    modeRef.current = mode;
    state.setColorPickerOpen(false);
    if (mode === 'build' && state.activeToolRef.current === 'brush') {
      state.activeToolRef.current = 'pointer';
      state.setActiveTool('pointer');
    }
    applyModeColors(mode);
    setFadeKey(k => k + 1);
    if (selectedStampRef.current) clearSelection();
    // hide kite-surface visuals (hover fill + selection border) on mode switch
    highlightMeshesRef.current.forEach(h => {
      h.visible = false;
    });
    borderMeshesRef.current.forEach(b => {
      b.visible = false;
    });
    selectedFaceRef.current = -1;
    clippingPlanesRef.current = [];
    bumpHistory();
  }, [mode]);
  useEffect(() => {
    const ctrl = controlsRef.current;
    const kg = kiteGroupRef.current;
    if (!ctrl) return;
    const drawing = activeTool !== 'pointer';
    ctrl.enabled = !drawing;
    if (drawing && selectedStampRef.current) clearSelection();
  }, [activeTool]);
  useKiteScene(context);
  return <EditorControls context={context} />;
}
