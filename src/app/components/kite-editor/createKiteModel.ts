import * as THREE from 'three';
import { bodySurfaceGeometry, writeBodyMask } from './bodySurface';
import { KITE_HALF, TAIL_OVERLAP, makeTailGeo_Triangle, makeTailGeo_SwallowFork, makeButterflyScoopTailGeo, makeButterflyWingGeo_Left, makeButterflyWingGeo_Right } from './templates';
export function createKiteModel(context: ReturnType<typeof useEditorState>, scene: THREE.Scene) {
  const {
    mode,
    modeRef,
    applyModeColors,
    kiteGroupRef,
    kiteFacesRef,
    cornerPartsRef,
    tailMeshRef,
    vSparRef,
    hSparRef,
    highlightMeshesRef,
    buildGroupRef,
    kiteType
  } = context;
  const kiteGroup = new THREE.Group();
  kiteGroupRef.current = kiteGroup;
  scene.add(kiteGroup);

  // Build-mode shapes live in their own group BEHIND the kite skin in z-order
  const buildGroup = new THREE.Group();
  buildGroup.position.z = -0.01;
  kiteGroup.add(buildGroup);
  buildGroupRef.current = buildGroup;
  const ks = 2.5,
    half = ks / 2;
  const ct = new THREE.Vector3(0, 0, 0);

  // ── kite corner positions vary by type ──────────────────────────────────
  let tp: THREE.Vector3, bt: THREE.Vector3, lt: THREE.Vector3, rt: THREE.Vector3;
  let vSparHeight: number, hSparLX: number, hSparRX: number, hSparY: number, hSparBow: number;
  if (kiteType === 'diamond') {
    // Taller than wide, cross-spar slightly above centre
    tp = new THREE.Vector3(0, 1.65, 0);
    bt = new THREE.Vector3(0, -1.25, 0);
    lt = new THREE.Vector3(-0.85, 0.20, 0);
    rt = new THREE.Vector3(0.85, 0.20, 0);
    vSparHeight = 1.65 + 1.25; // top to bottom
    hSparLX = -0.85;
    hSparRX = 0.85;
    hSparY = 0.20;
    hSparBow = 0.75;
  } else if (kiteType === 'oval') {
    // Rounded ellipse — wider than classic, softer corners
    tp = new THREE.Vector3(0, 1.25, 0);
    bt = new THREE.Vector3(0, -1.25, 0);
    lt = new THREE.Vector3(-1.10, 0, 0);
    rt = new THREE.Vector3(1.10, 0, 0);
    vSparHeight = 2.50;
    hSparLX = -1.10;
    hSparRX = 1.10;
    hSparY = 0;
    hSparBow = 0.75;
  } else if (kiteType === 'swallow') {
    // Traced from SWALLOW_DEFAULTS / SVG reference (spine x=715, scale S=2.50/1154).
    tp = new THREE.Vector3(0, 1.250, 0);
    bt = new THREE.Vector3(0, -0.953, 0);
    lt = new THREE.Vector3(-1.540, -0.069, 0);
    rt = new THREE.Vector3(1.540, -0.069, 0);
    vSparHeight = 1.250 + 0.953;
    hSparLX = -1.540;
    hSparRX = 1.540;
    hSparY = -0.069;
    hSparBow = 0.75;
  } else if (kiteType === 'fighter') {
    // Traced from SVG (743×544). Scale S=2.5/544. Nose=(371,0)→(0,1.25). Tail=(371,544)→(0,-1.25).
    // Wingtips at (0,354)/(742,354)→(±1.706,-0.377). Spar ends (32,339)/(711,339)→(±1.563,-0.308).
    tp = new THREE.Vector3(0, 1.250, 0);
    bt = new THREE.Vector3(0, -1.250, 0);
    lt = new THREE.Vector3(-1.706, -0.377, 0);
    rt = new THREE.Vector3(1.706, -0.377, 0);
    vSparHeight = 2.500;
    hSparLX = -1.563;
    hSparRX = 1.563;
    hSparY = -0.308;
    hSparBow = 0.75;
  } else if (kiteType === 'butterfly') {
    // Traced from SVG (600×927). Scale S=2.5/840≈0.002976, cx=304.5.
    // Spine M304.5,0→797: tp=(0,1.25), bt=(0,-1.122). Spar at y=267→world 0.455.
    tp = new THREE.Vector3(0, 1.250, 0);
    bt = new THREE.Vector3(0, -1.122, 0);
    lt = new THREE.Vector3(-0.603, 0.455, 0);
    rt = new THREE.Vector3(0.608, 0.455, 0);
    vSparHeight = 2.372;
    hSparLX = -0.603;
    hSparRX = 0.608;
    hSparY = 0.455;
    hSparBow = 0.75;
  } else {
    // Classic — symmetric diamond
    tp = new THREE.Vector3(0, half, 0);
    bt = new THREE.Vector3(0, -half, 0);
    lt = new THREE.Vector3(-half, 0, 0);
    rt = new THREE.Vector3(half, 0, 0);
    vSparHeight = ks;
    hSparLX = -half;
    hSparRX = half;
    hSparY = 0;
    hSparBow = 0.75;
  }
  const raycastMeshes: THREE.Mesh[] = [];
  if (kiteType === 'oval') {
    // 4 quarter-ellipse panels using ShapeGeometry — two faces per colour
    const rx = 1.10,
      ry = 1.25;
    const quadrants: [number, number, number][] = [[Math.PI / 2, Math.PI, 0xff0000],
    // top-left
    [0, Math.PI / 2, 0xffff00],
    // top-right
    [Math.PI, 3 * Math.PI / 2, 0x0000ff],
    // bottom-left
    [3 * Math.PI / 2, 2 * Math.PI, 0x00ff00] // bottom-right
    ];
    quadrants.forEach(([a0, a1, color]) => {
      const N = 14;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      for (let i = 0; i <= N; i++) {
        const a = a0 + (a1 - a0) * i / N;
        shape.lineTo(Math.cos(a) * rx, Math.sin(a) * ry);
      }
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape, 1);
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color,
        side: THREE.DoubleSide,
        shininess: 30
      }));
      mesh.userData.surfaceIdx = 0;
      kiteGroup.add(mesh);
      raycastMeshes.push(mesh);
    });
  } else if (kiteType === 'swallow') {
    // 4 panels from the exact traced bezier path (SWALLOW_DEFAULTS scaled to Three.js units).
    // Scale: S = 2.50/1154  →  tailY=1154 → -1.25, nose=0 → +1.25, y flipped (SVG↓ → Three.js↑)
    //
    // Key coords (Three.js):
    //   nose(0,1.25)  shoulderR(0.300,0.828)  wingtipR(1.540,-0.069)  bodyR(0.392,-0.069)
    //   tailFlareR(0.060,-0.849)  tailForkR(0.353,-1.250)  notch(0,-1.161)
    //   bezier C1R(1.007,0.745)  C2R(1.540,0.375)   mirrored for left side
    const wY = -0.069; // wing-line y (= both trailing edge + wingtip y)
    const mk = (fn: (s: THREE.Shape) => void) => {
      const s = new THREE.Shape();
      fn(s);
      return s;
    };
    const swPanels: {
      shape: THREE.Shape;
      color: number;
    }[] = [
    // Panel 0 — upper-right: nose → shoulder (L) → cubic C1,C2 → wingtip → trailing → spine
    {
      color: 0xff0000,
      shape: mk(s => {
        s.moveTo(0, 1.250);
        s.lineTo(0.300, 0.828); // shoulder corner
        s.bezierCurveTo(1.007, 0.745, 1.540, 0.375, 1.540, wY); // leading edge
        s.lineTo(0.392, wY);
        s.lineTo(0, wY);
        s.closePath();
      })
    },
    // Panel 1 — upper-left: nose → spine → trailing → wingtip → cubic → shoulder (L back to nose)
    {
      color: 0xffff00,
      shape: mk(s => {
        s.moveTo(0, 1.250);
        s.lineTo(0, wY);
        s.lineTo(-0.392, wY);
        s.lineTo(-1.540, wY);
        s.bezierCurveTo(-1.540, 0.375, -1.007, 0.745, -0.300, 0.828); // leading edge
        s.closePath(); // L shoulderL → nose
      })
    },
    // Panel 2 — lower-right: body column from wing line to flat tailFlare base
    {
      color: 0x0000ff,
      shape: mk(s => {
        s.moveTo(0, wY);
        s.lineTo(0.392, wY);
        s.lineTo(0.060, -0.849); // tailFlare R
        s.lineTo(0, -0.849); // flat base (half)
        s.lineTo(0, wY);
        s.closePath();
      })
    },
    // Panel 3 — lower-left: mirror of panel 2
    {
      color: 0x00ff00,
      shape: mk(s => {
        s.moveTo(0, wY);
        s.lineTo(0, -0.849); // flat base (half)
        s.lineTo(-0.060, -0.849); // tailFlare L
        s.lineTo(-0.392, wY);
        s.lineTo(0, wY);
        s.closePath();
      })
    }];
    swPanels.forEach(({
      shape,
      color
    }) => {
      const geo = new THREE.ShapeGeometry(shape, 4);
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color,
        side: THREE.DoubleSide,
        shininess: 30
      }));
      mesh.userData.surfaceIdx = 0;
      kiteGroup.add(mesh);
      raycastMeshes.push(mesh);
    });
  } else if (kiteType === 'fighter') {
    // 2 half-panels. Straight leading edges, curved trailing edges (4 cubic bezier segments each).
    // Bezier coords traced from SVG (743×544), converted to world space (S=2.5/544, centred at x=371).
    const mk = (fn: (s: THREE.Shape) => void) => {
      const s = new THREE.Shape();
      fn(s);
      return s;
    };
    const ftPanels: {
      shape: THREE.Shape;
      color: number;
    }[] = [
    // Panel 0 — right: nose → wingtip (straight leading edge) → trailing beziers → tail → spine
    {
      color: 0xff0000,
      shape: mk(s => {
        s.moveTo(0, 1.250);
        s.lineTo(1.706, -0.377);
        s.bezierCurveTo(1.569, -0.298, 1.425, -0.425, 1.306, -0.517);
        s.bezierCurveTo(1.187, -0.609, 0.934, -0.400, 0.784, -0.765);
        s.bezierCurveTo(0.695, -0.910, 0.449, -0.694, 0.375, -0.940);
        s.bezierCurveTo(0.193, -0.981, 0.095, -1.126, 0, -1.250);
        s.closePath();
      })
    },
    // Panel 1 — left: mirror
    {
      color: 0xffff00,
      shape: mk(s => {
        s.moveTo(0, 1.250);
        s.lineTo(0, -1.250);
        s.bezierCurveTo(-0.095, -1.126, -0.193, -0.981, -0.375, -0.940);
        s.bezierCurveTo(-0.449, -0.694, -0.695, -0.910, -0.784, -0.765);
        s.bezierCurveTo(-0.934, -0.400, -1.187, -0.609, -1.306, -0.517);
        s.bezierCurveTo(-1.425, -0.425, -1.569, -0.298, -1.706, -0.377);
        s.closePath();
      })
    }];
    ftPanels.forEach(({
      shape,
      color
    }) => {
      const geo = new THREE.ShapeGeometry(shape, 6);
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color,
        side: THREE.DoubleSide,
        shininess: 30
      }));
      mesh.userData.surfaceIdx = 0;
      kiteGroup.add(mesh);
      raycastMeshes.push(mesh);
    });
  } else if (kiteType === 'butterfly') {
    // 2 half-panels forming the spindle body. S=2.5/840≈0.002976, cx=304.5.
    // Body peaks at (0.634, 0.527) on each side.
    const mk = (fn: (s: THREE.Shape) => void) => {
      const s = new THREE.Shape();
      fn(s);
      return s;
    };
    const bfPanels: {
      shape: THREE.Shape;
      color: number;
    }[] = [{
      color: 0xff0000,
      shape: mk(s => {
        s.moveTo(0, 1.250);
        s.bezierCurveTo(0.165, 1.250, 0.634, 0.738, 0.634, 0.527);
        s.bezierCurveTo(0.634, 0.317, 0.165, -1.250, 0, -1.250);
        s.closePath();
      })
    }, {
      color: 0xffff00,
      shape: mk(s => {
        s.moveTo(0, 1.250);
        s.lineTo(0, -1.250);
        s.bezierCurveTo(-0.165, -1.250, -0.634, 0.317, -0.634, 0.527);
        s.bezierCurveTo(-0.634, 0.738, -0.165, 1.250, 0, 1.250);
        s.closePath();
      })
    }];
    bfPanels.forEach(({
      shape,
      color
    }) => {
      const geo = new THREE.ShapeGeometry(shape, 6);
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color,
        side: THREE.DoubleSide,
        shininess: 30
      }));
      mesh.userData.surfaceIdx = 0;
      kiteGroup.add(mesh);
      raycastMeshes.push(mesh);
    });
  } else {
    // Classic / Diamond — 4 flat triangular panels
    const faceDefs: [THREE.Vector3[], number][] = [[[tp, lt, ct], 0xff0000], [[tp, ct, rt], 0xffff00], [[ct, lt, bt], 0x0000ff], [[ct, bt, rt], 0x00ff00]];
    faceDefs.forEach(([v, c]) => {
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array(9);
      v.forEach((p, i) => {
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      });
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: c,
        side: THREE.DoubleSide,
        shininess: 30
      }));
      mesh.userData.surfaceIdx = 0;
      kiteGroup.add(mesh);
      raycastMeshes.push(mesh);
    });
  }

  // highlight overlays — one per logical surface (diamond, tail)
  const highlightMat = new THREE.MeshBasicMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthTest: false
  });
  const kiteBodyHL = new THREE.Mesh(bodySurfaceGeometry(raycastMeshes), highlightMat.clone());
  raycastMeshes.forEach(mesh => writeBodyMask(mesh.material as THREE.Material));
  kiteBodyHL.renderOrder = 1;
  kiteBodyHL.visible = false;
  kiteGroup.add(kiteBodyHL);
  const fR = 0.015,
    fMat = new THREE.MeshPhongMaterial({
      color: 0x4a2c0a,
      // Draw opaque-looking spars after transparent paint, keeping depth tests
      // so the paper still hides the frame when viewed from the reverse side.
      transparent: true,
      opacity: 1
    });

  // Vertical spar — centred between top and bottom corners
  const vSparCY = (tp.y + bt.y) / 2;
  const vSpar = new THREE.Mesh(new THREE.CylinderGeometry(fR, fR, vSparHeight, 8), fMat);
  vSpar.position.set(0, vSparCY, 0.02);
  vSpar.renderOrder = Infinity;
  kiteGroup.add(vSpar);
  vSparRef.current = vSpar;

  // Horizontal spar — swallow uses a deep cubic arch matching the SVG reference;
  // other kites use a gentle quadratic arch.
  let arch: THREE.Curve<THREE.Vector3>;
  if (kiteType === 'swallow') {
    arch = new THREE.CubicBezierCurve3(new THREE.Vector3(hSparLX, hSparY, 0), new THREE.Vector3(-0.830, 0.811, 0), new THREE.Vector3(0.830, 0.811, 0), new THREE.Vector3(hSparRX, hSparY, 0));
  } else if (kiteType === 'fighter') {
    // Asymmetric cubic from SVG spar path M711,339 C535,168 169,198 32,339 (world coords).
    arch = new THREE.CubicBezierCurve3(new THREE.Vector3(-1.563, -0.308, 0), new THREE.Vector3(-0.928, 0.338, 0), new THREE.Vector3(0.754, 0.476, 0), new THREE.Vector3(1.563, -0.308, 0));
  } else if (kiteType === 'butterfly') {
    // From SVG M507.5,267 C402.024,125.502 182.65,150.431 100.5,267, reversed L→R.
    arch = new THREE.CubicBezierCurve3(new THREE.Vector3(-0.603, 0.455, 0), new THREE.Vector3(-0.358, 0.802, 0), new THREE.Vector3(0.295, 0.877, 0), new THREE.Vector3(0.608, 0.455, 0));
  } else {
    const hArchApex = new THREE.Vector3(0, hSparY + hSparBow, 0);
    arch = new THREE.QuadraticBezierCurve3(new THREE.Vector3(hSparLX, hSparY, 0), hArchApex, new THREE.Vector3(hSparRX, hSparY, 0));
  }
  const hSpar = new THREE.Mesh(new THREE.TubeGeometry(arch, 40, fR, 8, false), fMat.clone());
  hSpar.position.z = 0.02;
  hSpar.renderOrder = Infinity;
  kiteGroup.add(hSpar);
  hSparRef.current = hSpar;
  if (kiteType === 'butterfly') {
    // Pre-attach default wings (left + right) and scoop tail
    const attachDefaultWing = (side: 'left' | 'right') => {
      const geo = side === 'left' ? makeButterflyWingGeo_Left() : makeButterflyWingGeo_Right();
      const color = 0xAEAEAE;
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color,
        side: THREE.DoubleSide,
        shininess: 30
      }));
      mesh.position.set(0, 0, -0.005);
      mesh.renderOrder = -1;
      mesh.userData.cornerKey = side;
      mesh.userData.originalColor = color;
      mesh.userData.kind = 'corner-part';
      kiteGroup.add(mesh);
      cornerPartsRef.current[side] = mesh;
    };
    attachDefaultWing('left');
    attachDefaultWing('right');
    const tailInitGeo = makeButterflyScoopTailGeo();
    tailInitGeo.computeBoundingBox();
    const tailPosY = -KITE_HALF + TAIL_OVERLAP - tailInitGeo.boundingBox!.max.y;
    const tailMesh = new THREE.Mesh(tailInitGeo, new THREE.MeshPhongMaterial({
      color: 0xB9B9B9,
      side: THREE.DoubleSide
    }));
    tailMesh.userData.surfaceIdx = 1;
    tailMesh.userData.originalColor = 0xB9B9B9;
    tailMesh.userData.kind = 'tail-stamp';
    tailMesh.position.set(0, tailPosY, -0.005);
    tailMesh.renderOrder = -1;
    kiteGroup.add(tailMesh);
    tailMeshRef.current = tailMesh;
    cornerPartsRef.current['bottom'] = tailMesh;
    raycastMeshes.push(tailMesh);
    kiteFacesRef.current = raycastMeshes;
    applyModeColors(modeRef.current);
    const tailHL = new THREE.Mesh(tailInitGeo, highlightMat.clone());
    tailHL.position.copy(tailMesh.position);
    tailHL.renderOrder = 1;
    tailHL.visible = false;
    kiteGroup.add(tailHL);
    highlightMeshesRef.current = [kiteBodyHL, tailHL];
  } else if (kiteType !== 'swallow') {
    // Initial tail — triangle default; swallow's tail is structural (built into body geometry)
    const tailInitGeo = makeTailGeo_Triangle();
    // Classic attaches at the triangle's tip; keep the same bounds and overlap.
    if (kiteType === 'classic') tailInitGeo.rotateZ(Math.PI);
    tailInitGeo.computeBoundingBox();
    const tailGeoTopY = tailInitGeo.boundingBox!.max.y;
    // Position: shape top sits TAIL_OVERLAP inside kite bottom vertex
    const tailPosY = -KITE_HALF + TAIL_OVERLAP - tailGeoTopY;
    const tailMesh = new THREE.Mesh(tailInitGeo, new THREE.MeshPhongMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide
    }));
    tailMesh.userData.surfaceIdx = 1;
    tailMesh.userData.originalColor = 0xff0000;
    tailMesh.userData.kind = 'tail-stamp';
    tailMesh.position.set(0, tailPosY, -0.005);
    tailMesh.renderOrder = -1;
    kiteGroup.add(tailMesh);
    tailMeshRef.current = tailMesh;
    raycastMeshes.push(tailMesh);
    kiteFacesRef.current = raycastMeshes;
    applyModeColors(modeRef.current);
    const tailHL = new THREE.Mesh(tailInitGeo, highlightMat.clone());
    tailHL.position.copy(tailMesh.position);
    tailHL.renderOrder = 1;
    tailHL.visible = false;
    kiteGroup.add(tailHL);
    highlightMeshesRef.current = [kiteBodyHL, tailHL];
  } else {
    // Swallow: default tail is SwallowFork, mounted with TAIL_OVERLAP into tailFlare
    const SWALLOW_BASE_Y = -0.849;
    const tailInitGeo = makeTailGeo_SwallowFork();
    tailInitGeo.computeBoundingBox();
    const tailPosY = SWALLOW_BASE_Y + TAIL_OVERLAP - tailInitGeo.boundingBox!.max.y;
    const tailMesh = new THREE.Mesh(tailInitGeo, new THREE.MeshPhongMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide
    }));
    tailMesh.userData.surfaceIdx = 1;
    tailMesh.userData.originalColor = 0xff0000;
    tailMesh.userData.kind = 'tail-stamp';
    tailMesh.position.set(0, tailPosY, -0.005);
    tailMesh.renderOrder = -1;
    kiteGroup.add(tailMesh);
    tailMeshRef.current = tailMesh;
    cornerPartsRef.current['bottom'] = tailMesh;
    raycastMeshes.push(tailMesh);
    kiteFacesRef.current = raycastMeshes;
    applyModeColors(modeRef.current);
    const tailHL = new THREE.Mesh(tailInitGeo, highlightMat.clone());
    tailHL.position.copy(tailMesh.position);
    tailHL.renderOrder = 1;
    tailHL.visible = false;
    kiteGroup.add(tailHL);
    highlightMeshesRef.current = [kiteBodyHL, tailHL];
  }
  return kiteGroup;
}
