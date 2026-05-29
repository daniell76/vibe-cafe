'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import VibeLoader from '@/components/VibeLoader';
import { ArtOption, OrderSettings } from './types';

// After this many seconds of generation, surface a "Skip & continue" CTA so
// customers don't get stuck staring at the loader (feedback item #2).
const BYPASS_DELAY_MS = 30000;

interface Props {
  options: ArtOption[];
  selectedId: string | null;
  isLoading: boolean;
  settings: OrderSettings;
  onSelect: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  onRegenerate: () => void;
  // When the customer hits "Skip & continue", submit immediately with no foam
  // image. Same UX downstream as a hasFoam=false drink.
  onBypass: () => void;
}

export default function ArtSelectStep({ options, selectedId, isLoading, settings, onSelect, onBack, onNext, onRegenerate, onBypass }: Props) {
  const [showBypass, setShowBypass] = useState(false);

  // Reveal the bypass button after BYPASS_DELAY_MS of continuous loading.
  // Reset (with the same setTimeout(0) deferral pattern used elsewhere in
  // this codebase) when loading flips off — satisfies
  // react-hooks/set-state-in-effect which disallows synchronous setState
  // inside an effect body.
  useEffect(() => {
    if (!isLoading) {
      const reset = setTimeout(() => setShowBypass(false), 0);
      return () => clearTimeout(reset);
    }
    const t = setTimeout(() => setShowBypass(true), BYPASS_DELAY_MS);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Per page-11 comment: during loading, hide the page header AND the action
  // buttons — only the VibeLoader is visible. After BYPASS_DELAY_MS we add
  // a small "Skip & continue" link underneath so the customer can move on.
  if (isLoading) {
    return (
      <div className="art-step">
        <VibeLoader caption="Generating four custom designs from your vibe…" />
        {showBypass && (
          <div className="bypass-row">
            <p className="bypass-hint">Taking longer than usual?</p>
            <button type="button" className="btn btn-ghost bypass-btn" onClick={onBypass}>
              Skip and submit order →
            </button>
            <p className="bypass-fine">Your drink will be served without printed foam art.</p>
          </div>
        )}
        <style jsx>{`
          .bypass-row {
            margin: 1.5rem auto 0;
            max-width: 360px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.4rem;
          }
          .bypass-hint { color: var(--text-muted); font-size: 0.9rem; margin: 0; }
          .bypass-btn { padding: 0.55rem 1.1rem; font-size: 0.92rem; }
          .bypass-fine { color: var(--text-faint); font-size: 0.78rem; margin: 0; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="art-step">
      <div className="header">
        <button className="back" onClick={onBack}>← Back</button>
        <div className="titles">
          <h1 className="page-title centered">Select your drink art</h1>
          <p className="page-subtitle centered">{settings.instructions.step2}</p>
        </div>
        <div className="spacer" />
      </div>

      <div className="grid">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`art-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(opt.id)}
            >
              <div className="thumb">
                <Image src={opt.imageUrl} alt={opt.label} width={300} height={300} unoptimized />
                {isSelected && (
                  <span className="check" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="actions">
        <button className="btn btn-ghost" onClick={onRegenerate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Regenerate
        </button>
        <button className="btn btn-primary" onClick={onNext} disabled={!selectedId}>
          Confirm selection →
        </button>
      </div>

      <style jsx>{`
        .header {
          display: grid;
          grid-template-columns: 100px 1fr 100px;
          align-items: center;
          margin-bottom: 2rem;
        }
        .titles { text-align: center; }
        .centered { text-align: center; }
        .back {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.95rem;
          padding: 0.5rem;
        }
        .back:hover { color: var(--text); }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.25rem;
          margin-bottom: 2rem;
        }
        .art-card {
          background: var(--surface);
          border: 2px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s, transform 0.05s, box-shadow 0.15s;
        }
        .art-card:hover { border-color: var(--brand); box-shadow: var(--shadow-md); }
        .art-card.selected { border-color: var(--g-green); box-shadow: 0 0 0 3px rgba(52,168,83,0.18); }
        .thumb {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: #111;
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .thumb :global(img) { width: 100%; height: 100%; object-fit: cover; }
        .check {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--g-green);
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-md);
        }
        .actions { display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; }
        .loading {
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: var(--text-muted);
        }
        .spinner {
          width: 36px; height: 36px; border-radius: 50%;
          border: 3px solid var(--border);
          border-top-color: var(--brand);
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
