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

// Per brief pp.14-19: no pickedUp state — barista handing the drink to the
// customer is implicit when the order is marked complete (it shows on the
// tracking screen as ready for 3 min, then auto-disappears).
type Status = 'pending' | 'making' | 'completed';

function rowToneClass(status: string) {
  if (status === 'making') return 'tone-making';
  if (status === 'completed') return 'tone-completed';
  return 'tone-pending';
}

export default function BaristaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Per brief p.19: after the Download button is first clicked it greys out
  // (visually muted) but stays clickable. Tracked in component state so the
  // signal is session-scoped — refreshing resets, which is fine because a
  // re-download is harmless.
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

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

  // Brief p.19: Making and Complete are TOGGLES. Clicking the same status
  // again "undoes" it (rectifies human error). Clicking the other one moves
  // forward as expected.
  const toggleMaking = (order: Order) => {
    setStatus(order.id, order.status === 'making' ? 'pending' : 'making');
  };
  const toggleComplete = (order: Order) => {
    setStatus(order.id, order.status === 'completed' ? 'making' : 'completed');
  };
  const markDownloaded = (id: string) => {
    setDownloaded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Drop the legacy 'pickedUp' status entirely (removed in brief pp.14-19).
  // Existing pre-rework Firestore docs may still carry it; the barista has no
  // action to take on them, so hide them from the queue.
  const active = orders.filter((o) => o.status !== 'pickedUp');

  const pending = active.filter((o) => o.status === 'pending').length;
  const making = active.filter((o) => o.status === 'making').length;
  const ready = active.filter((o) => o.status === 'completed').length;

  // Pending (new orders, blue) first, then in-progress (yellow), then ready (green).
  const STATUS_ORDER: Record<string, number> = { pending: 0, making: 1, completed: 2 };
  const sorted = [...active].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );

  const q = search.trim().toLowerCase();
  const visible = q
    ? sorted.filter((o) => {
        const numStr = o.orderNumber ? String(o.orderNumber) : '';
        const padded = numStr.padStart(4, '0');
        const name = (o.name || '').toLowerCase();
        return numStr.includes(q) || padded.includes(q) || name.includes(q);
      })
    : sorted;

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1 className="page-title">Barista Console</h1>
          <p className="page-subtitle">Order queue. Prioritise based on status.</p>
        </div>
        <div className="counters">
          <span className="pill"><span className="status-dot pending" /> {pending} Pending</span>
          <span className="pill"><span className="status-dot making" /> {making} Brewing</span>
          <span className="pill"><span className="status-dot ready" /> {ready} Ready</span>
        </div>
      </div>

      <div className="search-bar">
        <span className="search-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="search"
          className="search-input"
          placeholder="Search by order # or customer name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
          aria-label="Search orders"
        />
        {q && (
          <span className="search-stats">
            {visible.length} of {sorted.length}
          </span>
        )}
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
          <div className="empty">
            {q ? `No orders match “${search}”.` : 'No orders yet.'}
          </div>
        ) : (
          <ul className="rows">
            {visible.map((order) => {
              const tone = rowToneClass(order.status);
              const num = order.orderNumber ? String(order.orderNumber).padStart(4, '0') : '----';
              const addOns = [
                order.milk && order.milk !== 'None' ? order.milk : null,
                ...(order.additions || []).filter((a) => a && a !== 'None'),
                (order.extraShots ?? 0) > 0
                  ? `+${order.extraShots} shot${order.extraShots === 1 ? '' : 's'}`
                  : null,
              ].filter(Boolean) as string[];

              const isMaking = order.status === 'making';
              const isCompleted = order.status === 'completed';
              const isDownloaded = downloaded.has(order.id);

              // State-machine safeguards (user request 2026-05-26):
              //   pending  → Complete disabled (must mark Making first)
              //   completed → Making disabled (must undo Complete first)
              // Both buttons stay enabled in the 'making' state so the barista
              // can either step back (undo Making → pending) or step forward
              // (mark Complete) without an extra click.
              const makingDisabled = isCompleted;
              const completeDisabled = !isMaking && !isCompleted;

              // Download tri-state per brief p.19:
              //   not-completed → disabled (greyed, not clickable)
              //   completed + never clicked → active blue (primary CTA)
              //   completed + already clicked → muted but still clickable
              const dlClasses = [
                'mini-btn',
                'download',
                isCompleted && !isDownloaded ? 'primary' : '',
                isCompleted && isDownloaded ? 'used' : '',
                !isCompleted ? 'disabled' : '',
              ].filter(Boolean).join(' ');

              const orderTime = (() => {
                const raw = order.createdAt;
                if (!raw) return '';
                const d = new Date(raw);
                if (Number.isNaN(d.getTime())) return '';
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              })();

              return (
                <li key={order.id} className={`row ${tone}`}>
                  <div className="order-num-cell">
                    <span className="order-num">#{num}</span>
                    {orderTime && <span className="order-time">{orderTime}</span>}
                  </div>
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
                    {/* Order locked in by brief p.19: 1. Making, 2. Complete, 3. Download */}
                    <button
                      type="button"
                      className={`mini-btn ${isMaking ? 'active-making' : ''} ${makingDisabled ? 'disabled' : ''}`}
                      onClick={() => toggleMaking(order)}
                      disabled={makingDisabled}
                      aria-pressed={isMaking}
                      title={
                        makingDisabled
                          ? 'Undo Complete first before changing Brewing'
                          : isMaking
                            ? 'Undo Brewing (back to pending)'
                            : 'Mark as Brewing'
                      }
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5"/><circle cx="9" cy="7" r="4"/><path d="m19 8 2 2-2 2"/></svg>
                      Brewing
                    </button>
                    <button
                      type="button"
                      className={`mini-btn ${isCompleted ? 'active-complete' : ''} ${completeDisabled ? 'disabled' : ''}`}
                      onClick={() => toggleComplete(order)}
                      disabled={completeDisabled}
                      aria-pressed={isCompleted}
                      title={
                        completeDisabled
                          ? 'Mark Brewing first before Complete'
                          : isCompleted
                            ? 'Undo complete (back to Brewing)'
                            : 'Mark as complete'
                      }
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Complete
                    </button>
                    {isCompleted ? (
                      <a
                        className={dlClasses}
                        href={`/api/order/${order.id}/foam`}
                        onClick={() => markDownloaded(order.id)}
                        title={isDownloaded ? 'Download again' : 'Download foam art'}
                        aria-label={`Download foam art for #${num}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span className="dl-label">Download</span>
                      </a>
                    ) : (
                      // Render as a disabled <button> instead of an <a>, so the
                      // browser blocks both the click handler and the underlying
                      // foam-download GET request — fully inactive until Complete.
                      <button
                        type="button"
                        className={dlClasses}
                        disabled
                        aria-disabled
                        title="Mark order Complete to enable download"
                        aria-label={`Download foam art for #${num} (disabled — order not complete)`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span className="dl-label">Download</span>
                      </button>
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
        .search-bar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.4rem 0.85rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 999px;
          margin-bottom: 1rem;
          box-shadow: var(--shadow-sm);
        }
        .search-bar:focus-within {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(26,115,232,0.15);
        }
        .search-icon { color: var(--text-faint); display: inline-flex; }
        .search-input {
          flex: 1;
          border: none;
          padding: 0.35rem 0;
          background: transparent;
          font-size: 0.95rem;
          color: var(--text);
          width: auto;
        }
        .search-input:focus { outline: none; box-shadow: none; }
        .search-stats {
          font-size: 0.8rem;
          color: var(--text-muted);
          padding: 0.15rem 0.5rem;
          background: var(--surface-muted);
          border-radius: 999px;
          white-space: nowrap;
        }
        .table {
          background: var(--surface);
          border-radius: var(--radius-md);
          padding: 0.5rem 0;
        }
        .table-head, .row {
          display: grid;
          grid-template-columns: 110px 1fr 1.4fr 340px;
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
        .order-num-cell { display: flex; flex-direction: column; gap: 0.15rem; line-height: 1.1; }
        .order-num {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text);
        }
        .order-time {
          font-size: 0.78rem;
          color: var(--text-faint);
          font-variant-numeric: tabular-nums;
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
        .actions { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: nowrap; }
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
          flex-shrink: 0;
          white-space: nowrap;
        }
        .mini-btn:hover:not(:disabled) { color: var(--text); border-color: var(--text-muted); }
        a.mini-btn { text-decoration: none; }
        .mini-btn.download .dl-label { font-weight: 500; }
        /* Making active: yellow tint when status === 'making'. Click again to undo. */
        .mini-btn.active-making {
          color: #b07900;
          border-color: var(--g-yellow);
          background: rgba(251,188,5,0.18);
        }
        /* Complete active: green tint when status === 'completed'. Click again to undo. */
        .mini-btn.active-complete {
          color: var(--g-green);
          border-color: var(--g-green);
          background: rgba(52,168,83,0.14);
        }
        /* Download primary state: active blue, before first click on a completed order. */
        .mini-btn.download.primary {
          background: var(--brand);
          color: #fff;
          border-color: var(--brand);
        }
        .mini-btn.download.primary:hover { background: var(--brand-hover); border-color: var(--brand-hover); color: #fff; }
        /* Download "used" state: muted look after first click but still clickable. */
        .mini-btn.download.used {
          background: var(--surface-muted);
          color: var(--text-muted);
          border-color: var(--border);
        }
        .mini-btn.download.used:hover { color: var(--text); }
        /* Generic disabled state for any mini-btn (Making, Complete, Download).
           Visual cue + cursor; pointer-events also locked by :disabled below. */
        .mini-btn.disabled {
          color: var(--text-faint);
          border-color: var(--border);
          background: var(--surface);
          cursor: not-allowed;
          opacity: 0.55;
        }
        .mini-btn:disabled { pointer-events: none; }
        .empty { padding: 3rem; text-align: center; color: var(--text-muted); }
        @media (max-width: 760px) {
          .table-head, .row { grid-template-columns: 80px 1fr; }
          .table-head span:nth-child(n+3), .row > :nth-child(n+3) { grid-column: 1 / -1; }
        }
      `}</style>
    </main>
  );
}
