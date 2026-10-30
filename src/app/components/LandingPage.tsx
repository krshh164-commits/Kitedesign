import { ArrowUpRight, Sparkles, Wind } from 'lucide-react';

import type { KiteType } from './kite-editor/types';
export type { KiteType } from './kite-editor/types';

interface Props {
  onStart: (type: KiteType) => void;
}

// ── Kite silhouette SVGs for the modal cards ──────────────────────────────────
function KitePreviewSVG({ type }: { type: KiteType }) {
  const sparColor = '#9ca3af';
  if (type === 'classic') return (
    <svg viewBox="-75 -75 150 165" width="90" height="100">
      <polygon points="0,-68 68,0 0,68 -68,0" fill="#d1d5db" stroke="#9ca3af" strokeWidth="2"/>
      <line x1="0" y1="-68" x2="0" y2="68" stroke={sparColor} strokeWidth="2.5"/>
      <path d="M-68,0 Q0,56 68,0" fill="none" stroke={sparColor} strokeWidth="2.5"/>
      {/* small tail */}
      <polygon points="0,68 -14,88 14,88" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
    </svg>
  );
  if (type === 'diamond') return (
    <svg viewBox="-65 -90 130 195" width="80" height="110">
      <polygon points="0,-82 56,10 0,74 -56,10" fill="#d1d5db" stroke="#9ca3af" strokeWidth="2"/>
      <line x1="0" y1="-82" x2="0" y2="74" stroke={sparColor} strokeWidth="2.5"/>
      <path d="M-56,10 Q0,62 56,10" fill="none" stroke={sparColor} strokeWidth="2.5"/>
      <polygon points="0,74 -12,94 12,94" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
    </svg>
  );
  if (type === 'swallow') return (
    <svg viewBox="-86 -5 172 148" width="90" height="100">
      <path d="M0,0 L15.9,22.4 C53.5,27.8 81.8,46.4 81.8,70.0 L20.8,70.0 L3.2,111.4 L-3.2,111.4 L-20.8,70.0 L-81.8,70.0 C-81.8,46.4 -53.5,27.8 -15.9,22.4 Z"
            fill="#d1d5db" stroke="#9ca3af" strokeWidth="2"/>
      <path d="M3.2,111.4 L18.7,132.7 L0,128.0 L-18.7,132.7 L-3.2,111.4 Z"
            fill="#c0c4cc" stroke="#9ca3af" strokeWidth="1.5"/>
      <line x1="0" y1="0" x2="0" y2="116.7" stroke={sparColor} strokeWidth="2.5"/>
      <path d="M-81.8,69.2 C-39.4,18.9 39.4,18.9 81.8,69.2" fill="none" stroke={sparColor} strokeWidth="2.5"/>
    </svg>
  );
  if (type === 'fighter') return (
    // Traced from SVG reference (743×544). Straight leading edges, curved trailing edges.
    <svg viewBox="-10 -10 763 564" width="100" height="74">
      <path d="M371 0 L742.092 354 C712.309 336.717 681.11 364.5 655.11 384.5 C629.11 404.5 574.11 359 541.61 438.5 C522.11 470 468.72 423 452.61 476.5 C413 485.5 391.595 517.06 371 543.5 C350.497 517.06 329.092 485.5 289.482 476.5 C273.371 423 219.982 470 200.482 438.5 C167.982 359 112.982 404.5 86.9816 384.5 C60.9816 364.5 29.7829 336.717 0 354 Z"
            fill="#d1d5db" stroke="#9ca3af" strokeWidth="9"/>
      <line x1="371" y1="0" x2="371" y2="543.5" stroke={sparColor} strokeWidth="9"/>
      <path d="M711 339 C535.035 168.327 169.051 198.396 32 339" fill="none" stroke={sparColor} strokeWidth="9"/>
    </svg>
  );
  if (type === 'butterfly') return (
    <svg viewBox="0 0 600 950" width="50" height="90">
      <path d="M308 0C360 0 518 172 518 243C518 314 360 840 308 840C256 840 91 314 91 243C91 172 256 0 308 0Z"
            fill="#d1d5db" stroke="#9ca3af" strokeWidth="8"/>
      <path d="M303 106V336C163 336 197 353 116 317C104 317 86 336 70 336C60 336 45 321 34 321C22 321 14 336 0 336C0 209 136 106 303 106Z"
            fill="#d1d5db" stroke="#9ca3af" strokeWidth="5"/>
      <path d="M304 106V336C441 336 407 353 486 317C498 317 515 336 531 336C540 336 555 321 566 321C578 321 586 336 600 336C600 209 467 106 304 106Z"
            fill="#d1d5db" stroke="#9ca3af" strokeWidth="5"/>
      <path d="M428 925C393 925 390 904 379 904C365 904 357 918 350 925C341 935 332 904 304 904C274 904 268 935 259 925C253 918 244 904 231 904C219 904 213 925 181 925C181 857 236 801 304 801C372 801 428 857 428 925Z"
            fill="#c0c4cc" stroke="#9ca3af" strokeWidth="5"/>
      <line x1="304" y1="0" x2="304" y2="797" stroke={sparColor} strokeWidth="9"/>
      <path d="M508 267C402 126 183 150 101 267" fill="none" stroke={sparColor} strokeWidth="9"/>
    </svg>
  );
  // oval
  return (
    <svg viewBox="-68 -88 136 190" width="84" height="108">
      <ellipse cx="0" cy="-8" rx="62" ry="74" fill="#d1d5db" stroke="#9ca3af" strokeWidth="2"/>
      <line x1="0" y1="-82" x2="0" y2="66" stroke={sparColor} strokeWidth="2.5"/>
      <line x1="-62" y1="-8" x2="62" y2="-8" stroke={sparColor} strokeWidth="2.5"/>
      <polygon points="0,66 -12,86 12,86" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
    </svg>
  );
}

