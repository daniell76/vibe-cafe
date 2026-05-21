'use client';

import { useCallback, useEffect, useState } from 'react';

interface Order {
  id: string;
  name: string;
  coffeeOrder: string;
  milk?: string;
  flavor?: string;
  additions?: string[];
  extraShots?: number;
  happyPlace: string;
  imageUrl: string;
  status: string;
  orderNumber?: number;
  createdAt: string;
}

type Status = 'pending' | 'making' | 'completed' | 'pickedUp';

function rowToneClass(status: string) {
  if (status === 'making') return 'tone-making';
  if (status === 'completed') return 'tone-completed';
  if (status === 'pickedUp') return 'tone-pickedup';
  return 'tone-pending';
}

export default function BaristaPage() {
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

  const setStatus = async (id: string, next: Status) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
    try {
      await fetch(`/api/order/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const pending = orders.filter((o) => o.status === 'pending').length;
  const making = orders.filter((o) => o.status === 'making').length;
  const ready = orders.filter((o) => o.status === 'completed').length;

  // Show everything; active states first, then picked-up at the bottom (muted).
  const STATUS_ORDER: Record<string, number> = { pending: 0, making: 1, completed: 2, pickedUp: 3 };
  const visible = [...orders].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1 className="page-title">Barista Console</h1>
          <p className="page-subtitle">Order queue. Prioritise based on status.</p>
        </div>
        <div className="counters">
          <span className="pill"><span className="status-dot pending" /> {pending} Pending</span>
          <span className="pill"><span className="status-dot making" /> {making} Making</span>
          <span className="pill"><span className="status-dot ready" /> {ready} Ready</span>
        </div>
      </div>

      <div className="table">
        <div className="table-head">
          <span>Order #</span>
          <span>Customer name</span>
          <span>Order details</span>
          <span className="status-col">Status</span>
        </div>

        {isLoading && orders.length === 0 ? (
          <div className="empty">Loading orders…</div>
        ) : visible.length === 0 ? (
          <div className="empty">No orders yet.</div>
        ) : (
          <ul className="rows">
            {visible.map((order) => {
              const tone = rowToneClass(order.status);
              const num = order.orderNumber ? String(order.orderNumber).padStart(3, '0') : '---';
              const addOns = [
                order.milk && order.milk !== 'None' ? order.milk : null,
                ...(order.additions || []).filter((a) => a && a !== 'None'),
                (order.extraShots ?? 0) > 0
                  ? `+${order.extraShots} shot${order.extraShots === 1 ? '' : 's'}`
                  : null,
              ].filter(Boolean) as string[];
              return (
                <li key={order.id} className={`row ${tone}`}>
                  <span className="order-num">#{num}</span>
                  <span className="customer">{order.name}</span>
                  <div className="details">
                    <div className="drink">{order.coffeeOrder}</div>
                    {addOns.length > 0 && (
                      <div className="chips">
                        {addOns.map((a) => (
                          <span key={a} className="chip">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="actions">
                    <a
                      className="mini-btn icon-only"
                      href={`/api/order/${order.id}/foam`}
                      title="Download foam art"
                      aria-label={`Download foam art for #${num}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </a>
                    {order.status === 'pickedUp' ? (
                      <span className="completed-tag pickedup">Picked up</span>
                    ) : order.status === 'completed' ? (
                      <>
                        <span className="completed-tag">Ready</span>
                        <button
                          className="mini-btn pickup"
                          onClick={() => setStatus(order.id, 'pickedUp')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                          Pick up
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={`mini-btn ${order.status === 'making' ? 'active-making' : ''}`}
                          onClick={() => setStatus(order.id, 'making')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5"/><circle cx="9" cy="7" r="4"/><path d="m19 8 2 2-2 2"/></svg>
                          Making
                        </button>
                        <button
                          className="mini-btn"
                          onClick={() => setStatus(order.id, 'completed')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Complete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <style jsx>{`
        .header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          gap: 1rem;
        }
        .counters { display: flex; gap: 0.5rem; }
        .table {
          background: var(--surface);
          border-radius: var(--radius-md);
          padding: 0.5rem 0;
        }
        .table-head, .row {
          display: grid;
          grid-template-columns: 110px 1fr 1.4fr 220px;
          align-items: center;
          gap: 1rem;
          padding: 0.85rem 1.5rem;
        }
        .table-head {
          font-size: 0.7rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-faint);
          border-bottom: 1px solid var(--border);
        }
        .status-col { text-align: right; }
        .rows { list-style: none; margin: 0; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .row {
          background: var(--surface);
          border: 2px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1rem 1.5rem;
        }
        .row.tone-pending { border-color: rgba(66,133,244,0.45); background: rgba(66,133,244,0.04); }
        .row.tone-making { border-color: rgba(251,188,5,0.55); background: rgba(251,188,5,0.06); }
        .row.tone-completed { border-color: rgba(52,168,83,0.45); background: rgba(52,168,83,0.06); }
        .row.tone-pickedup { border-color: var(--border); background: var(--surface-muted); opacity: 0.65; }
        .order-num {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text);
        }
        .row.tone-pending .order-num { color: var(--g-blue); }
        .row.tone-making .order-num { color: #c08800; }
        .row.tone-completed .order-num { color: var(--g-green); }
        .customer { font-size: 1rem; }
        .details { display: flex; flex-direction: column; gap: 0.35rem; }
        .drink { font-weight: 500; }
        .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .chip {
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          background: var(--surface-muted);
          color: var(--text-muted);
          font-size: 0.78rem;
        }
        .actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
        .mini-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.85rem;
          font-size: 0.85rem;
          border-radius: 999px;
          border: 1px solid var(--border-strong);
          background: var(--surface);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .mini-btn:hover { color: var(--text); border-color: var(--text-muted); }
        .mini-btn.icon-only { padding: 0.4rem 0.55rem; }
        a.mini-btn { text-decoration: none; }
        .mini-btn.active-making {
          color: #b07900;
          border-color: var(--g-yellow);
          background: rgba(251,188,5,0.12);
        }
        .completed-tag {
          padding: 0.4rem 0.95rem;
          border-radius: 999px;
          background: rgba(52,168,83,0.15);
          color: var(--g-green);
          font-size: 0.85rem;
          font-weight: 500;
        }
        .completed-tag.pickedup {
          background: var(--surface-muted);
          color: var(--text-muted);
        }
        .mini-btn.pickup {
          color: #fff;
          background: var(--brand);
          border-color: var(--brand);
        }
        .mini-btn.pickup:hover { background: var(--brand-hover); border-color: var(--brand-hover); }
        .empty { padding: 3rem; text-align: center; color: var(--text-muted); }
        @media (max-width: 760px) {
          .table-head, .row { grid-template-columns: 80px 1fr; }
          .table-head span:nth-child(n+3), .row > :nth-child(n+3) { grid-column: 1 / -1; }
        }
      `}</style>
    </main>
  );
}
