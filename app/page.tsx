'use client';

import { useEffect, useRef, useState } from 'react';
import CustomizeStep from '@/components/ordering/CustomizeStep';
import ArtSelectStep from '@/components/ordering/ArtSelectStep';
import ReviewStep from '@/components/ordering/ReviewStep';
import ConfirmedStep from '@/components/ordering/ConfirmedStep';
import { ArtOption, DEFAULT_ORDER_SETTINGS, OrderDraft, OrderSettings } from '@/components/ordering/types';
import { useSessionState, clearSessionPrefix } from '@/lib/sessionState';

type Step = 'customize' | 'art' | 'review' | 'confirmed' | 'error';

// All ordering state lives under this key prefix so we can wipe it atomically
// on order completion or "New Order".
const SS_PREFIX = 'vibe-cafe.order.';

const EMPTY_DRAFT: OrderDraft = {
  name: '',
  coffeeOrder: 'Latte',
  milk: 'None',
  addition: 'None',
  extraShots: 0,
  happyPlace: '',
};

// Pick the operator-configured default if it's still in the menu;
// otherwise fall back to looking for "None"; otherwise the first item.
function resolveDefault(items: string[] | undefined, configured: string | undefined): string {
  const list = items ?? [];
  if (configured && list.includes(configured)) return configured;
  return list.find((f) => f.toLowerCase() === 'none') ?? list[0] ?? configured ?? '';
}

