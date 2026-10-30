import { MousePointer2, Circle, Square, Triangle, Pen, Trash2, Undo2, Redo2 } from 'lucide-react';
import { GIZMO_SIZE, PRESET_COLORS } from './constants';
import { attachmentChoices } from './wingAttachments';
import { PatternPanel } from './PatternPanel';
import { TestFlightDialog } from './TestFlightDialog';
export function EditorControls({
  context
}: {
  context: ReturnType<typeof useEditorState> & ReturnType<typeof useSelection> & ReturnType<typeof useHistory> & ReturnType<typeof useDrawing> & ReturnType<typeof useGizmo> & ReturnType<typeof useAttachments>;
}) {
  const {
    activeTool,
    setActiveTool,
    stampColor,
    setStampColor,
    colorPickerOpen,
    setColorPickerOpen,
    historyTick,
    mode,
    setMode,
    cornerHover,
    cornerHoverPos,
    panelCorner,
    setPanelCorner,
    fadeKey,
    containerRef,
    gizmoCanvasRef,
    kiteGroupRef,
    cornerPartsRef,
    cornerMorphRef,
    selectedFaceRef,
    surfaceDrawingsRef,
    buildGroupRef,
    undoStacksByModeRef,
    redoStacksByModeRef,
    kiteType,
    clearSelectedSurface,
    undoOnSelectedSurface,
    redoOnSelectedSurface,
    handleOverlayMouseDown,
    handleOverlayMouseMove,
    handleOverlayMouseUp,
    handleOverlayMouseLeave,
    handleGizmoClick,
    handleGizmoMouseMove,
    handleGizmoLeave,
    attachCornerPart,
    handleContainerMouseMove
  } = context;
  const tools: {
    id: DrawTool;
    icon: React.ReactNode;
    title: string;
  }[] = [{
    id: 'pointer',
    icon: <MousePointer2 size={18} />,
    title: 'Select / Orbit'
  }, {
    id: 'circle',
    icon: <Circle size={18} />,
    title: 'Draw circle'
  }, {
    id: 'square',
    icon: <Square size={18} />,
    title: 'Draw square'
  }, {
    id: 'triangle',
    icon: <Triangle size={18} />,
    title: 'Draw triangle'
  }, {
    id: 'brush',
    icon: <Pen size={18} />,
    title: 'Free-hand brush'
  }];
  const isDrawTool = activeTool !== 'pointer';
  const toolCursor = activeTool === 'brush' ? 'crosshair' : isDrawTool ? 'crosshair' : 'default';
  return <div className="kite-editor relative size-full" onMouseMove={handleContainerMouseMove}>
      <style>{`
        @keyframes kvFadeIn    { from { opacity:0 }           to { opacity:1 } }
        @keyframes panelSlideIn{ from { transform:translateX(100%) } to { transform:translateX(0) } }
      `}</style>
      <div ref={containerRef} className="size-full" />
      <PatternPanel context={context} />
      <TestFlightDialog context={context} />

      {/* Top-center segmented Build / Design toggle */}
      <div className="kite-mode-bar" style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      background: 'var(--kite-panel)',
      borderRadius: 999,
      padding: 4,
      boxShadow: 'var(--kite-shadow)',
      backdropFilter: 'blur(10px)',
      display: 'flex'
    }}>
        <div style={{
        position: 'relative',
        display: 'flex'
      }}>
          {/* sliding indicator */}
          <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50%',
          height: '100%',
          background: 'var(--kite-pink)',
          border: '1.5px solid var(--kite-accent)',
          borderRadius: 999,
          transform: mode === 'build' ? 'translateX(0%)' : 'translateX(100%)',
          transition: 'transform 0.22s cubic-bezier(.4,1.2,.5,1)',
          pointerEvents: 'none'
        }} />
          {(['build', 'design'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} style={{
          position: 'relative',
          zIndex: 1,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: mode === m ? 'var(--kite-text)' : 'var(--kite-muted)',
          padding: '7px 22px',
          borderRadius: 999,
          letterSpacing: 0,
          transition: 'color 0.18s'
        }}>
              {m === 'build' ? 'Build' : 'Design'}
            </button>)}
        </div>
      </div>

      {/* Draw overlay — captures mouse when a draw tool is active */}
      <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      pointerEvents: isDrawTool ? 'auto' : 'none',
      cursor: toolCursor,
      userSelect: 'none'
    }} onMouseDown={handleOverlayMouseDown} onMouseMove={handleOverlayMouseMove} onMouseUp={handleOverlayMouseUp} onMouseLeave={handleOverlayMouseLeave} />

      {/* Top-right vertical pill: undo / redo / clear (per active surface) */}
      {(() => {
      void historyTick; // re-evaluate when history bumps
      const sel = mode === 'build' ? 0 : selectedFaceRef.current;
      const container = mode === 'build' ? buildGroupRef.current : sel >= 0 ? surfaceDrawingsRef.current[sel] : null;
      const undoArr = undoStacksByModeRef.current?.[mode] ?? [];
      const redoArr = redoStacksByModeRef.current?.[mode] ?? [];
      const canUndo = sel >= 0 && (undoArr[sel]?.length ?? 0) > 0;
      const canRedo = sel >= 0 && (redoArr[sel]?.length ?? 0) > 0;
      const canClear = sel >= 0 && (container?.children.length ?? 0) > 0;
      const btn = (enabled: boolean, onClick: () => void, title: string, icon: React.ReactNode) => <button aria-label={title} title={title} onClick={onClick} disabled={!enabled} style={{
        background: 'transparent',
        border: '1.5px solid transparent',
        borderRadius: 8,
        padding: '7px 9px',
        cursor: enabled ? 'pointer' : 'not-allowed',
        color: enabled ? 'var(--kite-text)' : '#aaa0ab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s, color 0.15s'
      }}>{icon}</button>;
      return <div className="kite-history-bar" style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        background: 'var(--kite-panel)',
        borderRadius: 999,
        padding: '6px 10px',
        boxShadow: 'var(--kite-shadow)',
        backdropFilter: 'blur(10px)'
      }}>
            <div key={`historybar-${fadeKey}`} style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          animation: 'kvFadeIn 0.28s ease'
        }}>
              {btn(canUndo, undoOnSelectedSurface, 'Undo', <Undo2 size={18} />)}
              {btn(canRedo, redoOnSelectedSurface, 'Redo', <Redo2 size={18} />)}
              {btn(canClear, clearSelectedSurface, 'Clear', <Trash2 size={18} />)}
            </div>
          </div>;
    })()}

      {/* Gizmo */}
      <canvas className="kite-gizmo" ref={gizmoCanvasRef} width={GIZMO_SIZE} height={GIZMO_SIZE} style={{
      position: 'absolute',
      bottom: 12,
      right: 12,
      borderRadius: '50%',
      background: 'var(--kite-panel)',
      cursor: 'default',
      zIndex: 20
    }} onClick={handleGizmoClick} onMouseMove={handleGizmoMouseMove} onMouseLeave={handleGizmoLeave} />

      {/* ── Floating toolbar ── */}
      <div style={{
      position: 'absolute',
      bottom: 28,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--kite-panel)',
      borderRadius: 999,
      padding: '6px 10px',
      boxShadow: 'var(--kite-shadow)',
      backdropFilter: 'blur(10px)'
    }}>
       <div key={`bottombar-${fadeKey}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        animation: 'kvFadeIn 0.28s ease'
      }}>
        {tools.filter(tool => mode === 'design' || tool.id !== 'brush').map(({
          id,
          icon,
          title
        }) => <button key={id} aria-label={title} aria-pressed={activeTool === id} title={title} onClick={() => {
          setActiveTool(id);
          setColorPickerOpen(false);
        }} style={{
          background: activeTool === id ? 'var(--kite-pink)' : 'transparent',
          border: activeTool === id ? '1.5px solid var(--kite-accent)' : '1.5px solid transparent',
          borderRadius: 8,
          padding: '7px 9px',
          cursor: 'pointer',
          color: 'var(--kite-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, border 0.15s'
        }}>
            {icon}
          </button>)}

        {mode === 'design' && <>
        {/* divider */}
        <div style={{
          width: 1,
          height: 24,
          background: 'var(--kite-accent)',
          margin: '0 4px'
        }} />

        {/* Color swatch */}
        <button aria-label="Pick color" aria-expanded={colorPickerOpen} title="Pick color" onClick={() => setColorPickerOpen(v => !v)} style={{
          background: colorPickerOpen ? 'var(--kite-pink)' : 'transparent',
          border: colorPickerOpen ? '1.5px solid var(--kite-accent)' : '1.5px solid transparent',
          borderRadius: 8,
          padding: '7px 9px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s'
        }}>
          <div style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: stampColor,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.45)'
          }} />
        </button>
        </>}
       </div>
      </div>

      {/* ── Color picker popover ── */}
      {mode === 'design' && colorPickerOpen && <div style={{
      position: 'absolute',
      bottom: 86,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 60,
      background: 'var(--kite-panel)',
      borderRadius: 14,
      padding: 14,
      boxShadow: 'var(--kite-shadow)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.12)',
      minWidth: 210
    }}>
          <p style={{
        color: 'var(--kite-muted)',
        fontSize: 11,
        marginBottom: 10,
        letterSpacing: 0
      }}>
            STAMP COLOR
          </p>
          <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6,1fr)',
        gap: 8,
        marginBottom: 12
      }}>
            {PRESET_COLORS.map(c => <button key={c} aria-label={`Use color ${c}`} title={c} aria-pressed={stampColor === c} onClick={() => {
          setStampColor(c);
          setColorPickerOpen(false);
        }} style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: c,
          cursor: 'pointer',
          padding: 0,
          border: stampColor === c ? '2.5px solid white' : '2px solid rgba(255,255,255,0.18)'
        }} />)}
          </div>
          <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
            <label style={{
          color: 'var(--kite-muted)',
          fontSize: 11
        }}>Custom</label>
            <input aria-label="Custom color" type="color" value={stampColor} onChange={e => setStampColor(e.target.value)} style={{
          flex: 1,
          height: 28,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          background: 'transparent'
        }} />
          </div>
        </div>}

      <div className="kite-editor-label"><strong>KiteForge</strong><span>{kiteType} kite</span></div>

      {/* ── Corner plus icons (Build mode only) ── */}
      {mode === 'build' && cornerHover && !panelCorner && <button aria-label={`Add or replace ${cornerHover} attachment`} key={cornerHover} onClick={() => setPanelCorner(cornerHover)} style={{
      padding: 0,
      border: 'none',
      background: 'transparent',
      position: 'absolute',
      left: cornerHoverPos.x,
      top: cornerHoverPos.y,
      transform: 'translate(-50%,-50%)',
      zIndex: 110,
      cursor: 'pointer',
      animation: 'kvFadeIn 0.15s ease',
      pointerEvents: 'auto'
    }}>
          <div style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: 'var(--kite-mint)',
        border: '1.5px solid rgba(255,255,255,0.35)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
            <span style={{
          color: 'var(--kite-text)',
          fontSize: 20,
          lineHeight: 1,
          fontWeight: 300,
          userSelect: 'none'
        }}>+</span>
          </div>
        </button>}

      {/* ── Corner shape side panel ── */}
      {panelCorner && (() => {
      // Bottom always has a tail (original or previously replaced), so always "Replace tail"
      const hasExisting = panelCorner === 'bottom' ? true : !!cornerPartsRef.current[panelCorner];
      const headerTitle = {
        top: hasExisting ? 'Replace top decoration' : 'Add to top',
        bottom: 'Replace tail',
        left: hasExisting ? 'Replace left wing' : 'Add left wing',
        right: hasExisting ? 'Replace right wing' : 'Add right wing'
      }[panelCorner];
      const subTitle = {
        top: 'Top Decorations',
        bottom: 'Tail & Extensions',
        left: 'Left Wing Shapes',
        right: 'Right Wing Shapes'
      }[panelCorner];
      return <>
            {/* transparent backdrop — click outside to close */}
            <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 120
        }} onClick={() => setPanelCorner(null)} />

            {/* white card panel */}
            <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 130,
          width: 320,
          maxWidth: '100%',
          background: '#ffffff',
          boxShadow: '-6px 0 40px rgba(0,0,0,0.18), -1px 0 0 rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'panelSlideIn 0.22s cubic-bezier(.4,0,.2,1)',
          fontFamily: 'inherit'
        }}>

              {/* ── header ── */}
              <div style={{
            padding: '22px 20px 16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between'
          }}>
                <div>
                  <div style={{
                fontSize: 11,
                color: '#9ca3af',
                letterSpacing: 0,
                textTransform: 'uppercase',
                marginBottom: 4
              }}>
                    {subTitle}
                  </div>
                  <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#111827',
                lineHeight: 1.2
              }}>
                    {headerTitle}
                  </div>
                </div>
                {/* close X */}
                <button onClick={() => setPanelCorner(null)} style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#f3f4f6',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              marginTop: 2,
              transition: 'background 0.14s'
            }} onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'} onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'} title="Close">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* ── shape grid ── */}
              <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 16px'
          }}>
                <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12
            }}>
                  {attachmentChoices(panelCorner, kiteType).map(shape => <button key={shape.id} onClick={() => attachCornerPart(panelCorner, shape.id)} style={{
                width: '100%',
                height: 130,
                background: '#f9fafb',
                border: '1.5px solid #e5e7eb',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '12px 8px 10px',
                transition: 'border-color 0.14s, background 0.14s, box-shadow 0.14s'
              }} onMouseEnter={e => {
                const b = e.currentTarget;
                b.style.borderColor = '#93c5fd';
                b.style.background = '#eff6ff';
                b.style.boxShadow = '0 0 0 3px rgba(147,197,253,0.35)';
              }} onMouseLeave={e => {
                const b = e.currentTarget;
                b.style.borderColor = '#e5e7eb';
                b.style.background = '#f9fafb';
                b.style.boxShadow = 'none';
              }}>
                      {/* shape rendered in gray */}
                      <svg width="60" height="52" viewBox={shape.vb} style={{
                  overflow: 'visible',
                  flexShrink: 0
                }}>
                        <path d={shape.svgD} fill={shape.svgFill ?? '#9ca3af'} stroke="#6b7280" strokeWidth={shape.svgStrokeW ?? 1.2} strokeLinejoin="round" />
                      </svg>
                      <span style={{
                  fontSize: 11,
                  color: '#374151',
                  fontWeight: 500,
                  textAlign: 'center',
                  lineHeight: 1.3
                }}>
                        {shape.label}
                      </span>
                    </button>)}
                </div>
              </div>

              {/* ── remove footer (only if part exists) ── */}
              {hasExisting && <div style={{
            padding: '12px 16px 16px',
            borderTop: '1px solid #f0f0f0'
          }}>
                  <button onClick={() => {
              const kg = kiteGroupRef.current;
              const old = cornerPartsRef.current[panelCorner!];
              if (!kg || !old) return;
              cornerMorphRef.current = {
                mesh: old,
                startTime: performance.now(),
                dir: -1,
                onDone: () => {
                  kg.remove(old);
                  cornerPartsRef.current[panelCorner!] = undefined;
                }
              };
              setPanelCorner(null);
            }} style={{
              width: '100%',
              padding: '9px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: 8,
              color: '#e11d48',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.14s'
            }} onMouseEnter={e => e.currentTarget.style.background = '#ffe4e6'} onMouseLeave={e => e.currentTarget.style.background = '#fff1f2'}>
                    Remove attachment
                  </button>
                </div>}
            </div>
          </>;
    })()}
    </div>;
}
