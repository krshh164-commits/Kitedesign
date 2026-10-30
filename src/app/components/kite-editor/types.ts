export type AxisKey = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
export type DrawTool = 'pointer' | 'circle' | 'square' | 'triangle' | 'brush';
export interface TweenState {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  toQuat: THREE.Quaternion;
  startTime: number;
}
export interface HitInfo {
  localPoint: THREE.Vector3;
  localNorm: THREE.Vector3;
}
export interface TransformSnap {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
}
export type HistoryAction = {
  type: 'add';
  obj: THREE.Object3D;
  parent: THREE.Object3D;
} | {
  type: 'transform';
  obj: THREE.Mesh;
  before: TransformSnap;
  after: TransformSnap;
  linked?: { obj: THREE.Mesh; before: TransformSnap; after: TransformSnap };
};
export type DragMode = {
  kind: 'move';
} | {
  kind: 'scale';
  handle: ScaleHandle;
} | {
  kind: 'rotate';
};
export type ScaleHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type KiteType = 'classic' | 'diamond' | 'oval' | 'swallow' | 'fighter' | 'butterfly';
export type EditorMode = 'build' | 'design';
