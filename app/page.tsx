'use client';

import { useEffect, useState } from 'react';
import CustomizeStep from '@/components/ordering/CustomizeStep';
import ArtSelectStep from '@/components/ordering/ArtSelectStep';
import ReviewStep from '@/components/ordering/ReviewStep';
import ConfirmedStep from '@/components/ordering/ConfirmedStep';
import { ArtOption, DEFAULT_ORDER_SETTINGS, OrderDraft, OrderSettings } from '@/components/ordering/types';

type Step = 'customize' | 'art' | 'review' | 'confirmed' | 'error';

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
  const [step, setStep] = useState<Step>('customize');
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [settings, setSettings] = useState<OrderSettings>(DEFAULT_ORDER_SETTINGS);
  const [artOptions, setArtOptions] = useState<ArtOption[]>([]);
  const [vibeImageUrl, setVibeImageUrl] = useState<string | null>(null);
  const [selectedArtId, setSelectedArtId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const drinks = data.drinks?.length ? data.drinks : DEFAULT_ORDER_SETTINGS.drinks;
        const milks = data.milks?.length ? data.milks : DEFAULT_ORDER_SETTINGS.milks;
        const flavors = data.flavors?.length ? data.flavors : DEFAULT_ORDER_SETTINGS.flavors;
        setSettings({
          appName: data.appName ?? DEFAULT_ORDER_SETTINGS.appName,
          tagline: data.tagline ?? DEFAULT_ORDER_SETTINGS.tagline,
          drinks,
          milks,
          flavors,
          instructions: data.instructions ?? DEFAULT_ORDER_SETTINGS.instructions,
          defaultDrink: data.defaultDrink ?? DEFAULT_ORDER_SETTINGS.defaultDrink,
          defaultMilk: data.defaultMilk ?? DEFAULT_ORDER_SETTINGS.defaultMilk,
          defaultAddition: data.defaultAddition ?? DEFAULT_ORDER_SETTINGS.defaultAddition,
        });
        setDraft((prev) => ({
          ...prev,
          coffeeOrder: resolveDefault(drinks, data.defaultDrink),
          milk: resolveDefault(milks, data.defaultMilk),
          addition: resolveDefault(flavors, data.defaultAddition),
        }));
      })
      .catch(() => {});
  }, []);

  const fetchPreviews = async () => {
    setIsGenerating(true);
    // Stash the URLs we're about to throw away so submit can ask the backend
    // to clean them up from GCS even after a regenerate.
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
      if (!res.ok) throw new Error('Failed to generate art previews');
      const data = await res.json();
      setArtOptions(data.options || []);
      setVibeImageUrl(data.vibeImageUrl || null);
      if (data.options?.[0]) setSelectedArtId(data.options[0].id);
      // Best-effort cleanup of the previous round's orphans.
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

  const goToArt = async () => {
    setStep('art');
    await fetchPreviews();
  };

  const regenerate = async () => {
    await fetchPreviews();
  };

  const submitOrder = async () => {
    const selected = artOptions.find((o) => o.id === selectedArtId);
    if (!selected) return;
    const unpicked = artOptions.filter((o) => o.id !== selectedArtId).map((o) => o.imageUrl);
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
          imageUrl: selected.imageUrl,
          vibeImageUrl: vibeImageUrl || undefined,
          unpickedImageUrls: unpicked,
          artLabel: selected.label,
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
    setDraft({
      ...EMPTY_DRAFT,
      coffeeOrder: resolveDefault(settings.drinks, settings.defaultDrink),
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
        <CustomizeStep draft={draft} settings={settings} onChange={setDraft} onNext={goToArt} />
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
        />
      )}

      {step === 'review' && selectedArtId && (
        <ReviewStep
          draft={draft}
          selectedArt={artOptions.find((o) => o.id === selectedArtId)!}
          isSubmitting={isSubmitting}
          onEdit={() => setStep('customize')}
          onSubmit={submitOrder}
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
