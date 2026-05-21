'use client';

import { useEffect, useState } from 'react';

const DEFAULT_MESSAGES = [
  'Brewing ideas…',
  'Steam-powering AI…',
  'Frothing the pixels…',
  'Vibe-coding your coffee…',
  'Grinding the data…',
  'Pouring some creativity…',
  'Waking up the GPUs…',
  'Adjusting the espresso-net…',
];

interface Props {
  caption?: string;
  tone?: 'light' | 'dark';
  messages?: string[];
}

export default function VibeLoader({ caption, tone = 'light', messages }: Props) {
  const list = messages && messages.length > 0 ? messages : DEFAULT_MESSAGES;
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((p) => p + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const current = list[i % list.length];

  return (
    <div className={`vibe-loader tone-${tone}`}>
      <div className="cup">
        <span className="steam s1" />
        <span className="steam s2" />
        <span className="steam s3" />
      </div>
      <p className="message">{current}</p>
      {caption && <p className="caption">{caption}</p>}

      <style jsx>{`
        .vibe-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
          gap: 1.25rem;
          text-align: center;
        }
        .cup {
          position: relative;
          width: 88px;
          height: 70px;
          border: 4px solid currentColor;
          border-radius: 0 0 44px 44px;
        }
        .cup::after {
          content: '';
          position: absolute;
          width: 22px;
          height: 34px;
          border: 4px solid currentColor;
          border-left: none;
          border-radius: 0 18px 18px 0;
          right: -28px;
          top: 10px;
        }
        .steam {
          position: absolute;
          top: -16px;
          width: 8px;
          height: 18px;
          background: currentColor;
          opacity: 0;
          border-radius: 50%;
          animation: steam 2.4s ease-in infinite;
        }
        .s1 { left: 14px; animation-delay: 0s; }
        .s2 { left: 38px; animation-delay: 0.6s; }
        .s3 { left: 62px; animation-delay: 1.2s; }
        .message {
          font-size: 1.15rem;
          font-weight: 500;
          min-height: 1.5em;
          margin: 0;
          animation: fade 2s ease-in-out infinite;
        }
        .caption {
          font-size: 0.9rem;
          opacity: 0.7;
          margin: 0;
        }
        .tone-light { color: var(--text); }
        .tone-light .cup { color: var(--text); }
        .tone-light .steam { color: var(--text-faint); }
        .tone-dark { color: #f0f0f0; }
        .tone-dark .cup { color: #e8e8e8; }
        .tone-dark .steam { color: #aaa; }
        @keyframes fade {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes steam {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          40% { opacity: 0.8; }
          100% { transform: translateY(-28px) scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
