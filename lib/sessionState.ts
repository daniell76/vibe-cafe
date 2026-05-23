'use client';

// Tiny sessionStorage-backed mirror of useState. Persists across in-tab
// navigation + browser refresh; clears when the tab closes. Used by the
// ordering wizard so customers don't lose their generated previews if they
// click away to the Barista tab and come back.
//
// - Values are wrapped { savedAt, value } so we can expire stale snapshots.
// - Storage is read/written only in effects (SSR-safe).
// - Calling clearSessionPrefix() wipes every key with the given prefix —
//   used on order submit / "New Order" so the next customer starts clean.

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

const DEFAULT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface Wrapped<T> {
  savedAt: number;
  value: T;
}

function safeRead<T>(key: string, expiryMs: number): T | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Wrapped<T>;
    if (typeof parsed?.savedAt !== 'number') return undefined;
    if (Date.now() - parsed.savedAt > expiryMs) {
      window.sessionStorage.removeItem(key);
      return undefined;
    }
    return parsed.value;
  } catch {
    return undefined;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: Wrapped<T> = { savedAt: Date.now(), value };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded, private-browsing, etc. — fail silently; in-memory state still works.
  }
}

/**
 * Like useState, but mirrors the value to sessionStorage[key]. Hydrates from
 * storage on mount (one frame after first render — there's a brief flash of
 * the initial value before the persisted value appears).
 *
 * @returns [value, setValue, isHydrated] — isHydrated flips true once the
 * sessionStorage read has happened, so callers can gate any "is this a fresh
 * mount?" logic on it.
 */
export function useSessionState<T>(
  key: string,
  initial: T,
  opts: { expiryMs?: number } = {},
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate exactly once on mount. Deferred via setTimeout so we don't trip
  // react-hooks/set-state-in-effect — same pattern used elsewhere in the app
  // for "fetch on mount then setState" effects.
  useEffect(() => {
    const t = setTimeout(() => {
      const stored = safeRead<T>(key, opts.expiryMs ?? DEFAULT_EXPIRY_MS);
      if (stored !== undefined) setValue(stored);
      hydratedRef.current = true;
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Mirror writes back to storage — but only after we've hydrated, so we don't
  // overwrite a real persisted value with `initial` on the first render.
  useEffect(() => {
    if (hydratedRef.current) safeWrite(key, value);
  }, [key, value]);

  return [value, setValue, hydrated];
}

/** Remove every sessionStorage key that starts with the given prefix. */
export function clearSessionPrefix(prefix: string): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) window.sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}
