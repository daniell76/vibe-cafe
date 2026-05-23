'use client';

import MenuListEditor from './MenuListEditor';

interface Category {
  name: string;
  items: string[];
}

interface Props {
  categories: Category[];
  onChange: (next: Category[]) => void;
}

// Nested editor: a list of categories, each with its own list of drink items.
// When `categories.length === 0` the ordering page falls back to the flat
// `drinks[]` field (backwards compatible).
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

  return (
    <div className="cats-editor">
      <p className="cats-hint">
        Group drinks by category (e.g. Signature Drinks, Coffees, Teas). The customer
        ordering page shows them grouped in the dropdown.
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

          <MenuListEditor
            label="Drinks in this category"
            items={cat.items}
            placeholder="e.g. Latte"
            onChange={(items) => update(i, { items })}
          />
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
        .add-cat {
          align-self: flex-start;
          padding: 0.45rem 0.9rem;
          background: transparent;
          border: 1px dashed var(--border-strong);
          border-radius: 8px;
          color: var(--brand);
          cursor: pointer;
          font-size: 0.9rem;
          display: inline-flex; align-items: center; gap: 0.4rem;
        }
        .add-cat:hover { background: var(--brand-soft); border-color: var(--brand); }
      `}</style>
    </div>
  );
}
