'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import VibeLoader from '@/components/VibeLoader';

type MenuMode = 'collapsed' | 'expanded';

const BOOTH_MESSAGES = [
  "Loading your customer's favorites…",
  'Tuning the vibes…',
  'Stirring in some atmosphere…',
  'Composing the canvas…',
  'Painting your happy place…',
  'Polishing the moment…',
  'Setting the mood lighting…',
  'Almost picture-perfect…',
];

const REGEN_MESSAGES = [
  'Reimagining your vibe…',
  'Fresh strokes incoming…',
  'Mixing a new palette…',
  'Re-tuning the atmosphere…',
  'Drafting a different take…',
  'Pouring a new vision…',
];

interface LoadedOrder {
  id: string;
  name: string;
  orderNumber: number;
  happyPlace: string;
  vibeImageUrl?: string;
}

export default function BoothPage() {
  const [menuMode, setMenuMode] = useState<MenuMode>('expanded');
  const [pad, setPad] = useState('');
  const [order, setOrder] = useState<LoadedOrder | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vibeReady, setVibeReady] = useState(false);
  const [pollGaveUp, setPollGaveUp] = useState(false);
  const screenRef = useRef<HTMLDivElement | null>(null);

  const submitLookup = async () => {
    if (!pad) return;
    setIsFetching(true);
    setError(null);
    setVibeReady(false);
    setPollGaveUp(false);
    try {
      const res = await fetch(`/api/order/number/${pad}`);
      if (res.status === 404) {
        setError(`Order #${pad} not found.`);
      } else if (!res.ok) {
        setError('Lookup failed.');
      } else {
        const data = await res.json();
        setOrder({
          id: data.id,
          name: data.name,
          orderNumber: data.orderNumber,
          happyPlace: data.happyPlace,
          vibeImageUrl: data.vibeImageUrl,
        });
        setPad('');
        // Auto-collapse menu after successful load.
        setMenuMode('collapsed');
      }
    } catch (err) {
      console.error(err);
      setError('Network error.');
    } finally {
      setIsFetching(false);
    }
  };

  const clearOrder = () => {
    setOrder(null);
    setError(null);
    setPad('');
    setVibeReady(false);
    setPollGaveUp(false);
    setMenuMode('expanded');
  };

  // Poll the vibe image URL until the background gen lands the file, or give up.
  useEffect(() => {
    if (!order?.vibeImageUrl) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // ~3 minutes at 3s

    const check = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(order.vibeImageUrl!, { method: 'HEAD', cache: 'no-store' });
        if (cancelled) return;
        if (r.ok) {
          setVibeReady(true);
          return;
        }
      } catch {
        // ignore network blip
      }
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        setPollGaveUp(true);
        return;
      }
      setTimeout(check, 3000);
    };
    const kick = setTimeout(check, 0);
    return () => {
      cancelled = true;
      clearTimeout(kick);
    };
  }, [order?.vibeImageUrl]);

  // Allow physical keyboard input on the big screen for staff convenience.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setPad((p) => (p.length < 4 ? p + e.key : p));
        setMenuMode('expanded');
      } else if (e.key === 'Backspace') {
        setPad((p) => p.slice(0, -1));
      } else if (e.key === 'Enter') {
        submitLookup();
      } else if (e.key === 'Escape') {
        setMenuMode('collapsed');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pad]);

  const regenerateVibe = async () => {
    if (!order) return;
    setIsRegenerating(true);
    setError(null);
    setVibeReady(false);
    setPollGaveUp(false);
    try {
      const res = await fetch(`/api/order/${order.id}/regenerate-vibe`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOrder({ ...order, vibeImageUrl: data.vibeImageUrl });
    } catch (err) {
      console.error(err);
      setError('Regeneration failed.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Tap on the canvas (not the menu) to recall the menu.
  const onCanvasClick = (e: React.MouseEvent) => {
    if (menuMode === 'collapsed') {
      e.stopPropagation();
      setMenuMode('expanded');
    }
  };

  const padDisplay = pad ? `#${pad.padStart(4, '0').replace(/^0+(?=\d{1,4})/, '')}` : '#----';

  return (
    <div ref={screenRef} className="booth" onClick={onCanvasClick}>
      {order?.vibeImageUrl && vibeReady ? (
        <Image
          src={order.vibeImageUrl}
          alt={order.happyPlace || order.name}
          fill
          unoptimized
          priority
          className="vibe-img"
        />
      ) : order?.vibeImageUrl ? (
        <div className="empty-canvas warming">
          {pollGaveUp ? (
            <div className="warm-stack">
              <span className="warm-title">Your vibe image isn&apos;t ready yet.</span>
              <span className="warm-sub">Tap Regenerate from the menu to try again.</span>
            </div>
          ) : (
            <VibeLoader
              tone="dark"
              messages={isRegenerating ? REGEN_MESSAGES : BOOTH_MESSAGES}
              caption={isRegenerating ? 'Reimagining your 4K vibe…' : 'A 4K render is being crafted for you.'}
            />
          )}
        </div>
      ) : (
        <div className="empty-canvas">
          <span className="empty-text">Vibe Café · enter your order number</span>
        </div>
      )}

      {/* Floating corner menu */}
      <div
        className={`menu ${menuMode}`}
        onClick={(e) => e.stopPropagation()}
        role="region"
        aria-label="Order lookup"
      >
        {menuMode === 'collapsed' ? (
          <button className="pill-btn" onClick={() => setMenuMode('expanded')} aria-label="Open menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M8 9h8M8 13h8M8 17h5" />
            </svg>
          </button>
        ) : (
          <div className="panel">
            <div className="panel-head">
              {order ? (
                <div className="loaded">
                  <span className="loaded-num">#{String(order.orderNumber).padStart(3, '0')}</span>
                  <span className="loaded-name">{order.name}</span>
                </div>
              ) : (
                <span className="title">Enter order #</span>
              )}
              <button className="close" onClick={() => setMenuMode('collapsed')} aria-label="Hide menu">×</button>
            </div>

            {!order && (
              <>
                <div className="display">{padDisplay}</div>
                {error && <div className="err">{error}</div>}
                <div className="keypad">
                  {['1','2','3','4','5','6','7','8','9'].map((n) => (
                    <button
                      key={n}
                      className="key"
                      onClick={() => setPad((p) => (p.length < 4 ? p + n : p))}
                    >{n}</button>
                  ))}
                  <button className="key clear" onClick={() => setPad('')} aria-label="Clear">C</button>
                  <button className="key" onClick={() => setPad((p) => (p.length < 4 ? p + '0' : p))}>0</button>
                  <button
                    className="key go"
                    onClick={submitLookup}
                    disabled={!pad || isFetching}
                    aria-label="Lookup"
                  >{isFetching ? '…' : 'GO'}</button>
                </div>
              </>
            )}

            {order && (
              <div className="loaded-actions">
                {error && <div className="err">{error}</div>}
                <button className="action-btn" onClick={regenerateVibe} disabled={isRegenerating}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  {isRegenerating ? 'Regenerating…' : 'Regenerate image'}
                </button>
                <button className="action-btn ghost" onClick={clearOrder}>
                  Switch order
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .booth {
          position: fixed;
          inset: 0;
          background: #000;
          overflow: hidden;
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          cursor: default;
        }
        .vibe-img { object-fit: cover; }
        .empty-canvas {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 50%, #1a1a1a 0%, #000 100%);
        }
        .empty-text {
          color: #555;
          font-size: 1.1rem;
          letter-spacing: 0.05em;
        }
        .empty-canvas.warming { color: #ccc; }
        .warm-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .warm-title { font-size: 1.4rem; font-weight: 500; color: #ddd; }
        .warm-sub { font-size: 0.95rem; color: #888; }

        .menu {
          position: absolute;
          bottom: 24px;
          right: 24px;
          z-index: 10;
        }
        .menu.collapsed .pill-btn {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(8px);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .menu.collapsed .pill-btn:hover { background: rgba(0,0,0,0.75); }

        .panel {
          width: 280px;
          background: rgba(15,15,18,0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .title { color: #aaa; font-size: 0.9rem; letter-spacing: 0.05em; }
        .close {
          background: transparent;
          border: none;
          color: #888;
          font-size: 1.4rem;
          line-height: 1;
          cursor: pointer;
          padding: 0 6px;
        }
        .close:hover { color: #fff; }
        .loaded { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .loaded-num { font-family: monospace; font-weight: 700; color: #8ce98c; font-size: 1rem; }
        .loaded-name { font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .display {
          background: #000;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          padding: 14px 10px;
          text-align: center;
          font-family: monospace;
          font-size: 1.8rem;
          font-weight: 700;
          color: #8ce98c;
          letter-spacing: 0.1em;
        }
        .err {
          background: rgba(244,67,54,0.12);
          color: #ff8a80;
          font-size: 0.8rem;
          padding: 6px 10px;
          border-radius: 8px;
          text-align: center;
        }
        .keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .key {
          padding: 12px 0;
          background: #1a1a1a;
          color: #fff;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.1s, transform 0.05s;
        }
        .key:hover:not(:disabled) { background: #262626; }
        .key:active:not(:disabled) { transform: scale(0.97); }
        .key.clear { background: #2a1212; color: #ff8a80; border-color: #3a1818; }
        .key.go {
          background: #143a18;
          color: #8ce98c;
          border-color: #1f5a25;
        }
        .key.go:disabled { opacity: 0.4; cursor: not-allowed; }

        .loaded-actions { display: flex; flex-direction: column; gap: 8px; }
        .action-btn {
          padding: 10px 12px;
          border-radius: 10px;
          background: #1f5a25;
          color: #d8ffd8;
          border: 1px solid #266b26;
          cursor: pointer;
          font-size: 0.9rem;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
        }
        .action-btn:hover { background: #226b29; }
        .action-btn.ghost { background: transparent; color: #aaa; border-color: #333; }
        .action-btn.ghost:hover { color: #fff; }
        .action-btn:disabled { opacity: 0.5; cursor: wait; }
      `}</style>
    </div>
  );
}
