import * as THREE from 'three';
import { editorLengthToMetres, measurePolygon } from '../../flight/physics';
import type { AeroProfile, FlightInput, FrameMember, FlexibleTail, Issue, PaperMaterial, Vec3 } from '../../flight/types';
import { MM_PER_UNIT } from './constants';
import { rectangleSize, signedArea, subtractConvex } from './flightGeometry';
import type { useEditorState } from './useEditorState';

type Source = Pick<ReturnType<typeof useEditorState>, 'kiteGroupRef' | 'kiteFacesRef' | 'buildGroupRef' | 'vSparRef' | 'hSparRef'>;
type StickProperties = Pick<FrameMember, 'massKg' | 'densityKgM3' | 'crossSectionAreaM2'>;
export interface FlightAdapterOptions {
  /** Caller-confirmed scale and its evidence; the adapter cannot verify a measurement. */
  scale?: { millimetresPerUnit: number; confirmation: string };
  paper?: PaperMaterial;
  materialsByPart?: Record<string, PaperMaterial>;
  tailModel?: 'panel' | 'flexible';
  flexibleTails?: Record<string, Pick<FlexibleTail, 'centerM' | 'drag'>>;
  frame?: { spine?: StickProperties; cross?: StickProperties };
  profilesByPatch?: Record<string, AeroProfile>;
  bridle?: FlightInput['bridle'];
  line?: FlightInput['line'];
  wind?: FlightInput['wind'];
}
export interface PaperSnapshot {
  id: string;
  role: 'body' | 'wing' | 'tail' | 'build';
  model: 'panel' | 'flexible' | 'unspecified';
  /** Detached numeric triangles retain the rendered tessellation and gaps. */
  trianglesEditor: Vec3[][];
  trianglesM: Vec3[][] | null;
}
export interface EditorFlightSnapshot {
  nominalMillimetresPerUnit: number;
  confirmedScale: FlightAdapterOptions['scale'] | null;
  paper: PaperSnapshot[];
  sticks: { id: 'spine' | 'cross'; sourceId: string; centerlineEditor: Vec3[]; centerlineM: Vec3[] | null }[];
  /** Null when geometry, scale or physical classification cannot be represented. */
  input: FlightInput | null;
  issues: Issue[];
  physicalPaperAreaM2: number | null;
  exposedAreaM2: number | null;
}

const vector = (v: THREE.Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

/** No updateMatrix/World calls: even cached matrices and flags remain untouched. */
function relativeMatrix(node: THREE.Object3D, root: THREE.Object3D, build: THREE.Object3D | null, role: string) {
  const chain: THREE.Object3D[] = [];
  for (let p: THREE.Object3D | null = node; p && p !== root; p = p.parent) chain.unshift(p);
  const rootScale = root.scale.clone();
  if (!root.matrixAutoUpdate) root.matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), rootScale);
  const result = new THREE.Matrix4().makeScale(rootScale.x, rootScale.y, rootScale.z);
  for (const p of chain) {
    const local = p.matrixAutoUpdate ? new THREE.Matrix4().compose(p.position, p.quaternion, p.scale) : p.matrix.clone();
    // Remove only construction-time render separation, not subsequent z movement.
    if (p === build) local.elements[14] += 0.01;
    if (p === node && (role === 'tail' || role === 'wing')) local.elements[14] += 0.005;
    if (p === node && role === 'stick') local.elements[14] -= 0.02;
    result.multiply(local);
  }
  return result;
}

