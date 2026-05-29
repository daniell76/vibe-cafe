'use client';

import { useRef, useState } from 'react';
import { OrderDraft, OrderSettings } from './types';
import CategorizedSelect from './CategorizedSelect';

interface Props {
  draft: OrderDraft;
  settings: OrderSettings;
  onChange: (next: OrderDraft) => void;
  onNext: () => void;
}

type MicState = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'error';

export default function CustomizeStep({ draft, settings, onChange, onNext }: Props) {
  const canContinue = draft.name.trim().length > 0 && draft.happyPlace.trim().length > 0;

  const [micState, setMicState] = useState<MicState>('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Voice input via GCP Speech-to-Text (feedback item #1, 2026-05-29). The
  // browser captures audio with MediaRecorder (default: WebM/Opus) and POSTs
  // the raw bytes to /api/transcribe, which forwards to the Speech API.
  const startRecording = async () => {
    setMicError(null);
    setMicState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        // Release the mic immediately so the browser indicator goes away.
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) { setMicState('idle'); return; }
        setMicState('transcribing');
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/webm' },
            body: blob,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          const text = (data.transcript || '').trim();
          if (text) {
            // Append to existing text rather than overwrite, separated with
            // a space if the textarea already has content.
            const sep = draft.happyPlace && !/\s$/.test(draft.happyPlace) ? ' ' : '';
            onChange({ ...draft, happyPlace: draft.happyPlace + sep + text });
          }
          setMicState('idle');
        } catch (err) {
          console.error('Transcribe failed', err);
          setMicError(err instanceof Error ? err.message : 'Transcribe failed');
          setMicState('error');
        }
      };
      rec.start();
      recorderRef.current = rec;
      setMicState('recording');
    } catch (err) {
      console.error('Microphone access denied', err);
      setMicError(err instanceof Error ? err.message : 'Microphone access denied');
      setMicState('error');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const onMicClick = () => {
    if (micState === 'recording') stopRecording();
    else if (micState === 'idle' || micState === 'error') startRecording();
  };

  // Per page-10 comment: the admin explicitly toggles whether Additions / Extra
  // Shots are shown to customers. Items themselves are pre-populated so the
  // operator just flips the switch when needed.
  const showAdditions = settings.additionsEnabled === true && settings.flavors.length > 0;
  const showExtraShots = settings.extraShotsEnabled === true;

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
              <CategorizedSelect
                id="drink"
                value={draft.coffeeOrder}
                categories={settings.drinkCategories}
                placeholder="Choose a drink"
                onChange={(v) => onChange({ ...draft, coffeeOrder: v })}
              />
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

            {showAdditions && (
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
            )}

            {showExtraShots && (
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
            )}
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
              {settings.aiInspirationHint}
            </div>

            <div className="textarea-wrap">
              <textarea
                id="happy"
                aria-label="Happy place"
                rows={5}
                value={draft.happyPlace}
                placeholder={settings.aiInspirationPlaceholder}
                onChange={(e) => onChange({ ...draft, happyPlace: e.target.value })}
              />
              <button
                type="button"
                className={`mic-btn mic-${micState}`}
                onClick={onMicClick}
                aria-label={
                  micState === 'recording' ? 'Stop recording' :
                  micState === 'transcribing' ? 'Transcribing…' :
                  'Speak to dictate'
                }
                disabled={micState === 'transcribing' || micState === 'requesting'}
                title={
                  micState === 'recording' ? 'Click to stop' :
                  micState === 'transcribing' ? 'Transcribing…' :
                  micState === 'error' ? (micError || 'Mic error — try again') :
                  'Tap to dictate with your voice'
                }
              >
                {micState === 'recording' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                ) : micState === 'transcribing' || micState === 'requesting' ? (
                  <span className="mic-spinner" aria-hidden />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
            {micState === 'error' && micError && (
              <span className="mic-error" role="alert">{micError}</span>
            )}

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
        .textarea-wrap { position: relative; }
        .inspiration textarea {
          min-height: 180px;
          resize: vertical;
          padding-right: 3.25rem; /* keep room for the mic button */
        }
        .mic-btn {
          position: absolute;
          right: 0.6rem;
          bottom: 0.65rem;
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 1px solid var(--border-strong);
          background: var(--surface);
          color: var(--text-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .mic-btn:hover:not(:disabled) { color: var(--brand); border-color: var(--brand); background: var(--brand-soft); }
        .mic-btn:disabled { cursor: progress; }
        .mic-btn.mic-recording {
          color: #fff;
          background: var(--g-red);
          border-color: var(--g-red);
          animation: mic-pulse 1.2s ease-in-out infinite;
        }
        .mic-btn.mic-error { color: var(--g-red); border-color: var(--g-red); }
        .mic-spinner {
          width: 14px; height: 14px;
          border-radius: 50%;
          border: 2px solid var(--border);
          border-top-color: var(--brand);
          animation: mic-spin 0.8s linear infinite;
        }
        .mic-error {
          color: var(--g-red);
          font-size: 0.78rem;
          margin-top: -0.25rem;
        }
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234,67,53,0.55); }
          50%      { box-shadow: 0 0 0 6px rgba(234,67,53,0.05); }
        }
        @keyframes mic-spin { to { transform: rotate(360deg); } }
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
