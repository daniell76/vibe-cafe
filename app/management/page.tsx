'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Order {
  id: string;
  name: string;
  coffeeOrder: string;
  milk?: string;
  flavor?: string;
  happyPlace: string;
  imageUrl: string;
  status: string;
  orderNumber?: number;
  createdAt: string;
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
  promptTemplate: string;
}

export default function ManagementPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'config' | 'analytics'>('orders');
  
  // Selection and popup states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Configuration State
  const [settings, setSettings] = useState<AppSettings>({
    drinks: [],
    milks: [],
    flavors: [],
    instructions: { step1: '', step2: '', step3: '' },
    promptTemplate: '',
  });
  const [configDrinksText, setConfigDrinksText] = useState('');
  const [configMilksText, setConfigMilksText] = useState('');
  const [configFlavorsText, setConfigFlavorsText] = useState('');
  const [isConfigSaving, setIsConfigSaving] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState('');

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

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data: AppSettings = await response.json();
        if (data) {
          setSettings(data);
          setConfigDrinksText((data.drinks || []).join(', '));
          setConfigMilksText((data.milks || []).join(', '));
          setConfigFlavorsText((data.flavors || []).join(', '));
        }
      }
    } catch (err) {
      console.error('Failed to fetch configuration:', err);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchOrders();
      fetchConfig();
    }, 0);
    const interval = setInterval(fetchOrders, 10000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchOrders, fetchConfig]);

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
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} order(s)?`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/orders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (response.ok) {
        await fetchOrders();
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfigSaving(true);
    setConfigSuccessMsg('');

    const updatedPayload: AppSettings = {
      ...settings,
      drinks: configDrinksText.split(',').map(s => s.trim()).filter(Boolean),
      milks: configMilksText.split(',').map(s => s.trim()).filter(Boolean),
      flavors: configFlavorsText.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload),
      });
      if (res.ok) {
        const savedData = await res.json();
        setSettings(savedData);
        setConfigSuccessMsg('Configuration updated successfully! Frontend options active.');
        setTimeout(() => setConfigSuccessMsg(''), 5000);
      }
    } catch (err) {
      console.error('Config update application error:', err);
      alert('Failed to patch settings.');
    } finally {
      setIsConfigSaving(false);
    }
  };

  // Metric helpers for Analytics Tab
  const totalOrdersCount = orders.length;
  const pendingCount = orders.filter(o => o.status !== 'completed').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  const popularDrinksMap = orders.reduce<Record<string, number>>((acc, order) => {
    const drink = order.coffeeOrder || 'Other';
    acc[drink] = (acc[drink] || 0) + 1;
    return acc;
  }, {});
  const leaderboard = Object.entries(popularDrinksMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (isLoading && orders.length === 0) {
    return <main className="management"><div className="loading-screen">Loading administration panel...</div></main>;
  }

  return (
    <main className="management">
      <header>
        <div className="header-top">
          <h1>Vibe Cafe Admin Portal</h1>
          {activeTab === 'orders' && selectedIds.size > 0 && (
            <button className="delete-btn" onClick={handleDeleteSelected} disabled={isDeleting}>
              {isDeleting ? 'Removing...' : `Delete Selected (${selectedIds.size})`}
            </button>
          )}
        </div>
        <p className="subtitle-text">Comprehensive control for sequence tagging, visual validation, configuration arrays, and live metrics.</p>
        
        <nav className="tabs-nav">
          <button className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            Live Orders ({pendingCount > 0 ? `${pendingCount} pending` : 'All'})
          </button>
          <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            Configuration Setup
          </button>
          <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            Event Insights
          </button>
        </nav>
      </header>

      {activeTab === 'orders' && (
        <div className="table-view">
          <div className="orders-table-container">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={orders.length > 0 && selectedIds.size === orders.length} onChange={handleSelectAll} />
                  </th>
                  <th>Sequence Tag</th>
                  <th>Time</th>
                  <th>Guest Name</th>
                  <th>Drink Profile</th>
                  <th>Additions</th>
                  <th>Happy Place</th>
                  <th>Foam Art Preview</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={`status-${order.status} ${selectedIds.has(order.id) ? 'selected' : ''}`}>
                    <td>
                      <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => handleSelectOne(order.id)} />
                    </td>
                    <td>
                      <span className="seq-badge">#{order.orderNumber || 'N/A'}</span>
                    </td>
                    <td className="time-col">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="guest-name">{order.name}</td>
                    <td className="coffee-type"><strong>{order.coffeeOrder}</strong></td>
                    <td className="additions-col">
                      <div className="add-on">{order.milk !== 'None' ? `🥛 ${order.milk}` : ''}</div>
                      <div className="add-on">{order.flavor !== 'None' ? `✨ ${order.flavor}` : ''}</div>
                    </td>
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
                        <button onClick={() => updateStatus(order.id, 'completed')} className="complete-btn">Mark Done</button>
                      ) : (
                        <span className="done-text">Served ✅</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="config-view">
          <form onSubmit={handleSaveConfig} className="config-form">
            <h2>Marketing Engine Integration</h2>
            <p className="form-help">Safely override drink variables, prompt syntax strings, and directional screen layouts dynamically.</p>

            {configSuccessMsg && <div className="status-alert success">{configSuccessMsg}</div>}

            <div className="config-section">
              <h3>Beverage Menus (Comma-separated values)</h3>
              <div className="config-group">
                <label>Base Coffee/Drink Choices</label>
                <textarea 
                  value={configDrinksText} 
                  onChange={e => setConfigDrinksText(e.target.value)} 
                  rows={2} 
                  placeholder="Latte, Cappuccino, Americano..."
                />
              </div>
              <div className="config-group">
                <label>Selectable Milk Profiles</label>
                <textarea 
                  value={configMilksText} 
                  onChange={e => setConfigMilksText(e.target.value)} 
                  rows={2} 
                  placeholder="Regular Milk, Oat Milk, None..."
                />
              </div>
              <div className="config-group">
                <label>Flavor Add-on Array</label>
                <textarea 
                  value={configFlavorsText} 
                  onChange={e => setConfigFlavorsText(e.target.value)} 
                  rows={2} 
                  placeholder="Vanilla, Hazelnut, None..."
                />
              </div>
            </div>

            <div className="config-section">
              <h3>UI Directional Headings</h3>
              <div className="config-grid">
                <div className="config-group">
                  <label>Step 1 Heading</label>
                  <input 
                    type="text" 
                    value={settings.instructions?.step1 || ''} 
                    onChange={e => setSettings({ ...settings, instructions: { ...settings.instructions, step1: e.target.value }})} 
                  />
                </div>
                <div className="config-group">
                  <label>Step 2 Heading</label>
                  <input 
                    type="text" 
                    value={settings.instructions?.step2 || ''} 
                    onChange={e => setSettings({ ...settings, instructions: { ...settings.instructions, step2: e.target.value }})} 
                  />
                </div>
                <div className="config-group">
                  <label>Step 3 Heading</label>
                  <input 
                    type="text" 
                    value={settings.instructions?.step3 || ''} 
                    onChange={e => setSettings({ ...settings, instructions: { ...settings.instructions, step3: e.target.value }})} 
                  />
                </div>
              </div>
            </div>

            <div className="config-section">
              <h3>Gen AI Core Blueprint String</h3>
              <div className="config-group">
                <label>Pattern Instruction Template (use <code>{'{happyPlace}'}</code> interpolation boundary)</label>
                <textarea 
                  value={settings.promptTemplate || ''} 
                  onChange={e => setSettings({ ...settings, promptTemplate: e.target.value })} 
                  rows={4} 
                  className="code-area"
                />
              </div>
            </div>

            <button type="submit" className="save-config-btn" disabled={isConfigSaving}>
              {isConfigSaving ? 'Syncing DB Engine...' : 'Publish System Configuration'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="analytics-view">
          <h2>Logistics & Event Summaries</h2>
          
          <div className="metrics-cards-grid">
            <div className="metric-card">
              <span className="metric-value">{totalOrdersCount}</span>
              <span className="metric-label">Total Coffees Ordered</span>
            </div>
            <div className="metric-card">
              <span className="metric-value active-clr">{pendingCount}</span>
              <span className="metric-label">Active Queues</span>
            </div>
            <div className="metric-card">
              <span className="metric-value served-clr">{completedCount}</span>
              <span className="metric-label">Completed Hand-offs</span>
            </div>
          </div>

          <div className="leaderboard-container">
            <h3>Top Preferred Options Leaderboard</h3>
            {leaderboard.length > 0 ? (
              <div className="leaderboard-bars">
                {leaderboard.map(([drinkName, count], i) => (
                  <div key={drinkName} className="bar-item">
                    <div className="bar-rank">#{i + 1}</div>
                    <div className="bar-title">{drinkName}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(10, (count / totalOrdersCount) * 100)}%` }}></div>
                    </div>
                    <div className="bar-score">{count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-msg">No statistics available yet. Place sample orders to track popularity graphs.</p>
            )}
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedImage(null)}>&times;</button>
            <div className="large-art">
              <Image src={selectedImage} alt="Large Custom Art" width={600} height={600} unoptimized />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .management {
          max-width: 1300px;
          margin: 0 auto;
          padding: 2rem;
        }
        header {
          margin-bottom: 2rem;
          border-bottom: 2px solid var(--coffee-light);
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .subtitle-text {
          color: var(--coffee-medium);
          margin: 0.25rem 0 1.5rem 0;
          font-size: 0.95rem;
        }
        .tabs-nav {
          display: flex;
          gap: 0.5rem;
          transform: translateY(2px);
        }
        .tab-btn {
          padding: 0.75rem 1.5rem;
          border: 2px solid transparent;
          background: none;
          font-weight: 600;
          font-size: 1rem;
          color: var(--coffee-medium);
          cursor: pointer;
          border-radius: 10px 10px 0 0;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: var(--coffee-dark);
          background: rgba(0,0,0,0.02);
        }
        .tab-btn.active {
          color: var(--google-blue);
          border-color: var(--coffee-light);
          border-bottom-color: var(--background);
          background: var(--background);
        }
        
        /* Table View */
        .orders-table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          overflow-x: auto;
        }
        .orders-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.95rem;
        }
        th {
          background-color: var(--coffee-dark);
          color: white;
          padding: 1rem;
          font-weight: 600;
          white-space: nowrap;
        }
        td {
          padding: 1rem;
          border-bottom: 1px solid var(--coffee-light);
          vertical-align: middle;
        }
        tr.selected { background-color: #fff9c4; }
        .seq-badge {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--google-blue);
          background: rgba(66, 133, 244, 0.1);
          padding: 0.2rem 0.6rem;
          border-radius: 6px;
        }
        .time-col { color: #777; font-size: 0.85rem; }
        .guest-name { font-weight: 700; color: var(--coffee-dark); }
        .additions-col { font-size: 0.85rem; color: #555; }
        .add-on { line-height: 1.3; }
        
        /* Image Popup */
        .art-preview {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid var(--coffee-dark);
          cursor: zoom-in;
          transition: transform 0.2s;
        }
        .art-preview:hover { transform: scale(1.05); }
        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(5px);
        }
        .modal-content {
          position: relative; background: white; padding: 1rem; border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .large-art {
          width: 600px; height: 600px; max-width: 80vw; max-height: 80vh;
          border-radius: 16px; overflow: hidden; border: 12px solid var(--coffee-dark);
          box-shadow: inset 0 0 30px rgba(0,0,0,0.3);
        }
        .large-art :global(img) { width: 100%; height: 100%; object-fit: cover; }
        .close-modal {
          position: absolute; top: -15px; right: -15px; background: var(--google-red); color: white;
          border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.5rem;
          cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 1001;
        }
        
        /* Config Form */
        .config-form {
          background: var(--card-bg); padding: 2rem; border-radius: 12px;
          border: 1px solid var(--coffee-light); box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          display: flex; flex-direction: column; gap: 2rem;
        }
        .form-help { color: var(--coffee-medium); margin: -1rem 0 0 0; font-size: 0.9rem; }
        .config-section { display: flex; flex-direction: column; gap: 1rem; }
        .config-section h3 { font-size: 1.1rem; color: var(--coffee-dark); margin-bottom: 0.25rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
        .config-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .config-group label { font-size: 0.9rem; font-weight: 600; color: #444; }
        .code-area { font-family: monospace; font-size: 0.9rem; background: #fcfcfc; border-left: 4px solid var(--google-blue); }
        .save-config-btn {
          background: var(--google-blue); color: white; padding: 1rem; border: none; border-radius: 8px;
          font-weight: 600; font-size: 1.1rem; cursor: pointer; transition: opacity 0.2s;
        }
        .save-config-btn:hover { opacity: 0.9; }
        .status-alert.success { background: #e8f5e9; color: #2e7d32; padding: 1rem; border-radius: 8px; border: 1px solid #a5d6a7; }
        
        /* Analytics View */
        .analytics-view { display: flex; flex-direction: column; gap: 2rem; }
        .metrics-cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; }
        .metric-card {
          background: var(--card-bg); border: 1px solid var(--coffee-light); padding: 1.5rem;
          border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.03);
        }
        .metric-value { font-size: 3rem; font-weight: 800; line-height: 1; color: var(--coffee-dark); }
        .metric-value.active-clr { color: var(--google-blue); }
        .metric-value.served-clr { color: var(--google-green); }
        .metric-label { font-size: 0.9rem; color: var(--coffee-medium); font-weight: 500; }
        
        .leaderboard-container { background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--coffee-light); }
        .leaderboard-bars { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
        .bar-item { display: flex; align-items: center; gap: 1rem; }
        .bar-rank { font-weight: 700; color: #999; width: 30px; }
        .bar-title { font-weight: 600; width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bar-track { flex-grow: 1; height: 12px; background: #f0f0f0; border-radius: 6px; overflow: hidden; }
        .bar-fill { height: 100%; background: var(--google-blue); border-radius: 6px; transition: width 0.5s ease-out; }
        .bar-score { font-weight: 700; width: 40px; text-align: right; }
        .empty-msg { color: #888; font-style: italic; }
        
        /* Helper Buttons */
        .delete-btn { background: var(--google-red); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .complete-btn { background: var(--google-green); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
        .status-badge { padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .status-badge.pending { background: #fff4e5; color: #b05a00; }
        .status-badge.completed { background: #e6ffed; color: #22863a; }
        .done-text { color: var(--google-green); font-weight: 600; }
        .loading-screen { text-align: center; padding: 4rem; color: var(--coffee-medium); }
      `}</style>
    </main>
  );
}
