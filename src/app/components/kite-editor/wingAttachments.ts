import * as THREE from 'three';
import type { KiteType } from './types';
import type { TransformSnap } from './types';

export function resizeWing(mesh: THREE.Mesh, before: TransformSnap, x: number, y: number) {
  mesh.scale.set(x, y, before.scale.z);
  // Increase the buried root allowance with size, retaining the attachment side.
  const direction = mesh.userData.cornerKey === 'left' ? 1 : -1;
  mesh.position.copy(before.pos);
  mesh.position.x += direction * 0.32 * (Math.max(x, y) - Math.max(before.scale.x, before.scale.y));
}
import { CORNER_SHAPES, TAIL_OVERLAP, type CornerKey, type CornerShapeDef } from './templates';

type Outline = [number, number][];
// One outline drives both the menu thumbnail and the physical wing geometry.
function wing(id: string, label: string, outlines: Outline[]): CornerShapeDef {
  return {
    id, label, color: 0xB0B0B0, vb: '-24 -4 48 120',
    svgD: outlines.map(points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ') + ' Z').join(' '),
    makeGeo: () => new THREE.ShapeGeometry(outlines.map(points => {
      const shape = new THREE.Shape();
      points.forEach(([x, y], i) => i ? shape.lineTo(x / 100, -y / 100) : shape.moveTo(x / 100, -y / 100));
      shape.closePath();
      return shape;
    })),
  };
}

const WING_SHAPES = [
  wing('long_triangle', 'Long Triangle', [[[-16, 0], [16, 0], [0, 110]]]),
  wing('single_ribbon', 'Single Ribbon', [[[-7, 0], [7, 0], [7, 110], [-7, 110]]]),
  wing('twin_ribbons', 'Twin Ribbons', [
    [[-17, 0], [-5, 0], [-5, 110], [-17, 110]],
    [[5, 0], [17, 0], [17, 110], [5, 110]],
  ]),
  wing('wing_diamond', 'Diamond', [[[0, 0], [20, 38], [0, 105], [-20, 38]]]),
  wing('swept_fin', 'Swept Fin', [[[-10, 0], [10, 0], [19, 20], [22, 42], [19, 68], [9, 91], [-4, 110], [0, 64], [-5, 30]]]),
  wing('forked_wing', 'Forked Wing', [[[-16, 0], [16, 0], [20, 105], [0, 80], [-20, 105]]]),
];

export function wingAnchor(type: KiteType, side: 'left' | 'right') {
  const [x, y] = ({
    classic: [1.25, 0], diamond: [0.85, 0.2], oval: [1.1, 0],
    swallow: [1.54, -0.069], fighter: [1.706, -0.377], butterfly: [0.902, 0.25],
  } satisfies Record<KiteType, number[]>)[type];
  return new THREE.Vector3(side === 'left' ? -x : x, y, 0);
}

export function attachmentChoices(corner: CornerKey, type: KiteType) {
  if (corner === 'left' || corner === 'right') {
    return WING_SHAPES;
  }
  return CORNER_SHAPES[corner].filter(s => !s.id.startsWith('bt_') || type === 'butterfly');
}

export function wingMount(type: KiteType, side: 'left' | 'right') {
  const anchor = wingAnchor(type, side);
  // Bury the rotated attachment edge behind the body, not at its outer tip.
  anchor.x += side === 'left' ? 0.32 : -0.32;
  return anchor;
}

export function orientWing(geo: THREE.BufferGeometry, side: 'left' | 'right') {
  geo.computeBoundingBox();
  // Put the attachment edge just inside the corner, then sweep outward and down.
  geo.translate(0, TAIL_OVERLAP - geo.boundingBox!.max.y, 0);
  if (side === 'left') geo.scale(-1, 1, 1);
  geo.rotateZ((side === 'right' ? 1 : -1) * THREE.MathUtils.degToRad(35));
  return geo;
}
