import { Firestore } from '@google-cloud/firestore';
import { safeTz, startOfTodayUtc } from './timezone';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const collectionName = process.env.VIBE_CAFE_COLLECTION || 'orders';

if (!project) {
  console.warn('WARNING: GOOGLE_CLOUD_PROJECT is not set for Firestore.');
}

const firestore = new Firestore({
  projectId: project,
  preferRest: true, 
});

export interface OrderData {
  name: string;
  coffeeOrder: string;
  milk?: string;
  flavor?: string;
  additions?: string[];
  extraShots?: number;
  artLabel?: string;
  happyPlace: string;
  imageUrl: string;
  vibeImageUrl?: string;
  status?: string;
  orderNumber?: number;
  createdAt?: string;
  // Stamped server-side by updateOrderStatus when status flips to the
  // matching value. Tracking pages use these to expire picked-up orders and
  // to time the "ready" popup.
  completedAt?: string;
  pickedUpAt?: string;
}

export type VibeImageAspect = '16:9' | '4:3';

export interface DrinkItem {
  name: string;
  // If false, the ordering wizard skips the foam-art-select step and the
  // order is saved with no foam imageUrl. Defaults to true on legacy
  // string-only entries via normalizeDrinkCategories.
  hasFoam: boolean;
}

export interface DrinkCategory {
  name: string;
  items: DrinkItem[];
}

// Tolerate both the legacy string form ("Latte") and the new object form
// ({ name: "Latte", hasFoam: true }) when reading from Firestore.
export function normalizeDrinkItem(raw: unknown): DrinkItem {
  if (typeof raw === 'string') return { name: raw, hasFoam: true };
  if (raw && typeof raw === 'object') {
    const r = raw as { name?: unknown; hasFoam?: unknown };
    return {
      name: String(r.name ?? ''),
      hasFoam: typeof r.hasFoam === 'boolean' ? r.hasFoam : true,
    };
  }
  return { name: '', hasFoam: true };
}

export function normalizeDrinkCategories(raw: unknown): DrinkCategory[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((cat) => {
    const c = cat as { name?: unknown; items?: unknown };
    return {
      name: String(c?.name ?? ''),
      items: Array.isArray(c?.items) ? (c.items as unknown[]).map(normalizeDrinkItem) : [],
    };
  });
}

