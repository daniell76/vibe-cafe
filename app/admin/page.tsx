'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MenuListEditor from '@/components/MenuListEditor';
import DrinkCategoriesEditor from '@/components/DrinkCategoriesEditor';

interface DrinkItem {
  name: string;
  hasFoam: boolean;
}
interface DrinkCategory {
  name: string;
  items: DrinkItem[];
}

interface Settings {
  appName: string;
  tagline: string;
  systemPrompt: string;
  drinkCategories: DrinkCategory[];
  milks: string[];
  flavors: string[];
  additionsEnabled: boolean;
  extraShotsEnabled: boolean;
  instructions: { step1: string; step2: string; step3: string };
  aiInspirationHint: string;
  aiInspirationPlaceholder: string;
  foamBrainstormTemplate: string;
  promptTemplate: string;
  vibeImageAspect: '16:9' | '4:3';
  vibeMoodTemplate: string;
  vibePromptTemplate: string;
  defaultDrink: string;
  defaultMilk: string;
  defaultAddition: string;
  trackingScreens: number;
  readyTtlMinutes: number;
  coffeeArtBypassSeconds: number;
}

interface Order {
  id: string;
  name: string;
  coffeeOrder: string;
  imageUrl: string;
  status: string;
  orderNumber?: number;
  createdAt: string;
}

const DEFAULT_SETTINGS: Settings = {
  appName: 'Vibe Café',
  tagline: 'Experience the Future of Coffee',
  systemPrompt:
    'You are the barista AI for Vibe Café. Your goal is to guide users through selecting the perfect coffee blend based on their mood.',
  drinkCategories: [],
  milks: [],
  flavors: [],
  additionsEnabled: false,
  extraShotsEnabled: false,
  instructions: { step1: '', step2: '', step3: '' },
  aiInspirationHint: '',
  aiInspirationPlaceholder: '',
  foamBrainstormTemplate: '',
  promptTemplate: '',
  vibeImageAspect: '16:9',
  vibeMoodTemplate: '',
  vibePromptTemplate: '',
  defaultDrink: 'Latte',
  defaultMilk: 'None',
  defaultAddition: 'None',
  trackingScreens: 1,
  readyTtlMinutes: 5,
  coffeeArtBypassSeconds: 30,
};

type SidebarKey = 'dashboard' | 'menu' | 'content' | 'printer' | 'gallery' | 'analytics';

const SIDEBAR: { key: SidebarKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'menu', label: 'Menu Management' },
  { key: 'content', label: 'Content' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'printer', label: 'Printer' },
  { key: 'analytics', label: 'Analytics' },
];

