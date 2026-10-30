import * as THREE from 'three';
import { BRUSH_R } from './constants';
import { SURFACE_POLYS } from './templates';
import { clipPaintToBody } from './bodySurface';
export function intersectDrawingPlane(ray: THREE.Ray, group: THREE.Object3D, point: THREE.Vector3, normal: THREE.Vector3) {
  group.updateWorldMatrix(true, false);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point).applyMatrix4(group.matrixWorld);
  const hit = ray.intersectPlane(plane, new THREE.Vector3());
  return hit ? group.worldToLocal(hit) : null;
}
export function makeShapeGeo(tool: DrawTool, size: number): THREE.BufferGeometry {
  if (tool === 'circle') return new THREE.CircleGeometry(size / 2, 40);
  if (tool === 'square') return new THREE.PlaneGeometry(size, size);
  // equilateral triangle
  const h = size * Math.sqrt(3) / 2;
  const geo = new THREE.BufferGeometry();
  const v = new Float32Array([0, h * (2 / 3), 0, -size / 2, -h * (1 / 3), 0, size / 2, -h * (1 / 3), 0]);
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}
export function addBrushSeg(from: THREE.Vector3, to: THREE.Vector3, color: string, parent: THREE.Group, clippingPlanes: THREE.Plane[] = [], renderOrder = 0, bodyMask = false) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 0.001) return;
  const mat = new THREE.MeshBasicMaterial({
    color,
    clippingPlanes,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    transparent: true,
    depthWrite: false
  });
  if (bodyMask) clipPaintToBody(mat);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(BRUSH_R, BRUSH_R, len, 8), mat);
  cyl.position.copy(from).add(to).multiplyScalar(0.5);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  cyl.renderOrder = renderOrder;
  parent.add(cyl);
  const sph = new THREE.Mesh(new THREE.SphereGeometry(BRUSH_R, 8, 8), mat.clone());
  sph.position.copy(to);
  sph.renderOrder = renderOrder;
  parent.add(sph);
}
export function computeBuildShapeClipping(mesh: THREE.Mesh, kiteGroup: THREE.Group): THREE.Plane[] {
  mesh.updateMatrixWorld(true);
  kiteGroup.updateMatrixWorld(true);
  const invKite = new THREE.Matrix4().copy(kiteGroup.matrixWorld).invert();
  const meshToKite = new THREE.Matrix4().multiplyMatrices(invKite, mesh.matrixWorld);
  const pos = mesh.geometry.getAttribute('position');
  const pts: THREE.Vector3[] = [];
  if (mesh.userData.tool === 'circle') {
    // Sample 8 perimeter points at the geometry's actual radius.
    const rVec = new THREE.Vector3().fromBufferAttribute(pos, 1);
    const r = rVec.length();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0).applyMatrix4(meshToKite));
    }
  } else {
    // Use unique XY vertices (triangle = 3, square = 4).
    const seen = new Set<string>();
    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i);
      const key = `${p.x.toFixed(5)},${p.y.toFixed(5)}`;
      if (!seen.has(key)) {
        seen.add(key);
        pts.push(p.applyMatrix4(meshToKite));
      }
    }
  }
  const centroid = pts.reduce((acc, p) => acc.add(p.clone()), new THREE.Vector3()).divideScalar(pts.length);
  return pts.map((p1, i) => {
    const p2 = pts[(i + 1) % pts.length];
    const d = new THREE.Vector3().subVectors(p2, p1);
    let n = new THREE.Vector3(-d.y, d.x, 0).normalize();
    if (n.dot(new THREE.Vector3().subVectors(centroid, p1)) < 0) n.negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p1);
    plane.applyMatrix4(kiteGroup.matrixWorld);
    return plane;
  });
}
export function computeSurfaceClipping(surfaceIdx: number, kiteGroup: THREE.Group): THREE.Plane[] {
  const poly = SURFACE_POLYS[surfaceIdx];
  if (!poly) return [];
  const centroid = poly.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / poly.length);
  kiteGroup.updateMatrixWorld(true);
  return poly.map((p1, i) => {
    const p2 = poly[(i + 1) % poly.length];
    const d = new THREE.Vector3().subVectors(p2, p1);
    let n = new THREE.Vector3(-d.y, d.x, 0).normalize();
    if (n.dot(new THREE.Vector3().subVectors(centroid, p1)) < 0) n.negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p1);
    plane.applyMatrix4(kiteGroup.matrixWorld);
    return plane;
  });
}
