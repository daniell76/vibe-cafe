'use client';

interface DrinkItem {
  name: string;
  hasFoam: boolean;
}

interface Category {
  name: string;
  items: DrinkItem[];
}

interface Props {
  categories: Category[];
  onChange: (next: Category[]) => void;
}

// Nested editor: a list of categories, each with a list of drink items.
// Each item has a name input + a "Has foam" toggle — when off, the ordering
// wizard skips the foam-art step entirely for that drink (e.g. teas).
export default function DrinkCategoriesEditor({ categories, onChange }: Props) {
  const update = (i: number, next: Partial<Category>) => {
    const out = categories.map((c, idx) => (idx === i ? { ...c, ...next } : c));
    onChange(out);
  };
  const remove = (i: number) => onChange(categories.filter((_, idx) => idx !== i));
  const add = () => onChange([...categories, { name: '', items: [] }]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= categories.length) return;
    const out = [...categories];
    [out[i], out[j]] = [out[j], out[i]];
    onChange(out);
  };

  const updateItem = (catIdx: number, itemIdx: number, next: Partial<DrinkItem>) => {
    const cat = categories[catIdx];
    const items = cat.items.map((it, idx) => (idx === itemIdx ? { ...it, ...next } : it));
    update(catIdx, { items });
  };
  const removeItem = (catIdx: number, itemIdx: number) => {
    const cat = categories[catIdx];
    update(catIdx, { items: cat.items.filter((_, idx) => idx !== itemIdx) });
  };
  const addItem = (catIdx: number) => {
    const cat = categories[catIdx];
    update(catIdx, { items: [...cat.items, { name: '', hasFoam: true }] });
  };

  return (
    <div className="cats-editor">
      <p className="cats-hint">
        Group drinks by category (e.g. Signature Drinks, Coffees, Teas). Uncheck
        <strong> Has foam </strong> for drinks that should skip the coffee-art generation
        step (teas, cold coffees, etc.).
      </p>

      {categories.map((cat, i) => (
        <div key={i} className="cat-card">
          <div className="cat-head">
            <input
              className="cat-name"
              type="text"
              value={cat.name}
              placeholder="Category name (e.g. Coffees)"
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <div className="cat-actions">
              <button
                type="button"
                className="iconbtn"
                title="Move up"
                aria-label="Move category up"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >↑</button>
              <button
                type="button"
                className="iconbtn"
                title="Move down"
                aria-label="Move category down"
                onClick={() => move(i, 1)}
                disabled={i === categories.length - 1}
              >↓</button>
              <button
                type="button"
                className="iconbtn danger"
                title="Remove category"
                aria-label={`Remove ${cat.name || 'category'}`}
                onClick={() => remove(i)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="item-list">
            {cat.items.map((it, j) => (
              <div key={j} className="item-row">
                <input
                  className="item-name"
                  type="text"
                  value={it.name}
                  placeholder="Drink name (e.g. Latte)"
                  onChange={(e) => updateItem(i, j, { name: e.target.value })}
                />
                <label className="foam-toggle" title="Has foam — when off, the ordering wizard skips the coffee-art step">
                  <input
                    type="checkbox"
                    checked={it.hasFoam}
                    onChange={(e) => updateItem(i, j, { hasFoam: e.target.checked })}
                  />
                  Has foam
                </label>
                <button
                  type="button"
                  className="iconbtn danger"
                  title="Remove drink"
                  aria-label={`Remove ${it.name || 'drink'}`}
                  onClick={() => removeItem(i, j)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
            <button type="button" className="add-item" onClick={() => addItem(i)}>
              <span aria-hidden>+</span> Add drink
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="add-cat" onClick={add}>
        <span aria-hidden>+</span> Add category
      </button>

      <style jsx>{`
        .cats-editor { display: flex; flex-direction: column; gap: 0.9rem; }
        .cats-hint { color: var(--text-muted); font-size: 0.85rem; margin: 0; }
        .cat-card {
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 0.9rem 1rem 1rem;
          background: var(--surface-muted);
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
        }
        .cat-head { display: flex; gap: 0.5rem; align-items: center; }
        .cat-name { flex: 1; font-weight: 500; }
        .cat-actions { display: flex; gap: 0.25rem; }
        .iconbtn {
          width: 32px; height: 32px;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid var(--border-strong);
          background: var(--surface);
          color: var(--text-muted);
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .iconbtn:hover:not(:disabled) { color: var(--text); border-color: var(--text-muted); }
        .iconbtn:disabled { opacity: 0.3; cursor: not-allowed; }
        .iconbtn.danger:hover { color: var(--g-red); border-color: var(--g-red); background: rgba(234,67,53,0.06); }
        .item-list { display: flex; flex-direction: column; gap: 0.4rem; }
        .item-row {
          display: grid;
          grid-template-columns: 1fr auto 32px;
          gap: 0.5rem;
          align-items: center;
        }
        .item-name {
          background: var(--surface);
          font-size: 0.9rem;
        }
        .foam-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.8rem;
          color: var(--text-muted);
          white-space: nowrap;
          cursor: pointer;
          padding: 0 0.5rem;
        }
        .foam-toggle input { width: auto; margin: 0; }
        .add-item, .add-cat {
          align-self: flex-start;
          padding: 0.4rem 0.85rem;
          background: transparent;
          border: 1px dashed var(--border-strong);
          border-radius: 8px;
          color: var(--brand);
          cursor: pointer;
          font-size: 0.85rem;
          display: inline-flex; align-items: center; gap: 0.4rem;
        }
        .add-item:hover, .add-cat:hover { background: var(--brand-soft); border-color: var(--brand); }
        @media (max-width: 540px) {
          .item-row { grid-template-columns: 1fr; gap: 0.3rem; }
        }
      `}</style>
    </div>
  );
}
