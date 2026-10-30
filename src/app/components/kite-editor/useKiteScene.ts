import { useEffect } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import { resizeWing } from './wingAttachments';
import { updatePaintSide } from './paintSide';
import { type ScaleHandle } from './types';
import { GIZMO_SIZE, TWEEN_MS, MM_PER_UNIT, A3_LONG_MM, A3_SHORT_MM } from './constants';
import { SURFACE_POLYS } from './templates';
import { easeInOut, makeCircleTexture, AXIS_DEFS } from './gizmoGeometry';
import { createKiteModel } from './createKiteModel';
export function useKiteScene(context: ReturnType<typeof useEditorState> & Pick<ReturnType<typeof useSelection>, 'clearSelection' | 'stampGeoHalfExtents' | 'refreshSelectionOverlay'> & Pick<ReturnType<typeof useHistory>, 'disposeNode'>) {
  const {
    mode,
    bumpHistory,
    modeRef,
    activeToolRef,
    containerRef,
    gizmoCanvasRef,
    cameraRef,
    controlsRef,
    rendererRef,
    kiteGroupRef,
    cornerMorphRef,
    tailMeshRef,
    cornerPartsRef,
    animationFrameRef,
    tweenRef,
    borderMeshesRef,
    surfaceDrawingsRef,
    buildGroupRef,
    undoStacksByModeRef,
    redoStacksByModeRef,
    selectedStampRef,
    handleMeshesRef,
    dragStateRef,
    gizmoRendererRef,
    gizmoCameraRef,
    gizmoSpritesRef,
    gizmoAllRef,
    clearSelection,
    stampGeoHalfExtents,
    refreshSelectionOverlay,
    disposeNode
  } = context;
  useEffect(() => {
    if (!containerRef.current || !gizmoCanvasRef.current) return;

    // scene
    const scene = new THREE.Scene();
    const bgCv = document.createElement('canvas');
    bgCv.width = 2;
    bgCv.height = 256;
    const bgCtx = bgCv.getContext('2d')!;
    const grad = bgCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#B3E5FC');
    grad.addColorStop(1, '#FFF8FB');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, 2, 256);
    scene.background = new THREE.CanvasTexture(bgCv);

    // camera
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(4, 3, 7);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      stencil: true
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.localClippingEnabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controlsRef.current = controls;

    // ── pointer-tool selection / transform handlers ─────────────────────────
    const ndcFromEvent = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2((ev.clientX - rect.left) / rect.width * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    };

    // Project a screen point onto a stamp's surface plane (in kite-local space).
    const pointerOnStampPlane = (ev: PointerEvent, stamp: THREE.Mesh): THREE.Vector3 | null => {
      const kg = kiteGroupRef.current;
      if (!kg) return null;
      const ndc = ndcFromEvent(ev);
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, camera);
      // plane through stamp in world space
      const stampPosW = stamp.getWorldPosition(new THREE.Vector3());
      const stampNrmW = new THREE.Vector3(0, 0, 1).applyQuaternion(stamp.getWorldQuaternion(new THREE.Quaternion()));
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(stampNrmW, stampPosW);
      const hitW = new THREE.Vector3();
      if (!rc.ray.intersectPlane(plane, hitW)) return null;
      return hitW.applyMatrix4(new THREE.Matrix4().copy(kg.matrixWorld).invert());
    };
    const snapshot = (m: THREE.Mesh): TransformSnap => ({
      pos: m.position.clone(),
      quat: m.quaternion.clone(),
      scale: m.scale.clone()
    });
    const onCanvasPointerDown = (ev: PointerEvent) => {
      if (activeToolRef.current !== 'pointer') return;
      const ndc = ndcFromEvent(ev);
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, camera);

      // 1. handles of current selection take priority
      const currentSel = selectedStampRef.current;
      if (currentSel && handleMeshesRef.current.length) {
        const handleHits = rc.intersectObjects(handleMeshesRef.current.map(h => h.mesh), false);
        if (handleHits.length) {
          const role = handleHits[0].object.userData.role as string;
          const pt = pointerOnStampPlane(ev, currentSel);
          if (!pt) return;
          ev.preventDefault();
          ev.stopImmediatePropagation();
          const half = stampGeoHalfExtents(currentSel);
          dragStateRef.current = {
            mode: role === 'rotate' ? {
              kind: 'rotate'
            } : {
              kind: 'scale',
              handle: role as ScaleHandle
            },
            startPointerLocal: pt,
            before: snapshot(currentSel),
            linked: (() => {
              const side = currentSel.userData.cornerKey;
              const other = side === 'left' ? cornerPartsRef.current.right : side === 'right' ? cornerPartsRef.current.left : null;
              return role !== 'rotate' && other ? { obj: other, before: snapshot(other) } : undefined;
            })(),
            centerLocal: currentSel.position.clone(),
            halfLocal: half,
            rotZ: new THREE.Euler().setFromQuaternion(currentSel.quaternion, 'XYZ').z,
            surfaceIdx: modeRef.current === 'build' ? 0 : currentSel.userData.surfaceIdx as number
          };
          controls.enabled = false;
          return;
        }
      }

      // 2. raycast stamps for the active mode
      const stamps: THREE.Mesh[] = [];
      if (modeRef.current === 'build') {
        buildGroupRef.current?.children.forEach(c => {
          if (c.visible && (c as any).userData?.kind === 'stamp') stamps.push(c as THREE.Mesh);
        });
        // Tail mesh is selectable in build mode (move / resize / rotate)
        const tm = tailMeshRef.current;
        if (tm && tm.scale.x > 0.01) stamps.push(tm); // skip during morph-out
        for (const side of ['left', 'right'] as const) {
          const wing = cornerPartsRef.current[side];
          if (wing && cornerMorphRef.current?.mesh !== wing) stamps.push(wing);
        }
      } else {
        surfaceDrawingsRef.current.forEach(g => g.children.forEach(c => {
          if (c.visible && (c as any).userData?.kind === 'stamp') stamps.push(c as THREE.Mesh);
        }));
      }
      const stampHits = rc.intersectObjects(stamps, false);
      if (stampHits.length) {
        const stamp = stampHits[0].object as THREE.Mesh;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        selectedStampRef.current = stamp;
        refreshSelectionOverlay();
        const pt = pointerOnStampPlane(ev, stamp);
        if (pt) {
          dragStateRef.current = {
            mode: {
              kind: 'move'
            },
            startPointerLocal: pt,
            before: snapshot(stamp),
            centerLocal: stamp.position.clone(),
            halfLocal: stampGeoHalfExtents(stamp),
            rotZ: new THREE.Euler().setFromQuaternion(stamp.quaternion, 'XYZ').z,
            surfaceIdx: modeRef.current === 'build' ? 0 : stamp.userData.surfaceIdx as number
          };
          controls.enabled = false;
        }
        bumpHistory();
        return;
      }

      // 3. empty space → deselect (do NOT block orbit)
      if (selectedStampRef.current) {
        clearSelection();
        bumpHistory();
      }
    };
    const onWindowPointerMove = (ev: PointerEvent) => {
      const ds = dragStateRef.current;
      const stamp = selectedStampRef.current;
      if (!ds || !stamp) return;
      const pt = pointerOnStampPlane(ev, stamp);
      if (!pt) return;
      const dx = pt.x - ds.startPointerLocal.x;
      const dy = pt.y - ds.startPointerLocal.y;
      if (ds.mode.kind === 'move') {
        stamp.position.set(ds.before.pos.x + dx, ds.before.pos.y + dy, ds.before.pos.z);
      } else if (ds.mode.kind === 'rotate') {
        const cx = ds.before.pos.x,
          cy = ds.before.pos.y;
        const a0 = Math.atan2(ds.startPointerLocal.y - cy, ds.startPointerLocal.x - cx);
        const a1 = Math.atan2(pt.y - cy, pt.x - cx);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a1 - a0);
        stamp.quaternion.copy(ds.before.quat).premultiply(q);
      } else {
        // scale — convert pointer delta into stamp-local space (rotate by -rotZ)
        const cos = Math.cos(-ds.rotZ),
          sin = Math.sin(-ds.rotZ);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        const h = ds.mode.handle;
        const eastW = h.includes('e') ? 1 : h.includes('w') ? -1 : 0;
        const northW = h.includes('n') ? 1 : h.includes('s') ? -1 : 0;
        const minScale = 0.05;
        let newSx = ds.before.scale.x;
        let newSy = ds.before.scale.y;
        if (eastW !== 0) {
          newSx = Math.max(minScale, ds.before.scale.x + eastW * lx / ds.halfLocal.x);
        }
        if (northW !== 0) {
          newSy = Math.max(minScale, ds.before.scale.y + northW * ly / ds.halfLocal.y);
        }
        // A3 size enforcement: each dim ≤ A3 long edge, AND at least one dim ≤ A3 short edge
        const dimMm = (half: number, s: number) => half * 2 * s * MM_PER_UNIT;
        const sxFromMm = (mm: number) => mm / (ds.halfLocal.x * 2 * MM_PER_UNIT);
        const syFromMm = (mm: number) => mm / (ds.halfLocal.y * 2 * MM_PER_UNIT);
        if (dimMm(ds.halfLocal.x, newSx) > A3_LONG_MM) newSx = sxFromMm(A3_LONG_MM);
        if (dimMm(ds.halfLocal.y, newSy) > A3_LONG_MM) newSy = syFromMm(A3_LONG_MM);
        let w = dimMm(ds.halfLocal.x, newSx);
        let hh = dimMm(ds.halfLocal.y, newSy);
        if (w > A3_SHORT_MM && hh > A3_SHORT_MM) {
          // shrink whichever dim is shorter down to the A3 short edge
          if (w <= hh) newSx = sxFromMm(A3_SHORT_MM);else newSy = syFromMm(A3_SHORT_MM);
        }
        stamp.scale.set(newSx, newSy, 1);
        if (stamp.userData.cornerKey === 'left' || stamp.userData.cornerKey === 'right') {
          resizeWing(stamp, ds.before, newSx, newSy);
          if (ds.linked) {
            resizeWing(ds.linked.obj, ds.linked.before,
              ds.linked.before.scale.x * newSx / ds.before.scale.x,
              ds.linked.before.scale.y * newSy / ds.before.scale.y);
          }
        }
      }
      refreshSelectionOverlay();
    };
    const onWindowPointerUp = () => {
      const ds = dragStateRef.current;
      const stamp = selectedStampRef.current;
      if (ds && stamp) {
        const after = snapshot(stamp);
        const changed = !after.pos.equals(ds.before.pos) || !after.quat.equals(ds.before.quat) || !after.scale.equals(ds.before.scale);
        if (changed && undoStacksByModeRef.current[modeRef.current][ds.surfaceIdx]) {
          undoStacksByModeRef.current[modeRef.current][ds.surfaceIdx].push({
            type: 'transform',
            obj: stamp,
            before: ds.before,
            after,
            linked: ds.linked ? { ...ds.linked, after: snapshot(ds.linked.obj) } : undefined
          });
          redoStacksByModeRef.current[modeRef.current][ds.surfaceIdx].forEach(a => {
            if (a.type === 'add') disposeNode(a.obj);
          });
          redoStacksByModeRef.current[modeRef.current][ds.surfaceIdx] = [];
          bumpHistory();
        }
      }
      dragStateRef.current = null;
      if (activeToolRef.current === 'pointer') controls.enabled = true;
    };
    renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown, {
      capture: true
    });
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);

    // lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dLight.position.set(5, 5, 5);
    scene.add(dLight);

    // kite
    const kiteGroup = createKiteModel(context, scene);

    // persistent glow borders — one per surface, hidden until selected
    const makeBorder = (geometry: THREE.BufferGeometry) => {
      const grp = new THREE.Group();
      const edges = new THREE.EdgesGeometry(geometry);
      const pts = edges.getAttribute('position');
      // 2 stacked tubes for a soft glow effect
      const layers = [{
        r: 0.05,
        color: 0x66ccff,
        opacity: 0.25
      }, {
        r: 0.022,
        color: 0xaaddff,
        opacity: 0.95
      }];
      for (let i = 0; i < pts.count; i += 2) {
        const curve = new THREE.LineCurve3(new THREE.Vector3().fromBufferAttribute(pts, i), new THREE.Vector3().fromBufferAttribute(pts, i + 1));
        layers.forEach(({
          r,
          color,
          opacity
        }) => {
          const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 1, r, 8, false), new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthTest: false,
            blending: THREE.AdditiveBlending
          }));
          tube.renderOrder = 2;
          grp.add(tube);
        });
      }
      edges.dispose();
      grp.visible = false;
      kiteGroup.add(grp);
      return grp as unknown as THREE.Mesh;
    };
    borderMeshesRef.current = context.highlightMeshesRef.current.map(mesh => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
      const border = makeBorder(geometry);
      geometry.dispose();
      return border;
    });

    // persistent per-surface drawing groups (accumulate all strokes/stamps)
    surfaceDrawingsRef.current = SURFACE_POLYS.map(() => {
      const g = new THREE.Group();
      kiteGroup.add(g);
      return g;
    });
    undoStacksByModeRef.current = {
      build: SURFACE_POLYS.map(() => []),
      design: SURFACE_POLYS.map(() => [])
    };
    redoStacksByModeRef.current = {
      build: SURFACE_POLYS.map(() => []),
      design: SURFACE_POLYS.map(() => [])
    };

    // gizmo
    const gizmoRenderer = new THREE.WebGLRenderer({
      canvas: gizmoCanvasRef.current!,
      antialias: true,
      alpha: true
    });
    gizmoRenderer.setSize(GIZMO_SIZE, GIZMO_SIZE);
    gizmoRenderer.setPixelRatio(window.devicePixelRatio);
    gizmoRenderer.setClearColor(0x000000, 0);
    gizmoRendererRef.current = gizmoRenderer;
    const gizmoScene = new THREE.Scene();
    const gizmoCamera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
    gizmoCamera.position.set(0, 0, 3);
    gizmoCameraRef.current = gizmoCamera;
    const allObjs: THREE.Object3D[] = [],
      sprites: typeof gizmoSpritesRef.current = [];
    const UP_Y = new THREE.Vector3(0, 1, 0);
    AXIS_DEFS.forEach(({
      key,
      dir,
      color,
      label,
      faded
    }) => {
      const direction = new THREE.Vector3(...dir).normalize();
      const lineLen = 0.72;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, lineLen, 8), new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: faded ? 0.45 : 1,
        depthTest: false
      }));
      cyl.position.copy(direction.clone().multiplyScalar(lineLen / 2));
      if (Math.abs(direction.dot(UP_Y)) < 0.999) cyl.quaternion.setFromUnitVectors(UP_Y, direction);else if (direction.y < 0) cyl.rotateZ(Math.PI);
      cyl.renderOrder = 0;
      gizmoScene.add(cyl);
      allObjs.push(cyl);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeCircleTexture(label, color, faded),
        depthTest: false,
        transparent: true
      }));
      sprite.scale.setScalar(faded ? 0.33 : 0.38);
      sprite.position.copy(direction.clone().multiplyScalar(1.02));
      sprite.renderOrder = 1;
      gizmoScene.add(sprite);
      allObjs.push(sprite);
      sprites.push({
        sprite,
        key,
        faded
      });
    });
    gizmoSpritesRef.current = sprites;
    gizmoAllRef.current = allObjs;

    // resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth,
        h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // animate
    let time = 0;
    const camFwd = new THREE.Vector3();
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      time += 0.01;
      const tw = tweenRef.current;
      if (tw) {
        const t = Math.min((performance.now() - tw.startTime) / TWEEN_MS, 1),
          et = easeInOut(t);
        camera.position.lerpVectors(tw.fromPos, tw.toPos, et);
        camera.quaternion.slerpQuaternions(tw.fromQuat, tw.toQuat, et);
        controls.target.set(0, 0, 0);
        controls.update();
        if (t >= 1) {
          tweenRef.current = null;
          controls.enabled = activeToolRef.current === 'pointer';
        }
      } else {
        controls.update();
      }
      const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
      surfaceDrawingsRef.current.forEach(group => group.children.forEach(stroke => updatePaintSide(stroke, cameraPosition)));
      if (selectedStampRef.current && !selectedStampRef.current.visible) clearSelection();
      renderer.render(scene, camera);

      // Corner part morph animation
      const cm = cornerMorphRef.current;
      if (cm) {
        const t = Math.min((performance.now() - cm.startTime) / 400, 1);
        cm.mesh.scale.setScalar(cm.dir === 1 ? easeInOut(t) : 1 - easeInOut(t));
        if (t >= 1) {
          cornerMorphRef.current = null;
          if (cm.onDone) cm.onDone();
        }
      }
      gizmoCamera.quaternion.copy(camera.quaternion);
      gizmoCamera.position.set(0, 0, 1).applyQuaternion(gizmoCamera.quaternion).multiplyScalar(3);
      camera.getWorldDirection(camFwd);
      gizmoAllRef.current.forEach(obj => {
        obj.renderOrder = obj.position.dot(camFwd);
      });
      gizmoRenderer.render(gizmoScene, gizmoCamera);
    };
    animate();
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown, {
        capture: true
      } as any);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (containerRef.current && rendererRef.current) containerRef.current.removeChild(rendererRef.current.domElement);
      controls.dispose();
      renderer.dispose();
      gizmoRenderer.dispose();
    };
  }, []);
}