export function snapshotEditorFlight(source: Source, options: FlightAdapterOptions = {}): EditorFlightSnapshot {
  const issues: Issue[] = [];
  let blocked = false;
  const issue = (kind: Issue['kind'], code: string, path: string, message: string, block = false) => {
    issues.push({ kind, code, path, message }); blocked ||= block || kind === 'invalid' || kind === 'unsupported';
  };
  const result: EditorFlightSnapshot = { nominalMillimetresPerUnit: MM_PER_UNIT, confirmedScale: null,
    paper: [], sticks: [], input: null, issues, physicalPaperAreaM2: null, exposedAreaM2: null };
  const root = source.kiteGroupRef.current;
  if (!root) { issue('missing', 'missing-editor', 'editor', 'No live kite.', true); return result; }
  if (!root.matrixAutoUpdate) {
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    root.matrix.decompose(position, rotation, scale);
    const reconstructed = new THREE.Matrix4().compose(position, rotation, scale);
    if (root.matrix.elements.some((n, i) => !Number.isFinite(n) || !Number.isFinite(reconstructed.elements[i]) ||
      Math.abs(n - reconstructed.elements[i]) > 1e-10) || scale.x === 0 || scale.y === 0 || scale.z === 0) {
      issue('unsupported', 'unsupported-root-transform', 'geometry', 'Root matrix must be a nonsingular translation, rotation and scale; shear or projective transforms cannot be separated from the viewing pose.');
      return result;
    }
  }
  let factor: number | null = null;
  if (!options.scale?.confirmation?.trim()) issue('missing', 'missing-scale', 'scale', 'Confirm metres-per-editor-unit from an explicit scale; nominal 100 mm/unit is not manufacturing evidence.', true);
  else {
    try {
      factor = editorLengthToMetres(1, options.scale.millimetresPerUnit);
      result.confirmedScale = { ...options.scale };
    } catch { issue('invalid', 'invalid-scale', 'scale', 'Scale must be positive and finite.'); }
  }
  const inScene = (node: THREE.Object3D | null) => {
    for (let p = node; p; p = p.parent) if (p === root) return true;
    return false;
  };
  const scalePoint = (p: Vec3): Vec3 => ({ x: p.x * factor!, y: p.y * factor!, z: p.z * factor! });
  const finitePoint = (p: Vec3) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  const input: FlightInput = { panels: [], patches: [], frame: [], tails: [], decorations: [],
    bridle: options.bridle && structuredClone(options.bridle), line: options.line && structuredClone(options.line),
    wind: options.wind && structuredClone(options.wind) };
  if (options.line && options.line.model !== 'massless-straight') issue('unsupported', 'unsupported-line', 'line', 'Flight V1 only supports an explicitly selected massless-straight line.');
  const candidates = new Map<THREE.Mesh, PaperSnapshot['role']>();
  const isVisual = (m: THREE.Object3D) => m.userData.attachmentPaint || m.userData.paintSurface || m.userData.paintSidePlane || (m.userData.kind === 'stamp' && !m.userData.build);
  for (const m of source.kiteFacesRef.current) {
    if (inScene(m) && m.userData.surfaceIdx === 0 && !isVisual(m) && !m.userData.build) candidates.set(m, 'body');
  }
  // Live membership wins over stale tail/corner/raycast refs after replacement or undo.
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (isVisual(m)) { input.decorations.push({ id: `visual:${m.uuid}`, kind: 'visual' }); return; }
    if (!m.isMesh) return;
    if (m.parent && candidates.has(m.parent as THREE.Mesh)) {
      input.decorations.push({ id: `visual:${m.uuid}`, kind: 'visual' }); return;
    }
    if (m.userData.kind === 'tail-stamp') candidates.set(m, 'tail');
    else if (m.userData.kind === 'corner-part') candidates.set(m, 'wing');
    else if (m.userData.build && m.userData.kind === 'stamp') candidates.set(m, 'build');
  });
  const bodyTriangles = new Set<string>();
  for (const [mesh, role] of candidates) {
    const id = mesh.uuid;
    const model = role === 'tail' ? options.tailModel ?? 'unspecified' : 'panel';
    const part: PaperSnapshot = { id, role, model, trianglesEditor: [], trianglesM: factor === null ? null : [] };
    result.paper.push(part);
    if (model === 'unspecified') issue('missing', 'missing-tail-model', id, 'Specify whether this paper tail is a flat panel or a flexible strip.', true);
    const geo = mesh.geometry, positions = geo.getAttribute('position');
    const count = geo.index?.count ?? positions?.count ?? 0;
    if (!positions || count % 3 || count === 0 || geo.drawRange.start !== 0 || geo.drawRange.count < count ||
      (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.morphTargetInfluences?.some(n => n !== 0)) {
      issue('unsupported', 'unsupported-paper-geometry', id, 'Expected a complete triangle mesh.'); continue;
    }
    const matrix = relativeMatrix(mesh, root, source.buildGroupRef.current, role);
    const seen = role === 'body' ? bodyTriangles : new Set<string>();
    for (let i = 0; i < (geo.index?.count ?? positions.count); i += 3) {
      const tri = [0, 1, 2].map(j => vector(new THREE.Vector3().fromBufferAttribute(positions, geo.index ? geo.index.getX(i + j) : i + j).applyMatrix4(matrix)));
      if (!tri.every(finitePoint)) { issue('invalid', 'invalid-paper-geometry', id, 'Nonfinite vertex or transform.'); break; }
      const key = tri.map(p => `${p.x.toFixed(10)},${p.y.toFixed(10)},${p.z.toFixed(10)}`).sort().join('|');
      if (seen.has(key)) continue; // reverse-winding faces are not a second paper layer
      seen.add(key); part.trianglesEditor.push(tri);
      if (factor !== null) part.trianglesM!.push(tri.map(scalePoint));
    }
    if (!part.trianglesEditor.length) continue;
    if (part.trianglesEditor.some(t => t.some(p => Math.abs(p.z) > 1e-7))) {
      issue('unsupported', 'nonplanar-paper', id, 'Tilted, folded or displaced paper is outside the flat body-frame flight contract.'); continue;
    }
    if (factor === null) continue;
    const triangles = part.trianglesM!;
    const material = structuredClone(options.materialsByPart?.[id] ?? options.paper ?? { name: 'Unspecified paper' });
    if (material.arealDensityKgM2 === undefined) issue('missing', 'missing-paper-density', id, 'Supply measured paper areal density in kg/m2.');
    else if (!(material.arealDensityKgM2 > 0) || !Number.isFinite(material.arealDensityKgM2)) issue('invalid', 'invalid-paper-density', id, 'Paper density must be positive and finite.');
    for (const tri of triangles) {
      try { measurePolygon(tri); } catch { issue('unsupported', 'degenerate-paper', id, 'Zero-area or numerically unresolved paper triangle.'); }
    }
    if (model === 'flexible') {
      const size = rectangleSize(triangles), supplied = options.flexibleTails?.[id];
      if (!size) issue('unsupported', 'unsupported-flexible-shape', id, 'Flight V1 supports a single rectangular flexible strip, not this outline.');
      else if (!supplied?.centerM) issue('missing', 'missing-tail-pose', id, 'Supply the flexible tail mass center in body-frame metres.', true);
      else {
        input.tails.push({ id, ...size, material, ...structuredClone(supplied) });
        if (!supplied.drag) issue('missing', 'missing-tail-drag', id, 'Supply projected tail area, drag coefficient and drag center.');
      }
      continue;
    }
    triangles.forEach((tri, i) => input.panels.push({ id: `${id}:triangle:${i}`, outlineM: tri.map(p => ({ x: p.x, y: p.y })), material: { ...material } }));
  }
  if (!result.paper.some(p => p.role === 'body' && p.trianglesEditor.length)) issue('missing', 'missing-body', 'body', 'No live body panels.', true);

  for (const [id, mesh] of [['spine', source.vSparRef.current], ['cross', source.hSparRef.current]] as const) {
    if (!mesh || !inScene(mesh)) { issue('missing', 'missing-frame', id, 'Expected the live frame stick.', true); continue; }
    const geo = mesh.geometry as THREE.CylinderGeometry | THREE.TubeGeometry;
    const params = geo.parameters;
    const pos = geo.getAttribute('position');
    const radial = params?.radialSegments;
    const segments = geo.type === 'TubeGeometry' ? (geo as THREE.TubeGeometry).parameters.tubularSegments :
      geo.type === 'CylinderGeometry' ? (geo as THREE.CylinderGeometry).parameters.heightSegments : undefined;
    const count = geo.index?.count ?? pos?.count ?? 0;
    if (!radial || !segments || !pos || !Number.isSafeInteger(radial) || !Number.isSafeInteger(segments) ||
      radial < 3 || segments < 1 || (segments + 1) * (radial + 1) > pos.count ||
      geo.drawRange.start !== 0 || geo.drawRange.count < count ||
      (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
      mesh.morphTargetInfluences?.some(n => n !== 0)) {
      issue('unsupported', 'unsupported-stick', id, 'Expected a complete, undeformed, non-instanced tube or cylinder with valid vertex rings.'); continue;
    }
    const matrix = relativeMatrix(mesh, root, null, 'stick');
    const centerlineEditor: Vec3[] = [];
    for (let i = 0; i <= segments; i++) {
      const center = new THREE.Vector3();
      for (let j = 0; j < radial; j++) center.add(new THREE.Vector3().fromBufferAttribute(pos, i * (radial + 1) + j));
      centerlineEditor.push(vector(center.divideScalar(radial).applyMatrix4(matrix)));
    }
    const centerlineM = factor === null ? null : centerlineEditor.map(scalePoint);
    result.sticks.push({ id, sourceId: mesh.uuid, centerlineEditor, centerlineM });
    if (!centerlineEditor.every(finitePoint)) { issue('invalid', 'invalid-stick', id, 'Nonfinite frame geometry.'); continue; }
    if (!centerlineM) continue;
    const properties = structuredClone(options.frame?.[id] ?? {});
    if (properties.massKg === undefined && (properties.densityKgM3 === undefined || properties.crossSectionAreaM2 === undefined)) issue('missing', 'missing-stick-mass', id, 'Supply measured mass or physical density and cross-section; display radius is not a measurement.');
    for (const [key, value] of Object.entries(properties)) if (value !== undefined && (!Number.isFinite(value) || value < 0 || (key !== 'massKg' && value === 0))) issue('invalid', 'invalid-stick-mass', id, 'Invalid measured stick properties.');
    const lengths = centerlineM.slice(1).map((p, i) => Math.hypot(p.x - centerlineM[i].x, p.y - centerlineM[i].y, p.z - centerlineM[i].z));
    const total = lengths.reduce((a, b) => a + b, 0);
    if (lengths.some(l => !Number.isFinite(l) || l <= 1e-12)) { issue('unsupported', 'degenerate-stick', id, 'Collapsed frame segment.'); continue; }
    lengths.forEach((length, i) => input.frame.push({ id: `${id}:segment:${i}`, startM: { ...centerlineM[i] }, endM: { ...centerlineM[i + 1] }, ...properties,
      massKg: properties.massKg === undefined ? undefined : properties.massKg * length / total }));
  }
  issue('assumption', 'frame-polyline', 'frame', 'Curved sticks use rendered centerline segments and uniform mass per arc length; this is not a stiffness or strength model.');
  issue('assumption', 'body-frame', 'geometry', 'Root pose is excluded; root scale and part transforms are applied. Known render-only z offsets are removed. Curves retain editor tessellation.');
  if (factor !== null && !issues.some(i => i.kind === 'invalid' || i.kind === 'unsupported')) {
    // Every physical layer contributes mass. Each subsequent triangle contributes
    // only pieces outside the union already covered, including concave cut-outs.
    const covered: FlightInput['panels'] = [];
    let unresolvedFragments = 0;
    const reportUnresolved = () => { unresolvedFragments++; };
    partition: for (const panel of input.panels) {
      let fragments = [panel.outlineM];
      for (const prior of covered) {
        fragments = fragments.flatMap(poly => subtractConvex(poly, prior.outlineM, reportUnresolved));
        if (fragments.length + input.patches.length > 20000) { issue('unsupported', 'overlap-complexity', panel.id, 'Overlap partition exceeds the adapter limit.'); break partition; }
      }
      fragments.forEach((outlineM, i) => {
        const id = `${panel.id}:exposed:${i}`;
        input.patches.push({ id, panelId: panel.id, outlineM, profile: options.profilesByPatch?.[id] && structuredClone(options.profilesByPatch[id]) });
      });
      covered.push(panel);
    }
    if (unresolvedFragments) issue('assumption', 'exposure-tolerance', 'patches', `${unresolvedFragments} intermediate clipping fragments were numerically unresolved at the 1e-12 m2 area / 1e-12 m vertex tolerance. Exposed area is approximate; physical paper layers are retained.`);
    if (!issues.some(i => i.kind === 'unsupported')) {
      result.physicalPaperAreaM2 = result.paper.reduce((sum, p) => sum + (p.trianglesM ?? []).reduce((s, t) => s + Math.abs(signedArea(t)), 0), 0);
      result.exposedAreaM2 = input.patches.reduce((s, p) => s + Math.abs(signedArea(p.outlineM)), 0);
    }
  }
  for (const key of ['bridle', 'line', 'wind'] as const) if (!options[key]) issue('missing', `missing-${key}`, key, `Supply explicit ${key} inputs; none are inferred.`);
  if (input.patches.some(p => !p.profile)) issue('missing', 'missing-aerodynamics', 'patches', 'Supply coefficients and pressure centers for the current exposed patches. Recalibrate after geometry changes.');
  result.input = blocked ? null : input;
  return result;
}
