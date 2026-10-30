import * as THREE from 'three';
import { attachmentChoices, orientWing, wingAnchor, wingMount } from './wingAttachments';
import { KITE_HALF, TAIL_OVERLAP, type CornerKey } from './templates';
export function useAttachments(context: Pick<ReturnType<typeof useEditorState>, 'setCornerHover' | 'setCornerHoverPos' | 'setPanelCorner' | 'modeRef' | 'BUILD_GRAY' | 'cameraRef' | 'rendererRef' | 'kiteGroupRef' | 'cornerPartsRef' | 'cornerMorphRef' | 'cornerHoverRef' | 'tailMeshRef' | 'kiteType'>) {
  const {
    setCornerHover,
    setCornerHoverPos,
    setPanelCorner,
    modeRef,
    BUILD_GRAY,
    cameraRef,
    rendererRef,
    kiteGroupRef,
    cornerPartsRef,
    cornerMorphRef,
    cornerHoverRef,
    tailMeshRef,
    kiteType
  } = context;
  const attachCornerPart = (corner: CornerKey, shapeId: string) => {
    const kg = kiteGroupRef.current;
    if (!kg) return;
    const shapeDef = attachmentChoices(corner, kiteType).find(s => s.id === shapeId);
    if (!shapeDef) return;
    const doAttach = () => {
      const isBuild = modeRef.current === 'build';
      console.log(`[KiteViewer] Attaching tail shape: corner=${corner}, id=${shapeId}, build=${isBuild}`);
      const geo = shapeDef.makeGeo();
      let posX = 0,
        posY = 0;
      if (corner === 'left' || corner === 'right') {
        orientWing(geo, corner);
        const anchor = wingMount(kiteType, corner);
        posX = anchor.x;
        posY = anchor.y;
      } else {
        // Mount the tail: top edge overlaps TAIL_OVERLAP inside the kite's attach base.
        // Swallow attaches at tailFlare (y=-0.849); others at the bottom vertex (y=-KITE_HALF).
        geo.computeBoundingBox();
        const geoTopY = geo.boundingBox!.max.y;
        const tailBaseY = kiteType === 'swallow' ? -0.849 : -KITE_HALF;
        posY = tailBaseY + TAIL_OVERLAP - geoTopY;
      }
      const mat = new THREE.MeshPhongMaterial({
        color: isBuild ? BUILD_GRAY : shapeDef.color,
        side: THREE.DoubleSide,
        shininess: 30
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(posX, posY, -0.005);
      mesh.renderOrder = -1;
      mesh.scale.setScalar(0);
      mesh.userData.cornerKey = corner;
      mesh.userData.originalColor = shapeDef.color;
      mesh.userData.kind = corner === 'left' || corner === 'right' ? 'corner-part' : 'tail-stamp';
      kg.add(mesh);
      if (corner === 'bottom') {
        mesh.userData.surfaceIdx = 1;
        tailMeshRef.current = mesh;
      }
      cornerPartsRef.current[corner] = mesh;
      cornerMorphRef.current = {
        mesh,
        startTime: performance.now(),
        dir: 1
      };
      console.log(`[KiteViewer] New tail mesh added. posY=${posY.toFixed(3)}, kiteGroup.children=${kg.children.length}`);
    };

    // For the bottom corner, morph out the current tail mesh (original or previously replaced)
    const currentMesh = corner === 'bottom' ? tailMeshRef.current : cornerPartsRef.current[corner] ?? null;
    if (currentMesh) {
      const old = currentMesh;
      cornerMorphRef.current = {
        mesh: old,
        startTime: performance.now(),
        dir: -1,
        onDone: () => {
          kg.remove(old);
          doAttach();
        }
      };
    } else {
      doAttach();
    }
    setPanelCorner(null);
    setCornerHover(null);
    cornerHoverRef.current = null;
  };
  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modeRef.current !== 'build') {
      if (cornerHoverRef.current) {
        cornerHoverRef.current = null;
        setCornerHover(null);
      }
      return;
    }
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const kg = kiteGroupRef.current;
    if (!renderer || !camera || !kg) return;
    const rect = renderer.domElement.getBoundingClientRect();
    let nearest: CornerKey | null = null;
    let nearestDist = Infinity;
    let nearestScreen = {
      x: 0,
      y: 0
    };

    // Use each template's actual wing tips for both placement and hover controls.
    const cornersToCheck: {
      key: CornerKey;
      localPos: THREE.Vector3;
    }[] = [{
      key: 'bottom',
      localPos: new THREE.Vector3(0, -KITE_HALF, 0)
    }, ...[{
      key: 'left' as CornerKey,
      localPos: wingAnchor(kiteType, 'left')
    }, {
      key: 'right' as CornerKey,
      localPos: wingAnchor(kiteType, 'right')
    }]];
    for (const cDef of cornersToCheck) {
      const wp = cDef.localPos.clone().applyMatrix4(kg.matrixWorld);
      const ndc = wp.project(camera);
      const sx = (ndc.x + 1) / 2 * rect.width + rect.left;
      const sy = (-ndc.y + 1) / 2 * rect.height + rect.top;
      const d = Math.hypot(e.clientX - sx, e.clientY - sy);
      if (d < 40 && d < nearestDist) {
        nearestDist = d;
        nearest = cDef.key;
        nearestScreen = {
          x: sx - rect.left,
          y: sy - rect.top
        };
      }
    }
    if (nearest !== cornerHoverRef.current) {
      cornerHoverRef.current = nearest;
      setCornerHover(nearest);
    }
    if (nearest) setCornerHoverPos(nearestScreen);
  };
  return {
    attachCornerPart,
    handleContainerMouseMove
  };
}