export interface AppSettings {
  appName: string;
  tagline: string;
  systemPrompt: string;
  drinkCategories: DrinkCategory[];
  milks: string[];
  flavors: string[];
  additionsEnabled: boolean;
  extraShotsEnabled: boolean;
  instructions: {
    step1: string;
    step2: string;
    step3: string;
  };
  aiInspirationHint: string;
  aiInspirationPlaceholder: string;
  // Foam art pipeline (B1): brainstorm 4 concepts, then render one icon each.
  foamBrainstormTemplate: string;       // instructions for the brainstorm step
  promptTemplate: string;               // per-icon render template — placeholders: {concept}, {happyPlace}
  vibeImageAspect: VibeImageAspect;
  // Vibe image pipeline (B2): extract mood (no subject nouns), render abstract wallpaper.
  vibeMoodTemplate: string;             // instructions for the mood-extraction step
  vibePromptTemplate: string;           // render template — placeholders: {mood}, {happyPlace}
  defaultDrink: string;
  defaultMilk: string;
  defaultAddition: string;
  // How many landscape tracking screens the store has. Each one renders a
  // contiguous slice of the global sorted queue at /tracking/<n>.
  trackingScreens: number;
  // How many minutes a completed (ready) order stays on the tracking
  // dashboard before auto-disappearing. Applied IN ADDITION to the
  // capacity cap — whichever fires first wins.
  readyTtlMinutes: number;
  // How long (seconds) the customer must wait on the art-select loader
  // before the "Skip and submit order" CTA appears. Configurable so
  // operators can tune for slow networks or impatient queues.
  coffeeArtBypassSeconds: number;
  // IANA timezone (e.g. "America/New_York"). Backend stores UTC; this drives
  // day boundaries (today/yesterday scoping, analytics) and front-end time
  // display. Default "UTC" preserves the original behaviour.
  timezone: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'Vibe Café',
  tagline: 'Experience the Future of Coffee',
  systemPrompt:
    'You are the barista AI for Vibe Café. Your goal is to guide users through selecting the perfect coffee blend based on their mood.',
  // Pre-seeded per the PDF brief slide 8 (Signature Drinks / Coffees / Teas).
  // The customer dropdown groups items by these categories.
  drinkCategories: [
    { name: 'Signature Drinks', items: [
      { name: 'Signature Drink 1', hasFoam: true },
      { name: 'Signature Drink 2', hasFoam: true },
    ] },
    { name: 'Coffees', items: [
      { name: 'Espresso', hasFoam: false },
      { name: 'Americano', hasFoam: false },
      { name: 'Latte', hasFoam: true },
      { name: 'Cappuccino', hasFoam: true },
      { name: 'Flat White', hasFoam: true },
      { name: 'Matcha Latte', hasFoam: true },
      { name: 'Iced Cappuccino', hasFoam: false },
      { name: 'Hot Chocolate', hasFoam: true },
    ] },
    { name: 'Teas', items: [
      { name: 'English Breakfast Tea', hasFoam: false },
      { name: 'Earl Grey Tea', hasFoam: false },
      { name: 'Peppermint Tea', hasFoam: false },
      { name: 'Green Tea', hasFoam: false },
    ] },
  ],
  milks: ['Regular Milk', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'None'],
  flavors: ['Vanilla', 'Caramel', 'Hazelnut', 'Sugar Free', 'None'],
  // Both default OFF per page-10 comment ("for this event there is no additions or
  // extra shots option"). Admin can flip either on; items are pre-populated so the
  // operator just toggles to enable.
  additionsEnabled: false,
  extraShotsEnabled: false,
  instructions: {
    step1: 'Personalise your perfect brew',
    step2: 'Choose a generative pattern for your latte art. Our barista bots will precision-etch this design using micro-foam projection.',
    step3: 'Please review your selections before finalising.',
  },
  aiInspirationHint: "What's your favourite hobby, music or destination? We'll use this to style your cup art.",
  aiInspirationPlaceholder: 'I like soul music and especially the music of Aretha Franklin.',
  foamBrainstormTemplate:
    'You generate concept ideas for printable coffee-foam icons. Given a user\'s "happy place" description, return EXACTLY 4 distinct, simple, iconic objects or symbols inspired by — but not directly referencing — the subject. Each concept must be a single recognisable object that can be rendered as a clean black-and-white silhouette icon.\n\n' +
    'Rules:\n' +
    '- 4 distinct concepts, each a short noun phrase (max ~3 words).\n' +
    '- Avoid the subject\'s name itself, brand names, logos, or text.\n' +
    '- Avoid abstract concepts ("freedom", "joy") — pick concrete renderable objects.',
  promptTemplate:
    'A simple, bold, black-on-white silhouette icon of: {concept}. ' +
    'Inspired by, but not directly referencing: {happyPlace}. ' +
    'Single isolated icon centered on a pure white square canvas with substantial empty white margins on all sides. ' +
    'Clean thick lines, high contrast, no text, no words, no logos, no faces, no people, no 3D shading, no photorealism, no background, no decorative frame or ring around the icon.',
  vibeImageAspect: '16:9',
  vibeMoodTemplate:
    'Given a user\'s "happy place" description, extract its emotional ATMOSPHERE into a short, evocative paragraph (60-80 words). Describe colors, light, texture, energy, mood, era, time of day, weather — anything that captures the FEELING of the subject without naming the subject itself.\n\n' +
    'Strictly do NOT mention:\n' +
    '- The original subject\'s name, nouns, people, places, brands, instruments, objects, animals, body parts, buildings, vehicles, food items.\n' +
    '- Verbs of action involving people or things.\n\n' +
    'DO use:\n' +
    '- Color palette words ("warm amber", "deep crimson and gold", "soft sage")\n' +
    '- Light/atmosphere words ("dappled afternoon sun", "neon haze", "candlelight glow")\n' +
    '- Texture words ("velvet", "rough plaster", "molten metal")\n' +
    '- Energy/mood words ("urgent", "languid", "exuberant", "contemplative")',
  vibePromptTemplate:
    'An abstract wallpaper that captures this atmosphere: {mood} ' +
    'Choose ONE of two visual languages based on what best fits the mood: ' +
    '(A) crisp 3D sculptural composition — intersecting geometric planes, crystalline shards, metallic or translucent surfaces, sharp edges, strong directional light; ' +
    'OR (B) bold 2D editorial illustration — stylised vector forms, flat colour fields, confident graphic shapes, rhythmic flowing lines. ' +
    'Magazine-cover quality, high contrast, cinematic, premium 4K, designed to fill a large landscape screen. ' +
    'Do not include words, letters, people, faces, logos, or any recognisable objects.',
  defaultDrink: 'Latte',
  defaultMilk: 'None',
  defaultAddition: 'None',
  trackingScreens: 1,
  readyTtlMinutes: 5,
  coffeeArtBypassSeconds: 30,
  timezone: 'UTC',
};

