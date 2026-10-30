import { useEffect, useState } from 'react';
import { Shuffle, X, Palette } from 'lucide-react';
import * as THREE from 'three';
import type { useEditorState } from './useEditorState';

type Pattern = 'plain' | 'dots' | 'crosshatch' | 'waves' | 'four-color';
type Settings = { pattern: Pattern; background: string; ink: string; seed: number };
const initial: Settings = { pattern: 'plain', background: '#f5f5f5', ink: '#9d84b6', seed: 1 };
const choices: [Pattern, string][] = [['plain', 'Plain'], ['dots', 'Dots'], ['crosshatch', 'Crosshatch'], ['waves', 'Waves'], ['four-color', 'Four-color']];

function patternTexture(s: Settings) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!;
  c.fillStyle = s.background; c.fillRect(0, 0, 512, 512);
  c.fillStyle = c.strokeStyle = s.ink;
  let seed = s.seed;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  if (s.pattern === 'dots') {
    for (let y = 30; y < 512; y += 62) for (let x = 30; x < 512; x += 62) {
      c.beginPath(); c.arc(x + random() * 16, y + random() * 16, 4 + random() * 16, 0, Math.PI * 2); c.fill();
    }
  } else if (s.pattern === 'crosshatch') {
    const gap = 28 + Math.floor(random() * 22); c.lineWidth = 2 + random() * 3;
    for (let i = -512; i <= 1024; i += gap) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 512, 512); c.moveTo(i, 0); c.lineTo(i - 512, 512); c.stroke();
    }
  } else if (s.pattern === 'waves') {
    const phase = random() * Math.PI * 2, amplitude = 10 + random() * 14; c.lineWidth = 7;
    for (let y = -32; y < 560; y += 44) {
      c.beginPath();
      for (let x = 0; x <= 512; x += 4) {
        const yy = y + Math.sin(x / 45 + phase) * amplitude;
        if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
      }
      c.stroke();
    }
  } else if (s.pattern === 'four-color') {
    const colors = [s.background, s.ink, '#b3e5fc', '#b9f6ca'];
    for (let i = 0; i < 4; i++) { c.fillStyle = colors[(i + s.seed) % 4]; c.fillRect(i % 2 * 256, Math.floor(i / 2) * 256, 256, 256); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function PatternPanel({ context }: { context: ReturnType<typeof useEditorState> }) {
  const [settings, setSettings] = useState<Settings>({ ...initial });
  const [open, setOpen] = useState(false);
  const selected = settings;
  const change = (patch: Partial<Settings>) => setSettings(s => ({ ...s, ...patch }));
  useEffect(() => {
    if (!context.kiteGroupRef.current || context.mode !== 'design') return;
    const bodies = context.kiteFacesRef.current.filter(m => m.userData.surfaceIdx === 0);
    const box = new THREE.Box3();
    bodies.forEach(m => { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox!); });
    const size = box.getSize(new THREE.Vector3());
    const texture = patternTexture(settings);
    const overlays: THREE.Mesh[] = [];
    bodies.forEach(body => {
        const geo = body.geometry.clone(), pos = geo.getAttribute('position');
        const uv = new Float32Array(pos.count * 2);
        for (let j = 0; j < pos.count; j++) {
          uv[j * 2] = (pos.getX(j) - box.min.x) / (size.x || 1);
          uv[j * 2 + 1] = (pos.getY(j) - box.min.y) / (size.y || 1);
        }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture,
          side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
        body.add(mesh); overlays.push(mesh);
    });
    return () => { overlays.forEach(m => { m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }); texture.dispose(); };
  }, [settings, context.mode, context.kiteType]);
  if (context.mode !== 'design') return null;
  return <>
    <button className="pattern-toggle" aria-label="Patterns" title="Patterns" aria-expanded={open} onClick={() => setOpen(v => !v)}><Palette size={20} /></button>
    <aside className={`pattern-panel ${open ? 'is-open' : ''}`} aria-label="Kite patterns">
      <header><h2>Patterns</h2><button className="pattern-close" aria-label="Close patterns" onClick={() => setOpen(false)}><X size={18}/></button></header>
      <label className="pattern-field">Pattern<select value={selected.pattern} onChange={e => change({ pattern: e.target.value as Pattern })}>{choices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="pattern-color">Background<input aria-label="Pattern background" type="color" value={selected.background} onChange={e => change({ background: e.target.value })}/></label>
      <label className="pattern-color">Pattern color<input aria-label="Pattern color" type="color" disabled={selected.pattern === 'plain'} value={selected.ink} onChange={e => change({ ink: e.target.value })}/></label>
      <button className="pattern-shuffle" disabled={selected.pattern === 'plain'} onClick={() => change({ seed: selected.seed + 1 })}><Shuffle size={16}/> Shuffle</button>
    </aside>
  </>;
}
