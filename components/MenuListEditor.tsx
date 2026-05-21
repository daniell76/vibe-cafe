'use client';

interface Props {
  label: string;
  items: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}

export default function MenuListEditor({ label, items, placeholder, onChange }: Props) {
  const update = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="editor">
      <label className="hdr">{label}</label>
      <ul className="rows">
        {items.length === 0 && (
          <li className="empty">No items yet.</li>
        )}
        {items.map((item, i) => (
          <li key={i} className="row">
            <input
              type="text"
              value={item}
              placeholder={placeholder}
              onChange={(e) => update(i, e.target.value)}
            />
            <button
              type="button"
              className="del"
              onClick={() => remove(i)}
              aria-label={`Remove ${item || 'item'}`}
              title="Remove"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="add" onClick={add}>
        <span aria-hidden>+</span> Add item
      </button>

      <style jsx>{`
        .editor { display: flex; flex-direction: column; gap: 0.5rem; }
        .hdr { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
        .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
        .row { display: flex; gap: 0.4rem; align-items: center; }
        .row input { flex: 1; }
        .del {
          width: 34px; height: 34px;
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .del:hover { color: var(--g-red); border-color: var(--g-red); background: rgba(234,67,53,0.06); }
        .add {
          align-self: flex-start;
          padding: 0.4rem 0.8rem;
          background: transparent;
          border: 1px dashed var(--border-strong);
          border-radius: 8px;
          color: var(--brand);
          cursor: pointer;
          font-size: 0.85rem;
          display: inline-flex; align-items: center; gap: 0.4rem;
        }
        .add:hover { background: var(--brand-soft); border-color: var(--brand); }
        .add span { font-size: 1.05rem; line-height: 1; }
        .empty { color: var(--text-faint); font-size: 0.85rem; font-style: italic; padding: 0.25rem 0; }
      `}</style>
    </div>
  );
}
