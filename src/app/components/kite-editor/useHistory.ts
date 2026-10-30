import * as THREE from 'three';
export function useHistory(context: Pick<ReturnType<typeof useEditorState>, 'bumpHistory' | 'modeRef' | 'selectedFaceRef' | 'surfaceDrawingsRef' | 'buildGroupRef' | 'getUndo' | 'getRedo' | 'selectedStampRef'> & Pick<ReturnType<typeof useSelection>, 'clearSelection' | 'refreshSelectionOverlay'>) {
  const {
    bumpHistory,
    modeRef,
    selectedFaceRef,
    surfaceDrawingsRef,
    buildGroupRef,
    getUndo,
    getRedo,
    selectedStampRef,
    clearSelection,
    refreshSelectionOverlay
  } = context;
  const disposeNode = (obj: THREE.Object3D) => {
    obj.children.slice().forEach(disposeNode);
    const m = obj as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.userData.attachmentPaint) (m.material as THREE.MeshBasicMaterial).map?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(x => x.dispose());else if (mat) mat.dispose();
  };
  const applyTransform = (obj: THREE.Mesh, t: TransformSnap) => {
    obj.position.copy(t.pos);
    obj.quaternion.copy(t.quat);
    obj.scale.copy(t.scale);
  };
  const stackIdx = () => modeRef.current === 'build' ? 0 : selectedFaceRef.current;
  const containerForStack = (): THREE.Object3D | null => {
    if (modeRef.current === 'build') return buildGroupRef.current;
    return surfaceDrawingsRef.current[selectedFaceRef.current] ?? null;
  };
  const clearSelectedSurface = () => {
    const sel = stackIdx();
    const grp = containerForStack();
    if (!grp || sel < 0) return;
    clearSelection();
    grp.children.slice().forEach(child => {
      disposeNode(child);
      grp.remove(child);
    });
    (getUndo()[sel] || []).forEach(a => {
      if (a.type === 'add') disposeNode(a.obj);
    });
    (getRedo()[sel] || []).forEach(a => {
      if (a.type === 'add') disposeNode(a.obj);
    });
    getUndo()[sel] = [];
    getRedo()[sel] = [];
    bumpHistory();
  };
  const undoOnSelectedSurface = () => {
    const sel = stackIdx();
    if (sel < 0) return;
    const stack = getUndo()[sel];
    const grp = containerForStack();
    if (!stack || !grp || stack.length === 0) return;
    const act = stack.pop()!;
    if (act.type === 'add') {
      act.parent.remove(act.obj);
      if (selectedStampRef.current === act.obj) clearSelection();
    } else {
      applyTransform(act.obj, act.before);
      if (act.linked) applyTransform(act.linked.obj, act.linked.before);
      if (selectedStampRef.current === act.obj) refreshSelectionOverlay();
    }
    getRedo()[sel].push(act);
    bumpHistory();
  };
  const redoOnSelectedSurface = () => {
    const sel = stackIdx();
    if (sel < 0) return;
    const stack = getRedo()[sel];
    const grp = containerForStack();
    if (!stack || !grp || stack.length === 0) return;
    const act = stack.pop()!;
    if (act.type === 'add') {
      act.parent.add(act.obj);
    } else {
      applyTransform(act.obj, act.after);
      if (act.linked) applyTransform(act.linked.obj, act.linked.after);
      if (selectedStampRef.current === act.obj) refreshSelectionOverlay();
    }
    getUndo()[sel].push(act);
    bumpHistory();
  };
  return {
    disposeNode,
    applyTransform,
    stackIdx,
    containerForStack,
    clearSelectedSurface,
    undoOnSelectedSurface,
    redoOnSelectedSurface
  };
}
