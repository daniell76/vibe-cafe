'use client';

import { useEffect, useRef, useState } from 'react';
import type { DrinkCategory } from './types';

interface Props {
  id?: string;
  value: string;
  categories: DrinkCategory[];
  placeholder?: string;
  onChange: (next: string) => void;
}

// Styled, categorized dropdown to match brief slide 8/10.
export default function CategorizedSelect({ id, value, categories, placeholder, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const allItems = (categories || []).flatMap((c) => c.items);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (item: string) => {
    onChange(item);
    setOpen(false);
  };

  const display = allItems.includes(value) ? value : (value || placeholder || 'Select…');

  return (
    <div className="cat-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`trigger-label ${!allItems.includes(value) ? 'placeholder' : ''}`}>{display}</span>
        <span className={`caret ${open ? 'up' : ''}`} aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>

      {open && (
        <div className="menu" role="listbox">
          {categories.length === 0 ? (
            <div className="empty">No drinks configured. Add categories in Admin → Menu Management.</div>
          ) : (
            categories.map((cat) => (
              <div key={cat.name} className="group">
                {cat.name && <div className="group-head">{cat.name}</div>}
                {cat.items.map((it) => (
                  <button
                    key={it}
                    type="button"
                    role="option"
                    aria-selected={value === it}
                    className={`opt ${value === it ? 'active' : ''}`}
                    onClick={() => pick(it)}
                  >
                    <span>{it}</span>
                    {value === it && (
                      <svg className="check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      <style jsx>{`
        .cat-select { position: relative; width: 100%; }
        .trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-strong);
          border-radius: 999px;
          background: var(--surface);
          color: var(--text);
          font-size: 0.95rem;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }
        .trigger:hover { border-color: var(--text-muted); }
        .trigger:focus, .cat-select:focus-within .trigger {
          outline: none;
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(26,115,232,0.15);
        }
        .trigger-label.placeholder { color: var(--text-faint); }
        .caret { color: var(--text-muted); display: inline-flex; transition: transform 0.15s; }
        .caret.up { transform: rotate(180deg); }

        .menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 30;
          max-height: 320px;
          overflow-y: auto;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
          padding: 0.35rem 0;
        }
        .group { display: flex; flex-direction: column; }
        .group + .group { border-top: 1px solid var(--border); margin-top: 0.25rem; padding-top: 0.35rem; }
        .group-head {
          padding: 0.5rem 1rem 0.25rem;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--text-faint);
          text-transform: uppercase;
        }
        .opt {
          appearance: none;
          background: transparent;
          border: none;
          text-align: left;
          padding: 0.5rem 1rem;
          font-size: 0.95rem;
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .opt:hover { background: var(--surface-muted); }
        .opt.active { background: var(--brand-soft); color: var(--brand); font-weight: 500; }
        .check { color: var(--brand); }
        .empty { padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.85rem; font-style: italic; }
      `}</style>
    </div>
  );
}