export default function OrderingPage() {
  // Persisted across in-tab navigation + refresh (30 min expiry).
  const [step, setStep, stepHydrated] = useSessionState<Step>(`${SS_PREFIX}step`, 'customize');
  const [draft, setDraft, draftHydrated] = useSessionState<OrderDraft>(`${SS_PREFIX}draft`, EMPTY_DRAFT);
  const [artOptions, setArtOptions] = useSessionState<ArtOption[]>(`${SS_PREFIX}options`, []);
  const [vibeImageUrl, setVibeImageUrl] = useSessionState<string | null>(`${SS_PREFIX}vibe`, null);
  const [selectedArtId, setSelectedArtId] = useSessionState<string | null>(`${SS_PREFIX}selected`, null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useSessionState<number | null>(`${SS_PREFIX}confirmed`, null);

  // Transient (not persisted) — refetched / derived on mount.
  const [settings, setSettings] = useState<OrderSettings>(DEFAULT_ORDER_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard against double-firing the auto-resume effect across re-renders.
  const resumedRef = useRef(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const milks = data.milks?.length ? data.milks : DEFAULT_ORDER_SETTINGS.milks;
        const flavors = data.flavors?.length ? data.flavors : DEFAULT_ORDER_SETTINGS.flavors;
        const drinkCategories = Array.isArray(data.drinkCategories) && data.drinkCategories.length
          ? data.drinkCategories
          : DEFAULT_ORDER_SETTINGS.drinkCategories;
        // Normalised at the API layer, but defend here too — legacy string items
        // shouldn't crash the customer page.
        const allDrinkNames: string[] = drinkCategories.flatMap(
          (c: { items: Array<{ name: string } | string> }) =>
            c.items.map((it) => (typeof it === 'string' ? it : it.name)),
        );
        setSettings({
          appName: data.appName ?? DEFAULT_ORDER_SETTINGS.appName,
          tagline: data.tagline ?? DEFAULT_ORDER_SETTINGS.tagline,
          drinkCategories,
          milks,
          flavors,
          additionsEnabled: typeof data.additionsEnabled === 'boolean' ? data.additionsEnabled : DEFAULT_ORDER_SETTINGS.additionsEnabled,
          extraShotsEnabled: typeof data.extraShotsEnabled === 'boolean' ? data.extraShotsEnabled : DEFAULT_ORDER_SETTINGS.extraShotsEnabled,
          instructions: data.instructions ?? DEFAULT_ORDER_SETTINGS.instructions,
          aiInspirationHint: data.aiInspirationHint ?? DEFAULT_ORDER_SETTINGS.aiInspirationHint,
          aiInspirationPlaceholder: data.aiInspirationPlaceholder ?? DEFAULT_ORDER_SETTINGS.aiInspirationPlaceholder,
          defaultDrink: data.defaultDrink ?? DEFAULT_ORDER_SETTINGS.defaultDrink,
          defaultMilk: data.defaultMilk ?? DEFAULT_ORDER_SETTINGS.defaultMilk,
          defaultAddition: data.defaultAddition ?? DEFAULT_ORDER_SETTINGS.defaultAddition,
        });
        // Only seed draft defaults if the user hasn't already started a draft
        // (i.e. we just hydrated an empty draft from a fresh session).
        setDraft((prev) => {
          if (prev.name || prev.happyPlace) return prev;
          return {
            ...prev,
            coffeeOrder: resolveDefault(allDrinkNames, data.defaultDrink),
            milk: resolveDefault(milks, data.defaultMilk),
            addition: resolveDefault(flavors, data.defaultAddition),
          };
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPreviews = async () => {
    setIsGenerating(true);
    // Stash the URLs we're about to throw away so cleanup can purge them from GCS.
    const orphans = artOptions.map((o) => o.imageUrl);
    if (vibeImageUrl) orphans.push(vibeImageUrl);
    setArtOptions([]);
    setVibeImageUrl(null);
    setSelectedArtId(null);
    setError(null);
    try {
      const res = await fetch('/api/order/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ happyPlace: draft.happyPlace }),
      });
      // The server returns 422 only when BOTH generation batches failed —
      // very rare, almost always means the customer's input is problematic.
      // Surface a friendly message and send them back to edit the input.
      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "We couldn't generate art for that input. Try a different favourite item.");
        setStep('customize');
        resumedRef.current = false;
        return;
      }
      if (!res.ok) throw new Error('Failed to generate art previews');
      const data = await res.json();
      setArtOptions(data.options || []);
      setVibeImageUrl(data.vibeImageUrl || null);
      if (data.options?.[0]) setSelectedArtId(data.options[0].id);
      if (orphans.length > 0) {
        fetch('/api/order/preview/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: orphans }),
        }).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStep('error');
    } finally {
      setIsGenerating(false);
    }
  };

  // True if the currently selected drink has the hasFoam flag (defaults to
  // true for drinks not found in the menu — pre-feature data, safety net).
  const currentDrinkHasFoam = (): boolean => {
    for (const cat of settings.drinkCategories) {
      for (const it of cat.items) {
        if (it.name === draft.coffeeOrder) return it.hasFoam !== false;
      }
    }
    return true;
  };

  const goToArt = async () => {
    // No-foam drinks skip the art-select step entirely. Submit happens straight
    // from the review screen without a generated foam image.
    if (!currentDrinkHasFoam()) {
      setArtOptions([]);
      setVibeImageUrl(null);
      setSelectedArtId(null);
      setStep('review');
      return;
    }
    setStep('art');
    await fetchPreviews();
  };

  const regenerate = async () => {
    await fetchPreviews();
  };

  // Edge case 2: in-flight generation. If we hydrate into step='art' with no
  // options + a non-empty happyPlace, the user was mid-generation when they
  // navigated away. The original fetch is gone; re-trigger it.
  useEffect(() => {
    if (!stepHydrated || !draftHydrated) return;
    if (resumedRef.current) return;
    if (step === 'art' && artOptions.length === 0 && !isGenerating && draft.happyPlace.trim()) {
      resumedRef.current = true;
      const t = setTimeout(fetchPreviews, 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepHydrated, draftHydrated, step, artOptions.length, isGenerating]);

  // Edge case 1: stale URLs. If any of the persisted preview images 404 (our
  // cleanup endpoint deleted them), regenerate the whole set. We HEAD-probe
  // the first option on hydrate; if it's gone, all four are (same session).
  useEffect(() => {
    if (!stepHydrated) return;
    if (step !== 'art' || artOptions.length === 0) return;
    if (isGenerating) return;
    let cancelled = false;
    fetch(artOptions[0].imageUrl, { method: 'HEAD' })
      .then((r) => {
        if (cancelled) return;
        if (r.status === 404) {
          // Clear options so the auto-resume effect above will re-trigger gen.
          resumedRef.current = false;
          setArtOptions([]);
          setSelectedArtId(null);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepHydrated]);

  // Tester-feedback bypass: customer gets impatient after 30 s of generation,
  // hits Skip & submit. Same effect as a no-foam drink — order goes through
  // with no imageUrl, barista row shows the "no foam" tag, Download disabled.
  const bypassWithoutArt = async () => {
    setArtOptions([]);
    setVibeImageUrl(null);
    setSelectedArtId(null);
    setIsGenerating(false);
    await submitOrder({ bypass: true });
  };

  // Options object (not a bare boolean) so callers can't accidentally pass a
  // React SyntheticEvent — onClick={submitOrder} would forward the event into
  // `bypass`, which then leaks into the JSON body and trips JSON.stringify
  // on the circular React Fiber. Bug surfaced 2026-05-29 via ReviewStep.
  const submitOrder = async (opts: { bypass?: boolean } = {}) => {
    const isNoFoam = opts.bypass === true || !currentDrinkHasFoam();
    // For foam drinks we need a selected art before we can submit. For no-foam
    // drinks the wizard skipped art-select, so there's no selection to wait on.
    const selected = artOptions.find((o) => o.id === selectedArtId);
    if (!isNoFoam && !selected) return;
    const unpicked = !isNoFoam && selected
      ? artOptions.filter((o) => o.id !== selectedArtId).map((o) => o.imageUrl)
      : [];
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          coffeeOrder: draft.coffeeOrder,
          milk: draft.milk,
          additions: draft.addition ? [draft.addition] : [],
          extraShots: draft.extraShots ?? 0,
          happyPlace: draft.happyPlace,
          // No foam → no imageUrl, no vibe (no preview was generated at all).
          imageUrl: isNoFoam ? undefined : selected?.imageUrl,
          vibeImageUrl: isNoFoam ? undefined : (vibeImageUrl || undefined),
          unpickedImageUrls: unpicked,
          artLabel: isNoFoam ? undefined : selected?.label,
          noFoam: isNoFoam,
        }),
      });
      if (!res.ok) throw new Error('Failed to submit order');
      const data = await res.json();
      setConfirmedOrderNumber(data.orderNumber ?? 0);
      setStep('confirmed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    // Edge case 3: clear persisted state so the next customer (or this one
    // hitting "New Order") starts clean.
    clearSessionPrefix(SS_PREFIX);
    resumedRef.current = false;
    setDraft({
      ...EMPTY_DRAFT,
      coffeeOrder: resolveDefault(settings.drinkCategories.flatMap((c) => c.items.map((it) => it.name)), settings.defaultDrink),
      milk: resolveDefault(settings.milks, settings.defaultMilk),
      addition: resolveDefault(settings.flavors, settings.defaultAddition),
    });
    setArtOptions([]);
    setVibeImageUrl(null);
    setSelectedArtId(null);
    setConfirmedOrderNumber(null);
    setError(null);
    setStep('customize');
  };

  return (
    <main className="page">
      {step === 'customize' && (
        <>
          {error && (
            <div className="generation-error">
              <span aria-hidden>⚠</span>
              <span>{error}</span>
              <button
                type="button"
                className="dismiss"
                onClick={() => setError(null)}
                aria-label="Dismiss"
              >×</button>
            </div>
          )}
          <CustomizeStep
            draft={draft}
            settings={settings}
            onChange={(next) => {
              // Clear the banner as soon as the user edits anything.
              if (error) setError(null);
              setDraft(next);
            }}
            onNext={goToArt}
          />
          <style jsx>{`
            .generation-error {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              padding: 0.85rem 1rem;
              margin: 0 0 1.5rem 0;
              background: rgba(251,188,5,0.12);
              border: 1px solid rgba(251,188,5,0.45);
              border-radius: var(--radius-sm);
              color: #7a5c00;
              font-size: 0.9rem;
              line-height: 1.4;
            }
            .generation-error span:nth-child(2) { flex: 1; }
            .dismiss {
              background: transparent;
              border: none;
              color: inherit;
              cursor: pointer;
              font-size: 1.25rem;
              line-height: 1;
              padding: 0 0.25rem;
              opacity: 0.7;
            }
            .dismiss:hover { opacity: 1; }
          `}</style>
        </>
      )}

      {step === 'art' && (
        <ArtSelectStep
          options={artOptions}
          selectedId={selectedArtId}
          isLoading={isGenerating}
          settings={settings}
          onSelect={setSelectedArtId}
          onBack={() => setStep('customize')}
          onNext={() => setStep('review')}
          onRegenerate={regenerate}
          onBypass={bypassWithoutArt}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          draft={draft}
          selectedArt={selectedArtId ? artOptions.find((o) => o.id === selectedArtId) ?? null : null}
          isSubmitting={isSubmitting}
          showAddOns={settings.additionsEnabled || settings.extraShotsEnabled}
          onEdit={() => setStep('customize')}
          onSubmit={() => submitOrder()}
        />
      )}

      {step === 'confirmed' && confirmedOrderNumber !== null && (
        <ConfirmedStep orderNumber={confirmedOrderNumber} onNewOrder={reset} />
      )}

      {step === 'error' && (
        <div className="gradient-card error">
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={reset}>Start over</button>
          <style jsx>{`
            .error {
              max-width: 480px;
              margin: 0 auto;
              text-align: center;
              padding: 2.5rem;
              display: flex;
              flex-direction: column;
              gap: 1rem;
              align-items: center;
            }
          `}</style>
        </div>
      )}
    </main>
  );
}
