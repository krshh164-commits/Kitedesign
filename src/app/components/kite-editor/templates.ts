import * as THREE from 'three';
export const KITE_HALF = 1.25;
export const TAIL_OVERLAP = 0.16;
export const SURFACE_POLYS: THREE.Vector3[][] = [
// diamond: top, right, bottom, left
[new THREE.Vector3(0, KITE_HALF, 0), new THREE.Vector3(KITE_HALF, 0, 0), new THREE.Vector3(0, -KITE_HALF, 0), new THREE.Vector3(-KITE_HALF, 0, 0)],
// tail
[new THREE.Vector3(0, -KITE_HALF, 0), new THREE.Vector3(0.3, -KITE_HALF - 0.4, 0), new THREE.Vector3(-0.3, -KITE_HALF - 0.4, 0)]];
export type CornerKey = 'top' | 'bottom' | 'left' | 'right';
export interface CornerShapeDef {
  id: string;
  label: string;
  svgD: string;
  vb: string;
  svgFill?: string; // overrides thumbnail fill (default #9ca3af)
  svgStrokeW?: number; // overrides thumbnail stroke-width (default 1.2)
  makeGeo: () => THREE.BufferGeometry;
  color: number;
}
export const CORNER_DEFS: {
  key: CornerKey;
  localPos: THREE.Vector3;
}[] = [{
  key: 'top',
  localPos: new THREE.Vector3(0, KITE_HALF, 0)
}, {
  key: 'bottom',
  localPos: new THREE.Vector3(0, -KITE_HALF, 0)
}, {
  key: 'left',
  localPos: new THREE.Vector3(-KITE_HALF, 0, 0)
}, {
  key: 'right',
  localPos: new THREE.Vector3(KITE_HALF, 0, 0)
}];
function _halfCircle(r: number, up: boolean): THREE.BufferGeometry {
  const N = 24;
  const v: number[] = [0, 0, 0];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI + (up ? 0 : Math.PI);
    v.push(Math.cos(a) * r, Math.sin(a) * r, 0);
  }
  const idx: number[] = [];
  for (let i = 1; i <= N; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function _star(R: number, r: number, pts: number): THREE.BufferGeometry {
  const v: number[] = [0, 0, 0];
  for (let i = 0; i <= pts * 2; i++) {
    const a = i / (pts * 2) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    v.push(Math.cos(a) * rad, Math.sin(a) * rad, 0);
  }
  const idx: number[] = [];
  for (let i = 1; i <= pts * 2; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function _fringe(): THREE.BufferGeometry {
  const strips = 5,
    w = 0.055,
    h = 0.52,
    gap = 0.07,
    totalW = strips * (w + gap) - gap;
  const sx = -totalW / 2;
  const v: number[] = [],
    idx: number[] = [];
  for (let s = 0; s < strips; s++) {
    const x0 = sx + s * (w + gap),
      x1 = x0 + w,
      b = v.length / 3;
    v.push(x0, 0, 0, x1, 0, 0, x1, -h, 0, x0, -h, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function _curl(forRight: boolean): THREE.BufferGeometry {
  const N = 20,
    R = 0.28,
    rr = 0.055,
    sign = forRight ? 1 : -1;
  const v: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 1.5 + Math.PI;
    const cx = Math.cos(a) * R * sign - R * sign,
      cy = Math.sin(a) * R;
    const ta = a + Math.PI / 2;
    v.push(cx + Math.cos(ta) * rr * sign, cy + Math.sin(ta) * rr, 0);
    v.push(cx - Math.cos(ta) * rr * sign, cy - Math.sin(ta) * rr, 0);
  }
  for (let i = 0; i < N; i++) {
    const b = i * 2;
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function _quad(v: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}
function _tri(v: number[], winding = [0, 1, 2]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.setIndex(winding);
  g.computeVertexNormals();
  return g;
}
export function makeTailGeo_Triangle(): THREE.BufferGeometry {
  const hw = 0.28,
    h = 0.44;
  const s = new THREE.Shape();
  s.moveTo(-hw, h / 2);
  s.lineTo(hw, h / 2);
  s.lineTo(0, -h / 2);
  s.closePath();
  return new THREE.ShapeGeometry(s, 1);
}
function makeTailGeo_Square(): THREE.BufferGeometry {
  const hw = 0.25,
    hh = 0.135;
  const s = new THREE.Shape();
  s.moveTo(-hw, hh);
  s.lineTo(hw, hh);
  s.lineTo(hw, -hh);
  s.lineTo(-hw, -hh);
  s.closePath();
  return new THREE.ShapeGeometry(s, 1);
}
function makeTailGeo_Spike(): THREE.BufferGeometry {
  // Long narrow triangle — spike pointing down
  const hw = 0.07,
    h = 0.82;
  const s = new THREE.Shape();
  s.moveTo(-hw, h / 2);
  s.lineTo(hw, h / 2);
  s.lineTo(0, -h / 2);
  s.closePath();
  return new THREE.ShapeGeometry(s, 1);
}
function makeTailGeo_Mustache(): THREE.BufferGeometry {
  // Two filled crescent arms sweeping outward — handlebar mustache
  // Extents approx: x ±0.50, y +0.11 / -0.12 → centered at y≈0
  const shapes: THREE.Shape[] = [];
  for (const sign of [-1, 1] as const) {
    const arm = new THREE.Shape();
    // Outer path: from center top, arcs out and down
    arm.moveTo(sign * 0.05, 0.11);
    arm.bezierCurveTo(sign * 0.16, 0.11, sign * 0.38, 0.07, sign * 0.48, -0.06);
    arm.bezierCurveTo(sign * 0.54, -0.14, sign * 0.52, -0.21, sign * 0.45, -0.21);
    // Inner return path
    arm.bezierCurveTo(sign * 0.40, -0.21, sign * 0.26, -0.10, sign * 0.12, -0.03);
    arm.lineTo(sign * 0.05, 0.00);
    arm.closePath();
    shapes.push(arm);
  }
  return new THREE.ShapeGeometry(shapes, 8);
}
function makeTailGeo_Diamond(): THREE.BufferGeometry {
  const hw = 0.28,
    hh = 0.26;
  const s = new THREE.Shape();
  s.moveTo(0, hh);
  s.lineTo(hw, 0);
  s.lineTo(0, -hh);
  s.lineTo(-hw, 0);
  s.closePath();
  return new THREE.ShapeGeometry(s, 1);
}
function makeTailGeo_Fringe(): THREE.BufferGeometry {
  // 4 strips hanging from a connecting bar — all centered
  const strips = 4,
    sw = 0.07,
    sh = 0.52,
    gap = 0.05,
    barH = 0.06;
  const totalH = barH + sh;
  const oy = totalH / 2; // shift so shape spans ±oy
  const totalW = strips * (sw + gap) - gap;
  const sx = -totalW / 2;
  const shapes: THREE.Shape[] = [];
  const bar = new THREE.Shape();
  bar.moveTo(-totalW / 2, oy);
  bar.lineTo(totalW / 2, oy);
  bar.lineTo(totalW / 2, oy - barH);
  bar.lineTo(-totalW / 2, oy - barH);
  bar.closePath();
  shapes.push(bar);
  for (let i = 0; i < strips; i++) {
    const x0 = sx + i * (sw + gap),
      x1 = x0 + sw;
    const strip = new THREE.Shape();
    strip.moveTo(x0, oy - barH);
    strip.lineTo(x1, oy - barH);
    strip.lineTo(x1, oy - totalH);
    strip.lineTo(x0, oy - totalH);
    strip.closePath();
    shapes.push(strip);
  }
  return new THREE.ShapeGeometry(shapes, 1);
}
function makeTailGeo_RibbonV(): THREE.BufferGeometry {
  // Two diagonal strips diverging downward in a V — centered
  const totalH = 0.64,
    rw = 0.052;
  const oy = totalH / 2;
  const shapes: THREE.Shape[] = [];
  for (const sign of [-1, 1] as const) {
    const ax = sign * 0.07,
      ay = oy;
    const bx = sign * 0.46,
      by = -oy;
    const dx = bx - ax,
      dy = by - ay,
      dlen = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / dlen * rw,
      ny = dx / dlen * rw;
    const strip = new THREE.Shape();
    strip.moveTo(ax + nx, ay + ny);
    strip.lineTo(ax - nx, ay - ny);
    strip.lineTo(bx - nx, by - ny);
    strip.lineTo(bx + nx, by + ny);
    strip.closePath();
    shapes.push(strip);
  }
  return new THREE.ShapeGeometry(shapes, 1);
}
export function makeTailGeo_SwallowFork(): THREE.BufferGeometry {
  // Mount contract: y=0 is the top (flat attach edge), shape extends downward.
  // baseHalf=0.060 (tailFlareX×S), forkHalfW=0.353, forkDepth=0.401, notchDepth=0.312
  const HW = 0.060,
    FHW = 0.353,
    FD = 0.401,
    ND = 0.312;
  const s = new THREE.Shape();
  s.moveTo(-HW, 0);
  s.lineTo(HW, 0);
  s.lineTo(FHW, -FD);
  s.lineTo(0, -ND);
  s.lineTo(-FHW, -FD);
  s.closePath();
  return new THREE.ShapeGeometry(s, 2);
}
export function makeButterflyScoopTailGeo(): THREE.BufferGeometry {
  // Scalloped tail traced from SVG B9 path. y=0=attach, extends downward.
  // Scallop amplitude: -0.307 ridges, -0.369 tips; arc back up to attach.
  const s = new THREE.Shape();
  s.moveTo(0.371, -0.369);
  s.bezierCurveTo(0.267, -0.369, 0.259, -0.307, 0.225, -0.307);
  s.bezierCurveTo(0.185, -0.307, 0.162, -0.347, 0.140, -0.369);
  s.bezierCurveTo(0.112, -0.396, 0.086, -0.307, 0, -0.307);
  s.bezierCurveTo(-0.087, -0.307, -0.103, -0.398, -0.131, -0.369);
  s.bezierCurveTo(-0.149, -0.349, -0.177, -0.307, -0.216, -0.307);
  s.bezierCurveTo(-0.251, -0.307, -0.267, -0.369, -0.365, -0.369);
  s.bezierCurveTo(-0.365, -0.165, -0.200, 0, 0, 0);
  s.bezierCurveTo(0.206, 0, 0.371, -0.165, 0.371, -0.369);
  s.closePath();
  return new THREE.ShapeGeometry(s, 6);
}
export function makeButterflyWingGeo_Left(): THREE.BufferGeometry {
  // Left wing mount: spine edge at x=0, spans y=[0.250..0.935], extends to x=-0.902.
  // Traced from SVG AE path left-wing (cx=303, S=0.002976).
  const s = new THREE.Shape();
  s.moveTo(0, 0.935);
  s.lineTo(0, 0.250);
  s.bezierCurveTo(-0.418, 0.250, -0.316, 0.200, -0.557, 0.308);
  s.bezierCurveTo(-0.594, 0.308, -0.645, 0.250, -0.693, 0.250);
  s.bezierCurveTo(-0.722, 0.250, -0.767, 0.296, -0.800, 0.296);
  s.bezierCurveTo(-0.835, 0.296, -0.861, 0.250, -0.902, 0.250);
  s.bezierCurveTo(-0.902, 0.628, -0.498, 0.935, 0, 0.935);
  s.closePath();
  return new THREE.ShapeGeometry(s, 6);
}
export function makeButterflyWingGeo_Right(): THREE.BufferGeometry {
  // Mirror of left wing.
  const s = new THREE.Shape();
  s.moveTo(0, 0.935);
  s.lineTo(0, 0.250);
  s.bezierCurveTo(0.418, 0.250, 0.316, 0.200, 0.557, 0.308);
  s.bezierCurveTo(0.594, 0.308, 0.645, 0.250, 0.693, 0.250);
  s.bezierCurveTo(0.722, 0.250, 0.767, 0.296, 0.800, 0.296);
  s.bezierCurveTo(0.835, 0.296, 0.861, 0.250, 0.902, 0.250);
  s.bezierCurveTo(0.902, 0.628, 0.498, 0.935, 0, 0.935);
  s.closePath();
  return new THREE.ShapeGeometry(s, 6);
}
export const CORNER_SHAPES: Record<CornerKey, CornerShapeDef[]> = {
  bottom: [{
    id: 'fork',
    label: 'Swallow Fork',
    color: 0xB0B0B0,
    svgD: 'M17,0 L23,0 L40,23 L20,18 L0,23 Z',
    vb: '0 0 40 24',
    makeGeo: makeTailGeo_SwallowFork
  }, {
    id: 'tri',
    label: 'Small Triangle',
    color: 0xB0B0B0,
    svgD: 'M20,2 L38,34 L2,34 Z',
    vb: '0 0 40 36',
    makeGeo: makeTailGeo_Triangle
  }, {
    id: 'square',
    label: 'Square',
    color: 0xB0B0B0,
    svgD: 'M4,2 L36,2 L36,30 L4,30 Z',
    vb: '0 0 40 32',
    makeGeo: makeTailGeo_Square
  }, {
    id: 'spike',
    label: 'Spike',
    color: 0xB0B0B0,
    svgD: 'M17,2 L23,2 L20,38 Z',
    vb: '0 0 40 40',
    makeGeo: makeTailGeo_Spike
  }, {
    id: 'mustache',
    label: 'Mustache',
    color: 0xB0B0B0,
    svgD: 'M17,5 C11,5 3,12 3,21 C3,29 7,34 11,33 C9,29 8,23 10,18 C12,13 15,9 17,9 Z M23,5 C29,5 37,12 37,21 C37,29 33,34 29,33 C31,29 32,23 30,18 C28,13 25,9 23,9 Z',
    vb: '0 0 40 38',
    makeGeo: makeTailGeo_Mustache
  }, {
    id: 'dia',
    label: 'Diamond',
    color: 0xB0B0B0,
    svgD: 'M20,2 L37,20 L20,36 L3,20 Z',
    vb: '0 0 40 38',
    makeGeo: makeTailGeo_Diamond
  }, {
    id: 'fringe',
    label: 'Fringe',
    color: 0xB0B0B0,
    svgD: 'M1,0 L39,0 L39,5 L1,5 Z M1,5 L9,5 L9,34 L1,34 Z M12,5 L20,5 L20,34 L12,34 Z M23,5 L31,5 L31,34 L23,34 Z M34,5 L42,5 L42,34 L34,34 Z',
    vb: '0 0 44 34',
    makeGeo: makeTailGeo_Fringe
  }, {
    id: 'ribbon',
    label: 'Ribbon V',
    color: 0xB0B0B0,
    svgD: 'M13,0 L19,0 L5,36 L-1,36 Z M21,0 L27,0 L41,36 L35,36 Z',
    vb: '-2 0 44 36',
    makeGeo: makeTailGeo_RibbonV
  }, {
    id: 'bt_scoop',
    label: 'Scalloped',
    color: 0xB9B9B9,
    svgD: 'M0,0 L40,0 C36,0 37,10 32,10 C27,10 28,0 20,0 C12,0 13,10 8,10 C3,10 4,0 0,0 Z',
    vb: '0 0 40 12',
    makeGeo: makeButterflyScoopTailGeo
  }],
  top: [{
    id: 'cap',
    label: 'Pointed Cap',
    color: 0xff8800,
    svgD: 'M20,0 L40,36 L0,36 Z',
    vb: '0 0 40 36',
    makeGeo: () => _tri([-0.34, 0, 0, 0.34, 0, 0, 0, 0.5, 0], [0, 1, 2])
  }, {
    id: 'round',
    label: 'Round Cap',
    color: 0x00cccc,
    svgD: 'M0,36 A20,20 0 0 1 40,36 Z',
    vb: '0 16 40 20',
    makeGeo: () => _halfCircle(0.34, true)
  }, {
    id: 'star',
    label: 'Star',
    color: 0xffdd00,
    svgD: 'M20,2 L24,14 L38,14 L27,22 L31,34 L20,26 L9,34 L13,22 L2,14 L16,14 Z',
    vb: '0 0 40 36',
    makeGeo: () => _star(0.28, 0.12, 5)
  }, {
    id: 'flag',
    label: 'Flag',
    color: 0xff3333,
    svgD: 'M4,0 L4,30 M4,4 L36,4 L28,14 L36,24 L4,24',
    vb: '0 0 40 34',
    makeGeo: () => _quad([0, 0, 0, 0.52, 0, 0, 0.52, 0.33, 0, 0, 0.33, 0])
  }],
  left: [{
    id: 'fin',
    label: 'Fin',
    color: 0x3388ff,
    svgD: 'M36,18 L0,4 L0,32 Z',
    vb: '0 0 36 36',
    makeGeo: () => _tri([0, 0.2, 0, 0, -0.2, 0, -0.44, 0, 0], [0, 2, 1])
  }, {
    id: 'wing',
    label: 'Wing',
    color: 0x33cc44,
    svgD: 'M34,14 L0,2 L0,26 L20,34 Z',
    vb: '0 0 36 36',
    makeGeo: () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.32, 0, 0, -0.18, 0, -0.6, -0.08, 0, -0.38, 0.24, 0]), 3));
      g.setIndex([0, 2, 1, 0, 3, 2]);
      g.computeVertexNormals();
      return g;
    }
  }, {
    id: 'ribbon',
    label: 'Ribbon',
    color: 0xffdd00,
    svgD: 'M0,14 L36,14 L36,22 L0,22 Z',
    vb: '0 0 36 36',
    makeGeo: () => _quad([0, 0.07, 0, 0, -0.07, 0, -0.62, -0.07, 0, -0.62, 0.07, 0])
  }, {
    id: 'curl',
    label: 'Curl',
    color: 0xaa33ff,
    svgD: 'M34,18 Q34,2 18,2 Q2,2 2,18 Q2,34 18,34',
    vb: '0 0 36 36',
    makeGeo: () => _curl(false)
  }, {
    id: 'bt_wing_l',
    label: 'Butterfly Wing',
    color: 0xAEAEAE,
    svgD: 'M36,14 L36,2 C18,0 0,4 0,14 C0,24 18,28 36,26 Z',
    vb: '0 0 38 28',
    makeGeo: makeButterflyWingGeo_Left
  }],
  right: [{
    id: 'fin_r',
    label: 'Fin',
    color: 0x3388ff,
    svgD: 'M0,18 L36,4 L36,32 Z',
    vb: '0 0 36 36',
    makeGeo: () => _tri([0, 0.2, 0, 0.44, 0, 0, 0, -0.2, 0], [0, 1, 2])
  }, {
    id: 'wing_r',
    label: 'Wing',
    color: 0x33cc44,
    svgD: 'M2,14 L36,2 L36,26 L16,34 Z',
    vb: '0 0 36 36',
    makeGeo: () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.32, 0, 0.6, -0.08, 0, 0, -0.18, 0, 0.38, 0.24, 0]), 3));
      g.setIndex([0, 1, 2, 0, 3, 1]);
      g.computeVertexNormals();
      return g;
    }
  }, {
    id: 'ribbon_r',
    label: 'Ribbon',
    color: 0xffdd00,
    svgD: 'M0,14 L36,14 L36,22 L0,22 Z',
    vb: '0 0 36 36',
    makeGeo: () => _quad([0, 0.07, 0, 0.62, 0.07, 0, 0.62, -0.07, 0, 0, -0.07, 0])
  }, {
    id: 'curl_r',
    label: 'Curl',
    color: 0xaa33ff,
    svgD: 'M2,18 Q2,2 18,2 Q34,2 34,18 Q34,34 18,34',
    vb: '0 0 36 36',
    makeGeo: () => _curl(true)
  }, {
    id: 'bt_wing_r',
    label: 'Butterfly Wing',
    color: 0xAEAEAE,
    svgD: 'M0,14 L0,2 C18,0 36,4 36,14 C36,24 18,28 0,26 Z',
    vb: '0 0 38 28',
    makeGeo: makeButterflyWingGeo_Right
  }]
};
