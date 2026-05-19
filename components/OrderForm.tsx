'use client';

import { useState, useEffect } from 'react';

interface OrderFormProps {
  onOrderStarted: () => void;
  onOrderComplete: (data: { imageUrl: string; orderId: string; orderNumber?: number }) => void;
  onError: (error: string) => void;
}

interface AppSettings {
  drinks: string[];
  milks: string[];
  flavors: string[];
  instructions: {
    step1: string;
    step2: string;
    step3: string;
  };
}

export default function OrderForm({ onOrderStarted, onOrderComplete, onError }: OrderFormProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [name, setName] = useState('');
  const [coffeeOrder, setCoffeeOrder] = useState('Latte');
  const [milk, setMilk] = useState('Regular Milk');
  const [flavor, setFlavor] = useState('None');
  const [happyPlace, setHappyPlace] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedNumber, setCompletedNumber] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then((data: AppSettings) => {
        if (data && data.drinks) {
          setSettings(data);
          if (data.drinks.length > 0) setCoffeeOrder(data.drinks[0]);
          if (data.milks.length > 0) setMilk(data.milks[0]);
          if (data.flavors.length > 0) setFlavor(data.flavors[0]);
        }
      })
      .catch(err => console.error('Failed to load custom options:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !happyPlace) return;

    setIsSubmitting(true);
    setCompletedNumber(null);
    onOrderStarted();

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, coffeeOrder, milk, flavor, happyPlace }),
      });

      if (!response.ok) {
        throw new Error('Failed to process order');
      }

      const data = await response.json();
      if (data.orderNumber) {
        setCompletedNumber(data.orderNumber);
      }
      onOrderComplete(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const drinks = settings?.drinks || ['Latte', 'Cappuccino', 'Flat White', 'Americano', 'Mocha'];
  const milks = settings?.milks || ['Regular Milk', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'None'];
  const flavors = settings?.flavors || ['Vanilla', 'Caramel', 'Hazelnut', 'None'];
  const instructions = settings?.instructions || {
    step1: 'Select your drink base',
    step2: 'Choose milk & flavoring',
    step3: 'Describe your happy place'
  };

  return (
    <div className="form-container">
      {completedNumber && (
        <div className="success-banner">
          <h3>Order Successfully Submitted!</h3>
          <div className="sequence-display">
            <span>Retrieval Sequence Tag:</span>
            <strong className="number-tag">#{completedNumber}</strong>
          </div>
          <p className="booth-help">Share this numerical tag with print baristas or check display screens.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="order-form">
        <div className="form-group">
          <label htmlFor="name">Guest Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter guest name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="coffee">{instructions.step1}</label>
          <select id="coffee" value={coffeeOrder} onChange={(e) => setCoffeeOrder(e.target.value)}>
            {drinks.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="form-section">
          <label>{instructions.step2}</label>
          <div className="split-group">
            <div className="sub-group">
              <span className="sub-label">Milk Option</span>
              <select value={milk} onChange={(e) => setMilk(e.target.value)}>
                {milks.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="sub-group">
              <span className="sub-label">Flavor Add-on</span>
              <select value={flavor} onChange={(e) => setFlavor(e.target.value)}>
                {flavors.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="happyPlace">{instructions.step3}</label>
          <textarea
            id="happyPlace"
            value={happyPlace}
            onChange={(e) => setHappyPlace(e.target.value)}
            placeholder="Describe your favorite travel destination or happy place..."
            required
            rows={3}
          />
        </div>

        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Brewing AI Art...' : 'Generate Custom Art'}
        </button>
      </form>

      <style jsx>{`
        .form-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .success-banner {
          background: #e8f5e9;
          border: 2px solid #2e7d32;
          padding: 1.5rem;
          border-radius: 12px;
          text-align: center;
          color: #1b5e20;
          animation: popIn 0.3s ease-out;
        }
        .sequence-display {
          margin: 1rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        .number-tag {
          font-size: 3.5rem;
          line-height: 1;
          background: #2e7d32;
          color: white;
          padding: 0.5rem 1.5rem;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(46,125,50,0.3);
        }
        .booth-help {
          font-size: 0.9rem;
          opacity: 0.9;
          margin: 0;
        }
        .order-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          background: var(--card-bg);
          padding: 2rem;
          border-radius: 12px;
          border: 1px solid var(--coffee-light);
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .form-group, .form-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .split-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .sub-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        label {
          font-weight: 600;
          color: var(--coffee-dark);
          font-size: 1.05rem;
        }
        .sub-label {
          font-size: 0.85rem;
          color: var(--coffee-medium);
          font-weight: 500;
        }
        input, select, textarea {
          padding: 0.8rem;
          border: 1px solid var(--coffee-light);
          border-radius: 8px;
          font-size: 1rem;
          background-color: var(--background);
          color: var(--foreground);
          width: 100%;
          box-sizing: border-box;
        }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: var(--google-blue);
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
        }
        .submit-btn {
          background-color: var(--google-blue);
          color: white;
          padding: 1rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
          transition: background-color 0.2s;
          margin-top: 0.5rem;
        }
        .submit-btn:hover {
          background-color: #3367d6;
        }
        .submit-btn:disabled {
          background-color: var(--coffee-light);
          cursor: not-allowed;
        }
        @keyframes popIn {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
