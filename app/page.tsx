'use client';

import { useState } from 'react';
import OrderForm from '@/components/OrderForm';
import VibeLoader from '@/components/VibeLoader';
import FoamPreview from '@/components/FoamPreview';
import OrderHistory from '@/components/OrderHistory';

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
      <header>
        <h1>Google Cloud Vibe Cafe</h1>
        <p className="subtitle">&quot;Cloud in your Coffee&quot; – Generate AI coffee foam art with Gemini 3.1 Flash.</p>
      </header>

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
            <FoamPreview imageUrl={result.imageUrl} />
            <div className="result-footer">
              <p className="order-id">Order ID: {result.orderId}</p>
              <button onClick={reset} className="secondary-btn">New Order</button>
            </div>
          </div>
        )}

        {state === 'ERROR' && (
          <div className="error-view">
            <h2>Something went wrong</h2>
            <p className="error-msg">{error}</p>
            <button onClick={reset} className="secondary-btn">Try Again</button>
          </div>
        )}
      </div>

      <OrderHistory />

      <style jsx>{`
        header {
          text-align: center;
          margin-bottom: 4rem;
        }
        .subtitle {
          color: var(--coffee-medium);
          font-size: 1.2rem;
          margin-top: 0.5rem;
        }
        .content-container {
          max-width: 600px;
          margin: 0 auto;
          min-height: 400px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .result-view, .error-view {
          text-align: center;
          background: var(--card-bg);
          padding: 2.5rem;
          border-radius: 12px;
          border: 1px solid var(--coffee-light);
          box-shadow: 0 8px 16px rgba(0,0,0,0.1);
        }
        .result-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          margin-top: 1rem;
        }
        .order-id {
          font-family: monospace;
          background: var(--background);
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-size: 0.9rem;
          border: 1px solid var(--coffee-light);
        }
        .error-msg {
          color: var(--google-red);
          margin-bottom: 1.5rem;
        }
        .secondary-btn {
          background-color: var(--background);
          color: var(--coffee-dark);
          padding: 0.8rem 2rem;
          border: 1px solid var(--coffee-light);
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .secondary-btn:hover {
          background-color: var(--coffee-light);
          transform: translateY(-2px);
        }
      `}</style>
    </main>
  );
}
