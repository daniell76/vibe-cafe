'use client';

import { OrderDraft, OrderSettings } from './types';

interface Props {
  draft: OrderDraft;
  settings: OrderSettings;
  onChange: (next: OrderDraft) => void;
  onNext: () => void;
}

export default function CustomizeStep({ draft, settings, onChange, onNext }: Props) {
  const canContinue = draft.name.trim().length > 0 && draft.happyPlace.trim().length > 0;

  return (
    <div className="customize">
      <div className="header">
        <h1 className="page-title">Craft your drink</h1>
        <p className="page-subtitle">{settings.instructions.step1}</p>
      </div>

      <div className="grid">
        <div className="col">
          <div className="gradient-card">
            <div className="field">
              <label htmlFor="name">Who is this for?</label>
              <input
                id="name"
                type="text"
                value={draft.name}
                placeholder="Your Name"
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="drink">Select a drink</label>
              <select
                id="drink"
                value={draft.coffeeOrder}
                onChange={(e) => onChange({ ...draft, coffeeOrder: e.target.value })}
              >
                {settings.drinks.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="gradient-card">
            <div className="field">
              <label>Milk Choice</label>
              <div className="chips" role="radiogroup" aria-label="Milk choice">
                {settings.milks.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={draft.milk === m}
                    className={`btn-chip ${draft.milk === m ? 'active' : ''}`}
                    onClick={() => onChange({ ...draft, milk: m })}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Additions</label>
              <div className="chips" role="radiogroup" aria-label="Additions">
                {settings.flavors.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={draft.addition === f}
                    className={`btn-chip ${draft.addition === f ? 'active' : ''}`}
                    onClick={() => onChange({ ...draft, addition: f })}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Extra Shots</label>
              <div className="stepper" role="group" aria-label="Extra shots">
                <button
                  type="button"
                  className="step-btn"
                  aria-label="Decrease extra shots"
                  onClick={() => onChange({ ...draft, extraShots: Math.max(0, (draft.extraShots ?? 0) - 1) })}
                  disabled={(draft.extraShots ?? 0) <= 0}
                >−</button>
                <span className="step-value" aria-live="polite">{draft.extraShots ?? 0}</span>
                <button
                  type="button"
                  className="step-btn"
                  aria-label="Increase extra shots"
                  onClick={() => onChange({ ...draft, extraShots: Math.min(5, (draft.extraShots ?? 0) + 1) })}
                  disabled={(draft.extraShots ?? 0) >= 5}
                >+</button>
                <span className="step-hint">{(draft.extraShots ?? 0) === 0 ? 'No extra shots' : `${draft.extraShots} extra shot${draft.extraShots === 1 ? '' : 's'}`}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="gradient-card inspiration">
            <div className="ai-header">
              <span className="sparkle" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2z" />
                </svg>
              </span>
              <span className="ai-title">AI Inspiration</span>
            </div>

            <div className="ai-hint" role="note">
              What&apos;s your favourite hobby, music or destination? We&apos;ll use this to style your cup art.
            </div>

            <textarea
              id="happy"
              aria-label="Happy place"
              rows={5}
              value={draft.happyPlace}
              placeholder="I really like earthware pottery and jazz music…"
              onChange={(e) => onChange({ ...draft, happyPlace: e.target.value })}
            />

            <button
              type="button"
              className="btn btn-primary next-btn"
              onClick={onNext}
              disabled={!canContinue}
            >
              Next step <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .header { margin-bottom: 2rem; }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        .col { display: flex; flex-direction: column; gap: 1.5rem; }
        .field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
        .field:last-child { margin-bottom: 0; }
        .hint { color: var(--text-faint); font-weight: 400; font-size: 0.8rem; }
        .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }

        .inspiration {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .ai-header {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--brand);
          font-weight: 500;
          font-size: 0.95rem;
        }
        .sparkle {
          display: inline-flex;
          width: 24px;
          height: 24px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--brand-soft);
        }
        .ai-title { letter-spacing: -0.01em; }
        .ai-hint {
          background: var(--surface-muted);
          border-radius: 999px;
          padding: 0.6rem 1rem;
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .inspiration textarea {
          min-height: 180px;
          resize: vertical;
        }
        .next-btn {
          margin-top: 0.25rem;
          padding: 0.9rem;
          font-size: 1rem;
        }
        .stepper {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.25rem 0.4rem;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          border-radius: 999px;
          width: fit-content;
        }
        .step-btn {
          width: 30px; height: 30px;
          border-radius: 50%;
          border: none;
          background: var(--surface-muted);
          color: var(--text);
          font-size: 1.2rem;
          line-height: 1;
          cursor: pointer;
          transition: background 0.15s;
        }
        .step-btn:hover:not(:disabled) { background: var(--border); }
        .step-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .step-value { min-width: 18px; text-align: center; font-weight: 600; font-size: 1rem; }
        .step-hint { padding-right: 0.6rem; font-size: 0.8rem; color: var(--text-muted); }
        @media (max-width: 760px) {
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
