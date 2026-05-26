'use client';

import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Order {
  id: string;
  name: string;
  coffeeOrder: string;
  imageUrl: string;
  status: string;
  orderNumber?: number;
  createdAt: string;
  completedAt?: string;
}

interface Settings {
  trackingScreens: number;
}

// 3 states only per brief pp.14-19: pending (blue), making (yellow), completed (green).
const STATUS_INDEX: Record<string, number> = {
  pending: 0,
  making: 1,
  completed: 2,
};

// Six rows per screen — matches the page-16 design mockup.
const ROWS_PER_SCREEN = 6;
// Completed (ready) orders stay on the tracking dashboard for this long after
// the barista marks them, then auto-disappear (brief page-1 spec: "Once the
// order is displayed as ready, it will show for 3 minutes and therefore to
// disappear from the list").
const READY_TTL_MS = 3 * 60 * 1000;
// Popup auto-dismiss duration.
const POPUP_MS = 5000;

interface PopupItem {
  key: string; // unique per popup
  orderId: string;
  orderNumber: number;
  name: string;
}

function statusBucket(o: Order): number {
  // ready (completed) at top → making → pending
  if (o.status === 'completed') return 0;
  if (o.status === 'making') return 1;
  return 2; // pending / unknown
}

export default function TrackingScreenPage() {
  const params = useParams<{ screen: string }>();
  const screenNum = Math.max(1, parseInt(params?.screen ?? '1', 10) || 1);

  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings>({ trackingScreens: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [popups, setPopups] = useState<PopupItem[]>([]);
  // Wall-clock tick driving picked-up TTL expiry. Updated every 15 s in an
  // effect so render stays pure (read state, not Date.now()).
  const [nowTick, setNowTick] = useState(0);

  // Map of orderId → last-seen status. Used to detect making→completed
  // transitions across polls. `null` means we haven't fetched yet, so we
  // initialise silently on first response (don't pop up every existing
  // ready order on page load).
  const prevStatusRef = useRef<Map<string, string> | null>(null);

  const enqueuePopup = useCallback((item: PopupItem) => {
    setPopups((prev) => [...prev, item]);
  }, []);

  // Auto-dismiss the head of the popup queue.
  useEffect(() => {
    if (popups.length === 0) return;
    const t = setTimeout(() => {
      setPopups((prev) => prev.slice(1));
    }, POPUP_MS);
    return () => clearTimeout(t);
  }, [popups]);

  const fetchAll = useCallback(async () => {
    try {
      const [ordersRes, configRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/config'),
      ]);
      if (ordersRes.ok) {
        const list = (await ordersRes.json()) as Order[];
        // Detect status transitions before swapping state.
        const next = new Map<string, string>();
        for (const o of list) next.set(o.id, o.status);
        const prev = prevStatusRef.current;
        if (prev !== null) {
          for (const o of list) {
            if (o.status === 'completed' && prev.get(o.id) !== 'completed') {
              enqueuePopup({
                key: `${o.id}-${Date.now()}`,
                orderId: o.id,
                orderNumber: o.orderNumber ?? 0,
                name: o.name,
              });
            }
          }
        }
        prevStatusRef.current = next;
        setOrders(list);
      }
      if (configRes.ok) {
        const cfg = await configRes.json();
        const n = Number(cfg?.trackingScreens);
        setSettings({ trackingScreens: Number.isFinite(n) && n >= 1 ? n : 1 });
      }
    } catch (err) {
      console.error('Failed to fetch tracking data', err);
    } finally {
      setIsLoading(false);
    }
  }, [enqueuePopup]);

  useEffect(() => {
    const t = setTimeout(fetchAll, 0);
    const id = setInterval(fetchAll, 5000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [fetchAll]);

  // Drive picked-up TTL expiry independently of the polling cadence.
  // Seed via setTimeout(0) to satisfy react-hooks/set-state-in-effect;
  // interval keeps the clock fresh.
  useEffect(() => {
    const seed = setTimeout(() => setNowTick(Date.now()), 0);
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => {
      clearTimeout(seed);
      clearInterval(id);
    };
  }, []);

  // Build the global sorted queue:
  // 1. Drop legacy 'pickedUp' orders entirely (status removed in brief pp.14-19).
  // 2. Drop 'completed' orders older than READY_TTL_MS (3 min after they went green).
  // 3. Sort: completed (ready) → making → pending, newest first within each bucket.
  // nowTick is a dep so ready rows fall off after the TTL even when
  // /api/orders hasn't returned anything new.
  const queue = useMemo(() => {
    const now = nowTick || 0;
    const visible = orders.filter((o) => {
      if (o.status === 'pickedUp') return false; // legacy status — hide
      if (o.status !== 'completed') return true;
      if (!o.completedAt) return true; // completed but no timestamp (pre-feature data) — keep visible
      const t = Date.parse(o.completedAt);
      if (!Number.isFinite(t)) return true;
      // Before the first tick (now=0), keep everything; the 15 s interval
      // will start filtering as soon as the clock catches up.
      return now === 0 ? true : now - t < READY_TTL_MS;
    });
    visible.sort((a, b) => {
      const ba = statusBucket(a);
      const bb = statusBucket(b);
      if (ba !== bb) return ba - bb;
      // Newest first within each bucket.
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return visible;
  }, [orders, nowTick]);

  const totalScreens = Math.max(1, settings.trackingScreens);
  const outOfRange = screenNum > totalScreens;
  const start = (screenNum - 1) * ROWS_PER_SCREEN;
  const slice = outOfRange ? [] : queue.slice(start, start + ROWS_PER_SCREEN);

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1 className="page-title brand">Order progress</h1>
          <p className="page-subtitle">
            Vibe Café Status Queue
            {totalScreens > 1 && (
              <span className="screen-tag"> · Screen {screenNum} of {totalScreens}</span>
            )}
          </p>
        </div>
        <div className="legend">
          <span className="legend-item">Received</span>
          <span className="legend-item">Making</span>
          <span className="legend-item">Ready</span>
        </div>
      </div>

      <div className="body">
        <div className="rows-wrap">
          {outOfRange ? (
            <div className="empty">
              Screen {screenNum} is out of range. The store is configured for {totalScreens}{' '}
              tracking screen{totalScreens === 1 ? '' : 's'}.
            </div>
          ) : isLoading && orders.length === 0 ? (
            <div className="empty">Loading queue…</div>
          ) : slice.length === 0 ? (
            <div className="empty">No orders on this screen.</div>
          ) : (
            <ul className="rows">
              {slice.map((o) => {
                const num = o.orderNumber ? String(o.orderNumber).padStart(4, '0') : '----';
                const idx = STATUS_INDEX[o.status] ?? 0;
                const isReady = o.status === 'completed';
                return (
                  <li key={o.id} className="row">
                    <div className="ident">
                      <div className="thumb">
                        {o.imageUrl ? (
                          <Image src={o.imageUrl} alt={o.name} width={56} height={56} unoptimized />
                        ) : (
                          <span className="thumb-fallback">img</span>
                        )}
                      </div>
                      <div className="who">
                        <span className="num">{num}</span>
                        <span className="name">{o.name}</span>
                      </div>
                    </div>

                    <span className={`status-msg ${isReady ? 'ready' : ''}`}>
                      {isReady ? 'Your drink is ready!' : 'Processing...'}
                    </span>

                    <div className="dots">
                      <span className={`status-dot ${idx >= 0 ? 'pending' : ''}`} />
                      <span className={`status-dot ${idx >= 1 ? 'making' : ''}`} />
                      <span className={`status-dot ${idx >= 2 ? 'ready' : ''}`} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {totalScreens > 1 && (
          <div className="pager" aria-label={`Tracking screen ${screenNum} of ${totalScreens}`}>
            {Array.from({ length: totalScreens }).map((_, i) => (
              <span key={i} className={`pager-dot ${i + 1 === screenNum ? 'active' : ''}`} />
            ))}
          </div>
        )}
      </div>

      {/* Ready popup overlay — shows one queued item at a time, auto-dismissed. */}
      {popups.length > 0 && (
        <div className="popup-layer" aria-live="polite">
          <div key={popups[0].key} className="popup">
            <div className="popup-check">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="popup-body">
              <span className="popup-kicker">Order is Ready</span>
              <span className="popup-line">
                <span className="popup-num">
                  #{popups[0].orderNumber ? String(popups[0].orderNumber).padStart(4, '0') : '----'}
                </span>
                <span className="popup-name">{popups[0].name}</span>
              </span>
              <span className="popup-msg">Please pick up your drink.</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 2rem;
          gap: 1rem;
        }
        .brand { color: var(--brand); }
        .screen-tag { color: var(--text-faint); font-size: 0.85rem; margin-left: 0.5rem; }
        .legend {
          display: flex;
          gap: 3rem;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .body { display: grid; grid-template-columns: 1fr auto; gap: 1.25rem; align-items: start; }
        .rows-wrap { min-width: 0; }
        .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.85rem; }
        .row {
          background: var(--surface);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          padding: 1rem 1.5rem;
          display: grid;
          grid-template-columns: minmax(220px, 1fr) 1fr 200px;
          align-items: center;
          gap: 1rem;
        }
        .ident { display: flex; align-items: center; gap: 1rem; }
        .thumb {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--surface-muted);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .thumb :global(img) { width: 100%; height: 100%; object-fit: cover; }
        .thumb-fallback { color: var(--text-faint); font-size: 0.75rem; }
        .who { display: flex; flex-direction: column; line-height: 1.1; }
        .num { font-size: 1.5rem; font-weight: 600; }
        .name { font-size: 1.5rem; font-weight: 600; }
        .status-msg {
          padding: 0.4rem 1rem;
          border-radius: 999px;
          background: transparent;
          color: var(--text-faint);
          font-style: italic;
          justify-self: start;
        }
        .status-msg.ready {
          background: rgba(52,168,83,0.12);
          color: var(--g-green);
          font-style: normal;
        }
        .dots {
          display: flex;
          gap: 2rem;
          justify-content: flex-end;
          align-items: center;
        }
        .empty { padding: 4rem; text-align: center; color: var(--text-muted); }

        .pager {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding-top: 1rem;
          align-items: center;
        }
        .pager-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.18);
        }
        .pager-dot.active { background: var(--brand); }

        .popup-layer {
          position: fixed;
          top: 92px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          pointer-events: none;
          z-index: 200;
        }
        .popup {
          pointer-events: auto;
          background: var(--surface);
          border-radius: var(--radius-md);
          box-shadow: 0 20px 60px rgba(0,0,0,0.18);
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          min-width: 360px;
          max-width: 560px;
          animation: pop-in 280ms cubic-bezier(.2,.7,.2,1);
          border: 1px solid var(--border);
        }
        .popup-check {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #e6f4ea;
          color: var(--g-green);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .popup-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
        .popup-kicker {
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          color: var(--text-faint);
        }
        .popup-line { display: flex; align-items: baseline; gap: 0.6rem; }
        .popup-num { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; }
        .popup-name { font-size: 1.1rem; font-weight: 600; color: var(--text); }
        .popup-msg { font-size: 0.9rem; color: var(--text-muted); }

        @keyframes pop-in {
          from { transform: translateY(-12px) scale(0.96); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }

        @media (max-width: 760px) {
          .row { grid-template-columns: 1fr; }
          .legend { display: none; }
          .dots { justify-content: flex-start; }
          .body { grid-template-columns: 1fr; }
          .pager { flex-direction: row; justify-content: center; }
          .popup { min-width: 0; width: calc(100vw - 2rem); }
        }
      `}</style>
    </main>
  );
}
