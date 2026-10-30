import * as THREE from 'three';
import { useRef } from 'react';
import { startAttachmentPaint } from './attachmentPaint';
import { bindPaintSide } from './paintSide';
import { clipPaintToBody } from './bodySurface';
import { BRUSH_R, MIN_BRUSH_STEP } from './constants';
import { makeShapeGeo, addBrushSeg, computeBuildShapeClipping, computeSurfaceClipping, intersectDrawingPlane } from './drawingGeometry';
import { SURFACE_POLYS } from './templates';
export function useDrawing(context: Pick<ReturnType<typeof useEditorState>, 'mode' | 'bumpHistory' | 'modeRef' | 'activeToolRef' | 'stampColorRef' | 'cameraRef' | 'rendererRef' | 'kiteGroupRef' | 'kiteFacesRef' | 'buildSurfMeshesRef' | 'highlightMeshesRef' | 'borderMeshesRef' | 'selectedFaceRef' | 'clippingPlanesRef' | 'isDrawingRef' | 'drawStartRef' | 'previewMeshRef' | 'brushGroupRef' | 'brushLastPtRef' | 'surfaceDrawingsRef' | 'buildGroupRef' | 'drawOrderRef' | 'undoStacksByModeRef' | 'redoStacksByModeRef' | 'getUndo' | 'getRedo'> & Pick<ReturnType<typeof useHistory>, 'disposeNode' | 'stackIdx'>) {
  const {
    mode,
    bumpHistory,
    modeRef,
    activeToolRef,
    stampColorRef,
    cameraRef,
    rendererRef,
    kiteGroupRef,
    kiteFacesRef,
    buildSurfMeshesRef,
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
    disposeNode,
    stackIdx
  } = context;
  const attachmentStroke = useRef<ReturnType<typeof startAttachmentPaint> | null>(null);
  const attachmentRay = (x: number, y: number) => {
    const rect = rendererRef.current!.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), cameraRef.current!);
    return ray;
  };
  const getHit = (clientX: number, clientY: number): HitInfo | null => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const kiteGroup = kiteGroupRef.current;
    if (!renderer || !camera || !kiteGroup) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(x, y), camera);
    kiteGroup.updateWorldMatrix(true, true);
    if (isDrawingRef.current && drawStartRef.current) {
      const start = drawStartRef.current;
      const localPoint = intersectDrawingPlane(rc.ray, kiteGroup, start.localPoint, start.localNorm);
      return localPoint ? { localPoint, localNorm: start.localNorm.clone() } : null;
    }
    let worldPoint: THREE.Vector3;
    let worldNormal: THREE.Vector3;
    const hits = rc.intersectObjects(kiteFacesRef.current, false);
    if (hits.length && hits[0].face) {
      worldPoint = hits[0].point.clone();
      worldNormal = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld);
    } else {
      // A stroke must begin on a surface, never on a camera-facing fallback.
      return null;
    }
    const invKite = new THREE.Matrix4().copy(kiteGroup.matrixWorld).invert();
    const localPoint = worldPoint.clone().applyMatrix4(invKite);
    const localNorm = worldNormal.clone().transformDirection(invKite).normalize();
    return {
      localPoint,
      localNorm
    };
  };
  const getKitePlaneHit = (clientX: number, clientY: number): THREE.Vector3 | null => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const kg = kiteGroupRef.current;
    if (!renderer || !camera || !kg) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, camera);
    const planeOriginW = kg.getWorldPosition(new THREE.Vector3());
    const planeNormalW = new THREE.Vector3(0, 0, 1).applyQuaternion(kg.getWorldQuaternion(new THREE.Quaternion()));
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormalW, planeOriginW);
    const hitW = new THREE.Vector3();
    if (!rc.ray.intersectPlane(plane, hitW)) return null;
    return hitW.applyMatrix4(new THREE.Matrix4().copy(kg.matrixWorld).invert());
  };
  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const tool = activeToolRef.current;
    if (tool === 'pointer') return;
    if (modeRef.current === 'build' && tool === 'brush') return;
    if (modeRef.current === 'design' && kiteGroupRef.current && rendererRef.current && cameraRef.current) {
      const parts = kiteGroupRef.current.children.filter(o => o.userData.kind === 'corner-part' || o.userData.kind === 'tail-stamp') as THREE.Mesh[];
      const surfaces = [...kiteFacesRef.current.filter(m => m.parent && m.userData.kind !== 'tail-stamp'), ...parts];
      const hit = attachmentRay(e.clientX, e.clientY).intersectObjects(surfaces, false)[0];
      if (hit && parts.includes(hit.object as THREE.Mesh)) {
        e.preventDefault();
        const part = hit.object as THREE.Mesh;
        let group = part.children.find(c => c.userData.paintSurface) as THREE.Group | undefined;
        if (!group) {
          group = new THREE.Group(); group.userData.paintSurface = true;
          const idx = surfaceDrawingsRef.current.length;
          group.userData.surfaceIdx = idx;
          part.add(group); surfaceDrawingsRef.current[idx] = group;
          undoStacksByModeRef.current.design[idx] = [];
          redoStacksByModeRef.current.design[idx] = [];
        }
        const idx = group.userData.surfaceIdx as number;
        selectedFaceRef.current = idx;
        getRedo()[idx].forEach(a => { if (a.type === 'add') disposeNode(a.obj); });
        getRedo()[idx] = [];
        const stroke = startAttachmentPaint(part, part.worldToLocal(hit.point.clone()), tool, stampColorRef.current, ++drawOrderRef.current);
        group.add(stroke.mesh); attachmentStroke.current = stroke;
        bindPaintSide(stroke.mesh, cameraRef.current, part, new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
        bumpHistory(); return;
      }
    }

    // Build mode + shape tool → freeform gray structural part behind the kite
    if (modeRef.current === 'build' && (tool === 'circle' || tool === 'square' || tool === 'triangle')) {
      e.preventDefault();
      const local = getKitePlaneHit(e.clientX, e.clientY);
      const bg = buildGroupRef.current;
      if (!local || !bg) return;
      const geo = makeShapeGeo(tool, 0.01);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x888888,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(local.x, local.y, 0); // z=0 in build group's local (group itself is at z=-0.01)
      mesh.renderOrder = 0;
      mesh.userData.kind = 'stamp';
      mesh.userData.tool = tool;
      mesh.userData.build = true;
      bg.add(mesh);
      isDrawingRef.current = true;
      drawStartRef.current = {
        localPoint: local,
        localNorm: new THREE.Vector3(0, 0, 1)
      };
      previewMeshRef.current = mesh;
      return;
    }
    e.preventDefault();

    // detect which face was clicked and lock it as the active drawing surface
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (renderer && camera) {
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const faceHits = rc.intersectObjects(kiteFacesRef.current, false);
      const newIdx = faceHits.length ? faceHits[0].object.userData.surfaceIdx as number : -1;
      const kg = kiteGroupRef.current;
      if (newIdx < 0) {
        // empty space → deselect
        if (selectedFaceRef.current !== -1) bumpHistory();
        selectedFaceRef.current = -1;
        clippingPlanesRef.current = [];
        updateHighlight(e.clientX, e.clientY);
        return;
      }
      if (kg) {
        if (newIdx >= SURFACE_POLYS.length) {
          const bMesh = buildSurfMeshesRef.current.find(m => m.userData.surfaceIdx === newIdx);
          clippingPlanesRef.current = bMesh ? computeBuildShapeClipping(bMesh, kg) : [];
        } else {
          clippingPlanesRef.current = newIdx === 0 ? [] : computeSurfaceClipping(newIdx, kg);
        }
      }
      if (newIdx !== selectedFaceRef.current) {
        selectedFaceRef.current = newIdx;
        updateHighlight(e.clientX, e.clientY);
        bumpHistory();
      }
    }
    const hit = getHit(e.clientX, e.clientY);
    if (!hit) return;
    isDrawingRef.current = true;
    drawStartRef.current = hit;
    const clips = clippingPlanesRef.current;
    const sel = selectedFaceRef.current;
    const surfaceGrp = surfaceDrawingsRef.current[sel];
    if (!surfaceGrp) {
      isDrawingRef.current = false;
      return;
    }
    const order = ++drawOrderRef.current;
    const disposeNode = (obj: THREE.Object3D) => {
      obj.children.slice().forEach(disposeNode);
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose());else if (mat) mat.dispose();
    };
    // starting a new action invalidates the redo stack on this surface (current mode)
    getRedo()[sel].forEach(a => {
      if (a.type === 'add') disposeNode(a.obj);
    });
    getRedo()[sel] = [];
    if (tool === 'brush') {
      const grp = new THREE.Group();
      grp.userData.order = order;
      surfaceGrp.add(grp);
      bindPaintSide(grp, cameraRef.current!, kiteGroupRef.current!, hit.localPoint, hit.localNorm);
      brushGroupRef.current = grp;
      const sph = new THREE.Mesh(new THREE.SphereGeometry(BRUSH_R, 8, 8), new THREE.MeshBasicMaterial({
        color: stampColorRef.current,
        clippingPlanes: clips,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        transparent: true,
        depthWrite: false
      }));
      sph.position.copy(hit.localPoint);
      if (sel === 0) clipPaintToBody(sph.material);
      sph.renderOrder = order;
      grp.add(sph);
      brushLastPtRef.current = sph.position.clone();
    } else {
      const geo = makeShapeGeo(tool, 0.01);
      const mat = new THREE.MeshBasicMaterial({
        color: stampColorRef.current,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        clippingPlanes: clips,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(hit.localPoint);
      if (sel === 0) clipPaintToBody(mat);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.localNorm);
      mesh.renderOrder = order;
      mesh.userData.kind = 'stamp';
      mesh.userData.tool = tool;
      mesh.userData.surfaceIdx = sel;
      surfaceGrp.add(mesh);
      bindPaintSide(mesh, cameraRef.current!, kiteGroupRef.current!, hit.localPoint, hit.localNorm);
      previewMeshRef.current = mesh;
    }
  };
  const applySelectionBorder = () => {
    const sel = selectedFaceRef.current;
    borderMeshesRef.current.forEach((b, i) => {
      b.visible = i === sel;
    });
  };
  const clearHighlights = () => {
    highlightMeshesRef.current.forEach(h => {
      h.visible = false;
    });
    applySelectionBorder();
  };
  const updateHighlight = (clientX: number, clientY: number) => {
    applySelectionBorder();
    if (activeToolRef.current === 'pointer' || modeRef.current === 'build') {
      highlightMeshesRef.current.forEach(h => {
        h.visible = false;
      });
      borderMeshesRef.current.forEach(b => {
        b.visible = false;
      });
      return;
    }
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(x, y), camera);

    // Sync build surface highlight meshes to match current build mesh transform/geometry.
    buildSurfMeshesRef.current.forEach((bMesh, i) => {
      const hlMesh = highlightMeshesRef.current[bMesh.userData.surfaceIdx];
      if (!hlMesh) return;
      hlMesh.geometry = bMesh.geometry;
      hlMesh.position.copy(bMesh.position);
      hlMesh.quaternion.copy(bMesh.quaternion);
      hlMesh.scale.copy(bMesh.scale);
    });
    const hits = rc.intersectObjects(kiteFacesRef.current, false);
    const hitIdx = hits.length ? hits[0].object.userData.surfaceIdx as number : -1;
    highlightMeshesRef.current.forEach((h, i) => {
      const mat = h.material as THREE.MeshBasicMaterial;
      if (i === hitIdx) {
        h.visible = true;
        mat.opacity = 0.3;
      } else {
        h.visible = false;
      }
    });
  };
  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (attachmentStroke.current) {
      const { part, draw } = attachmentStroke.current;
      part.updateWorldMatrix(true, false);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0).applyMatrix4(part.matrixWorld);
      const point = attachmentRay(e.clientX, e.clientY).ray.intersectPlane(plane, new THREE.Vector3());
      if (point) draw(part.worldToLocal(point));
      return;
    }
    updateHighlight(e.clientX, e.clientY);
    if (!isDrawingRef.current) return;
    const tool = activeToolRef.current;
    const start = drawStartRef.current;
    if (!start) return;
    const isBuildShape = modeRef.current === 'build' && (tool === 'circle' || tool === 'square' || tool === 'triangle');
    const hit: HitInfo | null = isBuildShape ? (() => {
      const p = getKitePlaneHit(e.clientX, e.clientY);
      return p ? {
        localPoint: p,
        localNorm: new THREE.Vector3(0, 0, 1)
      } : null;
    })() : getHit(e.clientX, e.clientY);
    if (!hit) return;
    if (tool === 'brush') {
      const grp = brushGroupRef.current;
      const prev = brushLastPtRef.current;
      if (!grp || !prev) return;
      // surface-offset point
      const pt = hit.localPoint.clone();
      if (pt.distanceTo(prev) >= MIN_BRUSH_STEP) {
        addBrushSeg(prev, pt, stampColorRef.current, grp, clippingPlanesRef.current, grp.userData.order as number ?? 0, selectedFaceRef.current === 0);
        brushLastPtRef.current = pt.clone();
      }
    } else {
      const mesh = previewMeshRef.current;
      if (!mesh) return;
      const size = Math.max(start.localPoint.distanceTo(hit.localPoint) * 2, 0.06);
      mesh.geometry.dispose();
      mesh.geometry = makeShapeGeo(tool, size);
    }
  };
  const finalizeDrawing = () => {
    if (attachmentStroke.current) {
      const { mesh } = attachmentStroke.current;
      getUndo()[selectedFaceRef.current].push({ type: 'add', obj: mesh, parent: mesh.parent! });
      attachmentStroke.current = null; bumpHistory(); return;
    }
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    drawStartRef.current = null;
    const sel = stackIdx();
    let action: THREE.Object3D | null = null;
    const mesh = previewMeshRef.current;
    if (mesh) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = modeRef.current === 'build' ? 0.95 : 1;
      mat.needsUpdate = true;

      // Register completed build shapes as a new paintable surface.
      if (mesh.userData.build && kiteGroupRef.current) {
        const kg = kiteGroupRef.current;
        const surfIdx = surfaceDrawingsRef.current.length;
        mesh.userData.surfaceIdx = surfIdx;
        buildSurfMeshesRef.current.push(mesh);
        kiteFacesRef.current.push(mesh);

        // Drawing group (Design-mode paint strokes live here).
        const drawGrp = new THREE.Group();
        drawGrp.visible = modeRef.current === 'design';
        kg.add(drawGrp);
        surfaceDrawingsRef.current[surfIdx] = drawGrp;

        // Hover highlight mesh (synced to build mesh geometry each frame).
        const hlMesh = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
          color: 0x88ccff,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthTest: false
        }));
        hlMesh.position.copy(mesh.position);
        hlMesh.quaternion.copy(mesh.quaternion);
        hlMesh.scale.copy(mesh.scale);
        hlMesh.renderOrder = 1;
        hlMesh.visible = false;
        kg.add(hlMesh);
        highlightMeshesRef.current[surfIdx] = hlMesh;

        // Independent undo/redo stacks for this build surface in Design mode.
        undoStacksByModeRef.current.design[surfIdx] = [];
        redoStacksByModeRef.current.design[surfIdx] = [];
      }
      action = mesh;
      previewMeshRef.current = null;
    }
    if (brushGroupRef.current) {
      action = brushGroupRef.current;
    }
    if (action && sel >= 0 && getUndo()[sel]) {
      getUndo()[sel].push({
        type: 'add',
        obj: action,
        parent: action.parent!
      });
      bumpHistory();
    }
    brushGroupRef.current = null;
    brushLastPtRef.current = null;
  };
  const handleOverlayMouseUp = () => finalizeDrawing();
  const handleOverlayMouseLeave = () => {
    finalizeDrawing();
    clearHighlights();
  };
  return {
    getHit,
    getKitePlaneHit,
    handleOverlayMouseDown,
    applySelectionBorder,
    clearHighlights,
    updateHighlight,
    handleOverlayMouseMove,
    finalizeDrawing,
    handleOverlayMouseUp,
    handleOverlayMouseLeave
  };
}
