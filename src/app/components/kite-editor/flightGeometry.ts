import type { Vec2 } from '../../flight/types';

const cross = (a: Vec2, b: Vec2, p: Vec2) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
export const signedArea = (p: Vec2[]) => p.reduce((s, a, i) => {
  const b = p[(i + 1) % p.length]; return s + a.x * b.y - b.x * a.y;
}, 0) / 2;

function clean(points: Vec2[], reportUnresolved?: (area: number) => void) {
  const out = points.filter((p, i) => {
    const q = points[(i + points.length - 1) % points.length];
    return Math.hypot(p.x - q.x, p.y - q.y) > 1e-12;
  });
  if (out.length >= 3 && Math.abs(signedArea(out)) > 1e-12) return out;
  const area = Math.abs(signedArea(points));
  if (area > 0) reportUnresolved?.(area);
  return [];
}

function halfPlane(poly: Vec2[], a: Vec2, b: Vec2, inside: boolean, reportUnresolved?: (area: number) => void) {
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = cross(a, b, p), dq = cross(a, b, q);
    const pin = inside ? dp >= 0 : dp <= 0, qin = inside ? dq >= 0 : dq <= 0;
    if (pin) out.push({ ...p });
    if (pin !== qin) {
      const t = dp / (dp - dq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  }
  return clean(out, reportUnresolved);
}

/** Convex subtraction emits disjoint convex pieces, never a bounding-box hull. */
export function subtractConvex(subject: Vec2[], cutter: Vec2[], reportUnresolved?: (area: number) => void): Vec2[][] {
  const clip = signedArea(cutter) < 0 ? [...cutter].reverse() : cutter;
  let remaining = subject;
  const pieces: Vec2[][] = [];
  for (let i = 0; i < clip.length && remaining.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const outside = halfPlane(remaining, a, b, false, reportUnresolved);
    if (outside.length) pieces.push(outside);
    remaining = halfPlane(remaining, a, b, true, reportUnresolved);
  }
  return pieces;
}

/** Recognize only a single actual rectangular sheet for the flight strip model. */
export function rectangleSize(triangles: Vec2[][]): { lengthM: number; widthM: number } | null {
  const unique = new Map<string, Vec2>();
  triangles.flat().forEach(p => unique.set(`${p.x.toFixed(10)},${p.y.toFixed(10)}`, p));
  const pts = [...unique.values()];
  if (pts.length !== 4) return null;
  const center = pts.reduce((s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }), { x: 0, y: 0 });
  pts.sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
  const edges = pts.map((p, i) => ({ x: pts[(i + 1) % 4].x - p.x, y: pts[(i + 1) % 4].y - p.y }));
  if (edges.some((a, i) => { const b = edges[(i + 1) % 4]; return Math.abs(a.x * b.x + a.y * b.y) > 1e-10; })) return null;
  const lengths = edges.map(e => Math.hypot(e.x, e.y));
  const area = triangles.reduce((s, p) => s + Math.abs(signedArea(p)), 0);
  if (Math.abs(area - lengths[0] * lengths[1]) > 1e-10) return null;
  return { lengthM: Math.max(...lengths), widthM: Math.min(...lengths) };
}
