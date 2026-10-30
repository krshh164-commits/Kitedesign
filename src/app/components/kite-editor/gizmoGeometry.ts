import * as THREE from 'three';
import { CAM_DIST } from './constants';
export function easeInOut(t: number) {
  return t * t * (3 - 2 * t);
}
export function lookAtQuat(pos: THREE.Vector3, up: THREE.Vector3): THREE.Quaternion {
  const obj = new THREE.Object3D();
  obj.up.copy(up);
  obj.position.copy(pos);
  obj.lookAt(0, 0, 0);
  obj.updateMatrixWorld();
  return obj.quaternion.clone();
}
export function makeCircleTexture(label: string, color: string, faded: boolean): THREE.CanvasTexture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  ctx.globalAlpha = faded ? 0.45 : 1.0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = faded ? 0.8 : 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${faded ? 17 : 21}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2 + 1);
  return new THREE.CanvasTexture(cv);
}
export const AXIS_DEFS: {
  key: AxisKey;
  dir: [number, number, number];
  color: string;
  label: string;
  faded: boolean;
}[] = [{
  key: '+x',
  dir: [1, 0, 0],
  color: '#ff3333',
  label: 'X',
  faded: false
}, {
  key: '-x',
  dir: [-1, 0, 0],
  color: '#ff3333',
  label: '-X',
  faded: true
}, {
  key: '+y',
  dir: [0, 1, 0],
  color: '#22cc44',
  label: 'Y',
  faded: false
}, {
  key: '-y',
  dir: [0, -1, 0],
  color: '#22cc44',
  label: '-Y',
  faded: true
}, {
  key: '+z',
  dir: [0, 0, 1],
  color: '#2277ff',
  label: 'Z',
  faded: false
}, {
  key: '-z',
  dir: [0, 0, -1],
  color: '#2277ff',
  label: '-Z',
  faded: true
}];
export const SNAP: Record<AxisKey, {
  pos: THREE.Vector3;
  up: THREE.Vector3;
}> = {
  '+x': {
    pos: new THREE.Vector3(CAM_DIST, 0, 0),
    up: new THREE.Vector3(0, 1, 0)
  },
  '-x': {
    pos: new THREE.Vector3(-CAM_DIST, 0, 0),
    up: new THREE.Vector3(0, 1, 0)
  },
  '+y': {
    pos: new THREE.Vector3(0, CAM_DIST, 0.001),
    up: new THREE.Vector3(0, 0, -1)
  },
  '-y': {
    pos: new THREE.Vector3(0, -CAM_DIST, 0.001),
    up: new THREE.Vector3(0, 0, 1)
  },
  '+z': {
    pos: new THREE.Vector3(0, 0, CAM_DIST),
    up: new THREE.Vector3(0, 1, 0)
  },
  '-z': {
    pos: new THREE.Vector3(0, 0, -CAM_DIST),
    up: new THREE.Vector3(0, 1, 0)
  }
};
