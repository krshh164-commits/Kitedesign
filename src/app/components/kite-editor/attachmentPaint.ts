import * as THREE from 'three';
import type { DrawTool } from './types';

export function paintGeometry(source: THREE.BufferGeometry) {
  const geo = source.clone();
  geo.computeBoundingBox();
  const box = geo.boundingBox!, size = box.getSize(new THREE.Vector3());
  const pos = geo.getAttribute('position'), uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - box.min.x) / (size.x || 1);
    uv[i * 2 + 1] = (pos.getY(i) - box.min.y) / (size.y || 1);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function startAttachmentPaint(part: THREE.Mesh, point: THREE.Vector3, tool: DrawTool, color: string, order: number) {
  const geo = paintGeometry(part.geometry), box = geo.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true,
    side: THREE.DoubleSide, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = order; mesh.userData.attachmentPaint = true;
  const start = point.clone(), previous = point.clone();
  const draw = (p: THREE.Vector3) => {
    if (tool !== 'brush') ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.save(); ctx.scale(512 / size.x, 512 / size.y);
    const x = start.x - box.min.x, y = box.max.y - start.y;
    const radius = Math.max(start.distanceTo(p), 0.03);
    ctx.beginPath();
    if (tool === 'brush') {
      ctx.lineWidth = 0.05; ctx.lineCap = 'round';
      ctx.moveTo(previous.x - box.min.x, box.max.y - previous.y);
      ctx.lineTo(p.x - box.min.x, box.max.y - p.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x - box.min.x, box.max.y - p.y, 0.025, 0, Math.PI * 2);
    } else if (tool === 'circle') ctx.arc(x, y, radius, 0, Math.PI * 2);
    else if (tool === 'square') ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
    else { ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y + radius); ctx.lineTo(x - radius, y + radius); ctx.closePath(); }
    ctx.fill(); ctx.restore(); texture.needsUpdate = true; previous.copy(p);
  };
  draw(point);
  return { part, mesh, draw };
}
