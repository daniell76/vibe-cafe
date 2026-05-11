'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Order {
  id: string;
  name: string;
  coffeeOrder: string;
  happyPlace: string;
  imageUrl: string;
  status: string;
  createdAt: string;
}

export default function ManagementPage() {
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

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/order/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchOrders, 0);
    const interval = setInterval(fetchOrders, 10000); // More frequent for management
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchOrders]);

  if (isLoading && orders.length === 0) {
    return <main className="management"><h1>Management Dashboard</h1><p>Loading orders...</p></main>;
  }

  return (
    <main className="management">
      <header>
        <h1>Vibe Cafe Management</h1>
        <p>Manage guest orders and fulfillment status.</p>
      </header>

      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Guest</th>
              <th>Order</th>
              <th>Happy Place</th>
              <th>AI Foam Art</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className={`status-${order.status}`}>
                <td>{new Date(order.createdAt).toLocaleTimeString()}</td>
                <td className="guest-name">{order.name}</td>
                <td className="coffee-type">{order.coffeeOrder}</td>
                <td className="happy-place"><i>&quot;{order.happyPlace}&quot;</i></td>
                <td>
                  <div className="art-preview">
                    <Image src={order.imageUrl} alt={order.name} width={60} height={60} unoptimized />
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${order.status}`}>{order.status}</span>
                </td>
                <td>
                  {order.status !== 'completed' ? (
                    <button 
                      onClick={() => updateStatus(order.id, 'completed')}
                      className="complete-btn"
                    >
                      Mark Complete
                    </button>
                  ) : (
                    <span className="done-text">Fulfilled ✅</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .management {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        header {
          margin-bottom: 2rem;
          border-bottom: 2px solid var(--coffee-light);
          padding-bottom: 1rem;
        }
        .orders-table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .orders-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        th {
          background-color: var(--coffee-dark);
          color: white;
          padding: 1rem;
          font-weight: 600;
        }
        td {
          padding: 1rem;
          border-bottom: 1px solid var(--coffee-light);
          vertical-align: middle;
        }
        .status-completed {
          background-color: #f8fff9;
          opacity: 0.8;
        }
        .art-preview {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid var(--coffee-dark);
        }
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-badge.pending {
          background-color: #fff4e5;
          color: #b05a00;
        }
        .status-badge.completed {
          background-color: #e6ffed;
          color: #22863a;
        }
        .complete-btn {
          background-color: var(--google-green);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .complete-btn:hover {
          background-color: #2d8a46;
          transform: scale(1.05);
        }
        .guest-name {
          font-weight: 700;
          color: var(--coffee-dark);
        }
        .done-text {
          color: var(--google-green);
          font-weight: 600;
        }
      `}</style>
    </main>
  );
}