const templates: { type: KiteType; label: string; desc: string }[] = [
  { type: 'classic', label: 'Classic', desc: 'Symmetric diamond' },
  { type: 'diamond', label: 'Diamond', desc: 'Tall and slender' },
  { type: 'oval', label: 'Oval', desc: 'Soft, rounded curves' },
  { type: 'swallow', label: 'Swallow', desc: 'Swept-back wings' },
  { type: 'fighter', label: 'Fighter', desc: 'Sculpted trailing edge' },
  { type: 'butterfly', label: 'Butterfly', desc: 'Wings and a flowing tail' },
];

export function LandingPage({ onStart }: Props) {
  return (
    <main className="kite-start">
      <header className="kite-start-nav">
        <span className="kite-wordmark"><Wind aria-hidden="true" size={24} /> KiteForge</span>
        <Sparkles aria-hidden="true" size={24} />
      </header>
      <section className="kite-templates" aria-labelledby="kite-title">
        <div className="kite-start-heading">
          <div><p className="kite-eyebrow">A little paper. A lot of possibility.</p>
            <h1 id="kite-title">KiteForge</h1>
            <p className="kite-subtitle">Pick your kite.</p>
          </div>
          <span className="kite-template-count">6 shapes to make your own</span>
        </div>
        <div className="kite-template-grid">
          {templates.map(({ type, label, desc }, index) => (
            <button className={'kite-template kite-template-' + type} key={type}
              onClick={() => onStart(type)} aria-label={'Create ' + label + ' kite'}>
              <div className="kite-template-art" aria-hidden="true">
                <span className="kite-template-number">0{index + 1}</span>
                <KitePreviewSVG type={type} />
              </div>
              <div className="kite-template-caption">
                <div><h2>{label}</h2><p>{desc}</p></div>
                <ArrowUpRight size={22} aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      </section>
      <footer className="kite-start-footer"><Wind size={18} aria-hidden="true" /> Made for a sky full of color.</footer>
    </main>
  );
}
