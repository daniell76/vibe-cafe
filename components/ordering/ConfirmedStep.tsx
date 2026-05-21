'use client';

interface Props {
  orderNumber: number;
  onNewOrder: () => void;
}

export default function ConfirmedStep({ orderNumber, onNewOrder }: Props) {
  const display = String(orderNumber).padStart(4, '0');
  return (
    <div className="confirm">
      <div className="gradient-card panel">
        <div className="check">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="title">Order Received</h1>
        <p className="msg">Your request has entered the system. The barista is preparing your cloud-crafted beverage.</p>

        <span className="kicker">Order ID</span>
        <span className="order-id">#{display}</span>

        <button className="btn btn-primary new-btn" onClick={onNewOrder}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          New Order
        </button>
      </div>

      <style jsx>{`
        .confirm {
          display: flex;
          justify-content: center;
          padding-top: 1rem;
        }
        .panel {
          max-width: 540px;
          width: 100%;
          padding: 3rem 2.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }
        .check {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #e6f4ea;
          color: var(--g-green);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.5rem;
        }
        .title { font-size: 2rem; }
        .msg { color: var(--text-muted); max-width: 320px; margin: 0 0 1rem 0; }
        .kicker {
          text-transform: uppercase;
          font-size: 0.7rem;
          color: var(--text-faint);
          letter-spacing: 0.12em;
        }
        .order-id {
          font-size: 5rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          margin-bottom: 1.5rem;
        }
        .new-btn { padding: 0.85rem 1.75rem; }
      `}</style>
    </div>
  );
}
