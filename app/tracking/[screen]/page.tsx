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

  const totalScreens = Math.max(1, settings.trackingScreens);

  // Build the global sorted queue with capacity-aware expiry (replaces the
  // earlier fixed 3-min TTL): active orders (pending + making) are never
  // dropped; completed orders fill the REMAINING slots, newest first, and
  // older ones silently fall off only when newer orders push them out.
  //
  // 1. Drop legacy 'pickedUp' orders entirely (status removed in brief pp.14-19).
  // 2. Sort: completed (ready) → making → pending. Within the completed bucket
  //    sort by completedAt (newest first) since "most recently ready" is what
  //    a customer at the counter cares about; within active buckets sort by
  //    createdAt.
  // 3. Capacity = trackingScreens × ROWS_PER_SCREEN. Keep all active orders;
  //    keep only the newest `capacity - activeCount` completed orders.
  const queue = useMemo(() => {
    const visible = orders.filter((o) => o.status !== 'pickedUp');
    visible.sort((a, b) => {
      const ba = statusBucket(a);
      const bb = statusBucket(b);
      if (ba !== bb) return ba - bb;
      const aT = a.status === 'completed' ? (a.completedAt || a.createdAt) : a.createdAt;
      const bT = b.status === 'completed' ? (b.completedAt || b.createdAt) : b.createdAt;
      return String(bT || '').localeCompare(String(aT || ''));
    });

    const totalCapacity = totalScreens * ROWS_PER_SCREEN;
    const activeCount = visible.filter((o) => o.status !== 'completed').length;
    const completedBudget = Math.max(0, totalCapacity - activeCount);

    let keptCompleted = 0;
    return visible.filter((o) => {
      if (o.status !== 'completed') return true; // active orders always kept
      if (keptCompleted < completedBudget) { keptCompleted++; return true; }
      return false; // overflow completed — drop oldest first (already sorted newest→oldest)
    });
  }, [orders, totalScreens]);
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
      </div>

      <div className="body">
        <div className="rows-wrap">
          {/* Legend lives inside rows-wrap so it shares the same horizontal
              layout as each row; the dots-column sub-grid uses the same
              3-col template as .dots, guaranteeing each label centers
              directly over its dot. */}
          <div className="legend-bar" aria-hidden>
            <span />
            <span />
            <div className="legend-dots">
              <span>Received</span>
              <span>Making</span>
              <span>Ready</span>
            </div>
          </div>

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
        .body { display: grid; grid-template-columns: 1fr auto; gap: 1.25rem; align-items: start; }
        .rows-wrap { min-width: 0; }
        /* Legend bar mirrors the .row grid template so the dots column is
           exactly above each row's dots column. The .legend-dots sub-grid
           uses the same 3 equal columns as .dots → each label centers
           directly over its corresponding dot. */
        .legend-bar {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) 1fr 280px;
          align-items: center;
          gap: 1rem;
          padding: 0 1.5rem 0.75rem 1.5rem;
        }
        .legend-dots {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          align-items: center;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .legend-dots > span {
          text-align: center;
          white-space: nowrap;
        }
        .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.85rem; }
        .row {
          background: var(--surface);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          padding: 1rem 1.5rem;
          display: grid;
          grid-template-columns: minmax(220px, 1fr) 1fr 280px;
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
        /* 3 equal columns + place-items: center → each dot sits at the
           middle of its column, aligning with the legend label above. */
        .dots {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          place-items: center;
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
          .legend-bar { display: none; }
          .dots { grid-template-columns: repeat(3, max-content); gap: 1rem; justify-content: flex-start; }
          .body { grid-template-columns: 1fr; }
          .pager { flex-direction: row; justify-content: center; }
          .popup { min-width: 0; width: calc(100vw - 2rem); }
        }
      `}</style>
    </main>
  );
}
