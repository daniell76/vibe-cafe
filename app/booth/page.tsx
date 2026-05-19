'use client';

import { useState } from 'react';
import Image from 'next/image';

interface OrderData {
  name: string;
  coffeeOrder: string;
  happyPlace: string;
  imageUrl: string;
  orderNumber?: number;
}

export default function BoothPage() {
  const [inputNumber, setInputNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);

  const handleKeyClick = (num: string) => {
    if (error) setError('');
    if (inputNumber.length < 4) {
      setInputNumber(prev => prev + num);
    }
  };

  const handleClear = () => {
    setInputNumber('');
    setError('');
  };

  const handleLookup = async () => {
    if (!inputNumber) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/order/number/${inputNumber}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      } else if (res.status === 404) {
        setError('Sequence tag not found. Please check your retrieval number.');
      } else {
        setError('Server mapping error. Try again.');
      }
    } catch (err) {
      console.error('Booth fetch mapping execution error:', err);
      setError('Network communication drop.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setOrder(null);
    setInputNumber('');
    setError('');
  };

  return (
    <main className="booth-container">
      {!order ? (
        <div className="keypad-panel">
          <h1>Vibe Visualizer Booth</h1>
          <p className="instructions">Enter your short retrieval sequence tag below to load your foam art preview on the big screen.</p>

          <div className="display-screen">
            <span className={`number-view ${inputNumber ? 'active' : 'placeholder'}`}>
              {inputNumber ? `#${inputNumber}` : '#---'}
            </span>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="numpad-grid">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
              <button key={n} className="key-btn" onClick={() => handleKeyClick(n)} disabled={isLoading}>
                {n}
              </button>
            ))}
            <button className="key-btn action clear" onClick={handleClear} disabled={isLoading}>C</button>
            <button className="key-btn" onClick={() => handleKeyClick('0')} disabled={isLoading}>0</button>
            <button className="key-btn action submit" onClick={handleLookup} disabled={isLoading || !inputNumber}>
              {isLoading ? '...' : 'GO'}
            </button>
          </div>
        </div>
      ) : (
        <div className="presentation-box">
          <button className="back-btn" onClick={handleReset}>← Load Another Tag</button>
          
          <div className="art-wrapper">
            <div className="image-frame">
              <Image src={order.imageUrl} alt="Mapped AI Foam Art" width={800} height={800} unoptimized priority />
            </div>
          </div>

          <div className="metadata-strip">
            <div className="tag-indicator">#{order.orderNumber}</div>
            <div className="guest-details">
              <h2>{order.name}&apos;s Custom Creation</h2>
              <p className="quote"><i>&quot;{order.happyPlace}&quot;</i></p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .booth-container {
          height: 100vh;
          width: 100vw;
          background: #0a0a0a;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, -apple-system, sans-serif;
          overflow: hidden;
          box-sizing: border-box;
        }
        
        /* Keypad Entry State */
        .keypad-panel {
          background: #141414;
          border: 2px solid #333;
          padding: 3rem;
          border-radius: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 480px;
          width: 90%;
        }
        h1 { font-size: 2rem; margin: 0 0 0.5rem 0; color: #f0f0f0; }
        .instructions { color: #aaa; text-align: center; font-size: 0.95rem; margin-bottom: 2rem; }
        
        .display-screen {
          background: #000;
          border: 2px solid #444;
          width: 100%;
          padding: 1.5rem;
          border-radius: 16px;
          text-align: center;
          margin-bottom: 1.5rem;
          box-sizing: border-box;
        }
        .number-view { font-size: 4rem; font-weight: 800; font-family: monospace; letter-spacing: 2px; }
        .number-view.active { color: #4caf50; text-shadow: 0 0 20px rgba(76,175,80,0.4); }
        .number-view.placeholder { color: #333; }
        
        .error-msg { color: #f44336; background: rgba(244,67,54,0.1); padding: 0.75rem; border-radius: 8px; width: 100%; text-align: center; margin-bottom: 1rem; box-sizing: border-box; }
        
        .numpad-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          width: 100%;
        }
        .key-btn {
          background: #222;
          color: white;
          border: 1px solid #444;
          padding: 1.5rem;
          font-size: 1.75rem;
          font-weight: 700;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.1s;
        }
        .key-btn:hover:not(:disabled) { background: #333; transform: scale(1.02); }
        .key-btn:active:not(:disabled) { transform: scale(0.98); }
        .key-btn.action.clear { background: #3a1010; color: #ff6b6b; border-color: #551a1a; }
        .key-btn.action.submit { background: #1b4d1b; color: #8ce98c; border-color: #266b26; }
        
        /* Full Presentation State */
        .presentation-box {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 2rem;
          box-sizing: border-box;
          position: relative;
        }
        .back-btn {
          position: absolute;
          top: 2rem;
          left: 2rem;
          background: rgba(255,255,255,0.1);
          color: #ccc;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 30px;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
          z-index: 10;
        }
        .back-btn:hover { background: rgba(255,255,255,0.2); color: white; }
        
        .art-wrapper {
          flex-grow: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-height: calc(100vh - 180px);
        }
        .image-frame {
          width: 70vh;
          height: 70vh;
          max-width: 70vw;
          max-height: 70vw;
          border-radius: 16px;
          overflow: hidden;
          border: 4px solid #444;
          box-shadow: 0 0 80px rgba(255,255,255,0.05);
          background: white;
        }
        .image-frame :global(img) { width: 100%; height: 100%; object-fit: cover; }
        
        .metadata-strip {
          background: #141414;
          border: 1px solid #222;
          padding: 1.25rem 2.5rem;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 2rem;
          max-width: 900px;
          width: 100%;
          box-sizing: border-box;
        }
        .tag-indicator {
          font-size: 3rem;
          font-weight: 800;
          color: #4caf50;
          font-family: monospace;
          border-right: 2px solid #333;
          padding-right: 2rem;
        }
        .guest-details { display: flex; flex-direction: column; gap: 0.25rem; overflow: hidden; }
        .guest-details h2 { margin: 0; font-size: 1.4rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .quote { margin: 0; color: #aaa; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
    </main>
  );
}