export async function saveOrder(orderData: OrderData): Promise<string> {
  const collection = firestore.collection(collectionName);
  const payload: Record<string, unknown> = {
    ...orderData,
    status: orderData.status || 'pending',
    createdAt: orderData.createdAt || new Date().toISOString(),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  const docRef = await collection.add(payload);
  return docRef.id;
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const collection = firestore.collection(collectionName);
  const update: Record<string, unknown> = { status };
  // Per brief pp.14-19: only 3 active states (pending, making, completed); no
  // pickedUp. completedAt drives the 3-min auto-expiry on the tracking screen.
  // Stamp each time status transitions to 'completed' (including after an
  // undo→redo) so the TTL resets correctly.
  if (status === 'completed') update.completedAt = new Date().toISOString();
  await collection.doc(orderId).update(update);
}

export async function updateOrderFields(orderId: string, fields: Record<string, unknown>): Promise<void> {
  const collection = firestore.collection(collectionName);
  await collection.doc(orderId).update(fields);
}

export async function deleteOrder(orderId: string): Promise<void> {
  const collection = firestore.collection(collectionName);
  await collection.doc(orderId).delete();
}

// Wipe every order document and reset the order-number counter.
// Returns { deletedOrders, imageUrls } so the caller can also clean storage.
export async function deleteAllOrders(): Promise<{ deletedOrders: number; imageUrls: string[] }> {
  const orders = firestore.collection(collectionName);
  const snapshot = await orders.get();
  const imageUrls: string[] = [];

  // Collect URLs first so we can return them to the caller for GCS cleanup.
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    if (typeof data.imageUrl === 'string') imageUrls.push(data.imageUrl);
    if (typeof data.vibeImageUrl === 'string') imageUrls.push(data.vibeImageUrl);
  }

  // Firestore batches cap at 500 ops.
  const CHUNK = 450;
  for (let i = 0; i < snapshot.docs.length; i += CHUNK) {
    const batch = firestore.batch();
    for (const d of snapshot.docs.slice(i, i + CHUNK)) batch.delete(d.ref);
    await batch.commit();
  }

  // Reset the order-number counter so the next order starts at 1.
  const counterRef = firestore.collection('config').doc('counters');
  await counterRef.set({ orderSequence: 0 }, { merge: true });

  return { deletedOrders: snapshot.size, imageUrls };
}

