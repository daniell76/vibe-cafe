'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const TABS = [
  { href: '/', label: 'Ordering' },
  { href: '/barista', label: 'Barista' },
  { href: '/tracking', label: 'Tracking' },
  { href: '/admin', label: 'Admin' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/order');
  return pathname === href || pathname.startsWith(href + '/');
}

export default function NavBar() {
  const pathname = usePathname() || '/';
  const [appName, setAppName] = useState('Vibe Café');

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.appName) setAppName(data.appName);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand">{appName}</Link>

        <nav className="tabs" aria-label="Primary">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link key={tab.href} href={tab.href} className={`tab ${active ? 'active' : ''}`}>
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="actions">
          <button aria-label="Settings" className="icon-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
          <button aria-label="Account" className="avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        .navbar {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .navbar-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem 2rem;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 1rem;
        }
        /* :global() because Next.js <Link> renders an <a> that styled-jsx
           can't statically scope-hash at compile time. We pin via the parent
           class so the rules stay confined to the navbar (no global leakage). */
        .navbar-inner :global(.brand) {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text);
          text-decoration: none;
          letter-spacing: -0.01em;
        }
        .tabs {
          display: flex;
          gap: 1.75rem;
          justify-content: center;
        }
        .navbar-inner :global(.tab) {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: 500;
          padding: 0.5rem 0.1rem;
          border-bottom: 2px solid transparent;
        }
        .navbar-inner :global(.tab):hover { color: var(--text); }
        .navbar-inner :global(.tab.active) {
          color: var(--brand);
          border-bottom-color: var(--brand);
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        .icon-btn, .avatar {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .icon-btn:hover { background: var(--surface-muted); color: var(--text); }
        .avatar {
          background: var(--surface-muted);
          color: var(--text-muted);
        }
        .avatar:hover { background: var(--border); }
      `}</style>
    </header>
  );
}
