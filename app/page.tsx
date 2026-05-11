'use client';

import { useState } from 'react';
import OrderForm from '@/components/OrderForm';
import VibeLoader from '@/components/VibeLoader';

type AppState = 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

export default function Home() {
  const [state, setState] = useState<AppState>('IDLE');
  const [result, setResult] = useState<{ imageUrl: string; orderId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOrderStarted = () => {
    setState('PROCESSING');
    setError(null);
  };

  const handleOrderComplete = (data: { imageUrl: string; orderId: string }) => {
    setResult(data);
    setState('SUCCESS');
  };

  const handleError = (msg: string) => {
    setError(msg);
    setState('ERROR');
  };

  const reset = () => {
    setState('IDLE');
    setResult(null);
    setError(null);
  };

  return (
    <main>
      <h1>Google Cloud Vibe Cafe</h1>
      <p className="subtitle">Welcome to "Cloud in your Coffee" – customized coffee foam art powered by AI.</p>

      <div className="content-container">
        {state === 'IDLE' && (
          <OrderForm 
            onOrderStarted={handleOrderStarted} 
            onOrderComplete={handleOrderComplete} 
            onError={handleError} 
          />
        )}

        {state === 'PROCESSING' && <VibeLoader />}

        {state === 'SUCCESS' && result && (
          <div className="result-view">
            <h2>Your Coffee Art is Ready!</h2>
            <div className="image-container">
              <img src={result.imageUrl} alt="AI Coffee Foam Art" className="foam-art" />
              <div className="cup-overlay"></div>
            </div>
            <p className="order-id">Order ID: {result.orderId}</p>
            <button onClick={reset} className="secondary-btn">New Order</button>
          </div>
        )}

        {state === 'ERROR' && (
          <div className="error-view">
            <h2>Something went wrong</h2>
            <p>{error}</p>
            <button onClick={reset} className="secondary-btn">Try Again</button>
          </div>
        )}
      </div>

      <style jsx>{`
        .subtitle {
          margin-bottom: 3rem;
          color: var(--coffee-medium);
          font-size: 1.2rem;
        }
        .content-container {
          max-width: 600px;
          margin: 0 auto;
        }
        .result-view, .error-view {
          text-align: center;
          background: var(--card-bg);
          padding: 2.5rem;
          border-radius: 12px;
          border: 1px solid var(--coffee-light);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          align-items: center;
        }
        .image-container {
          position: relative;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          overflow: hidden;
          border: 8px solid var(--coffee-dark);
          box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
        }
        .foam-art {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cup-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, transparent 60%, rgba(255,255,255,0.2) 100%);
          pointer-events: none;
        }
        .order-id {
          font-family: monospace;
          background: #eee;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        .secondary-btn {
          background-color: var(--background);
          color: var(--coffee-dark);
          padding: 0.8rem 1.5rem;
          border: 1px solid var(--coffee-light);
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .secondary-btn:hover {
          background-color: var(--coffee-light);
        }
      `}</style>
    </main>
  );
}
