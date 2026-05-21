'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface Order {
  id: string;
  name: string;
  coffeeOrder: string;
  imageUrl: string;
  status: string;
  orderNumber?: number;
  createdAt: string;
}

const STATUS_INDEX: Record<string, number> = {
  pending: 0,
  making: 1,
  completed: 2,
  pickedUp: 2, // ready dot stays lit
};

export default function TrackingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchOrders, 0);
    const id = setInterval(fetchOrders, 5000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [fetchOrders]);

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1 className="page-title brand">Order progress</h1>
          <p className="page-subtitle">Vibe Café Status Queue</p>
        </div>
        <div className="legend">
          <span className="legend-item">Received</span>
          <span className="legend-item">Making</span>
          <span className="legend-item">Ready</span>
        </div>
      </div>

      {isLoading && orders.length === 0 ? (
        <div className="empty">Loading queue…</div>
      ) : orders.length === 0 ? (
        <div className="empty">No active orders.</div>
      ) : (
        <ul className="rows">
          {orders.map((o) => {
            const num = o.orderNumber ? String(o.orderNumber).padStart(2, '0') : '--';
            const idx = STATUS_INDEX[o.status] ?? 0;
            const isReady = o.status === 'completed';
            const isPickedUp = o.status === 'pickedUp';
            return (
              <li key={o.id} className={`row ${isPickedUp ? 'pickedup' : ''}`}>
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

                <span className={`status-msg ${isReady ? 'ready' : ''} ${isPickedUp ? 'pickedup' : ''}`}>
                  {isPickedUp ? 'Picked up ✓' : isReady ? 'Your drink is ready!' : 'Processing...'}
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

      <style jsx>{`
        .header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 2rem;
          gap: 1rem;
        }
        .brand { color: var(--brand); }
        .legend {
          display: flex;
          gap: 3rem;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
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
        .row.pickedup { opacity: 0.55; }
        .status-msg.pickedup {
          background: var(--surface-muted);
          color: var(--text-muted);
          font-style: normal;
        }
        .dots {
          display: flex;
          gap: 2rem;
          justify-content: flex-end;
          align-items: center;
        }
        .empty { padding: 4rem; text-align: center; color: var(--text-muted); }
        @media (max-width: 760px) {
          .row { grid-template-columns: 1fr; }
          .legend { display: none; }
          .dots { justify-content: flex-start; }
        }
      `}</style>
    </main>
  );
}
