import * as THREE from 'three';

export function bindPaintSide(object: THREE.Object3D, camera: THREE.Camera,
  frame: THREE.Object3D, point: THREE.Vector3, normal: THREE.Vector3) {
  frame.updateWorldMatrix(true, false);
  object.updateWorldMatrix(true, false);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point)
    .applyMatrix4(frame.matrixWorld);
  if (plane.distanceToPoint(camera.getWorldPosition(new THREE.Vector3())) < 0) plane.negate();
  object.userData.paintSidePlane = plane.applyMatrix4(object.matrixWorld.clone().invert());
}

export function updatePaintSide(object: THREE.Object3D, cameraPosition: THREE.Vector3) {
  const plane = object.userData.paintSidePlane as THREE.Plane | undefined;
  if (!plane) return;
  object.updateWorldMatrix(true, false);
  object.visible = plane.distanceToPoint(object.worldToLocal(cameraPosition.clone())) > 0.00001;
}
