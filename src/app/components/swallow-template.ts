// Parametric "Swallow" (gull) kite outline.
// Spine at x=0, nose at origin, +y pointing down (SVG convention).
// All measurements in raw SVG coordinate space; KiteViewer scales them.

export interface SwallowParams {
  spanHalf: number;
  wingY: number;
  bodyHalf: number;
  shoulderX: number;    // also serves as leading-edge cubic CP1.x
  shoulderY: number;    // also serves as leading-edge cubic CP1.y
  tailFlareX: number;
  tailFlareY: number;   // body bottom / tail-mount y
  tailPointX: number;
  tailY: number;
  notchY: number;
  topC2: [number, number];  // leading-edge cubic CP2, as fraction of [spanHalf, wingY]
  sparBow: number;          // pixels above wingY for the spar's gentle arch peak
}

// Solved from the reference SVG (spine recentred to x = 0).
// sparBow tuned to match the blue reference curve (gentler than original).
export const SWALLOW_DEFAULTS: SwallowParams = {
  spanHalf: 711,
  wingY: 609,
  bodyHalf: 181,
  shoulderX: 138.5,
  shoulderY: 195,
  tailFlareX: 27.5,
  tailFlareY: 969,
  tailPointX: 163,
  tailY: 1154,
  notchY: 1113,
  topC2: [1.0, 0.663],
  sparBow: 110,
};

type Pt = [number, number];

// ---------------------------------------------------------------------------
// SVG path string — single smooth cubic per leading edge, no shoulder corner.
// The shoulder position acts as cubic CP1 so the arc passes near it naturally.
// ---------------------------------------------------------------------------
export function buildSwallowPath(p: SwallowParams = SWALLOW_DEFAULTS, spineX = 0): string {
  const X = (x: number) => (spineX + x).toFixed(2);
  const c2: Pt = [p.topC2[0] * p.spanHalf, p.topC2[1] * p.wingY];
  return [
    `M ${X(0)} 0`,
    // Right leading edge: single cubic from nose; shoulder=CP1, c2=CP2
    `C ${X(p.shoulderX)} ${p.shoulderY} ${X(c2[0])} ${c2[1]} ${X(p.spanHalf)} ${p.wingY}`,
    `L ${X(p.bodyHalf)} ${p.wingY}`,
    `L ${X(p.tailFlareX)} ${p.tailFlareY}`,        // body narrows to flare
    `L ${X(-p.tailFlareX)} ${p.tailFlareY}`,        // flat body bottom
    `L ${X(-p.bodyHalf)} ${p.wingY}`,
    `L ${X(-p.spanHalf)} ${p.wingY}`,
    // Left leading edge: cubic from wingtip back to nose; -c2=CP1, -shoulder=CP2
    `C ${X(-c2[0])} ${c2[1]} ${X(-p.shoulderX)} ${p.shoulderY} ${X(0)} 0`,
    `Z`,
  ].join(' ');
}

// NOTE: tailPointX / tailY / notchY are kept in SwallowParams for the separate
// ForkTail shape (makeTailGeo_SwallowFork in KiteViewer.tsx) but are no longer
// part of the body outline above.

// ---------------------------------------------------------------------------
// Cross-spar path — symmetric cubic, bow height controlled by sparBow.
// ---------------------------------------------------------------------------
export function buildSwallowSpar(p: SwallowParams = SWALLOW_DEFAULTS, spineX = 0): string {
  const X = (x: number) => (spineX + x).toFixed(2);
  const bow = p.wingY - p.sparBow;   // apex y (SVG y-down → smaller y = higher)
  return `M ${X(-p.spanHalf)} ${p.wingY} ` +
    `C ${X(-p.spanHalf * 0.4)} ${bow} ${X(p.spanHalf * 0.4)} ${bow} ` +
    `${X(p.spanHalf)} ${p.wingY}`;
}

// ---------------------------------------------------------------------------
// Dense polygon approximation (for area / bridle maths).
// Body only — fork tail is accounted for separately via tailLength in
// getSwallowStructure.
// ---------------------------------------------------------------------------
function cubic(p0: Pt, c1: Pt, c2: Pt, p1: Pt, steps = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([
      u*u*u*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*p1[0],
      u*u*u*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*p1[1],
    ]);
  }
  return out;
}

export function swallowPolygon(p: SwallowParams = SWALLOW_DEFAULTS): Pt[] {
  const c2: Pt = [p.topC2[0] * p.spanHalf, p.topC2[1] * p.wingY];
  const nose: Pt = [0, 0];
  const wingtipR: Pt = [p.spanHalf, p.wingY];

  const pts: Pt[] = [nose];
  // Right leading edge: cubic from nose via (shoulder, c2) to wingtip
  pts.push(...cubic(nose, [p.shoulderX, p.shoulderY] as Pt, c2, wingtipR));
  pts.push(
    [p.bodyHalf, p.wingY],
    [p.tailFlareX, p.tailFlareY],
    [-p.tailFlareX, p.tailFlareY],   // body flat bottom
    [-p.bodyHalf, p.wingY],
    [-p.spanHalf, p.wingY],
  );
  // Left leading edge: cubic from wingtipL back to nose
  pts.push(...cubic(
    [-p.spanHalf, p.wingY] as Pt,
    [-c2[0], c2[1]] as Pt,
    [-p.shoulderX, p.shoulderY] as Pt,
    [0, 0] as Pt,
  ));
  return pts;
}

// ---------------------------------------------------------------------------
// Structural scalars for the flight-score engine.
// tailLengthUnits: caller passes the current tail mesh's world-space height.
// ---------------------------------------------------------------------------
export function getSwallowStructure(
  p: SwallowParams = SWALLOW_DEFAULTS,
  tailLengthUnits = 0,
) {
  const poly = swallowPolygon(p);
  let a2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a2 += x1 * y2 - x2 * y1;
  }
  const area = Math.abs(a2) / 2;
  const spineLength = p.tailFlareY;   // nose → body bottom (excludes detached fork)
  return {
    width: p.spanHalf * 2,
    height: p.tailY,
    area,
    spineLength,
    bridleY: spineLength * 0.52,
    tailLength: tailLengthUnits,      // caller supplies current tail's actual length
    spars: ['spine', 'crossSpar'],
    leftArea: area / 2,
    rightArea: area / 2,
  };
}
