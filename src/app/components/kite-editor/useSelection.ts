import * as THREE from 'three';
export function useSelection(context: Pick<ReturnType<typeof useEditorState>, 'kiteGroupRef' | 'selectedStampRef' | 'selectionGroupRef' | 'handleMeshesRef'>) {
  const {
    kiteGroupRef,
    selectedStampRef,
    selectionGroupRef,
    handleMeshesRef
  } = context;
  const clearSelection = () => {
    selectedStampRef.current = null;
    const g = selectionGroupRef.current;
    if (g) {
      g.parent?.remove(g);
      g.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(x => x.dispose());else if (mat) mat.dispose();
      });
    }
    selectionGroupRef.current = null;
    handleMeshesRef.current = [];
  };
  const stampGeoHalfExtents = (stamp: THREE.Mesh): THREE.Vector2 => {
    stamp.geometry.computeBoundingBox();
    const bb = stamp.geometry.boundingBox!;
    return new THREE.Vector2((bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2);
  };
  const refreshSelectionOverlay = () => {
    const stamp = selectedStampRef.current;
    const kg = kiteGroupRef.current;
    if (!stamp || !kg) return;
    clearSelection();
    selectedStampRef.current = stamp;
    const half = stampGeoHalfExtents(stamp);
    const sx = half.x * stamp.scale.x;
    const sy = half.y * stamp.scale.y;
    const grp = new THREE.Group();
    grp.position.copy(stamp.position);
    grp.quaternion.copy(stamp.quaternion);
    if (stamp.userData.cornerKey === 'left' || stamp.userData.cornerKey === 'right') {
      const center = stamp.geometry.boundingBox!.getCenter(new THREE.Vector3());
      grp.position.add(center.multiply(stamp.scale).applyQuaternion(stamp.quaternion));
    }
    grp.renderOrder = 5000;

    // dashed bbox
    const pts = [new THREE.Vector3(-sx, -sy, 0), new THREE.Vector3(sx, -sy, 0), new THREE.Vector3(sx, sy, 0), new THREE.Vector3(-sx, sy, 0), new THREE.Vector3(-sx, -sy, 0)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x33aaff,
      dashSize: 0.05,
      gapSize: 0.04,
      depthTest: false,
      transparent: true
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    line.renderOrder = 5001;
    grp.add(line);

    // 8 resize handles
    const handleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      transparent: true
    });
    const handleBorder = new THREE.MeshBasicMaterial({
      color: 0x33aaff,
      depthTest: false,
      transparent: true
    });
    const HS = 0.07; // handle size
    const positions: [number, number, ScaleHandle][] = [[-sx, -sy, 'sw'], [0, -sy, 's'], [sx, -sy, 'se'], [-sx, 0, 'w'], [sx, 0, 'e'], [-sx, sy, 'nw'], [0, sy, 'n'], [sx, sy, 'ne']];
    const handles: {
      mesh: THREE.Mesh;
      role: string;
    }[] = [];
    positions.forEach(([hx, hy, role]) => {
      const border = new THREE.Mesh(new THREE.PlaneGeometry(HS, HS), handleBorder.clone());
      border.position.set(hx, hy, 0);
      border.renderOrder = 5002;
      grp.add(border);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(HS * 0.7, HS * 0.7), handleMat.clone());
      fill.position.set(hx, hy, 0);
      fill.renderOrder = 5003;
      fill.userData.role = role;
      grp.add(fill);
      handles.push({
        mesh: fill,
        role
      });
    });

    // rotation arm + handle
    const armPts = [new THREE.Vector3(0, sy, 0), new THREE.Vector3(0, sy + 0.22, 0)];
    const armLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(armPts), new THREE.LineBasicMaterial({
      color: 0x33aaff,
      depthTest: false,
      transparent: true
    }));
    armLine.renderOrder = 5001;
    grp.add(armLine);
    const rotBorder = new THREE.Mesh(new THREE.CircleGeometry(HS * 0.9, 20), handleBorder.clone());
    rotBorder.position.set(0, sy + 0.22, 0);
    rotBorder.renderOrder = 5002;
    grp.add(rotBorder);
    const rotFill = new THREE.Mesh(new THREE.CircleGeometry(HS * 0.65, 20), handleMat.clone());
    rotFill.position.set(0, sy + 0.22, 0);
    rotFill.renderOrder = 5003;
    rotFill.userData.role = 'rotate';
    grp.add(rotFill);
    handles.push({
      mesh: rotFill,
      role: 'rotate'
    });
    kg.add(grp);
    selectionGroupRef.current = grp;
    handleMeshesRef.current = handles;
  };
  return {
    clearSelection,
    stampGeoHalfExtents,
    refreshSelectionOverlay
  };
}
