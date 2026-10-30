import * as THREE from 'three';
import { GIZMO_SIZE } from './constants';
import { lookAtQuat, SNAP } from './gizmoGeometry';
export function useGizmo(context: Pick<ReturnType<typeof useEditorState>, 'gizmoCanvasRef' | 'cameraRef' | 'controlsRef' | 'tweenRef' | 'gizmoCameraRef' | 'gizmoSpritesRef'>) {
  const {
    gizmoCanvasRef,
    cameraRef,
    controlsRef,
    tweenRef,
    gizmoCameraRef,
    gizmoSpritesRef
  } = context;
  const snapTo = (pos: THREE.Vector3, up: THREE.Vector3) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    ctrl.enabled = false;
    tweenRef.current = {
      fromPos: cam.position.clone(),
      toPos: pos,
      fromQuat: cam.quaternion.clone(),
      toQuat: lookAtQuat(pos, up),
      startTime: performance.now()
    };
  };
  const raycastGizmo = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const gc = gizmoCanvasRef.current;
    const gcam = gizmoCameraRef.current;
    if (!gc || !gcam) return null;
    const rect = gc.getBoundingClientRect();
    const x = (e.clientX - rect.left) / GIZMO_SIZE * 2 - 1;
    const y = -((e.clientY - rect.top) / GIZMO_SIZE) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(x, y), gcam);
    const hits = rc.intersectObjects(gizmoSpritesRef.current.map(s => s.sprite));
    if (!hits.length) return null;
    return gizmoSpritesRef.current.find(s => s.sprite === hits[0].object) ?? null;
  };
  const handleGizmoClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = raycastGizmo(e);
    if (!hit) return;
    const {
      pos,
      up
    } = SNAP[hit.key];
    snapTo(pos.clone(), up.clone());
  };
  const handleGizmoMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const gc = gizmoCanvasRef.current;
    if (!gc) return;
    const hit = raycastGizmo(e);
    gizmoSpritesRef.current.forEach(({
      sprite,
      faded
    }) => sprite.scale.setScalar(faded ? 0.33 : 0.38));
    if (hit) {
      hit.sprite.scale.setScalar((hit.faded ? 0.33 : 0.38) * 1.38);
      gc.style.cursor = 'pointer';
    } else gc.style.cursor = 'default';
  };
  const handleGizmoLeave = () => {
    const gc = gizmoCanvasRef.current;
    if (gc) gc.style.cursor = 'default';
    gizmoSpritesRef.current.forEach(({
      sprite,
      faded
    }) => sprite.scale.setScalar(faded ? 0.33 : 0.38));
  };
  return {
    snapTo,
    raycastGizmo,
    handleGizmoClick,
    handleGizmoMouseMove,
    handleGizmoLeave
  };
}