// Flat view items (foam or vibe).
interface GalleryImage {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

// Grouped view items: one row per order, with optional foam + vibe URLs.
interface GalleryGroup {
  orderId: string;
  orderNumber?: number;
  customerName: string;
  createdAt: string;
  foamUrl?: string;
  vibeUrl?: string;
}

type GalleryView = 'foam' | 'vibe' | 'grouped';
const GALLERY_PAGE_SIZE = 24;

export default function AdminPage() {
  const [section, setSection] = useState<SidebarKey>('dashboard');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [savingMsg, setSavingMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [nukeOpen, setNukeOpen] = useState(false);
  const [nukeConfirmText, setNukeConfirmText] = useState('');
  const [isNuking, setIsNuking] = useState(false);
  const [nukeResult, setNukeResult] = useState<string | null>(null);
  const [isResettingCounter, setIsResettingCounter] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [galleryView, setGalleryView] = useState<GalleryView>('foam');
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryGroups, setGalleryGroups] = useState<GalleryGroup[]>([]);
  const [galleryTotal, setGalleryTotal] = useState(0);
  const [galleryAll, setGalleryAll] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoadingMore, setGalleryLoadingMore] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const merged: Settings = { ...DEFAULT_SETTINGS, ...data };
          setSettings(merged);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) setOrders(await res.json());
    } catch (err) {
      console.error('Failed to fetch orders', err);
    }
  }, []);

  // Paged gallery fetch — first page replaces, subsequent pages append.
  const fetchGalleryPage = useCallback(
    async (view: GalleryView, showAll: boolean, offset: number) => {
      const isFirst = offset === 0;
      if (isFirst) setGalleryLoading(true);
      else setGalleryLoadingMore(true);
      try {
        const url = new URL('/api/admin/gallery', window.location.origin);
        url.searchParams.set('view', view);
        url.searchParams.set('offset', String(offset));
        url.searchParams.set('limit', String(GALLERY_PAGE_SIZE));
        if (showAll) url.searchParams.set('all', '1');
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const data = await res.json();
        setGalleryTotal(typeof data.total === 'number' ? data.total : 0);
        if (view === 'grouped') {
          const next = Array.isArray(data.items) ? (data.items as GalleryGroup[]) : [];
          setGalleryGroups((prev) => (isFirst ? next : [...prev, ...next]));
          if (isFirst) setGalleryImages([]);
        } else {
          const next = Array.isArray(data.items) ? (data.items as GalleryImage[]) : [];
          setGalleryImages((prev) => (isFirst ? next : [...prev, ...next]));
          if (isFirst) setGalleryGroups([]);
        }
      } catch (err) {
        console.error('Failed to fetch gallery', err);
      } finally {
        setGalleryLoading(false);
        setGalleryLoadingMore(false);
      }
    },
    [],
  );

  // Lazy-load gallery first page when the user enters the section OR changes
  // the view / "show all" toggle. The setTimeout(0) defers the setState to
  // satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (section !== 'gallery') return;
    const t = setTimeout(() => fetchGalleryPage(galleryView, galleryAll, 0), 0);
    return () => clearTimeout(t);
  }, [section, galleryView, galleryAll, fetchGalleryPage]);

  const currentLoadedCount = galleryView === 'grouped' ? galleryGroups.length : galleryImages.length;
  const hasMoreGallery = currentLoadedCount < galleryTotal;

  useEffect(() => {
    const t = setTimeout(() => {
      fetchSettings();
      fetchOrders();
    }, 0);
    const id = setInterval(fetchOrders, 15000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [fetchSettings, fetchOrders]);

  const saveSettings = async () => {
    setIsSaving(true);
    setSavingMsg('');
    const payload: Settings = {
      ...settings,
      milks: (settings.milks || []).map((s) => s.trim()).filter(Boolean),
      flavors: (settings.flavors || []).map((s) => s.trim()).filter(Boolean),
    };
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
        setSavingMsg('Saved.');
        setTimeout(() => setSavingMsg(''), 3000);
      } else {
        setSavingMsg('Save failed.');
      }
    } catch (err) {
      console.error('Save failed', err);
      setSavingMsg('Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const nuke = async () => {
    setIsNuking(true);
    setNukeResult(null);
    try {
      const res = await fetch('/api/admin/nuke', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setNukeResult(`Failed: ${data.error || res.statusText}`);
      } else {
        setNukeResult(`Wiped ${data.deletedOrders} orders and ${data.deletedFiles} files.`);
        await fetchOrders();
        setNukeConfirmText('');
      }
    } catch (err) {
      console.error('Nuke error:', err);
      setNukeResult('Network error.');
    } finally {
      setIsNuking(false);
    }
  };

  const closeNuke = () => {
    setNukeOpen(false);
    setNukeConfirmText('');
    setNukeResult(null);
  };

  // Reset the order-number counter so the next order starts at 1. Doesn't
  // touch existing orders (use Nuke for that).
  const resetCounter = async () => {
    if (!window.confirm('Reset order number counter to 0?\n\nThe next order will be #1. Existing orders are NOT deleted.')) return;
    setIsResettingCounter(true);
    setResetMsg(null);
    try {
      const res = await fetch('/api/admin/reset-counter', { method: 'POST' });
      if (res.ok) {
        setResetMsg('Counter reset — next order will be #1.');
        setTimeout(() => setResetMsg(null), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setResetMsg(`Failed: ${data.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Reset counter error:', err);
      setResetMsg('Network error.');
    } finally {
      setIsResettingCounter(false);
    }
  };

  // Pull the source-of-truth default for a single settings field and stage
  // it into local state. User still needs to click Save to persist.
  const restoreDefault = async (field: keyof Settings) => {
    try {
      const res = await fetch('/api/config/defaults');
      if (!res.ok) return;
      const defaults = await res.json();
      if (field in defaults) {
        setSettings((prev) => ({ ...prev, [field]: defaults[field] }));
      }
    } catch (err) {
      console.error('Restore default failed', err);
    }
  };

  // "Served" = the drink was finished and handed off (status='completed').
  // pickedUp was removed in the brief pp.14-19 rework — the legacy branch is
  // kept as a defensive fallback for any leftover historical rows.
  const totalServed = orders.filter(
    (o) => o.status === 'completed' || o.status === 'pickedUp',
  ).length;
  const totalOrders = orders.length;
  const drinksRanked = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const k = o.coffeeOrder || 'Other';
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);

  return (
    <main className="admin">
      <aside className="sidebar">
        <div className="user">
          <div className="avatar">AD</div>
          <div>
            <div className="user-name">Admin</div>
            <div className="user-role">Console System</div>
          </div>
        </div>
        <nav>
          {SIDEBAR.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${section === item.key ? 'active' : ''}`}
              onClick={() => setSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="footer-link">Support</button>
          <button className="btn btn-ghost export">Export Data</button>
          <button
            className="btn btn-ghost reset-counter-btn"
            onClick={resetCounter}
            disabled={isResettingCounter}
            aria-label="Reset order number to 0"
          >
            {isResettingCounter ? 'Resetting…' : '↻ Reset order number'}
          </button>
          {resetMsg && <span className="reset-msg">{resetMsg}</span>}
          <button className="btn nuke-btn" onClick={() => setNukeOpen(true)} aria-label="Wipe all order data">
            ☠ Nuke all data
          </button>
        </div>
      </aside>

      <section className="main">
        <div className="main-header">
          <h2>{SIDEBAR.find((s) => s.key === section)?.label} Overview</h2>
        </div>

        {section === 'dashboard' && (
          <div className="dash-grid">
            <div className="primary">
              <div className="card panel">
                <h3 className="panel-title brand">✎ App Identity</h3>
                <label>App Name</label>
                <input
                  value={settings.appName}
                  onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                />
                <label>Tagline</label>
                <input
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                />
              </div>

              <div className="card panel">
                <h3 className="panel-title brand">⚙ AI Configuration</h3>
                <label>System Prompt</label>
                <textarea
                  rows={4}
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                />
                <label>Instruction Copy (User Facing)</label>
                <textarea
                  rows={3}
                  value={settings.instructions.step1}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      instructions: { ...settings.instructions, step1: e.target.value },
                    })
                  }
                />
              </div>

              <div className="card panel">
                <h3 className="panel-title brand">🍵 Menu Inventory</h3>
                <p className="hint">Edit drink categories, milks, additions and toggles in Menu Management.</p>
              </div>

              <div className="card panel">
                <h3 className="panel-title brand">📺 Tracking Screens</h3>
                <p className="hint">
                  Number of landscape status displays in the store. Each screen serves a contiguous slice of the order queue at <code>/tracking/1</code>, <code>/tracking/2</code>, …
                </p>
                <label>Number of screens</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={settings.trackingScreens}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setSettings({
                      ...settings,
                      trackingScreens: Number.isFinite(n) && n >= 1 ? Math.min(n, 8) : 1,
                    });
                  }}
                  style={{ maxWidth: 120 }}
                />
                <label style={{ marginTop: '0.75rem' }}>Ready display time (minutes)</label>
                <p className="hint" style={{ marginTop: '-0.25rem' }}>
                  How long a completed order stays on the tracking dashboard before auto-disappearing.
                </p>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.readyTtlMinutes}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setSettings({
                      ...settings,
                      readyTtlMinutes: Number.isFinite(n) && n >= 1 ? Math.min(n, 60) : 5,
                    });
                  }}
                  style={{ maxWidth: 120 }}
                />

                <label style={{ marginTop: '0.75rem' }}>Coffee-art wait before bypass (seconds)</label>
                <p className="hint" style={{ marginTop: '-0.25rem' }}>
                  How long a customer waits on the art-select loader before the &ldquo;Skip and submit order&rdquo; button appears.
                </p>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={settings.coffeeArtBypassSeconds}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setSettings({
                      ...settings,
                      coffeeArtBypassSeconds: Number.isFinite(n) && n >= 5 ? Math.min(n, 300) : 30,
                    });
                  }}
                  style={{ maxWidth: 120 }}
                />
              </div>

              <div className="save-bar">
                <span className="save-msg">{savingMsg}</span>
                <button className="btn btn-primary" onClick={saveSettings} disabled={isSaving}>
                  {isSaving ? 'Saving…' : '+ Save Configuration'}
                </button>
              </div>
            </div>

            <div className="aside-col">
              <div className="card mini">
                <span className="mini-label">Total Served</span>
                <span className="mini-value">{totalServed.toLocaleString()}</span>
                <span className="mini-trend">↑ {totalOrders} this period</span>
              </div>
              <div className="card mini printer">
                <span className="mini-label">Printer</span>
                <span className="status-line"><span className="status-dot" /> Not connected</span>
              </div>
              <div className="card mini">
                <span className="mini-label">📊 Top Drinks</span>
                <ol className="top-list">
                  {drinksRanked.length === 0 && <li className="empty">No data yet.</li>}
                  {drinksRanked.map(([drink, count], i) => (
                    <li key={drink}>
                      <span className="rank">{i + 1}</span>
                      <span className="d-name">{drink}</span>
                      <span className="d-count">{count}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        {section === 'menu' && (
          <div className="card panel">
            <h3 className="panel-title brand">🍵 Menu Inventory</h3>
            <p className="hint">Add or remove items individually. Updates are live for guests immediately.</p>
            <h4 className="sub-title">Drink categories (grouped dropdown)</h4>
            <DrinkCategoriesEditor
              categories={settings.drinkCategories}
              onChange={(next) => setSettings({ ...settings, drinkCategories: next })}
            />

            <hr className="divider" />

            <h4 className="sub-title">Milks</h4>
            <MenuListEditor
              label="Milk options"
              items={settings.milks}
              placeholder="e.g. Oat Milk"
              onChange={(next) => setSettings({ ...settings, milks: next })}
            />

            <hr className="divider" />

            <h4 className="sub-title">Additions / flavors</h4>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.additionsEnabled}
                onChange={(e) => setSettings({ ...settings, additionsEnabled: e.target.checked })}
              />
              <span>Show Additions on the ordering page</span>
            </label>
            <p className="hint">When off, the Additions section is hidden from customers (use this for events that don&apos;t offer flavored syrups). Items below are still saved so you can flip the toggle later without re-typing.</p>
            <MenuListEditor
              label="Addition options"
              items={settings.flavors}
              placeholder="e.g. Vanilla"
              onChange={(next) => setSettings({ ...settings, flavors: next })}
            />

            <hr className="divider" />

            <h4 className="sub-title">Extra shots</h4>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.extraShotsEnabled}
                onChange={(e) => setSettings({ ...settings, extraShotsEnabled: e.target.checked })}
              />
              <span>Show Extra Shots stepper on the ordering page</span>
            </label>
            <p className="hint">When off, the stepper is hidden from customers.</p>

            <hr className="divider" />
            <h4 className="sub-title">Defaults shown on the Ordering page</h4>
            <p className="hint">What customers see pre-selected when the form first loads. Picks must exist in the menus above.</p>
            <div className="inv-grid">
              <div className="default-field">
                <label>Default drink</label>
                {(() => {
                  const allDrinkNames = settings.drinkCategories.flatMap((c) => c.items.map((it) => it.name));
                  const hasMatch = allDrinkNames.includes(settings.defaultDrink);
                  return (
                    <select
                      value={hasMatch ? settings.defaultDrink : ''}
                      onChange={(e) => setSettings({ ...settings, defaultDrink: e.target.value })}
                    >
                      {!hasMatch && <option value="" disabled>Select a drink…</option>}
                      {settings.drinkCategories.map((cat) => (
                        <optgroup key={cat.name} label={cat.name || '—'}>
                          {cat.items.map((d) => <option key={d.name} value={d.name}>{d.name}{d.hasFoam ? '' : ' (no foam)'}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  );
                })()}
              </div>
              <div className="default-field">
                <label>Default milk</label>
                <select
                  value={settings.milks.includes(settings.defaultMilk) ? settings.defaultMilk : ''}
                  onChange={(e) => setSettings({ ...settings, defaultMilk: e.target.value })}
                >
                  {!settings.milks.includes(settings.defaultMilk) && (
                    <option value="" disabled>Select a milk…</option>
                  )}
                  {settings.milks.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="default-field">
                <label>Default addition</label>
                <select
                  value={settings.flavors.includes(settings.defaultAddition) ? settings.defaultAddition : ''}
                  onChange={(e) => setSettings({ ...settings, defaultAddition: e.target.value })}
                >
                  {!settings.flavors.includes(settings.defaultAddition) && (
                    <option value="" disabled>Select an addition…</option>
                  )}
                  {settings.flavors.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="save-bar">
              <span className="save-msg">{savingMsg}</span>
              <button className="btn btn-primary" onClick={saveSettings} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Menu'}
              </button>
            </div>
          </div>
        )}

        {section === 'content' && (
          <div className="card panel">
            <h3 className="panel-title brand">📝 User-Facing Copy</h3>
            <label>Step 1 — Customise</label>
            <textarea
              rows={2}
              value={settings.instructions.step1}
              onChange={(e) =>
                setSettings({ ...settings, instructions: { ...settings.instructions, step1: e.target.value } })
              }
            />
            <label>Step 2 — Select Art</label>
            <textarea
              rows={2}
              value={settings.instructions.step2}
              onChange={(e) =>
                setSettings({ ...settings, instructions: { ...settings.instructions, step2: e.target.value } })
              }
            />
            <label>Step 3 — Review</label>
            <textarea
              rows={2}
              value={settings.instructions.step3}
              onChange={(e) =>
                setSettings({ ...settings, instructions: { ...settings.instructions, step3: e.target.value } })
              }
            />

            <hr className="divider" />
            <h4 className="sub-title">✨ AI Inspiration card (ordering page)</h4>
            <div className="label-row">
              <label>Hint shown above the textarea</label>
              <button
                type="button"
                className="restore-link"
                onClick={() => restoreDefault('aiInspirationHint')}
              >⟲ Restore default</button>
            </div>
            <textarea
              rows={2}
              value={settings.aiInspirationHint}
              placeholder="What's your favourite hobby, music or destination?…"
              onChange={(e) => setSettings({ ...settings, aiInspirationHint: e.target.value })}
            />
            <div className="label-row">
              <label>Textarea placeholder (example user input for this event)</label>
              <button
                type="button"
                className="restore-link"
                onClick={() => restoreDefault('aiInspirationPlaceholder')}
              >⟲ Restore default</button>
            </div>
            <input
              type="text"
              value={settings.aiInspirationPlaceholder}
              placeholder="I like soul music and especially the music of Aretha Franklin."
              onChange={(e) => setSettings({ ...settings, aiInspirationPlaceholder: e.target.value })}
            />

            <hr className="divider" />
            <h4 className="sub-title">☕ Coffee foam art (4 distinct icons)</h4>
            <p className="hint">Stage 1: a text model brainstorms 4 concept nouns from the customer&apos;s input. Stage 2: each concept is rendered as one foam icon.</p>

            <div className="label-row">
              <label>Brainstorm instructions (stage 1 — returns 4 concept nouns)</label>
              <button
                type="button"
                className="restore-link"
                onClick={() => restoreDefault('foamBrainstormTemplate')}
                title="Replace this field with the built-in default. Click Save to persist."
              >
                ⟲ Restore default
              </button>
            </div>
            <textarea
              rows={5}
              className="code"
              value={settings.foamBrainstormTemplate}
              placeholder="Return 4 distinct simple icon concepts inspired by the user input…"
              onChange={(e) => setSettings({ ...settings, foamBrainstormTemplate: e.target.value })}
            />

            <div className="label-row">
              <label>Icon render template (stage 2 — placeholders {`{concept}`} and {`{happyPlace}`})</label>
              <button
                type="button"
                className="restore-link"
                onClick={() => restoreDefault('promptTemplate')}
                title="Replace this field with the built-in default. Click Save to persist."
              >
                ⟲ Restore default
              </button>
            </div>
            <textarea
              rows={4}
              className="code"
              value={settings.promptTemplate}
              onChange={(e) => setSettings({ ...settings, promptTemplate: e.target.value })}
            />

            <hr className="divider" />
            <h4 className="sub-title">🖼️ Big-Screen Vibe Image (abstract wallpaper)</h4>
            <p className="hint">Stage 1: a text model extracts a mood paragraph that NEVER names the subject. Stage 2: the image model renders abstract wallpaper from that mood alone — so it can&apos;t accidentally draw the literal subject.</p>
            <label>Aspect Ratio</label>
            <div className="radio-row">
              {(['16:9', '4:3'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`btn-chip ${settings.vibeImageAspect === opt ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, vibeImageAspect: opt })}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="label-row">
              <label>Mood-extraction instructions (stage 1 — returns abstract mood paragraph)</label>
              <button
                type="button"
                className="restore-link"
                onClick={() => restoreDefault('vibeMoodTemplate')}
                title="Replace this field with the built-in default. Click Save to persist."
              >
                ⟲ Restore default
              </button>
            </div>
            <textarea
              rows={6}
              className="code"
              value={settings.vibeMoodTemplate}
              placeholder="Extract an evocative mood paragraph without naming the subject…"
              onChange={(e) => setSettings({ ...settings, vibeMoodTemplate: e.target.value })}
            />

            <div className="label-row">
              <label>Render template (stage 2 — placeholder {`{mood}`})</label>
              <button
                type="button"
                className="restore-link"
                onClick={() => restoreDefault('vibePromptTemplate')}
                title="Replace this field with the built-in default. Click Save to persist."
              >
                ⟲ Restore default
              </button>
            </div>
            <textarea
              rows={4}
              className="code"
              value={settings.vibePromptTemplate}
              placeholder="A purely abstract painterly wallpaper that captures this atmosphere: {mood}…"
              onChange={(e) => setSettings({ ...settings, vibePromptTemplate: e.target.value })}
            />

            <div className="save-bar">
              <span className="save-msg">{savingMsg}</span>
              <button className="btn btn-primary" onClick={saveSettings} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Copy'}
              </button>
            </div>
          </div>
        )}

        {section === 'gallery' && (
          <div className="card panel">
            <h3 className="panel-title brand">🖼 Gallery</h3>
            <p className="hint">
              Browse the images generated for this session&apos;s orders. Switch the view to see coffee art, big-screen vibe images, or grouped by order.
            </p>

            <div className="gallery-views">
              {/* "By order" / grouped view is hidden for now — order numbers
                  collide after the Reset button is used, so grouping by
                  orderNumber stops making sense. The /api/admin/gallery
                  ?view=grouped path is left intact for when we want to
                  re-enable it (e.g. once we key groups by orderId instead). */}
              {([
                { v: 'foam', label: 'Coffee art' },
                { v: 'vibe', label: 'Big screen' },
              ] as Array<{ v: GalleryView; label: string }>).map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  className={`v-tab ${galleryView === v ? 'active' : ''}`}
                  onClick={() => setGalleryView(v)}
                  aria-pressed={galleryView === v}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="gallery-bar">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={galleryAll}
                  onChange={(e) => setGalleryAll(e.target.checked)}
                />
                <span>Show all (not just today)</span>
              </label>
              <span className="gallery-count">
                {galleryLoading
                  ? 'Loading…'
                  : `${currentLoadedCount} of ${galleryTotal} ${galleryView === 'grouped' ? 'order' : 'image'}${galleryTotal === 1 ? '' : 's'}`}
              </span>
            </div>

            {galleryView !== 'grouped' && (
              galleryImages.length === 0 && !galleryLoading ? (
                <p className="empty">No images yet for this view.</p>
              ) : (
                <div className="gallery-grid">
                  {galleryImages.map((img) => {
                    const filename = img.name.split('/').pop() || img.name;
                    const niceName = filename.replace(/\.[a-z]+$/i, '');
                    const kb = (img.size / 1024).toFixed(0);
                    return (
                      <div key={img.name} className="g-tile">
                        <a href={img.url} target="_blank" rel="noreferrer" className="g-thumb-link">
                          <Image src={img.url} alt={niceName} width={220} height={220} unoptimized loading="lazy" />
                        </a>
                        <div className="g-meta">
                          <span className="g-name" title={img.name}>{niceName}</span>
                          <span className="g-size">{kb} KB</span>
                        </div>
                        <a href={img.url} download={filename} className="g-dl" aria-label={`Download ${filename}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download
                        </a>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {galleryView === 'grouped' && (
              galleryGroups.length === 0 && !galleryLoading ? (
                <p className="empty">No orders yet for this view.</p>
              ) : (
                <div className="gallery-groups">
                  {galleryGroups.map((g) => {
                    const num = g.orderNumber ? String(g.orderNumber).padStart(4, '0') : '----';
                    const time = (() => {
                      if (!g.createdAt) return '';
                      const d = new Date(g.createdAt);
                      return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    })();
                    const foamFilename = g.foamUrl ? (g.foamUrl.split('/').pop() || 'foam.png') : '';
                    const vibeFilename = g.vibeUrl ? (g.vibeUrl.split('/').pop() || 'vibe.png') : '';
                    return (
                      <div key={g.orderId} className="g-group">
                        <div className="g-group-head">
                          <span className="g-group-num">#{num}</span>
                          <span className="g-group-name">{g.customerName || '—'}</span>
                          {time && <span className="g-group-time">{time}</span>}
                        </div>
                        <div className="g-group-imgs">
                          {g.foamUrl ? (
                            <div className="g-group-tile">
                              <a href={g.foamUrl} target="_blank" rel="noreferrer" className="g-thumb-link foam">
                                <Image src={g.foamUrl} alt={`Coffee art for #${num}`} width={160} height={160} unoptimized loading="lazy" />
                              </a>
                              <div className="g-group-row">
                                <span className="g-group-tag">Coffee art</span>
                                <a href={g.foamUrl} download={foamFilename} className="g-dl">↓ Download</a>
                              </div>
                            </div>
                          ) : (
                            <div className="g-group-tile placeholder">
                              <span className="g-group-tag">Coffee art</span>
                              <span className="g-empty">— (no foam)</span>
                            </div>
                          )}
                          {g.vibeUrl ? (
                            <div className="g-group-tile">
                              <a href={g.vibeUrl} target="_blank" rel="noreferrer" className="g-thumb-link">
                                <Image src={g.vibeUrl} alt={`Vibe image for #${num}`} width={160} height={160} unoptimized loading="lazy" />
                              </a>
                              <div className="g-group-row">
                                <span className="g-group-tag">Big screen</span>
                                <a href={g.vibeUrl} download={vibeFilename} className="g-dl">↓ Download</a>
                              </div>
                            </div>
                          ) : (
                            <div className="g-group-tile placeholder">
                              <span className="g-group-tag">Big screen</span>
                              <span className="g-empty">— (not yet generated)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {hasMoreGallery && !galleryLoading && (
              <div className="load-more-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={galleryLoadingMore}
                  onClick={() => fetchGalleryPage(galleryView, galleryAll, currentLoadedCount)}
                >
                  {galleryLoadingMore ? 'Loading…' : `Load ${Math.min(GALLERY_PAGE_SIZE, galleryTotal - currentLoadedCount)} more`}
                </button>
              </div>
            )}
          </div>
        )}

        {section === 'printer' && (
          <div className="card panel">
            <h3 className="panel-title brand">🖨 Coffee Printer</h3>
            <p className="hint">Hardware bridge status.</p>
            <div className="printer-status">
              <span className="status-dot" />
              <span>Not connected — printer integration pending. Use the per-order download button on the Barista console to hand foam art to your printer manually.</span>
            </div>
          </div>
        )}

        {section === 'analytics' && (
          <div className="card panel">
            <h3 className="panel-title brand">📊 Analytics</h3>
            <div className="metric-row">
              <div className="metric">
                <span className="m-label">Total Orders</span>
                <span className="m-value">{totalOrders}</span>
              </div>
              <div className="metric">
                <span className="m-label">Served</span>
                <span className="m-value">{totalServed}</span>
              </div>
              <div className="metric">
                <span className="m-label">In progress</span>
                <span className="m-value">{totalOrders - totalServed}</span>
              </div>
            </div>

            <h4 className="sub">Top Drinks</h4>
            <ol className="top-list">
              {drinksRanked.length === 0 && <li className="empty">No data yet.</li>}
              {drinksRanked.map(([drink, count], i) => (
                <li key={drink}>
                  <span className="rank">{i + 1}</span>
                  <span className="d-name">{drink}</span>
                  <span className="d-count">{count}</span>
                </li>
              ))}
            </ol>

            <h4 className="sub">Recent gallery</h4>
            <div className="gallery">
              {orders.slice(0, 12).map((o) => (
                <div key={o.id} className="gallery-item" title={`${o.name} — ${o.coffeeOrder}`}>
                  <Image src={o.imageUrl} alt={o.name} width={120} height={120} unoptimized />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .admin {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 1.5rem;
          min-height: calc(100vh - 80px);
        }
        .sidebar {
          background: var(--surface);
          border-radius: var(--radius-md);
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          border: 1px solid var(--border);
          height: fit-content;
          position: sticky;
          top: 80px;
        }
        .user { display: flex; align-items: center; gap: 0.75rem; padding: 0 0.5rem; }
        .avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--text); color: #fff;
          font-weight: 700; font-size: 0.8rem;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .user-name { font-weight: 600; font-size: 0.95rem; }
        .user-role { font-size: 0.75rem; color: var(--text-muted); }
        nav { display: flex; flex-direction: column; gap: 0.15rem; }
        .nav-item {
          text-align: left;
          padding: 0.6rem 0.85rem;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.92rem;
          cursor: pointer;
        }
        .nav-item:hover { background: var(--surface-muted); color: var(--text); }
        .nav-item.active { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
        .sidebar-footer { margin-top: auto; display: flex; flex-direction: column; gap: 0.5rem; padding: 0 0.25rem; }
        .footer-link {
          text-align: left; padding: 0.5rem 0.6rem; background: transparent;
          border: none; color: var(--text-muted); cursor: pointer; font-size: 0.85rem;
        }
        .export { width: 100%; }
        .nuke-btn {
          width: 100%;
          margin-top: 0.5rem;
          background: transparent;
          border: 1px dashed rgba(234,67,53,0.4);
          color: var(--g-red);
          font-size: 0.85rem;
        }
        .nuke-btn:hover { background: rgba(234,67,53,0.06); border-color: var(--g-red); }
        .reset-counter-btn {
          width: 100%;
          font-size: 0.85rem;
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border);
        }
        .reset-counter-btn:hover:not(:disabled) { color: var(--text); border-color: var(--text-muted); }
        .reset-msg {
          font-size: 0.78rem;
          color: var(--g-green);
          padding: 0.15rem 0.25rem;
        }

        .nuke-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
        }
        .nuke-modal {
          background: var(--surface);
          border-radius: var(--radius-md);
          padding: 1.75rem;
          width: 460px;
          max-width: calc(100vw - 2rem);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          display: flex; flex-direction: column; gap: 0.85rem;
          border: 1px solid var(--border);
        }
        .nuke-icon { font-size: 2rem; color: var(--g-red); text-align: center; }
        .nuke-title { font-size: 1.2rem; text-align: center; color: var(--g-red); margin: 0; }
        .nuke-body { color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin: 0; }
        .nuke-confirm-prompt { font-size: 0.9rem; color: var(--text); margin: 0; }
        .nuke-confirm-prompt code {
          background: var(--surface-muted);
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.85rem;
          color: var(--g-red);
        }
        .nuke-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem; }
        .nuke-confirm { background: var(--g-red); color: #fff; border: 1px solid var(--g-red); }
        .nuke-confirm:hover:not(:disabled) { background: #c0382b; border-color: #c0382b; }
        .nuke-confirm:disabled { opacity: 0.45; cursor: not-allowed; }
        .nuke-result {
          padding: 0.6rem 0.8rem;
          background: var(--surface-muted);
          border-radius: 8px;
          font-size: 0.85rem;
          color: var(--text);
        }

        .main { display: flex; flex-direction: column; gap: 1.25rem; }
        .main-header { background: var(--surface); padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border); }
        .main-header h2 { font-size: 1.05rem; font-weight: 500; }

        .dash-grid { display: grid; grid-template-columns: 1fr 280px; gap: 1.25rem; align-items: start; }
        .primary { display: flex; flex-direction: column; gap: 1rem; }
        .aside-col { display: flex; flex-direction: column; gap: 1rem; position: sticky; top: 160px; }

        .panel { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.6rem; }
        .panel-title { font-size: 0.95rem; margin-bottom: 0.5rem; }
        .brand { color: var(--brand); }
        .hint { color: var(--text-muted); font-size: 0.85rem; margin: 0 0 0.5rem 0; }

        .inv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .inv-col { display: flex; flex-direction: column; gap: 0.35rem; }
        .inv-col textarea { resize: vertical; }

        .save-bar { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; }
        .save-msg { color: var(--g-green); font-size: 0.85rem; }

        .mini { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.35rem; }
        .mini-label { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-faint); }
        .mini-value { font-size: 2.2rem; font-weight: 700; }
        .mini-trend { font-size: 0.78rem; color: var(--g-green); }
        .printer .status-line { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; }
        .printer .status-dot { width: 10px; height: 10px; }
        .top-list { list-style: none; padding: 0; margin: 0.5rem 0 0 0; display: flex; flex-direction: column; gap: 0.4rem; }
        .top-list li { display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
        .top-list .rank { color: var(--text-faint); font-weight: 600; }
        .top-list .d-count { color: var(--text-muted); font-size: 0.8rem; }
        .top-list .empty { color: var(--text-faint); font-style: italic; grid-column: 1 / -1; }

        .metric-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .metric { background: var(--surface-muted); padding: 1rem; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 0.25rem; }
        .m-label { font-size: 0.75rem; color: var(--text-muted); }
        .m-value { font-size: 1.75rem; font-weight: 700; }
        .sub { margin: 1rem 0 0.5rem 0; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; }
        .gallery { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; margin-top: 0.5rem; }

        .gallery-views {
          display: inline-flex;
          padding: 0.25rem;
          background: var(--surface-muted);
          border-radius: 999px;
          gap: 0.25rem;
          margin: 0.5rem 0 0.75rem;
        }
        .v-tab {
          background: transparent;
          border: none;
          padding: 0.4rem 0.95rem;
          border-radius: 999px;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .v-tab:hover { color: var(--text); }
        .v-tab.active { background: var(--surface); color: var(--brand); box-shadow: var(--shadow-sm); }

        .gallery-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.75rem;
        }
        .gallery-count { font-size: 0.85rem; color: var(--text-muted); }

        .gallery-groups {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .g-group {
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--surface);
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .g-group-head {
          display: flex;
          align-items: baseline;
          gap: 0.6rem;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .g-group-num { font-weight: 700; color: var(--text); font-size: 1rem; }
        .g-group-name { color: var(--text); font-weight: 500; }
        .g-group-time { color: var(--text-faint); font-size: 0.78rem; margin-left: auto; }
        .g-group-imgs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .g-group-tile {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          background: var(--surface-muted);
          border-radius: var(--radius-sm);
          padding: 0.5rem;
          min-height: 100px;
        }
        .g-group-tile.placeholder {
          align-items: center;
          justify-content: center;
          color: var(--text-faint);
          font-size: 0.85rem;
          text-align: center;
        }
        .g-group-tile .g-thumb-link {
          display: block;
          aspect-ratio: 1 / 1;
          background: #111;
          border-radius: 4px;
          overflow: hidden;
        }
        .g-group-tile .g-thumb-link.foam { background: #fff; }
        .g-group-tile .g-thumb-link :global(img) { width: 100%; height: 100%; object-fit: cover; }
        .g-group-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.4rem;
          font-size: 0.78rem;
        }
        .g-group-tag {
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 0.7rem;
        }
        .g-empty { font-style: italic; }

        .load-more-row {
          display: flex;
          justify-content: center;
          padding: 1.25rem 0 0.25rem;
        }
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.85rem;
        }
        .g-tile {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--surface);
        }
        .g-thumb-link {
          display: block;
          aspect-ratio: 1 / 1;
          background: #111;
        }
        .g-thumb-link :global(img) { width: 100%; height: 100%; object-fit: cover; }
        .g-meta {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 0.4rem;
          padding: 0.45rem 0.6rem 0.1rem;
          font-size: 0.78rem;
          min-width: 0;
        }
        .g-name {
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          flex: 1;
        }
        .g-size { color: var(--text-faint); flex-shrink: 0; }
        .g-dl {
          padding: 0.35rem 0.6rem 0.55rem;
          font-size: 0.78rem;
          color: var(--brand);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }
        .g-dl:hover { color: var(--brand-hover); text-decoration: underline; }
        .gallery-item { aspect-ratio: 1; background: #111; border-radius: 8px; overflow: hidden; }
        .gallery-item :global(img) { width: 100%; height: 100%; object-fit: cover; }

        .printer-status { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text); }
        .printer-status .status-dot { width: 10px; height: 10px; }

        .code { font-family: monospace; font-size: 0.85rem; }
        .divider { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
        .sub-title { font-size: 0.95rem; color: var(--text); margin: 0; }
        .radio-row { display: flex; gap: 0.5rem; }
        .default-field { display: flex; flex-direction: column; gap: 0.4rem; }
        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          font-size: 0.92rem;
          color: var(--text);
          padding: 0.4rem 0;
        }
        .toggle input { width: auto; }
        .label-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .restore-link {
          background: transparent;
          border: none;
          color: var(--brand);
          font-size: 0.8rem;
          cursor: pointer;
          padding: 0.15rem 0.4rem;
          border-radius: 6px;
        }
        .restore-link:hover { background: var(--brand-soft); }

        @media (max-width: 960px) {
          .admin { grid-template-columns: 1fr; }
          .sidebar { position: static; flex-direction: row; flex-wrap: wrap; gap: 0.5rem; }
          .sidebar-footer { flex-direction: row; }
          .dash-grid { grid-template-columns: 1fr; }
          .aside-col { position: static; flex-direction: row; flex-wrap: wrap; }
          .inv-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {nukeOpen && (
        <div className="nuke-overlay" onClick={closeNuke}>
          <div className="nuke-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nuke-icon">☠</div>
            <h3 className="nuke-title">Nuke all data</h3>
            <p className="nuke-body">
              This permanently deletes <strong>every order</strong> from Firestore and <strong>every image</strong> from
              Cloud Storage (foam previews, vibe images, and any other files in the bucket). The order-number counter
              resets to 1. App settings and menus are preserved.
            </p>
            <p className="nuke-confirm-prompt">Type <code>NUKE</code> to confirm:</p>
            <input
              type="text"
              value={nukeConfirmText}
              onChange={(e) => setNukeConfirmText(e.target.value)}
              placeholder="NUKE"
              autoFocus
            />
            {nukeResult && <div className="nuke-result">{nukeResult}</div>}
            <div className="nuke-actions">
              <button className="btn btn-ghost" onClick={closeNuke} disabled={isNuking}>Cancel</button>
              <button
                className="btn nuke-confirm"
                onClick={nuke}
                disabled={isNuking || nukeConfirmText !== 'NUKE'}
              >
                {isNuking ? 'Nuking…' : 'Yes, wipe everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
