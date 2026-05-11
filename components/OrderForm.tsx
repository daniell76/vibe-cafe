'use client';

import { useState } from 'react';

interface OrderFormProps {
  onOrderStarted: () => void;
  onOrderComplete: (data: { imageUrl: string; orderId: string }) => void;
  onError: (error: string) => void;
}

export default function OrderForm({ onOrderStarted, onOrderComplete, onError }: OrderFormProps) {
  const [name, setName] = useState('');
  const [coffeeOrder, setCoffeeOrder] = useState('Latte');
  const [happyPlace, setHappyPlace] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !happyPlace) return;

    setIsSubmitting(true);
    onOrderStarted();

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, coffeeOrder, happyPlace }),
      });

      if (!response.ok) {
        throw new Error('Failed to process order');
      }

      const data = await response.json();
      onOrderComplete(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
        <label htmlFor="coffee">Coffee Order</label>
        <select id="coffee" value={coffeeOrder} onChange={(e) => setCoffeeOrder(e.target.value)}>
          <option value="Latte">Latte</option>
          <option value="Cappuccino">Cappuccino</option>
          <option value="Flat White">Flat White</option>
          <option value="Americano">Americano</option>
          <option value="Mocha">Mocha</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="happyPlace">What&apos;s your &quot;happy place&quot;?</label>
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
        {isSubmitting ? 'Brewing AI Art...' : 'Generate Coffee Art'}
      </button>

      <style jsx>{`
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
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        label {
          font-weight: 600;
          color: var(--coffee-dark);
        }
        input, select, textarea {
          padding: 0.8rem;
          border: 1px solid var(--coffee-light);
          border-radius: 8px;
          font-size: 1rem;
          background-color: var(--background);
          color: var(--foreground);
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
        }
        .submit-btn:hover {
          background-color: #3367d6;
        }
        .submit-btn:disabled {
          background-color: var(--coffee-light);
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}
