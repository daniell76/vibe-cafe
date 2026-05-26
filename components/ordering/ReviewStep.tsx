'use client';

import Image from 'next/image';
import { ArtOption, OrderDraft } from './types';

interface Props {
  draft: OrderDraft;
  selectedArt: ArtOption;
  isSubmitting: boolean;
  // When both Additions and Extra Shots are disabled in admin, the Add-ons row
  // is omitted entirely (not shown as "None"). Derived from admin settings.
  showAddOns: boolean;
  onEdit: () => void;
  onSubmit: () => void;
}

export default function ReviewStep({ draft, selectedArt, isSubmitting, showAddOns, onEdit, onSubmit }: Props) {
  const addOns = (
    draft.addition && draft.addition !== 'None' ? [draft.addition] : []
  );
  if ((draft.extraShots ?? 0) > 0) {
    addOns.push(`+${draft.extraShots} shot${draft.extraShots === 1 ? '' : 's'}`);
  }
  const milkDisplay = draft.milk || 'None';

  return (
    <div className="review">
      <div className="header">
        <div>
          <h1 className="page-title">Order Summary</h1>
          <p className="page-subtitle">Please review your selections before finalising.</p>
        </div>
        <button type="button" className="edit-link" onClick={onEdit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          Edit Order
        </button>
      </div>

      <div className="grid">
        <div className="left">
          <div className="gradient-card details">
            <span className="kicker">Barista and Agent crafted drink</span>
            <h2 className="name">{draft.name || 'Guest'}</h2>
            <p className="drink">Artisan {draft.coffeeOrder}</p>

            <div className="rows">
              <div className="row">
                <span className="row-key">
                  <span className="dot" aria-hidden>
                    {/* Milk droplet icon — matches docs/design/01-3-BA-Ordering-review_your_order.png */}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                  </span>
                  Milk
                </span>
                <span className="row-val">{milkDisplay}</span>
              </div>
              {showAddOns && (
                <div className="row">
                  <span className="row-key">
                    <span className="dot plus" aria-hidden>+</span>
                    Add-ons
                  </span>
                  <div className="addons">
                    {addOns.length === 0 ? <span className="row-val muted">None</span> : addOns.map((a) => (
                      <span key={a} className="addon-pill">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="gradient-card cta">
            <p className="enjoy">Enjoy your drink!</p>
            <button type="button" className="btn btn-primary submit" onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : '▶ Submit Order'}
            </button>
            <p className="terms">By submitting, you agree to the Vibe Café terms of service.</p>
          </div>
        </div>

        <div className="right">
          <div className="gradient-card art-frame">
            <span className="kicker">Your vibe art</span>
            <div className="art-circle">
              <Image src={selectedArt.imageUrl} alt={selectedArt.label} width={420} height={420} unoptimized />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .edit-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.9rem;
          cursor: pointer;
        }
        .edit-link:hover { color: var(--text); }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        .left { display: flex; flex-direction: column; gap: 1.5rem; }
        .kicker {
          display: block;
          text-transform: uppercase;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          color: var(--brand);
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .name { font-size: 1.75rem; margin-bottom: 0.25rem; }
        .drink { color: var(--text-muted); margin: 0 0 1.5rem 0; }
        .rows { display: flex; flex-direction: column; gap: 1rem; }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        .row-key {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .row-val { font-weight: 500; }
        .row-val.muted { color: var(--text-faint); font-weight: 400; }
        .dot {
          display: inline-flex;
          width: 22px; height: 22px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--surface-muted);
          color: var(--text-muted);
          font-size: 0.7rem;
        }
        .dot.plus::before { content: '+'; }
        .addons { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: flex-end; max-width: 60%; }
        .addon-pill {
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          background: var(--surface-muted);
          font-size: 0.85rem;
        }
        .cta { display: flex; flex-direction: column; gap: 0.75rem; align-items: center; }
        .enjoy { color: var(--text-muted); margin: 0; align-self: flex-start; }
        .submit { width: 100%; }
        .terms { font-size: 0.75rem; color: var(--text-faint); text-align: center; margin: 0; }
        .right { position: sticky; top: 100px; }
        .art-frame { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 1.5rem; }
        /* Per page-14 comment: the image must visually fit the circle, not look
           like a square inside a circle. Background is white to match the
           sepia-on-white foam art; image fills the circle via object-fit cover
           and the .art-circle's own border-radius clips it. */
        .art-circle {
          width: 100%;
          aspect-ratio: 1 / 1;
          background: #ffffff;
          border-radius: 50%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06), 0 8px 24px rgba(15,23,42,0.08);
        }
        .art-circle :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        @media (max-width: 760px) {
          .grid { grid-template-columns: 1fr; }
          .right { position: static; }
        }
      `}</style>
    </div>
  );
}
