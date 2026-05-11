'use client';

import { useState, useEffect } from 'react';

const MESSAGES = [
  'Brewing ideas...',
  'Steam-powering AI...',
  'Frothing the pixels...',
  'Vibe-coding your coffee...',
  'Grinding the data...',
  'Pouring some creativity...',
  'Waking up the GPUs...',
  'Adjusting the espresso-net...',
];

export default function VibeLoader() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="vibe-loader">
      <div className="coffee-cup">
        <div className="steam"></div>
      </div>
      <p className="message">{MESSAGES[messageIndex]}</p>
      
      <style jsx>{`
        .vibe-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          gap: 2rem;
          text-align: center;
        }
        .message {
          font-size: 1.25rem;
          color: var(--coffee-medium);
          font-weight: 500;
          min-height: 1.5em;
          animation: fade 2s infinite;
        }
        .coffee-cup {
          width: 80px;
          height: 60px;
          border: 4px solid var(--coffee-dark);
          border-radius: 0 0 40px 40px;
          position: relative;
        }
        .coffee-cup::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 30px;
          border: 4px solid var(--coffee-dark);
          border-left: none;
          border-radius: 0 15px 15px 0;
          right: -24px;
          top: 10px;
        }
        .steam {
          position: absolute;
          top: -30px;
          left: 20px;
          width: 10px;
          height: 20px;
          background: #eee;
          border-radius: 50%;
          animation: steam 2s infinite;
        }
        @keyframes fade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes steam {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-20px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
