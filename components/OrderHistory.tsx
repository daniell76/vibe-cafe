'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Order {
  id: string;
  name: string;
  coffeeOrder: string;
  happyPlace: string;
  imageUrl: string;
  createdAt: string;
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(fetchOrders, 0);
    const interval = setInterval(fetchOrders, 30000); // Refresh every 30s
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchOrders]);

  if (isLoading && orders.length === 0) {
    return <div className="loading">Loading history...</div>;
  }

  return (
    <div className="order-history">
      <h2>Recent Vibe Orders</h2>
      <div className="orders-grid">
        {orders.map((order) => (
          <div key={order.id} className="order-card">
            <div className="order-thumb">
              <Image src={order.imageUrl} alt={order.name} width={80} height={80} unoptimized />
            </div>
            <div className="order-info">
              <h3>{order.name}</h3>
              <p className="order-type">{order.coffeeOrder}</p>
              <p className="order-place">&quot;{order.happyPlace}&quot;</p>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .order-history {
          margin-top: 4rem;
          padding-top: 2rem;
          border-top: 2px dashed var(--coffee-light);
        }
        h2 {
          margin-bottom: 2rem;
          color: var(--coffee-dark);
        }
        .orders-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }
        .order-card {
          display: flex;
          background: var(--card-bg);
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--coffee-light);
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .order-thumb {
          width: 80px;
          height: 80px;
          flex-shrink: 0;
        }
        .order-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .order-info {
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          overflow: hidden;
        }
        h3 {
          margin: 0;
          font-size: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .order-type {
          font-size: 0.85rem;
          color: var(--google-blue);
          font-weight: 600;
        }
        .order-place {
          font-size: 0.8rem;
          color: var(--coffee-medium);
          font-style: italic;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .loading {
          text-align: center;
          padding: 2rem;
          color: var(--coffee-medium);
        }
      `}</style>
    </div>
  );
}
