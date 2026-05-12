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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} order(s)? This will also remove the images from Cloud Storage.`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/orders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Delete results:', result);
        // Refresh list and clear selection
        await fetchOrders();
        setSelectedIds(new Set());
      } else {
        alert('Failed to delete some orders.');
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setIsDeleting(false);
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
        <div className="header-top">
          <h1>Vibe Cafe Management</h1>
          {selectedIds.size > 0 && (
            <button 
              className="delete-btn" 
              onClick={handleDeleteSelected}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
            </button>
          )}
        </div>
        <p>Manage guest orders and fulfillment status.</p>
      </header>

      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox" 
                  checked={orders.length > 0 && selectedIds.size === orders.length}
                  onChange={handleSelectAll}
                />
              </th>
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
              <tr key={order.id} className={`status-${order.status} ${selectedIds.has(order.id) ? 'selected' : ''}`}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(order.id)}
                    onChange={() => handleSelectOne(order.id)}
                  />
                </td>
                <td>{new Date(order.createdAt).toLocaleTimeString()}</td>
                <td className="guest-name">{order.name}</td>
                <td className="coffee-type">{order.coffeeOrder}</td>
                <td className="happy-place"><i>&quot;{order.happyPlace}&quot;</i></td>
                <td>
                  <div className="art-preview" onClick={() => setSelectedImage(order.imageUrl)}>
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

      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedImage(null)}>&times;</button>
            <div className="large-art">
              <Image src={selectedImage} alt="Large Foam Art" width={600} height={600} unoptimized />
            </div>
          </div>
        </div>
      )}

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
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .delete-btn {
          background-color: var(--google-red);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .delete-btn:hover:not(:disabled) {
          background-color: #d32f2f;
          transform: translateY(-2px);
        }
        .delete-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
        tr.selected {
          background-color: #fff9c4;
        }
        .status-completed {
          opacity: 0.8;
        }
        .art-preview {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid var(--coffee-dark);
          cursor: zoom-in;
          transition: transform 0.2s;
        }
        .art-preview:hover {
          transform: scale(1.1);
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(5px);
        }
        .modal-content {
          position: relative;
          background: white;
          padding: 1rem;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          max-width: 90vw;
          max-height: 90vh;
        }
        .large-art {
          width: 600px;
          height: 600px;
          max-width: 80vw;
          max-height: 80vh;
          border-radius: 50%;
          overflow: hidden;
          border: 12px solid var(--coffee-dark);
          box-shadow: inset 0 0 30px rgba(0,0,0,0.3);
        }
        .large-art :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .close-modal {
          position: absolute;
          top: -20px;
          right: -20px;
          background: var(--google-red);
          color: white;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 2rem;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          z-index: 1001;
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