export async function getOrder(orderId: string): Promise<Record<string, unknown> | null> {
  const collection = firestore.collection(collectionName);
  const doc = await collection.doc(orderId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getOrders(): Promise<Record<string, unknown>[]> {
  const collection = firestore.collection(collectionName);
  // Today's orders only, where "today" is the operator's local day in the
  // configured timezone (default UTC). This keeps an evening event that
  // crosses UTC midnight — but not local midnight — from vanishing off the
  // barista console mid-shift. Yesterday's orders fall off automatically so
  // back-to-back events start clean without needing Nuke.
  //
  // Firestore: a single inequality + orderBy on the SAME field uses the
  // auto-managed single-field index — no composite index required.
  // saveOrder always stamps createdAt, so no doc is excluded.
  const tz = safeTz((await getSettings()).timezone);
  const from = startOfTodayUtc(tz);
  const snapshot = await collection
    .where('createdAt', '>=', from.toISOString())
    .orderBy('createdAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown>));
}

export interface OrderAnalytics {
  from: string | null;
  to: string | null;
  totalOrders: number;
  totalServed: number;
  inProgress: number;
  topDrinks: Array<{ drink: string; count: number }>;
  recentImages: Array<{ id: string; name: string; coffeeOrder: string; imageUrl: string }>;
}

// Aggregate order analytics over an ISO timestamp range [fromISO, toISO).
// Either bound may be null (null from = since the beginning; null to = up to
// now) so the admin can request today / yesterday / all-days / custom ranges.
// Aggregation happens server-side so an all-days query over thousands of
// orders returns a small fixed-size payload, not the raw documents.
//
// Firestore: a range filter + orderBy on the SAME field (createdAt) uses the
// auto-managed single-field index — no composite index required.
export async function getOrderAnalytics(
  fromISO: string | null,
  toISO: string | null,
): Promise<OrderAnalytics> {
  const collection = firestore.collection(collectionName);
  let q: FirebaseFirestore.Query = collection;
  if (fromISO) q = q.where('createdAt', '>=', fromISO);
  if (toISO) q = q.where('createdAt', '<', toISO);
  q = q.orderBy('createdAt', 'desc');
  const snapshot = await q.get();

  let totalServed = 0;
  const drinkCounts: Record<string, number> = {};
  const recentImages: OrderAnalytics['recentImages'] = [];

  for (const doc of snapshot.docs) {
    const d = doc.data() as Record<string, unknown>;
    const status = String(d.status || '');
    if (status === 'completed' || status === 'pickedUp') totalServed += 1;
    const drink = String(d.coffeeOrder || 'Other');
    drinkCounts[drink] = (drinkCounts[drink] || 0) + 1;
    // Snapshot is newest-first, so the first 12 with an image are the most
    // recent ones in range.
    const imageUrl = typeof d.imageUrl === 'string' ? d.imageUrl : '';
    if (imageUrl && recentImages.length < 12) {
      recentImages.push({ id: doc.id, name: String(d.name || ''), coffeeOrder: drink, imageUrl });
    }
  }

  const topDrinks = Object.entries(drinkCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([drink, count]) => ({ drink, count }));

  return {
    from: fromISO,
    to: toISO,
    totalOrders: snapshot.size,
    totalServed,
    inProgress: snapshot.size - totalServed,
    topDrinks,
    recentImages,
  };
}

export async function getOrderByNumber(orderNumber: number): Promise<Record<string, unknown> | null> {
  const collection = firestore.collection(collectionName);
  // After Reset Order Number, an old #1 from a previous session can collide
  // with the brand-new #1 we just created. Return the NEWEST match so the
  // booth always lands on the most recent order with that number. We pull
  // up to 10 candidates and sort in memory — avoids needing a composite
  // index (orderNumber ASC + createdAt DESC) while still bounding work.
  const snapshot = await collection.where('orderNumber', '==', orderNumber).limit(10).get();
  if (snapshot.empty) return null;
  const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  docs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return docs[0];
}

// Short-TTL in-memory cache for settings. getSettings() is called on nearly
// every request — including getOrders() on each barista/tracking poll (~5 s) —
// so an uncached read per poll adds up. The settings doc changes rarely (only
// via the admin Save button), so a 30 s cache is safe: admin edits go through
// updateSettings() which busts the cache immediately on the instance that
// handled the write, and other Cloud Run instances pick up the change within
// the TTL. Cache is per-instance, which is fine for this read-mostly doc.
const SETTINGS_CACHE_TTL_MS = 30_000;
let _settingsCache: { value: AppSettings; expiresAt: number } | null = null;

async function fetchSettings(): Promise<AppSettings> {
  const configRef = firestore.collection('config').doc('settings');
  const doc = await configRef.get();
  if (!doc.exists) {
    await configRef.set(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  const stored = (doc.data() || {}) as Partial<AppSettings> & { drinkCategories?: unknown };
  // Migrate any legacy `items: string[]` entries to the new
  // `items: { name, hasFoam }[]` form on read. Falls back to DEFAULT_SETTINGS
  // if the stored field is missing or malformed.
  const drinkCategories = normalizeDrinkCategories(stored.drinkCategories) ?? DEFAULT_SETTINGS.drinkCategories;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    drinkCategories,
    instructions: { ...DEFAULT_SETTINGS.instructions, ...(stored.instructions || {}) },
  };
}

export async function getSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (_settingsCache && _settingsCache.expiresAt > now) {
    return _settingsCache.value;
  }
  const value = await fetchSettings();
  _settingsCache = { value, expiresAt: now + SETTINGS_CACHE_TTL_MS };
  return value;
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  const configRef = firestore.collection('config').doc('settings');
  await configRef.set(settings, { merge: true });
  // Bust the cache so the next read reflects the write immediately on this
  // instance. Other instances expire within SETTINGS_CACHE_TTL_MS.
  _settingsCache = null;
}

// Reset the order-number counter so the next order starts at 1. Does NOT
// touch any orders — call nuke() if you want a clean queue too.
export async function resetOrderCounter(): Promise<void> {
  const counterRef = firestore.collection('config').doc('counters');
  await counterRef.set({ orderSequence: 0 }, { merge: true });
}

export async function getNextOrderNumber(): Promise<number> {
  const counterRef = firestore.collection('config').doc('counters');
  
  try {
    return await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let nextNumber = 1;
      
      if (doc.exists) {
        const data = doc.data();
        nextNumber = (data?.orderSequence || 0) + 1;
      }
      
      if (nextNumber > 9999) {
        nextNumber = 1;
      }
      
      transaction.set(counterRef, { orderSequence: nextNumber }, { merge: true });
      return nextNumber;
    });
  } catch (err) {
    console.error('Transaction counter failure, defaulting to random sequence:', err);
    return Math.floor(Math.random() * 900) + 100;
  }
}
