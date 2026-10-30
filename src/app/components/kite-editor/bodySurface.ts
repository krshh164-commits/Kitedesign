import * as THREE from 'three';

// The stencil is written by the actual body panels, so concave edges and gaps
// stay exact without approximating them with convex clipping planes.
export function writeBodyMask(material: THREE.Material) {
  material.stencilWrite = true;
  material.stencilRef = 1;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilZPass = THREE.ReplaceStencilOp;
}

export function clipPaintToBody(material: THREE.Material) {
  material.stencilWrite = true;
  material.stencilWriteMask = 0;
  material.stencilRef = 1;
  material.stencilFunc = THREE.EqualStencilFunc;
}

export function bodySurfaceGeometry(panels: THREE.Mesh[]) {
  const vertices: number[] = [];
  for (const panel of panels) {
    panel.updateMatrix();
    const geo = panel.geometry, pos = geo.getAttribute('position');
    for (let i = 0; i < (geo.index?.count ?? pos.count); i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, geo.index ? geo.index.getX(i) : i);
      p.applyMatrix4(panel.matrix);
      vertices.push(p.x, p.y, p.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}
